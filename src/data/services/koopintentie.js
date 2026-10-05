// Koopintentie: onthoudt tijdelijk welk betaald membership (pro of premium)
// een bezoeker koos op het moment dat eerst inloggen of een account aanmaken
// nodig bleek, zodat hij daarna niet opnieuw hoeft te zoeken.
//
// Uitsluitend UX/navigatie:
//  - geen entitlement en geen securitybeslissing; het geeft nooit toegang;
//  - alleen een allowlist van 'pro' en 'premium' wordt geaccepteerd;
//  - vervalt automatisch na 24 uur (bevestigingsmail kan even duren);
//  - de server (create-checkout-session, en later de webhook) valideert
//    de keuze altijd opnieuw en bepaalt zelf de toegang.
// Opslag is best-effort: zonder (toegankelijke) localStorage doet dit niets.

const SLEUTEL = 'fc.koopintentie';
const GELDIG_MS = 24 * 60 * 60 * 1000;
const TOEGESTAAN = ['pro', 'premium'];

export function bewaarKoopintentie(plan) {
  if (!TOEGESTAAN.includes(plan)) {
    return false;
  }

  try {
    window.localStorage.setItem(SLEUTEL, JSON.stringify({ plan, ts: Date.now() }));

    return true;
  } catch (e) {
    return false;
  }
}

// Geeft 'pro' of 'premium' terug, of null (niets bewaard, verlopen of ongeldig).
export function leesKoopintentie() {
  try {
    const ruw = window.localStorage.getItem(SLEUTEL);

    if (!ruw) {
      return null;
    }

    const data = JSON.parse(ruw);
    const verlopen = !data || typeof data.ts !== 'number' || Date.now() - data.ts > GELDIG_MS || data.ts > Date.now() + 60000;

    if (verlopen || !TOEGESTAAN.includes(data.plan)) {
      wisKoopintentie();

      return null;
    }

    return data.plan;
  } catch (e) {
    return null;
  }
}

export function wisKoopintentie() {
  try {
    window.localStorage.removeItem(SLEUTEL);
  } catch (e) {
    // niets te wissen of geen toegang tot opslag
  }
}
