// Aanvraag-assistent (Pro/Premium): praat met de Edge Function 'aanvraag-assistent' (criteria van een fonds ophalen, een versie voor een fonds
// schrijven, een eigen aanvraag beoordelen, aanvragen bewaren). De client bepaalt hier niets: geen abonnement, geen limiet, geen uitkomst. Elke fout
// levert { ok: false, reden, melding } op; er wordt nooit een uitzondering gegooid.
// De aanvraagtekst van het lid wordt alleen meegestuurd om te beoordelen; de server bewaart haar niet.
import { supabase } from '../client.js';

export const AANVRAAG_FUNCTION = 'aanvraag-assistent';

const ALGEMENE_FOUT = 'Dit lukte nu niet. Er is niets verbruikt van uw maandruimte. Probeer het later opnieuw.';

// supabase.functions.invoke geeft bij een 4xx/5xx een error met de Response in error.context; daaruit halen we de (veilige) code en tekst.
async function leesFout(error) {
  try {
    const res = error && error.context;

    if (res && typeof res.json === 'function') {
      const body = await res.json();

      return {
        reden: typeof body.reden === 'string' ? body.reden : 'fout',
        melding: typeof body.error === 'string' && body.error.length > 0 && body.error.length < 400 ? body.error : ALGEMENE_FOUT,
        status: res.status,
        extra: body && typeof body === 'object' ? body : {},
      };
    }
  } catch (e) {
    // geen leesbare foutinhoud
  }

  return { reden: 'fout', melding: ALGEMENE_FOUT, status: null, extra: {} };
}

async function roep(body) {
  if (!supabase) return { ok: false, reden: 'geen-sessie', melding: ALGEMENE_FOUT, antwoord: null, status: null };

  try {
    const { data, error } = await supabase.functions.invoke(AANVRAAG_FUNCTION, { body });

    if (error) {
      const f = await leesFout(error);

      return { ok: false, reden: f.reden, melding: f.melding, antwoord: null, status: f.status, extra: f.extra };
    }

    if (!data || typeof data !== 'object' || data.ok !== true) return { ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null, status: null };

    return { ok: true, antwoord: data };
  } catch (e) {
    return { ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null, status: null };
  }
}

const isTekst = (t) => typeof t === 'string' && t.length > 0;
const ongeldig = () => Promise.resolve({ ok: false, reden: 'ongeldig', melding: 'Er ontbreekt een gegeven. Ververs de pagina en probeer het opnieuw.', antwoord: null, status: null });

// Is de functie er voor dit lid? 404 'niet-beschikbaar' = functie nog uit; 403 = geen Pro of Premium. In beide gevallen toont de app niets.
export function haalAssistentStatus() {
  return roep({ mode: 'status' });
}

export function haalAanvragen(projectId) {
  return isTekst(projectId) ? roep({ mode: 'aanvragen', projectId }) : ongeldig();
}

export function haalAanvraag(aanvraagId) {
  return isTekst(aanvraagId) ? roep({ mode: 'aanvraag', aanvraagId }) : ongeldig();
}

// websiteUrls: tot twee adressen; formulierTekst: de vragen uit het aanvraagformulier (uit Word of geplakt).
export function haalCriteriaOp({ projectId, fondsLabel, websiteUrls = [], formulierTekst = '' }) {
  if (!isTekst(projectId)) return ongeldig();

  return roep({
    mode: 'eisen-ophalen',
    projectId,
    fondsLabel: String(fondsLabel || ''),
    websiteUrls: (Array.isArray(websiteUrls) ? websiteUrls : []).filter(isTekst).slice(0, 2),
    formulierTekst: String(formulierTekst || ''),
  });
}

export function bewaarCriteria({ aanvraagId, criteria }) {
  return isTekst(aanvraagId) ? roep({ mode: 'criteria-bewaren', aanvraagId, criteria: Array.isArray(criteria) ? criteria : [] }) : ongeldig();
}

export function beoordeelAanvraag({ projectId, aanvraagId = '', aanvraagTekst, eisen, fondsLabel = '' }) {
  if (!isTekst(projectId)) return ongeldig();

  return roep({ mode: 'beoordelen', projectId, ...(isTekst(aanvraagId) ? { aanvraagId } : {}), aanvraagTekst: String(aanvraagTekst || ''), eisen: Array.isArray(eisen) ? eisen : [], fondsLabel: String(fondsLabel || '') });
}

// Zonder aanvraagId: het algemene projectplan. Met aanvraagId: een versie voor dat fonds.
export function schrijfProjectplan({ projectId, aanvraagId = '' }) {
  return isTekst(projectId) ? roep({ mode: 'plan-schrijven', projectId, ...(isTekst(aanvraagId) ? { aanvraagId } : {}) }) : ongeldig();
}

// Een eerder bewaarde beoordeling terugzien. Leest rechtstreeks uit de eigen tabel (RLS: alleen eigen rijen); niets wordt aangepast.
export async function haalBeoordeling(beoordelingId) {
  if (!supabase || !isTekst(beoordelingId)) return { ok: false, beoordeling: null };

  try {
    const { data, error } = await supabase
      .from('subsidie_kompas_aanvraag_beoordelingen')
      .select('id, fonds_label, eisen, resultaat, uitkomst, statistiek, created_at')
      .eq('id', beoordelingId)
      .maybeSingle();

    if (error || !data) return { ok: false, beoordeling: null };

    return { ok: true, beoordeling: data };
  } catch (e) {
    return { ok: false, beoordeling: null };
  }
}
