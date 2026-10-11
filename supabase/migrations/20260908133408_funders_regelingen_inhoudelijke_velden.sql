-- Fase 3: ontbrekende inhoudelijke beheervelden voor funders en subsidieregelingen.
-- Puur additief: geen bestaande kolom gewijzigd of verwijderd.

-- Funders: één goed leesbaar "aanvraagcriteria"-tekstveld (naast de bestaande
-- "missie"), zoals expliciet gevraagd in punt 5/12 van de opdracht: wie mag
-- aanvragen, rechtsvorm, omvang, doelgroep, looptijd, eigen bijdrage,
-- cofinanciering, uitsluitingen, geografische eisen, overige voorwaarden -
-- allemaal in één tekstveld i.p.v. losse kolommen per subpunt.
alter table public.funders
  add column if not exists aanvraagcriteria text;

comment on column public.funders.aanvraagcriteria is
  'Vrij tekstveld: aan welke voorwaarden een aanvrager/project moet voldoen. Door de chatbot te gebruiken bij fondsadvies en matching zodra die functionaliteit wordt gebouwd.';

-- Subsidieregelingen: regeling-specifieke velden die nog ontbraken.
-- "voorwaarden" (bestaande kolom) blijft de regeling-specifieke tegenhanger
-- van funders.aanvraagcriteria - alleen het label in de admin-UI wordt
-- "Aanvraagcriteria"; de kolomnaam blijft ongewijzigd (geen destructieve
-- hernoeming, geen regressie voor de publieke view die dit veld al leest).
alter table public.subsidieregelingen
  add column if not exists aanvraaglink text,
  add column if not exists beoordelingscriteria text,
  add column if not exists type_projecten text,
  add column if not exists begrotingseisen text,
  add column if not exists eigen_bijdrage text,
  add column if not exists cofinanciering text,
  add column if not exists behandeltermijn text,
  add column if not exists aanvraagprocedure text,
  add column if not exists type funder_type;

comment on column public.subsidieregelingen.aanvraaglink is
  'Website/URL van de specifieke regeling (kan afwijken van de website van de gever).';
comment on column public.subsidieregelingen.beoordelingscriteria is
  'Vrij tekstveld: waarop een aanvraag voor déze regeling wordt beoordeeld.';
comment on column public.subsidieregelingen.type_projecten is
  'Vrij tekstveld: welk type projecten deze regeling financiert.';
comment on column public.subsidieregelingen.begrotingseisen is
  'Vrij tekstveld: eisen aan de begroting van een aanvraag voor déze regeling.';
comment on column public.subsidieregelingen.eigen_bijdrage is
  'Vrij tekstveld: eigen-bijdrage-eis voor déze regeling, indien van toepassing.';
comment on column public.subsidieregelingen.cofinanciering is
  'Vrij tekstveld: cofinancieringseis voor déze regeling, indien van toepassing.';
comment on column public.subsidieregelingen.behandeltermijn is
  'Vrij tekstveld: gebruikelijke behandeltermijn van een aanvraag voor déze regeling.';
comment on column public.subsidieregelingen.aanvraagprocedure is
  'Vrij tekstveld: hoe een aanvraag voor déze regeling moet worden ingediend.';
comment on column public.subsidieregelingen.type is
  'Type gever voor déze regeling. NULL = overgenomen van de gekoppelde gever (funders.type); alleen invullen als deze regeling afwijkt van de algemene gever.';
