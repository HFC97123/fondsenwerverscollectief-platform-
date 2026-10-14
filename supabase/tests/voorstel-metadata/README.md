# Test van de voorstel-metadata (20261014120000_voorstel_metadata.sql)

Draait de voorgestelde migratie en haar rollback op een LOKALE, tijdelijke Postgres met een minimale nabootsing van het
Supabase-schema (staat NA 20261011180913 en 20261014095805). Raakt de live database niet.

    # als niet-root gebruiker, met PostgreSQL 16 in PATH
    sh supabase/tests/voorstel-metadata/run.sh

Verwacht: `OK: 165  FAIL: 0` en een rollbackregel met o.a. `notitie-herkomst=1` (de Ingetrokken-regel is Afgewezen geworden met de herkomst vooraan in de notitie) en `regels behouden` gelijk aan het aantal regels vóór de rollback.
Dekt: bestaande regels ongewijzigd; voorstel op regeling; online financier (https-bron, controledatum, Pro/Premium, geen
Free, geen dubbele naam, geen javascript:-url); vorm en grootte van de metadata; onveranderlijkheid (kolomrecht én trigger);
status Ingetrokken; gemaskeerde metadata-RPC (verborgen bron lekt niets, andere gebruiker en anon krijgen niets);
taak-idempotentie (`voorstel_sleutel`), onveranderlijke sleutel en bron-deadline, streefdatum zetten blijft mogelijk.

Versie 2 (Optie B, server-owned): dekt bovendien dat authenticated `voorstel` nooit kan lezen of schrijven (select, select *, to_jsonb(rij),
WHERE/ORDER BY, RETURNING), dat alleen service_role de kolom bij het aanmaken kan zetten (met strikt schema), dat het schema
clientclaims (server_generated, geverifieerd zonder bewijs) en conflicten zonder herleidbaar bewijs weigert, dat de RPC na een
downgrade Premium naar Pro/Free niets van verborgen Premium-regelingen of -fondsen teruggeeft, en dat de rollback het oorspronkelijke
tabelrecht herstelt.
