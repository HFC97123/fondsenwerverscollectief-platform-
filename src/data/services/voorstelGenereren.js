// Vraagt de server om een voorstel voor het dekkingsplan en actieplan van een project (Edge Function 'subsidie-kompas', modes
// 'voorstel-genereren' en 'voorstel-aanvullen'). Alleen LEZEN: de server geeft een voorstel terug en schrijft niets. Opslaan gebeurt pas
// na een klik van het lid, via de bestaande opslagpaden (projectFinanciering.js en projectActies.js).
// De client bepaalt hier niets: geen abonnement, geen bedrag, geen dekkingsdoel. Elke fout levert { ok: false, reden, melding } op.
import { supabase } from '../client.js';

export const GENEREREN_FUNCTION = 'subsidie-kompas';

const ALGEMENE_FOUT = 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen. Probeer het later opnieuw.';
const OVERZICHT = {
  'niet-beschikbaar-voor-abonnement': 'Het dekkingsplan met Subsidiekompas is een Pro- en Premium-functie.',
  'geen-begroting': 'Vul eerst de projectbegroting in; zonder begroting kan geen sluitend dekkingsplan met bedragen worden gemaakt.',
  'onvoldoende-projectgegevens': 'Kies bij dit project eerst een discipline en een doelgroep uit de lijst; daarop zoekt Subsidiekompas financiers.',
};

// supabase.functions.invoke geeft bij een 4xx/5xx een error met de Response in error.context; daaruit halen we de (veilige) code en tekst.
async function leesFout(error) {
  try {
    const res = error && error.context;

    if (res && typeof res.json === 'function') {
      const body = await res.json();
      const reden = typeof body.reden === 'string' ? body.reden : 'fout';

      return { reden, melding: OVERZICHT[reden] || (typeof body.error === 'string' && body.error.length < 300 ? body.error : ALGEMENE_FOUT) };
    }
  } catch (e) {
    // geen leesbare foutinhoud
  }

  return { reden: 'fout', melding: ALGEMENE_FOUT };
}

async function roep(body) {
  if (!supabase) {
    return { ok: false, reden: 'geen-sessie', melding: ALGEMENE_FOUT, antwoord: null };
  }

  try {
    const { data, error } = await supabase.functions.invoke(GENEREREN_FUNCTION, { body });

    if (error) {
      const f = await leesFout(error);

      return { ok: false, reden: f.reden, melding: f.melding, antwoord: null };
    }

    if (!data || typeof data !== 'object' || data.ok !== true) {
      return { ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null };
    }

    return { ok: true, antwoord: data };
  } catch (e) {
    return { ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null };
  }
}

export function vraagVoorstelGenereren({ projectId }) {
  if (typeof projectId !== 'string' || !projectId) {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  return roep({ mode: 'voorstel-genereren', projectId });
}

// Alleen Premium: gericht aanvullend zoeken op het resterende gat. De server berekent het resterende gat zelf uit `voorstel`.
// `getoond` = de online suggesties die het lid al kreeg ({ gever, indicatiefBedrag }): die tellen mee voor het stoppen en voor het totale
// maximum, en worden niet nogmaals voorgesteld. Het zijn alleen namen en schattingen; de server begrenst en controleert alles opnieuw.
export function vraagVoorstelAanvullen({ projectId, voorstel, getoond }) {
  if (typeof projectId !== 'string' || !projectId || !voorstel || typeof voorstel !== 'object') {
    return Promise.resolve({ ok: false, reden: 'fout', melding: ALGEMENE_FOUT, antwoord: null });
  }

  const lijst = (Array.isArray(getoond) ? getoond : [])
    .filter((x) => x && typeof x.gever === 'string' && x.gever)
    .slice(0, 20)
    .map((x) => ({ gever: x.gever.slice(0, 200), indicatiefBedrag: Number.isFinite(x.indicatiefBedrag) && x.indicatiefBedrag > 0 ? Math.round(x.indicatiefBedrag) : 0 }));

  return roep({ mode: 'voorstel-aanvullen', projectId, voorstel, getoond: lijst });
}
