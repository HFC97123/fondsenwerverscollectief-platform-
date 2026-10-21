// Projectbegroting: de begrotingsregels van één project (Documenten › Begroting). Pure functies: geen React, geen netwerk,
// geen opslag. De regels worden bewaard in de kolom budget_lines van het project ({ versie, regels }); het totaal van de
// kosten wordt de projectbegroting (project.begroting), waarmee het dekkingsplan al rekent (financiering/dekkingsplan.js).
// Bedragen worden nooit verzonnen: een regel zonder bedrag telt niet mee en wordt als "nog in te vullen" gemeld.
import { leesBedragInvoer } from '../financiering/dekkingsplan.js';

export const BUDGET_VERSIE = 1;
export const MAX_REGELS = 200;
const MAX_TEKST = 200;
const MAX_TOELICHTING = 500;

// Kopjes (tussenregels) met suggesties voor regels. Bewust weinig kopjes: het lid begint leeg en voegt zelf toe. De suggesties zijn
// alleen een omschrijving en een eenheid, nooit een bedrag.
export const CATEGORIEEN = [
  { id: 'uitvoering', label: 'Projectuitvoering', suggesties: [['Projectleider', 'uur'], ['Coördinator', 'uur'], ['Uitvoerend medewerker', 'uur'], ['Trainer of docent', 'dag'], ['Zzp-uitvoerder', 'uur'], ['Vrijwilligersvergoeding', 'vrijwilliger'], ['Training van vrijwilligers', 'vrijwilliger'], ['Activiteiten en bijeenkomsten', 'bijeenkomst'], ['Reiskosten', 'kilometer']] },
  { id: 'activa', label: 'Activa en uitrusting', suggesties: [['Voedselpakketten', 'pakket'], ['Educatiemateriaal', 'set'], ['Materialen en benodigdheden', 'stuk'], ['Apparatuur', 'stuk'], ['Meubilair of inrichting', 'stuk'], ['Software en licenties', 'licentie']] },
  { id: 'organisatie', label: 'Organisatiekosten', suggesties: [['Zaalhuur of ruimtehuur', 'maand'], ['Communicatie en werving', 'post'], ['Drukwerk en flyers', 'stuk'], ['Verzekeringen', 'jaar'], ['Boekhouding', 'jaar'], ['Overhead (indirecte kosten)', 'post']] },
  { id: 'overig', label: 'Overig', suggesties: [['Monitoring en evaluatie', 'post'], ['Verantwoording en rapportage', 'post'], ['Accountantsverklaring', 'post'], ['Niet-verrekenbare btw', 'post'], ['Onvoorzien', 'post']] },
];

export const CATEGORIE_IDS = CATEGORIEEN.map((c) => c.id);
export const categorieLabel = (id) => (CATEGORIEEN.find((c) => c.id === id) || { label: 'Overig' }).label;
export const BRONNEN = ['handmatig', 'ai', 'upload'];

let teller = 0;

export function nieuwRegelId() {
  teller += 1;

  return `r${Date.now().toString(36)}${teller.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Een regel zoals de schermen die bewerken: getypte tekst voor aantal, tarief en bedrag.
export function nieuweRegel(categorie, basis = {}) {
  return {
    id: nieuwRegelId(),
    categorie: CATEGORIE_IDS.includes(categorie) ? categorie : 'overig',
    omschrijving: '',
    aantal: '',
    eenheid: '',
    tarief: '',
    bedrag: '',
    soort: 'geld',
    toelichting: '',
    bron: 'handmatig',
    ...basis,
  };
}

const tekst = (v, max) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max);
const getalTekst = (v) => (v == null || v === '' ? '' : typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v)); // 12.5 (opgeslagen getal) -> "12,5"

// Leest de kolom budget_lines ({ versie, regels } of een kale lijst) tot schone schermregels. Onbekende of kapotte regels vallen weg.
export function leesBudgetRegels(waarde) {
  const lijst = Array.isArray(waarde) ? waarde : waarde && typeof waarde === 'object' && Array.isArray(waarde.regels) ? waarde.regels : [];

  return lijst
    .filter((r) => r && typeof r === 'object')
    .slice(0, MAX_REGELS)
    .map((r) => ({
      id: tekst(r.id, 40) || nieuwRegelId(),
      categorie: CATEGORIE_IDS.includes(r.categorie) ? r.categorie : 'overig',
      omschrijving: tekst(r.omschrijving, MAX_TEKST),
      aantal: getalTekst(r.aantal),
      eenheid: tekst(r.eenheid, 40),
      tarief: getalTekst(r.tarief),
      bedrag: getalTekst(r.bedrag),
      soort: r.soort === 'natura' ? 'natura' : 'geld',
      toelichting: tekst(r.toelichting, MAX_TOELICHTING),
      bron: BRONNEN.includes(r.bron) ? r.bron : 'handmatig',
    }));
}

const lees = (v) => leesBedragInvoer(v);

// Het bedrag van één regel: aantal x tarief als beide er zijn, anders het vaste bedrag, anders niets. Nooit raden.
export function regelBedrag(regel) {
  const aantal = lees(regel.aantal);
  const tarief = lees(regel.tarief);
  const vast = lees(regel.bedrag);

  if (!aantal.ok || !tarief.ok || !vast.ok) return { ok: false, bedrag: null, bron: 'ongeldig' };

  if (aantal.waarde != null && tarief.waarde != null) return { ok: true, bedrag: Math.round(aantal.waarde * tarief.waarde * 100) / 100, bron: 'berekend' };

  if (vast.waarde != null) return { ok: true, bedrag: vast.waarde, bron: 'vast' };

  return { ok: true, bedrag: null, bron: 'onbekend' };
}

const rond = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Totalen: per categorie (in de volgorde van de lijst met categorieën), kosten in geld apart van bijdragen in natura.
export function berekenBegroting(regels) {
  const lijst = Array.isArray(regels) ? regels : [];
  const perCategorie = [];
  let totaalGeld = 0;
  let totaalNatura = 0;
  const zonderBedrag = [];
  const ongeldig = [];

  CATEGORIEEN.forEach((c) => {
    const eigen = lijst.filter((r) => r.categorie === c.id);

    if (!eigen.length) return;

    let subtotaal = 0;
    let natura = 0;

    const rijen = eigen.map((r) => {
      const b = regelBedrag(r);

      if (b.bron === 'ongeldig') ongeldig.push(r);
      else if (b.bedrag == null) {
        // Een helemaal lege regel (nog niets getypt) telt niet als "zonder bedrag"; hij wordt bij het opslaan overgeslagen.
        if (String(r.omschrijving || '').trim()) zonderBedrag.push(r);
      }
      else if (r.soort === 'natura') natura += b.bedrag;
      else subtotaal += b.bedrag;

      return { regel: r, ...b };
    });

    totaalGeld += subtotaal;
    totaalNatura += natura;
    perCategorie.push({ id: c.id, label: c.label, subtotaal: rond(subtotaal), natura: rond(natura), rijen });
  });

  return { perCategorie, totaalGeld: rond(totaalGeld), totaalNatura: rond(totaalNatura), zonderBedrag, ongeldig };
}

// Schermregels -> te bewaren regels (getallen). Een regel zonder omschrijving én zonder bedragen wordt overgeslagen.
// -> { ok, regels, fout }
export function regelsVoorOpslag(regels) {
  const uit = [];

  for (const r of Array.isArray(regels) ? regels : []) {
    const b = regelBedrag(r);
    const naam = tekst(r.omschrijving, MAX_TEKST);

    if (b.bron === 'ongeldig') return { ok: false, regels: [], fout: `Controleer de bedragen bij "${naam || categorieLabel(r.categorie)}". Gebruik bijvoorbeeld 1.250 of 12,50.` };

    const leeg = !naam && !String(r.aantal || '').trim() && !String(r.tarief || '').trim() && !String(r.bedrag || '').trim();

    if (leeg) continue;

    if (!naam) return { ok: false, regels: [], fout: `Geef bij elke regel in "${categorieLabel(r.categorie)}" een omschrijving.` };

    const aantal = lees(r.aantal).waarde;
    const tarief = lees(r.tarief).waarde;
    const vast = lees(r.bedrag).waarde;

    uit.push({
      id: tekst(r.id, 40) || nieuwRegelId(),
      categorie: CATEGORIE_IDS.includes(r.categorie) ? r.categorie : 'overig',
      omschrijving: naam,
      aantal,
      eenheid: tekst(r.eenheid, 40),
      tarief,
      bedrag: aantal != null && tarief != null ? null : vast,
      soort: r.soort === 'natura' ? 'natura' : 'geld',
      toelichting: tekst(r.toelichting, MAX_TOELICHTING),
      bron: BRONNEN.includes(r.bron) ? r.bron : 'handmatig',
    });
  }

  if (uit.length > MAX_REGELS) return { ok: false, regels: [], fout: `Een begroting kan maximaal ${MAX_REGELS} regels hebben.` };

  return { ok: true, regels: uit, fout: '' };
}

const getalOfNull = (v) => {
  if (v == null || v === '') return null;

  const n = Number(v);

  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.round(n * 100) / 100 : null;
};

// Wat in de database staat ({ versie, regels } of een kale lijst) -> schone opslagregels met echte getallen. Dit is de vorm
// van project.budgetRegels in de app; de schermen zetten het zelf om met leesBudgetRegels() en regelsVoorOpslag().
export function leesOpgeslagenRegels(waarde) {
  const lijst = Array.isArray(waarde) ? waarde : waarde && typeof waarde === 'object' && Array.isArray(waarde.regels) ? waarde.regels : [];

  return lijst
    .filter((r) => r && typeof r === 'object')
    .slice(0, MAX_REGELS)
    .map((r) => ({
      id: tekst(r.id, 40) || nieuwRegelId(),
      categorie: CATEGORIE_IDS.includes(r.categorie) ? r.categorie : 'overig',
      omschrijving: tekst(r.omschrijving, MAX_TEKST),
      aantal: getalOfNull(r.aantal),
      eenheid: tekst(r.eenheid, 40),
      tarief: getalOfNull(r.tarief),
      bedrag: getalOfNull(r.bedrag),
      soort: r.soort === 'natura' ? 'natura' : 'geld',
      toelichting: tekst(r.toelichting, MAX_TOELICHTING),
      bron: BRONNEN.includes(r.bron) ? r.bron : 'handmatig',
    }));
}

export const budgetKolom = (regels) => ({ versie: BUDGET_VERSIE, regels });

// Kostenregels in geld voor de bestaande begrotings-Excel (berekenBudget). Bijdragen in natura staan daar niet in.
export function expenseLinesVoorExcel(regels) {
  return (Array.isArray(regels) ? regels : [])
    .filter((r) => r.soort !== 'natura')
    .map((r) => {
      const aantal = lees(r.aantal).waarde;
      const tarief = lees(r.tarief).waarde;
      const vast = lees(r.bedrag).waarde;
      const naam = tekst(r.omschrijving, MAX_TEKST);

      return {
        category: categorieLabel(r.categorie).toLowerCase(),
        description: naam,
        notes: tekst(r.toelichting, MAX_TOELICHTING) || null,
        quantity: aantal != null && tarief != null ? aantal : null,
        unitPrice: aantal != null && tarief != null ? tarief : null,
        statedAmount: aantal != null && tarief != null ? null : vast,
      };
    })
    .filter((r) => r.description);
}
