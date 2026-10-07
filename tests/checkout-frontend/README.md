# Tests: Checkout-aansluiting (fase 2D)

Deze tests bewijzen dat de abonneren-pagina Stripe Checkout start zoals bedoeld
en nooit zelf rechten toekent. Ze praten **nooit** met Stripe of Supabase: alles
is gemockt (`fake-client.js`, `fake-app.js`, en een lokale stubpagina voor
`checkout.stripe.com` in de browsertest).

## Component- en helpertests (Node + jsdom)

    npm i --no-save esbuild jsdom        # niet in package.json
    node tests/checkout-frontend/run.mjs

Dekt: URL-validatie, niet ingelogd, geen akkoord, PRO, PREMIUM, dubbelklik,
backendfouten (409/502/500/netwerk/401), ongeldige of ontbrekende Checkout-url,
profielstaten, exacte request-body (alleen `plan` + `voorwaarden_akkoord`),
bronscan op entitlement-writes, publieke routes (Free) en de ongewijzigde
koopintentie-helpers. Sectie M dekt de Customer Portal-knop
(`openBeheerportaal`): geen klantgegevens in het verzoek, urlvalidatie
(`billing.stripe.com`), foutafhandeling, dubbelklik-guard en bronscans op
entitlement-writes.

## Browsertest (Playwright, gemockte Supabase en Stripe)

    VITE_SUPABASE_URL=https://mock.supabase.test VITE_SUPABASE_ANON_KEY=mock-anon-key \
      npx vite build --outDir _to_delete/dist-mock --emptyOutDir
    DIST=$PWD/_to_delete/dist-mock node tests/checkout-frontend/e2e-browser.mjs

Elke scenario controleert bovendien dat er nooit `start_trial` of een
schrijfactie op `profiles` plaatsvindt.
