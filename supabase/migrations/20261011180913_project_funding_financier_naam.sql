-- Projectfinanciering: financiering van externe cofinanciers zonder cataloguskoppeling.
--
-- Aanleiding: cofinanciers stonden gestructureerd (naam, bedrag, status) in
-- subsidie_kompas_programs.cofinanciers, maar niet in subsidie_kompas_program_funding. Daardoor
-- ontbraken hun bedragen op Dashboard, Projecten, Projectfinanciering en in de chatcontext.
-- program_funding accepteerde alleen regels die naar een fonds (funder_id) of regeling (scheme_id)
-- verwijzen.
--
-- Wat deze migratie doet (alles additief; er wordt niets verwijderd):
--   1. nullable kolom financier_naam (alleen voor financiers zonder betrouwbare cataloguskoppeling);
--   2. bronregel: een regel verwijst naar HOOGSTENS een van scheme_id / funder_id / financier_naam
--      (een regel met drie lege bronnen blijft de bestaande staat "bron niet meer beschikbaar");
--   3. unieke naam per project (idempotentie, geen dubbele regels);
--   4. kolomrechten voor insert/update van financier_naam voor authenticated;
--   5. kompas_dekkingsplan() geeft een naam-regel terug als zichtbare bron (bron_type 'financier');
--      de signatuur blijft ongewijzigd;
--   6. eenmalige, idempotente overname van de bestaande gestructureerde cofinanciers.
--
-- De kolom subsidie_kompas_programs.cofinanciers blijft bestaan (legacy / rollback) maar wordt niet
-- meer geschreven en door niets meer gelezen voor totalen.
-- Rollback: zie supabase/voorstel-niet-uitgevoerd/20261011180913_project_funding_financier_naam_rollback.sql

-- 1. Kolom + lengtebeperking --------------------------------------------------------------------
alter table public.subsidie_kompas_program_funding
  add column if not exists financier_naam text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subsidie_kompas_program_funding_naam_chk') then
    alter table public.subsidie_kompas_program_funding
      add constraint subsidie_kompas_program_funding_naam_chk
      check (financier_naam is null or char_length(btrim(financier_naam)) between 1 and 200);
  end if;

  -- 2. Hoogstens een bron per regel.
  if not exists (select 1 from pg_constraint where conname = 'subsidie_kompas_program_funding_hoogstens_een_bron_chk') then
    alter table public.subsidie_kompas_program_funding
      add constraint subsidie_kompas_program_funding_hoogstens_een_bron_chk
      check (num_nonnulls(scheme_id, funder_id, financier_naam) <= 1);
  end if;
end $$;

-- 3. Een financier met dezelfde naam komt per project maar een keer voor.
create unique index if not exists subsidie_kompas_program_funding_unique_naam
  on public.subsidie_kompas_program_funding (program_id, lower(btrim(financier_naam)))
  where financier_naam is not null;

-- 4. Kolomrechten (dezelfde aanpak als de overige velden van deze tabel).
grant insert (financier_naam) on public.subsidie_kompas_program_funding to authenticated;
grant update (financier_naam) on public.subsidie_kompas_program_funding to authenticated;

-- Triggers: bij aanmaken precies een bron; de naam blijft een naam-regel en wordt nooit leeg.
create or replace function public.subsidie_kompas_program_funding_voor_insert()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.financier_naam := nullif(btrim(new.financier_naam), '');

  if num_nonnulls(new.scheme_id, new.funder_id, new.financier_naam) <> 1 then
    raise exception 'Een financieringsregel verwijst naar precies een regeling, een fonds of een genoemde financier'
      using errcode = '23514';
  end if;

  new.created_at := now();
  new.updated_at := now();

  return new;
end;
$function$;

create or replace function public.subsidie_kompas_program_funding_voor_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.program_id is distinct from old.program_id then
    raise exception 'user_id en program_id van een financieringsregel zijn onveranderlijk'
      using errcode = '23514';
  end if;

  if new.scheme_id is distinct from old.scheme_id
     and not (old.scheme_id is not null and new.scheme_id is null) then
    raise exception 'scheme_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  if new.funder_id is distinct from old.funder_id
     and not (old.funder_id is not null and new.funder_id is null) then
    raise exception 'funder_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  -- De naam van een genoemde financier mag worden gecorrigeerd, maar de regel blijft een naam-regel.
  new.financier_naam := case when new.financier_naam is null then null else nullif(btrim(new.financier_naam), '') end;

  if new.financier_naam is distinct from old.financier_naam
     and (old.financier_naam is null or new.financier_naam is null) then
    raise exception 'financier_naam kan alleen worden gewijzigd bij een regel met een genoemde financier'
      using errcode = '23514';
  end if;

  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();

  return new;
end;
$function$;

-- 5. kompas_dekkingsplan(): genoemde financiers zijn altijd zichtbaar (het is de eigen invoer van het lid).
create or replace function public.kompas_dekkingsplan(p_program_id uuid)
returns table(
  id uuid, program_id uuid, bron_type text, bron_status text, scheme_id uuid, funder_id uuid,
  bron_naam text, funder_naam text, website text, systeem_deadline date, systeem_deadline_bron text,
  requested_amount numeric, awarded_amount numeric, status text, eigen_deadline date,
  effectieve_deadline date, reminder_enabled boolean, notes text,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tier text;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  if p_program_id is null or not exists (
    select 1 from public.subsidie_kompas_programs p
    where p.id = p_program_id and p.user_id = v_uid
  ) then
    raise exception 'Project niet gevonden' using errcode = '42501';
  end if;

  v_tier := case
    when public.current_user_has_premium_access() then 'premium'
    when public.current_user_has_pro_access() then 'pro'
    else 'free'
  end;

  return query
  with basis as (
    select
      pf.*,
      sr.id as sr_id, sr.naam as sr_naam, sr.website as sr_website, sr.deadline_datum as sr_deadline,
      fs.naam as fs_naam, fs.website as fs_website,
      f.id as f_id, f.naam as f_naam, f.website as f_website,
      case
        when pf.financier_naam is not null then true
        when sr.id is not null then
          sr.classification_reviewed
          and public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, v_tier)
          and (v_tier = 'premium' or not coalesce((to_jsonb(fs) ->> 'premium_exclusive')::boolean, false))
        when f.id is not null then
          f.classification_reviewed
          and public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, v_tier)
          and (v_tier = 'premium' or not coalesce((to_jsonb(f) ->> 'premium_exclusive')::boolean, false))
        else false
      end as zichtbaar
    from public.subsidie_kompas_program_funding pf
    left join public.subsidieregelingen sr on sr.id = pf.scheme_id
    left join public.funders fs on fs.id = sr.funder_id
    left join public.funders f on f.id = pf.funder_id
    where pf.program_id = p_program_id
      and pf.user_id = v_uid
  ),
  met_deadline as (
    select
      b.*,
      case when b.zichtbaar and b.sr_id is not null then
        case when exists (select 1 from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = b.sr_id)
             then (select vr.sluitingsdatum from public.subsidieregeling_volgende_ronde(b.sr_id, now()) vr limit 1)
             else b.sr_deadline end
      when b.zichtbaar and b.f_id is not null then
        (select vd.sluitingsdatum from public.funder_volgende_datamoment(b.f_id, null, now()) vd limit 1)
      else null end as sys_deadline,
      case when b.zichtbaar and b.sr_id is not null then
        case when exists (select 1 from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = b.sr_id)
             then 'ronde' else 'regeling' end
      when b.zichtbaar and b.f_id is not null then 'fonds'
      else null end as sys_bron
    from basis b
  )
  select
    m.id,
    m.program_id,
    case when m.financier_naam is not null then 'financier'
         when m.scheme_id is not null then 'regeling'
         when m.funder_id is not null then 'fonds'
         else null end,
    case when m.financier_naam is not null then 'zichtbaar'
         when m.scheme_id is null and m.funder_id is null then 'verwijderd'
         when m.zichtbaar then 'zichtbaar'
         else 'verborgen' end,
    case when m.zichtbaar then m.scheme_id else null end,
    case when m.zichtbaar then m.funder_id else null end,
    case when m.financier_naam is not null then m.financier_naam
         when not m.zichtbaar then null
         when m.sr_id is not null then m.sr_naam
         else m.f_naam end,
    case when m.financier_naam is not null then null
         when not m.zichtbaar then null
         when m.sr_id is not null then m.fs_naam
         else m.f_naam end,
    case when m.financier_naam is not null then null
         when not m.zichtbaar then null
         when m.sr_id is not null then coalesce(m.sr_website, m.fs_website)
         else m.f_website end,
    m.sys_deadline,
    m.sys_bron,
    m.requested_amount,
    m.awarded_amount,
    m.status,
    m.eigen_deadline,
    coalesce(m.eigen_deadline, m.sys_deadline),
    m.reminder_enabled,
    m.notes,
    m.created_at,
    m.updated_at
  from met_deadline m
  order by coalesce(m.eigen_deadline, m.sys_deadline) nulls last, m.created_at, m.id;
end;
$function$;

-- 6. Eenmalige, idempotente overname van de bestaande gestructureerde cofinanciers -----------------
-- Regels (strikt; geen raden, geen tekstinterpretatie van bedragen):
--   naam      : niet leeg na btrim
--   bedrag    : alleen "25000" of "25.000" (duizendtallen met punt); alles anders wordt NIET overgenomen
--   status    : toegezegd / toegekend            -> awarded   (awarded_amount = bedrag)
--               aangevraagd / ingediend / in aanvraag -> submitted (requested_amount = bedrag)
--               afgewezen                         -> rejected  (requested_amount = bedrag)
--               verkennend                        -> interesting (requested_amount = bedrag)
--               andere statussen worden NIET overgenomen
--   koppeling : alleen aan een fonds (funder_id) als de naam exact (hoofdletterongevoelig) en uniek in
--               funders voorkomt EN dat fonds voor Pro zichtbaar is (access_tier <> 'premium'); anders
--               blijft het een genoemde financier (financier_naam). Nooit fuzzy, nooit via AI.
-- Dubbele namen binnen een project en regels die al bestaan worden overgeslagen (unieke indexen).
do $migratie$
declare
  p record;
  c jsonb;
  v_naam text;
  v_bedrag_txt text;
  v_bedrag numeric;
  v_status_txt text;
  v_status text;
  v_funder uuid;
  v_aantal_funders int;
  v_ingevoegd int := 0;
  v_overgeslagen int := 0;
  v_rijen int;
begin
  for p in
    select pr.id, pr.user_id, pr.cofinanciers
    from public.subsidie_kompas_programs pr
    where jsonb_typeof(pr.cofinanciers) = 'array' and jsonb_array_length(pr.cofinanciers) > 0
  loop
    for c in select e from jsonb_array_elements(p.cofinanciers) as t(e)
    loop
      if jsonb_typeof(c) <> 'object' then
        continue;
      end if;

      v_naam := btrim(coalesce(c ->> 'naam', ''));
      v_bedrag_txt := btrim(coalesce(c ->> 'bedrag', ''));

      -- volledig lege rij (naam en bedrag leeg): niets te migreren
      if v_naam = '' and v_bedrag_txt = '' then
        continue;
      end if;

      v_bedrag := null;
      if v_bedrag_txt ~ '^[0-9]+$' then
        v_bedrag := v_bedrag_txt::numeric;
      elsif v_bedrag_txt ~ '^[0-9]{1,3}(\.[0-9]{3})+$' then
        v_bedrag := replace(v_bedrag_txt, '.', '')::numeric;
      end if;

      v_status_txt := lower(btrim(coalesce(c ->> 'status', '')));
      v_status := case
        when v_status_txt in ('toegezegd', 'toegekend') then 'awarded'
        when v_status_txt in ('aangevraagd', 'ingediend', 'in aanvraag') then 'submitted'
        when v_status_txt = 'afgewezen' then 'rejected'
        when v_status_txt = 'verkennend' then 'interesting'
        else null
      end;

      if v_naam = '' or v_bedrag is null or v_status is null or v_bedrag >= 1000000000000 then
        v_overgeslagen := v_overgeslagen + 1;
        raise notice 'cofinancier niet overgenomen (project %, naam "%", bedrag "%", status "%")', p.id, v_naam, v_bedrag_txt, v_status_txt;
        continue;
      end if;

      select count(*), min(f.id::text)::uuid into v_aantal_funders, v_funder
      from public.funders f
      where lower(btrim(f.naam)) = lower(v_naam) and f.access_tier::text <> 'premium';

      if v_aantal_funders <> 1 then
        v_funder := null;
      end if;

      insert into public.subsidie_kompas_program_funding
        (user_id, program_id, funder_id, financier_naam, status, requested_amount, awarded_amount)
      values
        (p.user_id, p.id,
         v_funder,
         case when v_funder is null then v_naam else null end,
         v_status,
         case when v_status = 'awarded' then null else v_bedrag end,
         case when v_status = 'awarded' then v_bedrag else null end)
      on conflict do nothing;

      get diagnostics v_rijen = row_count;
      v_ingevoegd := v_ingevoegd + v_rijen;
    end loop;
  end loop;

  raise notice 'cofinanciers overgenomen: %, overgeslagen: %', v_ingevoegd, v_overgeslagen;
end
$migratie$;
