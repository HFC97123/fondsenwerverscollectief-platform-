// Zuiver view-model voor de voorstelpreview (Fase C). Zet het antwoord van de SERVER om naar wat de interface toont.
// ZUIVER: geen imports behalve de gedeelde, zuivere modules; geen netwerk, geen opslag.
//
// Regels die hier gelden:
//  - De client BEPAALT geen verificatiestatus. De status komt uit de metadata van de server en wordt via verificatieWeergave()
//    (gedeeld contract) alleen vertaald naar labels.
//  - Alleen NEERWAARTS corrigeren: een status die intern tegenspreekt (bijv. "geverifieerd" met een conflictveld of zonder bevestigde
//    fondsnaam of deadline) wordt als "niet gecontroleerd" getoond. Nooit opwaarderen.
//  - Fail-safe: elk onverwacht antwoord geeft { ok: false }. Er wordt dan nergens een verificatielabel getoond.
//  - De deadline van het contract (status 'geverifieerd' = citaatcontrole) wordt nooit als verificatie getoond; alleen als
//    "volgens onze database".
import { BRON_SOORT, GEEN_BRONCONTROLE, VELD_LABEL, VERIFICATIE_LABEL, VERIFICATIE_STATUS, verificatieWeergave } from './voorstel.js';
import { formatDatum, formatEuro } from './dekkingsplan.js';

export const PREVIEW_FOUT = 'Het voorstel kan nu niet worden gecontroleerd en getoond. Er is niets opgeslagen. Probeer het later opnieuw.';

export const VELD_VOLGORDE = Object.keys(VELD_LABEL);
const KERNVELDEN = ['Fondsnaam', 'Deadline', 'Minimale bijdrage', 'Maximale bijdrage'];

const REDEN_TEKST = {
  geen_toegang_tot_details: 'Van dit fonds zijn alleen basisgegevens beschikbaar. Controleer bedragen en deadline op de website van het fonds.',
  geen_bron_url: 'Er is geen website bekend waarmee deze regel automatisch kan worden gecontroleerd.',
  limiet: 'Niet gecontroleerd: er werden te veel bronnen tegelijk gevraagd.',
  budget: 'Niet gecontroleerd: de controle duurde te lang.',
  fout: GEEN_BRONCONTROLE,
};

// Korte labels voor de compacte kopregel. De lange labels (VERIFICATIE_LABEL) blijven in het detailblok.
export const KORT_LABEL = { geverifieerd: 'Geverifieerd', gedeeltelijk: 'Gedeeltelijk geverifieerd', onzeker: 'Onzeker', conflict: 'Conflict', niet_gecontroleerd: 'Niet gecontroleerd' };
const EXTRA_VELDEN = ['Doelgroep', 'Werkgebied', 'Type aanvrager'];
const STATUS_TEKST = { confirmed: 'Bevestigd in de bron', uncertain: 'Niet zeker bevestigd', conflict: 'Wijkt af van de bron', not_checked: 'Niet gecontroleerd' };
const COF_VOORVOEGSEL = /^Cofinancieringseis[^:]*:\s*/i;

const isObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

function velden(w) {
  const rijen = [];
  const label = (n) => VELD_LABEL[n];
  const volgorde = (l) => VELD_VOLGORDE.findIndex((n) => label(n) === l);

  w.bevestigd.forEach((l) => rijen.push({ label: l, status: 'confirmed', tekst: 'Bevestigd in de bron' }));
  w.onzeker.forEach((l) => rijen.push({ label: l, status: 'uncertain', tekst: 'Niet zeker bevestigd' }));
  w.conflicten.forEach((c) => rijen.push({ label: c.label, status: 'conflict', tekst: 'Wijkt af', online: c.online, database: c.database, fragment: c.fragment }));
  w.nietGecontroleerd.forEach((l) => rijen.push({ label: l, status: 'not_checked', tekst: 'Niet gecontroleerd' }));

  rijen.sort((a, b) => volgorde(a.label) - volgorde(b.label));

  // De kernvelden staan altijd in beeld; de rest alleen als de server er iets over zegt.
  const zichtbaar = rijen.filter((r) => r.status !== 'not_checked' || KERNVELDEN.includes(r.label));
  const overig = rijen.filter((r) => !zichtbaar.includes(r)).map((r) => r.label);

  return { zichtbaar, overig };
}

// -> { status, label, bronUrl, gecontroleerdOp, velden, nietGecontroleerdOverig, melding, afgewaardeerd }
export function verificatieModel(metadata) {
  const w = verificatieWeergave(metadata) || verificatieWeergave({ versie: 2, server_generated: true });
  let status = w.status;
  let afgewaardeerd = false;

  if (status === VERIFICATIE_STATUS.GEVERIFIEERD) {
    const consistent = w.conflicten.length === 0 && w.onzeker.length === 0 && w.bevestigd.includes(VELD_LABEL.fondsnaam) && w.bevestigd.includes(VELD_LABEL.deadline) && Boolean(w.bronUrl) && Boolean(w.gecontroleerdOp);

    if (!consistent) {
      status = VERIFICATIE_STATUS.NIET_GECONTROLEERD;
      afgewaardeerd = true;
    }
  }

  const v = velden(w);

  return {
    status,
    label: VERIFICATIE_LABEL[status],
    bronUrl: afgewaardeerd ? null : w.bronUrl,
    gecontroleerdOp: afgewaardeerd ? null : w.gecontroleerdOp,
    velden: afgewaardeerd ? [] : v.zichtbaar,
    nietGecontroleerdOverig: afgewaardeerd ? [] : v.overig,
    melding: status === VERIFICATIE_STATUS.NIET_GECONTROLEERD ? GEEN_BRONCONTROLE : '',
    afgewaardeerd,
  };
}

function regelModel(r, v) {
  const metadata = v && isObject(v.metadata) ? v.metadata : null;
  const ver = verificatieModel(metadata);
  const reden = v && typeof v.reden === 'string' && REDEN_TEKST[v.reden] ? REDEN_TEKST[v.reden] : '';
  const dl = r.deadline && typeof r.deadline.datum === 'string' ? r.deadline.datum : null;
  const g = isObject(r.grenzen) ? r.grenzen : {};
  const bedrag = Number.isFinite(r.bedrag) ? r.bedrag : null;

  const onzekerheden = Array.isArray(r.onzekerheden) ? r.onzekerheden.map(String).slice(0, 6) : [];
  const cofRegel = onzekerheden.find((o) => COF_VOORVOEGSEL.test(o)) || null;
  const statusVan = (label) => {
    const v = ver.velden.find((x) => x.label === label);

    return STATUS_TEKST[v ? v.status : 'not_checked'];
  };

  return {
    sleutel: String(r.sleutel || ''),
    naam: String(r.naam || ''),
    gever: String(r.gever || ''),
    soort: r.type === BRON_SOORT.FONDS ? 'Fonds' : 'Regeling',
    staatAl: r.staatAl === true,
    bedragTekst: bedrag != null ? formatEuro(bedrag) : null,
    grenzenTekst: Number.isFinite(g.min) || Number.isFinite(g.max) ? `${Number.isFinite(g.min) ? formatEuro(g.min) : '?'} – ${Number.isFinite(g.max) ? formatEuro(g.max) : '?'}` : null,
    // Alleen wat onze database zegt. Nooit als "geverifieerd" gelabeld; de controle staat in `verificatie`.
    deadlineTekst: dl ? formatDatum(dl) : null,
    motivatie: String(r.motivatie || ''),
    onzekerheden: onzekerheden.filter((o) => o !== cofRegel),
    cofinanciering: cofRegel ? cofRegel.replace(COF_VOORVOEGSEL, '') : null,
    voorwaarden: Array.isArray(r.voorwaarden) ? r.voorwaarden.map(String).slice(0, 8) : [],
    // Compacte kopregel (details on demand): alleen naam, bedrag, status en eventueel deadline.
    kop: {
      status: { sleutel: ver.status, label: KORT_LABEL[ver.status] },
      samenvatting: dl ? `deadline ${formatDatum(dl)}` : null,
    },
    // Rijen voor het detailblok. Waarden die de preview niet kent staan er eerlijk als "niet gecontroleerd" in, nooit als aanname.
    fondsnaam: r.type === BRON_SOORT.FONDS ? String(r.naam || '') : String(r.gever || ''),
    regelingnaam: r.type === BRON_SOORT.REGELING ? String(r.naam || '') : null,
    extraVelden: EXTRA_VELDEN.map((label) => ({ label, waarde: statusVan(label) })),
    bedragAangepast: r.bedragGecorrigeerd === true,
    verificatie: ver,
    reden: ver.status === VERIFICATIE_STATUS.GEVERIFIEERD ? '' : reden,
    eindgebruikerTekst: ver.status === VERIFICATIE_STATUS.GEVERIFIEERD || typeof (v && v.eindgebruikerTekst) !== 'string' ? '' : v.eindgebruikerTekst.slice(0, 300),
  };
}

// antwoord: de respons van de server (zie voorstelVerificatie.ts, PreviewSucces). -> { ok: true, ... } | { ok: false, melding }
export function bouwPreviewModel(antwoord) {
  try {
    if (!isObject(antwoord) || antwoord.ok !== true || !isObject(antwoord.voorstel) || !Array.isArray(antwoord.voorstel.regels) || !Array.isArray(antwoord.verificaties)) {
      return { ok: false, melding: PREVIEW_FOUT };
    }

    const perSleutel = new Map(antwoord.verificaties.filter(isObject).map((v) => [String(v.sleutel), v]));
    const regels = antwoord.voorstel.regels.filter(isObject).map((r) => regelModel(r, perSleutel.get(String(r.sleutel))));
    const tel = (s) => regels.filter((r) => r.verificatie.status === s).length;
    const t = isObject(antwoord.totalen) ? antwoord.totalen : {};

    return {
      ok: true,
      regels,
      opgeslagen: false,
      aantalOvergeslagen: Array.isArray(antwoord.overgeslagen) ? antwoord.overgeslagen.length : 0,
      samenvatting: Object.fromEntries(Object.values(VERIFICATIE_STATUS).map((s) => [s, tel(s)])),
      totalen: {
        voorgesteld: Number.isFinite(t.voorgesteld) ? formatEuro(t.voorgesteld) : null,
        gat: Number.isFinite(t.gat) ? formatEuro(t.gat) : null,
        nietToegewezen: Number.isFinite(t.nietToegewezen) ? formatEuro(t.nietToegewezen) : null,
      },
    };
  } catch (e) {
    return { ok: false, melding: PREVIEW_FOUT };
  }
}
