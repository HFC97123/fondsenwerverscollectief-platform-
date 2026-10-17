-- UITGEVOERD 16-10-2026 via execute_sql: Cariben-scan regelingen zichtbaar op de deadlinepagina (classification_reviewed = true), 29 rijen.
-- Bewust niet: Marriott (in natura), SMDF Incidental Grants, Be The Change Spotlight (onbevestigd), Corendon (werkgebied onbevestigd).
update public.subsidieregelingen s set classification_reviewed = true
where s.created_at > '2026-10-14' and not s.classification_reviewed and s.source_type='internet_scan' and s.discovered_by='agent'
  and s.naam not in ('Ondersteuning lokale stichtingen (in natura)','Incidental Grants','Projectvoorstel Corendon Foundation','Spotlight Project Grants');
