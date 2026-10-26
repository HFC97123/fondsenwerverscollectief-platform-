-- Werklijst "nieuw gescand door gebruik": fondsen en regelingen die Subsidie Kompas online vond voor een lid (chat of voorstel) en die
-- (nog) niet als bevestigd record in de database staan. Bedoeld voor de maandelijkse aanvulronde: controleren, aanvullen en voorgoed
-- opnemen in funders/subsidieregelingen. Alleen publieke fondsgegevens; er wordt NIET vastgelegd welk lid zocht.
-- Alleen de server (service role) schrijft en leest; leden kunnen niets met deze tabel.

create table if not exists public.kompas_online_gescand (
  id uuid primary key default gen_random_uuid(),
  sleutel text not null unique, -- genormaliseerde gever + regeling, voor ontdubbelen
  gever text not null,
  regeling text,
  website text,
  url text,
  status_online text,
  deadline date,
  bedrag_min numeric,
  bedrag_max numeric,
  samenvatting text,
  themas text[] not null default '{}',
  doelgroepen text[] not null default '{}',
  werkgebieden text[] not null default '{}',
  koppeling text, -- 'geen' (niet in de database gevonden) of 'waarschijnlijk' (lijkt op een bestaande gever)
  bron text, -- 'chat' of 'voorstel' (waar het voor het laatst gevonden is)
  aantal_keer integer not null default 1,
  eerst_gezien timestamptz not null default now(),
  laatst_gezien timestamptz not null default now(),
  review_status text not null default 'nieuw' check (review_status in ('nieuw', 'in_behandeling', 'opgenomen', 'afgewezen', 'dubbel')),
  gekoppelde_funder_id uuid,
  gekoppelde_regeling_id uuid,
  review_notitie text,
  beoordeeld_op timestamptz
);

create index if not exists kompas_online_gescand_status_idx on public.kompas_online_gescand (review_status, laatst_gezien desc);

alter table public.kompas_online_gescand enable row level security;
revoke all on public.kompas_online_gescand from anon, authenticated;

comment on table public.kompas_online_gescand is 'Nieuw gescand door gebruik: online gevonden fondsen/regelingen die nog niet (bevestigd) in de database staan. Werklijst voor de maandelijkse aanvulronde.';

-- Registreren of bijwerken (ontdubbeld op gever + regeling). Bestaande, al ingevulde gegevens blijven staan; lege velden worden aangevuld.
-- Een al beoordeelde rij (opgenomen/afgewezen/dubbel) houdt zijn status.
create or replace function public.kompas_online_gescand_registreer(p_rijen jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  n integer := 0;
  v_sleutel text;
begin
  if p_rijen is null or jsonb_typeof(p_rijen) <> 'array' then
    return 0;
  end if;

  for r in select * from jsonb_array_elements(p_rijen) limit 25 loop
    if coalesce(trim(r->>'gever'), '') = '' then
      continue;
    end if;

    v_sleutel := regexp_replace(lower(trim(r->>'gever')) || '|' || lower(coalesce(trim(r->>'regeling'), '')), '[^a-z0-9|]+', ' ', 'g');

    insert into public.kompas_online_gescand as t (
      sleutel, gever, regeling, website, url, status_online, deadline, bedrag_min, bedrag_max, samenvatting,
      themas, doelgroepen, werkgebieden, koppeling, bron
    ) values (
      v_sleutel,
      left(trim(r->>'gever'), 200),
      nullif(left(trim(coalesce(r->>'regeling', '')), 200), ''),
      nullif(left(coalesce(r->>'website', ''), 500), ''),
      nullif(left(coalesce(r->>'url', ''), 1000), ''),
      nullif(r->>'status_online', ''),
      case when coalesce(r->>'deadline', '') ~ '^\d{4}-\d{2}-\d{2}$' then (r->>'deadline')::date else null end,
      case when jsonb_typeof(r->'bedrag_min') = 'number' then (r->>'bedrag_min')::numeric else null end,
      case when jsonb_typeof(r->'bedrag_max') = 'number' then (r->>'bedrag_max')::numeric else null end,
      nullif(left(coalesce(r->>'samenvatting', ''), 2000), ''),
      coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(r->'themas') = 'array' then r->'themas' else '[]'::jsonb end)), '{}'),
      coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(r->'doelgroepen') = 'array' then r->'doelgroepen' else '[]'::jsonb end)), '{}'),
      coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(r->'werkgebieden') = 'array' then r->'werkgebieden' else '[]'::jsonb end)), '{}'),
      nullif(r->>'koppeling', ''),
      nullif(r->>'bron', '')
    )
    on conflict (sleutel) do update set
      aantal_keer = t.aantal_keer + 1,
      laatst_gezien = now(),
      bron = coalesce(excluded.bron, t.bron),
      website = coalesce(t.website, excluded.website),
      url = coalesce(t.url, excluded.url),
      status_online = coalesce(excluded.status_online, t.status_online),
      deadline = coalesce(excluded.deadline, t.deadline),
      bedrag_min = coalesce(t.bedrag_min, excluded.bedrag_min),
      bedrag_max = coalesce(t.bedrag_max, excluded.bedrag_max),
      samenvatting = coalesce(t.samenvatting, excluded.samenvatting),
      themas = case when cardinality(t.themas) = 0 then excluded.themas else t.themas end,
      doelgroepen = case when cardinality(t.doelgroepen) = 0 then excluded.doelgroepen else t.doelgroepen end,
      werkgebieden = case when cardinality(t.werkgebieden) = 0 then excluded.werkgebieden else t.werkgebieden end;

    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public.kompas_online_gescand_registreer(jsonb) from public, anon, authenticated;
grant execute on function public.kompas_online_gescand_registreer(jsonb) to service_role;
