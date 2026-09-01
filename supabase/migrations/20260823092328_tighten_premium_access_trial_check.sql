-- Doel: current_user_has_premium_access() bepaalt of een gebruiker de
-- Premium Fondsendatabase mag zien (via de views funders_premium en
-- subsidieregelingen_premium, die beide SECURITY DEFINER zijn en dus
-- RLS op funders/subsidieregelingen omzeilen — de WHERE-clause met deze
-- functie is de enige poort).
--
-- Bevinding: de trial-clausule ("trial_ends_at is not null and
-- trial_ends_at > now()") gold voor ELKE gebruiker met een lopende
-- trial, ongeacht subscription_tier. Als er ooit een Free- of Pro-trial
-- wordt geintroduceerd (los van een Premium-trial), zou dat die
-- gebruikers automatisch toegang geven tot de Premium Fondsendatabase
-- via de REST API — terwijl de Edge Function (getFeatures/plan-logica)
-- Free/Pro nooit als canUsePremiumDatabase behandelt. Vandaag zijn er
-- geen actieve trials in profiles, dus dit is nu geen actief lek, maar
-- wel een sluimerend gat dat "Free en Pro mogen nooit in de database"
-- niet garandeert.
--
-- Wijziging: trial telt alleen nog mee als de gebruiker al
-- subscription_tier = 'premium' heeft (bv. een lopende Premium-trial
-- vóór de eerste betaling) — nooit voor Free of Pro, trial of niet.
--
-- Risico: laag. Verkleint toegang (striktter), breidt niets uit. De
-- enige gebruikers die dit kan raken zijn hypothetische Free/Pro-trial
-- gebruikers, die nu niet bestaan.
-- Rollback: zet de functie terug naar de vorige definitie (trial-clausule
-- zonder de subscription_tier = 'premium'-voorwaarde).

create or replace function public.current_user_has_premium_access()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (subscription_tier = 'premium' and subscription_active = true)
        or (subscription_tier = 'premium' and trial_ends_at is not null and trial_ends_at > now())
      )
  );
$function$;
