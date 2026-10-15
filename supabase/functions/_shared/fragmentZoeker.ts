// Deterministische fragmentzoeker (Fase C): vindt op de OPGEHAALDE pagina zelf de plekken waar een deadline of bijdragegrens staat, zodat
// de server geen bewijs hoeft te geloven dat van buiten komt.
//
// STATUS: voorbereiding, door de preview-keten gebruikt. Geen netwerk, geen AI, geen schatting.
//
// Rol in de keten (GEEN tweede verificatielogica)
//   Deze module bepaalt alleen WELK citaat bij WELKE waarde hoort. Of dat citaat iets bewijst, beslissen uitsluitend de bestaande B1-regels
//   (verifySourceEvidence: financier eerst, exact één datum/bedrag in het citaat, context, geen voorbehoud, enzovoort) en de vergelijking met
//   de database (compareDatabaseAndWeb). De zoeker levert een CLAIM { waarde: wat de pagina zegt, fragment, db: wat de database zegt }:
//     * pagina zegt hetzelfde als de database      -> B1 bevestigt (confirmed)
//     * pagina zegt iets anders, citaat bewezen    -> B1 bevestigt de webwaarde en de vergelijking maakt er een conflict van
//     * onduidelijk (meerdere kandidaten, geen)    -> 'uncertain' met reden; nooit een gok
//
// Voorzichtigheidsregels
//   * Alleen datums met jaar tellen, en een afwijkende webdatum alleen als hij niet in het verleden ligt (een verouderde pagina met een oude
//     datum is geen conflict maar onzeker).
//   * Een afwijkende webwaarde telt alleen met een SPECIFIEKE context ("deadline", "uiterlijk", "maximaal", "minimaal", ...), niet met losse
//     woorden als "tot" of "bijdrage" die in elke zin kunnen staan.
//   * Staan er meerdere verschillende kandidaten op de pagina (bijvoorbeeld meerdere aanvraagrondes), dan is het resultaat onzeker.
//   * Het venster rond een waarde stopt bij de zinsgrens en bij de naastliggende datum of het naastliggende bedrag, zodat 'minimaal € 5.000
//     en maximaal € 25.000' twee losse, eenduidige citaten oplevert.
import {
  DEADLINE_CONTEXT, MAX_CONTEXT, MIN_CONTEXT, VOORBEHOUD, bevatEen, vindBedragen, vindBedragenMetPositie, vindDatums, vindDatumsMetPositie,
  type BronPagina, type ClaimsPerVeld, type VeldOordeel,
} from './sourceEvidence.ts';

export interface DbWaarden {
  deadline?: string | null; // YYYY-MM-DD
  bedrag_min?: number | null;
  bedrag_max?: number | null;
}

type ZoekVeld = 'deadline' | 'bedrag_min' | 'bedrag_max';

export interface FragmentZoekUitkomst {
  claims: ClaimsPerVeld;
  // Velden waarvoor de zoeker zelf een onzeker oordeel geeft (er is geen citaat om te laten toetsen)
  oordelen: Partial<Record<ZoekVeld, VeldOordeel>>;
}

export const MAX_TREFFERS = 300;
const MAX_LINKS = 120;
const MAX_RECHTS = 80;
const MAX_FRAGMENT_LENGTE = 300;
const MIN_FRAGMENT_LENGTE = 12;

// Specifieke contexten, bewust smaller dan de bevestigingslijsten van B1 (die staan alleen toe te bevestigen wat al gelijk is).
const DEADLINE_SPEC = ['deadline', 'uiterlijk', 'tot en met', 't/m', 'sluitingsdatum', 'sluiting', 'indienen', 'uiterste', 'closing date'];
const MAX_SPEC = ['maximaal', 'maximum', 'max.', 'max ', 'hoogstens', 'niet meer dan', 'ten hoogste'];
const MIN_SPEC = ['minimaal', 'minimum', 'min.', 'min ', 'ten minste', 'tenminste', 'niet minder dan', 'laagste'];

const ZINSEINDE_LINKS = /[.!?]\s+(?=[A-ZÀ-ÖØ-Þ("“'‘])/g;
const ZINSEINDE_RECHTS = /[.!?](?=\s+[A-ZÀ-ÖØ-Þ€("“'‘]|\s*$)/;

interface Treffer {
  begin: number;
  eind: number;
}

// Venster rond een treffer: tot de zinsgrens en tot de naastliggende treffer. -> null als het geen bruikbaar citaat wordt.
function venster(plat: string, t: Treffer, linksLimiet: number, rechtsLimiet: number): string | null {
  const l = Math.max(linksLimiet, t.begin - MAX_LINKS);
  const r = Math.min(rechtsLimiet, t.eind + MAX_RECHTS);
  let links = plat.slice(l, t.begin);
  let rechts = plat.slice(t.eind, r);

  let laatste = -1;

  for (const m of links.matchAll(ZINSEINDE_LINKS)) laatste = m.index! + m[0].length;

  if (laatste >= 0) links = links.slice(laatste);
  else if (l > linksLimiet && l > 0 && plat[l - 1] !== ' ') {
    const sp = links.indexOf(' ');

    links = sp >= 0 ? links.slice(sp + 1) : '';
  }

  const einde = ZINSEINDE_RECHTS.exec(rechts);

  if (einde) rechts = rechts.slice(0, einde.index + 1);
  else if (r < rechtsLimiet && r < plat.length && plat[r] !== ' ') {
    const sp = rechts.lastIndexOf(' ');

    rechts = sp >= 0 ? rechts.slice(0, sp) : '';
  }

  const fragment = (links + plat.slice(t.begin, t.eind) + rechts).replace(/\s+/g, ' ').trim();

  if (fragment.length < MIN_FRAGMENT_LENGTE || fragment.length > MAX_FRAGMENT_LENGTE) return null;

  return fragment;
}

function metBuren<T extends Treffer>(plat: string, lijst: T[]): Array<{ treffer: T; fragment: string | null }> {
  const gesorteerd = [...lijst].sort((a, b) => a.begin - b.begin);

  return gesorteerd.map((treffer, i) => ({
    treffer,
    fragment: venster(plat, treffer, i > 0 ? gesorteerd[i - 1].eind : 0, i < gesorteerd.length - 1 ? gesorteerd[i + 1].begin : plat.length),
  }));
}

const onzeker = (veld: ZoekVeld, reden: string): VeldOordeel => ({ veld, status: 'uncertain', reden });

function zoekDeadline(plat: string, db: string, vandaag: string): { claim?: ClaimsPerVeld['deadline']; oordeel?: VeldOordeel } {
  const datums = vindDatumsMetPositie(plat, plat.length, MAX_TREFFERS);
  const kandidaten: Array<{ iso: string; fragment: string }> = [];

  for (const { treffer, fragment } of metBuren(plat, datums)) {
    if (!fragment || !treffer.heeftJaar || !treffer.iso) continue;

    const inFragment = vindDatums(fragment);

    if (inFragment.length !== 1) continue;

    kandidaten.push({ iso: treffer.iso, fragment });
  }

  if (kandidaten.length === 0) return { oordeel: onzeker('deadline', 'geen_datum_op_pagina_gevonden') };

  // 1. De pagina noemt de datum uit de database: bij voorkeur in een citaat dat de B1-regels zullen bevestigen.
  const gelijk = kandidaten.filter((k) => k.iso === db);

  if (gelijk.length) {
    const beste = gelijk.find((k) => bevatEen(k.fragment, DEADLINE_CONTEXT) && !bevatEen(k.fragment, VOORBEHOUD)) ?? gelijk[0];

    return { claim: { waarde: db, fragment: beste.fragment, db } };
  }

  // 2. Een andere datum: alleen met een specifieke deadlinecontext, zonder voorbehoud, en niet in het verleden.
  const specifiek = kandidaten.filter((k) => bevatEen(k.fragment, DEADLINE_SPEC) && !bevatEen(k.fragment, VOORBEHOUD));

  if (specifiek.length === 0) return { oordeel: onzeker('deadline', 'geen_deadline_context_op_pagina') };

  const toekomstig = specifiek.filter((k) => k.iso >= vandaag);

  if (toekomstig.length === 0) return { oordeel: onzeker('deadline', 'web_datum_verstreken') };

  const uniek = [...new Set(toekomstig.map((k) => k.iso))];

  if (uniek.length > 1) return { oordeel: onzeker('deadline', 'meerdere_datumkandidaten') };

  return { claim: { waarde: uniek[0], fragment: toekomstig[0].fragment, db } };
}

function zoekBedrag(plat: string, veld: 'bedrag_min' | 'bedrag_max', db: number): { claim?: ClaimsPerVeld['bedrag_max']; oordeel?: VeldOordeel } {
  const bedragen = vindBedragenMetPositie(plat, plat.length, MAX_TREFFERS);
  const losContext = veld === 'bedrag_max' ? MAX_CONTEXT : MIN_CONTEXT;
  const spec = veld === 'bedrag_max' ? MAX_SPEC : MIN_SPEC;
  const kandidaten: Array<{ waarde: number; fragment: string }> = [];

  for (const { treffer, fragment } of metBuren(plat, bedragen)) {
    if (!fragment) continue;

    const inFragment = [...new Set(vindBedragen(fragment))];

    if (inFragment.length !== 1) continue;

    kandidaten.push({ waarde: treffer.waarde, fragment });
  }

  if (kandidaten.length === 0) return { oordeel: onzeker(veld, 'geen_bedrag_op_pagina_gevonden') };

  const gelijk = kandidaten.filter((k) => k.waarde === db);

  if (gelijk.length) {
    const beste = gelijk.find((k) => bevatEen(k.fragment, losContext) && !bevatEen(k.fragment, VOORBEHOUD)) ?? gelijk[0];

    return { claim: { waarde: db, fragment: beste.fragment, db } };
  }

  const specifiek = kandidaten.filter((k) => bevatEen(k.fragment, spec) && !bevatEen(k.fragment, VOORBEHOUD));

  if (specifiek.length === 0) return { oordeel: onzeker(veld, 'geen_bedragcontext_op_pagina') };

  const uniek = [...new Set(specifiek.map((k) => k.waarde))];

  if (uniek.length > 1) return { oordeel: onzeker(veld, 'meerdere_bedragkandidaten') };

  return { claim: { waarde: uniek[0], fragment: specifiek[0].fragment, db } };
}

// pagina: de opgehaalde en tot tekst omgezette pagina. db: de live waarden van het servergekende record (null/undefined = niet van toepassing:
// dan wordt er niets gezocht en blijft het veld 'not_checked'). vandaag: ISO-datum van de server.
export function zoekFragmenten(pagina: BronPagina, db: DbWaarden, vandaag: string): FragmentZoekUitkomst {
  const uit: FragmentZoekUitkomst = { claims: {}, oordelen: {} };
  const plat = pagina.plat;
  const wilDeadline = typeof db.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(db.deadline);
  const wilMin = typeof db.bedrag_min === 'number' && Number.isFinite(db.bedrag_min) && db.bedrag_min > 0;
  const wilMax = typeof db.bedrag_max === 'number' && Number.isFinite(db.bedrag_max) && db.bedrag_max > 0;

  if (!wilDeadline && !wilMin && !wilMax) return uit;

  // Posities gelden alleen als kleine letters de lengte niet veranderen; anders zoeken we niet (onzeker, nooit een gok).
  if (plat.toLowerCase().length !== plat.length) {
    if (wilDeadline) uit.oordelen.deadline = onzeker('deadline', 'positiebepaling_niet_mogelijk');
    if (wilMin) uit.oordelen.bedrag_min = onzeker('bedrag_min', 'positiebepaling_niet_mogelijk');
    if (wilMax) uit.oordelen.bedrag_max = onzeker('bedrag_max', 'positiebepaling_niet_mogelijk');

    return uit;
  }

  if (wilDeadline) {
    const r = zoekDeadline(plat, db.deadline as string, vandaag);

    if (r.claim) uit.claims.deadline = r.claim;
    else if (r.oordeel) uit.oordelen.deadline = r.oordeel;
  }

  for (const [veld, wil, waarde] of [['bedrag_min', wilMin, db.bedrag_min], ['bedrag_max', wilMax, db.bedrag_max]] as const) {
    if (!wil) continue;

    const r = zoekBedrag(plat, veld, waarde as number);

    if (r.claim) uit.claims[veld] = r.claim;
    else if (r.oordeel) uit.oordelen[veld] = r.oordeel;
  }

  return uit;
}
