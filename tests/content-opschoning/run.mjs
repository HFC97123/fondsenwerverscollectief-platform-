// Statische controle van de opschoning van voorbeeldcontent (oktober 2026).
//   node tests/content-opschoning/run.mjs   (vanuit de repo-root)
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lees = (p) => readFileSync(`${root}/${p}`, 'utf8');
let ok = 0, fail = 0;
const t = (n, c, d = '') => { c ? ok++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' ' + d)); };

const dc = await import(`${root}/src/features/website/defaultContent.js`);
for (const k of ['resources', 'sessions', 'blogPosts', 'videos']) t(`defaultContent.${k} is leeg`, Array.isArray(dc[k]) && dc[k].length === 0, JSON.stringify(dc[k]?.length));
// Buiten scope: moeten ongewijzigd blijven
t('vacatures ongewijzigd (6)', dc.vacancies.length === 6, String(dc.vacancies.length));
t('newsItems ongewijzigd (3)', dc.newsItems.length === 3, String(dc.newsItems.length));
t('allNewsItems ongewijzigd (8)', dc.allNewsItems.length === 8, String(dc.allNewsItems.length));
t('CHAT_SYSTEM_PROMPT aanwezig', typeof dc.CHAT_SYSTEM_PROMPT === 'string' && dc.CHAT_SYSTEM_PROMPT.length > 100);

// Geen voorbeeldtitels meer in de broncode van de website
const bron = ['src/features/website/defaultContent.js', 'src/features/website/NetwerkPage.jsx', 'src/features/website/OrientPage.jsx', 'src/features/website/WebsiteProvider.jsx'].map(lees).join('\n');
for (const s of ['Projectplan sjabloon', 'Wat doet een fondsenwerver eigenlijk', 'Wat we leerden van vijf afgewezen aanvragen'])
  t(`geen voorbeeldtitel "${s}"`, !bron.includes(s));

// (Het voorbeeld 'Intervisie: lastige casussen bespreken' staat nog alleen als invoer-placeholder in het voorstelformulier voor leden; dat is geen getoonde inhoud.)
// Lege staten + beheer blijven bestaan
t('NetwerkPage heeft lege staat voor tools/resources', /!hasResources/.test(lees('src/features/website/NetwerkPage.jsx')));
t('OrientPage heeft lege staat voor video\'s', /!hasVideos/.test(lees('src/features/website/OrientPage.jsx')));
const col = lees('src/data/collections.js');
for (const k of ["table: 'videos'", "table: 'resources'", "table: 'sessions'", "table: 'blog_posts'", "table: 'news_articles'", "table: 'vacancies'"]) t(`admin-collectie blijft: ${k}`, col.includes(k));
console.log(`\nRESULTAAT: ${ok} OK, ${fail} FAIL`); process.exit(fail ? 1 : 0);
