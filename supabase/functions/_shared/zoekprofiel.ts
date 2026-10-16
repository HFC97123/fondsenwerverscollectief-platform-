// Gestructureerd zoekprofiel: de ENE vorm waarin beide routes (chatbot en project) hun zoekkaders aan de matching geven. ZUIVER: geen database,
// geen netwerk, geen taalmodel; de aanroeper levert de gelezen projectvelden, de taxonomie en (optioneel) de uitkomst van de AI-extractie.
//
// Uitgangspunten:
//   - Wat het lid zelf in het project invulde (en in de taxonomie bestaat) gaat voor; de AI vult alleen aan en wordt als zodanig gemarkeerd.
//   - Er zijn drie databasecategorieën: themas (disciplines én werkvelden: er is geen aparte werkveldtabel), doelgroepen en regios. De kern
//     (waar het project echt over gaat) heet "discipline", de overige gekoppelde thema's heten "werkvelden".
//   - Wat niet exact aan een categorie te koppelen is, valt NIET stil weg: het staat als "onzeker" in het profiel, met reden.
//   - Het profiel kan door het lid worden aangepast; de server controleert een teruggestuurd profiel opnieuw tegen de taxonomie.

export type ProfielBron = 'project' | 'gesprek' | 'ai';

export interface ProfielItem {
  naam: string;
  bron: ProfielBron;
}

export interface Onzeker {
  soort: 'discipline' | 'doelgroep' | 'werkgebied' | 'periode' | 'financiering' | 'overig';
  term: string;
  reden: string;
}

export interface Zoekprofiel {
  versie: 1;
  route: 'project' | 'chat';
  omschrijving: string;
  trefwoorden: string[];
  disciplines: ProfielItem[];
  werkvelden: ProfielItem[];
  doelgroepen: ProfielItem[];
  werkgebieden: ProfielItem[];
  locatie: string;
  periode: { start: string | null; eind: string | null; bron: ProfielBron | null };
  financieringsbehoefte: { gat: number | null; totaalBudget: number | null; eigenBijdrage: number | null; bekend: boolean };
  aanvragertype: string;
  ontbrekend: string[];
  onzeker: Onzeker[];
  vragen: string[];
  bronnen: { projectvelden: boolean; documenten: number; gesprek: boolean; ai: 'gebruikt' | 'niet-beschikbaar' | 'mislukt' };
  voldoende: boolean;
}

export interface Taxonomie {
  themas: string[];
  doelgroepen: string[];
  regios: string[];
}

export interface AiUitkomst {
  themas: string[];
  kernThemas: string[];
  doelgroepen: string[];
  regios: string[];
  locatie: string;
  trefwoorden: string[];
  aanvragertype: string;
  periodeStart: string | null;
  periodeEind: string | null;
  // Termen die het model noemde maar die geen exacte databasecategorie zijn (door de server berekend uit het ruwe antwoord).
  nietGekoppeld: Array<{ soort: Onzeker['soort']; term: string }>;
}

const norm = (t: unknown): string => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const schoon = (t: unknown, max: number): string => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isDatum = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`));
const getal = (x: unknown): number => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : Number.NaN);
const positief = (x: unknown): number | null => {
  const n = getal(x);

  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

// Exacte (hoofdletter- en accentongevoelige) koppeling aan een categorie; geeft de canonieke naam.
export function koppel(waarde: unknown, lijst: readonly string[]): string | null {
  const w = norm(waarde);

  return w ? lijst.find((n) => norm(n) === w) ?? null : null;
}

// Een kommagescheiden projectveld ("Muziek, Cultuur") -> gekoppelde namen + wat niet te koppelen was.
export function splitsProjectveld(veld: unknown, lijst: readonly string[]): { gekoppeld: string[]; nietGekoppeld: string[] } {
  const gekoppeld: string[] = [];
  const niet: string[] = [];

  for (const deel of String(veld ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 24)) {
    const c = koppel(deel, lijst);

    if (c) {
      if (!gekoppeld.includes(c)) gekoppeld.push(c);
    } else if (!niet.includes(deel)) {
      niet.push(deel.slice(0, 80));
    }
  }

  return { gekoppeld, nietGekoppeld: niet };
}

export interface ProfielInvoer {
  route: 'project' | 'chat';
  project: {
    name?: unknown;
    description?: unknown;
    goals?: unknown;
    activities?: unknown;
    location?: unknown;
    target_groups?: unknown;
    themes?: unknown;
    period_start?: unknown;
    period_end?: unknown;
    budget_total?: unknown;
    own_contribution?: unknown;
  };
  gat: number | null;
  taxonomie: Taxonomie;
  ai: AiUitkomst | null;
  aiStatus: 'gebruikt' | 'niet-beschikbaar' | 'mislukt';
  documenten: number;
  gesprek: boolean;
}

export function bouwZoekprofiel(inv: ProfielInvoer): Zoekprofiel {
  const p = inv.project ?? {};
  const t = inv.taxonomie;
  const ai = inv.ai;
  const onzeker: Onzeker[] = [];
  const aiBron: ProfielBron = inv.gesprek ? 'gesprek' : 'ai';
  const voegSamen = (eigen: string[], extra: string[] | undefined): ProfielItem[] => {
    const uit: ProfielItem[] = eigen.map((naam) => ({ naam, bron: 'project' as const }));

    for (const n of extra ?? []) if (!uit.some((x) => x.naam === n)) uit.push({ naam: n, bron: aiBron });

    return uit;
  };

  const th = splitsProjectveld(p.themes, t.themas);
  const dg = splitsProjectveld(p.target_groups, t.doelgroepen);
  const rg = splitsProjectveld(p.location, t.regios);

  for (const x of th.nietGekoppeld) onzeker.push({ soort: 'discipline', term: x, reden: 'Staat bij het project, maar is geen discipline in de database; niet gebruikt voor het zoeken.' });
  for (const x of dg.nietGekoppeld) onzeker.push({ soort: 'doelgroep', term: x, reden: 'Staat bij het project, maar is geen doelgroep in de database; niet gebruikt voor het zoeken.' });
  // Een vrije locatie ("Rotterdam-Zuid") is geen fout; ze blijft als tekst bruikbaar, maar de geografische toets mist dan een regio.
  const locatieTekst = schoon(p.location, 80) || (ai ? schoon(ai.locatie, 80) : '');

  if (ai) {
    for (const x of ai.nietGekoppeld) onzeker.push({ soort: x.soort, term: schoon(x.term, 80), reden: 'Het project noemt dit, maar er is geen exact passende categorie in de database; niet gebruikt voor het zoeken.' });
  }

  // Kern = waar het project echt over gaat. Zonder AI-oordeel: de eerste drie gekoppelde projectthema's.
  const alleThemas = voegSamen(th.gekoppeld, ai?.themas);
  const kernNamen = new Set<string>(ai?.kernThemas?.length ? ai.kernThemas : th.gekoppeld.slice(0, 3));
  const disciplines = alleThemas.filter((x) => kernNamen.has(x.naam));
  const werkvelden = alleThemas.filter((x) => !kernNamen.has(x.naam));
  const doelgroepen = voegSamen(dg.gekoppeld, ai?.doelgroepen);
  const werkgebieden = voegSamen(rg.gekoppeld, ai?.regios);
  const start = isDatum(p.period_start) ? (p.period_start as string) : ai?.periodeStart && isDatum(ai.periodeStart) ? ai.periodeStart : null;
  const eind = isDatum(p.period_end) ? (p.period_end as string) : ai?.periodeEind && isDatum(ai.periodeEind) ? ai.periodeEind : null;
  const periodeBron: ProfielBron | null = isDatum(p.period_start) || isDatum(p.period_end) ? 'project' : start || eind ? aiBron : null;
  const totaal = positief(p.budget_total);
  const eigen = positief(p.own_contribution);
  const gat = inv.gat != null && inv.gat > 0 ? Math.round(inv.gat) : null;
  const omschrijving = schoon([p.description, p.goals, p.activities].map((x) => schoon(x, 400)).filter(Boolean).join(' '), 700);
  const trefwoorden: string[] = [];

  for (const w of ai?.trefwoorden ?? []) {
    const s = schoon(w, 30).toLowerCase();

    if (s.length >= 3 && !trefwoorden.includes(s) && trefwoorden.length < 10) trefwoorden.push(s);
  }

  const ontbrekend: string[] = [];

  if (!disciplines.length && !werkvelden.length) ontbrekend.push('disciplines');
  if (!doelgroepen.length) ontbrekend.push('doelgroepen');
  if (!werkgebieden.length && !locatieTekst) ontbrekend.push('werkgebied');
  else if (!werkgebieden.length) onzeker.push({ soort: 'werkgebied', term: locatieTekst, reden: 'De locatie is niet aan een regio in de database gekoppeld; de geografische voorwaarden van financiers worden daardoor niet getoetst.' });
  if (!start && !eind) ontbrekend.push('periode');
  if (!totaal && !gat) ontbrekend.push('financieringsbehoefte');
  if (!omschrijving) ontbrekend.push('omschrijving');

  const vraag: Record<string, string> = {
    disciplines: 'Binnen welke discipline of welk werkveld valt het project (bijvoorbeeld muziek, onderwijs, armoedebestrijding)?',
    doelgroepen: 'Voor welke doelgroep is het project bedoeld (bijvoorbeeld jongeren, ouderen, mensen in armoede)?',
    werkgebied: 'Waar vindt het project plaats (plaats, provincie of landelijk)?',
    periode: 'Wat zijn de start- en einddatum van het project?',
    financieringsbehoefte: 'Wat is de totale begroting en welk deel zoekt u bij fondsen?',
    omschrijving: 'Kunt u het project in een paar zinnen omschrijven?',
  };
  const volgorde = ['disciplines', 'doelgroepen', 'werkgebied', 'periode', 'financieringsbehoefte', 'omschrijving'];
  const vragen = volgorde.filter((k) => ontbrekend.includes(k)).slice(0, 3).map((k) => vraag[k]);

  return {
    versie: 1,
    route: inv.route,
    omschrijving,
    trefwoorden,
    disciplines,
    werkvelden,
    doelgroepen,
    werkgebieden,
    locatie: locatieTekst,
    periode: { start, eind, bron: periodeBron },
    financieringsbehoefte: { gat, totaalBudget: totaal, eigenBijdrage: eigen, bekend: Boolean(gat || totaal) },
    aanvragertype: ai?.aanvragertype && ai.aanvragertype !== 'onbekend' ? ai.aanvragertype : 'onbekend',
    ontbrekend,
    onzeker: onzeker.slice(0, 30),
    vragen,
    bronnen: { projectvelden: true, documenten: inv.documenten, gesprek: inv.gesprek, ai: inv.aiStatus },
    voldoende: Boolean(disciplines.length || werkvelden.length || doelgroepen.length),
  };
}

// Het door het lid bevestigde profiel -> de ruwe criteria die leesFondsCriteria tegen de taxonomie controleert. Wat daar niet in past valt
// af, en de server meldt dat terug; een profiel kan dus nooit een categorie verzinnen.
export function profielNaarCriteriaRuw(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const p = raw as Record<string, unknown>;
  const namen = (x: unknown): string[] => (Array.isArray(x) ? x : []).map((i) => (i && typeof i === 'object' ? (i as Record<string, unknown>).naam : i)).filter((n): n is string => typeof n === 'string').slice(0, 24);
  const disciplines = namen(p.disciplines);
  const werkvelden = namen(p.werkvelden);

  return {
    themas: [...disciplines, ...werkvelden],
    kern_themas: disciplines,
    doelgroepen: namen(p.doelgroepen),
    regios: namen(p.werkgebieden),
    locatie: schoon(p.locatie, 80),
    gevraagd_bedrag: null,
    totaal_budget: null,
    doel_termen: (Array.isArray(p.trefwoorden) ? p.trefwoorden : []).filter((x): x is string => typeof x === 'string').slice(0, 6),
    aanvragertype: 'onbekend',
    activiteiten: [],
  };
}
