// De werkomgeving: profiel, projecten, documentatie, gesprekken, voorkeuren.
//
// Twee bronnen, één ingang. Is een lid ingelogd en staat Supabase klaar, dan
// gaat alles naar de database. Anders naar localStorage, zodat de werkomgeving
// ook zonder verbinding blijft werken.
//
// Tabellen: zie supabase/migrations/0003_werkomgeving.sql
import { supabase } from '../client.js';

// Lokale terugval (alleen projecten/gesprekken/voorkeuren/documentatie), ALTIJD
// per ingelogde gebruiker: de sleutel bevat het user_id. Vroeger was dit één
// gedeelde sleutel ('sk-werkomgeving') voor de hele browser, waardoor het
// organisatieprofiel (en meer) van het ene account bij het volgende account
// in dezelfde browser terechtkwam. Die oude gedeelde sleutel wordt niet meer
// gelezen (zie ruimOudeGedeeldeOpslagOp()).
const OUDE_GEDEELDE_SLEUTEL = 'sk-werkomgeving';
const STORAGE_PREFIX = 'sk-werkomgeving:';

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

function sleutelVoor(userId) {
  return userId ? `${STORAGE_PREFIX}${userId}` : null;
}

// Het organisatieprofiel (en daarmee organisatiegeheugen) staat uitsluitend in
// de database, gekoppeld aan het user_id (subsidie_kompas_organizations). Het
// wordt nooit lokaal bewaard of teruggelezen: een lokale kopie kan nooit
// bij een ander account terechtkomen als er geen kopie is.
export function laadWerkomgeving(userId) {
  const sleutel = sleutelVoor(userId);

  if (!sleutel) {
    return { ...LEEG };
  }

  try {
    const ruw = window.localStorage.getItem(sleutel);

    return ruw ? { ...LEEG, ...JSON.parse(ruw), orgProfile: {} } : { ...LEEG };
  } catch (e) {
    return { ...LEEG };
  }
}

export function bewaarWerkomgeving(userId, state) {
  const sleutel = sleutelVoor(userId);

  // Zonder ingelogde gebruiker wordt niets lokaal bewaard.
  if (!sleutel) {
    return;
  }

  try {
    const { orgProfile, ...zonderOrganisatie } = state || {};

    window.localStorage.setItem(sleutel, JSON.stringify(zonderOrganisatie));
  } catch (e) {
    // geen opslag beschikbaar; de sessie blijft in het geheugen werken
  }
}

// Eenmalig: haalt uitsluitend het organisatieprofiel uit de oude, gedeelde
// browseropslag. De rest van die oude sleutel blijft onaangeroerd (en wordt
// niet meer gelezen), zodat er niets van een lid wordt verwijderd.
export function ruimOudeGedeeldeOpslagOp() {
  try {
    const ruw = window.localStorage.getItem(OUDE_GEDEELDE_SLEUTEL);

    if (!ruw) {
      return;
    }

    const oud = JSON.parse(ruw);

    if (oud && typeof oud === 'object' && 'orgProfile' in oud) {
      delete oud.orgProfile;
      window.localStorage.setItem(OUDE_GEDEELDE_SLEUTEL, JSON.stringify(oud));
    }
  } catch (e) {
    // niets te doen
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

  // Let op: het organisatieprofiel loopt niet meer via dit bestand - zie
  // data/services/organisatieprofiel.js (subsidie_kompas_organizations).
  // Projecten lopen ook niet meer hier - zie data/services/projecten.js
  // (subsidie_kompas_programs). Gesprekken lopen ook niet meer hier - zie
  // data/services/gesprekken.js (subsidie_kompas_conversations/messages).
  // Documentatie/voorkeuren wachten nog op een eigen fase; de tabellen
  // hieronder bestaan nog niet, dus dit blijft voorlopig altijd stil
  // terugvallen op localStorage.
  const [projecten, docs, voorkeuren] = await Promise.all([
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
    veilig(() => supabase.from('lid_voorkeuren').select('*').eq('profile_id', id).maybeSingle()),
  ]);

  // Kon niets worden gelezen, dan bestaan de tabellen nog niet.
  if (projecten === null && docs === null) {
    return null;
  }

  return {
    ...LEEG,
    projects: projecten || [],
    genDocs: docs || [],
    memberVisible: voorkeuren ? voorkeuren.zichtbaar_in_ledenlijst : true,
    reminderMail: voorkeuren ? voorkeuren.herinnering_mail : true,
    reminderDays: voorkeuren ? voorkeuren.herinnering_dagen : 14,
  };
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
