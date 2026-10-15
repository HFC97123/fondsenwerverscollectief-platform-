-- Werkgebied Nederland + Caribisch deel van het Koninkrijk (op verzoek Aisya, 14-10-2026). Alleen toevoegingen, idempotent.
-- 1. Oranje Fonds en Stichting Kinderpostzegels (funder + alle regelingen)
-- 2. Funders waarvan regelingen aantoonbaar (bron gecontroleerd in deadlinereview) ook het Caribisch deel bedienen: funder-niveau aanvullen.
insert into public.funder_regios (funder_id, regio_id)
select f.id, r.id from public.funders f cross join public.regios r
where f.id in ('fea7cb39-f27a-411c-99e0-f92d2b44c553','16463b9c-69fc-41d2-9156-d7f07aa4ac40',
               '3190c7f8-76a2-49a3-8417-cc18ebfa6750','753bb1da-6d17-4d4c-b32d-bbbe5de7fc8e','2c854b2c-7240-4e80-b2e8-45f4a490baca',
               'fe43e1a3-fe50-4d30-9106-871a61424a17','8b691e04-f9da-44bb-8bdd-8fe247158a6d','1bd07c47-2301-4a0b-8118-9139c957763d',
               '371e5b27-c899-4b5e-affd-6a1b1316a0da','25ce0048-6e12-42de-ba05-7d02fd6fed8b')
  and r.naam in ('Landelijk','Caribisch deel van het Koninkrijk')
on conflict do nothing;

insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select s.id, r.id from public.subsidieregelingen s cross join public.regios r
where s.funder_id in ('fea7cb39-f27a-411c-99e0-f92d2b44c553','16463b9c-69fc-41d2-9156-d7f07aa4ac40')
  and r.naam in ('Landelijk','Caribisch deel van het Koninkrijk')
on conflict do nothing;
