// Ledenlijst op de Collectief-pagina (migratie 20261030140000_ledenlijst).
// * ledenlijst(): alleen voor goedgekeurde leden; geeft alleen leden die zelf "zichtbaar" aanzetten.
//   Het e-mailadres komt alleen mee als dat lid het zelf zichtbaar maakt.
// * zet_mijn_ledengegevens: eigen website en de twee schakelaars (zichtbaar in de lijst, e-mail zichtbaar).
// Organisatie en functie staan in profile_onboarding (zie onboarding.js).
import { supabase } from '../client.js';

export const MAX_WEBSITE_TEKENS = 200;

// Toont een webadres zonder https:// en zonder / aan het eind.
export function websiteLabel(url) {
  return typeof url === 'string' ? url.replace(/^https?:\/\//i, '').replace(/\/$/, '') : '';
}

// Alleen http(s)-adressen worden een link (de database controleert dit ook).
export function veiligeWebsite(url) {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url) ? url : '';
}

export const SOORT_LID = { zzp: 'Zelfstandig fondsenwerver', org: 'Organisatie / non-profit', orient: 'Oriënterend' };

export async function haalLedenlijst() {
  if (!supabase) return { leden: [], fout: 'Nu niet beschikbaar.' };

  try {
    const { data, error } = await supabase.rpc('ledenlijst');

    if (error) return { leden: [], fout: 'De ledenlijst kon niet worden geladen.' };

    return { leden: data || [], fout: null };
  } catch (e) {
    return { leden: [], fout: 'De ledenlijst kon niet worden geladen.' };
  }
}

export async function zetMijnLedengegevens({ website, profielZichtbaar, emailZichtbaar }) {
  if (!supabase) return { fout: 'Nu niet beschikbaar.' };

  try {
    const { error } = await supabase.rpc('zet_mijn_ledengegevens', {
      p_website: (website || '').trim() || null,
      p_profiel_zichtbaar: Boolean(profielZichtbaar),
      p_email_zichtbaar: Boolean(emailZichtbaar),
    });

    if (error) {
      return { fout: /webadres/i.test(error.message || '') ? 'Vul een geldig webadres in, bijvoorbeeld www.mijnwebsite.nl.' : 'Opslaan is niet gelukt. Probeer het later opnieuw.' };
    }

    return { fout: null };
  } catch (e) {
    return { fout: 'Opslaan is niet gelukt. Probeer het later opnieuw.' };
  }
}
