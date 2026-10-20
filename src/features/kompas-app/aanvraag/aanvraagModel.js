// Aanvraag-assistent: zuivere hulpfuncties voor de schermen (geen React, geen netwerk, geen opslag). De server bepaalt uitkomsten, limieten en
// zekerheid; hier staat alleen hoe de antwoorden worden getoond en hoe het lid de criteria aanpast.

// Zelfde adres als contact.email in de websiteconfiguratie (data/collections.js).
export const CONTACT_EMAIL = 'info@fondsenwerverscollectief.nl';
export const MIN_AANVRAAG_TEKENS = 200;
export const MAX_PAGINAS = 2;
export const MAX_EIS_TEKENS = 300;

const schoonTekst = (t) => String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

// ───────────── Labels ─────────────

export const SOORT_LABEL = { verplicht: 'Verplicht', criterium: 'Criterium', vorm: 'Vorm', voorwaarde: 'Voorwaarde' };
export const SOORT_TOON = { verplicht: 'oranje', criterium: 'blauw', vorm: 'blauw', voorwaarde: 'blauw' };
export const ZEKERHEID_LABEL = { hoog: 'hoog', middel: 'middel', laag: 'laag' };
export const ZEKERHEID_TOON = { hoog: 'groen', middel: 'oranje', laag: 'grijs' };
export const STATUS_LABEL = { gedekt: 'Gedekt', deels: 'Deels', ontbreekt: 'Ontbreekt', 'niet-beoordeeld': 'Niet beoordeeld' };
export const STATUS_TOON = { gedekt: 'groen', deels: 'oranje', ontbreekt: 'rood', 'niet-beoordeeld': 'grijs' };
export const UITKOMST_LABEL = {
  'klaar-om-in-te-dienen': 'Klaar om in te dienen',
  'eerst-aanvullen': 'Eerst aanvullen',
  'niet-te-beoordelen': 'Niet te beoordelen',
};
export const UITKOMST_TOON = { 'klaar-om-in-te-dienen': 'groen', 'eerst-aanvullen': 'oranje', 'niet-te-beoordelen': 'grijs' };
export const SOORTEN_KEUZE = [
  ['criterium', 'Criterium'],
  ['verplicht', 'Verplicht'],
  ['voorwaarde', 'Voorwaarde'],
  ['vorm', 'Vorm'],
];

export const soortLabel = (s) => SOORT_LABEL[s] || 'Criterium';
export const statusLabel = (s) => STATUS_LABEL[s] || STATUS_LABEL['niet-beoordeeld'];
export const statusToon = (s) => STATUS_TOON[s] || 'grijs';
export const uitkomstLabel = (u) => UITKOMST_LABEL[u] || '';
export const uitkomstToon = (u) => UITKOMST_TOON[u] || 'grijs';

// Waar staat dit criterium? "Uw formulier" gaat voor "Website".
export function bronLabel(eis) {
  const type = eis && eis.bronType;

  return type === 'lid' ? 'Uw formulier' : type === 'website' ? 'Website' : type === 'database' ? 'Fondsgegevens' : 'Onbekend';
}

export function zekerheidTekst(z) {
  return z === 'hoog' ? 'Staat in uw eigen formulier of met een duidelijk woord als "moet".' : z === 'middel' ? 'Staat op de website met een duidelijk woord als "moet" of "verplicht".' : 'Lijkt een wens. Controleer dit criterium even.';
}

// ───────────── Maandruimte ─────────────

// status = antwoord van mode 'status'. Onbekend gebruik (null) blijft onbekend; er wordt nooit iets verzonnen.
export function ruimteRegels(status) {
  const s = status && typeof status === 'object' ? status : {};
  const regel = (label, blok) => {
    const limiet = blok && Number.isFinite(blok.limiet) ? blok.limiet : null;
    const gebruikt = blok && Number.isFinite(blok.gebruikt) ? blok.gebruikt : null;

    return { label, limiet, gebruikt, tekst: limiet === null ? '' : gebruikt === null ? `onbekend van ${limiet}` : `${Math.min(gebruikt, limiet)} van ${limiet}`, aandeel: limiet && gebruikt !== null ? Math.max(0, Math.min(1, gebruikt / limiet)) : 0 };
  };

  return [regel('Beoordelingen', s.beoordelingen), regel('Projectplannen', s.plannen)];
}

export const heeftBeoordelingRuimte = (status) => Boolean(status && status.beoordelingen && status.beoordelingen.resterend !== 0);
export const heeftPlanRuimte = (status) => Boolean(status && status.plannen && status.plannen.resterend !== 0);

// ───────────── Adressen en tekst ─────────────

// Een webadres uit een tekstvak: zonder http(s) vullen we https:// aan. Geen geldig adres = null (de server controleert daarna nog veiliger).
export function normaliseerUrl(invoer) {
  let t = String(invoer == null ? '' : invoer).trim();

  if (!t || t.length > 500 || /\s/.test(t)) return null;
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;

  try {
    const u = new URL(t);

    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') ? u.toString() : null;
  } catch (e) {
    return null;
  }
}

// Geldige, unieke adressen uit de invoervelden; de rest valt weg (en wordt apart geteld voor een eerlijke melding).
export function schoneUrls(velden) {
  const uit = [];
  let ongeldig = 0;

  for (const v of Array.isArray(velden) ? velden : []) {
    if (!String(v || '').trim()) continue;

    const u = normaliseerUrl(v);

    if (!u) ongeldig += 1;
    else if (!uit.includes(u) && uit.length < MAX_PAGINAS) uit.push(u);
  }

  return { urls: uit, ongeldig };
}

// Tekens zoals de server ze telt (witruimte samengevoegd).
export const tekenTelling = (t) => schoonTekst(t).length;

export function aanvraagTekstStatus(tekst, max) {
  const n = tekenTelling(tekst);

  if (n === 0) return { ok: false, n, reden: 'leeg' };
  if (n < MIN_AANVRAAG_TEKENS) return { ok: false, n, reden: 'te-kort' };
  if (Number.isFinite(max) && n > max) return { ok: false, n, reden: 'te-lang' };

  return { ok: true, n, reden: null };
}

export const tekenTekst = (n, max) => `${Number(n).toLocaleString('nl-NL')}${Number.isFinite(max) ? ` van ${Number(max).toLocaleString('nl-NL')}` : ''} tekens`;

// Eén klik: een e-mail aan het Fondsenwervers Collectief over een privaatfonds of familiefonds. Alleen de fondsnaam gaat mee, nooit gegevens van het project.
export function mailNaarCollectief(fondsLabel = '') {
  const fonds = schoonTekst(fondsLabel).slice(0, 120);
  const onderwerp = fonds ? `Informatie over een privaatfonds of familiefonds: ${fonds}` : 'Informatie over een privaatfonds of familiefonds';
  const body = ['Beste Fondsenwervers Collectief,', '', fonds ? `Ik zoek informatie over dit fonds: ${fonds}.` : 'Ik zoek informatie over een fonds.', 'Het is een privaatfonds of familiefonds en ik vind er weinig over. Kunt u mij helpen aan de doelen, de voorwaarden en de manier van aanvragen?', '', 'Met vriendelijke groet,'].join('\n');

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(body)}`;
}

// ───────────── Criteria aanpassen ─────────────

let teller = 0;

export function nieuweEis(tekst, soort = 'criterium') {
  const t = schoonTekst(tekst).slice(0, MAX_EIS_TEKENS);

  if (!t) return null;

  teller += 1;

  return { id: `nieuw-${teller}`, tekst: t, soort: SOORT_LABEL[soort] ? soort : 'criterium', gewicht: soort === 'verplicht' ? 3 : 2, bronType: 'lid', bronStuk: t, zekerheid: 'hoog' };
}

export function voegEisToe(lijst, eis) {
  const l = Array.isArray(lijst) ? lijst : [];

  if (!eis) return l;

  const sleutel = (x) => schoonTekst(x.tekst).toLowerCase();

  return l.some((x) => sleutel(x) === sleutel(eis)) ? l : [...l, eis];
}

// patch: { tekst?, soort?, gewicht? }. Een lege of te lange tekst wordt niet doorgevoerd.
export function wijzigEis(lijst, id, patch) {
  return (Array.isArray(lijst) ? lijst : []).map((e) => {
    if (e.id !== id) return e;

    const uit = { ...e };

    if (patch && patch.tekst !== undefined) {
      const t = schoonTekst(patch.tekst).slice(0, MAX_EIS_TEKENS);

      if (t) uit.tekst = t;
    }

    if (patch && SOORT_LABEL[patch.soort]) uit.soort = patch.soort;
    if (patch && [1, 2, 3].includes(Number(patch.gewicht))) uit.gewicht = Number(patch.gewicht);

    return uit;
  });
}

export const verwijderEis = (lijst, id) => (Array.isArray(lijst) ? lijst : []).filter((e) => e.id !== id);

export function criteriaGewijzigd(a, b) {
  const sleutel = (l) => JSON.stringify((Array.isArray(l) ? l : []).map((e) => [e.tekst, e.soort, e.gewicht]));

  return sleutel(a) !== sleutel(b);
}

// ───────────── Aanvragen in het overzicht ─────────────

// De labels bij een aanvraag in de lijst. Alleen wat echt bekend is.
export function aanvraagBadges(a) {
  const uit = [];

  if (a && a.aantalCriteria > 0) uit.push({ tekst: 'Criteria klaar', toon: 'groen' });
  else uit.push({ tekst: 'Nog geen criteria', toon: 'grijs' });

  uit.push(a && a.heeftPlan ? { tekst: 'Versie in concept', toon: 'blauw' } : { tekst: 'Nog niets geschreven', toon: 'grijs' });

  if (a && UITKOMST_LABEL[a.laatsteUitkomst]) uit.push({ tekst: `Beoordeeld: ${UITKOMST_LABEL[a.laatsteUitkomst].toLowerCase()}`, toon: uitkomstToon(a.laatsteUitkomst) });

  return uit;
}

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export function datumTekst(iso) {
  const d = new Date(iso);

  return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MAANDEN[d.getUTCMonth()]}` : '';
}

export function splitsAanvragen(lijst) {
  const l = Array.isArray(lijst) ? lijst : [];

  return {
    algemeen: l.find((a) => a.soort === 'algemeen') || null,
    fondsen: l.filter((a) => a.soort === 'fonds').sort((x, y) => String(y.bijgewerkt || '').localeCompare(String(x.bijgewerkt || ''))),
  };
}

// ───────────── Plan ─────────────

export function planSamenvatting(plan) {
  const st = (plan && plan.statistiek) || {};
  const delen = [];

  if (st.geschreven) delen.push(`${st.geschreven} ${st.geschreven === 1 ? 'onderdeel' : 'onderdelen'} geschreven`);
  if (st.aanvullen) delen.push(`${st.aanvullen} om aan te vullen`);
  if (st.mislukt) delen.push(`${st.mislukt} niet gelukt`);

  return delen.join(', ');
}

// Tekst van het plan zoals het naar Word of PDF gaat: kopjes en alinea's, [aanvullen]-markeringen blijven zichtbaar zodat niets stilzwijgend ontbreekt.
export function planNaarTekst(plan, titel = 'Projectplan') {
  const secties = plan && Array.isArray(plan.secties) ? plan.secties : [];
  const delen = [`# ${schoonTekst(titel) || 'Projectplan'}`];

  for (const s of secties) {
    delen.push(`## ${schoonTekst(s.titel)}`);
    delen.push(s.status === 'mislukt' || !String(s.tekst || '').trim() ? `[aanvullen: ${schoonTekst(s.vraag) || 'dit onderdeel'}]` : String(s.tekst).trim());
  }

  return delen.join('\n\n');
}

// Is er in dit plan nog iets in te vullen?
export const aantalAanvullenInPlan = (plan) => (plan && Array.isArray(plan.secties) ? plan.secties.reduce((n, s) => n + (Number(s.aantalAanvullen) || (s.status === 'mislukt' ? 1 : 0)), 0) : 0);

// Splitst een tekst in gewone stukken en [aanvullen: ...]-markeringen, zodat de markeringen opvallend kunnen worden getoond.
export function splitsAanvullen(tekst) {
  const stukken = [];
  const re = /\[aanvullen:[^\]]*\]/gi;
  const t = String(tekst == null ? '' : tekst);
  let laatste = 0;
  let m;

  while ((m = re.exec(t))) {
    if (m.index > laatste) stukken.push({ aanvullen: false, tekst: t.slice(laatste, m.index) });

    stukken.push({ aanvullen: true, tekst: m[0] });
    laatste = m.index + m[0].length;
  }

  if (laatste < t.length) stukken.push({ aanvullen: false, tekst: t.slice(laatste) });

  return stukken;
}

// ───────────── Beoordeling ─────────────

// Koppelt elk criterium aan zijn oordeel; criteria zonder oordeel tellen als "niet beoordeeld".
export function koppelOordelen(eisen, resultaten) {
  const per = new Map((Array.isArray(resultaten) ? resultaten : []).map((r) => [r.eisId, r]));

  return (Array.isArray(eisen) ? eisen : []).map((eis) => {
    const r = per.get(eis.id) || {};

    return { eis, status: r.status || 'niet-beoordeeld', citaatAanvraag: r.citaatAanvraag || '', bronStuk: r.bronStuk || eis.bronStuk || '', verbetering: r.verbetering || '' };
  });
}

export function telStatussen(gekoppeld) {
  const uit = { gedekt: 0, deels: 0, ontbreekt: 0, 'niet-beoordeeld': 0 };

  for (const g of Array.isArray(gekoppeld) ? gekoppeld : []) uit[g.status in uit ? g.status : 'niet-beoordeeld'] += 1;

  return uit;
}

// De punten om eerst aan te pakken: de volgorde komt van de server (zwaarste eerst); hier alleen koppelen en afkappen.
export function eerstAanpakken(punten, gekoppeld, max = 5) {
  const per = new Map((Array.isArray(gekoppeld) ? gekoppeld : []).map((g) => [g.eis.id, g]));

  return (Array.isArray(punten) ? punten : [])
    .map((p) => per.get(p.eisId))
    .filter(Boolean)
    .slice(0, max);
}

// Hoeveel onderdelen worden het plan voor dit fonds? Dezelfde regel als op de server: elke vraag van het lid (verplicht of criterium) is een onderdeel.
export const aantalFormulierVragen = (criteria) => (Array.isArray(criteria) ? criteria : []).filter((e) => e && e.bronType === 'lid' && (e.soort === 'verplicht' || e.soort === 'criterium') && schoonTekst(e.tekst)).length;
