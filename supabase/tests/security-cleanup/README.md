# Test: rechten opschonen (production readiness)

Bewijst dat `20261007120000_production_readiness_rechten_opschonen.sql`
(a) de oude `start_trial`-route, TRUNCATE/TRIGGER/REFERENCES op `profiles` en
`product_aankopen` en anon-toegang tot de oudere `admin_*`-functies dichtzet,
(b) idempotent is, en (c) niets anders verandert (SELECT/INSERT/UPDATE/DELETE,
adminconsole voor `authenticated`, publieke teller, Stripe-RPC's, trialdata).

Vereist een lokale PostgreSQL 16 (wegwerp). Voorbeeld:

    createdb -p 5544 -h /var/tmp sec && psql -h /var/tmp -p 5544 -d sec -f test.sql

Laatste regel: `ALLE_TESTS_GESLAAGD (N checks)`.
