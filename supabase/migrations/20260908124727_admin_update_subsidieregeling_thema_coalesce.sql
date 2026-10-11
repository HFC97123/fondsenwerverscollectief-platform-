-- De admin-bewerkschermen laten thema/werkgebied als vrije tekst nu volledig
-- los (Beheer werkt uitsluitend nog met de centrale multi-select
-- disciplines/werkgebieden). Deze RPC ontving thema echter altijd als hard
-- SET (in tegenstelling tot werkgebied, dat al coalesce(p_werkgebied,
-- werkgebied) gebruikte) — zonder deze fix zou elke opslag vanuit een
-- formulier zonder thema-veld de bestaande legacy thema-tekst stilzwijgend
-- op NULL zetten. Same-signature fix (RETURNS void, geen kolomwijziging),
-- dus CREATE OR REPLACE volstaat.
CREATE OR REPLACE FUNCTION public.admin_update_subsidieregeling(p_regeling_id uuid, p_naam text, p_thema text, p_bedrag_min numeric, p_bedrag_max numeric, p_deadline text, p_deadline_datum date, p_deadline_omschrijving text, p_voorwaarden text, p_status regeling_status_type, p_funder_id uuid, p_werkgebied text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_regeling_id is null then
    raise exception 'p_regeling_id is verplicht.';
  end if;

  update public.subsidieregelingen
  set naam = p_naam,
      thema = coalesce(p_thema, thema),
      bedrag_min = p_bedrag_min,
      bedrag_max = p_bedrag_max,
      deadline = p_deadline,
      deadline_datum = p_deadline_datum,
      deadline_omschrijving = p_deadline_omschrijving,
      voorwaarden = p_voorwaarden,
      status = p_status,
      funder_id = p_funder_id,
      werkgebied = coalesce(p_werkgebied, werkgebied),
      updated_at = now()
  where id = p_regeling_id;

  if not found then
    raise exception 'Subsidieregeling % niet gevonden.', p_regeling_id;
  end if;
end;
$function$;
