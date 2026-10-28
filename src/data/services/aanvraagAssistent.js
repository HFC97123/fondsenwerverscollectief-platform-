// Aanvraag-assistent (Pro/Premium): praat met de Edge Function 'aanvraag-assistent' (criteria van een fonds ophalen, een versie voor een fonds
// schrijven, een eigen aanvraag beoordelen, aanvragen bewaren). De client bepaalt hier niets: geen abonnement, geen limiet, geen uitkomst. Elke fout
// levert { ok: false, reden, melding } op; er wordt nooit een uitzondering gegooid.
// De aanvraagtekst van het lid wordt alleen meegestuurd om te beoordelen; de server bewaart haar niet. Uitzondering: versies. Wat het lid zelf als versie
// opslaat (concept of definitief) bewaart de server voor haar, maximaal 20 per aanvraag. Versies kosten geen maandruimte. Ook de vragenlijst en de lijst met stukken van een formulier (niet het bestand zelf) worden bewaard.
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

// Het antwoord van de chat over de begroting omzetten in begrotingsregels (telt als één beoordeling van de maandruimte). Er wordt niets bewaard:
// de regels komen terug en het lid zet ze zelf in de begroting.
export function maakBegrotingVoorstel({ projectId, tekst }) {
  return isTekst(projectId) && isTekst(tekst) ? roep({ mode: 'begroting-voorstel', projectId, tekst: String(tekst) }) : ongeldig();
}

// Een geüpload begrotingsbestand (de tekst die de browser eruit haalde) omzetten in begrotingsregels, met een controle van de sommen. Telt als één beoordeling
// van de maandruimte. Er wordt hier niets bewaard: het scherm slaat de regels op in de begroting van het project.
export function leesBegrotingUpload({ projectId, tekst }) {
  return isTekst(projectId) && isTekst(tekst) ? roep({ mode: 'begroting-upload', projectId, tekst: String(tekst) }) : ongeldig();
}

// Voortgangsmeter voor het algemene projectplan: hoeveel van de kerninformatie staat erin, wat mist er, en is dit project al geschreven?
export function haalPlanGereedheid(projectId) {
  return isTekst(projectId) ? roep({ mode: 'plan-gereedheid', projectId }) : ongeldig();
}

// ── Versies van een aanvraag (concept/definitief). Kosten geen maandruimte en gebruiken geen model. ──
export function haalVersies(aanvraagId) {
  return isTekst(aanvraagId) ? roep({ mode: 'versies', aanvraagId }) : ongeldig();
}

export function haalVersie(versieId) {
  return isTekst(versieId) ? roep({ mode: 'versie', versieId }) : ongeldig();
}

// antwoorden: [{ id, titel, tekst }]. Zonder versieId: een nieuwe versie. Met versieId: die concept-versie bijwerken (een definitieve wordt een nieuw concept).
export function bewaarVersie({ aanvraagId, versieId = '', antwoorden, naam = '' }) {
  if (!isTekst(aanvraagId)) return ongeldig();

  return roep({
    mode: 'versie-bewaren',
    aanvraagId,
    ...(isTekst(versieId) ? { versieId } : {}),
    antwoorden: Array.isArray(antwoorden) ? antwoorden : [],
    ...(isTekst(naam) ? { naam } : {}),
  });
}

// actie: 'hernoem' (met naam) | 'definitief' | 'concept'
export function wijzigVersie({ versieId, actie, naam = '' }) {
  return isTekst(versieId) && isTekst(actie) ? roep({ mode: 'versie-wijzigen', versieId, actie, ...(isTekst(naam) ? { naam } : {}) }) : ongeldig();
}

export function verwijderVersie(versieId) {
  return isTekst(versieId) ? roep({ mode: 'versie-verwijderen', versieId }) : ongeldig();
}

// ── Formulier: vragen en stukken (checklist), en antwoorden per vraag schrijven. ──
// Het bestand van het formulier gaat nooit mee: alleen de tekst die het lid zelf aanlevert; de server bewaart alleen de vragen en de lijst met stukken.
export function haalVragen(aanvraagId) {
  return isTekst(aanvraagId) ? roep({ mode: 'vragen', aanvraagId }) : ongeldig();
}

// De tekst van het formulier (uit Word, PDF of geplakt), en/of afbeeldingen ervan (screenshot, foto, scan; maximaal 4 data-URL's), omzetten in een voorstel voor de vragenlijst en de lijst met stukken.
// De afbeeldingen worden op de server eerst overgetypt en niet bewaard. Telt als één formulier lezen.
export function leesFormulier({ projectId, aanvraagId, formulierTekst = '', afbeeldingen = [] }) {
  const fotos = Array.isArray(afbeeldingen) ? afbeeldingen.filter(isTekst) : [];
  const tekst = typeof formulierTekst === 'string' ? formulierTekst : '';

  if (!isTekst(projectId) || !isTekst(aanvraagId) || (!tekst && fotos.length === 0)) return ongeldig();

  return roep({ mode: 'vragen-lezen', projectId, aanvraagId, ...(tekst ? { formulierTekst: tekst } : {}), ...(fotos.length ? { afbeeldingen: fotos } : {}) });
}

// vragen: de lijst [{ id, tekst, maxTekens, geenLimiet }]; bevestig: true vraagt de server om de lijst te bevestigen (elke vraag heeft een limiet of 'geen limiet').
// zonderFormulier: dit fonds heeft geen aanvraagformulier; de lijst zijn dan de onderdelen die het lid kiest (projectplan, aanbiedingsbrief, ...).
// stukken: [{ id, tekst, bron, sleutel, maxLeeftijdMaanden, nietVanToepassing, klaar, documentNaam }]. Elk van de twee mag ontbreken.
export function bewaarVragen({ aanvraagId, vragen, bevestig = false, stukken, zonderFormulier = false }) {
  if (!isTekst(aanvraagId)) return ongeldig();

  return roep({
    mode: 'vragen-bewaren',
    aanvraagId,
    ...(vragen !== undefined ? { vragen, bevestig: bevestig === true, ...(zonderFormulier === true ? { zonderFormulier: true } : {}) } : {}),
    ...(stukken !== undefined ? { stukken } : {}),
  });
}

// Schrijft per vraag een concept uit de projectgegevens. Zonder vraagIds voor alle vragen. Alle antwoorden voor één fonds tellen in een maand als één beoordeling.
export function schrijfAntwoorden({ projectId, aanvraagId, vraagIds = [] }) {
  return isTekst(projectId) && isTekst(aanvraagId) ? roep({ mode: 'antwoorden-schrijven', projectId, aanvraagId, ...(Array.isArray(vraagIds) && vraagIds.length ? { vraagIds } : {}) }) : ongeldig();
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
