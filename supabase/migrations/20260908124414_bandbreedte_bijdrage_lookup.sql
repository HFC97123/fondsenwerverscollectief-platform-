-- Centrale lookup-tabel voor "Bandbreedte bijdrage": een vast, door de
-- gebruiker aanpasbaar stelsel van 8 bedragscategorieën, gedeeld door
-- funders en subsidieregelingen. Zelfde patroon als themas/doelgroepen/
-- regios (leestoegang voor authenticated, schrijven uitsluitend via
-- admin_*-RPC's), maar met extra gestructureerde velden (bedrag_min/max,
-- volgorde) omdat de generieke admin_list_classificaties-familie alleen
-- simpele id/naam-lookups ondersteunt.
create table public.bandbreedtes_bijdrage (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  bedrag_min numeric not null,
  bedrag_max numeric, -- null = open einde (hoogste categorie, "€1.000.000+")
  volgorde integer not null unique
);

comment on table public.bandbreedtes_bijdrage is 'Centrale, door beheerders aanpasbare lijst van bijdrage-bandbreedtes (bijv. "€0–€5.000"). Wordt gekoppeld aan funders/subsidieregelingen via bandbreedte_bijdrage_id, net als themas/doelgroepen/regios centraal zijn.';
comment on column public.bandbreedtes_bijdrage.bedrag_max is 'Bovengrens van de categorie, exclusief. NULL betekent "en hoger" (alleen de hoogste categorie).';
comment on column public.bandbreedtes_bijdrage.volgorde is 'Vaste sorteervolgorde voor weergave (laag naar hoog bedrag), los van alfabetische naam-sortering.';

alter table public.bandbreedtes_bijdrage enable row level security;

create policy bandbreedtes_bijdrage_read_authenticated
  on public.bandbreedtes_bijdrage
  for select
  to authenticated
  using (true);

-- Seed: de 8 vaste categorieën exact zoals gespecificeerd.
insert into public.bandbreedtes_bijdrage (naam, bedrag_min, bedrag_max, volgorde) values
  ('€0–€5.000', 0, 5000, 1),
  ('€5.000–€10.000', 5000, 10000, 2),
  ('€10.000–€25.000', 10000, 25000, 3),
  ('€25.000–€50.000', 25000, 50000, 4),
  ('€50.000–€100.000', 50000, 100000, 5),
  ('€100.000–€500.000', 100000, 500000, 6),
  ('€500.000–€1.000.000', 500000, 1000000, 7),
  ('€1.000.000+', 1000000, null, 8);

-- Nieuwe, nullable koppelkolom op beide tabellen (additief, geen bestaande
-- kolom wordt aangeraakt of verwijderd). Geen default zoals bij access_tier:
-- er is geen veiligheidsreden om voor een ongeclassificeerd record een
-- bandbreedte te gokken, dus onbekend blijft gewoon NULL.
alter table public.funders
  add column bandbreedte_bijdrage_id uuid references public.bandbreedtes_bijdrage(id) on delete set null;

alter table public.subsidieregelingen
  add column bandbreedte_bijdrage_id uuid references public.bandbreedtes_bijdrage(id) on delete set null;

comment on column public.funders.bandbreedte_bijdrage_id is 'Gekoppelde bijdrage-bandbreedte (centrale lookup public.bandbreedtes_bijdrage), door een beheerder gezet. Los van de vrije bijdrage_min/bijdrage_max-velden.';
comment on column public.subsidieregelingen.bandbreedte_bijdrage_id is 'Gekoppelde bijdrage-bandbreedte (centrale lookup public.bandbreedtes_bijdrage), door een beheerder gezet. Los van de vrije bedrag_min/bedrag_max-velden.';

-- Nette migratie van bestaande records: waar al een bekend bedrag
-- (bijdrage_max, anders bijdrage_min / bedrag_max, anders bedrag_min)
-- bestaat, wordt automatisch de bijpassende bandbreedte gekoppeld. Records
-- zonder enig bedrag blijven NULL (bewust, zie hierboven) en wachten op
-- handmatige beheerdersactie.
update public.funders f
set bandbreedte_bijdrage_id = b.id
from public.bandbreedtes_bijdrage b
where f.bandbreedte_bijdrage_id is null
  and coalesce(f.bijdrage_max, f.bijdrage_min) is not null
  and coalesce(f.bijdrage_max, f.bijdrage_min) >= b.bedrag_min
  and (b.bedrag_max is null or coalesce(f.bijdrage_max, f.bijdrage_min) < b.bedrag_max);

update public.subsidieregelingen r
set bandbreedte_bijdrage_id = b.id
from public.bandbreedtes_bijdrage b
where r.bandbreedte_bijdrage_id is null
  and coalesce(r.bedrag_max, r.bedrag_min) is not null
  and coalesce(r.bedrag_max, r.bedrag_min) >= b.bedrag_min
  and (b.bedrag_max is null or coalesce(r.bedrag_max, r.bedrag_min) < b.bedrag_max);

-- Admin-RPC's voor het beheren van de bandbreedte-waarden zelf, exact
-- gemodelleerd naar admin_list_classificaties/admin_add_classificatiewaarde/
-- admin_hernoem_classificatiewaarde/admin_verwijder_classificatiewaarde,
-- maar toegespitst op de extra gestructureerde velden.

create function public.admin_list_bandbreedtes()
returns table(id uuid, naam text, bedrag_min numeric, bedrag_max numeric, volgorde integer, gebruikt_aantal bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen bandbreedtes bekijken' using errcode = '42501';
  end if;

  return query
    select b.id, b.naam, b.bedrag_min, b.bedrag_max, b.volgorde,
      (select count(*) from public.funders f where f.bandbreedte_bijdrage_id = b.id)
      + (select count(*) from public.subsidieregelingen r where r.bandbreedte_bijdrage_id = b.id) as gebruikt_aantal
    from public.bandbreedtes_bijdrage b
    order by b.volgorde;
end;
$function$;

create function public.admin_add_bandbreedte(p_naam text, p_bedrag_min numeric, p_bedrag_max numeric default null, p_volgorde integer default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_naam text := trim(p_naam);
  v_volgorde integer := p_volgorde;
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen bandbreedtes toevoegen' using errcode = '42501';
  end if;

  if v_naam = '' or v_naam is null then
    raise exception 'Naam mag niet leeg zijn' using errcode = '22023';
  end if;

  if v_volgorde is null then
    select coalesce(max(volgorde), 0) + 1 into v_volgorde from public.bandbreedtes_bijdrage;
  end if;

  insert into public.bandbreedtes_bijdrage (naam, bedrag_min, bedrag_max, volgorde)
  values (v_naam, p_bedrag_min, p_bedrag_max, v_volgorde)
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Deze naam of volgorde bestaat al: %', v_naam using errcode = '23505';
end;
$function$;

create function public.admin_update_bandbreedte(p_id uuid, p_naam text, p_bedrag_min numeric, p_bedrag_max numeric default null, p_volgorde integer default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_naam text := trim(p_naam);
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen bandbreedtes bewerken' using errcode = '42501';
  end if;

  if v_naam = '' or v_naam is null then
    raise exception 'Naam mag niet leeg zijn' using errcode = '22023';
  end if;

  update public.bandbreedtes_bijdrage
  set naam = v_naam,
      bedrag_min = p_bedrag_min,
      bedrag_max = p_bedrag_max,
      volgorde = coalesce(p_volgorde, volgorde)
  where id = p_id;
exception
  when unique_violation then
    raise exception 'Deze naam of volgorde bestaat al: %', v_naam using errcode = '23505';
end;
$function$;

create function public.admin_verwijder_bandbreedte(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen bandbreedtes verwijderen' using errcode = '42501';
  end if;

  delete from public.bandbreedtes_bijdrage where id = p_id;
end;
$function$;

-- Koppel-RPC: zet de bandbreedte op één funder/subsidieregeling-record.
-- Zelfde tabel-agnostische p_tabel-aanpak als admin_set_access_tier, maar
-- zonder audit-log (net als de thema/doelgroep/regio-koppelingen via
-- admin_set_classificatie_koppelingen: alleen data_tier/source_type/
-- access_tier-wijzigingen worden ge-audit-logd, koppelingen niet).
create function public.admin_set_bandbreedte(p_tabel text, p_id uuid, p_bandbreedte_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen de bandbreedte wijzigen' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    update public.funders set bandbreedte_bijdrage_id = p_bandbreedte_id where id = p_id;
  elsif p_tabel = 'subsidieregelingen' then
    update public.subsidieregelingen set bandbreedte_bijdrage_id = p_bandbreedte_id where id = p_id;
  else
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;
end;
$function$;

revoke all on function public.admin_list_bandbreedtes() from public;
revoke all on function public.admin_add_bandbreedte(text, numeric, numeric, integer) from public;
revoke all on function public.admin_update_bandbreedte(uuid, text, numeric, numeric, integer) from public;
revoke all on function public.admin_verwijder_bandbreedte(uuid) from public;
revoke all on function public.admin_set_bandbreedte(text, uuid, uuid) from public;

grant execute on function public.admin_list_bandbreedtes() to authenticated;
grant execute on function public.admin_add_bandbreedte(text, numeric, numeric, integer) to authenticated;
grant execute on function public.admin_update_bandbreedte(uuid, text, numeric, numeric, integer) to authenticated;
grant execute on function public.admin_verwijder_bandbreedte(uuid) to authenticated;
grant execute on function public.admin_set_bandbreedte(text, uuid, uuid) to authenticated;
