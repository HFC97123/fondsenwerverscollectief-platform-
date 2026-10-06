// Koopintentie: onthoudt tijdelijk welk abonnement (Pro of Premium) een
// bezoeker koos op het moment dat eerst inloggen of een account aanmaken
// nodig bleek, zodat hij daarna op de abonneren-pagina terugkomt en niet
// opnieuw hoeft te zoeken.
//
// Uitsluitend UX/navigatie:
//  - de intentie bepaalt ALLEEN welk abonnement is gekozen (PRO of PREMIUM).
//    Nooit of iemand een gratis proefperiode krijgt, betaald heeft, welke
//    abonnementsstatus hij heeft of welke toegang hij krijgt. Dat bepaalt
//    later uitsluitend de server;
//  - een intentie geeft geen rechten en start nooit iets: inloggen of
//    registreren activeert dus nooit een proefperiode, Checkout of
//    abonnement;
//  - alleen een allowlist van twee vaste codes wordt geaccepteerd;
//  - vervalt automatisch na 24 uur (een bevestigingsmail kan even duren).
// Opslag is best-effort: zonder (toegankelijke) localStorage doet dit niets.

const SLEUTEL = 'fc.koopintentie';
const GELDIG_MS = 24 * 60 * 60 * 1000;

export const INTENTIES = {
  PRO: { tier: 'pro' },
  PREMIUM: { tier: 'premium' },
};

export const ABONNEREN_PAD = '/kompas/abonneren';

export function isGeldigeIntentie(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(INTENTIES, code);
}

// De intentiecode die bij een tier hoort ('pro' -> 'PRO'), of null.
export function intentieVoorTier(tier) {
  const code = String(tier || '').toUpperCase();

  return isGeldigeIntentie(code) ? code : null;
}

function lees() {
  try {
    const ruw = window.localStorage.getItem(SLEUTEL);

    if (!ruw) {
      return null;
    }

    const data = JSON.parse(ruw);
    const verlopen =
      !data || typeof data.ts !== 'number' || Date.now() - data.ts > GELDIG_MS || data.ts > Date.now() + 60000;

    if (verlopen || !isGeldigeIntentie(data.intentie)) {
      wisIntentie();

      return null;
    }

    return data;
  } catch (e) {
    return null;
  }
}

function schrijf(data) {
  try {
    window.localStorage.setItem(SLEUTEL, JSON.stringify(data));

    return true;
  } catch (e) {
    return false;
  }
}

// Bewaart de intentie (nieuwe keuze = nieuwe geldigheid en weer "nog niet
// aangeboden"). Geeft false terug bij een onbekende code of geen opslag.
export function bewaarIntentie(code) {
  if (!isGeldigeIntentie(code)) {
    return false;
  }

  return schrijf({ intentie: code, ts: Date.now(), aangeboden: false });
}

// Geeft een geldige intentiecode of null (niets bewaard, verlopen of ongeldig).
export function leesIntentie() {
  const data = lees();

  return data ? data.intentie : null;
}

export function wisIntentie() {
  try {
    window.localStorage.removeItem(SLEUTEL);
  } catch (e) {
    // niets te wissen of geen toegang tot opslag
  }
}

// Eenmalige terugleiding na inloggen: geeft de intentie alleen terug zolang
// de gebruiker er nog niet naartoe is gebracht, en markeert hem daarna als
// aangeboden. Zo wordt een inlog binnen 24 uur niet telkens opnieuw naar de
// abonneren-pagina gestuurd.
export function neemTeAanbiedenIntentie() {
  const data = lees();

  if (!data || data.aangeboden) {
    return null;
  }

  schrijf({ ...data, aangeboden: true });

  return data.intentie;
}

// Leest ?intent=... uit een hash als '#/kompas/abonneren?intent=PRO'. Alleen
// codes uit de allowlist komen terug; de URL bevat nooit persoonsgegevens.
export function intentieUitHash(hash) {
  try {
    const h = String(hash || '');
    const q = h.indexOf('?');

    if (q === -1) {
      return null;
    }

    const code = new URLSearchParams(h.slice(q + 1)).get('intent');

    return isGeldigeIntentie(code) ? code : null;
  } catch (e) {
    return null;
  }
}

// Staat er een ?intent=-parameter in de hash, ook al is hij ongeldig? De pagina
// weigert een ongeldige waarde dan, in plaats van terug te vallen op een
// eerder bewaarde keuze.
export function heeftIntentParam(hash) {
  try {
    const h = String(hash || '');
    const q = h.indexOf('?');

    return q !== -1 && new URLSearchParams(h.slice(q + 1)).has('intent');
  } catch (e) {
    return false;
  }
}

export function abonnerenHash(code) {
  return isGeldigeIntentie(code) ? `#${ABONNEREN_PAD}?intent=${code}` : `#${ABONNEREN_PAD}`;
}

// Mag de bewaarde intentie NU een terugleiding naar de abonneren-pagina
// starten? Pure beslisfunctie (testbaar zonder browser).
//  - nooit op de abonneren-pagina zelf (geen lus);
//  - nooit tijdens wachtwoordherstel: niet op /wachtwoord-instellen en niet
//    als deze lading uit een herstellink kwam (de hash is dan al door
//    Supabase gewist, dus het pad alleen is geen betrouwbaar signaal);
//  - nooit zolang een Supabase-terugkeer nog in de URL staat;
//  - niet na een mislukte auth-terugkeer (foutmelding).
export function magTerugleiden({ hash, callbackBijLaden }) {
  const h = String(hash || '');
  const pad = h.replace(/^#/, '').split('?')[0];

  if (pad === ABONNEREN_PAD || pad.startsWith(`${ABONNEREN_PAD}/`)) {
    return false;
  }

  if (pad.startsWith('/wachtwoord-instellen')) {
    return false;
  }

  if (h.includes('access_token=') || h.includes('error_code=') || h.includes('error_description=')) {
    return false;
  }

  if (callbackBijLaden === 'recovery' || callbackBijLaden === 'fout') {
    return false;
  }

  return true;
}
