// Projecten (Pro/Premium), opgeslagen in subsidie_kompas_programs. Documenten
// per project lopen via subsidie_kompas_knowledge_items (program_id) - dezelfde
// tabel die in een volgende fase ook voor document-upload/-extractie wordt
// gebruikt.
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
  };
}

function naarDocVeld(rij) {
  return {
    id: rij.id,
    naam: rij.file_name || rij.title || 'Document',
    soort: rij.notes || 'Overig',
    grootte: '',
    tekst: rij.extracted_text || '',
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
      .select('id, program_id, file_name, title, notes, extracted_text')
      .in('program_id', ids);

    docsPerProject = (docs || []).reduce((acc, d) => {
      (acc[d.program_id] = acc[d.program_id] || []).push(naarDocVeld(d));

      return acc;
    }, {});
  }

  return (programs || []).map((p) => naarProjectVeld(p, docsPerProject[p.id]));
}

// Bewaart één project (nieuw of bestaand). Documenten worden volledig
// vervangen door de meegegeven lijst, want het scherm bewerkt en bewaart een
// project altijd als geheel (zelfde patroon als de rest van deze pagina).
export async function bewaarProject(project) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { id: null, error: 'geen-sessie' };
  }

  const kolomPatch = naarKolomPatch(project);
  let id = project.id;

  if (!id) {
    const organizationId = await huidigeOfNieuweOrganisatie(userId);

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

  // Documenten: bestaande rijen voor dit project weg, huidige lijst opnieuw
  // aanmaken. Kleine, overzichtelijke lijstjes (zelfde als eerder/cofin), dus
  // dit is niet duurder dan een verstandig diff'en.
  await supabase.from('subsidie_kompas_knowledge_items').delete().eq('program_id', id).eq('user_id', userId);

  const nieuweDocs = (project.docs || []).filter((d) => d.naam);

  if (nieuweDocs.length) {
    const { data: orgRij } = await supabase
      .from('subsidie_kompas_programs')
      .select('organization_id')
      .eq('id', id)
      .single();

    await supabase.from('subsidie_kompas_knowledge_items').insert(
      nieuweDocs.map((d) => ({
        user_id: userId,
        organization_id: orgRij?.organization_id || null,
        program_id: id,
        title: d.naam,
        file_name: d.naam,
        notes: d.soort || null,
        extracted_text: d.tekst || null,
        source_type: 'upload',
        status: 'ready',
      })),
    );
  }

  return { id, error: null };
}

export async function verwijderProject(id) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return false;
  }

  // knowledge_items.program_id staat op ON DELETE SET NULL, niet CASCADE -
  // expliciet opruimen, anders blijven documenten van een verwijderd project
  // ongekoppeld in de kennisbank staan.
  await supabase.from('subsidie_kompas_knowledge_items').delete().eq('program_id', id).eq('user_id', userId);

  const { error } = await supabase.from('subsidie_kompas_programs').delete().eq('id', id).eq('user_id', userId);

  return !error;
}
