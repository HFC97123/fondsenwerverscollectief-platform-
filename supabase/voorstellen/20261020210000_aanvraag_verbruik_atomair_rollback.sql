-- Terugdraaien van 20261020210000_aanvraag_verbruik_atomair.sql. Let op: de Edge Function aanvraag-assistent moet dan eerst weer de vorige versie zijn,
-- anders weigert hij verzoeken (de teller is niet meer te lezen).
begin;
drop function if exists public.aanvraag_verbruik_rond_af(uuid, uuid, boolean);
drop function if exists public.aanvraag_verbruik_reserveer(uuid, text, integer, timestamptz);
drop function if exists public.aanvraag_verbruik_tel(uuid, text, timestamptz);
drop table if exists public.subsidie_kompas_aanvraag_verbruik;
commit;
