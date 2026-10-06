\set ON_ERROR_STOP 1
create schema if not exists t;
create or replace function t.base() returns timestamptz language sql as $$ select timestamptz '2026-10-10 12:00:00+00' $$;
-- run(event, type, created_offset_s, fetched_offset_s, sub, cust, status, tier, items, trial_start_off, trial_end_off, meta_user, cancel, linked_status)
create or replace function t.run(e text, ty text, c int, f int, sub text, cust text, st text,
  tier text default 'pro', items int default 1, ts int default null, te int default null,
  meta text default null, cancel boolean default false, linked text default null) returns jsonb
language plpgsql as $$
declare cl text; r jsonb; snap jsonb; lc jsonb;
begin
  cl := public.stripe_claim_event(e, ty, false, t.base()+make_interval(secs=>c), sub, cust);
  if cl <> 'claimed' then return jsonb_build_object('claim', cl); end if;
  snap := jsonb_build_object('subscription_id',sub,'customer_id',cust,'status',st,'price_id','price_x','tier',tier,
     'item_count',items,'trial_start', case when ts is not null then (t.base()+make_interval(secs=>ts)) end,
     'trial_end', case when te is not null then (t.base()+make_interval(secs=>te)) end,
     'current_period_end', t.base()+interval '30 days','start_date', t.base(),
     'cancel_at_period_end', cancel, 'metadata_user_id', meta);
  r := public.stripe_apply_subscription(e, t.base()+make_interval(secs=>f), snap);
  if r->>'result' = 'linked_check_needed' then
    lc := jsonb_build_object('subscription_id', r->>'linked_subscription_id', 'status', linked);
    r := public.stripe_apply_subscription(e, t.base()+make_interval(secs=>f), snap, lc);
  end if;
  return r;
end $$;
create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok  %', msg; end $$;

insert into auth.users(id) select ('00000000-0000-0000-0000-00000000000'||i)::uuid from generate_series(1,6) i;
insert into public.profiles(id,email,status,role,subscription_tier,subscription_active,stripe_customer_id) values
 ('00000000-0000-0000-0000-000000000001','u1@x','approved','member','free',false,'cus_1'),
 ('00000000-0000-0000-0000-000000000002','u2@x','approved','admin','premium',true,'cus_2'),
 ('00000000-0000-0000-0000-000000000003','u3@x','approved','member','premium',true,'cus_3'),
 ('00000000-0000-0000-0000-000000000004','u4@x','approved','member','free',false,'cus_4'),
 ('00000000-0000-0000-0000-000000000005','u5@x','approved','member','free',false,'cus_5'),
 ('00000000-0000-0000-0000-000000000006','u6@x','approved','member','free',false,null);
update public.profiles set subscription_tier='pro', trial_started_at=t.base()-interval '1 day', trial_ends_at=t.base()+interval '6 days' where id='00000000-0000-0000-0000-000000000004';

-- G1: matrix op één profiel (sub_a): trialing -> active -> past_due -> unpaid
do $$ declare r jsonb; p public.profiles; begin
 r := t.run('e1','customer.subscription.created',0,1,'sub_a','cus_1','trialing','premium',1,0,86400,'00000000-0000-0000-0000-000000000001',false);
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(r->>'result'='applied' and p.subscription_active and p.subscription_tier='premium' and p.subscription_status='trialing','trialing => active=true, tier premium');
 perform t.ok(p.trial_started_at=t.base() and p.trial_ends_at=t.base()+interval '86400 seconds','trial_start/end = Stripe-waarden');
 perform t.ok((select (detail->>'trial_seconden')::int from public.stripe_webhook_events where stripe_event_id='e1')=86400,'trial_seconden 86400 in eventdetail');
 r := t.run('e2','customer.subscription.updated',100,101,'sub_a','cus_1','trialing','premium',1,0,86400,null,true);
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(p.subscription_cancel_at_period_end and p.subscription_active,'cancel_at_period_end=true blijft actief');
 r := t.run('e3','customer.subscription.updated',200,201,'sub_a','cus_1','active','premium',1,0,86400);
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(p.subscription_status='active' and p.subscription_active and p.trial_ends_at=t.base()+interval '86400 seconds' and not p.subscription_cancel_at_period_end,'active: trial-historie blijft, cancel-vlag volgt Stripe');
 r := t.run('e4','customer.subscription.updated',300,301,'sub_a','cus_1','past_due','premium',1,0,86400);
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(p.subscription_status='past_due' and p.subscription_active,'past_due: status past_due, toegang true');
 r := t.run('e5','customer.subscription.updated',400,401,'sub_a','cus_1','unpaid','premium',1,0,86400);
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(p.subscription_status='unpaid' and not p.subscription_active and p.subscription_tier='free' and p.stripe_subscription_id='sub_a','unpaid: geen toegang, tier free, sub-id behouden');
end $$;

-- F: out-of-order en eindtoestand
do $$ declare r jsonb; p public.profiles; begin
 r := t.run('e6','customer.subscription.deleted',600,601,'sub_a','cus_1','canceled','premium',1,0,86400);
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(p.subscription_status='canceled' and not p.subscription_active and p.subscription_tier='free' and p.trial_started_at is not null and p.subscription_started_at is not null,'canceled: Free, historie (trial/started/sub-id) blijft');
 r := t.run('e_old','customer.subscription.updated',500,700,'sub_a','cus_1','active','premium',1,0,86400);
 perform t.ok(r->>'result'='stale','ouder event (created 500 < 600) na deleted => stale');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(p.subscription_status='canceled' and not p.subscription_active,'oud event heeft canceled niet teruggedraaid');
 r := t.run('e_new','customer.subscription.updated',700,701,'sub_a','cus_1','active','premium',1,0,86400);
 perform t.ok(r->>'result'='stale','canceled is plakkerig (nieuwer event, maar status actief) => stale');
end $$;

-- idempotentie
do $$ declare r jsonb; begin
 r := t.run('e6','customer.subscription.deleted',600,601,'sub_a','cus_1','canceled');
 perform t.ok(r->>'claim'='duplicate','zelfde event-id opnieuw => duplicate');
end $$;

-- hernieuwd abonnement na canceled (geen trial meer): takeover toegestaan
do $$ declare r jsonb; p public.profiles; begin
 r := t.run('e7','customer.subscription.created',800,801,'sub_b','cus_1','active','pro',1,null,null,'00000000-0000-0000-0000-000000000001');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(r->>'result'='applied' and p.stripe_subscription_id='sub_b' and p.subscription_tier='pro' and p.subscription_active and p.trial_ends_at=t.base()+interval '86400 seconds','nieuw abonnement na canceled: pro actief, oude trial-historie ongemoeid');
 -- tweede, gelijktijdig abonnement terwijl sub_b actief is
 r := t.run('e8','customer.subscription.created',900,901,'sub_c','cus_1','active','premium',1,null,null,null,false,'active');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(r->>'result'='conflict' and r->>'reden'='tweede_abonnement' and p.stripe_subscription_id='sub_b' and p.subscription_tier='pro','tweede abonnement => conflict, profiel ongewijzigd (geen dubbele toegang)');
 perform t.ok((select count(*) from public.stripe_billing_conflicts where kind='tweede_abonnement' and other_stripe_subscription_id='sub_b')=1,'conflict geregistreerd');
 r := t.run('e9','customer.subscription.updated',1000,1001,'sub_c','cus_1','active','premium',1,null,null,null,false,'active');
 perform t.ok((select occurrences from public.stripe_billing_conflicts where kind='tweede_abonnement')=2,'zelfde conflict dedupliceert (occurrences=2)');
end $$;

-- achterlopende opgeslagen status: gekoppeld abonnement blijkt bij Stripe al canceled
do $$ declare r jsonb; p public.profiles; begin
 r := t.run('e10','customer.subscription.created',1100,1101,'sub_d','cus_1','active','premium',1,null,null,null,false,'canceled');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000001';
 perform t.ok(r->>'result'='applied' and p.stripe_subscription_id='sub_d' and p.subscription_tier='premium','echte Stripe-status van gekoppeld abonnement (canceled) maakt takeover mogelijk');
end $$;

-- admin / handmatig / onbekend / metadata / prijs
do $$ declare r jsonb; p public.profiles; begin
 r := t.run('a1','customer.subscription.created',0,1,'sub_adm','cus_2','active','premium');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000002';
 perform t.ok(r->>'reden'='admin_profiel' and p.role='admin' and p.stripe_subscription_id is null and p.subscription_tier='premium','admin: geen wijziging, conflict, role intact');
 r := t.run('m1','customer.subscription.created',0,1,'sub_man','cus_3','active','pro');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000003';
 perform t.ok(r->>'reden'='handmatige_toegang' and p.subscription_tier='premium' and p.stripe_subscription_id is null,'handmatige premium: nooit overschreven, conflict');
 r := t.run('m2','customer.subscription.updated',10,11,'sub_man','cus_3','canceled','pro');
 perform t.ok(r->>'result'='ignored','handmatige premium + niet-gerechtigd Stripe-event: genegeerd');
 r := t.run('k1','customer.subscription.created',0,1,'sub_k','cus_onbekend','active','pro');
 perform t.ok(r->>'reden'='onbekende_klant','onbekende customer => conflict, niets geactiveerd');
 r := t.run('x1','customer.subscription.created',0,1,'sub_x','cus_5','active','pro',1,null,null,'00000000-0000-0000-0000-000000000001');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000005';
 perform t.ok(r->>'reden'='metadata_wijkt_af' and not p.subscription_active and p.stripe_subscription_id is null,'metadata-user ≠ klant-profiel => niets geactiveerd');
 r := t.run('p1','customer.subscription.created',0,1,'sub_p','cus_5','active',null);
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000005';
 raise notice 'DBG % / % % % %', r, p.subscription_tier, p.subscription_active, p.stripe_subscription_id, p.subscription_status; perform t.ok(r->>'result'='applied' and not p.subscription_active and p.subscription_tier='free' and p.stripe_subscription_id='sub_p' and p.subscription_status='active','onbekende prijs => geen toegang, tier free, conflict');
 perform t.ok(exists(select 1 from public.stripe_billing_conflicts where kind='onbekende_prijs' and stripe_subscription_id='sub_p'),'onbekende_prijs geregistreerd');
 r := t.run('i1','customer.subscription.created',0,1,'sub_i','cus_5','incomplete','pro');
 perform t.ok(r->>'result'='stale' or r->>'result'='ignored','incomplete (ander sub dan gekoppeld) => profiel niet aangeraakt');
end $$;

-- incomplete op schoon profiel + paused
do $$ declare r jsonb; p public.profiles; begin
 r := t.run('i2','customer.subscription.created',0,1,'sub_i2','cus_4','incomplete','pro');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000004';
 perform t.ok(r->>'result'='ignored' and p.stripe_subscription_id is null and p.subscription_tier='pro' and p.trial_ends_at is not null,'incomplete: interne trial en profiel ongemoeid, sub-id niet gekoppeld');
 r := t.run('i3','customer.subscription.updated',10,11,'sub_i2','cus_4','incomplete_expired','pro');
 perform t.ok(r->>'result'='ignored','incomplete_expired: genegeerd');
 -- internal-trial gebruiker neemt betaald abonnement zonder Stripe-trial: interne trial blijft staan
 r := t.run('i4','customer.subscription.created',20,21,'sub_i4','cus_4','active','premium');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000004';
 perform t.ok(p.subscription_tier='premium' and p.subscription_active and p.trial_started_at=t.base()-interval '1 day','betaald na interne trial: trial-historie write-once ongemoeid');
 r := t.run('i5','customer.subscription.updated',30,31,'sub_i4','cus_4','paused','premium');
 select * into p from public.profiles where id='00000000-0000-0000-0000-000000000004';
 perform t.ok(not p.subscription_active and p.subscription_tier='free' and p.subscription_status='paused','paused: geen toegang + conflict paused_onverwacht');
 perform t.ok(exists(select 1 from public.stripe_billing_conflicts where kind='paused_onverwacht'),'paused_onverwacht geregistreerd');
end $$;

-- akkoord-historie
do $$ declare r jsonb; cl text; begin
 cl := public.stripe_claim_event('c1','checkout.session.completed',false,t.base(),'cs_1','cus_6');
 -- cus_6 bestaat niet (profiel 6 heeft geen customer) => conflict
 r := public.stripe_record_checkout_completed('c1', jsonb_build_object('session_id','cs_1','customer_id','cus_6','client_reference_id','00000000-0000-0000-0000-000000000006','metadata_user_id','00000000-0000-0000-0000-000000000006','terms_accepted','true','terms_version','2026-10-05','plan','PRO','tier','pro','terms_accepted_at',t.base()));
 perform t.ok(r->>'result'='conflict','checkout zonder gekoppeld profiel => conflict, geen akkoordrij');
 update public.profiles set stripe_customer_id='cus_6' where id='00000000-0000-0000-0000-000000000006';
 cl := public.stripe_claim_event('c2','checkout.session.completed',false,t.base(),'cs_2','cus_6');
 r := public.stripe_record_checkout_completed('c2', jsonb_build_object('session_id','cs_2','customer_id','cus_6','subscription_id','sub_6','client_reference_id','00000000-0000-0000-0000-000000000006','metadata_user_id','00000000-0000-0000-0000-000000000006','terms_accepted','true','terms_version','2026-10-05','plan','PRO','tier','pro','trial_granted','true','terms_accepted_at',t.base()));
 perform t.ok(r->>'result'='applied' and (select count(*) from public.subscription_terms_acceptances)=1,'akkoord vastgelegd');
 begin update public.subscription_terms_acceptances set terms_version='2030-01-01'; perform t.ok(false,'update moet falen'); exception when others then perform t.ok(sqlerrm like '%append-only%','akkoord-rij is niet te wijzigen'); end;
 begin delete from public.subscription_terms_acceptances; perform t.ok(false,'delete moet falen'); exception when others then perform t.ok(sqlerrm like '%append-only%','akkoord-rij is niet te verwijderen'); end;
 delete from auth.users where id='00000000-0000-0000-0000-000000000006';
 perform t.ok((select user_id from public.subscription_terms_acceptances) is null,'profielverwijdering koppelt akkoordrij los (FK set null), bewijs blijft');
end $$;

-- failed/retry en lease
do $$ declare cl text; begin
 cl := public.stripe_claim_event('f1','customer.subscription.updated',false,t.base(),'sub_f','cus_1');
 perform t.ok(cl='claimed','f1 claimed');
 perform t.ok(public.stripe_claim_event('f1','customer.subscription.updated',false,t.base(),'sub_f','cus_1')='busy','tweede claim terwijl processing => busy');
 perform public.stripe_mark_event_failed('f1','boem');
 perform t.ok(public.stripe_claim_event('f1','customer.subscription.updated',false,t.base(),'sub_f','cus_1')='claimed','na failed => opnieuw te claimen');
 update public.stripe_webhook_events set claimed_at = now() - interval '3 minutes' where stripe_event_id='f1';
 perform t.ok(public.stripe_claim_event('f1','customer.subscription.updated',false,t.base(),'sub_f','cus_1')='claimed','verlopen lease => overneembaar');
 perform t.ok((select attempts from public.stripe_webhook_events where stripe_event_id='f1')=3,'attempts geteld');
end $$;

grant usage on schema t to public; grant execute on all functions in schema t to public;
set role anon;
do $$ begin begin perform public.stripe_claim_event('z','x',false,now(),null,null); perform t.ok(false,'anon mag niet'); exception when insufficient_privilege then perform t.ok(true,'anon: geen EXECUTE'); end; end $$;
reset role;
set role authenticated;
do $$ begin
 begin perform public.stripe_apply_subscription('z',now(),'{}'::jsonb); perform t.ok(false,'authenticated mag niet'); exception when insufficient_privilege then perform t.ok(true,'authenticated: geen EXECUTE apply'); end;
 begin perform 1 from public.stripe_webhook_events; perform t.ok(false,'events leesbaar'); exception when insufficient_privilege then perform t.ok(true,'authenticated: geen SELECT op events'); end;
 begin perform 1 from public.stripe_billing_conflicts; perform t.ok(false,'zou geen rij mogen tonen'); exception when others then null; end;
 perform t.ok((select count(*) from public.stripe_billing_conflicts)=0,'authenticated (niet-admin) ziet 0 conflicten via RLS');
 begin update public.profiles set subscription_active=true; perform t.ok(false,'update'); exception when insufficient_privilege then perform t.ok(true,'authenticated: nog steeds geen UPDATE op profiles'); end;
end $$;
reset role;
set role service_role;
do $$ begin
 begin insert into public.stripe_webhook_events(stripe_event_id,event_type,livemode,stripe_created_at) values('direct','x',false,now()); perform t.ok(false,'directe insert'); exception when insufficient_privilege then perform t.ok(true,'service_role: schrijft alleen via RPC (geen directe INSERT)'); end;
 perform t.ok(public.stripe_claim_event('svc','x',false,now(),null,null)='claimed','service_role: RPC werkt');
end $$;
reset role;
-- admin ziet conflicten
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$ begin perform t.ok((select count(*) from public.stripe_billing_conflicts)>0,'admin ziet conflicten via RLS'); end $$;
reset role;
\echo ALLE_TESTS_GESLAAGD
