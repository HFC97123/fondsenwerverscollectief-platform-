// Projectfinanciering: de ENIGE rekenmodule voor het dekkingsplan van een project.
// Dashboard, projectdossier en de tab Projectfinanciering gebruiken uitsluitend dit bestand,
// zodat er nergens een tweede waarheid of een tweede berekening ontstaat.
//
// Pure functies: geen React, geen netwerk, geen opslag. Invoer:
//   - het project (subsidie_kompas_programs, via projecten.js): begroting en eigenBijdrage
//   - de regels uit subsidie_kompas_program_funding, zoals kompas_dekkingsplan() ze teruggeeft
//     (al gemaskeerd naar het abonnement; zie regelUitRpc)
// Geen tekst-heuristiek: projectbedragen komen uit numerieke databasekolommen, en de enige
// tekst die hier wordt omgezet (invoer van een bedrag door het lid) wordt strikt gevalideerd.

// ---------------------------------------------------------------------------
// Statussen
// ---------------------------------------------------------------------------
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

export const LABEL_BRON_VERBORGEN = 'Premium-fonds, niet zichtbaar in uw abonnement';
export const LABEL_BRON_VERWIJDERD = 'Bron niet meer beschikbaar';

// ---------------------------------------------------------------------------
// Bedragen
// ---------------------------------------------------------------------------

// Een projectbedrag (begroting, eigen bijdrage): numerieke databasekolom. In de staat van de app
// kan het na bewerken nog de getypte tekst van het formulier zijn; die wordt dan exact zo
// omgezet als bij het bewaren (projecten.js getal(): alleen de cijfers). Ongeldig/negatief -> 0.
export function projectBedrag(v) {
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  const cijfers = String(v == null ? '' : v).replace(/[^0-9]/g, '');
  const n = cijfers ? Number(cijfers) : 0;

  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Een bedrag van een financieringsregel (numeric uit de database): getal of null.
export function regelBedrag(v) {
  if (v == null || v === '') {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Invoer van een bedrag door het lid. Strikt: leeg, "12500", "12.500", "€ 12.500", "12.500,50",
// "12500,5". Alles anders is ongeldig (geen raden). -> { ok, waarde } waarde = getal of null.
export function leesBedragInvoer(tekst) {
  const s = String(tekst == null ? '' : tekst).replace(/\s+/g, '').replace(/^€/, '');

  if (s === '') {
    return { ok: true, waarde: null };
  }

  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(s)) {
    return { ok: false, waarde: null };
  }

  const n = Number(s.replace(/\./g, '').replace(',', '.'));

  return Number.isFinite(n) && n >= 0 && n < 1e12 ? { ok: true, waarde: n } : { ok: false, waarde: null };
}

export function formatEuro(n) {
  return `€ ${Math.round(Number(n) || 0).toLocaleString('nl-NL')}`;
}

// Bedrag voor in een invoerveld (zonder €): 12500 -> "12.500".
export function bedragVoorInvoer(n) {
  return n == null ? '' : Number(n).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Datums (kalenderdagen, lokale tijd)
// ---------------------------------------------------------------------------
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAANDEN_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

// 'YYYY-MM-DD' (ook met een tijd erachter) -> {y,m,d}, of null bij een ongeldige datum.
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

function lokaleDatum(nu) {
  const dt = nu instanceof Date ? nu : new Date(nu || Date.now());

  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

const dagnummer = (x) => Date.UTC(x.y, x.m - 1, x.d) / 86400000;

// Aantal kalenderdagen tot een datum (0 = vandaag, negatief = verstreken); null bij een
// ontbrekende of ongeldige datum.
export function dagenTot(iso, nu) {
  const doel = leesDatum(iso);

  return doel ? Math.round(dagnummer(doel) - dagnummer(lokaleDatum(nu))) : null;
}

export function formatDatum(iso) {
  const x = leesDatum(iso);

  return x ? `${x.d} ${MAANDEN[x.m - 1]} ${x.y}` : '';
}

// "12 november" (zonder jaar), voor de vergelijking "Uw datum / Regeling".
export function formatDatumLang(iso) {
  const x = leesDatum(iso);

  return x ? `${x.d} ${MAANDEN_LANG[x.m - 1]}` : '';
}

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
// Een regel uit kompas_dekkingsplan() -> de vorm waarmee de UI werkt
// ---------------------------------------------------------------------------
// bronStatus: 'zichtbaar' | 'verborgen' (buiten het abonnement) | 'verwijderd' (bron bestaat niet meer).
// Bij 'verborgen' en 'verwijderd' zijn naam, fonds, website en systeemdeadline leeg; de eigen
// velden (bedragen, status, eigen deadline, herinnering, notitie) zijn er altijd.
export function regelUitRpc(rij) {
  const r = rij || {};
  const bronStatus = r.bron_status === 'verborgen' || r.bron_status === 'verwijderd' ? r.bron_status : 'zichtbaar';
  const naam = bronStatus === 'verborgen' ? LABEL_BRON_VERBORGEN : bronStatus === 'verwijderd' ? LABEL_BRON_VERWIJDERD : r.bron_naam || 'Onbekende bron';

  return {
    id: r.id,
    projectId: r.program_id,
    bronType: r.bron_type || null,
    bronStatus,
    schemeId: bronStatus === 'zichtbaar' ? r.scheme_id || null : null,
    funderId: bronStatus === 'zichtbaar' ? r.funder_id || null : null,
    naam,
    funder: bronStatus === 'zichtbaar' ? r.funder_naam || '' : '',
    website: bronStatus === 'zichtbaar' ? r.website || '' : '',
    systeemDeadline: bronStatus === 'zichtbaar' ? r.systeem_deadline || null : null,
    systeemDeadlineBron: bronStatus === 'zichtbaar' ? r.systeem_deadline_bron || null : null,
    requested: regelBedrag(r.requested_amount),
    awarded: regelBedrag(r.awarded_amount),
    status: STATUSSEN.indexOf(r.status) !== -1 ? r.status : 'interesting',
    eigenDeadline: r.eigen_deadline || null,
    // Effectieve deadline: de eigen datum van het lid, anders de live datum van de bron. Nooit een snapshot.
    // Bij een verborgen of verwijderde bron telt alleen de eigen datum (de server stuurt dan geen brondatum;
    // ook als dat ooit wel zou gebeuren, lekt het hier niet door).
    deadline: bronStatus === 'zichtbaar' ? r.effectieve_deadline || r.eigen_deadline || null : r.eigen_deadline || null,
    reminder: r.reminder_enabled !== false,
    notitie: r.notes || '',
    gemaakt: r.created_at || null,
  };
}

// "Uw datum: 12 november / Regeling: 15 november" alleen als beide er zijn en verschillen.
export function deadlineVergelijking(regel) {
  if (!regel || !regel.eigenDeadline || !regel.systeemDeadline) {
    return null;
  }

  if (String(regel.eigenDeadline).slice(0, 10) === String(regel.systeemDeadline).slice(0, 10)) {
    return null;
  }

  return {
    eigen: formatDatumLang(regel.eigenDeadline),
    systeem: formatDatumLang(regel.systeemDeadline),
    bronLabel: regel.systeemDeadlineBron === 'fonds' ? 'Fonds' : regel.systeemDeadlineBron === 'ronde' ? 'Eerstvolgende ronde' : 'Regeling',
  };
}

// ---------------------------------------------------------------------------
// Dekking
// ---------------------------------------------------------------------------

// Overige dekking = eigen bijdrage (numerieke projectkolom). Co-financiers (project.cofin) zijn
// vrije tekst met een getypt bedrag en dus niet betrouwbaar kwantitatief: die tellen NIET mee.
// Het aantal niet-meegetelde co-financiers wordt wel gemeld zodat de UI dat eerlijk kan tonen.
export function overigeDekkingVanProject(project) {
  return projectBedrag(project && project.eigenBijdrage);
}

export function aantalNietMeegetelleCofinanciers(project) {
  const cofin = Array.isArray(project && project.cofin) ? project.cofin : [];

  return cofin.filter((x) => x && (String(x.naam || '').trim() || String(x.bedrag == null ? '' : x.bedrag).trim())).length;
}

// De rekenregels:
//   Toegekend          = som van awarded_amount (terugval: requested_amount) bij status awarded
//   Aangevraagd        = som van requested_amount bij status submitted
//   Overige dekking    = eigen bijdrage
//   Nog te financieren = max(0, begroting - toegekend - aangevraagd - overige dekking), nooit negatief
// Bij overdekking worden de balksegmenten naar 100% geschaald.
export function berekenDekking({ begroting, regels, overige }) {
  const budget = projectBedrag(begroting);
  const lijst = Array.isArray(regels) ? regels : [];
  // Defensief genormaliseerd: een leeg of ongeldig bedrag is "niet ingevuld" (null), nooit 0 of NaN.
  const bedragen = lijst.filter(Boolean).map((r) => ({ status: r.status, awarded: regelBedrag(r.awarded), requested: regelBedrag(r.requested) }));
  const toegekend = bedragen
    .filter((r) => r.status === 'awarded')
    .reduce((t, r) => t + (r.awarded != null ? r.awarded : r.requested != null ? r.requested : 0), 0);
  const aangevraagd = bedragen.filter((r) => r.status === 'submitted').reduce((t, r) => t + (r.requested != null ? r.requested : 0), 0);
  const overig = projectBedrag(overige);
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

export function dekkingVanProject(project, regels) {
  return {
    ...berekenDekking({
      begroting: project && project.begroting,
      regels: regels || [],
      overige: overigeDekkingVanProject(project || {}),
    }),
    cofinNietMeegeteld: aantalNietMeegetelleCofinanciers(project || {}),
  };
}

// ---------------------------------------------------------------------------
// Deadlines (effectieve deadline van de regel: eigen datum of live brondatum)
// ---------------------------------------------------------------------------

// Een actieve regel (interessant/in voorbereiding) met een deadline vandaag of later.
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

// Komende deadlines over meerdere projecten. fundingPerProject = { [projectId]: regels[] }.
export function komendeDeadlines(projecten, fundingPerProject, nu, max = 6) {
  const uit = [];

  (projecten || [])
    .filter((p) => p && !p.gearchiveerd)
    .forEach((p) => {
      ((fundingPerProject && fundingPerProject[p.id]) || []).forEach((r) => {
        if (isKomendeDeadline(r, nu)) {
          uit.push({
            sleutel: r.id,
            datum: String(r.deadline).slice(0, 10),
            dagen: dagenTot(r.deadline, nu),
            naam: r.naam,
            funder: r.funder,
            status: r.status,
            reminder: r.reminder !== false,
            projectId: p.id,
            projectNaam: p.naam || 'Naamloos project',
          });
        }
      });
    });

  return uit.sort((a, b) => a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam, 'nl')).slice(0, max);
}

// ---------------------------------------------------------------------------
// Wijzigingen: alleen de velden die het lid mag aanpassen, in databasenamen.
// ---------------------------------------------------------------------------
const TOEGESTANE_VELDEN = {
  requested: 'requested_amount',
  awarded: 'awarded_amount',
  status: 'status',
  eigenDeadline: 'eigen_deadline',
  reminder: 'reminder_enabled',
  notitie: 'notes',
};

export function patchVoorDatabase(wijziging) {
  const uit = {};

  Object.keys(wijziging || {}).forEach((k) => {
    if (!TOEGESTANE_VELDEN[k]) {
      return;
    }

    const w = wijziging[k];

    if (k === 'status') {
      if (STATUSSEN.indexOf(w) !== -1) uit.status = w;
    } else if (k === 'reminder') {
      uit.reminder_enabled = Boolean(w);
    } else if (k === 'eigenDeadline') {
      uit.eigen_deadline = w ? String(w).slice(0, 10) : null;
    } else if (k === 'notitie') {
      uit.notes = String(w || '').trim() ? String(w).slice(0, 4000) : null;
    } else {
      uit[TOEGESTANE_VELDEN[k]] = regelBedrag(w);
    }
  });

  return uit;
}

// De regel zoals de UI hem na een geslaagde wijziging toont (zonder opnieuw te laden):
// alleen de velden van het lid, en de effectieve deadline opnieuw afgeleid (eigen datum wint).
export function pasWijzigingToe(regel, wijziging) {
  const w = wijziging || {};
  const volgende = { ...regel };

  if ('requested' in w) volgende.requested = regelBedrag(w.requested);
  if ('awarded' in w) volgende.awarded = regelBedrag(w.awarded);
  if ('status' in w && STATUSSEN.indexOf(w.status) !== -1) volgende.status = w.status;
  if ('eigenDeadline' in w) volgende.eigenDeadline = w.eigenDeadline ? String(w.eigenDeadline).slice(0, 10) : null;
  if ('reminder' in w) volgende.reminder = Boolean(w.reminder);
  if ('notitie' in w) volgende.notitie = String(w.notitie || '').trim() ? String(w.notitie).slice(0, 4000) : '';

  volgende.deadline = volgende.eigenDeadline || volgende.systeemDeadline || null;

  return volgende;
}
