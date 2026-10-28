// De eigen huisstijl voor documenten (Premium), bewaard in subsidie_kompas_organizations.document_huisstijl.
// Eén object per organisatie: { versie, naam, primair, accent, logo (data-URL), logoBreedte, logoHoogte }. Leeg = de Subsidie Kompas-huisstijl.
// Het logo wordt in de browser verkleind (zie verkleinLogo) en als data-URL bewaard: er is geen aparte bestandsopslag voor nodig en de exportlaag kan het zonder extra rechten laden.
import { supabase } from '../client.js';
import { MAX_LOGO_TEKENS, normaliseerHuisstijl, pasLogoMaten } from '../../shared/document-theme/huisstijl.js';

async function huidigeGebruiker() {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getUser();

    return data?.user?.id || null;
  } catch (e) {
    return null;
  }
}

// -> het schone huisstijlobject, of null (geen eigen huisstijl, geen sessie of de kolom bestaat nog niet).
export async function haalHuisstijl() {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) return null;

  try {
    const { data, error } = await supabase.from('subsidie_kompas_organizations').select('document_huisstijl').eq('user_id', userId).maybeSingle();

    if (error || !data) return null;

    return normaliseerHuisstijl(data.document_huisstijl);
  } catch (e) {
    return null;
  }
}

// huisstijl: het object uit het formulier. null of leeg = terug naar de Subsidie Kompas-huisstijl.
// -> { ok: true, huisstijl } | { ok: false, reden: 'geen-sessie' | 'ongeldig' | 'fout' }
export async function bewaarHuisstijl(huisstijl) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) return { ok: false, reden: 'geen-sessie' };

  const schoon = huisstijl == null ? null : normaliseerHuisstijl(huisstijl);

  if (huisstijl != null && !schoon) return { ok: false, reden: 'ongeldig' };

  try {
    const { data: bestaand } = await supabase.from('subsidie_kompas_organizations').select('id').eq('user_id', userId).maybeSingle();

    if (bestaand && bestaand.id) {
      const { error } = await supabase.from('subsidie_kompas_organizations').update({ document_huisstijl: schoon }).eq('id', bestaand.id).eq('user_id', userId);

      return error ? { ok: false, reden: 'fout' } : { ok: true, huisstijl: schoon };
    }

    // Nog geen organisatieprofiel: dan maken we een lege organisatie aan, zoals bij het eerste organisatiedocument.
    const { error } = await supabase.from('subsidie_kompas_organizations').insert({ user_id: userId, organization_name: 'Naamloze organisatie', document_huisstijl: schoon });

    return error ? { ok: false, reden: 'fout' } : { ok: true, huisstijl: schoon };
  } catch (e) {
    return { ok: false, reden: 'fout' };
  }
}

// Een gekozen afbeelding (PNG of JPG) -> { logo, logoBreedte, logoHoogte } of { fout }. Verkleint in de browser tot hoogstens 600 bij 240 px (scherp genoeg voor een voorblad)
// en bewaart het als PNG; zo blijft de data-URL klein en houdt een transparante achtergrond zijn transparantie.
export async function verkleinLogo(bestand, { Afbeelding = typeof Image !== 'undefined' ? Image : null, maakCanvas = () => document.createElement('canvas'), leesAlsUrl = leesBestandAlsUrl } = {}) {
  if (!bestand || !/^image\/(png|jpeg)$/.test(bestand.type || '')) return { fout: 'Kies een PNG- of JPG-bestand.' };
  if (bestand.size > 5 * 1024 * 1024) return { fout: 'Het bestand is te groot. Kies een logo van hoogstens 5 MB.' };

  try {
    const bron = await leesAlsUrl(bestand);
    const img = await laadAfbeelding(Afbeelding, bron);
    const f = Math.min(600 / img.width, 240 / img.height, 1);
    const b = Math.max(1, Math.round(img.width * f));
    const h = Math.max(1, Math.round(img.height * f));
    const canvas = maakCanvas();

    canvas.width = b;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, b, h);

    const logo = canvas.toDataURL('image/png');

    if (logo.length > MAX_LOGO_TEKENS) return { fout: 'Dit logo is te zwaar. Kies een eenvoudiger of kleiner bestand.' };

    const maten = pasLogoMaten(b, h);

    return { logo, logoBreedte: maten.breedte, logoHoogte: maten.hoogte };
  } catch (e) {
    return { fout: 'Het logo kon niet worden gelezen. Probeer een ander bestand.' };
  }
}

function leesBestandAlsUrl(bestand) {
  return new Promise((resolve, reject) => {
    const lezer = new FileReader();

    lezer.onload = () => resolve(String(lezer.result));
    lezer.onerror = () => reject(new Error('lezen mislukt'));
    lezer.readAsDataURL(bestand);
  });
}

function laadAfbeelding(Afbeelding, bron) {
  return new Promise((resolve, reject) => {
    if (!Afbeelding) {
      reject(new Error('geen afbeeldingen'));

      return;
    }

    const img = new Afbeelding();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('geen afbeelding'));
    img.src = bron;
  });
}
