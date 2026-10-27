// Vraagt de server om disciplines, doelgroepen en werkgebieden voor te stellen uit de projectomschrijving en de eigen woorden van het lid
// (Edge Function 'subsidie-kompas', modus 'trefwoorden-koppelen'). Alleen LEZEN: de server geeft voorstellen terug en schrijft niets. Een fout
// of niet-beschikbare dienst betekent: geen voorstellen en een nette melding; het formulier en de eigen woorden blijven gewoon werken.
import { supabase } from '../client.js';

export const TREFWOORDEN_FUNCTION = 'subsidie-kompas';
export const TREFWOORDEN_MODUS = 'trefwoorden-koppelen';

const REDENEN = { daglimiet: 'daglimiet', 'ai-fout': 'storing', 'geen-taxonomie': 'storing', 'geen-ai': 'storing' };

// Geeft altijd { ok, beschikbaar, reden, voorstellen, nietGekoppeld }. reden: 'daglimiet' | 'storing' | null.
export async function haalTrefwoordVoorstellen({ tekst, eigenTermen, gekozen }) {
  const woorden = (Array.isArray(eigenTermen) ? eigenTermen : []).map((w) => String(w && typeof w === 'object' ? w.woord : w || ''));
  const leeg = { ok: false, beschikbaar: false, reden: 'storing', voorstellen: [], nietGekoppeld: woorden };

  if (!supabase) return leeg;

  try {
    const { data, error } = await supabase.functions.invoke(TREFWOORDEN_FUNCTION, { body: { mode: TREFWOORDEN_MODUS, tekst: String(tekst || ''), eigenTermen: woorden, gekozen: gekozen || {} } });

    if (error || !data || data.ok !== true || !Array.isArray(data.voorstellen)) return leeg;

    return {
      ok: true,
      beschikbaar: data.beschikbaar !== false,
      reden: data.beschikbaar === false ? REDENEN[data.reden] || 'storing' : null,
      voorstellen: data.voorstellen,
      nietGekoppeld: Array.isArray(data.nietGekoppeld) ? data.nietGekoppeld : [],
    };
  } catch (e) {
    return leeg;
  }
}
