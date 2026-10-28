// Vraagt de server om het projectdossier in te vullen uit de tekst van een document dat het lid uploadde (Edge Function 'subsidie-kompas', modus
// 'dossier-uitlezen'). De browser las het bestand zelf uit; alleen de tekst gaat mee, en alleen op verzoek van het lid. Alleen LEZEN: de server geeft
// voorstellen terug en schrijft niets. Een fout of niet-beschikbare dienst betekent: geen voorstellen en een nette melding; het formulier blijft werken.
import { supabase } from '../client.js';

export const DOSSIER_FUNCTION = 'subsidie-kompas';
export const DOSSIER_MODUS = 'dossier-uitlezen';

const REDENEN = { daglimiet: 'daglimiet', 'ai-fout': 'storing', 'geen-ai': 'storing', 'te-weinig-tekst': 'te-weinig-tekst', 'niets-gevonden': 'niets-gevonden', 'alleen-pro': 'alleen-pro' };

// Geeft altijd { ok, beschikbaar, reden, voorstellen: [{ key, tekst, bewijs }] }. reden: 'daglimiet' | 'storing' | 'te-weinig-tekst' | 'niets-gevonden' | 'alleen-pro' | null.
export async function haalDossierVoorstellen({ tekst, huidig }) {
  const leeg = { ok: false, beschikbaar: false, reden: 'storing', voorstellen: [] };

  if (!supabase) return leeg;

  try {
    const { data, error } = await supabase.functions.invoke(DOSSIER_FUNCTION, { body: { mode: DOSSIER_MODUS, tekst: String(tekst || ''), huidig: Array.isArray(huidig) ? huidig : [] } });

    if (error) {
      // Een 403 van de server (Free) komt als fout met een antwoord erin binnen.
      let reden = 'storing';

      try {
        const j = error.context && typeof error.context.json === 'function' ? await error.context.json() : null;

        if (j && j.reden === 'alleen-pro') reden = 'alleen-pro';
      } catch (_e) {
        // geen leesbaar antwoord
      }

      return { ...leeg, reden };
    }

    if (!data || data.ok !== true || !Array.isArray(data.voorstellen)) return leeg;

    return {
      ok: true,
      beschikbaar: data.beschikbaar !== false,
      reden: data.reden ? REDENEN[data.reden] || 'storing' : null,
      voorstellen: data.voorstellen.filter((v) => v && typeof v.key === 'string' && typeof v.tekst === 'string' && v.tekst.trim()),
    };
  } catch (e) {
    return leeg;
  }
}
