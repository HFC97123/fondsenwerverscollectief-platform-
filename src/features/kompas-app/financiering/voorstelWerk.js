// De werking van "Maak dekkingsplan en actieplan met Subsidiekompas" aan de kant van de browser, ZUIVER (geen React, geen netwerk, geen opslag):
//  - de volgorde van de stappen (onderzoeken -> aanvullen (Premium)), of het startpunt vanuit de chat, met de diensten als parameter;
//  - het snel tonen van het voorstel en daarna de broncontrole per regel, als aparte aanroepen (mislukt er één, dan gaan de andere door);
//  - het werkmodel waarmee het lid het voorstel bekijkt en aanpast (selectie, bedragen, taken, online suggesties);
//  - de totalen onder de regels (dekking, buffer voor afwijzingen);
//  - het opslaan: de browser stuurt ALLEEN type, id en bedrag per regel (plus gekozen online suggesties en afgevinkte taken); de server valideert
//    opnieuw, bepaalt zelf de bronstatus en de taken, en schrijft.
//
// Wat de client hier NOOIT bepaalt: welke records bij het abonnement horen, de geldigheid van een bedrag of deadline, de dekkingsfactor
// (Pro 110%, Premium 120%), of een bron "gecontroleerd" is, en welke taken en datums er komen. Dat komt allemaal van de server; de client toont en past aan.
// Er wordt niets opgeslagen voordat `voerOpslagUit` wordt aangeroepen, en dat gebeurt alleen op een klik van het lid.
import { formatEuro, leesBedragInvoer } from './dekkingsplan.js';
import { BRON, BRON_CONTROLEREN, bronModel } from './bronStatus.js';
import { bouwPreviewModel } from './voorstelPreviewModel.js';

export const STAP = { ONDERZOEKEN: 'onderzoeken', AANVULLEN: 'aanvullen', VOORBEREIDEN: 'voorbereiden' };

const MAX_AANVUL_RONDES = 2;
export const GELIJKTIJDIGE_CONTROLES = 2;
const isObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const lijst = (x) => (Array.isArray(x) ? x : []);
const tekst = (x, max) => String(x == null ? '' : x).slice(0, max);

// ---------------------------------------------------------------------------------------------------------------------------
// 1. De stappen (snel): een voorstel, nog zonder broncontrole

// diensten: { genereer({projectId}), aanvullen({projectId, voorstel, getoond}), startpunt({projectId, regels}) } -> { ok, antwoord, melding }
// startpunt = { regels: [{ type, id }] } -> de financiers uit een gesprek met Subsidiekompas (de chat-ingang) in plaats van zelf zoeken.
// -> { ok: true, genereer, aanvulling } | { ok: false, reden, melding }
export async function draaiVoorstelFlow({ projectId, diensten, onStap, startpunt = null }) {
  const meld = (s) => {
    if (typeof onStap === 'function') onStap(s);
  };

  if (startpunt) {
    meld(STAP.VOORBEREIDEN);
    const s = await diensten.startpunt({ projectId, regels: lijst(startpunt.regels) });

    if (!s || !s.ok || !isObject(s.antwoord)) {
      return { ok: false, reden: (s && s.reden) || 'fout', melding: (s && s.melding) || 'Het voorstel kon nu niet worden voorbereid. Er is niets opgeslagen.' };
    }

    return { ok: true, genereer: s.antwoord, aanvulling: null };
  }

  meld(STAP.ONDERZOEKEN);
  const g = await diensten.genereer({ projectId });

  if (!g || !g.ok || !isObject(g.antwoord)) {
    return { ok: false, reden: (g && g.reden) || 'fout', melding: (g && g.melding) || 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen.' };
  }

  const genereer = g.antwoord;

  // Het project is al volledig gedekt: er is niets voor te stellen.
  if (!isObject(genereer.voorstel)) {
    return { ok: true, genereer, aanvulling: null };
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

  return { ok: true, genereer, aanvulling };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 2. De broncontrole per regel: aparte aanroepen NA het tonen van het voorstel

// Controleert één regel. Faalt dit, dan is dat alleen "Controle mislukt" voor deze regel; er komt nooit een uitzondering uit.
// -> { sleutel, bron (bronModel), antwoord (het serverantwoord of null) }
export async function controleerRegel({ projectId, regel, diensten, opnieuw = false }) {
  const mislukt = { sleutel: regel.sleutel, bron: bronModel({ status: 'mislukt' }), antwoord: null };

  try {
    const res = await diensten.controleer({ projectId, type: regel.type, id: regel.id, opnieuw });
    const c = res && res.ok && isObject(res.antwoord) ? res.antwoord.controle : null;

    // Het antwoord moet over DEZE regel gaan; een ander of ontbrekend antwoord telt nooit als "gecontroleerd".
    if (!isObject(c) || c.sleutel !== regel.sleutel || typeof c.status !== 'string') return mislukt;

    return { sleutel: regel.sleutel, bron: bronModel(c), antwoord: res.antwoord };
  } catch (e) {
    return mislukt;
  }
}

// Wie moet gecontroleerd worden: elke regel die nog niet in het dekkingsplan staat.
export const teControleren = (model) => model.regels.filter((r) => r.selecteerbaar);

// De begintoestand: alles wat gecontroleerd moet worden staat op "Controleren…".
export function beginControles(model) {
  return Object.fromEntries(teControleren(model).map((r) => [r.sleutel, { bron: BRON_CONTROLEREN, antwoord: null }]));
}

// Draait de controles met beperkte gelijktijdigheid. onUpdate(sleutel, { bron, antwoord }) per afgeronde regel. `geannuleerd()` stopt het
// starten van nieuwe controles en onderdrukt late resultaten (bijvoorbeeld na sluiten). Resolve't pas als alles klaar is; gooit nooit.
export async function draaiBronControles({ projectId, regels, diensten, onUpdate, geannuleerd = () => false, gelijktijdig = GELIJKTIJDIGE_CONTROLES, opnieuw = false }) {
  const wachtrij = [...regels];

  const werker = async () => {
    for (;;) {
      if (geannuleerd()) return;

      const regel = wachtrij.shift();

      if (!regel) return;

      const res = await controleerRegel({ projectId, regel, diensten, opnieuw });

      if (geannuleerd()) return;

      if (typeof onUpdate === 'function') onUpdate(regel.sleutel, { bron: res.bron, antwoord: res.antwoord });
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(gelijktijdig, regels.length || 1)) }, werker));
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Het werkmodel

export function maakWerkModel({ genereer, aanvulling }) {
  if (!isObject(genereer)) return null;

  const bronVoorstel = genereer.voorstel;
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
    staatAl: r.staatAl === true,
    reserve: r.sleutel === reserveSleutel,
  }));
  const acties = lijst(bronVoorstel && bronVoorstel.acties)
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
  const werkwijze = isObject(genereer.werkwijze) ? genereer.werkwijze : {};

  return {
    uitkomst: String(genereer.uitkomst || ''),
    melding: typeof genereer.melding === 'string' ? genereer.melding : null,
    regels,
    acties,
    suggesties,
    // Het ongewijzigde voorstel van de server: de basis voor de weergave per regel (details, grenzen, deadline volgens de database).
    ruwVoorstel: isObject(bronVoorstel) ? bronVoorstel : null,
    // Pro: aantal passende fondsen dat alleen in Premium zichtbaar is (alleen een getal, de server noemt geen namen).
    premiumHint: hint,
    // Hoeveel geüploade projectdocumenten de server heeft meegenomen in de online oriëntatie (alleen een aantal).
    documenten: Number.isInteger(werkwijze.documenten) && werkwijze.documenten > 0 ? werkwijze.documenten : 0,
    // Som van de indicaties van de online suggesties: een schatting, telt nooit mee in de dekking.
    onlineIndicatief: suggesties.reduce((t2, x) => t2 + (x.indicatiefBedrag > 0 ? x.indicatiefBedrag : 0), 0),
    gat: Number.isFinite(t.gat) ? t.gat : 0,
    doelBedrag: Number.isFinite(t.doelBedrag) ? t.doelBedrag : 0,
    dekkingsdoel: Number.isFinite(genereer.dekkingsdoel) ? genereer.dekkingsdoel : 1,
  };
}

// De weergave per regel: de ruwe regels van de server + wat de aparte broncontroles opleverden. -> [regelModel] (zie voorstelPreviewModel.js),
// elk met `bron` (bronModel), `toonVerificatie` (alleen als deze sessie de verificatiedetails kreeg) en een kopstatus die de BRONSTATUS toont.
export function bouwRegelWeergaven(model, controles) {
  if (!model || !model.ruwVoorstel) return [];

  const verificaties = [];

  for (const r of model.regels) {
    const c = controles && controles[r.sleutel];
    const v = c && c.antwoord && Array.isArray(c.antwoord.verificaties) ? c.antwoord.verificaties.find((x) => isObject(x) && x.sleutel === r.sleutel) : null;

    if (v) verificaties.push(v);
  }

  const basis = bouwPreviewModel({ ok: true, voorstel: model.ruwVoorstel, verificaties, overgeslagen: [], totalen: {} });

  if (!basis.ok) return [];

  return basis.regels.map((rm) => {
    const c = controles && controles[rm.sleutel];
    const bron = c ? c.bron : null;
    const metDetails = Boolean(c && c.antwoord && Array.isArray(c.antwoord.verificaties) && c.antwoord.verificaties.some((x) => isObject(x) && x.sleutel === rm.sleutel));

    return {
      ...rm,
      bron,
      toonVerificatie: metDetails,
      kop: { ...rm.kop, status: bron ? { sleutel: bron.status, label: bron.label } : null },
    };
  });
}

export function beginSelectie(model) {
  return {
    regels: new Set(model.regels.filter((r) => r.selecteerbaar && !r.reserve && r.bedrag > 0).map((r) => r.sleutel)),
    // Taken staan standaard aan voor de gekozen regels (en de projecttaak); het lid kan ze afvinken.
    acties: new Set(model.acties.map((a) => a.sleutel)),
    suggesties: new Set(),
  };
}

// Vanuit de chat kiest het lid zelf wat meegaat: alles wat niet al in het dekkingsplan staat staat standaard aan, zonder bedrag.
export function beginSelectieChat(model) {
  return { regels: new Set(model.regels.filter((r) => r.selecteerbaar).map((r) => r.sleutel)), acties: new Set(model.acties.map((a) => a.sleutel)), suggesties: new Set() };
}

export function beginBedragen(model) {
  return Object.fromEntries(model.regels.map((r) => [r.sleutel, r.bedrag != null ? String(r.bedrag).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '']));
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Totalen en controles op wat het lid aanpast

// -> { voorgesteld, gat, dekking (0 t/m 1+ of null), bovenGat, bovenDoel, fouten: { [sleutel]: 'ongeldig' | 'onder-minimum' | 'boven-maximum' } }
// Dit zijn waarschuwingen voor onderweg; de SERVER controleert bij het opslaan alles opnieuw en weigert wat niet klopt.
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

// De buffer voor afwijzingen ligt vast per abonnement (Pro 110%, Premium 120%) en wordt altijd zichtbaar gemaakt; er is nooit een stilzwijgende buffer.
export function bufferUitleg(model) {
  const procent = Math.round((model.dekkingsdoel - 1) * 100);

  return procent > 0
    ? `Buffer voor afwijzingen: ${procent}% (vast voor uw abonnement). Het voorstel mag tot ${Math.round(model.dekkingsdoel * 100)}% van het gat komen (${formatEuro(model.doelBedrag)}): afwijzingen zijn normaal, dus een deel is een buffer. Het voorstel is geen toezegging.`
    : 'Er is voor uw abonnement geen buffer voor afwijzingen ingesteld: het voorstel mag niet boven het financieringsgat uitkomen.';
}

// ---------------------------------------------------------------------------------------------------------------------------
// 5. Opslaan (alleen op een klik van het lid), via de server

// -> { regels: [{ type, id, bedrag }], suggesties, uitgeslotenActies, ongeldig: [sleutel], gekozen: [sleutel] }
// De browser stuurt ALLEEN type, id en bedrag: geen naam, deadline, grens, bronstatus of taak. De server haalt dat zelf op.
export function bouwOpslagVerzoek(model, selectie, bedragen) {
  const ongeldig = [];
  const regels = [];
  const gekozen = [];

  for (const r of model.regels) {
    if (!selectie.regels.has(r.sleutel)) continue;

    const b = leesBedragInvoer(bedragen[r.sleutel]);

    if (!b.ok) {
      ongeldig.push(r.sleutel);
      continue;
    }

    regels.push({ type: r.type, id: r.id, bedrag: b.waarde });
    gekozen.push(r.sleutel);
  }

  return {
    regels,
    gekozen,
    suggesties: model.suggesties.filter((s) => selectie.suggesties.has(s.sleutel)).map((s) => ({ gever: s.gever, naam: s.naam, url: s.url })),
    // De taken zelf bepaalt de server; het lid kan alleen taken AFVINKEN, en dat gaat als lijst met sleutels.
    uitgeslotenActies: model.acties.filter((a) => !selectie.acties.has(a.sleutel)).map((a) => a.sleutel),
    ongeldig,
  };
}

const ACTIEPLAN_STATUS = ['geen', 'klaar', 'deels', 'mislukt'];

function leesOpslagAntwoord(a) {
  const ap = isObject(a.actieplan) ? a.actieplan : {};

  return {
    ok: true,
    opgeslagen: a.opgeslagen === true,
    regels: lijst(a.regels)
      .filter(isObject)
      .map((r) => ({
        sleutel: String(r.sleutel || ''),
        naam: tekst(r.naam, 200),
        status: ['opgeslagen', 'bestaat-al', 'mislukt'].includes(r.status) ? r.status : 'mislukt',
        reden: typeof r.reden === 'string' ? r.reden : null,
        // Het id van de regel in het dekkingsplan (voor "Bespreek met Subsidiekompas"); alleen een geldig uuid.
        fundingId: typeof r.fundingId === 'string' && /^[0-9a-f-]{36}$/i.test(r.fundingId) ? r.fundingId : null,
        bron: bronModel(isObject(r.bron) ? r.bron : { status: 'niet-gecontroleerd' }),
      })),
    actieplan: {
      status: ACTIEPLAN_STATUS.includes(ap.status) ? ap.status : 'mislukt',
      aangemaakt: Number.isInteger(ap.aangemaakt) ? ap.aangemaakt : 0,
      bestond: Number.isInteger(ap.bestond) ? ap.bestond : 0,
      mislukt: Number.isInteger(ap.mislukt) ? ap.mislukt : 0,
    },
    suggesties: lijst(a.suggesties)
      .filter(isObject)
      .map((s) => ({ naam: tekst(s.naam, 200), status: ['opgeslagen', 'bestaat-al', 'mislukt'].includes(s.status) ? s.status : 'mislukt', reden: typeof s.reden === 'string' ? s.reden : null, fundingId: typeof s.fundingId === 'string' && /^[0-9a-f-]{36}$/i.test(s.fundingId) ? s.fundingId : null })),
    dekkingsdoel: Number.isFinite(a.dekkingsdoel) ? a.dekkingsdoel : null,
  };
}

// diensten.opslaan({ projectId, regels, suggesties, uitgeslotenActies, alleenActies }) -> { ok, antwoord, melding, regelFouten, algemeen }
// -> { ok: true, ...uitkomst } | { ok: false, soort: 'validatie', regelFouten, algemeen } | { ok: false, soort: 'fout', melding }
// Bij 'validatie' is er NIETS opgeslagen en blijft alle invoer van het lid behouden; de fouten horen bij een regel (sleutel r:<type>:<id>).
export async function voerOpslagUit({ projectId, verzoek, diensten }) {
  try {
    const res = await diensten.opslaan({ projectId, regels: verzoek.regels, suggesties: verzoek.suggesties, uitgeslotenActies: verzoek.uitgeslotenActies });

    if (res && res.ok && isObject(res.antwoord)) return leesOpslagAntwoord(res.antwoord);

    if (res && (isObject(res.regelFouten) || isObject(res.algemeen))) {
      const regelFouten = {};

      for (const [k, f] of Object.entries(isObject(res.regelFouten) ? res.regelFouten : {})) {
        if (isObject(f)) regelFouten[k] = { code: tekst(f.code, 40), melding: tekst(f.melding, 300) };
      }

      return { ok: false, soort: 'validatie', regelFouten, algemeen: isObject(res.algemeen) ? { code: tekst(res.algemeen.code, 40), melding: tekst(res.algemeen.melding, 300) } : null };
    }

    return { ok: false, soort: 'fout', melding: (res && res.melding) || 'Opslaan is niet gelukt. Probeer het opnieuw; er wordt niets dubbel opgeslagen.' };
  } catch (e) {
    return { ok: false, soort: 'fout', melding: 'Opslaan is niet gelukt. Probeer het opnieuw; er wordt niets dubbel opgeslagen.' };
  }
}

// Alleen het actieplan opnieuw aanmaken voor regels die al in het dekkingsplan staan. Het dekkingsplan zelf blijft zoals het is; de server maakt
// geen taken dubbel aan (titel + regel).
export async function herstelActieplan({ projectId, model, uitkomst, verzoek, diensten }) {
  const klaar = new Set(uitkomst.regels.filter((r) => r.status === 'opgeslagen' || r.status === 'bestaat-al').map((r) => r.sleutel));
  const regels = model.regels.filter((r) => klaar.has(r.sleutel)).map((r) => ({ type: r.type, id: r.id, bedrag: null }));
  // Online gevonden financiers die al op de lijst staan krijgen ook hun taken opnieuw (de server maakt er geen tweede regel van).
  const naamVan = (s) => (s.naam && s.naam !== s.gever ? `${s.gever} - ${s.naam}` : s.gever).slice(0, 200);
  const opLijst = new Set(lijst(uitkomst.suggesties).filter((s) => s.status === 'opgeslagen' || s.status === 'bestaat-al').map((s) => s.naam));
  const suggesties = lijst(verzoek.suggesties).filter((s) => opLijst.has(naamVan(s)));

  try {
    const res = await diensten.opslaan({ projectId, regels, suggesties, uitgeslotenActies: verzoek.uitgeslotenActies, alleenActies: true });

    if (res && res.ok && isObject(res.antwoord)) {
      const a = leesOpslagAntwoord(res.antwoord);

      // De server telt zelf: 'aangemaakt' = nu nieuw, 'bestond' = stond er al (ook de taken van de eerste poging). Dus NIET optellen met de eerste uitkomst.
      return { ok: true, actieplan: a.actieplan };
    }
  } catch (e) {
    // valt door naar de foutmelding
  }

  return { ok: false, melding: 'Het actieplan kon niet worden aangemaakt. Uw dekkingsplan is opgeslagen en ongewijzigd; probeer het opnieuw.' };
}

export { BRON };
