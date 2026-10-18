// Server-orchestratie van een voorstel-PREVIEW (Fase C): valideert, past entitlement per regel toe, verifieert de bron per regel met de
// B1-verificatiemotor en levert previewdata. SCHRIJFT NIETS: geen database, geen opslag, geen taken, geen chat.
//
// Wat dit bestand NIET is: een tweede verificatielogica. Elke statusbepaling gebeurt in B1 (verifieerBron -> verifySourceEvidence ->
// bepaalVerificatieStatus -> bouwMetadata). Hier wordt alleen georkestreerd: wie mag wat zien, welke regel gaat naar welke bron,
// binnen welke limieten, en wat de client terugkrijgt.
//
// Vaste volgorde per aanroep:
//   1. invoer en token-eisen controleren (gebruiker, project, datum)
//   2. ENTITLEMENT per regel, vóór alles: alleen een record op niveau 'volledig' blijft over. Verborgen, publiek of onbekend = regel
//      verdwijnt (niet te onderscheiden van niet bestaand). Productregel 15-10-2026: een Premium-record verschijnt alleen bij Premium,
//      ook niet als "alleen naam" bij Pro of Free. Online = overgeslagen (geen server-bekende bron)
//   3. contractvalidatie met server-bekende records (bedragen binnen grenzen, financieringsgat, dubbelen, bestaande regels)
//   4. een tweede, onafhankelijke grenzencontrole op het resultaat (fail-safe: bij twijfel geen voorstel)
//   5. verificatie per toegestane regel (begrensd aantal, begrensde tijd, begrensde gelijktijdigheid)
//   6. token (alleen met server-geheim; zonder geheim: null)
// Elke uitzondering eindigt in ok:false zonder enige verificatiestatus. De client kan een status nooit zelf bepalen.

// @deno-types="./voorstelContract.d.ts"
import { MAX_REGELS, berekenTotalen, isEchteDatum, schaalEnControleer, toegestaneSom, veiligeUrl } from './voorstelContract.js';
import type { PlanningBron } from './actieplanPlanning.ts';
import type { BekendRecord, ContractRegel, ContractVoorstel } from './voorstelContract.js';
import { zoekFragmenten } from './fragmentZoeker.ts';
import { bouwMetadata } from './voorstelMetadata.ts';
import type { Herkomst, VoorstelMetadata } from './voorstelMetadata.ts';
import { verifieerBron } from './verificationResult.ts';
import type { VerificatieAfhankelijkheden, VerificatieCategorie } from './verificationResult.ts';
import { controleerToken, maakToken, voorstelHash, STANDAARD_GELDIGHEID_SECONDEN } from './voorstelToken.ts';
import type { TokenFout } from './voorstelToken.ts';

export const MAX_VERIFICATIES_PER_VOORSTEL = 6; // meer regels krijgen "niet gecontroleerd", niet "later nog eens"
export const MAX_GELIJKTIJDIG = 2;
export const VERIFICATIE_BUDGET_MS = 45_000; // totale wandkloktijd voor alle bronnen samen; B1 begrenst één bron op 8 s
export const MIN_GEHEIM_LENGTE = 32;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ToegangsNiveau = 'verborgen' | 'publiek' | 'volledig';

// Een door DE SERVER geladen record (uit kompas_subsidieregelingen_voor_tier of kompas_funders_voor_matching, daarna door de bestaande
// entitlementlaag gehaald). De client levert dit nooit. `niveau` is het besluit van die laag.
export interface ServerRecord {
  type: 'regeling' | 'fonds';
  id: string;
  niveau: ToegangsNiveau;
  naam: string;
  gever?: string;
  website?: string | null; // bron-URL voor verificatie (https)
  deadline?: string | null;
  min?: number | null;
  max?: number | null;
  cofinanciering?: string | null;
  // Wat onze database van dit record zegt over waarop gescand wordt (alleen bij niveau 'volledig'). Nog niet door de verificatiemotor
  // gecontroleerd; dit is de vergelijkingsbasis voor de latere controle van doelgroep, werkgebied en aanvragertype (TIER-3).
  themas?: string[]; // disciplines
  doelgroepen?: string[];
  werkgebieden?: string[];
  aanvraagcriteria?: string | null; // vrije tekst; hier staat ook het aanvragertype (geen aparte kolom)
  omschrijving?: string | null; // korte beschrijving van de financier (missie of type projecten)
  bandbreedte?: string | null; // naam van de bandbreedte uit de database
  // Wat de database weet over het plannen van de aanvraag (rondes, beoordelingsdatum, behandeltermijn, vergaderdatum). Alleen bij niveau 'volledig'.
  planning?: PlanningBron | null;
}

export interface PreviewInvoer {
  raw: unknown; // het voorstel zoals de client het stuurt (wordt als onbetrouwbaar behandeld)
  uid: string;
  projectId: string;
  dekking: unknown; // server-berekend (berekenDekking op het project van deze gebruiker)
  bestaandeRegels?: Array<{ schemeId?: string | null; funderId?: string | null; naam?: string; financierNaam?: string }>;
  bedragenToegestaan?: boolean;
  records: ServerRecord[];
  geheim?: string | null;
  // Alleen van de server (tierConfig): factor waarmee de som het financieringsgat mag overschrijden (Pro 1.10, Premium 1.20). Ontbreekt = 1.
  dekkingsdoel?: number;
}

export type OvergeslagenCode = 'online-niet-ondersteund' | 'onbekende-bron' | 'geen-object';

export interface RegelVerificatie {
  sleutel: string;
  metadata: VoorstelMetadata | null; // schema-geldig, door de server gebouwd; null = geen claim
  categorie: VerificatieCategorie | 'niet_uitgevoerd';
  reden: 'geen_toegang_tot_details' | 'geen_bron_url' | 'limiet' | 'budget' | 'fout' | null;
  eindgebruikerTekst: string | null;
}

export interface PreviewSucces {
  ok: true;
  voorstel: ContractVoorstel;
  waarschuwingen: Array<{ pad: string; code: string }>;
  overgeslagen: Array<{ index: number; code: OvergeslagenCode }>;
  verificaties: RegelVerificatie[];
  totalen: Record<string, number>;
  token: string | null;
  tokenGeldigTotSeconden: number | null;
  actiesGegenereerd: false;
  opgeslagen: false;
}

export interface PreviewMislukt {
  ok: false;
  reden: 'ongeldige-invoer' | 'voorstel-ongeldig' | 'grenzen-geschonden' | 'onverwachte-fout';
  fouten: Array<{ pad: string; code: string }>;
  // Bewust geen verificatievelden: bij een fout bestaat er niets dat als geverifieerd getoond kan worden.
  opgeslagen: false;
}

export type PreviewUitkomst = PreviewSucces | PreviewMislukt;

export interface PreviewAfhankelijkheden extends VerificatieAfhankelijkheden {
  uuid?: () => string;
  klok?: () => number; // ms; standaard Date.now
}

const mislukt = (reden: PreviewMislukt['reden'], fouten: PreviewMislukt['fouten'] = []): PreviewMislukt => ({ ok: false, reden, fouten, opgeslagen: false });

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const sleutelVan = (type: string, id: string) => `${type}:${id.toLowerCase()}`;

function datumUit(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hostVan(url: string | null): string | null {
  try {
    return url ? new URL(url).hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Stap 2: entitlement per voorstelregel

export interface Gefilterd {
  raw: Record<string, unknown>;
  overgeslagen: Array<{ index: number; code: OvergeslagenCode }>;
  bekend: Record<string, BekendRecord>;
  records: Map<string, ServerRecord>; // op "type:id"
}

// Haalt uit de ruwe regels alles weg wat deze gebruiker niet VOLLEDIG mag zien of waar de server geen bron voor kent. Geeft ook de
// server-bekende records (voor het contract) terug.
export function filterOpEntitlement(raw: Record<string, unknown>, records: ServerRecord[]): Gefilterd {
  const perSleutel = new Map<string, ServerRecord>();

  for (const r of records) {
    if (!r || typeof r.id !== 'string' || !UUID.test(r.id) || (r.type !== 'regeling' && r.type !== 'fonds')) continue;

    perSleutel.set(sleutelVan(r.type, r.id), r);
  }

  const ruwe = Array.isArray(raw.regels) ? raw.regels : [];
  const overgeslagen: Gefilterd['overgeslagen'] = [];
  const bruikbaar: unknown[] = [];
  const bekend: Record<string, BekendRecord> = {};
  const toegestaan = new Map<string, ServerRecord>();

  ruwe.slice(0, MAX_REGELS + 4).forEach((r, index) => {
    if (!isObject(r)) {
      overgeslagen.push({ index, code: 'geen-object' });
      return;
    }

    if (r.type === 'online') {
      // Er is geen server-bekende bron voor een online gevonden regel: niet te controleren, dus ook niet te tonen als voorstel.
      overgeslagen.push({ index, code: 'online-niet-ondersteund' });
      return;
    }

    const id = typeof r.id === 'string' ? r.id.toLowerCase() : '';
    const rec = (r.type === 'regeling' || r.type === 'fonds') && UUID.test(id) ? perSleutel.get(sleutelVan(r.type, id)) : undefined;

    // Verborgen, publiek (record van een hoger abonnement) of onbekend zijn voor de gebruiker niet te onderscheiden.
    if (!rec || rec.niveau !== 'volledig') {
      overgeslagen.push({ index, code: 'onbekende-bron' });
      return;
    }

    bekend[id] = {
      naam: rec.naam,
      gever: rec.gever ?? '',
      deadline: isEchteDatum(rec.deadline) ? (rec.deadline as string) : null,
      min: typeof rec.min === 'number' ? rec.min : null,
      max: typeof rec.max === 'number' ? rec.max : null,
      cofinanciering: rec.cofinanciering ?? null,
    };
    toegestaan.set(id, rec);
    bruikbaar.push(r);
  });

  return { raw: { ...raw, regels: bruikbaar }, overgeslagen, bekend, records: toegestaan };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Stap 4: tweede, onafhankelijke grenzencontrole (niet het contract opnieuw uitvoeren, maar het RESULTAAT tegen de bron van waarheid houden)

export function controleerGrenzen(voorstel: ContractVoorstel, bekend: Record<string, BekendRecord>, dekking: unknown, bedragenToegestaan: boolean, dekkingsdoel: number = 1): string[] {
  const fouten: string[] = [];
  const d = isObject(dekking) ? dekking : {};
  const gat = d.heeftBegroting === true && typeof d.nogTePlannen === 'number' ? Math.max(0, d.nogTePlannen) : 0;
  let som = 0;

  for (const r of voorstel.regels) {
    if (!r.selecteerbaar || r.bedrag == null) continue;

    const rec = r.id ? bekend[r.id] : undefined;

    if (!bedragenToegestaan) fouten.push('bedrag-zonder-begroting');
    if (!rec) fouten.push('bedrag-zonder-record');
    if (!Number.isFinite(r.bedrag) || r.bedrag < 0) fouten.push('bedrag-ongeldig');
    if (rec && rec.max != null && r.bedrag > rec.max) fouten.push('boven-maximum');
    if (rec && rec.min != null && r.bedrag < rec.min) fouten.push('onder-minimum');

    som += r.bedrag;
  }

  if (som > toegestaneSom(gat, dekkingsdoel)) fouten.push('boven-financieringsgat');

  return fouten;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Stap 5: verificatie per regel

interface Taak {
  regel: ContractRegel;
  record: ServerRecord;
}

async function verifieerRegel(taak: Taak, vandaag: string, deps: PreviewAfhankelijkheden): Promise<RegelVerificatie> {
  const { regel, record } = taak;
  const herkomst: Herkomst = record.type;
  const url = veiligeUrl(record.website);
  const domein = hostVan(url);

  if (record.niveau !== 'volledig') {
    return { sleutel: regel.sleutel, metadata: bouwMetadata({ herkomst, vandaag, voorgesteldBedrag: regel.bedrag }), categorie: 'niet_uitgevoerd', reden: 'geen_toegang_tot_details', eindgebruikerTekst: null };
  }

  if (!url || !url.startsWith('https://')) {
    return { sleutel: regel.sleutel, metadata: bouwMetadata({ herkomst, vandaag, voorgesteldBedrag: regel.bedrag }), categorie: 'niet_uitgevoerd', reden: 'geen_bron_url', eindgebruikerTekst: null };
  }

  const db = {
    ...(isEchteDatum(record.deadline) ? { deadline: record.deadline as string } : {}),
    ...(typeof record.min === 'number' ? { bedrag_min: record.min } : {}),
    ...(typeof record.max === 'number' ? { bedrag_max: record.max } : {}),
  };

  const uitkomst = await verifieerBron(
    {
      toegang: { zichtbaar: record.niveau === 'volledig' },
      bronUrl: url,
      financier: { naam: record.naam, ...(record.gever && record.gever !== record.naam ? { aliassen: [record.gever] } : {}), ...(domein ? { domeinen: [domein] } : {}) },
      claims: {},
      bepaalClaims: (pagina) => zoekFragmenten(pagina, db, vandaag),
    },
    deps,
  );

  if (!uitkomst.uitgevoerd || !uitkomst.verificatie) {
    return { sleutel: regel.sleutel, metadata: bouwMetadata({ herkomst, vandaag, voorgesteldBedrag: regel.bedrag }), categorie: uitkomst.categorie, reden: 'fout', eindgebruikerTekst: uitkomst.eindgebruikerTekst };
  }

  const { status: _afgeleid, ...bewijs } = uitkomst.verificatie; // de samenvattende status wordt in bouwMetadata opnieuw afgeleid (centrale functie)

  return {
    sleutel: regel.sleutel,
    metadata: bouwMetadata({ herkomst, vandaag, voorgesteldBedrag: regel.bedrag, verificatie: bewijs }),
    categorie: uitkomst.categorie,
    reden: null,
    eindgebruikerTekst: uitkomst.eindgebruikerTekst,
  };
}

async function verifieerAlle(taken: Taak[], vandaag: string, deps: PreviewAfhankelijkheden): Promise<Map<string, RegelVerificatie>> {
  const klok = deps.klok ?? Date.now;
  const start = klok();
  const uit = new Map<string, RegelVerificatie>();
  let volgende = 0;

  const geenMetadata = (t: Taak, reden: 'limiet' | 'budget' | 'fout'): RegelVerificatie => ({
    sleutel: t.regel.sleutel,
    metadata: bouwMetadata({ herkomst: t.record.type, vandaag, voorgesteldBedrag: t.regel.bedrag }),
    categorie: 'niet_uitgevoerd',
    reden,
    eindgebruikerTekst: null,
  });

  const werker = async () => {
    for (;;) {
      const i = volgende++;

      if (i >= taken.length) return;

      const taak = taken[i];

      if (i >= MAX_VERIFICATIES_PER_VOORSTEL) {
        uit.set(taak.regel.sleutel, geenMetadata(taak, 'limiet'));
        continue;
      }

      if (klok() - start >= VERIFICATIE_BUDGET_MS) {
        uit.set(taak.regel.sleutel, geenMetadata(taak, 'budget'));
        continue;
      }

      try {
        uit.set(taak.regel.sleutel, await verifieerRegel(taak, vandaag, deps));
      } catch {
        uit.set(taak.regel.sleutel, geenMetadata(taak, 'fout'));
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_GELIJKTIJDIG, Math.max(1, taken.length)) }, werker));

  return uit;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Token

// Het token bindt aan: gebruiker, project en de hash van het GEVALIDEERDE voorstel (zonder acties: die worden in deze fase niet gegenereerd).
export function tokenInhoud(voorstel: ContractVoorstel): unknown {
  return { versie: voorstel.versie, projectId: voorstel.projectId, regels: voorstel.regels.map((r) => ({ sleutel: r.sleutel, type: r.type, id: r.id, bedrag: r.bedrag, selecteerbaar: r.selecteerbaar })) };
}

export async function valideerVoorstelToken(inv: {
  token: unknown;
  geheim: string | null | undefined;
  uid: string;
  projectId: string;
  voorstel: ContractVoorstel;
  nu: number; // seconden
}): Promise<{ ok: true; jti: string } | { ok: false; reden: TokenFout | 'geen-geheim' | 'fout' }> {
  if (typeof inv.geheim !== 'string' || inv.geheim.length < MIN_GEHEIM_LENGTE) return { ok: false, reden: 'geen-geheim' };

  try {
    const hash = await voorstelHash(tokenInhoud(inv.voorstel));
    const r = await controleerToken(inv.token, inv.geheim, { uid: inv.uid, pid: inv.projectId, hash, nu: inv.nu });

    return r.ok ? { ok: true, jti: r.claims.jti } : { ok: false, reden: r.reden };
  } catch {
    return { ok: false, reden: 'fout' };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Hoofdingang

export async function maakVoorstelPreview(inv: PreviewInvoer, deps: PreviewAfhankelijkheden): Promise<PreviewUitkomst> {
  try {
    if (!isObject(inv?.raw) || !UUID.test(String(inv.uid ?? '')) || !UUID.test(String(inv.projectId ?? '')) || !Array.isArray(inv.records)) {
      return mislukt('ongeldige-invoer');
    }

    const nu = (deps.datumNu ?? (() => new Date()))();
    const vandaag = datumUit(nu);

    // 2. entitlement
    const gefilterd = filterOpEntitlement(inv.raw, inv.records);

    // 3. contractvalidatie met server-bekende bronnen
    const bedragenToegestaan = inv.bedragenToegestaan !== false;
    const ctx = {
      projectId: inv.projectId,
      dekking: inv.dekking,
      bestaandeRegels: inv.bestaandeRegels ?? [],
      bedragenToegestaan,
      vandaag,
      bekendeBronnen: gefilterd.bekend,
      opgehaaldeBronnen: [],
      dekkingsdoel: inv.dekkingsdoel,
    };
    const gevalideerd = schaalEnControleer(gefilterd.raw, ctx);

    if (!gevalideerd.voorstel || !gevalideerd.ok) return mislukt('voorstel-ongeldig', gevalideerd.fouten.slice(0, 10));

    // Geen acties in deze fase: ze worden niet getoond, niet gehasht en niet bewaard.
    const voorstel: ContractVoorstel = { ...gevalideerd.voorstel, acties: [] };

    // 4. tweede grenzencontrole
    const grenzen = controleerGrenzen(voorstel, gefilterd.bekend, inv.dekking, bedragenToegestaan, inv.dekkingsdoel);

    if (grenzen.length) return mislukt('grenzen-geschonden', grenzen.slice(0, 10).map((code) => ({ pad: 'regels', code })));

    // 5. verificatie
    const taken: Taak[] = [];
    const verificaties: RegelVerificatie[] = [];

    for (const regel of voorstel.regels) {
      const record = regel.id ? gefilterd.records.get(regel.id) : undefined;

      if (!record) {
        // Kan niet voorkomen (het contract kent alleen server-bekende regels); mocht het toch: geen claim.
        verificaties.push({ sleutel: regel.sleutel, metadata: null, categorie: 'niet_uitgevoerd', reden: 'fout', eindgebruikerTekst: null });
        continue;
      }

      taken.push({ regel, record });
    }

    const resultaten = await verifieerAlle(taken, vandaag, deps);

    for (const regel of voorstel.regels) {
      const r = resultaten.get(regel.sleutel);

      if (r) verificaties.push(r);
    }

    // 6. token
    let token: string | null = null;
    let geldigTot: number | null = null;
    const geheim = inv.geheim;

    if (typeof geheim === 'string' && geheim.length >= MIN_GEHEIM_LENGTE) {
      try {
        const nuSec = Math.floor(nu.getTime() / 1000);

        token = await maakToken(
          { jti: (deps.uuid ?? (() => crypto.randomUUID()))(), uid: inv.uid, pid: inv.projectId, hash: await voorstelHash(tokenInhoud(voorstel)), nu: nuSec, geldigheidSeconden: STANDAARD_GELDIGHEID_SECONDEN },
          geheim,
        );
        geldigTot = nuSec + STANDAARD_GELDIGHEID_SECONDEN;
      } catch {
        token = null;
        geldigTot = null;
      }
    }

    return {
      ok: true,
      voorstel,
      waarschuwingen: gevalideerd.waarschuwingen.slice(0, 40),
      overgeslagen: gefilterd.overgeslagen,
      verificaties,
      totalen: berekenTotalen(voorstel, inv.dekking),
      token,
      tokenGeldigTotSeconden: geldigTot,
      actiesGegenereerd: false,
      opgeslagen: false,
    };
  } catch {
    return mislukt('onverwachte-fout');
  }
}
