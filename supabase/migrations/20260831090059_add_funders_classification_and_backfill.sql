-- Stap 1 van de goedgekeurde deployvolgorde (zie status-developer-guide.md):
-- funders krijgt dezelfde classificatie als subsidieregelingen, met hergebruik
-- van de bestaande enums. Alleen kolommen + backfill in deze stap — geen RPC's,
-- geen functiewijzigingen, geen andere objecten.

alter table public.funders
  add column data_tier public.subsidie_data_tier not null default 'premium',
  add column source_type public.subsidie_source_type not null default 'csv_import', -- tijdelijk, alleen voor backfill
  add column classification_reviewed boolean not null default false;

comment on column public.funders.data_tier is
  'Toegangsniveau: public = zichtbaar voor Pro/Premium/Admin-matching, premium = alleen Premium/Admin. Zelfde betekenis als subsidieregelingen.data_tier.';
comment on column public.funders.source_type is
  'Herkomst: internet_scan, manual_admin, premium_database, api_partner of csv_import. Kolomdefault wordt in een latere stap verwijderd (zie status-developer-guide.md) — elke toekomstige schrijver moet dit dan expliciet zetten.';
comment on column public.funders.classification_reviewed is
  'Of een beheerder data_tier/source_type voor dit fonds handmatig heeft gecontroleerd.';

update public.funders
set source_type = case
  when bron ilike 'agent%' then 'internet_scan'::public.subsidie_source_type
  when bron ilike 'handmatig%' then 'manual_admin'::public.subsidie_source_type
  else 'csv_import'::public.subsidie_source_type
end;

-- Let op: de source_type-default wordt in deze stap NOG NIET verwijderd.
-- Dat gebeurt pas in stap 5 van de deployvolgorde, na deploy + verificatie
-- van het aangepaste enrich-funders. data_tier en classification_reviewed
-- behouden hun default permanent (fail-closed / fail-safe by design).
