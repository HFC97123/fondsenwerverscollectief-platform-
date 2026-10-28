-- SUBSIDIE KOMPAS LEERT VAN GEBRUIK
-- 1. Eigen woorden ("Overig, anders namelijk") van leden komen in Beheer binnen als "Nieuwe woorden", met advies van de slimme associatie.
--    Goedgekeurde koppelingen worden "herkenningswoorden": ze worden daarna automatisch herkend, zonder AI.
-- 2. "Opnemen in de database": een rij uit de werklijst "nieuw gescand door gebruik" wordt in één keer een fonds en/of regeling
--    (als NIET beoordeeld), zonder dubbelen.
-- 3. Financiers die leden zelf typen in het dekkingsplan komen automatisch (alleen de NAAM) in diezelfde werklijst (bron 'lid').
-- 4. Beheer kan de algemene beschrijving van fondsen en regelingen lezen en aanpassen (de beschrijving waarop de matching leunt).
--
-- Privacy: er wordt nergens vastgelegd welk lid een woord of financier invoerde, en ook geen bedrag, project of notitie.
-- Rollback: supabase/voorstellen/20261028100000_leren_van_gebruik_rollback.sql

-- ---------------------------------------------------------------------------------------------------------------------------
-- Hulpfuncties
-- ---------------------------------------------------------------------------------------------------------------------------

-- Genormaliseerde sleutel van een woord of naam: kleine letters, zonder accenten en leestekens.
create or replace function public.kompas_woord_sleutel(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(regexp_replace(
    lower(translate(coalesce(t, ''),
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 1. Nieuwe woorden en herkenningswoorden
-- ---------------------------------------------------------------------------------------------------------------------------

create table if not exists public.kompas_eigen_termen_werklijst (
  id uuid primary key default gen_random_uuid(),
  woord_sleutel text not null unique,
  woord text not null,
  aantal_keer integer not null default 1,
  eerst_gezien timestamptz not null default now(),
  laatst_gezien timestamptz not null default now(),
  -- advies van de slimme associatie (alleen een voorstel; beheer beslist)
  ai_actie text check (ai_actie is null or ai_actie in ('nieuwe_waarde', 'synoniem', 'afwijzen')),
  ai_categorie text check (ai_categorie is null or ai_categorie in ('discipline', 'doelgroep', 'regio')),
  ai_naam text,
  ai_toelichting text,
  review_status text not null default 'nieuw' check (review_status in ('nieuw', 'toegevoegd', 'synoniem', 'afgewezen')),
  besluit_categorie text check (besluit_categorie is null or besluit_categorie in ('discipline', 'doelgroep', 'regio')),
  besluit_naam text,
  beoordeeld_op timestamptz
);

create index if not exists kompas_eigen_termen_status_idx on public.kompas_eigen_termen_werklijst (review_status, aantal_keer desc, laatst_gezien desc);

create table if not exists public.kompas_herkenningswoorden (
  id uuid primary key default gen_random_uuid(),
  categorie text not null check (categorie in ('discipline', 'doelgroep', 'regio')),
  naam text not null, -- exacte naam in themas / doelgroepen / regios
  woord text not null,
  woord_sleutel text not null,
  aangemaakt_op timestamptz not null default now(),
  unique (categorie, naam, woord_sleutel)
);

create index if not exists kompas_herkenningswoorden_sleutel_idx on public.kompas_herkenningswoorden (woord_sleutel);

alter table public.kompas_eigen_termen_werklijst enable row level security;
alter table public.kompas_herkenningswoorden enable row level security;
revoke all on public.kompas_eigen_termen_werklijst from anon, authenticated;
revoke all on public.kompas_herkenningswoorden from anon, authenticated;

comment on table public.kompas_eigen_termen_werklijst is 'Eigen woorden van leden ("Overig, anders namelijk") die nog niet herkend worden. Alleen het woord en een teller; nooit wie het typte.';
comment on table public.kompas_herkenningswoorden is 'Goedgekeurde synoniemen: een woord dat automatisch naar een bestaande discipline, doelgroep of werkgebied wijst.';

-- Server: registreer woorden die nog niet herkend worden. Bekende namen en goedgekeurde herkenningswoorden worden overgeslagen.
create or replace function public.kompas_eigen_termen_registreer(p_woorden text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  w text;
  v_sleutel text;
  n integer := 0;
begin
  if p_woorden is null then
    return 0;
  end if;

  foreach w in array p_woorden[1:12] loop
    w := left(regexp_replace(trim(coalesce(w, '')), '\s+', ' ', 'g'), 60);
    v_sleutel := public.kompas_woord_sleutel(w);

    if length(w) < 2 or v_sleutel = '' then
      continue;
    end if;

    if exists (select 1 from public.kompas_herkenningswoorden h where h.woord_sleutel = v_sleutel)
       or exists (select 1 from public.themas t where public.kompas_woord_sleutel(t.naam) = v_sleutel)
       or exists (select 1 from public.doelgroepen d where public.kompas_woord_sleutel(d.naam) = v_sleutel)
       or exists (select 1 from public.regios r where public.kompas_woord_sleutel(r.naam) = v_sleutel) then
      continue;
    end if;

    insert into public.kompas_eigen_termen_werklijst as t (woord_sleutel, woord)
    values (v_sleutel, w)
    on conflict (woord_sleutel) do update set aantal_keer = t.aantal_keer + 1, laatst_gezien = now();

    n := n + 1;
  end loop;

  return n;
end;
$$;

-- Server: welke van deze woorden zijn al goedgekeurd als herkenningswoord?
create or replace function public.kompas_herkenningswoorden_lees(p_woorden text[])
returns table (woord_sleutel text, categorie text, naam text)
language sql
stable
security definer
set search_path = public
as $$
  select h.woord_sleutel, h.categorie, h.naam
  from public.kompas_herkenningswoorden h
  where h.woord_sleutel = any (select public.kompas_woord_sleutel(x) from unnest(coalesce(p_woorden, '{}')) x);
$$;

-- Server: advies van de slimme associatie bij een woord bewaren (alleen zolang het woord nog op "nieuw" staat).
-- p_rijen: [{woord, actie, categorie, naam, toelichting}]
create or replace function public.kompas_eigen_termen_advies(p_rijen jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  n integer := 0;
begin
  if p_rijen is null or jsonb_typeof(p_rijen) <> 'array' then
    return 0;
  end if;

  for r in select * from jsonb_array_elements(p_rijen) limit 12 loop
    update public.kompas_eigen_termen_werklijst
    set ai_actie = case when r->>'actie' in ('nieuwe_waarde', 'synoniem', 'afwijzen') then r->>'actie' else null end,
        ai_categorie = case when r->>'categorie' in ('discipline', 'doelgroep', 'regio') then r->>'categorie' else null end,
        ai_naam = nullif(left(trim(coalesce(r->>'naam', '')), 200), ''),
        ai_toelichting = nullif(left(trim(coalesce(r->>'toelichting', '')), 400), '')
    where woord_sleutel = public.kompas_woord_sleutel(r->>'woord')
      and review_status = 'nieuw';

    if found then
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.kompas_eigen_termen_registreer(text[]) from public, anon, authenticated;
revoke all on function public.kompas_herkenningswoorden_lees(text[]) from public, anon, authenticated;
revoke all on function public.kompas_eigen_termen_advies(jsonb) from public, anon, authenticated;
grant execute on function public.kompas_eigen_termen_registreer(text[]) to service_role;
grant execute on function public.kompas_herkenningswoorden_lees(text[]) to service_role;
grant execute on function public.kompas_eigen_termen_advies(jsonb) to service_role;

-- Beheer: lijst, telling, beslissen
create or replace function public.admin_eigen_termen_lijst(p_status text default 'nieuw', p_zoek text default null, p_limiet integer default 100)
returns table (
  id uuid, woord text, aantal_keer integer, eerst_gezien timestamptz, laatst_gezien timestamptz, ai_actie text, ai_categorie text,
  ai_naam text, ai_toelichting text, review_status text, besluit_categorie text, besluit_naam text, beoordeeld_op timestamptz,
  aantal_fondsen bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
  select e.id, e.woord, e.aantal_keer, e.eerst_gezien, e.laatst_gezien, e.ai_actie, e.ai_categorie, e.ai_naam, e.ai_toelichting,
         e.review_status, e.besluit_categorie, e.besluit_naam, e.beoordeeld_op,
         -- hoeveel fondsen noemen dit woord in naam of beschrijving (richtlijn voor het besluit)
         (select count(*) from public.funders f
           where f.naam ilike '%' || e.woord || '%' or coalesce(f.algemene_beschrijving, f.missie, '') ilike '%' || e.woord || '%')
  from public.kompas_eigen_termen_werklijst e
  where (p_status is null or p_status = '' or e.review_status = p_status)
    and (p_zoek is null or p_zoek = '' or e.woord ilike '%' || p_zoek || '%')
  order by e.aantal_keer desc, e.laatst_gezien desc
  limit greatest(1, least(coalesce(p_limiet, 100), 500));
end;
$$;

create or replace function public.admin_eigen_termen_telling()
returns table (review_status text, aantal bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query select e.review_status, count(*) from public.kompas_eigen_termen_werklijst e group by e.review_status;
end;
$$;

-- p_actie: 'nieuwe_waarde' (maak een nieuwe discipline/doelgroep/werkgebied en koppel het woord eraan), 'synoniem' (koppel het woord
-- aan een bestaande waarde), 'afwijzen', 'terug' (weer op nieuw; een eventueel herkenningswoord verdwijnt).
create or replace function public.admin_eigen_term_beslis(p_id uuid, p_actie text, p_categorie text default null, p_naam text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_woord text;
  v_sleutel text;
  v_naam text;
  v_bestaand text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  select woord, woord_sleutel into v_woord, v_sleutel from public.kompas_eigen_termen_werklijst where id = p_id;

  if v_woord is null then
    raise exception 'Dit woord bestaat niet meer.' using errcode = 'P0002';
  end if;

  if p_actie = 'afwijzen' then
    update public.kompas_eigen_termen_werklijst set review_status = 'afgewezen', beoordeeld_op = now() where id = p_id;
    return 'afgewezen';
  end if;

  if p_actie = 'terug' then
    delete from public.kompas_herkenningswoorden where woord_sleutel = v_sleutel;
    update public.kompas_eigen_termen_werklijst
      set review_status = 'nieuw', besluit_categorie = null, besluit_naam = null, beoordeeld_op = null
      where id = p_id;
    return 'nieuw';
  end if;

  if p_actie not in ('nieuwe_waarde', 'synoniem') or p_categorie not in ('discipline', 'doelgroep', 'regio') then
    raise exception 'Ongeldige actie.' using errcode = '22023';
  end if;

  v_naam := left(regexp_replace(trim(coalesce(p_naam, '')), '\s+', ' ', 'g'), 120);

  if v_naam = '' then
    raise exception 'Kies of typ een naam.' using errcode = '22023';
  end if;

  -- bestaande waarde opzoeken (hoofdletter- en accentongevoelig)
  if p_categorie = 'discipline' then
    select naam into v_bestaand from public.themas where public.kompas_woord_sleutel(naam) = public.kompas_woord_sleutel(v_naam) limit 1;
  elsif p_categorie = 'doelgroep' then
    select naam into v_bestaand from public.doelgroepen where public.kompas_woord_sleutel(naam) = public.kompas_woord_sleutel(v_naam) limit 1;
  else
    select naam into v_bestaand from public.regios where public.kompas_woord_sleutel(naam) = public.kompas_woord_sleutel(v_naam) limit 1;
  end if;

  if p_actie = 'synoniem' and v_bestaand is null then
    raise exception 'Deze waarde bestaat niet; kies een bestaande.' using errcode = '22023';
  end if;

  if v_bestaand is null then
    if p_categorie = 'discipline' then
      insert into public.themas (naam) values (v_naam);
    elsif p_categorie = 'doelgroep' then
      insert into public.doelgroepen (naam) values (v_naam);
    else
      insert into public.regios (naam) values (v_naam);
    end if;

    v_bestaand := v_naam;
  end if;

  insert into public.kompas_herkenningswoorden (categorie, naam, woord, woord_sleutel)
  values (p_categorie, v_bestaand, v_woord, v_sleutel)
  on conflict (categorie, naam, woord_sleutel) do nothing;

  update public.kompas_eigen_termen_werklijst
  set review_status = case when p_actie = 'nieuwe_waarde' then 'toegevoegd' else 'synoniem' end,
      besluit_categorie = p_categorie,
      besluit_naam = v_bestaand,
      beoordeeld_op = now()
  where id = p_id;

  return case when p_actie = 'nieuwe_waarde' then 'toegevoegd' else 'synoniem' end;
end;
$$;

-- Beheer: alle goedgekeurde herkenningswoorden, en eentje weer intrekken.
create or replace function public.admin_herkenningswoorden_lijst()
returns table (id uuid, categorie text, naam text, woord text, aangemaakt_op timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query select h.id, h.categorie, h.naam, h.woord, h.aangemaakt_op from public.kompas_herkenningswoorden h order by h.categorie, h.naam, h.woord;
end;
$$;

create or replace function public.admin_herkenningswoord_verwijder(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sleutel text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  select woord_sleutel into v_sleutel from public.kompas_herkenningswoorden where id = p_id;
  delete from public.kompas_herkenningswoorden where id = p_id;

  -- het woord is niet langer herkend: zet het (als het in de werklijst staat) terug op "nieuw"
  update public.kompas_eigen_termen_werklijst
    set review_status = 'nieuw', besluit_categorie = null, besluit_naam = null, beoordeeld_op = null
    where woord_sleutel = v_sleutel and review_status in ('synoniem', 'toegevoegd')
      and not exists (select 1 from public.kompas_herkenningswoorden h where h.woord_sleutel = v_sleutel);
end;
$$;

revoke all on function public.admin_eigen_termen_lijst(text, text, integer) from public, anon;
revoke all on function public.admin_eigen_termen_telling() from public, anon;
revoke all on function public.admin_eigen_term_beslis(uuid, text, text, text) from public, anon;
revoke all on function public.admin_herkenningswoorden_lijst() from public, anon;
revoke all on function public.admin_herkenningswoord_verwijder(uuid) from public, anon;
grant execute on function public.admin_eigen_termen_lijst(text, text, integer) to authenticated;
grant execute on function public.admin_eigen_termen_telling() to authenticated;
grant execute on function public.admin_eigen_term_beslis(uuid, text, text, text) to authenticated;
grant execute on function public.admin_herkenningswoorden_lijst() to authenticated;
grant execute on function public.admin_herkenningswoord_verwijder(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 2. Opnemen in de database (werklijst "nieuw gescand door gebruik" -> fonds en/of regeling, NIET beoordeeld)
-- ---------------------------------------------------------------------------------------------------------------------------

create or replace function public.admin_online_gescand_opnemen(p_id uuid, p_type funder_type default 'vermogensfonds')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.kompas_online_gescand%rowtype;
  v_funder uuid;
  v_regeling uuid;
  v_funder_nieuw boolean := false;
  v_regeling_nieuw boolean := false;
  v_regeling_naam text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  select * into g from public.kompas_online_gescand where id = p_id;

  if g.id is null then
    raise exception 'Deze rij bestaat niet meer.' using errcode = 'P0002';
  end if;

  v_regeling_naam := nullif(trim(coalesce(g.regeling, '')), '');

  -- 1. de gever: bestaat al (zelfde naam, hoofdletter- en accentongevoelig), of wordt nieuw aangemaakt
  select f.id into v_funder from public.funders f where public.kompas_woord_sleutel(f.naam) = public.kompas_woord_sleutel(g.gever) order by f.created_at limit 1;

  if v_funder is null then
    insert into public.funders (naam, type, website, algemene_beschrijving, bijdrage_min, bijdrage_max, bron, source_type, classification_reviewed)
    values (
      left(trim(g.gever), 200), p_type, g.website,
      case when v_regeling_naam is null then g.samenvatting else null end,
      case when v_regeling_naam is null then g.bedrag_min else null end,
      case when v_regeling_naam is null then g.bedrag_max else null end,
      'Subsidie Kompas (nieuw gevonden)', 'internet_scan', false
    )
    returning id into v_funder;

    v_funder_nieuw := true;

    insert into public.funder_themas (funder_id, thema_id)
      select v_funder, t.id from public.themas t
      where public.kompas_woord_sleutel(t.naam) in (select public.kompas_woord_sleutel(x) from unnest(g.themas) x) on conflict do nothing;
    insert into public.funder_doelgroepen (funder_id, doelgroep_id)
      select v_funder, d.id from public.doelgroepen d
      where public.kompas_woord_sleutel(d.naam) in (select public.kompas_woord_sleutel(x) from unnest(g.doelgroepen) x) on conflict do nothing;
    insert into public.funder_regios (funder_id, regio_id)
      select v_funder, r.id from public.regios r
      where public.kompas_woord_sleutel(r.naam) in (select public.kompas_woord_sleutel(x) from unnest(g.werkgebieden) x) on conflict do nothing;
  end if;

  -- 2. de regeling (alleen als er een regelingsnaam is): bestaat al bij deze gever, of wordt nieuw aangemaakt
  if v_regeling_naam is not null then
    select s.id into v_regeling from public.subsidieregelingen s
      where s.funder_id = v_funder and public.kompas_woord_sleutel(s.naam) = public.kompas_woord_sleutel(v_regeling_naam)
      order by s.created_at limit 1;

    if v_regeling is null then
      insert into public.subsidieregelingen (
        funder_id, naam, bedrag_min, bedrag_max, deadline_datum, aanvraaglink, website, algemene_beschrijving, discovered_by, verified,
        source_type, classification_reviewed, status
      ) values (
        v_funder, left(v_regeling_naam, 200), g.bedrag_min, g.bedrag_max, g.deadline, g.url, g.website, g.samenvatting, 'agent', false,
        'internet_scan', false,
        case when g.status_online in ('open', 'gesloten', 'doorlopend', 'aangekondigd', 'binnenkort', 'budget_uitgeput')
             then g.status_online::regeling_status_type else 'open'::regeling_status_type end
      )
      returning id into v_regeling;

      v_regeling_nieuw := true;

      insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
        select v_regeling, t.id from public.themas t
        where public.kompas_woord_sleutel(t.naam) in (select public.kompas_woord_sleutel(x) from unnest(g.themas) x) on conflict do nothing;
      insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
        select v_regeling, d.id from public.doelgroepen d
        where public.kompas_woord_sleutel(d.naam) in (select public.kompas_woord_sleutel(x) from unnest(g.doelgroepen) x) on conflict do nothing;
      insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
        select v_regeling, r.id from public.regios r
        where public.kompas_woord_sleutel(r.naam) in (select public.kompas_woord_sleutel(x) from unnest(g.werkgebieden) x) on conflict do nothing;
    end if;
  end if;

  update public.kompas_online_gescand
  set review_status = 'opgenomen',
      gekoppelde_funder_id = v_funder,
      gekoppelde_regeling_id = coalesce(v_regeling, gekoppelde_regeling_id),
      beoordeeld_op = now()
  where id = p_id;

  return jsonb_build_object(
    'funder_id', v_funder, 'regeling_id', v_regeling,
    'funder_nieuw', v_funder_nieuw, 'regeling_nieuw', v_regeling_nieuw
  );
end;
$$;

revoke all on function public.admin_online_gescand_opnemen(uuid, funder_type) from public, anon;
grant execute on function public.admin_online_gescand_opnemen(uuid, funder_type) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 3. Financiers die leden zelf typen in het dekkingsplan -> werklijst (alleen de naam, bron 'lid')
-- ---------------------------------------------------------------------------------------------------------------------------

create or replace function public.kompas_lid_financier_naar_werklijst()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_naam text;
  v_sleutel text;
begin
  v_naam := left(regexp_replace(trim(coalesce(new.financier_naam, '')), '\s+', ' ', 'g'), 200);

  if new.funder_id is not null or new.scheme_id is not null or length(v_naam) < 3 or v_naam !~ '[A-Za-z]' then
    return new;
  end if;

  -- bij een wijziging alleen tellen als de naam echt anders is geworden
  if tg_op = 'UPDATE' and public.kompas_woord_sleutel(old.financier_naam) = public.kompas_woord_sleutel(v_naam)
     and old.funder_id is null and old.scheme_id is null then
    return new;
  end if;

  -- staat al in de database (zelfde naam): niets te melden
  if exists (select 1 from public.funders f where public.kompas_woord_sleutel(f.naam) = public.kompas_woord_sleutel(v_naam)) then
    return new;
  end if;

  v_sleutel := regexp_replace(lower(v_naam) || '|', '[^a-z0-9|]+', ' ', 'g');

  insert into public.kompas_online_gescand as t (sleutel, gever, koppeling, bron)
  values (v_sleutel, v_naam, 'geen', 'lid')
  on conflict (sleutel) do update set aantal_keer = t.aantal_keer + 1, laatst_gezien = now();

  return new;
exception when others then
  -- het registreren mag het opslaan van het dekkingsplan nooit blokkeren
  return new;
end;
$$;

revoke all on function public.kompas_lid_financier_naar_werklijst() from public, anon, authenticated;

drop trigger if exists kompas_lid_financier_trigger on public.subsidie_kompas_program_funding;
create trigger kompas_lid_financier_trigger
  after insert or update of financier_naam, funder_id, scheme_id on public.subsidie_kompas_program_funding
  for each row execute function public.kompas_lid_financier_naar_werklijst();

-- Eenmalig: de financiers die leden al eerder zelf typten (alleen de naam, ontdubbeld).
insert into public.kompas_online_gescand as t (sleutel, gever, koppeling, bron, aantal_keer)
select regexp_replace(lower(min(left(trim(p.financier_naam), 200))) || '|', '[^a-z0-9|]+', ' ', 'g'),
       min(left(trim(p.financier_naam), 200)), 'geen', 'lid', count(*)::integer
from public.subsidie_kompas_program_funding p
where p.funder_id is null and p.scheme_id is null
  and length(trim(coalesce(p.financier_naam, ''))) >= 3 and trim(p.financier_naam) ~ '[A-Za-z]'
  and not exists (select 1 from public.funders f where public.kompas_woord_sleutel(f.naam) = public.kompas_woord_sleutel(p.financier_naam))
group by public.kompas_woord_sleutel(p.financier_naam)
on conflict (sleutel) do nothing;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 4. Algemene beschrijving in Beheer
-- ---------------------------------------------------------------------------------------------------------------------------

create or replace function public.admin_get_algemene_beschrijving(p_tabel text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    select algemene_beschrijving into v from public.funders where id = p_id;
  elsif p_tabel = 'subsidieregelingen' then
    select algemene_beschrijving into v from public.subsidieregelingen where id = p_id;
  else
    raise exception 'Onbekende tabel.' using errcode = '22023';
  end if;

  return v;
end;
$$;

create or replace function public.admin_set_algemene_beschrijving(p_tabel text, p_id uuid, p_tekst text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v text := nullif(left(trim(coalesce(p_tekst, '')), 8000), '');
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    update public.funders set algemene_beschrijving = v, updated_at = now() where id = p_id;
  elsif p_tabel = 'subsidieregelingen' then
    update public.subsidieregelingen set algemene_beschrijving = v, updated_at = now() where id = p_id;
  else
    raise exception 'Onbekende tabel.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.admin_get_algemene_beschrijving(text, uuid) from public, anon;
revoke all on function public.admin_set_algemene_beschrijving(text, uuid, text) from public, anon;
grant execute on function public.admin_get_algemene_beschrijving(text, uuid) to authenticated;
grant execute on function public.admin_set_algemene_beschrijving(text, uuid, text) to authenticated;
