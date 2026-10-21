// Projectbegroting: de begrotingsregels van één project (Documenten › Begroting). Pure functies: geen React, geen netwerk,
// geen opslag. De regels worden bewaard in de kolom budget_lines van het project ({ versie, regels }); het totaal van de
// kosten wordt de projectbegroting (project.begroting), waarmee het dekkingsplan al rekent (financiering/dekkingsplan.js).
// Bedragen worden nooit verzonnen: een regel zonder bedrag telt niet mee en wordt als "nog in te vullen" gemeld.
import { leesBedragInvoer } from '../financiering/dekkingsplan.js';

export const BUDGET_VERSIE = 1;
export const MAX_REGELS = 200;
const MAX_TEKST = 200;
const MAX_TOELICHTING = 500;

// Kopjes (tussenregels) met een korte toelichting (bullets, getoond bij het overheen gaan) en suggesties voor regels. Bewust weinig kopjes: het lid
// begint leeg en voegt zelf toe. De suggesties zijn alleen een omschrijving en een eenheid, nooit een bedrag.
export const CATEGORIEEN = [
  {
    id: 'uitvoering',
    label: 'Projectuitvoering',
    toelichting: ['Vaak de mankracht: personeelskosten, of andere kosten die gemaakt worden om het project uit te voeren.', 'Ook het trainen van de mankracht, zoals het trainen van vrijwilligers, en wat daarvoor nodig is.'],
    suggesties: [['Projectleider', 'uur'], ['Coördinator', 'uur'], ['Uitvoerend medewerker', 'uur'], ['Trainer of docent', 'dag'], ['Zzp-uitvoerder', 'uur'], ['Vrijwilligersvergoeding', 'vrijwilliger'], ['Training van vrijwilligers', 'vrijwilliger'], ['Activiteiten en bijeenkomsten', 'bijeenkomst'], ['Reiskosten', 'kilometer']],
  },
  {
    id: 'activa',
    label: 'Activa en uitrusting',
    toelichting: ['De uitrusting die nodig is om het project uit te voeren.', 'De materialen die nodig zijn om de hulpverlening uit te voeren.'],
    suggesties: [['Voedselpakketten', 'pakket'], ['Educatiemateriaal', 'set'], ['Materialen en benodigdheden', 'stuk'], ['Apparatuur', 'stuk'], ['Meubilair of inrichting', 'stuk'], ['Software en licenties', 'licentie']],
  },
  {
    id: 'communicatie',
    label: 'Communicatiekosten',
    toelichting: ['Kosten om het project onder de aandacht te brengen.', 'Kosten om de doelgroep of nieuwe steun te bereiken.'],
    suggesties: [['Communicatie en werving', 'post'], ['Drukwerk en flyers', 'stuk'], ['Website en online campagne', 'post']],
  },
  {
    id: 'organisatie',
    label: 'Organisatiekosten',
    toelichting: ['De kosten voor fondsenwerving, gerekend over de bovenstaande regels.', 'Wij raden aan hier tussen 6% en 12,5% van de bovenstaande kosten als maximum op te nemen.'],
    suggesties: [['Fondsenwerving', 'post'], ['Zaalhuur of ruimtehuur', 'maand'], ['Verzekeringen', 'jaar'], ['Boekhouding', 'jaar'], ['Overhead (indirecte kosten)', 'post']],
  },
];

export const CATEGORIE_IDS = CATEGORIEEN.map((c) => c.id);

// Kopjes zijn optioneel. Een regel hoort bij een vast kopje (hierboven), bij een kopje dat het lid zelf bedenkt ("eigen:<naam>"), of bij geen kopje
// (''), voor wie maar een paar regels heeft en alles op één hoop wil. Het kopje is dus de tekst categorie van de regel.
export const GEEN_KOPJE = '';
export const EIGEN_VOORVOEGSEL = 'eigen:';
const MAX_KOPJENAAM = 60;
export const EIGEN_SUGGESTIES = [['Monitoring en evaluatie', 'post'], ['Verantwoording en rapportage', 'post'], ['Accountantsverklaring', 'post'], ['Niet-verrekenbare btw', 'post'], ['Onvoorzien', 'post']];

const kopjeTekst = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();

export const isEigenKopje = (k) => typeof k === 'string' && k.startsWith(EIGEN_VOORVOEGSEL) && k.length > EIGEN_VOORVOEGSEL.length && k.length <= EIGEN_VOORVOEGSEL.length + MAX_KOPJENAAM && kopjeTekst(k) === k;
export const isKopjeSleutel = (k) => k === GEEN_KOPJE || CATEGORIE_IDS.includes(k) || isEigenKopje(k);
export const schoneKopjeSleutel = (k) => (isKopjeSleutel(k) ? k : GEEN_KOPJE);

// De sleutel van een kopje dat het lid zelf noemt; null bij een lege naam. Een naam die al bestaat (ook een vast kopje) geeft dat kopje terug.
export function eigenKopjeSleutel(naam) {
  const t = kopjeTekst(naam).slice(0, MAX_KOPJENAAM).trim();

  if (!t) return null;

  const vast = CATEGORIEEN.find((c) => c.label.toLowerCase() === t.toLowerCase());

  return vast ? vast.id : `${EIGEN_VOORVOEGSEL}${t}`;
}

export function categorieLabel(k) {
  const c = CATEGORIEEN.find((x) => x.id === k);

  if (c) return c.label;

  return isEigenKopje(k) ? k.slice(EIGEN_VOORVOEGSEL.length) : 'Overig';
}

// Alles wat een scherm van een kopje moet weten: naam, uitleg (bullets) en suggesties. Eigen kopjes hebben geen uitleg, wel algemene suggesties.
export function kopjeDef(k) {
  const c = CATEGORIEEN.find((x) => x.id === k);

  if (c) return c;

  return { id: k, label: k === GEEN_KOPJE ? '' : categorieLabel(k), toelichting: [], suggesties: k === GEEN_KOPJE ? [] : EIGEN_SUGGESTIES, eigen: isEigenKopje(k) };
}

// Een korte, veilige naam voor test- en elementnamen.
export const kopjeSlug = (k) => (k === GEEN_KOPJE ? 'zonder' : isEigenKopje(k) ? `eigen-${categorieLabel(k).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : k);
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
    categorie: schoneKopjeSleutel(categorie),
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
      categorie: schoneKopjeSleutel(r.categorie),
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

// ── Volgorde: de volgorde van de lijst is de volgorde op het scherm en in de Excel ─────────────────────────────────────────────────────
// Kopjes staan in de volgorde waarin hun eerste regel in de lijst voorkomt; lege kopjes (alleen op het scherm) komen erachter.
export function kopjeVolgorde(regels, leeg = []) {
  const uit = [];

  (Array.isArray(regels) ? regels : []).forEach((r) => {
    if (!uit.includes(r.categorie)) uit.push(r.categorie);
  });
  (Array.isArray(leeg) ? leeg : []).forEach((id) => {
    if (isKopjeSleutel(id) && !uit.includes(id)) uit.push(id);
  });

  return uit;
}

// Verplaatst één regel naar een kopje, vóór een andere regel (voorRegelId) of, zonder die, onderaan dat kopje.
export function verplaatsRegel(regels, regelId, naarCategorie, voorRegelId = null) {
  const lijst = Array.isArray(regels) ? regels : [];
  const regel = lijst.find((r) => r.id === regelId);

  if (!regel || !isKopjeSleutel(naarCategorie) || voorRegelId === regelId) return lijst;

  const rest = lijst.filter((r) => r.id !== regelId);
  const verhuisd = { ...regel, categorie: naarCategorie };
  let plek = voorRegelId ? rest.findIndex((r) => r.id === voorRegelId) : -1;

  if (plek === -1) {
    // Onderaan het kopje: na de laatste regel van dat kopje; heeft het kopje nog geen regels, dan aan het eind van de lijst.
    let laatste = -1;

    rest.forEach((r, i) => {
      if (r.categorie === naarCategorie) laatste = i;
    });
    plek = laatste === -1 ? rest.length : laatste + 1;
  }

  return [...rest.slice(0, plek), verhuisd, ...rest.slice(plek)];
}

// Eén plek omhoog of omlaag binnen het eigen kopje (voor knoppen en toetsenbord).
export function schuifRegel(regels, regelId, richting) {
  const lijst = Array.isArray(regels) ? regels : [];
  const regel = lijst.find((r) => r.id === regelId);

  if (!regel) return lijst;

  const broers = lijst.filter((r) => r.categorie === regel.categorie);
  const i = broers.findIndex((r) => r.id === regelId);
  const buur = broers[i + (richting === 'omhoog' ? -1 : 1)];

  if (!buur) return lijst;

  return richting === 'omhoog' ? verplaatsRegel(lijst, regelId, regel.categorie, buur.id) : verplaatsRegel(lijst, regelId, regel.categorie, (broers[i + 2] || {}).id || null);
}

// Verplaatst een heel kopje (met al zijn regels) vóór een ander kopje, of naar het eind.
export function verplaatsKopje(regels, categorieId, voorCategorieId = null) {
  const lijst = Array.isArray(regels) ? regels : [];
  const volgorde = kopjeVolgorde(lijst);

  if (!volgorde.includes(categorieId) || categorieId === voorCategorieId) return lijst;

  const rest = volgorde.filter((id) => id !== categorieId);
  const plek = voorCategorieId && rest.includes(voorCategorieId) ? rest.indexOf(voorCategorieId) : rest.length;
  const nieuw = [...rest.slice(0, plek), categorieId, ...rest.slice(plek)];

  return nieuw.flatMap((id) => lijst.filter((r) => r.categorie === id));
}

export function schuifKopje(regels, categorieId, richting) {
  const volgorde = kopjeVolgorde(regels);
  const i = volgorde.indexOf(categorieId);

  if (i === -1) return regels;

  if (richting === 'omhoog') return i === 0 ? regels : verplaatsKopje(regels, categorieId, volgorde[i - 1]);

  return i === volgorde.length - 1 ? regels : verplaatsKopje(regels, categorieId, volgorde[i + 2] || null);
}

// Haalt een kopje weg; de regels erin blijven staan, op dezelfde plek, zonder kopje. Er gaat dus nooit een regel verloren.
export function verwijderKopje(regels, categorieId) {
  return (Array.isArray(regels) ? regels : []).map((r) => (r.categorie === categorieId ? { ...r, categorie: GEEN_KOPJE } : r));
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

  // De volgorde van de kopjes is die van de lijst met regels: het lid bepaalt zelf wat bovenaan staat.
  kopjeVolgorde(lijst).forEach((id) => {
    const c = CATEGORIEEN.find((x) => x.id === id) || { id, label: categorieLabel(id) };
    const eigen = lijst.filter((r) => r.categorie === id);

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
      categorie: schoneKopjeSleutel(r.categorie),
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
      categorie: schoneKopjeSleutel(r.categorie),
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
