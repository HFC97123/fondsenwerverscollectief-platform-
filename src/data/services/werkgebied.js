// Vraagt de server om plaatsen uit de projectomschrijving die het gekozen werkgebied kunnen verfijnen (Edge Function 'subsidie-kompas', modus
// 'werkgebied-verfijning'). Alleen LEZEN: de server geeft voorstellen terug en schrijft niets. Opslaan gebeurt pas nadat het lid een voorstel bevestigt,
// via het gewone opslaan van het project. Een fout of een niet-beschikbare dienst betekent gewoon: geen voorstellen (het formulier blijft werken).
import { supabase } from '../client.js';

export const WERKGEBIED_FUNCTION = 'subsidie-kompas';
export const WERKGEBIED_MODUS = 'werkgebied-verfijning';

export async function haalVerfijningsvoorstellen({ tekst, landen }) {
  if (!supabase || !String(tekst || '').trim() || !Array.isArray(landen) || !landen.length) {
    return { ok: true, suggesties: [] };
  }

  try {
    const { data, error } = await supabase.functions.invoke(WERKGEBIED_FUNCTION, { body: { mode: WERKGEBIED_MODUS, tekst: String(tekst), landen } });

    if (error || !data || data.ok !== true || !Array.isArray(data.suggesties)) {
      return { ok: false, suggesties: [] };
    }

    return { ok: true, suggesties: data.suggesties };
  } catch (e) {
    return { ok: false, suggesties: [] };
  }
}
