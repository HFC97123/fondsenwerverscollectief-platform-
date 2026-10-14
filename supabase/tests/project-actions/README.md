# Test van de takentabel (subsidie_kompas_program_actions)

Draait de voorgestelde migratie `supabase/voorstel-niet-uitgevoerd/20261012120000_project_actions.sql` op een LOKALE, tijdelijke
Postgres met een minimale nabootsing van het Supabase-schema (auth.users, auth.uid(), rollen anon, authenticated, service_role,
programs en funding). Raakt de live database niet.

    initdb -D /tmp/pgt/data && pg_ctl -D /tmp/pgt/data -o '-p 5499 -k /tmp/pgt' start
    psql -h /tmp/pgt -p 5499 -U postgres -v ON_ERROR_STOP=1 -f stub.sql
    psql -h /tmp/pgt -p 5499 -U postgres -v ON_ERROR_STOP=1 -f ../../voorstel-niet-uitgevoerd/20261012120000_project_actions.sql
    psql -h /tmp/pgt -p 5499 -U postgres -f t.sql

Verwacht (staat per test in t.sql): T1 OK; T2-T5 FOUT (RLS, andere gebruiker, andere project-regel, lege titel, ongeldige status of prioriteit);
T6 completed_at gezet en gewist; T7 FOUT (kolomrechten); T8-T9 OK; T10 geen zichtbare of wijzigbare rijen voor een andere gebruiker;
T11 anon FOUT; T12 taak blijft met funding_id null; T13 taken verdwijnen met het project; T14 FOUT bij taak 201.
