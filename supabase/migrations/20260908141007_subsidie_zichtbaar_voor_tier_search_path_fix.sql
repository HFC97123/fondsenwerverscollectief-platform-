-- Advisor-melding oplossen: search_path expliciet vastzetten, zoals bij de
-- rest van de admin/toegangsfuncties in dit project.
create or replace function public.subsidie_zichtbaar_voor_tier(
  p_reviewed boolean,
  p_access_tier subsidie_access_tier,
  p_data_tier subsidie_data_tier,
  p_source_type subsidie_source_type,
  p_tier text
) returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
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
