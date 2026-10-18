-- Werkgebied-verfijning: het gekozen werkgebied als ISO-landcodes plus door het lid BEVESTIGDE verfijningen (GeoNames-ID, plaatsnaam, landcode, coördinaten).
-- Eén nullable jsonb-kolom op subsidie_kompas_programs; bestaande projecten en rijen blijven ongewijzigd (NULL). Het veld location (het gekozen werkgebied
-- als tekst) blijft de bron: de landen worden daaruit afgeleid en hier alleen vastgelegd.
-- Vorm: { "landen": ["GH"], "verfijningen": [ { "geonamesId": 2297172, "naam": "Kumasi", "landcode": "GH", "lat": 6.68848, "lng": -1.62443 } ] }
-- Terugdraaien: alter table public.subsidie_kompas_programs drop column if exists work_area;
alter table public.subsidie_kompas_programs add column if not exists work_area jsonb;

comment on column public.subsidie_kompas_programs.work_area is
  'Gekozen werkgebied als ISO-landcodes en bevestigde verfijningen (GeoNames). Alleen door het lid bevestigde plaatsen; AI-voorstellen staan hier nooit zonder bevestiging.';
