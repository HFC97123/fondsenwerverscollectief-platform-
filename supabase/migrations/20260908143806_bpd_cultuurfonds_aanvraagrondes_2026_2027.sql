-- BPD Cultuurfonds – Sponsorbijdrage: de drie momenteel gepubliceerde
-- aanvraagrondes (bron: https://www.bpdcultuurfonds.nl/aanvraag-indienen).
-- Regeling-id geverifieerd: er bestaat precies één subsidieregeling
-- "Sponsorbijdrage" gekoppeld aan de (bestaande) funder "BPD Cultuurfonds" —
-- geen dubbele regeling aangemaakt.
insert into public.subsidieregeling_rondes
  (subsidieregeling_id, sluitingsdatum, sluitingstijd, beoordelingsdatum, beoordelingsperiode, toelichting, bron_url)
values
  ('3e28ff95-93c3-42d8-8a34-b04e7e2dda4d', '2026-08-03', '12:00', '2026-11-11', null, 'Ronde 1 van 2026', 'https://www.bpdcultuurfonds.nl/aanvraag-indienen'),
  ('3e28ff95-93c3-42d8-8a34-b04e7e2dda4d', '2026-12-01', '12:00', null, 'maart 2027', 'Ronde 2 van 2026', 'https://www.bpdcultuurfonds.nl/aanvraag-indienen'),
  ('3e28ff95-93c3-42d8-8a34-b04e7e2dda4d', '2027-04-01', '12:00', null, 'juli 2027', 'Ronde 1 van 2027', 'https://www.bpdcultuurfonds.nl/aanvraag-indienen');
