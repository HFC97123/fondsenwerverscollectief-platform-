-- Rollback van 20261015140000_bron_controles.sql. Verwijdert alleen de tabel met broncontroles; financieringsregels en taken blijven.
begin;
drop table if exists public.subsidie_kompas_bron_controles;
commit;
