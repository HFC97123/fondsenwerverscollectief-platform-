-- Fase 1 Classificatiebeheer: admin-RPC's voor CRUD op de centrale
-- classificatiewaarden (themas/doelgroepen/regios) en voor het lezen/
-- schrijven van de koppelingen naar funders/subsidieregelingen.
-- Alle functies: SECURITY DEFINER, admin-gated via current_user_is_admin(),
-- vaste search_path, en dispatchen op p_type/p_tabel via een gecontroleerde
-- if/elsif-lijst (nooit dynamische identifiers uit user input).

-- 1) Lijst van classificatiewaarden mét gebruiksaantal, voor het nieuwe
--    Classificatiebeheer-scherm.
create or replace function public.admin_list_classificaties(p_type text)
returns table (id uuid, naam text, gebruikt_aantal bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen classificaties bekijken' using errcode = '42501';
  end if;

  if p_type = 'themas' then
    return query
      select t.id, t.naam,
        (select count(*) from public.funder_themas ft where ft.thema_id = t.id)
        + (select count(*) from public.subsidieregeling_themas st where st.thema_id = t.id) as gebruikt_aantal
      from public.themas t
      order by t.naam;
  elsif p_type = 'doelgroepen' then
    return query
      select d.id, d.naam,
        (select count(*) from public.funder_doelgroepen fd where fd.doelgroep_id = d.id)
        + (select count(*) from public.subsidieregeling_doelgroepen sd where sd.doelgroep_id = d.id) as gebruikt_aantal
      from public.doelgroepen d
      order by d.naam;
  elsif p_type = 'regios' then
    return query
      select r.id, r.naam,
        (select count(*) from public.funder_regios fr where fr.regio_id = r.id)
        + (select count(*) from public.subsidieregeling_regios sr where sr.regio_id = r.id) as gebruikt_aantal
      from public.regios r
      order by r.naam;
  else
    raise exception 'Onbekend classificatietype: %', p_type using errcode = '22023';
  end if;
end;
$$;

-- 2) Nieuwe classificatiewaarde toevoegen.
create or replace function public.admin_add_classificatiewaarde(p_type text, p_naam text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_naam text := trim(p_naam);
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen classificaties toevoegen' using errcode = '42501';
  end if;

  if v_naam = '' or v_naam is null then
    raise exception 'Naam mag niet leeg zijn' using errcode = '22023';
  end if;

  if p_type = 'themas' then
    insert into public.themas (naam) values (v_naam) returning id into v_id;
  elsif p_type = 'doelgroepen' then
    insert into public.doelgroepen (naam) values (v_naam) returning id into v_id;
  elsif p_type = 'regios' then
    insert into public.regios (naam) values (v_naam) returning id into v_id;
  else
    raise exception 'Onbekend classificatietype: %', p_type using errcode = '22023';
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'Deze waarde bestaat al: %', v_naam using errcode = '23505';
end;
$$;

-- 3) Classificatiewaarde hernoemen.
create or replace function public.admin_hernoem_classificatiewaarde(p_type text, p_id uuid, p_naam text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_naam text := trim(p_naam);
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen classificaties hernoemen' using errcode = '42501';
  end if;

  if v_naam = '' or v_naam is null then
    raise exception 'Naam mag niet leeg zijn' using errcode = '22023';
  end if;

  if p_type = 'themas' then
    update public.themas set naam = v_naam where id = p_id;
  elsif p_type = 'doelgroepen' then
    update public.doelgroepen set naam = v_naam where id = p_id;
  elsif p_type = 'regios' then
    update public.regios set naam = v_naam where id = p_id;
  else
    raise exception 'Onbekend classificatietype: %', p_type using errcode = '22023';
  end if;
exception
  when unique_violation then
    raise exception 'Deze waarde bestaat al: %', v_naam using errcode = '23505';
end;
$$;

-- 4) Classificatiewaarde verwijderen (koppelingen vervallen automatisch via
--    ON DELETE CASCADE op de koppeltabellen).
create or replace function public.admin_verwijder_classificatiewaarde(p_type text, p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen classificaties verwijderen' using errcode = '42501';
  end if;

  if p_type = 'themas' then
    delete from public.themas where id = p_id;
  elsif p_type = 'doelgroepen' then
    delete from public.doelgroepen where id = p_id;
  elsif p_type = 'regios' then
    delete from public.regios where id = p_id;
  else
    raise exception 'Onbekend classificatietype: %', p_type using errcode = '22023';
  end if;
end;
$$;

-- 5) Huidige koppelingen van één funder/subsidieregeling ophalen (als
--    namen, klaar om in ClassificatieSelect te tonen).
create or replace function public.admin_get_classificatie_koppelingen(p_tabel text, p_rij_id uuid)
returns table (themas text[], doelgroepen text[], regios text[])
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen koppelingen bekijken' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    return query select
      coalesce((select array_agg(t.naam order by t.naam) from public.funder_themas ft join public.themas t on t.id = ft.thema_id where ft.funder_id = p_rij_id), '{}'),
      coalesce((select array_agg(d.naam order by d.naam) from public.funder_doelgroepen fd join public.doelgroepen d on d.id = fd.doelgroep_id where fd.funder_id = p_rij_id), '{}'),
      coalesce((select array_agg(r.naam order by r.naam) from public.funder_regios fr join public.regios r on r.id = fr.regio_id where fr.funder_id = p_rij_id), '{}');
  elsif p_tabel = 'subsidieregelingen' then
    return query select
      coalesce((select array_agg(t.naam order by t.naam) from public.subsidieregeling_themas st join public.themas t on t.id = st.thema_id where st.subsidieregeling_id = p_rij_id), '{}'),
      coalesce((select array_agg(d.naam order by d.naam) from public.subsidieregeling_doelgroepen sd join public.doelgroepen d on d.id = sd.doelgroep_id where sd.subsidieregeling_id = p_rij_id), '{}'),
      coalesce((select array_agg(r.naam order by r.naam) from public.subsidieregeling_regios sr join public.regios r on r.id = sr.regio_id where sr.subsidieregeling_id = p_rij_id), '{}');
  else
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;
end;
$$;

-- 6) Koppelingen van één funder/subsidieregeling volledig vervangen
--    (delete-then-insert, alleen die ene rij; namen die niet bestaan in de
--    centrale lijst worden genegeerd — de admin-UI biedt daarom geen vrije
--    tekst aan, alleen bestaande waarden of "eerst toevoegen via
--    Classificatiebeheer").
create or replace function public.admin_set_classificatie_koppelingen(
  p_tabel text,
  p_rij_id uuid,
  p_thema_namen text[] default null,
  p_doelgroep_namen text[] default null,
  p_regio_namen text[] default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen koppelingen wijzigen' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    if p_thema_namen is not null then
      delete from public.funder_themas where funder_id = p_rij_id;
      insert into public.funder_themas (funder_id, thema_id)
        select p_rij_id, t.id from public.themas t where t.naam = any(p_thema_namen);
    end if;
    if p_doelgroep_namen is not null then
      delete from public.funder_doelgroepen where funder_id = p_rij_id;
      insert into public.funder_doelgroepen (funder_id, doelgroep_id)
        select p_rij_id, d.id from public.doelgroepen d where d.naam = any(p_doelgroep_namen);
    end if;
    if p_regio_namen is not null then
      delete from public.funder_regios where funder_id = p_rij_id;
      insert into public.funder_regios (funder_id, regio_id)
        select p_rij_id, r.id from public.regios r where r.naam = any(p_regio_namen);
    end if;
  elsif p_tabel = 'subsidieregelingen' then
    if p_thema_namen is not null then
      delete from public.subsidieregeling_themas where subsidieregeling_id = p_rij_id;
      insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
        select p_rij_id, t.id from public.themas t where t.naam = any(p_thema_namen);
    end if;
    if p_doelgroep_namen is not null then
      delete from public.subsidieregeling_doelgroepen where subsidieregeling_id = p_rij_id;
      insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
        select p_rij_id, d.id from public.doelgroepen d where d.naam = any(p_doelgroep_namen);
    end if;
    if p_regio_namen is not null then
      delete from public.subsidieregeling_regios where subsidieregeling_id = p_rij_id;
      insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
        select p_rij_id, r.id from public.regios r where r.naam = any(p_regio_namen);
    end if;
  else
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.admin_list_classificaties(text) from public, anon;
revoke all on function public.admin_add_classificatiewaarde(text, text) from public, anon;
revoke all on function public.admin_hernoem_classificatiewaarde(text, uuid, text) from public, anon;
revoke all on function public.admin_verwijder_classificatiewaarde(text, uuid) from public, anon;
revoke all on function public.admin_get_classificatie_koppelingen(text, uuid) from public, anon;
revoke all on function public.admin_set_classificatie_koppelingen(text, uuid, text[], text[], text[]) from public, anon;

grant execute on function public.admin_list_classificaties(text) to authenticated;
grant execute on function public.admin_add_classificatiewaarde(text, text) to authenticated;
grant execute on function public.admin_hernoem_classificatiewaarde(text, uuid, text) to authenticated;
grant execute on function public.admin_verwijder_classificatiewaarde(text, uuid) to authenticated;
grant execute on function public.admin_get_classificatie_koppelingen(text, uuid) to authenticated;
grant execute on function public.admin_set_classificatie_koppelingen(text, uuid, text[], text[], text[]) to authenticated;
