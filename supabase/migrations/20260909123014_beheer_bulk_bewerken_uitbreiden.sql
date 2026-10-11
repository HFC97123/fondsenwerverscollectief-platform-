-- Vervolgopdracht: volwaardige bulk-editor voor Funders en Subsidieregelingen.
-- Vijf nieuwe, admin-only RPC's (SECURITY DEFINER + current_user_is_admin(),
-- zelfde patroon als de rest van de admin-laag). Reviewed/toegangsniveau
-- gebruiken bewust dezelfde onderliggende kolommen als de individuele
-- bewerking (classification_reviewed / access_tier) - geen tweede
-- statusveld. De bestaande admin_bulk_set_access_tier wordt ongewijzigd
-- hergebruikt (niet hieronder herhaald). admin_bulk_classify_funders/
-- subsidieregelingen (forceren altijd data_tier+source_type+reviewed samen)
-- worden bewust niet hergebruikt voor een losse "Reviewed"-toggle, want dat
-- zou ongevraagd ook data_tier/source_type overschrijven.

-- 1) Reviewed/goedgekeurd in bulk - alleen classification_reviewed, laat
--    data_tier/source_type van elk record ongemoeid. Generiek over beide
--    tabellen (zelfde p_tabel-patroon als admin_bulk_set_access_tier).
create or replace function public.admin_bulk_set_reviewed(
  p_tabel text,
  p_ids uuid[],
  p_reviewed boolean
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_aantal integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen classificaties wijzigen.' using errcode = '42501';
  end if;

  if p_tabel not in ('funders', 'subsidieregelingen') then
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  if p_tabel = 'funders' then
    update public.funders set classification_reviewed = p_reviewed where id = any(p_ids);
  else
    update public.subsidieregelingen set classification_reviewed = p_reviewed where id = any(p_ids);
  end if;

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$function$;

-- 2) Bulk-bijwerken van losse, enkelvoudige funder-velden. Elk veld heeft
--    een eigen "_actief"-vlag i.p.v. NULL-als-"niet gekozen": bij
--    subsidieregelingen kan "Type" bewust naar NULL ("overgenomen van
--    gever") gezet worden, dus NULL moet daar een geldige, expliciete
--    waarde kunnen zijn - vandaar geen kale coalesce(nieuw, oud)-patroon.
create or replace function public.admin_bulk_update_funder(
  p_funder_ids uuid[],
  p_type_actief boolean default false,
  p_type funder_type default null,
  p_data_tier_actief boolean default false,
  p_data_tier subsidie_data_tier default null,
  p_vergaderfrequentie_actief boolean default false,
  p_vergaderfrequentie text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_aantal integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_funder_ids is null or array_length(p_funder_ids, 1) is null then
    return 0;
  end if;

  update public.funders
  set type = case when p_type_actief then p_type else type end,
      data_tier = case when p_data_tier_actief then p_data_tier else data_tier end,
      vergaderfrequentie = case when p_vergaderfrequentie_actief then p_vergaderfrequentie else vergaderfrequentie end,
      updated_at = now()
  where id = any(p_funder_ids);

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$function$;

-- 3) Zelfde als 2, voor subsidieregelingen - plus status en type_projecten,
--    die funders niet hebben.
create or replace function public.admin_bulk_update_subsidieregeling(
  p_regeling_ids uuid[],
  p_type_actief boolean default false,
  p_type funder_type default null,
  p_status_actief boolean default false,
  p_status regeling_status_type default null,
  p_type_projecten_actief boolean default false,
  p_type_projecten text default null,
  p_data_tier_actief boolean default false,
  p_data_tier subsidie_data_tier default null,
  p_vergaderfrequentie_actief boolean default false,
  p_vergaderfrequentie text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_aantal integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_regeling_ids is null or array_length(p_regeling_ids, 1) is null then
    return 0;
  end if;

  update public.subsidieregelingen
  set type = case when p_type_actief then p_type else type end,
      status = case when p_status_actief then p_status else status end,
      type_projecten = case when p_type_projecten_actief then p_type_projecten else type_projecten end,
      data_tier = case when p_data_tier_actief then p_data_tier else data_tier end,
      vergaderfrequentie = case when p_vergaderfrequentie_actief then p_vergaderfrequentie else vergaderfrequentie end,
      updated_at = now()
  where id = any(p_regeling_ids);

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$function$;

-- 4) Generieke bulk-bandbreedte (zelfde p_tabel-patroon als het bestaande,
--    per-record admin_set_bandbreedte). NULL is hier een geldige, bewuste
--    waarde ("geen bandbreedte") - deze RPC wordt alleen aangeroepen
--    wanneer de beheerder dit veld expliciet aanvinkt in de bulk-editor.
create or replace function public.admin_bulk_set_bandbreedte(
  p_tabel text,
  p_ids uuid[],
  p_bandbreedte_id uuid
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_aantal integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen de bandbreedte wijzigen' using errcode = '42501';
  end if;

  if p_tabel not in ('funders', 'subsidieregelingen') then
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  if p_tabel = 'funders' then
    update public.funders set bandbreedte_bijdrage_id = p_bandbreedte_id where id = any(p_ids);
  else
    update public.subsidieregelingen set bandbreedte_bijdrage_id = p_bandbreedte_id where id = any(p_ids);
  end if;

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$function$;

-- 5) Generieke bulk-classificatiekoppeling met toevoegen/verwijderen/
--    vervangen per classificatietype, over meerdere ids tegelijk (telkens
--    één DELETE/INSERT-statement voor de hele selectie, geen per-record
--    lus - voorkomt honderden losse queries bij grote selecties). "add"
--    gebruikt ON CONFLICT DO NOTHING tegen de samengestelde primary key van
--    elke koppeltabel (funder_id/subsidieregeling_id + thema_id/
--    doelgroep_id/regio_id), dus nooit een dubbele relatie. "replace" bij
--    een lege/ontbrekende naamlijst maakt bewust leeg (geen koppelingen
--    meer van dat type) - net als bij de bestaande, per-record
--    admin_set_classificatie_koppelingen.
create or replace function public.admin_bulk_set_classificatie_koppelingen(
  p_tabel text,
  p_ids uuid[],
  p_thema_actie text default null,
  p_thema_namen text[] default null,
  p_doelgroep_actie text default null,
  p_doelgroep_namen text[] default null,
  p_regio_actie text default null,
  p_regio_namen text[] default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen koppelingen wijzigen' using errcode = '42501';
  end if;

  if p_tabel not in ('funders', 'subsidieregelingen') then
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;

  if p_thema_actie is not null and p_thema_actie not in ('add', 'remove', 'replace') then
    raise exception 'Onbekende actie voor discipline: %', p_thema_actie using errcode = '22023';
  end if;
  if p_doelgroep_actie is not null and p_doelgroep_actie not in ('add', 'remove', 'replace') then
    raise exception 'Onbekende actie voor doelgroep: %', p_doelgroep_actie using errcode = '22023';
  end if;
  if p_regio_actie is not null and p_regio_actie not in ('add', 'remove', 'replace') then
    raise exception 'Onbekende actie voor werkgebied: %', p_regio_actie using errcode = '22023';
  end if;

  if p_tabel = 'funders' then
    if p_thema_actie = 'replace' then
      delete from public.funder_themas where funder_id = any(p_ids);
      insert into public.funder_themas (funder_id, thema_id)
        select fid, t.id from unnest(p_ids) as fid cross join public.themas t where t.naam = any(p_thema_namen);
    elsif p_thema_actie = 'add' then
      insert into public.funder_themas (funder_id, thema_id)
        select fid, t.id from unnest(p_ids) as fid cross join public.themas t where t.naam = any(p_thema_namen)
        on conflict do nothing;
    elsif p_thema_actie = 'remove' then
      delete from public.funder_themas where funder_id = any(p_ids)
        and thema_id in (select id from public.themas where naam = any(p_thema_namen));
    end if;

    if p_doelgroep_actie = 'replace' then
      delete from public.funder_doelgroepen where funder_id = any(p_ids);
      insert into public.funder_doelgroepen (funder_id, doelgroep_id)
        select fid, d.id from unnest(p_ids) as fid cross join public.doelgroepen d where d.naam = any(p_doelgroep_namen);
    elsif p_doelgroep_actie = 'add' then
      insert into public.funder_doelgroepen (funder_id, doelgroep_id)
        select fid, d.id from unnest(p_ids) as fid cross join public.doelgroepen d where d.naam = any(p_doelgroep_namen)
        on conflict do nothing;
    elsif p_doelgroep_actie = 'remove' then
      delete from public.funder_doelgroepen where funder_id = any(p_ids)
        and doelgroep_id in (select id from public.doelgroepen where naam = any(p_doelgroep_namen));
    end if;

    if p_regio_actie = 'replace' then
      delete from public.funder_regios where funder_id = any(p_ids);
      insert into public.funder_regios (funder_id, regio_id)
        select fid, r.id from unnest(p_ids) as fid cross join public.regios r where r.naam = any(p_regio_namen);
    elsif p_regio_actie = 'add' then
      insert into public.funder_regios (funder_id, regio_id)
        select fid, r.id from unnest(p_ids) as fid cross join public.regios r where r.naam = any(p_regio_namen)
        on conflict do nothing;
    elsif p_regio_actie = 'remove' then
      delete from public.funder_regios where funder_id = any(p_ids)
        and regio_id in (select id from public.regios where naam = any(p_regio_namen));
    end if;

  elsif p_tabel = 'subsidieregelingen' then
    if p_thema_actie = 'replace' then
      delete from public.subsidieregeling_themas where subsidieregeling_id = any(p_ids);
      insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
        select fid, t.id from unnest(p_ids) as fid cross join public.themas t where t.naam = any(p_thema_namen);
    elsif p_thema_actie = 'add' then
      insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
        select fid, t.id from unnest(p_ids) as fid cross join public.themas t where t.naam = any(p_thema_namen)
        on conflict do nothing;
    elsif p_thema_actie = 'remove' then
      delete from public.subsidieregeling_themas where subsidieregeling_id = any(p_ids)
        and thema_id in (select id from public.themas where naam = any(p_thema_namen));
    end if;

    if p_doelgroep_actie = 'replace' then
      delete from public.subsidieregeling_doelgroepen where subsidieregeling_id = any(p_ids);
      insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
        select fid, d.id from unnest(p_ids) as fid cross join public.doelgroepen d where d.naam = any(p_doelgroep_namen);
    elsif p_doelgroep_actie = 'add' then
      insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
        select fid, d.id from unnest(p_ids) as fid cross join public.doelgroepen d where d.naam = any(p_doelgroep_namen)
        on conflict do nothing;
    elsif p_doelgroep_actie = 'remove' then
      delete from public.subsidieregeling_doelgroepen where subsidieregeling_id = any(p_ids)
        and doelgroep_id in (select id from public.doelgroepen where naam = any(p_doelgroep_namen));
    end if;

    if p_regio_actie = 'replace' then
      delete from public.subsidieregeling_regios where subsidieregeling_id = any(p_ids);
      insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
        select fid, r.id from unnest(p_ids) as fid cross join public.regios r where r.naam = any(p_regio_namen);
    elsif p_regio_actie = 'add' then
      insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
        select fid, r.id from unnest(p_ids) as fid cross join public.regios r where r.naam = any(p_regio_namen)
        on conflict do nothing;
    elsif p_regio_actie = 'remove' then
      delete from public.subsidieregeling_regios where subsidieregeling_id = any(p_ids)
        and regio_id in (select id from public.regios where naam = any(p_regio_namen));
    end if;
  end if;
end;
$function$;
