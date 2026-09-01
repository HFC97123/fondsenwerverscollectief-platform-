
-- approved_by hoort historisch een e-mailadres te zijn (zo deed de oude
-- client-side reviewApplication het ook, met user?.email). De eerste versie
-- van deze RPC zette hier per ongeluk de UUID van auth.uid() neer. Herstel
-- naar het e-mailadres van de handelende beheerder, met de UUID als
-- fallback als er om wat voor reden geen profielrij bestaat.
create or replace function public.admin_set_status(
  p_user_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_email text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Ongeldige status: %', p_status;
  end if;

  select email into v_admin_email from public.profiles where id = auth.uid();

  update public.profiles
  set status = p_status,
      approved_at = case when p_status = 'approved' then now() else null end,
      approved_by = case when p_status = 'approved' then coalesce(v_admin_email, auth.uid()::text, 'admin') else approved_by end
  where id = p_user_id;

  if not found then
    raise exception 'Gebruiker % niet gevonden.', p_user_id;
  end if;
end;
$$;
