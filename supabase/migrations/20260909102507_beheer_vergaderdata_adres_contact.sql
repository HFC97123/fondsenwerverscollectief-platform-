-- Vervolgopdracht: beheerdersconsole afmaken.
-- 1. Vergaderdatum: nieuwe, puur additieve velden per funder (hoofdgebruik) en
--    optioneel per subsidieregeling (override, zelfde patroon als bijdrage_toelichting/
--    bandbreedte_bijdrage_id die ook op beide tabellen bestaan). Geen nieuwe tabel voor
--    "meerdere vergaderdata": de bestaande datastructuur (losse kolommen) ondersteunt dat
--    niet, en subsidieregeling_rondes (met beoordelingsdatum) bestaat al voor het geval
--    van meerdere momenten per jaar gekoppeld aan een concrete aanvraagronde. Voor het
--    algemene "dit bestuur vergadert N keer per jaar"-geval volstaan drie velden:
--    eerstvolgende datum, frequentie (vrije tekst, kan meerdere data noemen) en toelichting.
-- 4. Adres en contactpersonen: bestaande vrije-tekst `adres`-kolom op funders blijft
--    ongewijzigd bestaan (geen bestaande data overschreven/verwijderd); nieuw zijn de
--    gestructureerde adresvelden. Contactpersoon krijgt een functie-veld; nieuw zijn ook
--    "algemene" contactgegevens naast de bestaande, kennelijk persoonsgebonden
--    contactpersoon/email/telefoon (die al eigen _prive-vlaggen hebben). Subsidieregelingen
--    hadden nog helemaal geen contactvelden - die komen er nu bij, in dezelfde vorm als bij
--    funders (zonder de _prive-vlaggen: die blijken nergens in de app te worden gebruikt,
--    dus geen reden om dat patroon hier te dupliceren).

alter table public.funders
  add column if not exists volgende_vergaderdatum date,
  add column if not exists vergaderfrequentie text,
  add column if not exists vergadering_toelichting text,
  add column if not exists straat text,
  add column if not exists huisnummer text,
  add column if not exists postcode text,
  add column if not exists plaats text,
  add column if not exists provincie text,
  add column if not exists land text,
  add column if not exists contactpersoon_functie text,
  add column if not exists algemeen_email text,
  add column if not exists algemeen_telefoon text;

alter table public.subsidieregelingen
  add column if not exists volgende_vergaderdatum date,
  add column if not exists vergaderfrequentie text,
  add column if not exists vergadering_toelichting text,
  add column if not exists straat text,
  add column if not exists huisnummer text,
  add column if not exists postcode text,
  add column if not exists plaats text,
  add column if not exists provincie text,
  add column if not exists land text,
  add column if not exists contactpersoon text,
  add column if not exists contactpersoon_functie text,
  add column if not exists email text,
  add column if not exists telefoon text,
  add column if not exists algemeen_email text,
  add column if not exists algemeen_telefoon text,
  add column if not exists website text;

comment on column public.funders.volgende_vergaderdatum is 'Eerstvolgende bestuursvergadering van deze funder (vrij in te vullen door beheer, leeg toegestaan).';
comment on column public.funders.vergaderfrequentie is 'Vrije tekst, bijv. "3x per jaar" of "elk kwartaal" - kan ook meerdere concrete data noemen als dat nodig is.';
comment on column public.subsidieregelingen.volgende_vergaderdatum is 'Optionele override van de vergaderdatum van de gekoppelde funder, voor een regeling met een eigen bestuursritme. Voor regelingen met concrete aanvraagrondes is subsidieregeling_rondes.beoordelingsdatum vaak nauwkeuriger.';
