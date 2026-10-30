-- Terugdraaien naar 1200 tekens. Lukt alleen als geen enkele bio langer is dan 1200 tekens.
alter table public.profiles drop constraint if exists profiles_bio_lengte;
alter table public.profiles add constraint profiles_bio_lengte check (bio is null or char_length(bio) <= 1200);

create or replace function public.zet_mijn_bio(p_bio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bio text := nullif(btrim(coalesce(p_bio, ''), E' \t\r\n'), '');
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  if v_bio is not null and char_length(v_bio) > 1200 then
    raise exception 'De beschrijving mag maximaal 1200 tekens bevatten' using errcode = '22001';
  end if;

  update public.profiles set bio = v_bio where id = v_uid and status = 'approved';

  if not found then
    raise exception 'Profiel niet gevonden of nog niet goedgekeurd' using errcode = '42501';
  end if;
end;
$$;
