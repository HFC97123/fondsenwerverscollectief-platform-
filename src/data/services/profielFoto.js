// Profielfoto en beschrijving (bio) van het ingelogde lid.
//
// * Foto: Supabase Storage, bucket 'profile-images' (privé, max. 5 MB, JPEG/PNG/WebP),
//   pad <user_id>/avatar-<tijd>-<willekeur>.<jpg|png|webp>. In public.profiles staat
//   alleen het pad (avatar_path), nooit de afbeelding zelf. Getoond met een
//   tijdelijke signed URL, zodat de foto niet openbaar is.
// * Schrijven loopt via de SECURITY DEFINER-RPC's zet_mijn_avatar / zet_mijn_bio:
//   een lid kan alleen zijn eigen rij en alleen deze twee kolommen wijzigen.
// * Een nieuwe foto is een nieuw bestand (er is geen overschrijf-policy); het
//   vorige bestand wordt daarna opgeruimd.
import { useEffect, useState } from 'react';
import { supabase } from '../client.js';

export const PROFIEL_BUCKET = 'profile-images';
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const FOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_BIO_TEKENS = 2000;

const MELDING_UPLOAD = 'De foto kon niet worden opgeslagen. Probeer het later opnieuw.';
const MELDING_VERWIJDEREN = 'De foto kon niet worden verwijderd. Probeer het later opnieuw.';
const MELDING_BIO = 'De beschrijving kon niet worden opgeslagen. Probeer het later opnieuw.';

const mb = (bytes) => (bytes / (1024 * 1024)).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Controle vóór het uploaden: toegestaan type, niet leeg, niet te groot.
export function valideerFoto(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, fout: 'Kies eerst een afbeelding.' };
  }

  if (!Object.prototype.hasOwnProperty.call(FOTO_TYPES, file.type)) {
    return { ok: false, fout: 'Dit bestandstype wordt niet ondersteund. Kies een JPEG-, PNG- of WebP-afbeelding.' };
  }

  if (!(file.size > 0)) {
    return { ok: false, fout: 'Dit bestand is leeg. Kies een andere afbeelding.' };
  }

  if (file.size > MAX_FOTO_BYTES) {
    return {
      ok: false,
      fout: `De foto is te groot (${mb(file.size)} MB). De maximale grootte is ${mb(MAX_FOTO_BYTES)} MB.`,
    };
  }

  return { ok: true };
}

const willekeur = () => Math.random().toString(36).slice(2, 10).padEnd(4, '0');

// <user_id>/avatar-<ms>-<willekeur>.<ext>; de extensie volgt het type, niet de bestandsnaam.
export function maakFotoPad(userId, mime, nu = Date.now(), rand = willekeur()) {
  return `${userId}/avatar-${nu}-${rand}.${FOTO_TYPES[mime]}`;
}

// Bio: bijgesneden; leeg betekent 'geen beschrijving'.
export function normaliseerBio(tekst) {
  return typeof tekst === 'string' ? tekst.trim() : '';
}

export function valideerBio(tekst) {
  const bio = normaliseerBio(tekst);

  if (bio.length > MAX_BIO_TEKENS) {
    return { ok: false, fout: `De beschrijving mag maximaal ${MAX_BIO_TEKENS} tekens bevatten (nu ${bio.length}).` };
  }

  return { ok: true, bio };
}

const opruimen = async (pad) => {
  if (!pad) {
    return;
  }

  try {
    await supabase.storage.from(PROFIEL_BUCKET).remove([pad]);
  } catch (e) {
    // Opruimen is best effort; een achtergebleven bestand is onschuldig (eigen, privé map).
  }
};

// Voegt een foto toe of vervangt de huidige. Geeft { pad } of { fout }.
export async function uploadProfielFoto({ userId, file, oudPad }) {
  const v = valideerFoto(file);

  if (!v.ok) {
    return { fout: v.fout };
  }

  if (!supabase || !userId) {
    return { fout: MELDING_UPLOAD };
  }

  const pad = maakFotoPad(userId, file.type);

  try {
    const up = await supabase.storage.from(PROFIEL_BUCKET).upload(pad, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

    if (up.error) {
      return { fout: MELDING_UPLOAD };
    }

    const rpc = await supabase.rpc('zet_mijn_avatar', { p_pad: pad });

    if (rpc.error) {
      await opruimen(pad);

      return { fout: MELDING_UPLOAD };
    }
  } catch (e) {
    await opruimen(pad);

    return { fout: MELDING_UPLOAD };
  }

  if (oudPad && oudPad !== pad) {
    await opruimen(oudPad);
  }

  return { pad };
}

// Verwijdert de foto: eerst de verwijzing in het profiel, daarna het bestand.
export async function verwijderProfielFoto({ oudPad }) {
  if (!supabase) {
    return { fout: MELDING_VERWIJDEREN };
  }

  try {
    const rpc = await supabase.rpc('zet_mijn_avatar', { p_pad: null });

    if (rpc.error) {
      return { fout: MELDING_VERWIJDEREN };
    }
  } catch (e) {
    return { fout: MELDING_VERWIJDEREN };
  }

  await opruimen(oudPad);

  return { ok: true };
}

// Slaat de beschrijving op. Geeft { ok: true } of { fout }.
export async function slaBioOp(tekst) {
  const v = valideerBio(tekst);

  if (!v.ok) {
    return { fout: v.fout };
  }

  if (!supabase) {
    return { fout: MELDING_BIO };
  }

  try {
    const rpc = await supabase.rpc('zet_mijn_bio', { p_bio: v.bio });

    if (rpc.error) {
      return { fout: MELDING_BIO };
    }
  } catch (e) {
    return { fout: MELDING_BIO };
  }

  return { ok: true };
}

// Tijdelijke (signed) URL van een foto, gecachet tot vlak voor het verlopen.
const URL_GELDIG_SECONDEN = 3600;
const urlCache = new Map();

export async function haalFotoUrl(pad) {
  if (!pad || !supabase) {
    return null;
  }

  const hit = urlCache.get(pad);

  if (hit && hit.tot > Date.now() + 60000) {
    return hit.url;
  }

  try {
    const { data, error } = await supabase.storage.from(PROFIEL_BUCKET).createSignedUrl(pad, URL_GELDIG_SECONDEN);

    if (error || !data || !data.signedUrl) {
      return null;
    }

    urlCache.set(pad, { url: data.signedUrl, tot: Date.now() + URL_GELDIG_SECONDEN * 1000 });

    return data.signedUrl;
  } catch (e) {
    return null;
  }
}

// Geeft de URL van het opgeslagen pad (null zonder pad, tijdens laden of bij een fout).
export function useProfielFotoUrl(pad) {
  const [opgelost, setOpgelost] = useState({ pad: null, url: null });

  useEffect(() => {
    let actief = true;

    if (!pad) {
      return undefined;
    }

    haalFotoUrl(pad).then((url) => {
      if (actief) {
        setOpgelost({ pad, url });
      }
    });

    return () => {
      actief = false;
    };
  }, [pad]);

  return pad && opgelost.pad === pad ? opgelost.url : null;
}
