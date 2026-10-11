// Pure afleidingen voor het Dashboard van de Pro/Premium-werkruimte.
// Geen React, geen netwerk, geen eigen opslag: alles wordt berekend uit de
// bestaande bronnen (projecten, gesprekken, organisatieprofiel) zodat dit
// bestand apart getest kan worden en er nergens een tweede waarheid ontstaat.
//
// Fase 1: het dekkingsplan van een project komt nog uit het bestaande
// project.regelingen (legacy, jsonb). In Fase 2 komt daar de tabel
// subsidie_kompas_program_funding voor in de plaats; alleen
// `fundingRegelsVanProject` hoeft dan van bron te wisselen, de rest (rekenregels,
// deadlines) blijft gelijk omdat die op genormaliseerde regels werkt.

// Statussen van een dekkingsregel (zelfde waarden als de CHECK in Fase 2).
export const STATUSSEN = ['interesting', 'preparing', 'submitted', 'awarded', 'rejected'];
export const STATUS_LABEL = {
  interesting: 'Interessant',
  preparing: 'In voorbereiding',
  submitted: 'Aangevraagd',
  awarded: 'Toegekend',
  rejected: 'Afgewezen',
};
// Alleen regels in deze statussen tellen mee als "komende deadline".
export const ACTIEVE_STATUSSEN = ['interesting', 'preparing'];

// Legacy plan-status (project.regelingen[].plan) -> nieuwe status.
export const PLAN_NAAR_STATUS = {
  Gepland: 'preparing',
  Aangevraagd: 'submitted',
  Toegekend: 'awarded',
  Afgewezen: 'rejected',
};

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Bedrag uit een getal of NL-getypte tekst ("€ 85.000", "85000", "85.000,50").
// Ongeldig of negatief -> 0. Nooit NaN.
export function naarBedrag(v) {
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  const s = String(v == null ? '' : v).replace(/[€\s]/g, '');

  if (!s) {
    return 0;
  }

  let n;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    n = Number(s.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d+,\d+$/.test(s)) {
    n = Number(s.replace(',', '.'));
  } else if (/^\d+(\.\d+)?$/.test(s)) {
    n = Number(s);
  } else {
    const cijfers = s.replace(/[^0-9]/g, '');

    n = cijfers ? Number(cijfers) : 0;
  }

  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatEuro(n) {
  return `€ ${Math.round(Number(n) || 0).toLocaleString('nl-NL')}`;
}

// 'YYYY-MM-DD' (ook als er een tijd achter staat) -> {y,m,d} of null bij een
// ongeldige datum.
function leesDatum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));

  if (!m) {
    return null;
  }

  const y = Number(m[1]);
  const mnd = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mnd - 1, d));

  return t.getUTCFullYear() === y && t.getUTCMonth() === mnd - 1 && t.getUTCDate() === d ? { y, m: mnd, d } : null;
}

// De lokale kalenderdatum van `nu` als {y,m,d}.
function lokaleDatum(nu) {
  const dt = nu instanceof Date ? nu : new Date(nu || Date.now());

  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

const dagnummer = (x) => Date.UTC(x.y, x.m - 1, x.d) / 86400000;

// Aantal kalenderdagen tot een datum (0 = vandaag, negatief = verstreken);
// null bij een ontbrekende of ongeldige datum.
export function dagenTot(iso, nu) {
  const doel = leesDatum(iso);

  return doel ? Math.round(dagnummer(doel) - dagnummer(lokaleDatum(nu))) : null;
}

export function formatDatum(iso) {
  const x = leesDatum(iso);

  return x ? `${x.d} ${MAANDEN[x.m - 1]} ${x.y}` : '';
}

// "vandaag", "morgen", "over 5 dagen" (verstreken: "verstreken").
export function dagenTekst(dagen) {
  if (dagen == null) return '';
  if (dagen < 0) return 'verstreken';
  if (dagen === 0) return 'vandaag';
  if (dagen === 1) return 'morgen';

  return `over ${dagen} dagen`;
}

// Korte, leesbare tijd voor een tijdstempel: Vandaag / Gisteren / 12 okt.
export function formatTijd(tijdstempel, nu) {
  const t = new Date(tijdstempel || '');

  if (!tijdstempel || Number.isNaN(t.getTime())) {
    return '';
  }

  const verschil = Math.round(dagnummer(lokaleDatum(nu)) - dagnummer(lokaleDatum(t)));

  if (verschil === 0) return 'Vandaag';
  if (verschil === 1) return 'Gisteren';

  return `${t.getDate()} ${MAANDEN[t.getMonth()]}${t.getFullYear() !== lokaleDatum(nu).y ? ` ${t.getFullYear()}` : ''}`;
}

// ---------------------------------------------------------------------------
// Dekkingsplan
// ---------------------------------------------------------------------------

// Genormaliseerde regels uit het (legacy) dekkingsplan van een project.
// Regel: { sleutel, projectId, naam, funder, status, requested, awarded, deadline, reminder }.
export function fundingRegelsVanProject(project) {
  const lijst = Array.isArray(project && project.regelingen) ? project.regelingen : [];

  return lijst.map((r, i) => {
    const requested = naarBedrag(r && r.aangevraagd);

    return {
      sleutel: `${project.id}:${r && r.id != null ? r.id : i}`,
      projectId: project.id,
      naam: (r && r.naam) || 'Regeling',
      funder: (r && r.funder) || '',
      status: PLAN_NAAR_STATUS[r && r.plan] || 'preparing',
      requested,
      // Legacy kent één bedrag per regel; bij Toegekend geldt dat als toegekend.
      awarded: null,
      deadline: (r && r.deadline) || null,
      reminder: !(r && r.herinner === false),
    };
  });
}

// Overige dekking uit het projectmodel: eigen bijdrage plus toegezegde
// co-financiers. Eerdere subsidies tellen bewust niet mee.
export function overigeDekkingVanProject(project) {
  const cofin = Array.isArray(project && project.cofin) ? project.cofin : [];

  return (
    naarBedrag(project && project.eigenBijdrage) +
    cofin.filter((x) => x && x.status === 'Toegezegd').reduce((t, x) => t + naarBedrag(x.bedrag), 0)
  );
}

// De rekenregels van de werkruimte:
//   Toegekend      = som toegekend bedrag (terugval: gevraagd bedrag) bij status awarded
//   Aangevraagd    = som gevraagd bedrag bij status submitted
//   Nog te financieren = max(0, begroting - toegekend - aangevraagd - overige dekking)
// Nooit een negatief bedrag; bij overdekking schalen de balksegmenten naar 100%.
export function berekenDekking({ begroting, regels, overige }) {
  const budget = naarBedrag(begroting);
  const lijst = Array.isArray(regels) ? regels : [];
  const toegekend = lijst
    .filter((r) => r.status === 'awarded')
    .reduce((t, r) => t + (r.awarded != null && r.awarded !== '' ? naarBedrag(r.awarded) : naarBedrag(r.requested)), 0);
  const aangevraagd = lijst.filter((r) => r.status === 'submitted').reduce((t, r) => t + naarBedrag(r.requested), 0);
  const overig = naarBedrag(overige);
  const gedekt = toegekend + aangevraagd + overig;
  const nogNodig = Math.max(0, budget - gedekt);
  const factor = budget > 0 && gedekt > budget ? budget / gedekt : 1;
  const pct = (n) => (budget > 0 ? Math.round(((n * factor) / budget) * 10000) / 100 : 0);

  return {
    heeftBegroting: budget > 0,
    begroting: budget,
    toegekend,
    aangevraagd,
    overige: overig,
    nogNodig,
    volledigGedekt: budget > 0 && gedekt >= budget,
    segmenten: {
      toegekend: pct(toegekend),
      aangevraagd: pct(aangevraagd),
      overige: pct(overig),
      nogNodig: budget > 0 ? Math.max(0, Math.round((100 - pct(toegekend) - pct(aangevraagd) - pct(overig)) * 100) / 100) : 0,
    },
  };
}

export function dekkingVanProject(project) {
  return berekenDekking({
    begroting: project && project.begroting,
    regels: fundingRegelsVanProject(project || {}),
    overige: overigeDekkingVanProject(project || {}),
  });
}

// ---------------------------------------------------------------------------
// Deadlines
// ---------------------------------------------------------------------------

// Een actieve regel (interesting/preparing) met een deadline die vandaag of
// later valt. Verstreken deadlines en regels die al aangevraagd, toegekend of
// afgewezen zijn tellen nooit mee als "komend".
export function isKomendeDeadline(regel, nu) {
  if (!regel || ACTIEVE_STATUSSEN.indexOf(regel.status) === -1) {
    return false;
  }

  const dagen = dagenTot(regel.deadline, nu);

  return dagen != null && dagen >= 0;
}

export function eerstvolgendeDeadline(regels, nu) {
  const komend = (regels || [])
    .filter((r) => isKomendeDeadline(r, nu))
    .sort((a, b) => String(a.deadline).slice(0, 10).localeCompare(String(b.deadline).slice(0, 10)) || String(a.naam).localeCompare(String(b.naam), 'nl'));

  return komend[0] ? { datum: String(komend[0].deadline).slice(0, 10), dagen: dagenTot(komend[0].deadline, nu), naam: komend[0].naam } : null;
}

export function komendeDeadlines(projecten, nu, max = 6) {
  const uit = [];

  (projecten || [])
    .filter((p) => p && !p.gearchiveerd)
    .forEach((p) => {
      fundingRegelsVanProject(p).forEach((r) => {
        if (isKomendeDeadline(r, nu)) {
          uit.push({
            sleutel: r.sleutel,
            datum: String(r.deadline).slice(0, 10),
            dagen: dagenTot(r.deadline, nu),
            naam: r.naam,
            funder: r.funder,
            status: r.status,
            projectId: p.id,
            projectNaam: p.naam || 'Naamloos project',
          });
        }
      });
    });

  return uit.sort((a, b) => a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam, 'nl')).slice(0, max);
}

// ---------------------------------------------------------------------------
// Gesprekken, documenten, organisatie
// ---------------------------------------------------------------------------

export function recenteGesprekken(gesprekken, projecten, max = 5) {
  const naamVan = new Map((projecten || []).map((p) => [p.id, p.naam || 'Naamloos project']));

  return (gesprekken || [])
    .filter((g) => g && g.id)
    .slice()
    .sort((a, b) => String(b.tijd || '').localeCompare(String(a.tijd || '')))
    .slice(0, max)
    .map((g) => ({
      id: g.id,
      titel: g.titel || 'Gesprek',
      tijd: g.tijd || null,
      projectId: g.projectId || null,
      projectNaam: g.projectId && naamVan.has(g.projectId) ? naamVan.get(g.projectId) : null,
    }));
}

export function recenteDocumenten(projecten, max = 5) {
  const uit = [];

  (projecten || [])
    .filter((p) => p && !p.gearchiveerd)
    .forEach((p) => {
      (p.docs || [])
        .filter((d) => d && !d.vervangen)
        .forEach((d) => {
          uit.push({
            id: d.id,
            naam: d.naam || 'Document',
            soort: d.soort || 'Overig',
            versie: d.versie || 1,
            gemaakt: d.gemaakt || null,
            projectId: p.id,
            projectNaam: p.naam || 'Naamloos project',
          });
        });
    });

  return uit.sort((a, b) => String(b.gemaakt || '').localeCompare(String(a.gemaakt || ''))).slice(0, max);
}

// De kernvelden van het organisatieprofiel waar matching het meest op leunt.
export const ORGANISATIE_KERNVELDEN = [
  { n: 'name', l: 'Organisatienaam' },
  { n: 'website', l: 'Website' },
  { n: 'rechtsvorm', l: 'Rechtsvorm' },
  { n: 'kvk', l: 'KvK-nummer' },
  { n: 'mission', l: 'Missie' },
  { n: 'regio', l: 'Werkgebied' },
  { n: 'themas', l: 'Disciplines' },
  { n: 'doelgroepen', l: 'Doelgroepen' },
];

const isLeeg = (v) => (Array.isArray(v) ? v.length === 0 : !String(v == null ? '' : v).trim());

export function organisatieVolledigheid(profiel) {
  const p = profiel || {};
  const ontbreekt = ORGANISATIE_KERNVELDEN.filter((v) => isLeeg(p[v.n])).map((v) => v.l);
  const totaal = ORGANISATIE_KERNVELDEN.length;
  const ingevuld = totaal - ontbreekt.length;

  return {
    naam: String(p.name || '').trim(),
    ingevuld,
    totaal,
    pct: Math.round((ingevuld / totaal) * 100),
    ontbreekt,
  };
}

// ---------------------------------------------------------------------------
// Alles voor het Dashboard in één keer.
// ---------------------------------------------------------------------------

export function bouwDashboard({ projects, conversations, orgProfile, nu }) {
  const actief = (projects || []).filter((p) => p && !p.gearchiveerd);

  return {
    projecten: actief.map((p) => {
      const regels = fundingRegelsVanProject(p);

      return {
        id: p.id,
        naam: p.naam || 'Naamloos project',
        locatie: p.regio || '',
        periode: [p.periodeVan, p.periodeTot].filter(Boolean).join(' – '),
        dekking: dekkingVanProject(p),
        volgendeDeadline: eerstvolgendeDeadline(regels, nu),
        aantalRegels: regels.length,
      };
    }),
    deadlines: komendeDeadlines(actief, nu),
    gesprekken: recenteGesprekken(conversations, projects, 5),
    documenten: recenteDocumenten(actief, 5),
    organisatie: organisatieVolledigheid(orgProfile),
  };
}
