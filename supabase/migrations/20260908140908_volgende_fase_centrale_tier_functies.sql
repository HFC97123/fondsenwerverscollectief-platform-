-- Volgende fase: één centrale, herbruikbare regel voor "mag deze gebruiker dit
-- record volledig zien op basis van toegangsniveau", zodat de Timeline
-- (subsidieregelingen_deadlines) en de chatbot (subsidie-kompas Edge Function)
-- exact dezelfde regel toepassen — nooit twee keer dezelfde logica onderhouden.
--
-- Veilige migratie (zoals gevraagd): zolang classification_reviewed = false op
-- een record, blijft de OUDE herkomst-heuristiek (data_tier/source_type)
-- gelden, ongewijzigd. Pas als een beheerder een record op classification_reviewed
-- = true zet, wordt access_tier voor dat record leidend. p_tier komt van de
-- aanroeper: de Timeline-view leidt 'm af via current_user_has_pro_access()/
-- current_user_has_premium_access() (ongewijzigd, per ingelogde gebruiker); de
-- chatbot geeft het al server-side, veilig herleide abonnement mee (nooit van
-- de client vertrouwd).
create or replace function public.subsidie_zichtbaar_voor_tier(
  p_reviewed boolean,
  p_access_tier subsidie_access_tier,
  p_data_tier subsidie_data_tier,
  p_source_type subsidie_source_type,
  p_tier text
) returns boolean
language sql
stable
as $$
  select case
    when p_reviewed then
      p_access_tier = 'free'
      or (p_access_tier = 'pro' and p_tier in ('pro', 'premium'))
      or (p_access_tier = 'premium' and p_tier = 'premium')
    else
      (p_data_tier = 'public' and p_source_type = 'internet_scan' and p_tier in ('pro', 'premium'))
      or p_tier = 'premium'
  end;
$$;

comment on function public.subsidie_zichtbaar_voor_tier(boolean, subsidie_access_tier, subsidie_data_tier, subsidie_source_type, text) is
  'Eén centrale regel voor toegang op basis van toegangsniveau, met veilige fallback op de oude data_tier/source_type-heuristiek zolang classification_reviewed = false. Gebruikt door subsidieregelingen_deadlines (Timeline) en kompas_subsidieregelingen_voor_tier (chatbot).';

revoke all on function public.subsidie_zichtbaar_voor_tier(boolean, subsidie_access_tier, subsidie_data_tier, subsidie_source_type, text) from public;
grant execute on function public.subsidie_zichtbaar_voor_tier(boolean, subsidie_access_tier, subsidie_data_tier, subsidie_source_type, text) to anon, authenticated, service_role;

-- Server-side databron voor de Subsidie Kompas-chatbot: exact dezelfde
-- centrale tabellen/koppeltabellen als Beheer en de Timeline, gefilterd op
-- het (server-side al veilig herleide) toegangsniveau. p_tier wordt NOOIT
-- door een client aangeleverd — alleen de Edge Function (service_role) mag
-- dit aanroepen, met een tier die zij zelf uit profiles.subscription_tier
-- heeft gehaald.
create or replace function public.kompas_subsidieregelingen_voor_tier(p_tier text)
returns table (
  regeling_id uuid,
  naam text,
  status text,
  deadline_datum date,
  deadline_omschrijving text,
  bedrag_min numeric,
  bedrag_max numeric,
  bandbreedte_bijdrage_naam text,
  aanvraagcriteria text,
  beoordelingscriteria text,
  type_projecten text,
  begrotingseisen text,
  eigen_bijdrage text,
  cofinanciering text,
  behandeltermijn text,
  aanvraagprocedure text,
  aanvraaglink text,
  access_tier subsidie_access_tier,
  type_gever text,
  funder_naam text,
  funder_website text,
  funder_missie text,
  funder_aanvraagcriteria text,
  themas_namen text[],
  doelgroepen_namen text[],
  werkgebieden_namen text[]
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    sr.id,
    sr.naam,
    case sr.status
      when 'open' then 'Open'
      when 'binnenkort' then 'Binnenkort'
      when 'doorlopend' then 'Doorlopend'
      when 'aangekondigd' then 'Aangekondigd'
      when 'budget_uitgeput' then 'Budget uitgeput'
      when 'gesloten' then 'Gesloten'
      else null
    end,
    sr.deadline_datum,
    sr.deadline_omschrijving,
    sr.bedrag_min,
    sr.bedrag_max,
    bb.naam,
    sr.voorwaarden,
    sr.beoordelingscriteria,
    sr.type_projecten,
    sr.begrotingseisen,
    sr.eigen_bijdrage,
    sr.cofinanciering,
    sr.behandeltermijn,
    sr.aanvraagprocedure,
    sr.aanvraaglink,
    sr.access_tier,
    coalesce(sr.type::text, f.type::text),
    f.naam,
    f.website,
    f.missie,
    f.aanvraagcriteria,
    (select array_agg(t.naam order by t.naam) from subsidieregeling_themas st join themas t on t.id = st.thema_id where st.subsidieregeling_id = sr.id),
    (select array_agg(d.naam order by d.naam) from subsidieregeling_doelgroepen sd join doelgroepen d on d.id = sd.doelgroep_id where sd.subsidieregeling_id = sr.id),
    (select array_agg(r.naam order by r.naam) from subsidieregeling_regios sw join regios r on r.id = sw.regio_id where sw.subsidieregeling_id = sr.id)
  from subsidieregelingen sr
  join funders f on f.id = sr.funder_id
  left join bandbreedtes_bijdrage bb on bb.id = sr.bandbreedte_bijdrage_id
  where sr.status <> 'gesloten'
    and public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, p_tier)
  order by
    case sr.status
      when 'open' then 0
      when 'binnenkort' then 1
      when 'aangekondigd' then 2
      when 'doorlopend' then 3
      else 4
    end,
    sr.deadline_datum nulls last
  limit 250;
$$;

comment on function public.kompas_subsidieregelingen_voor_tier(text) is
  'Databron voor fondsadvies in de Subsidie Kompas-chatbot: dezelfde tabellen/koppeltabellen als Beheer en de Timeline, server-side gefilterd op toegangsniveau via subsidie_zichtbaar_voor_tier(). Alleen aan te roepen door de Edge Function (service_role) met een zelf, veilig herleide tier.';

revoke all on function public.kompas_subsidieregelingen_voor_tier(text) from public;
grant execute on function public.kompas_subsidieregelingen_voor_tier(text) to service_role;
