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

// De naam van het fonds zoals die in titels staat: alleen de naam van de stichting, niet de hele regelingnaam.
// "Kwartaalronde donatieaanvraag mens, natuur en cultuur Stichting Cordius" -> "Stichting Cordius". Staat er geen "Stichting"/"Fonds" in, dan blijft de naam zoals hij is.
export function kortFondsLabel(label) {
  const t = schoonTekst(label);
  const m = /(?:^|\s)((?:Stichting|Fonds|Fondation|Foundation|Vereniging)\s+[^,;()]+)$/i.exec(t);

  return m && t.split(' ').length > 4 && m[1].split(' ').length >= 2 ? m[1].trim() : t;
}

// De titel van een aanvraag is alleen de naam van het fonds: "Stichting Cordius".
export const aanvraagTitel = (label) => kortFondsLabel(label);

// Fondsen uit het dekkingsplan van het project waarvoor nog geen aanvraag is gemaakt, om er direct een te beginnen.
// regels: regelUitRpc-regels; aanvragen: de aanvragen van het project. Verborgen of verwijderde bronnen, afgewezen en ingetrokken regels tellen niet mee.
const DP_VOLGORDE = { preparing: 0, interesting: 1, submitted: 2, awarded: 3 };
const dpSleutel = (t) => schoonTekst(t).toLowerCase();

export function fondsenUitDekkingsplan(regels, aanvragen) {
  const heeft = new Set((Array.isArray(aanvragen) ? aanvragen : []).filter((a) => a && a.soort === 'fonds').map((a) => dpSleutel(kortFondsLabel(a.fondsLabel))));
  const gezien = new Set();
  const uit = [];

  (Array.isArray(regels) ? regels : []).forEach((r, i) => {
    if (!r || r.bronStatus !== 'zichtbaar' || DP_VOLGORDE[r.status] === undefined) return;

    // De aanbieder (de stichting) is de naam van de aanvraag; een regeling van dat fonds staat eronder als toelichting.
    const naam = kortFondsLabel(schoonTekst(r.funder) || schoonTekst(r.naam));
    const regeling = schoonTekst(r.funder) && schoonTekst(r.naam) !== schoonTekst(r.funder) ? schoonTekst(r.naam) : '';
    const sleutel = dpSleutel(naam);

    if (!naam || heeft.has(sleutel) || gezien.has(sleutel)) return;

    gezien.add(sleutel);
    uit.push({ id: r.id || `dp-${i}`, naam, regeling, website: r.website || '', status: r.status, bedrag: r.status === 'awarded' && r.awarded != null ? r.awarded : r.requested, i });
  });

  return uit.sort((x, y) => DP_VOLGORDE[x.status] - DP_VOLGORDE[y.status] || x.i - y.i);
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

// ───────────── Versies en bewerken (concept/definitief) ─────────────

// Tekens van een onderdeel zoals het fonds ze telt: zonder [aanvullen: ...]-markeringen, witruimte samengevoegd.
export const onderdeelTekens = (tekst) => String(tekst == null ? '' : tekst).replace(/\[aanvullen:[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim().length;

// Aantal plekken dat nog is in te vullen in één tekst.
export const aantalAanvullen = (tekst) => (String(tekst == null ? '' : tekst).match(/\[aanvullen:[^\]]*\]/gi) || []).length;

// Onderdelen zoals de server ze bewaart: { id, titel, tekst }. Een plan van de AI levert zijn secties; niets anders gaat mee.
export function onderdelenUitPlan(plan) {
  const secties = plan && Array.isArray(plan.secties) ? plan.secties : [];

  return secties.map((s) => ({ id: s && s.id != null ? String(s.id) : null, titel: schoonTekst(s && s.titel), tekst: String((s && s.tekst) || '') }));
}

export function onderdelenUitVersie(antwoorden) {
  return (Array.isArray(antwoorden) ? antwoorden : []).map((a) => ({ id: a && a.id != null ? String(a.id) : null, titel: schoonTekst(a && a.titel), tekst: String((a && a.tekst) || '') }));
}

// Limiet per onderdeel komt uit het plan (de server bewaart de limiet niet bij de versie): { [id]: maxTekens }.
export function limietenUitPlan(plan) {
  const uit = {};

  for (const s of plan && Array.isArray(plan.secties) ? plan.secties : []) {
    if (s && s.id != null && Number.isFinite(Number(s.maxTekens)) && Number(s.maxTekens) > 0) uit[String(s.id)] = Number(s.maxTekens);
  }

  return uit;
}

export const onderdelenGelijk = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
export const onderdelenLeeg = (lijst) => !(Array.isArray(lijst) && lijst.some((o) => String(o.tekst || '').trim()));

// Tekst zoals ze naar Word of PDF gaat (ook het formaat van "Download voor indienen").
export function onderdelenNaarTekst(onderdelen, titel = 'Aanvraag') {
  const delen = [`# ${schoonTekst(titel) || 'Aanvraag'}`];

  for (const o of Array.isArray(onderdelen) ? onderdelen : []) {
    delen.push(`## ${schoonTekst(o.titel)}`);
    delen.push(String(o.tekst || '').trim() || '[aanvullen: dit onderdeel]');
  }

  return delen.join('\n\n');
}

export const versieNaam = (v) => (v ? `Versie ${v.nummer}${v.naam && String(v.naam).trim() && v.naam !== `Versie ${v.nummer}` ? ` · ${String(v.naam).trim()}` : ''}` : '');

// ───────────── Formulier: vragen met tekenlimiet en stukken (checklist) ─────────────

export const MAX_LIMIET_TEKENS = 200000;
export const MAX_VRAGEN = 40;
export const MAX_STUKKEN = 30;

export const LIMIET_ATTENTIE = 'Let op: veel fondsen hanteren een tekenlimiet per vraag. Wij kunnen alleen antwoorden voor u schrijven als u die tekenlimiet aan ons doorgeeft. Zonder tekenlimiet kunnen wij u niet helpen.';

// Een vraag is klaar voor de bevestiging als ze een tekenlimiet heeft (geheel getal) of het lid zegt dat dit fonds geen limiet heeft.
export const limietOk = (v) => Boolean(v) && (v.geenLimiet === true || (Number.isInteger(v.maxTekens) && v.maxTekens >= 1 && v.maxTekens <= MAX_LIMIET_TEKENS));
export const vragenZonderLimiet = (lijst) => (Array.isArray(lijst) ? lijst : []).filter((v) => !limietOk(v)).length;

// Tekst uit een invoerveld naar een limiet: alleen cijfers (punten en spaties mogen), anders null.
export function leesLimiet(invoer) {
  const t = String(invoer == null ? '' : invoer).replace(/[\s.]/g, '');

  if (!/^\d{1,6}$/.test(t)) return null;

  const n = Number(t);

  return n >= 1 && n <= MAX_LIMIET_TEKENS ? n : null;
}

const volgendId = (lijst, voorvoegsel) => {
  const ids = new Set((Array.isArray(lijst) ? lijst : []).map((x) => x && x.id));
  let n = (Array.isArray(lijst) ? lijst.length : 0) + 1;

  while (ids.has(`${voorvoegsel}${n}`)) n += 1;

  return `${voorvoegsel}${n}`;
};

export function nieuweVraag(lijst, tekst) {
  return { id: volgendId(lijst, 'v'), tekst: schoonTekst(tekst).slice(0, 500), maxTekens: null, geenLimiet: false };
}

export function nieuwStuk(lijst, tekst) {
  return { id: volgendId(lijst, 's'), tekst: schoonTekst(tekst).slice(0, 200), bron: 'lid', sleutel: null, maxLeeftijdMaanden: null, nietVanToepassing: false, klaar: false, documentNaam: '' };
}

// De vragen als onderdelen van een aanvraag: dezelfde vorm als het plan van de AI, zodat het bewerkscherm er één werkwijze voor heeft.
export function planUitVragen(vragen) {
  const lijst = vragen && Array.isArray(vragen.lijst) ? vragen.lijst : [];

  return { secties: lijst.map((v) => ({ id: v.id, titel: v.tekst, tekst: '', vragen: [], ...(v.maxTekens ? { maxTekens: v.maxTekens } : {}) })) };
}

// De opgeslagen onderdelen in de volgorde van de vragenlijst, met de vraag als titel. Een nieuwe vraag begint leeg; een verwijderde vraag valt weg.
export function onderdelenVoorVragen(onderdelen, vragen) {
  const per = new Map((Array.isArray(onderdelen) ? onderdelen : []).filter((o) => o && o.id != null).map((o) => [String(o.id), o]));
  const lijst = vragen && Array.isArray(vragen.lijst) ? vragen.lijst : [];

  return lijst.map((v) => ({ id: v.id, titel: v.tekst, tekst: per.has(v.id) ? String(per.get(v.id).tekst || '') : '' }));
}

export function limietenUitVragen(vragen) {
  const uit = {};

  for (const v of vragen && Array.isArray(vragen.lijst) ? vragen.lijst : []) if (v && !v.geenLimiet && Number.isFinite(v.maxTekens) && v.maxTekens > 0) uit[v.id] = v.maxTekens;

  return uit;
}

// ── Stukken ──

const SOORT_PER_SLEUTEL = { anbi: ['anbi'], statuten: ['statuten'], jaarrekening: ['jaarrekening'], jaarverslag: ['jaarverslag'] };

const kleinLetters = (t) => String(t == null ? '' : t).toLowerCase();

function leeftijdMaanden(datum, nu) {
  const d = new Date(datum);
  const n = nu instanceof Date ? nu : new Date(nu);

  if (!Number.isFinite(d.getTime()) || !Number.isFinite(n.getTime())) return null;

  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth()) - (n.getDate() < d.getDate() ? 1 : 0);
}

// Alle documenten die een lid heeft, als één lijst: de bestanden van het project en die van het organisatieprofiel. Vervangen bestanden tellen niet mee.
export function documentenLijst(projectDocs, orgDocs) {
  const een = (d, bron) => ({ naam: String((d && d.naam) || ''), soort: String((d && d.soort) || ''), datum: (d && (d.gemaakt || d.aangemaakt)) || '', bron });

  return [
    ...(Array.isArray(projectDocs) ? projectDocs : []).filter((d) => d && d.naam && !d.vervangen).map((d) => een(d, 'project')),
    ...(Array.isArray(orgDocs) ? orgDocs : []).filter((d) => d && d.naam).map((d) => een(d, 'organisatie')),
  ];
}

// Staat dit stuk al in de documentatie? Alleen de vier standaardstukken (ANBI-status, statuten, jaarrekening, jaarverslag) worden automatisch herkend, op de naam of de soort
// van het bestand. Andere stukken koppelt het lid zelf (documentNaam) of vinkt het zelf af.
export function zoekDocument(stuk, docs) {
  const woorden = SOORT_PER_SLEUTEL[stuk && stuk.sleutel];

  if (!woorden) return null;

  const gevonden = (Array.isArray(docs) ? docs : []).filter((d) => woorden.some((w) => kleinLetters(d.naam).includes(w) || kleinLetters(d.soort).includes(w)));

  if (!gevonden.length) return null;

  // Het nieuwste bestand eerst.
  return [...gevonden].sort((a, b) => String(b.datum).localeCompare(String(a.datum)))[0];
}

// Toestand van één stuk: 'nvt' | 'klaar' | 'te-oud' | 'nodig'. 'te-oud': het bestand in de documentatie is langer geleden toegevoegd dan het fonds toestaat;
// de toevoegdatum is niet de datum van het stuk zelf, dus de tekst vraagt het lid dat te controleren.
export function stukStatus(stuk, docs, nu = new Date()) {
  if (!stuk) return { status: 'nodig', document: null, reden: '' };
  if (stuk.nietVanToepassing) return { status: 'nvt', document: null, reden: '' };

  const lijst = Array.isArray(docs) ? docs : [];
  const gekozen = stuk.documentNaam ? lijst.find((d) => d.naam === stuk.documentNaam) || { naam: stuk.documentNaam, datum: '', bron: 'project' } : null;
  const doc = gekozen || zoekDocument(stuk, lijst);

  if (doc) {
    const oud = stuk.maxLeeftijdMaanden ? leeftijdMaanden(doc.datum, nu) : null;

    if (oud !== null && oud > stuk.maxLeeftijdMaanden) return { status: 'te-oud', document: doc, reden: `Het bestand ${doc.naam} is ${oud} maanden geleden toegevoegd. Het fonds wil dit stuk niet ouder dan ${stuk.maxLeeftijdMaanden} maanden. Controleer of het de nieuwste is.` };

    return { status: 'klaar', document: doc, reden: '' };
  }

  return stuk.klaar ? { status: 'klaar', document: null, reden: '' } : { status: 'nodig', document: null, reden: '' };
}

export function telStukken(stukken, docs, nu = new Date()) {
  const lijst = (Array.isArray(stukken) ? stukken : []).filter((s) => s && !s.nietVanToepassing);
  const klaar = lijst.filter((s) => stukStatus(s, docs, nu).status === 'klaar').length;

  return { totaal: lijst.length, klaar, openstaand: lijst.length - klaar };
}

// ───────────── Alvast verzamelen ─────────────
// Wat vrijwel elk fonds vraagt. Dit staat in de zijkant zolang het formulier van het fonds nog niet gelezen is; daarna komt de lijst van het fonds zelf.
export const STANDAARD_STUKKEN = [
  { id: 'std-jaarverslag', tekst: 'Jaarverslag, niet ouder dan 1 jaar', sleutel: 'jaarverslag', maxLeeftijdMaanden: 12 },
  { id: 'std-anbi', tekst: 'ANBI-status', sleutel: 'anbi', maxLeeftijdMaanden: null },
  { id: 'std-statuten', tekst: 'Statuten', sleutel: 'statuten', maxLeeftijdMaanden: null },
  { id: 'std-jaarrekening', tekst: 'Jaarrekening, niet ouder dan 1 jaar', sleutel: 'jaarrekening', maxLeeftijdMaanden: 12 },
];

// De korte lijst voor de zijkant: eigen stukken van het fonds als die er zijn, anders de standaardstukken. 'Niet van toepassing' valt weg.
export function alvastLijst(stukken, docs, nu = new Date()) {
  const bron = Array.isArray(stukken) && stukken.length > 0 ? stukken : STANDAARD_STUKKEN;

  return bron
    .filter((s) => s && !s.nietVanToepassing)
    .map((s) => {
      const st = stukStatus(s, docs, nu);

      return { id: s.id, tekst: s.tekst, status: st.status, bestand: st.document ? st.document.naam : '' };
    });
}

// Hoeveel vragen hebben tekst, en hoeveel staan boven hun limiet?
export function telAntwoorden(onderdelen, limieten) {
  const lijst = Array.isArray(onderdelen) ? onderdelen : [];
  const beantwoord = lijst.filter((o) => onderdeelTekens(o.tekst) > 0 && aantalAanvullen(o.tekst) === 0).length;
  const metGat = lijst.filter((o) => onderdeelTekens(o.tekst) > 0 && aantalAanvullen(o.tekst) > 0).length;
  const leeg = lijst.filter((o) => onderdeelTekens(o.tekst) === 0).length;
  const overLimiet = lijst.filter((o) => o.id != null && limieten && limieten[o.id] && onderdeelTekens(o.tekst) > limieten[o.id]).length;

  return { totaal: lijst.length, beantwoord, metGat, leeg, overLimiet };
}

// ───────────── De vier stappen van een aanvraag per fonds ─────────────
// Vragenlijst, Antwoorden, Stukken en Controle. Zuivere functie: wat is klaar en wat staat er onder de naam. 'weg' = de stap is nog niet te openen.
export const WERKBLAD_STAPPEN = [
  { id: 'vragenlijst', nr: 1, naam: 'Vragenlijst' },
  { id: 'antwoorden', nr: 2, naam: 'Antwoorden' },
  { id: 'stukken', nr: 3, naam: 'Stukken' },
  { id: 'controle', nr: 4, naam: 'Controle' },
];

// beantwoord = volledig (geen plekken om in te vullen); geschreven = er staat tekst (ook met plekken om in te vullen).
export function werkbladStappen({ bevestigd = false, aantalVragen = 0, beantwoord = 0, geschreven = beantwoord, stukkenTotaal = 0, stukkenKlaar = 0, definitief = false } = {}) {
  const lijstKlaar = Boolean(bevestigd) && aantalVragen > 0;
  const antwoordenKlaar = lijstKlaar && beantwoord >= aantalVragen;
  const stukkenOk = lijstKlaar && stukkenKlaar >= stukkenTotaal;
  const meervoud = (n, een, meer) => `${n} ${n === 1 ? een : meer}`;

  return [
    { ...WERKBLAD_STAPPEN[0], klaar: lijstKlaar, open: true, sub: lijstKlaar ? meervoud(aantalVragen, 'vraag', 'vragen') : 'Wat vraagt het fonds?' },
    { ...WERKBLAD_STAPPEN[1], klaar: antwoordenKlaar, open: lijstKlaar, sub: lijstKlaar ? `${Math.max(geschreven, beantwoord)} van ${aantalVragen} geschreven` : 'Schrijven en aanpassen' },
    { ...WERKBLAD_STAPPEN[2], klaar: stukkenOk, open: lijstKlaar, sub: lijstKlaar ? (stukkenTotaal === 0 ? 'Geen stukken nodig' : `${stukkenKlaar} van ${stukkenTotaal} klaar`) : 'Bijlagen verzamelen' },
    { ...WERKBLAD_STAPPEN[3], klaar: Boolean(definitief) && antwoordenKlaar && stukkenOk, open: lijstKlaar, sub: definitief ? 'Definitief gemaakt' : 'Klaar om in te dienen?' },
  ];
}

// De voortgang van de server (kaart per fonds) omgezet naar de vier stappen, met de stukken zoals die nu in de documentatie staan.
export function stappenUitVoortgang(voortgang, docs, nu = new Date()) {
  if (!voortgang) return null;

  const t = telStukken(voortgang.stukken, docs, nu);

  return werkbladStappen({
    bevestigd: voortgang.vragenBevestigd,
    aantalVragen: voortgang.aantalVragen,
    beantwoord: voortgang.aantalAntwoorden,
    geschreven: voortgang.aantalAntwoorden,
    stukkenTotaal: t.totaal,
    stukkenKlaar: t.klaar,
    definitief: voortgang.status === 'definitief',
  });
}

// Welke stap is aan de beurt: de eerste die nog niet klaar is (is alles klaar, dan de laatste).
export function volgendeStap(stappen) {
  const lijst = Array.isArray(stappen) ? stappen : [];

  return lijst.find((s) => !s.klaar) || lijst[lijst.length - 1] || null;
}

export const STAP_KNOP = { vragenlijst: 'Ga verder met de vragenlijst', antwoorden: 'Ga verder met de antwoorden', stukken: 'Ga verder met de stukken', controle: 'Naar de controle' };

// Wat Subsidie Kompas voor een project heeft geschreven, als regels voor de lijst van Projectdocumentatie: het concept projectplan en de concepten per fonds (soort Projectplan),
// de concept-begroting (soort Begroting) en het concept-dekkingsplan (soort Concept-dekkingsplan, op het scherm Dekkingsplan). Het lid maakt ze later definitief. Alleen wat er echt is; de server bewaart de plannen, hier wordt niets nagemaakt.
// aanvragen: de lijst van de server (of null), dekkingRegels: het aantal regels van het dekkingsplan (of 0).
export function geschrevenDocs(project, aanvragen, dekkingRegels = 0) {
  if (!project || !project.id) return [];

  const { algemeen, fondsen } = splitsAanvragen(aanvragen);
  const basis = { projectId: project.id, projectNaam: project.naam || 'Naamloos project', concept: true };
  const uit = [];

  if (algemeen && algemeen.heeftPlan) {
    uit.push({ ...basis, id: `gen-plan-${algemeen.id}`, naam: 'Concept projectplan', soort: 'Projectplan', gegenereerd: 'plan', aanvraagId: algemeen.id, datum: algemeen.planBijgewerkt || '' });
  }

  for (const a of fondsen.filter((x) => x.heeftPlan)) {
    uit.push({ ...basis, id: `gen-fonds-${a.id}`, naam: `Concept voor ${kortFondsLabel(a.fondsLabel) || 'een fonds'}`, soort: 'Projectplan', gegenereerd: 'fonds', aanvraagId: a.id, datum: a.planBijgewerkt || a.bijgewerkt || '' });
  }

  const regels = Array.isArray(project.budgetRegels) ? project.budgetRegels.length : 0;

  if (regels > 0) uit.push({ ...basis, id: `gen-begroting-${project.id}`, naam: 'Concept begroting', soort: 'Begroting', gegenereerd: 'begroting', datum: '', toelichting: `${regels} ${regels === 1 ? 'regel' : 'regels'}` });

  if (Number(dekkingRegels) > 0) uit.push({ ...basis, id: `gen-dekking-${project.id}`, naam: 'Concept dekkingsplan', soort: 'Concept-dekkingsplan', gegenereerd: 'dekking', datum: '', toelichting: `${dekkingRegels} ${Number(dekkingRegels) === 1 ? 'financier' : 'financiers'}` });

  return uit;
}

// De bestanden van het organisatieprofiel als regels in de lijst van Projectdocumentatie. Ze horen bij de hele organisatie, niet bij één project; de soort die het lid er
// zelf aan gaf (jaarverslag, beleidsplan, ...) blijft zichtbaar, voor het filter vallen ze onder Overig. Alleen bestanden die echt te openen zijn.
export function organisatieDocsVoorLijst(orgDocs) {
  return (Array.isArray(orgDocs) ? orgDocs : [])
    .filter((d) => d && d.pad && d.naam)
    .map((d) => ({ id: `org-${d.id}`, naam: String(d.naam), soort: 'Overig', soortTekst: String(d.soort || 'Overig'), pad: d.pad, organisatie: true, projectId: '', projectNaam: 'Hele organisatie', gemaakt: d.aangemaakt || '' }));
}

// ---- Definitieve versies ("Maak definitief") ----
// Een definitieve versie is een vaste kopie van een concept; de lijst toont ze bovenaan, onder de naam zonder "Concept".
export const DEFINITIEF_NAAM = { projectplan: 'Projectplan', begroting: 'Begroting', dekkingsplan: 'Dekkingsplan' };
const DEFINITIEF_SOORT = { projectplan: 'Projectplan', begroting: 'Begroting', dekkingsplan: 'Concept-dekkingsplan' };
const GENEREERD_NAAR_DEFINITIEF = { plan: 'projectplan', begroting: 'begroting', dekking: 'dekkingsplan' };

// Het soort definitief document dat bij een concept-regel hoort, of null (een concept voor een fonds wordt niet definitief; dat staat in Aanvraag indienen).
export const definitiefSoortVan = (doc) => (doc && GENEREERD_NAAR_DEFINITIEF[doc.gegenereerd]) || null;

// De rijen van de database (zonder inhoud) als regels voor de lijst. projecten: om de projectnaam erbij te zetten.
export function definitieveDocsVoorLijst(rijen, projecten) {
  const namen = new Map((Array.isArray(projecten) ? projecten : []).map((p) => [p.id, p.naam || 'Naamloos project']));

  return (Array.isArray(rijen) ? rijen : [])
    .filter((r) => r && r.id && DEFINITIEF_NAAM[r.soort] && namen.has(r.projectId))
    .map((r) => ({
      id: `def-${r.id}`,
      definitiefId: r.id,
      definitiefSoort: r.soort,
      naam: DEFINITIEF_NAAM[r.soort],
      soort: DEFINITIEF_SOORT[r.soort],
      gegenereerd: 'definitief',
      definitief: true,
      versie: r.versie,
      datum: r.gemaakt || '',
      projectId: r.projectId,
      projectNaam: namen.get(r.projectId),
    }));
}

// Wat er vast wordt bewaard. Het project gaat mee zonder zijn documenten (te groot, en niet nodig voor de begroting).
const zonderDocs = (project) => {
  const { docs, ...rest } = project || {};

  return rest;
};

export const planMomentopname = ({ plan, projectNaam }) => ({ type: 'projectplan', plan, projectNaam: projectNaam || '' });
export const begrotingMomentopname = ({ soort, project, finRegels }) => ({ type: soort, project: zonderDocs(project), finRegels: Array.isArray(finRegels) ? finRegels : [] });

// Het plan zoals het lid het nu heeft: de tekst van de AI, met de tekst uit de nieuwste opgeslagen versie erover (per onderdeel op id). Zonder versie: het plan zelf.
// Een onderdeel dat de AI niet lukte en dat het lid zelf schreef, telt weer als geschreven.
export function planMetVersie(plan, antwoorden) {
  if (!plan || !Array.isArray(plan.secties) || !Array.isArray(antwoorden) || !antwoorden.length) return plan;

  const per = new Map(antwoorden.filter((a) => a && a.id != null).map((a) => [String(a.id), String(a.tekst || '')]));

  return {
    ...plan,
    secties: plan.secties.map((s) => {
      if (!s || s.id == null || !per.has(String(s.id))) return s;

      const tekst = per.get(String(s.id));

      return { ...s, tekst, status: s.status === 'mislukt' && tekst.trim() ? 'geschreven' : s.status };
    }),
  };
}
