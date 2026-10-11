-- Backfill van de bestaande vrije-tekst subsidieregelingen.thema/werkgebied
-- naar de centrale koppeltabellen (subsidieregeling_themas/_regios), zodat
-- er na het verwijderen van de vrije-tekstvelden in de admin-UI geen
-- classificatie-informatie verloren gaat. Niet-destructief: de oude
-- thema/werkgebied-kolommen zelf blijven ongewijzigd (nog nodig als fallback
-- totdat de frontend/AI/matching-laag is omgezet), er wordt alleen extra
-- aan de koppeltabellen toegevoegd.
--
-- Matching-strategie: subsidieregelingen.thema bevat vaak een kommagescheiden
-- opsomming (bijv. "kunst, cultuur") gemixt met lange beschrijvende teksten
-- die geen echte categorie zijn. Elk kommagescheiden onderdeel wordt
-- case-insensitief exact vergeleken met de centrale themas.naam/regios.naam
-- — geen fuzzy/substring-matching, dus geen risico op verkeerde koppelingen.
-- Onderdelen zonder exacte match (de beschrijvende zinnen) worden bewust
-- overgeslagen en blijven wachten op handmatige beheerdersactie via de
-- nieuwe centrale multi-select.

insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select distinct r.id, t.id
from public.subsidieregelingen r
cross join lateral unnest(string_to_array(r.thema, ',')) as deel(waarde)
join public.themas t on lower(trim(deel.waarde)) = lower(t.naam)
where r.thema is not null
on conflict (subsidieregeling_id, thema_id) do nothing;

insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select distinct r.id, g.id
from public.subsidieregelingen r
cross join lateral unnest(string_to_array(r.werkgebied, ',')) as deel(waarde)
join public.regios g on lower(trim(deel.waarde)) = lower(g.naam)
where r.werkgebied is not null
on conflict (subsidieregeling_id, regio_id) do nothing;
