// Statische controle van de migratie en de beheerconfiguratie voor de vier
// publieke contenttypes (video's, templates, agenda, blog).
//   node tests/beheer-tabellen/run.mjs   (vanuit de repo-root)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let ok = 0, fail = 0;
const t = (n, c, d = '') => { c ? ok++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' ' + d)); };
const MIG = 'supabase/migrations/20261010150000_beheertabellen_publieke_content.sql';
t('migratiebestand bestaat', existsSync(`${root}/${MIG}`));
const sql = readFileSync(`${root}/${MIG}`, 'utf8');
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const { collections } = await import(`${root}/src/data/collections.js`);

for (const [key, tabel] of [['videos', 'videos'], ['resources', 'resources'], ['sessions', 'sessions'], ['blog', 'blog_posts']]) {
  const c = collections.find((x) => x.key === key);
  t(`${tabel}: collectie wijst naar tabel`, c && c.table === tabel);
  t(`${tabel}: create table aanwezig`, new RegExp(`create table if not exists public\\.${tabel}\\b`).test(code));
  t(`${tabel}: RLS aan`, new RegExp(`alter table public\\.${tabel}\\s+enable row level security`).test(code));
  const tabelBlok = code.slice(code.indexOf(`create table if not exists public.${tabel}`)).split(');')[0];
  for (const f of c.fields) t(`${tabel}: kolom voor adminveld "${f.name}"`, new RegExp(`\\b${f.name}\\b`).test(tabelBlok));
  for (const k of ['id', 'status', 'published_at', 'created_at', 'updated_at']) t(`${tabel}: kolom ${k}`, new RegExp(`\\b${k}\\b`).test(tabelBlok));
  t(`${tabel}: status check draft/published`, /check \(status in \('draft', 'published'\)\)/.test(tabelBlok));
  t(`${tabel}: publieke policy alleen published`, new RegExp(`on public\\.${tabel} for select to anon, authenticated\\s+using \\(status = 'published'\\)`).test(code));
  t(`${tabel}: beheerpolicy via private.is_admin()`, new RegExp(`on public\\.${tabel} for all to authenticated\\s+using \\(\\(select private\\.is_admin\\(\\)\\)\\) with check \\(\\(select private\\.is_admin\\(\\)\\)\\)`).test(code));
  t(`${tabel}: publicatie-trigger`, new RegExp(`on public\\.${tabel}\\s+for each row execute function public\\.beheer_inhoud_set_publicatie`).test(code));
  t(`${tabel}: publieke sortering geconfigureerd`, Array.isArray(c.publicOrder) && c.publicOrder.length >= 1);
}
t('anon krijgt alleen SELECT', /grant select on table public\.videos, public\.resources, public\.sessions, public\.blog_posts to anon;/.test(code) && !/grant [^;]*(insert|update|delete)[^;]*to anon/i.test(code));
t('geen seed/demodata (geen INSERT)', !/\binsert\s+into\b/i.test(code));
t('geen DROP TABLE / DELETE / TRUNCATE', !/\b(drop table|delete from|truncate)\b/i.test(code));
t('raakt news_articles/vacancies/kompas niet aan', !/news_articles|vacancies|subsidie_kompas|funders|profiles\b(?!.*is_admin)/i.test(code.replace(/private\.is_admin\(\)/g, '')));
t('geen storage-bucket aangemaakt', !/storage\./i.test(code));
// Nieuws en vacatures houden hun bestaande sortering (geen publicOrder).
for (const k of ['news', 'vacancies']) t(`${k}: sortering ongewijzigd (geen publicOrder)`, !('publicOrder' in collections.find((x) => x.key === k)));
// Geen demo-fallback meer voor de vier types
const dc = await import(`${root}/src/features/website/defaultContent.js`);
for (const k of ['videos', 'resources', 'sessions', 'blogPosts']) t(`defaultContent.${k} leeg`, dc[k].length === 0);
t('vacatures-fallback ongewijzigd (6)', dc.vacancies.length === 6);
t('nieuws-fallback ongewijzigd (8)', dc.allNewsItems.length === 8);
// Links uit de admin: alleen http(s); javascript: en tekst zonder domein worden geblokkeerd.
const { veiligeLink } = await import(`${root}/src/data/collections.js`);
t('veiligeLink: https blijft', veiligeLink('https://a.nl/x.pdf') === 'https://a.nl/x.pdf');
t('veiligeLink: adres zonder protocol krijgt https://', veiligeLink('www.a.nl/x') === 'https://www.a.nl/x');
t('veiligeLink: javascript: geblokkeerd', veiligeLink('javascript:alert(1)') === '');
t('veiligeLink: tekst zonder domein geblokkeerd', veiligeLink('geen link') === '');
const res = collections.find((x) => x.key === 'resources').fields.find((f) => f.name === 'file_url');
t('resources: documentlink verplicht, zonder upload, met uitleg', res.required && res.upload === false && /Plak de link/.test(res.help));
const vid = collections.find((x) => x.key === 'videos').fields.find((f) => f.name === 'url');
t('videos: videolink zonder upload, met uitleg', vid.upload === false && /Plak de link/.test(vid.help));
console.log(`\nRESULTAAT: ${ok} OK, ${fail} FAIL`); process.exit(fail ? 1 : 0);
