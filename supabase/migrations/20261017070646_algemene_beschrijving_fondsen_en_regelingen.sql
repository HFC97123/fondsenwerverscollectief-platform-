-- Vrij tekstveld met de algemene beschrijving / doelstellingen (op basis van de eigen website), bedoeld als bron voor trefwoorden in de AI-matching.
alter table public.funders add column if not exists algemene_beschrijving text;
alter table public.subsidieregelingen add column if not exists algemene_beschrijving text;
comment on column public.funders.algemene_beschrijving is 'Algemene beschrijving en doelstellingen van het fonds, samengevat van de eigen website; bron voor trefwoorden in AI-matching.';
comment on column public.subsidieregelingen.algemene_beschrijving is 'Algemene beschrijving van de regeling (doel, voor wie, wat wordt gesteund), samengevat van de officiële regelingspagina; bron voor trefwoorden in AI-matching.';
