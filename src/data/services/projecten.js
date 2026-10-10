// Projecten (Pro/Premium), opgeslagen in subsidie_kompas_programs. Documenten
// per project lopen via subsidie_kompas_knowledge_items (program_id) - dezelfde
// tabel die in een volgende fase ook voor document-upload/-extractie wordt
// gebruikt.
//
// Drie niveaus (zie ook features/kompas-app/projectKoppeling.js):
//   organisatie = blijvende organisatiegegevens (organisatieprofiel.js)
//   project     = subsidie_kompas_programs (deze module)
//   document    = knowledge_items: doc_type, version, document_context
//                 (fonds en documentspecifieke instructies), superseded_at.
// Documenten zijn append-only: een nieuwe generatie wordt een nieuwe versie,
// de vorige blijft bestaan (gemarkeerd als vervangen) en wordt nooit stil
// overschreven of verwijderd.
//
// Veldnamen blijven aan de kant van de rest van de app ongewijzigd (naam,
// programma, doelgroep, regio, periodeVan/Tot, begroting, gevraagd,
// eigenBijdrage, partners, resultaten, eerder, cofin, regelingen, docs) -
// zie KompasStore.jsx/ProjectenPage.jsx. naarProjectVeld()/naarKolomPatch()
// vertalen naar de Engelse kolomnamen in de database.
import { supabase } from '../client.js';

// Doelgroep is voorheen een los tekstveld geweest (target_groups, plain
// text in de database). Om meervoudige selectie mogelijk te maken zonder
// een schemawijziging of een migratie voor bestaande projecten, wordt het
// hier - net als themas/doelgroepen in organisatieprofiel.js - bewaard als
// kommagescheiden tekst en uitgelezen als array. Een bestaand project met
// één vrije-tekstwaarde wordt zo automatisch een array met één item.
function doelgroepUitKolom(waarde) {
  if (waarde == null) {
    return [];
  }

  return String(waarde)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function doelgroepNaarKolom(waarde) {
  return (Array.isArray(waarde) ? waarde : waarde ? [waarde] : []).join(', ') || null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isEchtId = (id) => typeof id === 'string' && UUID_RE.test(id);

function nieuwUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Terugval voor omgevingen zonder crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;

    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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

// Projecten hangen verplicht aan een organisatie (organization_id is not
// null). Heeft het lid het organisatieprofiel nog niet ingevuld, dan maken
// we - net als in organisatieprofiel.js - een naamloze organisatie aan zodat
// het eerste project toch bewaard kan worden.
async function huidigeOfNieuweOrganisatie(userId) {
  const { data: bestaand } = await supabase
    .from('subsidie_kompas_organizations')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (bestaand?.id) {
    return bestaand.id;
  }

  const { data: nieuw, error } = await supabase
    .from('subsidie_kompas_organizations')
    .insert({ user_id: userId, organization_name: 'Naamloze organisatie' })
    .select('id')
    .single();

  return error ? null : nieuw.id;
}

function naarProjectVeld(rij, docs) {
  return {
    id: rij.id,
    naam: rij.name || '',
    programma: rij.program_label || '',
    doelgroep: doelgroepUitKolom(rij.target_groups),
    regio: rij.location || '',
    periodeVan: rij.period_start || '',
    periodeTot: rij.period_end || '',
    omschrijving: rij.description || '',
    doelstellingen: rij.goals || '',
    partners: rij.partners || '',
    resultaten: rij.results || '',
    begroting: rij.budget_total ?? '',
    gevraagd: rij.requested_amount ?? '',
    eigenBijdrage: rij.own_contribution ?? '',
    eerder: Array.isArray(rij.previous_grants) ? rij.previous_grants : [],
    cofin: Array.isArray(rij.cofinanciers) ? rij.cofinanciers : [],
    regelingen: Array.isArray(rij.linked_schemes) ? rij.linked_schemes : [],
    activiteiten: rij.activities || '',
    impact: rij.impact_description || '',
    planning: rij.planning || '',
    schrijfvoorkeur: rij.writing_preferences || '',
    bronnen: rij.field_sources && typeof rij.field_sources === 'object' ? rij.field_sources : {},
    gearchiveerd: !!rij.archived_at,
    docs: docs || [],
  };
}

// begroting/gevraagd/eigenBijdrage zijn gewone tekstvelden in de UI (zoals
// nu al, met placeholders als '€ 85.000'), dus hier op dezelfde manier
// schoongemaakt als berekenDekking() in KompasStore.jsx al doet: alle
// niet-cijfers eruit, anders levert '€ 85.000' een ongeldig getal op.
function getal(v) {
  if (v === '' || v == null) {
    return null;
  }

  const cijfers = String(v).replace(/[^0-9]/g, '');

  return cijfers ? Number(cijfers) : null;
}

function naarKolomPatch(project) {
  return {
    name: project.naam || 'Naamloos project',
    program_label: project.programma || null,
    target_groups: doelgroepNaarKolom(project.doelgroep),
    location: project.regio || null,
    period_start: project.periodeVan || null,
    period_end: project.periodeTot || null,
    description: project.omschrijving || null,
    goals: project.doelstellingen || null,
    partners: project.partners || null,
    results: project.resultaten || null,
    budget_total: getal(project.begroting),
    requested_amount: getal(project.gevraagd),
    own_contribution: getal(project.eigenBijdrage),
    previous_grants: project.eerder || [],
    cofinanciers: project.cofin || [],
    linked_schemes: project.regelingen || [],
    activities: project.activiteiten || null,
    impact_description: project.impact || null,
    planning: project.planning || null,
    writing_preferences: project.schrijfvoorkeur || null,
    field_sources: project.bronnen && typeof project.bronnen === 'object' ? project.bronnen : {},
  };
}

function naarDocVeld(rij) {
  return {
    id: rij.id,
    naam: rij.file_name || rij.title || 'Document',
    soort: rij.doc_type || rij.notes || 'Overig',
    grootte: '',
    tekst: rij.extracted_text || '',
    versie: rij.version || 1,
    // Documentniveau: o.a. { fonds, instructies } - hoort bij dit ene document.
    context: rij.document_context && typeof rij.document_context === 'object' ? rij.document_context : {},
    vervangen: !!rij.superseded_at,
    gemaakt: rij.created_at || null,
    bron: rij.source_type || 'upload',
  };
}

// Geeft een array projecten terug, of null zonder sessie/database (dan valt
// de aanroeper terug op localStorage).
export async function haalProjectenOp() {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return null;
  }

  const { data: programs, error } = await supabase
    .from('subsidie_kompas_programs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return null;
  }

  const ids = (programs || []).map((p) => p.id);

  let docsPerProject = {};

  if (ids.length) {
    const { data: docs } = await supabase
      .from('subsidie_kompas_knowledge_items')
      .select('id, program_id, file_name, title, notes, extracted_text, doc_type, version, document_context, superseded_at, created_at, source_type')
      .in('program_id', ids)
      .order('created_at', { ascending: true });

    docsPerProject = (docs || []).reduce((acc, d) => {
      (acc[d.program_id] = acc[d.program_id] || []).push(naarDocVeld(d));

      return acc;
    }, {});
  }

  return (programs || []).map((p) => naarProjectVeld(p, docsPerProject[p.id]));
}

// Export (Word/PDF/Excel): precies één project van de ingelogde gebruiker,
// opnieuw uit de database gelezen op id (user_id-filter + RLS). Documenten
// komen alleen met hun gegevens mee, zonder de volledige documenttekst.
// Geeft null als het project niet bestaat of niet van deze gebruiker is.
export async function haalProjectVoorExport(projectId) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(projectId)) {
    return null;
  }

  const { data: rij, error } = await supabase
    .from('subsidie_kompas_programs')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !rij) {
    return null;
  }

  const { data: docs } = await supabase
    .from('subsidie_kompas_knowledge_items')
    .select('id, program_id, file_name, title, notes, doc_type, version, document_context, superseded_at, created_at, source_type')
    .eq('program_id', rij.id)
    .order('created_at', { ascending: true });

  return naarProjectVeld(rij, (docs || []).map(naarDocVeld));
}

// Export: één bewaard projectdocument (mét tekst), alleen als het project van
// de ingelogde gebruiker is. Geeft null in alle andere gevallen.
export async function haalDocumentVoorExport(projectId, documentId) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(projectId) || !isEchtId(documentId)) {
    return null;
  }

  const { data: programma } = await supabase
    .from('subsidie_kompas_programs')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!programma) {
    return null;
  }

  const { data: rij, error } = await supabase
    .from('subsidie_kompas_knowledge_items')
    .select('id, program_id, file_name, title, notes, extracted_text, doc_type, version, document_context, superseded_at, created_at, source_type')
    .eq('id', documentId)
    .eq('program_id', programma.id)
    .maybeSingle();

  return error || !rij ? null : naarDocVeld(rij);
}

// Bewaart één project (nieuw of bestaand). Een id die geen echte database-id
// (uuid) is - een nieuw project in het formulier heeft een tijdelijk id - telt
// als nieuw en wordt aangemaakt.
//
// Documenten worden NIET meer vervangen: bestaande documenten blijven staan,
// nieuwe worden toegevoegd (met versienummer per documentsoort + fonds), en
// alleen documenten die het lid expliciet verwijderde (project.verwijderdeDocIds)
// gaan weg.
//
// Geeft { id, error, docs } terug; docs is de lijst met definitieve doc-id's.
export async function bewaarProject(project) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { id: null, error: 'geen-sessie' };
  }

  const kolomPatch = naarKolomPatch(project);
  let id = isEchtId(project.id) ? project.id : null;
  let organizationId = null;

  if (!id) {
    organizationId = await huidigeOfNieuweOrganisatie(userId);

    if (!organizationId) {
      return { id: null, error: 'kon-organisatie-niet-aanmaken' };
    }

    const { data: nieuw, error: aanmaakFout } = await supabase
      .from('subsidie_kompas_programs')
      .insert({ user_id: userId, organization_id: organizationId, ...kolomPatch })
      .select('id')
      .single();

    if (aanmaakFout) {
      return { id: null, error: aanmaakFout.message };
    }

    id = nieuw.id;
  } else {
    const { error: updateFout } = await supabase
      .from('subsidie_kompas_programs')
      .update({ ...kolomPatch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateFout) {
      return { id: null, error: updateFout.message };
    }
  }

  if (!organizationId) {
    const { data: orgRij } = await supabase.from('subsidie_kompas_programs').select('organization_id').eq('id', id).single();

    organizationId = orgRij?.organization_id || null;
  }

  const { data: bestaandRijen } = await supabase
    .from('subsidie_kompas_knowledge_items')
    .select('id, doc_type, notes, title, document_context, version, superseded_at')
    .eq('program_id', id)
    .eq('user_id', userId);

  const bestaand = bestaandRijen || [];
  const bestaandIds = new Set(bestaand.map((d) => d.id));

  // 1. Alleen expliciet verwijderde documenten (en alleen van dit project).
  const teVerwijderen = (project.verwijderdeDocIds || []).filter((x) => bestaandIds.has(x));

  if (teVerwijderen.length) {
    await supabase.from('subsidie_kompas_knowledge_items').delete().in('id', teVerwijderen).eq('user_id', userId);
  }

  const verwijderd = new Set(teVerwijderen);
  const huidig = bestaand.filter((d) => !verwijderd.has(d.id));
  const fondsVan = (ctx) => String((ctx && ctx.fonds) || '').trim().toLowerCase();

  // 2. Bestaande documenten waarvan het lid de soort of naam wijzigde.
  for (const d of project.docs || []) {
    const rij = d.id ? huidig.find((x) => x.id === d.id) : null;

    if (rij && (d.soort && d.soort !== (rij.doc_type || rij.notes) || (d.naam && d.naam !== rij.title))) {
      await supabase
        .from('subsidie_kompas_knowledge_items')
        .update({ title: d.naam || rij.title, file_name: d.naam || rij.title, notes: d.soort || null, doc_type: d.soort || null, updated_at: new Date().toISOString() })
        .eq('id', rij.id)
        .eq('user_id', userId);
    }
  }

  // 3. Nieuwe documenten: als nieuwe versie van dezelfde soort + hetzelfde fonds.
  const docs = [];

  for (const d of project.docs || []) {
    if (!d.naam) {
      continue;
    }

    if (d.id && huidig.some((x) => x.id === d.id)) {
      docs.push(d);

      continue;
    }

    const soort = d.soort || 'Overig';
    const context = d.context && typeof d.context === 'object' ? d.context : {};
    const zelfde = huidig.filter((x) => (x.doc_type || x.notes) === soort && fondsVan(x.document_context) === fondsVan(context));
    const versie = zelfde.reduce((m, x) => Math.max(m, x.version || 1), 0) + 1;
    const docId = isEchtId(d.id) ? d.id : nieuwUuid();

    const { error: docFout } = await supabase.from('subsidie_kompas_knowledge_items').insert({
      id: docId,
      user_id: userId,
      organization_id: organizationId,
      program_id: id,
      title: d.naam,
      file_name: d.naam,
      notes: soort,
      doc_type: soort,
      version: versie,
      document_context: context,
      extracted_text: d.tekst || null,
      source_type: d.bron || 'upload',
      status: 'ready',
    });

    if (docFout) {
      continue;
    }

    // De vorige versie blijft bestaan, maar telt niet meer als de huidige.
    const vervangen = zelfde.filter((x) => !x.superseded_at).map((x) => x.id);

    if (vervangen.length) {
      await supabase
        .from('subsidie_kompas_knowledge_items')
        .update({ superseded_at: new Date().toISOString() })
        .in('id', vervangen)
        .eq('user_id', userId);
    }

    huidig.push({ id: docId, doc_type: soort, notes: soort, title: d.naam, document_context: context, version: versie, superseded_at: null });
    docs.push({ ...d, id: docId, versie, context, vervangen: false });
  }

  return { id, error: null, docs };
}

// Archiveren is de veilige standaard: niets gaat verloren, het project doet
// alleen niet meer mee als actief project of in matching.
export async function archiveerProject(id, archiveren = true) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(id)) {
    return false;
  }

  const { error } = await supabase
    .from('subsidie_kompas_programs')
    .update({ archived_at: archiveren ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (!error && archiveren) {
    // Gesprekken die dit project als actief project hadden, krijgen er geen meer.
    await supabase.from('subsidie_kompas_conversations').update({ active_program_id: null }).eq('active_program_id', id).eq('user_id', userId);
  }

  return !error;
}

export async function verwijderDocument(id) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(id)) {
    return false;
  }

  const { error } = await supabase.from('subsidie_kompas_knowledge_items').delete().eq('id', id).eq('user_id', userId);

  return !error;
}

// Verwijdert een project definitief. Referentiële integriteit staat in de
// database: documenten en websitebronnen van het project gaan mee
// (ON DELETE CASCADE); gesprekken en berichten blijven bestaan en verliezen
// alleen hun projectkoppeling (ON DELETE SET NULL). Er blijven dus geen
// documenten zonder project achter.
export async function verwijderProject(id) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(id)) {
    return false;
  }

  const { error } = await supabase.from('subsidie_kompas_programs').delete().eq('id', id).eq('user_id', userId);

  return !error;
}
