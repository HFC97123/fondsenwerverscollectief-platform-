# Tests stripe-webhook (RC1 fase 2C)

Lokale tests, zonder Supabase- of Stripe-verbinding. Niets hiervan raakt een
live omgeving.

Vereist: PostgreSQL 16 (server), Node 20+, en tijdelijk `stripe@^22`, `pg`,
`esbuild` (`npm i --no-save stripe@^22 pg esbuild` in deze map).

1. `./setupdb.sh` - start een wegwerp-Postgres op poort 5544 (pas paden/gebruiker
   aan voor je eigen machine), maakt een kopie van de relevante structuur
   (`stub.sql`: profiles, auth.users, private.is_admin, rollen) en past de
   definitieve migratie toe.
2. `psql -d t -f rpc-scenarios.sql` - SQL-scenario's van de RPC's (48 checks).
3. `node build.mjs && node webhook-e2e.test.mjs` - bundelt de echte Edge
   Function en draait haar met echte Stripe-handtekeningen tegen de echte
   Postgres/RPC's; alleen `stripe.subscriptions.retrieve` is nep (76 checks).
