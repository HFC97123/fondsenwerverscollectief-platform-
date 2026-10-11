-- Root-cause fix: themas/doelgroepen/regios/bandbreedtes_bijdrage en de zes
-- classificatie-koppeltabellen hadden allemaal al een correcte RLS-policy
-- ("authenticated mag lezen", qual = true), maar misten de onderliggende
-- Postgres GRANT SELECT. RLS zonder GRANT blokkeert nog steeds (42501
-- permission denied), ongeacht de policy. Dit is precies waarom
-- classificaties.js (haalClassificatiesOp/haalBandbreedtesOp, rechtstreekse
-- tabel-reads) in de admin altijd lege lijsten teruggaf voor disciplines,
-- doelgroepen, werkgebieden en bandbreedtes.
--
-- Alleen SELECT, alleen voor de rol die de bestaande policy al toestond
-- (authenticated) — geen schrijfrechten, geen wijziging aan RLS zelf, geen
-- rol die nu meer mag dan het ontwerp al voorzag.
grant select on public.themas to authenticated;
grant select on public.doelgroepen to authenticated;
grant select on public.regios to authenticated;
grant select on public.bandbreedtes_bijdrage to authenticated;
grant select on public.funder_themas to authenticated;
grant select on public.funder_doelgroepen to authenticated;
grant select on public.funder_regios to authenticated;
grant select on public.subsidieregeling_themas to authenticated;
grant select on public.subsidieregeling_doelgroepen to authenticated;
grant select on public.subsidieregeling_regios to authenticated;
