# Tests create-checkout-session (RC1 fase 2B + Stripe Tax)

Lokale tests van de ECHTE Edge Function `create-checkout-session`, zonder netwerk,
zonder echte Stripe- of Supabase-sleutel. Stripe en Supabase zijn fakes
(`fakestripe.mjs`, `fakesupabase.mjs`; de scenario's staan in `test.mjs`).

    npm i --no-save esbuild               # niet in package.json
    node supabase/tests/create-checkout-session/build.mjs
    node supabase/tests/create-checkout-session/test.mjs

Dekt onder meer: configuratie, 401 voor anonieme verzoeken, profiel-guards,
inputvalidatie, PRO (7 dagen = 604800 s) en PREMIUM (1 dag = 86400 s) trial,
trial-eligibility, bestaande abonnementen, prijscontrole (bedrag/valuta/interval),
dubbelklik en gelijktijdige verzoeken, en de enige toegestane schrijfactie
(`stripe_customer_id`).

## Stripe Tax (Sandbox-fase)

- `automatic_tax.enabled = true`, `billing_address_collection = required`,
  `customer_update = { address: 'auto' }` (verder niets);
- basisprijs blijft EUR 12 / EUR 39 EXCLUSIEF belasting; geen btw-percentage of
  bedrag incl. btw in de Edge Function of in `src/`;
- `tax_behavior`: Price `exclusive` is goed; `inclusive` wordt geweigerd; bij
  `unspecified` moet de standaard in de Tax settings van Stripe `exclusive` zijn
  (anders 500, geen Checkout); onleesbare Tax settings geven 502 (fail-closed);
  Prices en instellingen worden nooit gewijzigd;
- een nog open sessie van vóór Stripe Tax wordt niet hergebruikt.
