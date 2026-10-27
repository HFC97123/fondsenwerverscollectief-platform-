-- Slimme herkenning projectgegevens: de eigen woorden van het lid ("Overig, anders namelijk") blijven bij het project bewaard, ook als ze aan
-- een bestaande discipline, doelgroep of werkgebied gekoppeld zijn. Vorm: [{ "woord": "drummen", "koppelingen": [{ "categorie": "discipline", "naam": "Muziek" }] }];
-- een lege lijst met koppelingen betekent "nog niet te koppelen" (beheer kan het woord later aan de werklijst toevoegen).
-- De gekozen waarden zelf staan gewoon in themes, target_groups en location; de matching leest alleen die. De bestaande RLS op de tabel geldt ook voor deze kolom.
-- Terugdraaien: supabase/voorstellen/20261027100000_project_eigen_termen_rollback.sql (alleen na akkoord).
begin;

alter table public.subsidie_kompas_programs
  add column if not exists eigen_termen jsonb null
    check (eigen_termen is null or (jsonb_typeof(eigen_termen) = 'array' and jsonb_array_length(eigen_termen) <= 20 and pg_column_size(eigen_termen) <= 20000));

commit;
