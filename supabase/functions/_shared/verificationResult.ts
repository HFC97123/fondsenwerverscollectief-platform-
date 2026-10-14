// Samenstellen van het verificatieresultaat (Fase B1): één plek die fetch, tekstomzetting, bewijs en vergelijking koppelt.
//
// STATUS: voorbereiding, door niets geïmporteerd. Geen UI, geen opslag, geen route, geen prompt. Dit is de zuivere motor.
//
// Regels
//   1. ENTITLEMENT EERST. `toegang` komt uit de bestaande entitlementlaag (bepaalNiveau / onderdrukExclusief in de Edge Function);
//      deze module beslist dat nooit zelf. Alleen `toegang.zichtbaar === true` (strikt) laat iets gebeuren. Anders: geen fetch,
//      geen DNS, geen logregel met host, en een uitkomst zonder enige inhoud van de kandidaat. Een publiek vindbare pagina is
//      daarmee nooit automatisch zichtbaar.
//   2. GEEN TWEEDE STATUSLOGICA. De samenvattende status komt uitsluitend uit bepaalVerificatieStatus() via bouwMetadata() in
//      voorstelMetadata.ts. Deze module kent het woord "geverifieerd" alleen als uitkomst van die functie.
//   3. FAIL-SAFE. Elke fout (ook een onverwachte uitzondering) levert een uitkomst op, nooit een throw. Een fout leidt nooit tot
//      'confirmed' en alleen tot een generieke eindgebruikerstekst (geen beveiligingsdetails).
//   4. De uitkomst bevat het schema-geldige `verificatie`-blok voor funding.voorstel (versie 2). Dat blok wordt niet hier
//      opgeslagen; dat is werk voor een latere fase en uitsluitend voor de server.
import { extractReadableText } from './readableText.ts';
import { safeFetchPublicPage, type FetchFout, type SafeFetchOpties } from './safeFetch.ts';
import {
  compareDatabaseAndWeb, maakBronPagina, verifySourceEvidence,
  type ClaimsPerVeld, type FinancierIdentiteit, type NaamOordeel, type VeldVergelijking,
} from './sourceEvidence.ts';
import { bouwMetadata, controleerMetadata, type VeldBewijs, type VeldNaam, type Verificatie, type VerificatieStatus } from './voorstelMetadata.ts';

export const GEEN_BRONCONTROLE_TEKST = 'Bron kon niet automatisch worden gecontroleerd.';
export const ONZEKER_TEKST = 'De bron kon niet volledig worden bevestigd. Controleer de actuele gegevens bij de financier.';
export const CONFLICT_TEKST = 'De informatie op de website van de financier wijkt af van onze database. Controleer de actuele gegevens bij de financier.';

export type VerificatieCategorie = 'ok' | FetchFout | 'niet_zichtbaar' | 'financier_not_found' | 'onverwachte_fout';

export interface ToegangsBesluit {
  // true ALLEEN als de bestaande entitlementlaag deze kandidaat voor deze gebruiker zichtbaar vindt.
  zichtbaar: boolean;
}

export interface VerificatieInvoer {
  toegang: ToegangsBesluit;
  verificatieId?: string;
  bronUrl: string;
  financier: FinancierIdentiteit;
  claims: ClaimsPerVeld;
  // Live databasewaarde van de naam wordt niet vergeleken; die is de zoekterm.
}

export interface VerificatieAfhankelijkheden extends SafeFetchOpties {
  nu?: () => number;
  datumNu?: () => Date;
}

export interface VerificatieUitkomst {
  uitgevoerd: boolean;
  verificatieId: string;
  categorie: VerificatieCategorie;
  samenvatting: VerificatieStatus | null;
  // Schema-geldig blok (metadata v2). null als er niets te bewaren valt (niet uitgevoerd).
  verificatie: Verificatie | null;
  // Per veld de details (intern: bevat redenen). Leeg als niet uitgevoerd of niet opgehaald.
  velden: VeldVergelijking[];
  // Generieke tekst voor de eindgebruiker; null bij een volledige bevestiging of als er niets getoond mag worden.
  eindgebruikerTekst: string | null;
  // Privacy- en securitybewuste logregel (zonder pad, query, HTML, tokens of projectinhoud).
  logRegel: string;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Logging

const veiligId = (s: string) => String(s ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36) || 'onbekend';
const veiligeHost = (s: string | null) => (s ? String(s).toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 100) : '-');
const geheel = (n: unknown) => (Number.isFinite(Number(n)) ? Math.max(0, Math.round(Number(n))) : 0);

export function bouwLogRegel(g: {
  verificatieId: string;
  hostnaam: string | null;
  categorie: string;
  status: string | null;
  httpStatus: number | null;
  redirects: number;
  duurMs: number;
}): string {
  return (
    `[subsidie-kompas] verificatie id=${veiligId(g.verificatieId)} host=${veiligeHost(g.hostnaam)} resultaat=${String(g.categorie).replace(/[^a-z_]/g, '').slice(0, 40)}` +
    ` status=${String(g.status ?? '-').replace(/[^a-z_-]/g, '').slice(0, 24)} http=${g.httpStatus === null ? '-' : geheel(g.httpStatus)} redirects=${geheel(g.redirects)} ms=${geheel(g.duurMs)}`
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// Resultaat samenstellen

function naarVeldBewijs(v: VeldVergelijking): VeldBewijs {
  return {
    status: v.status,
    ...(v.waarde !== undefined ? { waarde: v.waarde.slice(0, 200) } : {}),
    ...(v.fragment !== undefined ? { fragment: v.fragment.slice(0, 300) } : {}),
    ...(v.fragment_sha256 !== undefined ? { fragment_sha256: v.fragment_sha256 } : {}),
    ...(v.status === 'conflict' && v.db_waarde !== undefined ? { db_waarde: v.db_waarde.slice(0, 200) } : {}),
  };
}

// Bouwt het verificatieblok via de CENTRALE statusfunctie. Valt het resultaat niet binnen het schema (bijvoorbeeld een conflict
// zonder bewijs), dan worden de conflictvelden onzeker; lukt het dan nog niet, dan is het resultaat 'niet_gecontroleerd'.
function bouwBlok(
  vandaag: string,
  bewijs: { gecontroleerd_op: string; bron_url: string; eind_url: string; pagina_sha256: string },
  velden: VeldVergelijking[],
): Verificatie {
  const toVelden = (lijst: VeldVergelijking[]) => {
    const uit: Partial<Record<VeldNaam, VeldBewijs>> = {};

    for (const v of lijst) {
      if (v.status === 'not_checked') continue; // ontbrekende velden gelden als niet gecontroleerd

      uit[v.veld] = naarVeldBewijs(v);
    }

    return uit;
  };

  const probeer = (lijst: VeldVergelijking[]) =>
    bouwMetadata({ herkomst: 'online', vandaag, verificatie: { ...bewijs, velden: toVelden(lijst) } });

  const eerste = probeer(velden);

  if (eerste?.verificatie) return eerste.verificatie;

  const zonderConflict = velden.map((v) => (v.status === 'conflict' ? { ...v, status: 'uncertain' as const, db_waarde: undefined } : v));
  const tweede = probeer(zonderConflict);

  if (tweede?.verificatie) return tweede.verificatie;

  return { status: 'niet_gecontroleerd' };
}

function eindTekst(status: VerificatieStatus | null, categorie: VerificatieCategorie): string | null {
  if (categorie === 'niet_zichtbaar') return null;
  if (status === 'geverifieerd') return null;
  if (status === 'conflict') return CONFLICT_TEKST;
  if (status === 'gedeeltelijk' || status === 'onzeker') return ONZEKER_TEKST;

  return GEEN_BRONCONTROLE_TEKST;
}

export interface UitkomstBouwInvoer {
  verificatieId: string;
  nu: Date;
  duurMs: number;
  bron: { bronUrl: string; eindUrl: string; hostnaam: string | null; httpStatus: number | null; redirects: number };
  fetchFout: FetchFout | null;
  paginaSha256: string | null;
  financier: NaamOordeel | null;
  vergelijkingen: VeldVergelijking[];
}

// buildVerificationResult: zet de losse onderdelen om in één uitkomst. Zuiver en synchroon; kan niet gooien op onverwachte invoer.
export function buildVerificationResult(inv: UitkomstBouwInvoer): VerificatieUitkomst {
  const vandaag = inv.nu.toISOString().slice(0, 10);
  let categorie: VerificatieCategorie = 'ok';
  let verificatie: Verificatie;

  if (inv.fetchFout || !inv.paginaSha256) {
    categorie = inv.fetchFout ?? 'fetch_failed';
    verificatie = { status: 'niet_gecontroleerd' };
  } else {
    verificatie = bouwBlok(
      vandaag,
      { gecontroleerd_op: inv.nu.toISOString(), bron_url: inv.bron.bronUrl, eind_url: inv.bron.eindUrl, pagina_sha256: inv.paginaSha256 },
      inv.vergelijkingen,
    );

    if (inv.financier && !inv.financier.gevonden) categorie = 'financier_not_found';
  }

  // Laatste vangnet: het blok moet binnen het databaseschema vallen.
  const geldig = controleerMetadata({ versie: 2, server_generated: true, herkomst: 'online', voorgesteld_op: vandaag, verificatie });

  if (!geldig.geldig) {
    verificatie = { status: 'niet_gecontroleerd' };
    categorie = 'onverwachte_fout';
  }

  return {
    uitgevoerd: true,
    verificatieId: inv.verificatieId,
    categorie,
    samenvatting: verificatie.status,
    verificatie,
    velden: inv.vergelijkingen,
    eindgebruikerTekst: eindTekst(verificatie.status, categorie),
    logRegel: bouwLogRegel({
      verificatieId: inv.verificatieId,
      hostnaam: inv.bron.hostnaam,
      categorie,
      status: verificatie.status,
      httpStatus: inv.bron.httpStatus,
      redirects: inv.bron.redirects,
      duurMs: inv.duurMs,
    }),
  };
}

// verifieerBron: de volledige keten, in vaste volgorde:
//   toegang -> ophalen -> tekst -> bewijs -> vergelijken -> resultaat
// Zonder toegang gebeurt er NIETS: geen DNS, geen fetch, geen inhoud in de uitkomst.
export async function verifieerBron(inv: VerificatieInvoer, deps: VerificatieAfhankelijkheden): Promise<VerificatieUitkomst> {
  const id = veiligId(inv?.verificatieId ?? crypto.randomUUID());

  if (!inv || !inv.toegang || inv.toegang.zichtbaar !== true) {
    return {
      uitgevoerd: false,
      verificatieId: id,
      categorie: 'niet_zichtbaar',
      samenvatting: null,
      verificatie: null,
      velden: [],
      eindgebruikerTekst: null,
      logRegel: bouwLogRegel({ verificatieId: id, hostnaam: null, categorie: 'niet_zichtbaar', status: null, httpStatus: null, redirects: 0, duurMs: 0 }),
    };
  }

  const nu = deps.datumNu ?? (() => new Date());
  const klokMs = deps.nu ?? (() => Date.now());
  const start = klokMs();

  try {
    const opgehaald = await safeFetchPublicPage(inv.bronUrl, deps);

    if (!opgehaald.ok) {
      return buildVerificationResult({
        verificatieId: id,
        nu: nu(),
        duurMs: opgehaald.duurMs,
        bron: { bronUrl: '', eindUrl: '', hostnaam: opgehaald.hostnaam, httpStatus: opgehaald.httpStatus, redirects: opgehaald.redirects },
        fetchFout: opgehaald.fout,
        paginaSha256: null,
        financier: null,
        vergelijkingen: [],
      });
    }

    const leesbaar = extractReadableText(opgehaald.tekst, opgehaald.contentType);
    const pagina = await maakBronPagina(opgehaald, leesbaar.text);
    const bewijs = await verifySourceEvidence(pagina, inv.financier, inv.claims ?? {});
    const vergelijkingen: VeldVergelijking[] = [];

    for (const veld of Object.keys(bewijs.velden) as VeldNaam[]) {
      const oordeel = bewijs.velden[veld]!;
      const db = veld === 'fondsnaam' ? undefined : (inv.claims as Record<string, { db?: unknown }>)[veld]?.db;

      vergelijkingen.push(compareDatabaseAndWeb(veld, db, oordeel));
    }

    return buildVerificationResult({
      verificatieId: id,
      nu: nu(),
      duurMs: Math.max(opgehaald.duurMs, klokMs() - start),
      bron: { bronUrl: opgehaald.bronUrl, eindUrl: opgehaald.eindUrl, hostnaam: opgehaald.hostnaam, httpStatus: opgehaald.httpStatus, redirects: opgehaald.redirects },
      fetchFout: null,
      paginaSha256: pagina.paginaSha256,
      financier: bewijs.financier,
      vergelijkingen,
    });
  } catch {
    // Nooit een throw naar de aanroeper: een mislukte verificatie mag de chat of Projectfinanciering niet breken.
    return {
      uitgevoerd: true,
      verificatieId: id,
      categorie: 'onverwachte_fout',
      samenvatting: 'niet_gecontroleerd',
      verificatie: { status: 'niet_gecontroleerd' },
      velden: [],
      eindgebruikerTekst: GEEN_BRONCONTROLE_TEKST,
      logRegel: bouwLogRegel({ verificatieId: id, hostnaam: null, categorie: 'onverwachte_fout', status: 'niet_gecontroleerd', httpStatus: null, redirects: 0, duurMs: klokMs() - start }),
    };
  }
}
