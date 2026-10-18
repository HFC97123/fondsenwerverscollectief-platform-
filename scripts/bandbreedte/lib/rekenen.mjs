// Uit gecontroleerde toekenningen en regels een voorstel rekenen. ALLE rekenwerk gebeurt hier; het model rekent niets.
import { kwantiel, rondAf } from './bedragen.mjs';

export const MIN_TOEKENNINGEN = 5; // minder dan dit is geen bandbreedte maar een handvol voorbeelden
export const VENSTER_JAREN = 3; // alleen toekenningen uit de laatste 3 jaar waarover het fonds publiceert
export const MAX_ACHTERSTAND_JAREN = 4; // de nieuwste gevonden toekenning mag niet ouder zijn dan dit

export const BANDEN = [
  { id: 'd3c9bb10-138f-4806-9c5f-18e572180463', naam: '€0–€5.000', min: 0, max: 5000 },
  { id: 'c070612d-809f-41ab-885e-5a9d9c3f9a83', naam: '€5.000–€10.000', min: 5000, max: 10000 },
  { id: '2b183b57-7ead-4f54-9325-e2f4a0220a07', naam: '€10.000–€25.000', min: 10000, max: 25000 },
  { id: '5d35a1a0-b008-444c-b064-10551482b481', naam: '€25.000–€50.000', min: 25000, max: 50000 },
  { id: '69b63c08-809b-405d-afd7-51caf0518ce9', naam: '€50.000–€100.000', min: 50000, max: 100000 },
  { id: 'd1d3ae6b-04f4-496b-9b38-ed65919cad5a', naam: '€100.000–€500.000', min: 100000, max: 500000 },
  { id: 'a7a642ca-f858-44f0-90bd-8953fc8bb77a', naam: '€500.000–€1.000.000', min: 500000, max: 1000000 },
  { id: '167e64ff-a51b-47b2-b14a-529a2472b77e', naam: '€1.000.000+', min: 1000000, max: Infinity },
];

// De band waarin het "typische" bedrag valt. Grensbedragen horen bij de hogere band (5.000 -> €5.000–€10.000).
export function kiesBand(waarde) {
  if (waarde == null || !Number.isFinite(waarde) || waarde < 0) return null;
  return [...BANDEN].reverse().find((b) => waarde >= b.min) ?? BANDEN[0];
}

const eur = (n) => '€ ' + Math.round(n).toLocaleString('nl-NL');

export function berekenVoorstel({ items, bronnen = [], huidigJaar = new Date().getFullYear() }) {
  const toek = items.filter((i) => i.soort === 'toekenning' && i.bedragEur != null && i.bedragEur > 0);
  const jarig = toek.filter((i) => i.jaar != null);
  const maxJaar = jarig.length ? Math.max(...jarig.map((i) => i.jaar)) : null;
  const recent = maxJaar == null ? [] : jarig.filter((i) => i.jaar >= maxJaar - (VENSTER_JAREN - 1));
  const opmerkingen = [];

  const regelMax = items.filter((i) => i.soort === 'regel_max' && i.bedragEur != null).map((i) => i.bedragEur);
  const regelMin = items.filter((i) => i.soort === 'regel_min' && i.bedragEur != null).map((i) => i.bedragEur);
  const pct = items.filter((i) => i.soort === 'regel_percentage').map((i) => i.bedrag);
  const regel = {
    min: regelMin.length ? Math.max(...regelMin) : null,
    max: regelMax.length ? Math.min(...regelMax) : null, // bij meerdere genoemde maxima: de strengste (laagste); de beheerder ziet de citaten
    percentage: pct.length ? Math.min(...pct) : null,
  };
  if (regelMax.length > 1 && Math.max(...regelMax) !== Math.min(...regelMax)) opmerkingen.push('Er zijn meerdere maximumbedragen gevonden; het laagste is gebruikt. Controleer de citaten (bijvoorbeeld verschillende subsidievormen).');
  if (regelMin.length > 1 && Math.max(...regelMin) !== Math.min(...regelMin)) opmerkingen.push('Er zijn meerdere minimumbedragen gevonden; het hoogste is gebruikt. Controleer de citaten.');

  let feit = null;
  if (recent.length >= MIN_TOEKENNINGEN) {
    if (huidigJaar - maxJaar > MAX_ACHTERSTAND_JAREN) opmerkingen.push(`Nieuwste toekenningen zijn van ${maxJaar}: te oud voor een voorstel.`);
    else {
      const bedr = recent.map((i) => i.bedragEur).sort((a, b) => a - b);
      const n = bedr.length;
      const lo = n >= 10 ? kwantiel(bedr, 0.1) : bedr[0];
      const hi = n >= 10 ? kwantiel(bedr, 0.9) : bedr[n - 1];
      feit = {
        n,
        van: Math.min(...recent.map((i) => i.jaar)),
        tot: maxJaar,
        min: bedr[0],
        max: bedr[n - 1],
        mediaan: kwantiel(bedr, 0.5),
        gemiddeld: Math.round(bedr.reduce((s, x) => s + x, 0) / n),
        p10: lo,
        p90: hi,
        wijze: n >= 10 ? 'P10–P90' : 'laagste–hoogste',
        voorstelMin: rondAf(lo, 'omlaag'),
        voorstelMax: rondAf(hi, 'omhoog'),
      };
    }
  } else if (toek.length) {
    opmerkingen.push(`Slechts ${recent.length} toekenning${recent.length === 1 ? '' : 'en'} met jaartal in de laatste ${VENSTER_JAREN} jaar gevonden (minimaal ${MIN_TOEKENNINGEN} nodig); ${toek.length} in totaal.`);
  }

  let vMin = null;
  let vMax = null;
  if (feit) {
    vMin = feit.voorstelMin;
    vMax = feit.voorstelMax;
  }
  if (regel.min != null) vMin = regel.min;
  if (regel.max != null) vMax = regel.max;
  if (vMin != null && vMax != null && vMin > vMax) {
    opmerkingen.push('Minimum lag boven maximum na het combineren van regel en toekenningen; alleen de regel is gebruikt.');
    if (regel.min != null && regel.max != null) { vMin = regel.min; vMax = regel.max; }
    else { vMin = regel.min ?? null; vMax = regel.max ?? null; }
  }

  const typisch = feit ? feit.mediaan : vMin != null && vMax != null ? (vMin + vMax) / 2 : vMax != null ? vMax / 2 : vMin;
  const band = vMin == null && vMax == null ? null : kiesBand(typisch);

  const heeftRegel = regel.min != null || regel.max != null;
  const basis = heeftRegel && feit ? 'REGEL + FEITELIJK' : heeftRegel ? 'REGEL' : feit ? 'FEITELIJK' : 'GEEN';
  const eigen = bronnen.some((b) => b.eigen);
  let zekerheid = 'geen';
  if (heeftRegel && eigen) zekerheid = 'hoog';
  else if (feit && feit.n >= 10 && eigen) zekerheid = 'hoog';
  else if (feit || heeftRegel) zekerheid = 'midden';

  let toelichting = null;
  if (vMin != null || vMax != null) {
    const delen = [];
    if (feit) delen.push(`Indicatie op basis van ${feit.n} toekenningen (${feit.van === feit.tot ? feit.tot : `${feit.van}–${feit.tot}`}); gebruikelijk circa ${eur(feit.mediaan)}.`);
    if (regel.max != null) delen.push(`Het fonds noemt zelf een maximum van ${eur(regel.max)}.`);
    if (regel.min != null) delen.push(`Het fonds noemt zelf een minimum van ${eur(regel.min)}.`);
    if (regel.percentage != null) delen.push(`Het fonds financiert maximaal ${regel.percentage}% van het project.`);
    toelichting = delen.join(' ');
  } else if (regel.percentage != null) toelichting = `Het fonds financiert maximaal ${regel.percentage}% van het project. Geen bedragen gevonden.`;

  return { feit, regel, voorstel: { min: vMin, max: vMax, band }, basis, zekerheid, toelichting, opmerkingen, aantalToekenningenGevonden: toek.length };
}
