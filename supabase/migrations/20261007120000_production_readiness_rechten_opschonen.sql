-- RC1 production readiness: onnodige en onveilige rechten opschonen.
--
-- STATUS: VOORBEREID, NOG NIET TOEGEPAST OP HET LIVE-PROJECT. Wordt pas bij de
-- cutover toegepast, na akkoord van de eigenaar (zie het cutover-runbook).
-- Geen data wordt gewijzigd of verwijderd; alleen rechten (GRANT/REVOKE).
-- Idempotent: opnieuw uitvoeren verandert niets meer.
--
-- 1. start_trial: de oude interne trialroute. Sinds de Stripe-trials is dit een
--    tweede, kaartloze weg naar Pro (7 dagen) of Premium (24 uur) voor elke
--    ingelogde gebruiker via supabase.rpc('start_trial'). De frontend roept hem
--    nergens meer aan (startProefperiode wordt nergens gebruikt). Nu wordt
--    EXECUTE ingetrokken; de functie zelf en alle historische trialdata op
--    profiles blijven ongemoeid. Toegang van bestaande (legacy) profielen volgt
--    uit hun opgeslagen kolommen en verandert hierdoor niet.
--
-- 2. TRUNCATE (en TRIGGER/REFERENCES) op profiles en product_aankopen voor
--    anon/authenticated: niet nodig voor de app; TRUNCATE is bovendien niet door
--    RLS gedekt. SELECT/INSERT/UPDATE/DELETE blijven zoals ze waren (RLS bepaalt).
--
-- 3. De oudere admin_*-functies waren uitvoerbaar voor PUBLIC/anon. Ze hebben
--    een interne admin-controle, maar anon hoort ze niet eens te kunnen
--    aanroepen. De nieuwere admin_*-functies zijn al alleen voor authenticated.
--    Hier gelijkgetrokken: alleen authenticated en service_role behouden hun
--    recht. De adminconsole werkt ingelogd en blijft dus werken.
--
-- BEWUST NIET AANGERAAKT: current_user_has_*_access, current_user_is_admin,
-- publieke_fondsen_telling, funder_volgende_datamoment,
-- subsidieregeling_volgende_ronde (anon heeft ze nodig of RLS/views gebruiken
-- ze), handle_new_user en rls_auto_enable (trigger-functies, niet als RPC
-- aanroepbaar), de security-definer views en alle Stripe-RPC's (die zijn al
-- service-role-only).

-- 1. start_trial ----------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.start_trial(text)') is not null then
    revoke execute on function public.start_trial(text) from public, anon, authenticated;
  end if;
end $$;

-- 2. TRUNCATE e.d. op profielen en aankopen -----------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['public.profiles', 'public.product_aankopen'] loop
    if to_regclass(t) is not null then
      execute format('revoke truncate, references, trigger on table %s from public, anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 3. Oude admin_*-functies: niet meer voor anon/PUBLIC --------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname like 'admin\_%'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
