-- Terugdraaien van 20261028100000_leren_van_gebruik.sql
drop trigger if exists kompas_lid_financier_trigger on public.subsidie_kompas_program_funding;
drop function if exists public.kompas_lid_financier_naar_werklijst();
drop function if exists public.admin_set_algemene_beschrijving(text, uuid, text);
drop function if exists public.admin_get_algemene_beschrijving(text, uuid);
drop function if exists public.admin_online_gescand_opnemen(uuid, funder_type);
drop function if exists public.admin_herkenningswoord_verwijder(uuid);
drop function if exists public.admin_herkenningswoorden_lijst();
drop function if exists public.admin_eigen_term_beslis(uuid, text, text, text);
drop function if exists public.admin_eigen_termen_telling();
drop function if exists public.admin_eigen_termen_lijst(text, text, integer);
drop function if exists public.kompas_eigen_termen_advies(jsonb);
drop function if exists public.kompas_herkenningswoorden_lees(text[]);
drop function if exists public.kompas_eigen_termen_registreer(text[]);
drop table if exists public.kompas_herkenningswoorden;
drop table if exists public.kompas_eigen_termen_werklijst;
drop function if exists public.kompas_woord_sleutel(text);
-- Rijen met bron 'lid' in kompas_online_gescand blijven staan (alleen namen); verwijderen kan met:
-- delete from public.kompas_online_gescand where bron = 'lid';
