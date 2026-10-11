-- Bijvangst tijdens dit werk: de security-advisor meldde dat admin_update_funder
-- en admin_update_subsidieregeling EXECUTE-rechten hadden voor de anon-rol
-- (dus onauthenticated aanroepbaar over de REST-API, al faalt de aanroep
-- altijd op de interne current_user_is_admin()-check). Dit was al zo vóór
-- deze sessie (CREATE OR REPLACE erft bestaande rechten over), niet iets wat
-- deze migratie heeft toegevoegd. Nu expliciet gelijkgetrokken met het
-- patroon van alle andere admin-RPC's in deze codebase (alleen authenticated,
-- nooit public/anon).
revoke all on function public.admin_update_funder(uuid, text, funder_type, text, text, text, numeric, numeric, numeric, integer, text, text, text) from public;
grant execute on function public.admin_update_funder(uuid, text, funder_type, text, text, text, numeric, numeric, numeric, integer, text, text, text) to authenticated;

revoke all on function public.admin_update_subsidieregeling(uuid, text, text, numeric, numeric, text, date, text, text, regeling_status_type, uuid, text, text, text, text, text, text, text, text, text, funder_type) from public;
grant execute on function public.admin_update_subsidieregeling(uuid, text, text, numeric, numeric, text, date, text, text, regeling_status_type, uuid, text, text, text, text, text, text, text, text, text, funder_type) to authenticated;
