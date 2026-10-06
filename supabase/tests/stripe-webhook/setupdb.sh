#!/bin/bash
# wegwerp-Postgres met kopie van relevante live-structuur + de definitieve migratie
B=/usr/lib/postgresql/16/bin; D=/var/tmp/pg2c1
su postgres -c "$B/pg_ctl -D $D stop -m fast" >/dev/null 2>&1; rm -rf $D; mkdir -p $D; chown postgres $D
su postgres -c "$B/initdb -D $D -A trust >/dev/null && $B/pg_ctl -D $D -o '-p 5544 -k /var/tmp' -l /var/tmp/pg2c1.log -w start" >/dev/null 2>&1
P="psql -h /var/tmp -p 5544 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database t" && P="$P -d t" && $P -f ./stub.sql && $P <<'SQL'
create function public.current_user_has_premium_access() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin'
   or (subscription_tier = 'premium' and subscription_active = true)
   or (subscription_tier = 'premium' and trial_ends_at is not null and trial_ends_at > now()))); $$;
create function public.current_user_has_pro_access() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin'
   or (subscription_tier in ('pro','premium') and subscription_active = true)
   or (subscription_tier in ('pro','premium') and trial_ends_at is not null and trial_ends_at > now()))); $$;
SQL
$P -f ${MIGR:-../../migrations/20261006120000_stripe_webhook_fundament.sql} && echo DB_READY
