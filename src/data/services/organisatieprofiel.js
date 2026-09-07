// Het echte organisatieprofiel (Pro/Premium), opgeslagen in
// subsidie_kompas_organizations + subsidie_kompas_organization_field_sources.
//
// Voorheen probeerde workspace.js dit te bewaren in tabellen
// (organisatieprofielen, projecten, documentatie, gesprekken) die niet
// bestaan — elke synchronisatie faalde daardoor stil en alles bleef alleen
// in localStorage staan (per browser, niet per account). Dit bestand
// vervangt dat spoor specifiek voor het organisatieprofiel: de tabellen
// hieronder bestaan wél, met correcte RLS (auth.uid() = user_id).
//
// Veldnamen blijven aan de kant van de rest van de app ongewijzigd (naam,
// website, regio, themas, doelgroepen, ...) zodat DeadlinesPage.jsx en
// andere plekken die op orgProfile.* lezen niets hoeven te weten van de
// Engelse kolomnamen in de database. naarProfielVeld()/naarKolomWaarde()
// vertalen ertussen.
import { supabase } from '../client.js';

const KOLOM_NAAR_VELD = {
  organization_name: 'name',
  website_url: 'website',
  legal_form: 'rechtsvorm',
  founding_year: 'opgericht',
  registration_number: 'kvk',
  anbi_status: 'anbi',
  headquarters_location: 'gemeente',
  province: 'provincie',
  working_area: 'regio',
  mission: 'mission',
  vision: 'visie',
  target_groups: 'doelgroepen',
  themes: 'themas',
  tone_of_voice: 'toon',
  financing_mix: 'financiering',
  annual_revenue: 'omzet',
  staff_count: 'medewerkers',
  volunteer_count: 'vrijwilligers',
  contact_persons: 'contactpersonen',
  social_media: 'socials',
};

const VELD_NAAR_KOLOM = Object.fromEntries(Object.entries(KOLOM_NAAR_VELD).map(([k, v]) => [v, k]));

const LIJST_VELDEN = new Set(['doelgroepen', 'themas']);
const GETAL_VELDEN = new Set(['opgericht', 'omzet', 'medewerkers', 'vrijwilligers']);
const JSON_VELDEN = new Set(['contactpersonen', 'socials']);

async function huidigeGebruiker() {
  if (!supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getUser();

    return data?.user?.id || null;
  } catch (e) {
    return null;
  }
}

function naarProfielVeld(rij) {
  const profiel = {};

  Object.entries(KOLOM_NAAR_VELD).forEach(([kolom, veld]) => {
    const waarde = rij[kolom];

    if (waarde == null) {
      profiel[veld] = LIJST_VELDEN.has(veld) ? [] : JSON_VELDEN.has(veld) ? [] : '';

      return;
    }

    if (LIJST_VELDEN.has(veld)) {
      profiel[veld] = String(waarde)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    } else if (JSON_VELDEN.has(veld)) {
      profiel[veld] = Array.isArray(waarde) ? waarde : [];
    } else {
      profiel[veld] = waarde;
    }
  });

  return profiel;
}

function naarKolomWaarde(veld, waarde) {
  if (LIJST_VELDEN.has(veld)) {
    return (waarde || []).join(', ') || null;
  }

  if (JSON_VELDEN.has(veld)) {
    return waarde || [];
  }

  if (GETAL_VELDEN.has(veld)) {
    return waarde === '' || waarde == null ? null : Number(waarde);
  }

  return waarde === '' || waarde == null ? null : waarde;
}

// Geeft { profiel, bronnen, organizationId } terug, of null zonder sessie of
// zonder database (dan valt de aanroeper terug op localStorage).
export async function haalOrganisatieprofielOp() {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return null;
  }

  const { data: org, error } = await supabase
    .from('subsidie_kompas_organizations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (!org) {
    return { profiel: {}, bronnen: {}, organizationId: null };
  }

  const { data: bronnenRijen } = await supabase
    .from('subsidie_kompas_organization_field_sources')
    .select('field_name, source_type, source_ref, updated_at')
    .eq('organization_id', org.id);

  const bronnen = {};

  (bronnenRijen || []).forEach((r) => {
    const veld = KOLOM_NAAR_VELD[r.field_name] || r.field_name;

    bronnen[veld] = { type: r.source_type, ref: r.source_ref, tijd: r.updated_at };
  });

  return { profiel: naarProfielVeld(org), bronnen, organizationId: org.id };
}

const BRON_LABEL = {
  handmatig: 'Handmatig ingevuld',
  website: 'Uit website gehaald',
  document: 'Uit document gehaald',
  gesprek: 'Uit gesprek geleerd',
};

export function bronLabel(type) {
  return BRON_LABEL[type] || null;
}

// Bewaart één of meer velden. sourceType is voor al deze velden gelijk —
// vanuit de handmatige "Organisatie"-pagina is dat altijd 'handmatig'; latere
// fases (website-analyse, document-extractie, gesprek) roepen dit met een
// andere sourceType aan.
export async function bewaarOrganisatieVelden(velden, sourceType = 'handmatig', sourceRef = null) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { organizationId: null, error: 'geen-sessie' };
  }

  const kolomPatch = {};

  Object.entries(velden).forEach(([veld, waarde]) => {
    const kolom = VELD_NAAR_KOLOM[veld];

    if (!kolom) {
      return;
    }

    kolomPatch[kolom] = naarKolomWaarde(veld, waarde);
  });

  if (!Object.keys(kolomPatch).length) {
    return { organizationId: null, error: null };
  }

  // organization_name is verplicht (not null) in het schema; bij het allereerste
  // veld dat een lid invult (vaak niet de naam) moet er toch al een rij zijn.
  const { data: bestaand } = await supabase
    .from('subsidie_kompas_organizations')
    .select('id, organization_name')
    .eq('user_id', userId)
    .maybeSingle();

  let organizationId = bestaand?.id || null;

  if (!organizationId) {
    const { data: nieuw, error: aanmaakFout } = await supabase
      .from('subsidie_kompas_organizations')
      .insert({
        user_id: userId,
        organization_name: kolomPatch.organization_name || 'Naamloze organisatie',
        ...kolomPatch,
      })
      .select('id')
      .single();

    if (aanmaakFout) {
      return { organizationId: null, error: aanmaakFout.message };
    }

    organizationId = nieuw.id;
  } else {
    const { error: updateFout } = await supabase
      .from('subsidie_kompas_organizations')
      .update({ ...kolomPatch, updated_at: new Date().toISOString() })
      .eq('id', organizationId);

    if (updateFout) {
      return { organizationId: null, error: updateFout.message };
    }
  }

  const bronRijen = Object.keys(velden)
    .filter((veld) => VELD_NAAR_KOLOM[veld])
    .map((veld) => ({
      user_id: userId,
      organization_id: organizationId,
      field_name: VELD_NAAR_KOLOM[veld],
      source_type: sourceType,
      source_ref: sourceRef,
      updated_at: new Date().toISOString(),
    }));

  if (bronRijen.length) {
    await supabase
      .from('subsidie_kompas_organization_field_sources')
      .upsert(bronRijen, { onConflict: 'organization_id,field_name' });
  }

  return { organizationId, error: null };
}

// Wist één veld: zet de waarde leeg en verwijdert de herkomstregel, zodat het
// veld weer als "nooit ingevuld" verschijnt.
export async function wisOrganisatieVeld(veld) {
  const res = await bewaarOrganisatieVelden({ [veld]: LIJST_VELDEN.has(veld) || JSON_VELDEN.has(veld) ? [] : '' });

  if (res.organizationId) {
    await supabase
      .from('subsidie_kompas_organization_field_sources')
      .delete()
      .eq('organization_id', res.organizationId)
      .eq('field_name', VELD_NAAR_KOLOM[veld]);
  }

  return res;
}

// Verwijdert het hele organisatieprofiel (en, via on delete cascade, de
// herkomstregels, projecten, werkgebieden, documenten en website-bronnen die
// eraan hangen).
export async function verwijderOrganisatieprofiel() {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return false;
  }

  const { error } = await supabase.from('subsidie_kompas_organizations').delete().eq('user_id', userId);

  return !error;
}
