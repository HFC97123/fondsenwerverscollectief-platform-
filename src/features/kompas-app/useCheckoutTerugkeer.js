// Terugkeer uit Stripe Checkout (?checkout=success) op "Mijn account".
//
// Uitsluitend weergave en opruimen, nooit toegang:
//  - de redirect is GEEN bewijs van een betaling of recht. Wat de gebruiker
//    te zien krijgt hangt af van het ACTUELE profiel (door de geverifieerde
//    Stripe-webhook bijgewerkt), nooit van de query-parameter alleen;
//  - is het abonnement in het profiel nog niet zichtbaar (de webhook kan iets
//    later binnenkomen dan de terugkeer), dan wordt het profiel een beperkt
//    aantal keren opnieuw GELEZEN. Er wordt niets geschreven;
//  - de bewaarde koopintentie wordt pas opgeruimd zodra het profiel het
//    bedoelde actieve abonnement laat zien, niet op basis van de redirect.
import { useEffect, useRef, useState } from 'react';
import { actiefAbonnementVan, haalProfiel } from '../../data/services/profile.js';
import { intentieVoorTier, leesIntentie, wisIntentie } from '../../data/services/koopintentie.js';

export const POLL_INTERVAL_MS = 3000;
export const POLL_MAX = 20;

// Uitkomst: { status, tier }
//   status null           geen succes-terugkeer: geen melding
//   status 'bevestigd'    profiel toont een actief Pro/Premium-abonnement
//   status 'wacht'        succes-terugkeer, abonnement nog niet in het profiel
//   status 'wacht_te_lang' idem, maar de korte wachtperiode is voorbij
export function useCheckoutTerugkeer({ resultaat, profiel, herlaad, intervalMs = POLL_INTERVAL_MS, maxPogingen = POLL_MAX }) {
  const tier = actiefAbonnementVan(profiel);
  const profielId = profiel && profiel.id ? profiel.id : null;
  const [opgegeven, setOpgegeven] = useState(false);
  const herlaadRef = useRef(herlaad);

  herlaadRef.current = herlaad;

  // Koopintentie opruimen, maar alleen als het actuele profiel de bedoelde
  // toegang daadwerkelijk laat zien.
  useEffect(() => {
    if (tier && leesIntentie() === intentieVoorTier(tier)) {
      wisIntentie();
    }
  }, [tier]);

  const wacht = resultaat === 'success' && !tier && Boolean(profielId);

  useEffect(() => {
    if (!wacht) {
      return undefined;
    }

    let pogingen = 0;
    let gestopt = false;
    let bezig = false;

    const id = setInterval(async () => {
      if (bezig || gestopt) {
        return;
      }

      bezig = true;
      pogingen += 1;

      try {
        // Alleen lezen. Pas als het verse profiel het abonnement toont, wordt
        // de app-brede toestand ververst.
        const vers = await haalProfiel(profielId, { vers: true });

        if (!gestopt && actiefAbonnementVan(vers)) {
          // Bevestigd: niet verder lezen, de app-toestand één keer verversen.
          gestopt = true;
          clearInterval(id);

          if (typeof herlaadRef.current === 'function') {
            await herlaadRef.current();
          }

          return;
        }
      } catch (e) {
        // Lezen mislukt: volgende ronde probeert het opnieuw. Mislukte alleen
        // het verversen NA een bevestiging, dan stoppen we met een neutrale
        // "ververs de pagina"-melding in plaats van een misleidend "nog niets".
        if (gestopt) {
          setOpgegeven(true);
        }
      }

      bezig = false;

      if (!gestopt && pogingen >= maxPogingen) {
        gestopt = true;
        clearInterval(id);
        setOpgegeven(true);
      }
    }, intervalMs);

    return () => {
      gestopt = true;
      clearInterval(id);
    };
  }, [wacht, profielId]);

  let status = null;

  if (resultaat === 'success') {
    status = tier ? 'bevestigd' : opgegeven ? 'wacht_te_lang' : 'wacht';
  }

  return { status, tier };
}
