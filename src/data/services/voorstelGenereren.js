// Vraagt de server om een voorstel voor het dekkingsplan en actieplan van een project (Edge Function 'subsidie-kompas', modes
// 'voorstel-genereren' en 'voorstel-aanvullen'). Alleen LEZEN: de server geeft een voorstel terug en schrijft niets. Opslaan gebeurt pas
// na een klik van het lid, via de bestaande opslagpaden (projectFinanciering.js en projectActies.js).
// De client bepaalt hier niets: geen abonnement, geen bedrag, geen dekkingsdoel. Elke fout levert { ok: false, reden, melding } op.
import { supabase } from '../client.js';

export const GENEREREN_FUNCTION = 'subsidie-kompas';

const ALGEMENE_FOUT = 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen. Probeer het later opnieuw.';
const OVERZICHT = {
  'niet-beschikbaar-voor-abonnement': 'Het dekkingsplan met Subsidie Kompas is een Pro- en Premium-functie.',
  'geen-begroting': 'Vul eerst de projectbegroting in, ook een richtbedrag is genoeg; zonder bedrag kan geen gericht dekkingsplan worden gemaakt.',
  'onvoldoende-projectgegevens': 'Kies bij dit project eerst een discipline en een doelgroep uit de lijst; daarop zoekt Subsidie Kompas financiers.',
};

// supabase.functions.invoke geeft bij een 4xx/5xx een error met de Response in error.context; daaruit halen we de (veilige) code en tekst.
async function leesFout(error) {
  try {
    const res = error && error.context;

    if (res && typeof res.json === 'function') {
      const body = await res.json();
      const reden = typeof body.reden === 'string' ? body.reden : 'fout';

      // Bij een validatiefout van het opslaan geeft de server per regel de fout terug, zodat de invoer van het lid behouden blijft.
      const regelFouten = body.regelFouten && typeof body.regelFouten === 'object' && !Array.isArray(body.regelFouten) ? body.regelFouten : null;
      const algemeen = body.algemeen && typeof body.algemeen === 'object' ? body.algemeen : null;

      // Onvoldoende projectgegevens: noem precies welke velden bij het project nog ontbreken.
      const ontbreekt = Array.isArray(body.ontbreekt) ? body.ontbreekt.filter((x) => ['discipline', 'doelgroep', 'werkgebied'].includes(x)) : [];
      const ontbrekendTekst = reden === 'onvoldoende-projectgegevens' && ontbreekt.length ? `Vul bij het project nog in: ${ontbreekt.join(', ')}. Subsidie Kompas zoekt financiers op de gegevens van het project zelf.` : '';

      return { reden, melding: ontbrekendTekst || OVERZICHT[reden] || (typeof body.error === 'string' && body.error.length < 300 ? body.error : ALGEMENE_FOUT), regelFouten, algemeen, status: res.status };
    }
  } catch (e) {
    // geen leesbare foutinhoud
  }

  return { reden: 'fout', melding: ALGEMENE_FOUT };
}

async function roep(body) {
  if (!supabase) {
    return { ok: false, reden: 'geen-sessie', melding: ALGEMENE_FOUT, antwoord: null };
  }

  try {
    const { data, error } = await supabase.functions.invoke(GENEREREN_FUNCTION, { body });

    if (error) {
      const f = await leesFout(error);

      return { ok: false, reden: f.reden, melding: f.melding, antwoord: null, regelFouten: f.regelFouten || null, algemeen: f.algemeen || null, status: f.status || null };
    }

    if (!data || typeof data !== 'object' || data.ok !== true) {
      return { ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null };
    }

    return { ok: true, antwoord: data };
  } catch (e) {
    return { ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null };
  }
}

// `zoekprofiel` (optioneel) is het door het lid gecontroleerde profiel uit vraagZoekprofiel(); de server toetst het opnieuw aan de database.
export function vraagVoorstelGenereren({ projectId, zoekprofiel = null }) {
  if (typeof projectId !== 'string' || !projectId) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  return roep({ mode: 'voorstel-genereren', projectId, ...(zoekprofiel && typeof zoekprofiel === 'object' ? { zoekprofiel } : {}) });
}

// Stelt het zoekprofiel op uit het project (en documenten) of uit een gesprek (`berichten`: [{ role: 'user', content }]). Schrijft niets.
export function vraagZoekprofiel({ projectId, berichten = null }) {
  if (typeof projectId !== 'string' || !projectId) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  return roep({ mode: 'voorstel-zoekprofiel', projectId, ...(Array.isArray(berichten) && berichten.length ? { berichten } : {}) });
}

// Alleen Premium: gericht aanvullend zoeken op het resterende gat. De server berekent het resterende gat zelf uit `voorstel`.
// `getoond` = de online suggesties die het lid al kreeg ({ gever, indicatiefBedrag }): die tellen mee voor het stoppen en voor het totale
// maximum, en worden niet nogmaals voorgesteld. Het zijn alleen namen en schattingen; de server begrenst en controleert alles opnieuw.
export function vraagVoorstelAanvullen({ projectId, voorstel, getoond, zoekprofiel = null }) {
  if (typeof projectId !== 'string' || !projectId || !voorstel || typeof voorstel !== 'object') {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  const lijst = (Array.isArray(getoond) ? getoond : [])
    .filter((x) => x && typeof x.gever === 'string' && x.gever)
    .slice(0, 20)
    .map((x) => ({ gever: x.gever.slice(0, 200), indicatiefBedrag: Number.isFinite(x.indicatiefBedrag) && x.indicatiefBedrag > 0 ? Math.round(x.indicatiefBedrag) : 0 }));

  return roep({ mode: 'voorstel-aanvullen', projectId, voorstel, getoond: lijst, ...(zoekprofiel && typeof zoekprofiel === 'object' ? { zoekprofiel } : {}) });
}

// Startpunt vanuit de chat: dezelfde preview als hierboven, met de financiers die het lid in het gesprek kreeg (alleen type + id gaan mee).
// De server bepaalt naam, grenzen, deadline, "staat al" en voorgestelde taken. Schrijft niets.
export function vraagVoorstelStartpunt({ projectId, regels }) {
  const lijst = (Array.isArray(regels) ? regels : [])
    .filter((r) => r && (r.type === 'regeling' || r.type === 'fonds') && typeof r.id === 'string' && r.id)
    .slice(0, 12)
    .map((r) => ({ type: r.type, id: r.id }));

  if (typeof projectId !== 'string' || !projectId || !lijst.length) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  return roep({ mode: 'voorstel-startpunt', projectId, regels: lijst });
}

// Broncontrole van EEN financier. De server controleert de bron en legt uitkomst en tijdstip zelf vast; `opnieuw` forceert een nieuwe controle
// (anders hergebruikt de server een geldige, recente controle van dezelfde gegevens, ook na verversen). De client bepaalt nooit een status.
export function vraagBronControle({ projectId, type, id, opnieuw = false }) {
  if (typeof projectId !== 'string' || !projectId || (type !== 'regeling' && type !== 'fonds') || typeof id !== 'string' || !id) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: 'De bron kon nu niet worden gecontroleerd.', antwoord: null });
  }

  return roep({ mode: 'voorstel-controleer', projectId, type, id, ...(opnieuw === true ? { opnieuw: true } : {}) });
}

// Opslaan (de enige schrijfroute): alleen type, id en bedrag per regel, plus gekozen online suggesties (naam, bron) en eventueel afgevinkte taken.
// De server valideert alles opnieuw en bepaalt zelf de bronstatus en de taken. `alleenActies`: alleen het actieplan (opnieuw) aanmaken.
export function vraagVoorstelOpslaan({ projectId, regels, suggesties = [], uitgeslotenActies = [], alleenActies = false }) {
  if (typeof projectId !== 'string' || !projectId || !Array.isArray(regels)) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  return roep({
    mode: 'voorstel-opslaan',
    projectId,
    regels: regels.slice(0, 13).map((r) => ({ type: r.type, id: r.id, bedrag: Number.isFinite(r.bedrag) ? r.bedrag : null })),
    suggesties: (Array.isArray(suggesties) ? suggesties : []).slice(0, 10).map((x) => ({ gever: String((x && x.gever) || '').slice(0, 150), naam: String((x && x.naam) || '').slice(0, 150), url: x && typeof x.url === 'string' ? x.url.slice(0, 500) : null })),
    uitgeslotenActies: (Array.isArray(uitgeslotenActies) ? uitgeslotenActies : []).filter((x) => typeof x === 'string').slice(0, 100),
    ...(alleenActies === true ? { alleenActies: true } : {}),
  });
}

// Lees de broncontroles van een project (RLS: alleen eigen rijen; geschreven worden ze uitsluitend door de server). Zo blijft de bronstatus zichtbaar
// na verversen en na opslaan. Een fout, of een tabel die er (nog) niet is, geeft { ok: false, rijen: [] }: dan is alles "niet gecontroleerd".
export async function leesBronControles(projectId) {
  if (!supabase || typeof projectId !== 'string' || !projectId) {
    return { ok: false, rijen: [] };
  }

  try {
    const { data, error } = await supabase
      .from('subsidie_kompas_bron_controles')
      .select('record_type, record_id, status, verificatie_status, reden, gecontroleerd_op')
      .eq('program_id', projectId)
      .limit(500);

    if (error || !Array.isArray(data)) {
      return { ok: false, rijen: [] };
    }

    return { ok: true, rijen: data };
  } catch (e) {
    return { ok: false, rijen: [] };
  }
}

// Actieplan opnieuw proberen, ook na verversen: de taken die de SERVER als "nog niet aangemaakt" heeft bewaard (tabel subsidie_kompas_actieplan_open,
// alleen lezen voor het lid). Een fout, of een tabel die er (nog) niet is, geeft { ok: false, aantal: 0 }: dan is er niets om opnieuw te proberen.
export async function leesOpenActieplan(projectId) {
  if (!supabase || typeof projectId !== 'string' || !projectId) {
    return { ok: false, aantal: 0 };
  }

  try {
    const { data, error } = await supabase.from('subsidie_kompas_actieplan_open').select('id').eq('program_id', projectId).limit(200);

    if (error || !Array.isArray(data)) {
      return { ok: false, aantal: 0 };
    }

    return { ok: true, aantal: data.length };
  } catch (e) {
    return { ok: false, aantal: 0 };
  }
}

// De server maakt de bewaarde open taken aan. De browser stuurt alleen het project mee: geen taken, geen regels, geen datums.
export function vraagActieplanHerstel({ projectId }) {
  if (typeof projectId !== 'string' || !projectId) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  return roep({ mode: 'voorstel-actieplan-herstel', projectId });
}

// Stelt aangepaste data voor na gewijzigde deadlines. Zonder `toepassen` alleen een voorstel; met `toepassen` (taak-id's) worden alleen die
// taken gewijzigd, en handmatig aangepaste taken blijven ongemoeid tenzij `ookHandmatig` is aangevinkt.
export function vraagActieplanHerplan({ projectId, toepassen = null, ookHandmatig = false }) {
  if (typeof projectId !== 'string' || !projectId) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  return roep({ mode: 'voorstel-actieplan-herplan', projectId, ...(Array.isArray(toepassen) ? { toepassen } : {}), ...(ookHandmatig === true ? { ookHandmatig: true } : {}) });
}
