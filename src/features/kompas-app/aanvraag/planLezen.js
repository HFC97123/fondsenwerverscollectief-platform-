// Het plan van een aanvraag lezen, zoals de server het bewaart (de tekst van de AI) en zoals het lid het nu heeft (met zijn eigen bewerkingen erin).
import { haalAanvraag, haalVersie, haalVersies } from '../../../data/services/aanvraagAssistent.js';
import { planMetVersie } from './aanvraagModel.js';

export async function leesPlan(aanvraagId) {
  const r = await haalAanvraag(aanvraagId);

  return r.ok && r.antwoord.aanvraag && r.antwoord.aanvraag.plan ? r.antwoord.aanvraag.plan : null;
}

// Het plan zoals het lid het nu heeft: met de tekst uit de nieuwste opgeslagen versie (wat het lid zelf bewerkte). Voor de export en voor Maak definitief.
export async function leesPlanActueel(aanvraagId) {
  const plan = await leesPlan(aanvraagId);

  if (!plan) return null;

  try {
    const l = await haalVersies(aanvraagId);
    const nieuwste = l.ok && Array.isArray(l.antwoord.versies) ? l.antwoord.versies[0] : null;

    if (!nieuwste) return plan;

    const v = await haalVersie(nieuwste.id);

    return v.ok ? planMetVersie(plan, v.antwoord.versie.antwoorden) : plan;
  } catch (e) {
    return plan;
  }
}
