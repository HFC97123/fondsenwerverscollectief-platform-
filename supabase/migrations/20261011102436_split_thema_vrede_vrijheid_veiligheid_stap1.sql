create table if not exists public.thema_migratie_archief (
  id uuid primary key default gen_random_uuid(),
  migratie text not null,
  tabel text not null,
  rij_id uuid not null,
  rij_naam text,
  oude_thema_id uuid not null,
  oude_thema_naam text not null,
  nieuwe_themas text[] not null,
  toelichting text,
  gemigreerd_op timestamptz not null default now()
);
alter table public.thema_migratie_archief enable row level security;
comment on table public.thema_migratie_archief is 'Historische thema-/disciplinekoppelingen die bij een taxonomiewijziging zijn omgezet (o.a. split van "Vrede, vrijheid en veiligheid", 2026-10-11). Alleen-lezen archief; geen policies, alleen service_role.';

insert into public.themas (naam) values ('Vrede'), ('Vrijheid'), ('Veiligheid')
on conflict (naam) do nothing;

create temp table _map (regeling text, funder text, nieuwe text[], toelichting text) on commit drop;
insert into _map values
 ('Projectsubsidie vrede, vrijheid en veteranen','VFonds', array['Vrede','Vrijheid','Veiligheid'],
  'vfonds-regeling met expliciete doelstelling vrede, vrijheid en veiligheid (incl. veteranen): alle drie inhoudelijk van toepassing'),
 ('Onderzoeksaanvraag Fonds ZOZ','Prins Bernhard Cultuurfonds', array['Vrede','Veiligheid'],
  'Onderzoek naar polarisatie, radicalisering en uitsluiting: vreedzaam samenleven (Vrede) en radicaliseringspreventie (Veiligheid); geen specifieke vrijheidsfocus'),
 ('Projectaanvraag Fonds ZOZ','Prins Bernhard Cultuurfonds', array['Vrede','Veiligheid'],
  'Projecten tegen polarisatie en radicalisering: Vrede en Veiligheid; geen specifieke vrijheidsfocus');

insert into public.thema_migratie_archief (migratie, tabel, rij_id, rij_naam, oude_thema_id, oude_thema_naam, nieuwe_themas, toelichting)
select 'split_vrede_vrijheid_veiligheid', 'subsidieregelingen', s.id, s.naam, t.id, t.naam,
       coalesce(m.nieuwe, '{}'), coalesce(m.toelichting, 'GEEN MAPPING - handmatig beoordelen')
from public.subsidieregeling_themas st
join public.themas t on t.id = st.thema_id and t.naam = 'Vrede, vrijheid en veiligheid'
join public.subsidieregelingen s on s.id = st.subsidieregeling_id
left join public.funders f on f.id = s.funder_id
left join _map m on m.regeling = s.naam and m.funder = f.naam;

insert into public.thema_migratie_archief (migratie, tabel, rij_id, rij_naam, oude_thema_id, oude_thema_naam, nieuwe_themas, toelichting)
select 'split_vrede_vrijheid_veiligheid', 'funders', f.id, f.naam, t.id, t.naam, '{}', 'GEEN MAPPING - handmatig beoordelen'
from public.funder_themas ft
join public.themas t on t.id = ft.thema_id and t.naam = 'Vrede, vrijheid en veiligheid'
join public.funders f on f.id = ft.funder_id;

insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select a.rij_id, t.id
from public.thema_migratie_archief a
cross join lateral unnest(a.nieuwe_themas) n(naam)
join public.themas t on t.naam = n.naam
where a.migratie = 'split_vrede_vrijheid_veiligheid' and a.tabel = 'subsidieregelingen'
on conflict do nothing;

insert into public.funder_themas (funder_id, thema_id)
select f.id, t.id from public.funders f join public.themas t on t.naam in ('Veiligheid','Gezondheid')
where f.naam = 'NH1816'
on conflict do nothing;

insert into public.funder_themas (funder_id, thema_id)
select f2.id, ft.thema_id
from public.funders f1
join public.funder_themas ft on ft.funder_id = f1.id
join public.funders f2 on f2.naam = 'Stichting Goede Doelen NH1816'
where f1.naam = 'NH1816'
on conflict do nothing;
