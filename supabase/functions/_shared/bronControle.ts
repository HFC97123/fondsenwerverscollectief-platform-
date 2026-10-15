// Bronstatus van een financieringsmogelijkheid in een project: wat de SERVER heeft vastgesteld over de controle van de bron.
//
// Waarom een eigen, door de server bijgehouden status (en geen voortgang in de browser of een token in de browser):
//   - De controle blijft bestaan na verversen, na sluiten van het scherm en na opslaan.
//   - De server kan bij opslaan zelf vaststellen: welke controle bij welke financieringsmogelijkheid hoort (project + type + id), wanneer die
//     is uitgevoerd (servertijd) en wat de uitkomst was. De browser kan dit niet invullen of vervalsen.
//   - De status staat los van de financieringsstatus (Interessant, Voorbereiden, ...). "Gecontroleerd" zegt alleen dat de bron is gecontroleerd,
//     nooit dat er financiering is toegekend of dat het lid in aanmerking komt.
//
// Dit bestand is zuiver (geen netwerk, geen database). De schrijver is de Edge Function (mode 'voorstel-controleer'); lezen kan het lid zelf
// (RLS, alleen eigen rijen). Tabel: subsidie_kompas_bron_controles (migratie 20261015120000_bron_controles.sql).
import type { RegelVerificatie, ServerRecord } from './voorstelVerificatie.ts';

// Wat de gebruiker te zien krijgt. 'verouderd' = er is wel eens gecontroleerd, maar de gegevens zijn sindsdien veranderd of de controle is te oud;
// de interface toont dat als "Niet gecontroleerd". Geen rij = nooit gecontroleerd.
export const BRON_STATUSSEN = ['gecontroleerd', 'onzeker', 'mislukt', 'verouderd'] as const;
export type BronStatus = (typeof BRON_STATUSSEN)[number];

// Een controle ouder dan dit telt niet meer als actueel (deadlines en voorwaarden veranderen). Bewust een vaste, zichtbare waarde.
export const BRON_MAX_LEEFTIJD_DAGEN = 14;

export interface BronUitkomst {
  status: Exclude<BronStatus, 'verouderd'>;
  // Samenvattende B1-status (geverifieerd, gedeeltelijk, onzeker, conflict, niet_gecontroleerd) of null als er niets is gecontroleerd.
  verificatieStatus: string | null;
  // Alleen als de controle niet kon draaien of mislukte: geen_bron_url, geen_toegang_tot_details, limiet, budget, fout, ophalen_mislukt.
  reden: string | null;
}

// De ENIGE vertaling van een uitkomst van de verificatiemotor naar de bronstatus. 'gecontroleerd' alleen als de motor de bron echt heeft
// opgehaald en de samenvattende status 'geverifieerd' is (naam en deadline met citaat bevestigd, niets onzeker, geen conflict).
export function bronUitkomstVan(v: RegelVerificatie): BronUitkomst {
  const verificatieStatus = (v.metadata && (v.metadata as { verificatie?: { status?: string } }).verificatie?.status) || null;

  if (v.reden === 'geen_bron_url' || v.reden === 'geen_toegang_tot_details') {
    return { status: 'onzeker', verificatieStatus: null, reden: v.reden };
  }

  if (v.reden === 'fout' || v.reden === 'limiet' || v.reden === 'budget' || v.categorie === 'niet_uitgevoerd') {
    return { status: 'mislukt', verificatieStatus: null, reden: v.reden ?? 'fout' };
  }

  // Pagina niet te lezen (netwerk, geblokkeerd, te groot, ...): de controle is niet gelukt, dat kan een volgende keer wel.
  if (v.categorie !== 'ok' && v.categorie !== 'financier_not_found') {
    return { status: 'mislukt', verificatieStatus: null, reden: 'ophalen_mislukt' };
  }

  if (v.categorie === 'ok' && verificatieStatus === 'geverifieerd') {
    return { status: 'gecontroleerd', verificatieStatus, reden: null };
  }

  return { status: 'onzeker', verificatieStatus, reden: null };
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Vingerafdruk van de gegevens waartegen is gecontroleerd. Verandert de bron-URL, deadline, naam of bijdragegrens in onze database, dan hoort
// de oude controle niet meer bij het huidige record.
export async function recordVersie(r: Pick<ServerRecord, 'type' | 'id' | 'naam' | 'website' | 'deadline' | 'min' | 'max'>): Promise<string> {
  const basis = JSON.stringify([r.type, String(r.id).toLowerCase(), r.naam ?? '', r.website ?? '', r.deadline ?? '', r.min ?? null, r.max ?? null]);

  return hex(await crypto.subtle.digest('SHA-256', enc.encode(basis)));
}

export interface BronRij {
  record_type: 'regeling' | 'fonds';
  record_id: string;
  status: BronStatus;
  verificatie_status: string | null;
  reden: string | null;
  record_versie: string;
  gecontroleerd_op: string; // ISO
}

// Wat bij opslaan geldt voor één regel: de rij uit de database, getoetst aan het HUIDIGE record en de huidige tijd.
//  - geen rij                    -> 'niet-gecontroleerd'
//  - rij, maar andere recordversie of te oud -> 'verouderd' (en dus niet gecontroleerd)
//  - anders de status van de rij.
export type BronOordeel = BronStatus | 'niet-gecontroleerd';

export function beoordeelBronRij(rij: BronRij | null | undefined, huidigeVersie: string, nu: Date): { status: BronOordeel; gecontroleerdOp: string | null; reden: string | null } {
  if (!rij) return { status: 'niet-gecontroleerd', gecontroleerdOp: null, reden: null };

  const tijd = Date.parse(rij.gecontroleerd_op);
  const leeftijdDagen = Number.isFinite(tijd) ? (nu.getTime() - tijd) / 86_400_000 : Infinity;

  if (rij.record_versie !== huidigeVersie || leeftijdDagen > BRON_MAX_LEEFTIJD_DAGEN || leeftijdDagen < -0.01) {
    return { status: 'verouderd', gecontroleerdOp: rij.gecontroleerd_op, reden: null };
  }

  return { status: rij.status, gecontroleerdOp: rij.gecontroleerd_op, reden: rij.reden };
}

// Korte, eerlijke zin voor in taken en meldingen. Nooit een claim over toekenning of geschiktheid.
export function bronOordeelTekst(o: BronOordeel): string {
  switch (o) {
    case 'gecontroleerd':
      return 'Bron gecontroleerd (naam en deadline kwamen overeen met de website van de financier).';
    case 'onzeker':
      return 'Bron niet volledig bevestigd: controleer deadline en voorwaarden zelf bij de financier.';
    case 'mislukt':
      return 'De bron kon niet worden gecontroleerd: controleer deadline en voorwaarden zelf bij de financier.';
    case 'verouderd':
      return 'De bron is eerder gecontroleerd, maar de gegevens zijn sindsdien veranderd of de controle is te oud: controleer opnieuw.';
    default:
      return 'Bron nog niet gecontroleerd: controleer deadline en voorwaarden zelf bij de financier.';
  }
}

// Heel korte vorm voor in de lijst "nog niet vastgesteld" bij een taak.
export function bronOordeelKort(o: BronOordeel): string {
  switch (o) {
    case 'gecontroleerd':
      return 'de bron is gecontroleerd';
    case 'onzeker':
      return 'de bron is niet volledig bevestigd';
    case 'mislukt':
      return 'de broncontrole is mislukt';
    case 'verouderd':
      return 'de broncontrole is verouderd';
    default:
      return 'de bron is nog niet gecontroleerd';
  }
}

// Tekst voor het gesprek ("Bespreek met Subsidiekompas" vanuit één regel): wat de SERVER weet over de bron van die regel. Nooit een oordeel over
// toekenning of geschiktheid. `rij`: de vastgelegde controle van dit record (of null); `isDatabase`: staat de financier in onze database?
export function focusBronTekst(rij: Pick<BronRij, 'status' | 'gecontroleerd_op' | 'reden'> | null | undefined, isDatabase: boolean, nu: Date): string {
  const uitleg = 'Bronstatus is iets anders dan de financieringsstatus: "gecontroleerd" betekent alleen dat naam en deadline op de website van de financier zijn teruggevonden. Zeg nooit dat het lid in aanmerking komt of dat toekenning waarschijnlijk is.';

  if (!isDatabase) {
    return `BRONSTATUS: deze financier staat niet in onze database (online gevonden of door het lid zelf toegevoegd). Subsidiekompas heeft de gegevens niet gecontroleerd; zeg dat expliciet en verwijs naar de website van de financier. ${uitleg}`;
  }

  if (!rij) return `BRONSTATUS: de bron van deze regel is nog niet gecontroleerd. ${uitleg}`;

  const tijd = Date.parse(rij.gecontroleerd_op);
  const dagen = Number.isFinite(tijd) ? (nu.getTime() - tijd) / 86_400_000 : Infinity;
  const datum = Number.isFinite(tijd) ? new Date(tijd).toISOString().slice(0, 10) : 'onbekend';

  if (rij.status === 'verouderd' || dagen > BRON_MAX_LEEFTIJD_DAGEN) return `BRONSTATUS: de bron is eerder gecontroleerd (${datum}), maar de controle is verouderd; behandel de gegevens als niet gecontroleerd. ${uitleg}`;

  const tekst: Record<string, string> = {
    gecontroleerd: `de bron is gecontroleerd op ${datum}`,
    onzeker: `de bron kon op ${datum} niet volledig worden bevestigd; deadline en voorwaarden zijn onzeker`,
    mislukt: `de broncontrole van ${datum} is mislukt; de gegevens zijn niet gecontroleerd`,
  };

  return `BRONSTATUS: ${tekst[rij.status] ?? 'de bron is niet gecontroleerd'}. ${uitleg}`;
}
