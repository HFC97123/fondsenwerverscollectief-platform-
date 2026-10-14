#!/bin/sh
# Draait de test op een LOKALE, tijdelijke Postgres. Raakt de live database niet.
# Gebruik (als niet-root gebruiker met PostgreSQL 16 in PATH):  sh run.sh
set -e
D=$(mktemp -d); PORT=5498
initdb -D "$D/data" -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null
pg_ctl -D "$D/data" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" -w start >/dev/null
here=$(cd "$(dirname "$0")" && pwd)
PSQL="psql -h $D -p $PORT -U postgres -q"
$PSQL -v ON_ERROR_STOP=1 -f "$here/stub.sql"
# De takentabel (live sinds 20261014095805; bestandsversie in de repository)
f=$here/../../migrations/20261014095805_project_actions.sql; [ -f "$f" ] || f=$here/../../voorstel-niet-uitgevoerd/20261012120000_project_actions.sql
$PSQL -v ON_ERROR_STOP=1 -f "$f"
cd "$here" && $PSQL -f t.sql 2>&1 | tee "$D/uit.txt"
# Zorg dat er bij de rollback een Ingetrokken-regel bestaat, zodat de conversie wordt meegetest
$PSQL -c "update public.subsidie_kompas_program_funding set status='withdrawn' where id='f0000000-0000-4000-8000-000000000001'"
echo "--- rollback"
$PSQL -v ON_ERROR_STOP=1 -f "$here/../../voorstel-niet-uitgevoerd/20261014120000_voorstel_metadata_rollback.sql"
$PSQL -t -c "select 'rollback: voorstel-kolom weg=' || (not exists(select 1 from information_schema.columns where table_name='subsidie_kompas_program_funding' and column_name='voorstel')) || ', sleutel-kolom weg=' || (not exists(select 1 from information_schema.columns where table_name='subsidie_kompas_program_actions' and column_name='voorstel_sleutel')) || ', rpc weg=' || (not exists(select 1 from pg_proc where proname='kompas_voorstel_metadata')) || ', withdrawn-rijen=' || (select count(*) from public.subsidie_kompas_program_funding where status='withdrawn') || ', notitie-herkomst=' || (select count(*) from public.subsidie_kompas_program_funding where notes like '[Teruggezet: was Ingetrokken%') || ', regels behouden=' || (select count(*) from public.subsidie_kompas_program_funding)"
# Na de rollback moet het oorspronkelijke tabelbrede SELECT-recht van authenticated terug zijn (en `select *` weer werken)
$PSQL -t -c "select 'rollback: tabelrecht select hersteld=' || has_table_privilege('authenticated','public.subsidie_kompas_program_funding','select')"
pg_ctl -D "$D/data" stop >/dev/null
echo "OK: $(grep -c 'NOTICE:  OK' "$D/uit.txt")  FAIL: $(grep -c 'NOTICE:  FAIL' "$D/uit.txt")"
rm -rf "$D"
