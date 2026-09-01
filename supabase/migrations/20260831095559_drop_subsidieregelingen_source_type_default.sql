-- Stap 5 van de goedgekeurde deployvolgorde (zie status-developer-guide.md):
-- de tijdelijke default op subsidieregelingen.source_type wordt nu verwijderd,
-- nu enrich-funders (v17) aantoonbaar expliciet source_type meestuurt bij elke
-- nieuwe insert (bevestigd in stap 3/4 met een echte productie-aanroep).
-- Uitsluitend deze ene wijziging -- geen data, geen andere kolommen, geen
-- policies of grants worden aangeraakt.

alter table public.subsidieregelingen
  alter column source_type drop default;
