// Vraagt de server om een PREVIEW van een voorstel (Edge Function 'subsidie-kompas', mode 'voorstel-preview'). Alleen lezen: de server
// valideert, past de rechten per regel toe, controleert de bronnen en geeft previewdata terug. Er wordt niets opgeslagen.
// De client bepaalt hier niets: geen status, geen token, geen verificatie. Elke fout (geen verbinding, geen sessie, functie uit, 4xx/5xx,
// onverwacht antwoord) levert { ok: false } op, nooit een deels gevuld resultaat.
import { supabase } from '../client.js';

export const PREVIEW_FUNCTION = 'subsidie-kompas';

export async function vraagVoorstelPreview({ projectId, voorstel }) {
  if (!supabase || typeof projectId !== 'string' || !projectId || !voorstel || typeof voorstel !== 'object') {
    return { ok: false, antwoord: null };
  }

  try {
    const { data, error } = await supabase.functions.invoke(PREVIEW_FUNCTION, { body: { mode: 'voorstel-preview', projectId, voorstel } });

    if (error || !data || typeof data !== 'object' || data.ok !== true) {
      return { ok: false, antwoord: null };
    }

    return { ok: true, antwoord: data };
  } catch (e) {
    return { ok: false, antwoord: null };
  }
}
