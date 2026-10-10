-- Rollback van 20261010120000_member_reviews.sql (verwijdert ook alle waarderingen).
drop function if exists public.publieke_ledenreviews(integer);
drop table if exists public.member_reviews;
drop function if exists public.member_reviews_set_updated_at();
