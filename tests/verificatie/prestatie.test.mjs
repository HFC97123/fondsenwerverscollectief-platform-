// Prestatiemeting van de verificatieketen (Fase B1). Meet CPU-tijd van tekstomzetting + bewijscontrole op realistische en kwaadaardige HTML.
// Doel: ruim onder de CPU-limiet van een Supabase Edge Function (2 s CPU-tijd per aanvraag, volgens de bekende limieten).
// De drempels hieronder zijn bewust ruim (vangnet tegen kwadratisch gedrag), de gemeten waarden staan in het rapport.
import { extractReadableText } from '../../supabase/functions/_shared/readableText.ts';
import { maakBronPagina, verifySourceEvidence } from '../../supabase/functions/_shared/sourceEvidence.ts';
import { verifieerBron } from '../../supabase/functions/_shared/verificationResult.ts';
import { check, sectie, klaar, stand, omgeving, OPENBAAR } from './hulp.mjs';

stand.naam = 'prestatie';

const KB = 1024;
const FONDS = { naam: 'Rotterdams Jongerencultuurfonds' };
const CLAIMS = {
  deadline: { waarde: '2026-11-12', fragment: 'Aanvragen kan tot 12 november 2026.', db: '2026-11-12' },
  bedrag_max: { waarde: 25000, fragment: 'Maximaal € 25.000 per aanvraag.', db: 25000 },
  bedrag_min: { waarde: 5000, fragment: 'Minimaal € 5.000 per project.', db: 5000 },
};

// Realistische pagina: navigatie, scripts, stijlen, formulieren, veel geneste markup, met de relevante tekst midden in de pagina.
function maakPagina(doelBytes) {
  const kern = '<h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Maximaal &euro; 25.000 per aanvraag.</p><p>Minimaal &euro; 5.000 per project.</p>';
  const blok = (i) =>
    `<div class="card c${i}" data-id="${i}"><nav><ul><li><a href="/pagina-${i}" title="Pagina ${i}">Link ${i}</a></li><li><a href="/x">Contact &amp; info</a></li></ul></nav>` +
    `<script>window.dataLayer=window.dataLayer||[];function g(){dataLayer.push(arguments)}g('js',new Date());var s="</div><p>niet zichtbaar ${i}</p>";</script>` +
    `<style>.c${i}{color:#${(i * 7919 % 0xffffff).toString(16).padStart(6, '0')};margin:0 auto}</style>` +
    `<p>Wij ondersteunen projecten voor jongeren in Rotterdam. Neem contact op voor meer informatie over de mogelijkheden (blok ${i}).</p>` +
    `<form><input type="text" name="q${i}" value="zoek"><select><option>a</option><option>b</option></select></form><!-- opmerking ${i} --></div>\n`;

  let s = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Aanvragen</title></head><body>';
  let i = 0;

  while (s.length < doelBytes / 2) s += blok(i++);
  s += kern;
  while (s.length < doelBytes - 20) s += blok(i++);

  return s + '</body></html>';
}

const mediaan = (lijst) => [...lijst].sort((a, b) => a - b)[Math.floor(lijst.length / 2)];

async function meet(html, herhaal = 5) {
  const tijden = [];
  let uit = null;

  for (let r = 0; r < herhaal; r++) {
    const t0 = performance.now();
    const l = extractReadableText(html);
    const p = await maakBronPagina({ ok: true, bronUrl: 'https://www.fonds-a.example.nl/a', eindUrl: 'https://www.fonds-a.example.nl/a', hostnaam: 'www.fonds-a.example.nl', httpStatus: 200, contentType: 'text/html', tekst: '', bytes: html.length, redirects: 0, duurMs: 1, dnsGepind: false }, l.text);
    const u = await verifySourceEvidence(p, FONDS, CLAIMS);

    tijden.push(performance.now() - t0);
    uit = { l, u };
  }

  return { ms: mediaan(tijden), max: Math.max(...tijden), uit };
}

sectie('1. Realistische pagina\'s op 100 KB, 500 KB en 1 MiB (de maximale body)');
const rapport = [];
{
  for (const [naam, grootte, drempel] of [['100 KB', 100 * KB, 400], ['500 KB', 500 * KB, 800], ['1 MiB', 1024 * KB, 1200]]) {
    const html = maakPagina(grootte);
    const m = await meet(html);

    rapport.push(`${naam}: invoer ${(html.length / KB).toFixed(0)} KB, mediaan ${m.ms.toFixed(1)} ms, max ${m.max.toFixed(1)} ms, leesbare tekst ${(m.uit.l.text.length / KB).toFixed(0)} KB`);
    check(`${naam}: mediaan ${m.ms.toFixed(1)} ms (drempel ${drempel} ms)`, m.ms < drempel);
    check(`  ${naam}: inhoud correct (naam en deadline confirmed, scriptinhoud niet in de tekst)`, m.uit.u.velden.fondsnaam.status === 'confirmed' && m.uit.u.velden.deadline.status === 'confirmed' && !m.uit.l.text.includes('niet zichtbaar') && !m.uit.l.text.includes('dataLayer'), JSON.stringify(m.uit.u.velden.deadline));
    check(`  ${naam}: bedragen confirmed`, m.uit.u.velden.bedrag_max.status === 'confirmed' && m.uit.u.velden.bedrag_min.status === 'confirmed');
  }
}

sectie('2. Kwaadaardige of pathologische invoer op maximale grootte (lineair gedrag)');
{
  const MAX = 1024 * KB;
  const gevallen = {
    'diep geneste verborgen divs': '<div hidden>'.repeat(Math.floor(MAX / 12)),
    'honderdduizenden open tags zonder sluiting': '<p>x'.repeat(Math.floor(MAX / 4)),
    'onafgesloten tag-haken': '<a '.repeat(Math.floor(MAX / 3)),
    'aanhalingsteken-vallen': '<a href="'.repeat(Math.floor(MAX / 9)),
    'enorme entiteitenreeks': '&amp;&#x41;&nbsp;&euro;'.repeat(Math.floor(MAX / 22)),
    'veel comments': '<!-- x -->'.repeat(Math.floor(MAX / 10)),
    'een gigantische tekstregel': 'woord '.repeat(Math.floor(MAX / 6)),
    'scripts zonder sluiting': '<script>'.repeat(Math.floor(MAX / 8)),
    'tabellen en spaties': ('<td>   \n\n\t  </td>').repeat(Math.floor(MAX / 20)),
  };

  for (const [naam, html] of Object.entries(gevallen)) {
    const t0 = performance.now();
    let l;
    let gegooid = false;

    try {
      l = extractReadableText(html);
      const p = await maakBronPagina({ ok: true, bronUrl: 'https://www.fonds-a.example.nl/a', eindUrl: 'https://www.fonds-a.example.nl/a', hostnaam: 'www.fonds-a.example.nl', httpStatus: 200, contentType: 'text/html', tekst: '', bytes: html.length, redirects: 0, duurMs: 1, dnsGepind: false }, l.text);

      await verifySourceEvidence(p, FONDS, CLAIMS);
    } catch {
      gegooid = true;
    }

    const ms = performance.now() - t0;

    rapport.push(`pathologisch "${naam}": ${(html.length / KB).toFixed(0)} KB, ${ms.toFixed(0)} ms${l?.truncated ? ' (begrensd)' : ''}`);
    check(`${naam}: geen throw`, !gegooid);
    check(`  ${naam}: ${ms.toFixed(0)} ms (drempel 1500 ms)`, ms < 1500);
  }
}

sectie('3. Groter dan de bovengrens wordt begrensd (invoer van 5 MiB)');
{
  const groot = maakPagina(5 * 1024 * KB);
  const t0 = performance.now();
  const l = extractReadableText(groot);
  const ms = performance.now() - t0;

  rapport.push(`invoer 5 MiB (ver boven de body-limiet): ${ms.toFixed(0)} ms, uitvoer ${(l.text.length / KB).toFixed(0)} KB`);
  check(`5 MiB invoer: ${ms.toFixed(0)} ms (drempel 2500 ms), uitvoer begrensd`, ms < 2500 && l.text.length <= 2_000_000);
}

sectie('4. Keten inclusief ophalen (nagebootst, streaming) op 1 MiB');
{
  const body = maakPagina(1000 * KB);
  const host = 'www.fonds-a.example.nl';
  const url = `https://${host}/aanvragen`;
  const w = omgeving({ dns: { [host]: [OPENBAAR] }, paginas: { [url]: { status: 200, contentType: 'text/html; charset=utf-8', body } } });
  const t0 = performance.now();
  const u = await verifieerBron({ toegang: { zichtbaar: true }, bronUrl: url, financier: FONDS, claims: CLAIMS }, { resolveHost: w.resolveHost, fetchImpl: w.fetchImpl });
  const ms = performance.now() - t0;

  rapport.push(`volledige keten 1000 KB (zonder echt netwerk): ${ms.toFixed(0)} ms, samenvatting ${u.samenvatting}`);
  check(`keten: ${ms.toFixed(0)} ms (drempel 1500 ms), geverifieerd`, ms < 1500 && u.samenvatting === 'geverifieerd', `${u.samenvatting} ${u.categorie}`);

  // Verdubbelen van de invoer verdubbelt de tijd ongeveer (lineair), geen kwadratische groei
  const tijd = async (n) => { const h = maakPagina(n); const a = performance.now(); extractReadableText(h); extractReadableText(h); return performance.now() - a; };

  await tijd(100 * KB);
  const t1 = await tijd(250 * KB);
  const t2 = await tijd(1000 * KB);
  const verhouding = t2 / Math.max(t1, 0.5);

  rapport.push(`schaling: 250 KB -> 1000 KB (4x invoer) kost ${verhouding.toFixed(1)}x tijd`);
  check(`schaling is ongeveer lineair (4x invoer kost ${verhouding.toFixed(1)}x tijd, grens 12x)`, verhouding < 12);
}

console.log('\nGEMETEN (Node/V8; Deno gebruikt dezelfde engine, absolute waarden op Supabase kunnen afwijken):');
for (const r of rapport) console.log('  ' + r);

klaar('PRESTATIE');
