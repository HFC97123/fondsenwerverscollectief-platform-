# Tests stripe-portal (Stripe Customer Portal, Sandbox-fase)

Lokale tests van de ECHTE Edge Function `stripe-portal`, zonder netwerk en zonder
echte sleutel. Hergebruikt de fakes uit `../create-checkout-session/`.

    npm i --no-save esbuild               # niet in package.json
    node supabase/tests/stripe-portal/build.mjs
    node supabase/tests/stripe-portal/test.mjs

Bewijst: 401 zonder login; geen Portal zonder eigen `stripe_customer_id`
(409 `geen_klant`, geen Stripe-aanroep); met eigen klant een Portal Session met
`return_url` = `<APP_BASE_URL>/#/kompas/account`; de request-body wordt nooit
gelezen (klant-id, user-id en return_url uit de browser hebben geen effect);
nooit een schrijfactie of rpc (tier/toegang/abonnement blijven ongemoeid, de
webhook blijft de bron van waarheid); Stripe-fouten en ongeldige Portal-urls
geven een neutrale 502; dubbelklik/gelijktijdige verzoeken veroorzaken geen
entitlementprobleem. De frontend-kant (`openBeheerportaal`) wordt getest in
`tests/checkout-frontend/checkout.test.mjs` (sectie M).
