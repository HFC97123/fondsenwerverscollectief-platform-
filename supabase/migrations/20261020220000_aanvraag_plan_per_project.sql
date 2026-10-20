-- Aanvraag-assistent: het algemene projectplan wordt één keer per project geschreven; het aantal projecten per abonnement is begrensd.
-- (nog NIET toegepast op het live project; wordt toegepast na akkoord van Aisya). Bouwt voort op 20261020210000_aanvraag_verbruik_atomair.
--
-- Regel: per project mag het algemene plan één keer door de AI worden geschreven (daarna past het lid het zelf aan). Het aantal verschillende
-- projecten met een geschreven plan per rollend jaar hangt af van het abonnement (Pro 1, Premium 3: tierConfig.ts, projectplannen).
-- Het project_id in de verbruikstabel heeft bewust GEEN verwijzing naar het project: een project verwijderen geeft de plek niet terug.
-- Terugdraaien: supabase/voorstellen/20261020220000_aanvraag_plan_per_project_rollback.sql
begin;

alter table public.subsidie_kompas_aanvraag_verbruik add column if not exists project_id uuid null;
create index if not exists subsidie_kompas_aanvraag_verbruik_project_idx on public.subsidie_kompas_aanvraag_verbruik (user_id, project_id) where project_id is not null;

-- Stand van de plannen: hoeveel verschillende projecten sinds p_sinds een plan hebben (afgerond of verse reservering), en is dit project al geschreven (ooit)?
create or replace function public.aanvraag_plan_stand(p_user uuid, p_project uuid, p_sinds timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'gebruikt', (
      select count(distinct v.project_id)::integer
      from public.subsidie_kompas_aanvraag_verbruik v
      where v.user_id = p_user and v.soort = 'plannen' and v.project_id is not null and v.created_at >= p_sinds
        and (v.status = 'afgerond' or (v.status = 'gereserveerd' and v.created_at > now() - interval '10 minutes'))
    ),
    'project_klaar', (
      p_project is not null and exists (
        select 1 from public.subsidie_kompas_aanvraag_verbruik v
        where v.user_id = p_user and v.soort = 'plannen' and v.project_id = p_project
          and (v.status = 'afgerond' or (v.status = 'gereserveerd' and v.created_at > now() - interval '10 minutes'))
      )
    )
  );
$$;

create or replace function public.aanvraag_plan_reserveer(p_user uuid, p_project uuid, p_limiet integer, p_sinds timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stand jsonb;
  v_gebruikt integer;
  v_mislukt integer;
  v_id uuid;
begin
  if p_user is null or p_project is null or p_limiet is null or p_limiet < 0 or p_sinds is null then
    raise exception 'Ongeldige invoer' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('aanvraag_verbruik:' || p_user::text, 0));

  v_stand := public.aanvraag_plan_stand(p_user, p_project, p_sinds);
  v_gebruikt := (v_stand->>'gebruikt')::integer;

  if (v_stand->>'project_klaar')::boolean then
    return jsonb_build_object('ok', false, 'reden', 'al-geschreven', 'gebruikt', v_gebruikt);
  end if;

  if v_gebruikt >= p_limiet then
    return jsonb_build_object('ok', false, 'reden', 'plan-limiet', 'gebruikt', v_gebruikt);
  end if;

  select count(*)::integer into v_mislukt
  from public.subsidie_kompas_aanvraag_verbruik v
  where v.user_id = p_user and v.status = 'mislukt' and v.created_at > now() - interval '1 hour';

  if v_mislukt >= 10 then
    return jsonb_build_object('ok', false, 'reden', 'te-veel-mislukt', 'gebruikt', v_gebruikt);
  end if;

  insert into public.subsidie_kompas_aanvraag_verbruik (user_id, soort, project_id) values (p_user, 'plannen', p_project) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'gebruikt', v_gebruikt);
end;
$$;

revoke all on function public.aanvraag_plan_stand(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.aanvraag_plan_reserveer(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.aanvraag_plan_stand(uuid, uuid, timestamptz) to service_role;
grant execute on function public.aanvraag_plan_reserveer(uuid, uuid, integer, timestamptz) to service_role;

commit;
