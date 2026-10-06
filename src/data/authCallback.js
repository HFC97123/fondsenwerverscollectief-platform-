// Legt vast of deze paginalading een auth-terugkeer van Supabase is
// (e-mailbevestiging, wachtwoordherstel, foutmelding), op het moment dat de
// pagina laadt.
//
// Waarom: Supabase levert zo'n terugkeer af in de URL-hash
// (#access_token=...&type=signup|recovery) en wist die hash daarna zelf. Op
// dat moment is de URL dus niet meer te herkennen, terwijl de sessie net pas
// klaar is. Wie later nog wil weten "kwam deze lading uit een
// wachtwoordherstellink?" moet dat dus bij het laden vastleggen. Dit bestand
// importeert bewust niets (ook geen Supabase), zodat het vóór de client wordt
// geëvalueerd en eenvoudig te testen is.

// Pure functie: leest het type uit een hash als '#access_token=..&type=recovery'.
// Geeft null terug als de hash geen auth-terugkeer is. Een gewone app-route
// begint altijd met '#/', een Supabase-terugkeer nooit.
export function authCallbackUitHash(hash) {
  try {
    const ruw = String(hash || '').replace(/^#/, '');

    if (!ruw || ruw.startsWith('/')) {
      return null;
    }

    const params = new URLSearchParams(ruw);

    if (params.get('error') || params.get('error_code') || params.get('error_description')) {
      return 'fout';
    }

    if (params.get('access_token')) {
      return params.get('type') || 'onbekend';
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Het type van de lading van deze pagina, eenmalig vastgelegd bij het laden.
export const AUTH_CALLBACK_BIJ_LADEN =
  typeof window === 'undefined' ? null : authCallbackUitHash(window.location.hash);
