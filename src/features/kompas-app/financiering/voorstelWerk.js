// De werking van "Maak dekkingsplan en actieplan met Subsidiekompas" aan de kant van de browser, ZUIVER (geen React, geen netwerk, geen opslag):
//  - de volgorde van de stappen (onderzoeken -> aanvullen (Premium) -> controleren), met de diensten als parameter;
//  - het werkmodel waarmee het lid het voorstel bekijkt en aanpast (selectie, bedragen, taken, online suggesties);
//  - de totalen onder de regels (dekking, buffer voor afwijzingen);
//  - het opslagplan en de uitvoering daarvan, uitsluitend via de bestaande opslagpaden die als parameter worden meegegeven.
//
// Wat de client hier NOOIT bepaalt: welke records bij het abonnement horen, de geldigheid van een bedrag of deadline, de dekkingsfactor
// (Pro 110%, Premium 120%) en of iets "geverifieerd" is. Dat komt allemaal van de server; de client toont en past aan.
// Er wordt niets opgeslagen voordat `voerOpslagUit` wordt aangeroepen, en dat gebeurt alleen op een klik van het lid.
import { formatEuro, leesBedragInvoer } from './dekkingsplan.js';

export const STAP = { ONDERZOEKEN: 'onderzoeken', AANVULLEN: 'aanvullen', CONTROLEREN: 'controleren' };
export const STARTSTATUS = 'interesting'; // in de interface "Interessant"
export const ONLINE_NOTITIE = 'Online gevonden door Subsidiekompas, nog niet gecontroleerd. Controleer de voorwaarden en deadline bij de financier.';

const MAX_AANVUL_RONDES = 2;
const isObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const lijst = (x) => (Array.isArray(x) ? x : []);
const tekst = (x, max) => String(x == null ? '' : x).slice(0, max);

// ---------------------------------------------------------------------------------------------------------------------------
// 1. De stappen

// diensten: { genereer({projectId}), aanvullen({projectId, voorstel}), preview({projectId, voorstel}) } -> { ok, antwoord, melding }
// -> { ok: true, genereer, aanvulling, preview } | { ok: false, reden, melding }
export async function draaiVoorstelFlow({ projectId, diensten, onStap }) {
  const meld = (s) => {
    if (typeof onStap === 'function') onStap(s);
  };

  meld(STAP.ONDERZOEKEN);
  const g = await diensten.genereer({ projectId });

  if (!g || !g.ok || !isObject(g.antwoord)) {
    return { ok: false, reden: (g && g.reden) || 'fout', melding: (g && g.melding) || 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen.' };
  }

  const genereer = g.antwoord;

  // Het project is al volledig gedekt: er is niets voor te stellen.
  if (!isObject(genereer.voorstel)) {
    return { ok: true, genereer, aanvulling: null, preview: null };
  }

  // Premium: doorzoeken tot het doel (120%) gedekt is. De server zegt of een volgende ronde zin heeft (aanvullenMogelijk / nogAanvullen) en bewaakt
  // zelf het totale maximum; hier hoogstens MAX_AANVUL_RONDES rondes, en een mislukte ronde stopt het zoeken zonder foutmelding.
  let aanvulling = null;
  let getoond = lijst(genereer.onlineSuggesties).filter(isObject);
  let verder = genereer.aanvullenMogelijk === true;

  for (let ronde = 0; verder && ronde < MAX_AANVUL_RONDES; ronde += 1) {
    meld(STAP.AANVULLEN);
    const a = await diensten.aanvullen({ projectId, voorstel: genereer.voorstel, getoond: getoond.map((x) => ({ gever: x.gever, indicatiefBedrag: x.indicatiefBedrag })) });
    const antwoord = a && a.ok && isObject(a.antwoord) ? a.antwoord : null;

    // Mislukt het aanvullen, dan is het voorstel gewoon bruikbaar zonder: geen foutmelding, wel minder suggesties.
    if (!antwoord) break;

    const nieuw = lijst(antwoord.onlineSuggesties).filter(isObject);

    aanvulling = { ...antwoord, onlineSuggesties: [...lijst(aanvulling && aanvulling.onlineSuggesties), ...nieuw] };
    getoond = [...getoond, ...nieuw];
    verder = antwoord.nogAanvullen === true && nieuw.length > 0;
  }

  meld(STAP.CONTROLEREN);
  // Taken blijven bij de client van het eerste antwoord (de preview geeft er geen terug); de preview krijgt alleen de regels.
  const p = await diensten.preview({ projectId, voorstel: { ...genereer.voorstel, acties: [] } });

  return { ok: true, genereer, aanvulling, preview: p && p.ok && isObject(p.antwoord) ? p.antwoord : null };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Het werkmodel

export function maakWerkModel({ genereer, aanvulling, preview }) {
  if (!isObject(genereer)) return null;

  // De preview is het door de server gecontroleerde voorstel; zonder preview tonen we het eerste voorstel, eerlijk als "niet gecontroleerd".
  const bronVoorstel = preview && isObject(preview.voorstel) ? preview.voorstel : genereer.voorstel;
  const regelsRuw = lijst(bronVoorstel && bronVoorstel.regels).filter(isObject);
  const reserveSleutel = typeof genereer.reserveSleutel === 'string' ? genereer.reserveSleutel : null;
  const sleutels = new Set(regelsRuw.map((r) => String(r.sleutel)));
  const regels = regelsRuw.map((r) => ({
    sleutel: String(r.sleutel),
    type: r.type,
    id: r.id,
    naam: tekst(r.naam, 200),
    gever: tekst(r.gever, 200),
    bedrag: Number.isFinite(r.bedrag) ? r.bedrag : null,
    grenzen: isObject(r.grenzen) ? { min: Number.isFinite(r.grenzen.min) ? r.grenzen.min : null, max: Number.isFinite(r.grenzen.max) ? r.grenzen.max : null } : { min: null, max: null },
    deadline: isObject(r.deadline) && r.deadline.status === 'geverifieerd' && typeof r.deadline.datum === 'string' ? r.deadline.datum : null,
    selecteerbaar: r.selecteerbaar === true && r.staatAl !== true,
    reserve: r.sleutel === reserveSleutel,
  }));
  const acties = lijst(genereer.voorstel && genereer.voorstel.acties)
    .filter(isObject)
    .filter((a) => !a.regelSleutel || sleutels.has(String(a.regelSleutel)))
    .map((a) => ({
      sleutel: String(a.sleutel),
      regelSleutel: a.regelSleutel ? String(a.regelSleutel) : null,
      titel: tekst(a.titel, 200),
      financier: tekst(a.financier, 200),
      datum: typeof a.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.datum) ? a.datum : null,
      prioriteit: ['high', 'normal', 'low'].includes(a.prioriteit) ? a.prioriteit : 'normal',
      toelichting: tekst(a.toelichting, 600),
    }));
  const suggesties = [];

  for (const s of [...lijst(genereer.onlineSuggesties), ...lijst(aanvulling && aanvulling.onlineSuggesties)]) {
    if (!isObject(s) || !s.gever || suggesties.some((x) => x.gever.toLowerCase() === String(s.gever).toLowerCase())) continue;

    suggesties.push({
      sleutel: `online:${suggesties.length}`,
      naam: tekst(s.naam || s.gever, 200),
      gever: tekst(s.gever, 200),
      url: typeof s.url === 'string' && /^https:\/\//.test(s.url) ? s.url : typeof s.website === 'string' && /^https:\/\//.test(s.website) ? s.website : null,
      deadline: typeof s.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.deadline) ? s.deadline : null,
      min: Number.isFinite(s.min) ? s.min : null,
      max: Number.isFinite(s.max) ? s.max : null,
      indicatiefBedrag: Number.isFinite(s.indicatiefBedrag) ? s.indicatiefBedrag : null,
      samenvatting: tekst(s.samenvatting, 300),
      waarom: lijst(s.waarom).map((w) => tekst(w, 160)).slice(0, 3),
    });
  }

  const t = isObject(genereer.totalen) ? genereer.totalen : {};
  const hint = isObject(genereer.premiumHint) && Number.isInteger(genereer.premiumHint.aantal) && genereer.premiumHint.aantal > 0 ? genereer.premiumHint.aantal : 0;

  return {
    uitkomst: String(genereer.uitkomst || ''),
    melding: typeof genereer.melding === 'string' ? genereer.melding : null,
    gecontroleerd: Boolean(preview),
    regels,
    acties,
    suggesties,
    // Pro: aantal passende fondsen dat alleen in Premium zichtbaar is (alleen een getal, de server noemt geen namen).
    premiumHint: hint,
    // Som van de indicaties van de online suggesties: een schatting, telt nooit mee in de dekking.
    onlineIndicatief: suggesties.reduce((t2, x) => t2 + (x.indicatiefBedrag > 0 ? x.indicatiefBedrag : 0), 0),
    gat: Number.isFinite(t.gat) ? t.gat : 0,
    doelBedrag: Number.isFinite(t.doelBedrag) ? t.doelBedrag : 0,
    dekkingsdoel: Number.isFinite(genereer.dekkingsdoel) ? genereer.dekkingsdoel : 1,
    // Voor de weergave (details en verificatie per regel): het antwoord van de preview, of het eerste voorstel zonder verificaties.
    weergave: preview && isObject(preview) ? preview : { ok: true, voorstel: genereer.voorstel, verificaties: [], overgeslagen: [], totalen: {} },
  };
}

export function beginSelectie(model) {
  return {
    regels: new Set(model.regels.filter((r) => r.selecteerbaar && !r.reserve && r.bedrag > 0).map((r) => r.sleutel)),
    // Taken staan standaard aan voor de gekozen regels (en de projecttaak); het lid kan ze afvinken.
    acties: new Set(model.acties.map((a) => a.sleutel)),
    suggesties: new Set(),
  };
}

export function beginBedragen(model) {
  return Object.fromEntries(model.regels.map((r) => [r.sleutel, r.bedrag != null ? String(r.bedrag).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '']));
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Totalen en controles op wat het lid aanpast

// -> { voorgesteld, gat, dekking (0 t/m 1+ of null), bovenGat, bovenDoel, fouten: { [sleutel]: 'ongeldig' | 'onder-minimum' | 'boven-maximum' } }
export function berekenSelectieTotaal(model, selectie, bedragen) {
  const fouten = {};
  let voorgesteld = 0;

  for (const r of model.regels) {
    if (!selectie.regels.has(r.sleutel)) continue;

    const b = leesBedragInvoer(bedragen[r.sleutel]);

    if (!b.ok) {
      fouten[r.sleutel] = 'ongeldig';
      continue;
    }

    if (b.waarde == null) continue;

    if (r.grenzen.min != null && b.waarde < r.grenzen.min) fouten[r.sleutel] = 'onder-minimum';
    if (r.grenzen.max != null && b.waarde > r.grenzen.max) fouten[r.sleutel] = 'boven-maximum';

    voorgesteld += b.waarde;
  }

  return {
    voorgesteld,
    gat: model.gat,
    dekking: model.gat > 0 ? voorgesteld / model.gat : null,
    bovenGat: model.gat > 0 && voorgesteld > model.gat,
    bovenDoel: model.doelBedrag > 0 && voorgesteld > model.doelBedrag,
    fouten,
  };
}

export function dekkingTekst(totaal, model) {
  if (totaal.dekking == null) return '';

  const procent = Math.round(totaal.dekking * 100);

  return totaal.bovenGat ? `${procent}% van het financieringsgat, inclusief buffer voor afwijzingen` : `${procent}% van het financieringsgat`;
}

export function bufferUitleg(model) {
  const procent = Math.round((model.dekkingsdoel - 1) * 100);

  return procent > 0
    ? `Het voorstel mag tot ${Math.round(model.dekkingsdoel * 100)}% van het gat komen (${formatEuro(model.doelBedrag)}): afwijzingen zijn normaal, dus een deel is een buffer. Het voorstel is geen toezegging.`
    : '';
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Opslaan (alleen op een klik van het lid)

// -> { regels: [{ sleutel, type, id, naam, bedrag, acties: [...] }], projectActies: [...], suggesties: [...], ongeldig: [sleutel] }
export function bouwOpslagPlan(model, selectie, bedragen) {
  const ongeldig = [];
  const regels = [];

  for (const r of model.regels) {
    if (!selectie.regels.has(r.sleutel)) continue;

    const b = leesBedragInvoer(bedragen[r.sleutel]);

    if (!b.ok) {
      ongeldig.push(r.sleutel);
      continue;
    }

    regels.push({ sleutel: r.sleutel, type: r.type, id: r.id, naam: r.naam, bedrag: b.waarde, acties: model.acties.filter((a) => a.regelSleutel === r.sleutel && selectie.acties.has(a.sleutel)) });
  }

  return {
    regels,
    projectActies: model.acties.filter((a) => !a.regelSleutel && selectie.acties.has(a.sleutel)),
    suggesties: model.suggesties.filter((s) => selectie.suggesties.has(s.sleutel)),
    ongeldig,
  };
}

// diensten: { voegRegelToe, voegFinancierToe, voegActieToe } = de bestaande opslagpaden. Een mislukking van één onderdeel stopt de rest niet;
// alles wordt teruggemeld. -> samenvatting met aantallen en per onderdeel de reden.
export async function voerOpslagUit({ projectId, plan, diensten }) {
  const uit = { regelsToegevoegd: 0, regelsBestondAl: [], regelsMislukt: [], actiesToegevoegd: 0, actiesMislukt: 0, suggestiesToegevoegd: 0, suggestiesMislukt: [] };

  for (const r of plan.regels) {
    const res = await diensten.voegRegelToe({
      projectId,
      schemeId: r.type === 'regeling' ? r.id : null,
      funderId: r.type === 'fonds' ? r.id : null,
      requested: r.bedrag,
      status: STARTSTATUS,
    });

    if (!res.ok) {
      if (res.reden === 'bestaat-al') uit.regelsBestondAl.push(r.naam);
      else uit.regelsMislukt.push({ naam: r.naam, reden: res.reden || 'fout' });

      // Zonder gekoppelde regel geen taken die ernaar verwijzen.
      continue;
    }

    uit.regelsToegevoegd += 1;

    for (const a of r.acties) {
      const t = await diensten.voegActieToe({ projectId, titel: a.titel, financier: a.financier || r.naam, deadline: a.datum, prioriteit: a.prioriteit, notitie: a.toelichting, fundingId: res.id, bron: 'chat' });

      if (t.ok) uit.actiesToegevoegd += 1;
      else uit.actiesMislukt += 1;
    }
  }

  for (const a of plan.projectActies) {
    const t = await diensten.voegActieToe({ projectId, titel: a.titel, financier: '', deadline: a.datum, prioriteit: a.prioriteit, notitie: a.toelichting, fundingId: null, bron: 'chat' });

    if (t.ok) uit.actiesToegevoegd += 1;
    else uit.actiesMislukt += 1;
  }

  for (const s of plan.suggesties) {
    const naam = (s.naam === s.gever || !s.naam ? s.gever : `${s.gever} - ${s.naam}`).slice(0, 200);
    const notitie = `${ONLINE_NOTITIE}${s.url ? ` Bron: ${s.url}` : ''}`;
    const res = await diensten.voegFinancierToe({ projectId, naam, bedrag: null, status: STARTSTATUS, deadline: null, notitie });

    if (res.ok) uit.suggestiesToegevoegd += 1;
    else uit.suggestiesMislukt.push({ naam, reden: res.reden || 'fout' });
  }

  return uit;
}
