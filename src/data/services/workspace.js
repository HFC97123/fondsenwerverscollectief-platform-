// De werkomgeving: profiel, projecten, documentatie, gesprekken, voorkeuren.
//
// Twee bronnen, één ingang. Is een lid ingelogd en staat Supabase klaar, dan
// gaat alles naar de database. Anders naar localStorage, zodat de werkomgeving
// ook zonder verbinding blijft werken.
//
// Tabellen: zie supabase/migrations/0003_werkomgeving.sql
import { supabase } from '../client.js';

const STORAGE_KEY = 'sk-werkomgeving';

export const LEEG = {
  orgProfile: {},
  projects: [],
  genDocs: [],
  conversations: [],
  deadlines: [],
  memberVisible: true,
  reminderMail: true,
  reminderDays: 14,
};

/* ---------- lokaal ---------- */

export function laadWerkomgeving() {
  try {
    const ruw = window.localStorage.getItem(STORAGE_KEY);

    return ruw ? { ...LEEG, ...JSON.parse(ruw) } : { ...LEEG };
  } catch (e) {
    return { ...LEEG };
  }
}

export function bewaarWerkomgeving(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // geen opslag beschikbaar; de sessie blijft in het geheugen werken
  }
}

/* ---------- Supabase ---------- */

async function profielId() {
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

// Haalt de hele werkomgeving op. Geeft null terug als er geen sessie is; de
// aanroeper valt dan terug op localStorage.
export async function haalWerkomgevingOp() {
  const id = await profielId();

  if (!id) {
    return null;
  }

  const veilig = async (fn) => {
    try {
      const res = await fn();

      return res.error ? null : res.data;
    } catch (e) {
      return null;
    }
  };

  const [profiel, projecten, docs, gesprekken, voorkeuren] = await Promise.all([
    veilig(() => supabase.from('organisatieprofielen').select('*').eq('profile_id', id).maybeSingle()),
    veilig(() =>
      supabase
        .from('projecten')
        .select(
          '*, aanvragen:project_aanvragen (*), cofinanciers:project_cofinanciers (*), regelingen:project_regelingen (*), documenten:project_documenten (*)',
        )
        .eq('profile_id', id)
        .order('created_at', { ascending: false }),
    ),
    veilig(() =>
      supabase
        .from('documentatie')
        .select('*, versies:documentatie_versies (*)')
        .eq('profile_id', id)
        .order('updated_at', { ascending: false }),
    ),
    veilig(() =>
      supabase.from('gesprekken').select('*').eq('profile_id', id).order('updated_at', { ascending: false }),
    ),
    veilig(() => supabase.from('lid_voorkeuren').select('*').eq('profile_id', id).maybeSingle()),
  ]);

  // Kon niets worden gelezen, dan bestaan de tabellen nog niet.
  if (profiel === null && projecten === null && docs === null && gesprekken === null) {
    return null;
  }

  const { profile_id: _weg, updated_at: _ook, ...profielVelden } = profiel || {};

  return {
    ...LEEG,
    orgProfile: profielVelden,
    projects: projecten || [],
    genDocs: docs || [],
    conversations: (gesprekken || []).map((g) => ({
      id: g.id,
      titel: g.titel,
      berichten: g.berichten || [],
      tijd: g.updated_at,
    })),
    memberVisible: voorkeuren ? voorkeuren.zichtbaar_in_ledenlijst : true,
    reminderMail: voorkeuren ? voorkeuren.herinnering_mail : true,
    reminderDays: voorkeuren ? voorkeuren.herinnering_dagen : 14,
  };
}

export async function bewaarOrgProfiel(velden) {
  const id = await profielId();

  if (!id) {
    return false;
  }

  const { error } = await supabase
    .from('organisatieprofielen')
    .upsert({ ...velden, profile_id: id, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });

  return !error;
}

export async function bewaarVoorkeuren({ memberVisible, reminderMail, reminderDays }) {
  const id = await profielId();

  if (!id) {
    return false;
  }

  const { error } = await supabase.from('lid_voorkeuren').upsert(
    {
      profile_id: id,
      zichtbaar_in_ledenlijst: memberVisible,
      herinnering_mail: reminderMail,
      herinnering_dagen: reminderDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );

  return !error;
}

export async function bewaarGesprek({ id: gesprekId, titel, berichten }) {
  const id = await profielId();

  if (!id) {
    return null;
  }

  const rij = {
    profile_id: id,
    titel,
    berichten,
    updated_at: new Date().toISOString(),
  };

  if (gesprekId) {
    rij.id = gesprekId;
  }

  const { data, error } = await supabase.from('gesprekken').upsert(rij).select('id').single();

  return error ? null : data.id;
}

export async function verwijderGesprekken() {
  const id = await profielId();

  if (!id) {
    return false;
  }

  const { error } = await supabase.from('gesprekken').delete().eq('profile_id', id);

  return !error;
}

// Verwijdert het organisatieprofiel en alles wat eraan hangt.
export async function verwijderOrganisatiegegevens() {
  const id = await profielId();

  if (!id) {
    return false;
  }

  const uitkomsten = await Promise.all([
    supabase.from('organisatieprofielen').delete().eq('profile_id', id),
    supabase.from('projecten').delete().eq('profile_id', id),
    supabase.from('documentatie').delete().eq('profile_id', id),
  ]);

  return uitkomsten.every((r) => !r.error);
}

/* ---------- bestanden ---------- */

export const BUCKET_PROJECT = 'project-documenten';
export const BUCKET_DOCS = 'documentatie';

// Pad altijd <profile_id>/<bestandsnaam>, want daarop staat de RLS-policy.
function veiligePad(id, naam) {
  const schoon = String(naam || 'bestand')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-');

  return `${id}/${Date.now()}-${schoon}`;
}

export async function uploadProjectDocument(file, projectId) {
  const id = await profielId();

  if (!id) {
    return { pad: null, error: 'U moet ingelogd zijn om een bestand te bewaren.' };
  }

  const pad = veiligePad(id, file.name);
  const { error } = await supabase.storage.from(BUCKET_PROJECT).upload(pad, file, { upsert: false });

  if (error) {
    return { pad: null, error: 'Het bestand kon niet worden bewaard.' };
  }

  await supabase.from('project_documenten').insert({
    project_id: projectId,
    naam: file.name,
    grootte: file.size,
    opslagpad: pad,
  });

  return { pad, error: null };
}

// Tijdelijke link naar een privébestand; standaard een uur geldig.
export async function bestandsLink(bucket, pad, seconden = 3600) {
  if (!supabase || !pad) {
    return null;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(pad, seconden);

  return error ? null : data.signedUrl;
}
