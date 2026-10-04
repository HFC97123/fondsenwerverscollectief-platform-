-- K1 Payments (RC1 fase 8B): minimale database-basis om in een volgende
-- fase Stripe-subscriptions server-side te kunnen bijhouden.
--
-- Uitgangspunten (zie Fase 8A-analyse, claude/rc1-stap8a-k1-payments-analyse.md):
--  - subscription_tier/subscription_active blijven de eenvoudige, bestaande
--    autorisatie-interface voor de app (current_user_has_pro_access(),
--    current_user_has_premium_access(), de Edge Function 'subsidie-kompas').
--    Deze migratie verandert niets aan die twee kolommen, niet aan hun
--    defaults, en niets aan de functies die ze gebruiken.
--  - De bestaande interne trial (start_trial: 7 dagen Pro / 24 uur Premium,
--    geen betaalmiddel vereist, nooit automatisch betaald) blijft volledig
--    ongewijzigd en blijft los van Stripe: start_trial wordt hier niet
--    aangepast en vereist geen van de nieuwe kolommen.
--  - Admin (role = 'admin') blijft volledige toegang houden, onafhankelijk
--    van deze kolommen - current_user_is_admin()/current_user_has_pro_access()/
--    current_user_has_premium_access() blijven ongewijzigd.
--  - De drie nieuwe kolommen worden in déze fase door niets gevuld of
--    gelezen: pure, inerte voorbereiding op de webhook-fase (8D). Bestaande
--    rijen krijgen voor de twee nullable kolommen simpelweg NULL (geen
--    Stripe-status/periode bekend) en voor de boolean-kolom de veilige
--    default false (geen opzegging gepland) - dit raakt geen bestaande data
--    of bestaand gedrag.
--  - Geen CHECK-constraint op subscription_status: zelfde conventie als het
--    bestaande subscription_tier (ongecheckt op tabelniveau; validatie zit
--    in de functie die het veld zet - dat wordt de webhook-functie van
--    fase 8D, die de Stripe-status eerst normaliseert naar de set die
--    daadwerkelijk nodig blijkt).
--  - subscription_ends_at (bestaand, vandaag nergens in de code geschreven -
--    alleen gelezen in profile.js) blijft ongewijzigd en blijft bewust apart
--    van het nieuwe subscription_current_period_end: dat laatste is
--    uitsluitend de Stripe-billingperiode zoals de webhook die straks
--    doorgeeft, zodat beide velden niet door elkaar gaan lopen.
--  - Geen nieuwe GRANT nodig en geen nieuwe RLS-policy: 'authenticated'
--    heeft op public.profiles tabel-breed uitsluitend SELECT (geen
--    UPDATE/INSERT/DELETE, geverifieerd vóór deze migratie); dat geldt
--    automatisch ook voor deze nieuwe kolommen - niets hieronder maakt ze
--    client-zijdig schrijfbaar. 'anon' heeft geen enkel leze-/schrijfrecht
--    op profiles (geverifieerd vóór deze migratie).

alter table public.profiles
  add column if not exists subscription_status text,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

comment on column public.profiles.subscription_status is
  'RC1 K1 (fase 8B): Stripe subscription-status, server-side gezet door de webhook-Edge Function (fase 8D). NULL = geen Stripe-abonnement bekend (o.a. Free-gebruikers en gebruikers in de interne, niet-Stripe trial). Geen CHECK-constraint: validatie/normalisatie gebeurt in de webhookfunctie, net als bij subscription_tier.';

comment on column public.profiles.subscription_current_period_end is
  'RC1 K1 (fase 8B): einde van de huidige Stripe-betaalperiode, server-side gezet door de webhook-Edge Function (fase 8D). Bewust los van het bestaande subscription_ends_at.';

comment on column public.profiles.subscription_cancel_at_period_end is
  'RC1 K1 (fase 8B): true zodra in Stripe een opzegging aan het einde van de huidige periode gepland staat, server-side gezet door de webhook-Edge Function (fase 8D). Default false: geen opzegging gepland.';
