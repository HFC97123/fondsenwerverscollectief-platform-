// Pagina's vinden waar toekenningen en bedragen kunnen staan. Beleid: eerst de eigen site (links met jaarverslag, projecten,
// toekenningen, ANBI), dan zo nodig een webzoekopdracht naar losse URL's. Zoeken levert ALLEEN adressen; alle inhoud komt uit
// de zelf opgehaalde pagina.
import { basisDomein } from './ophalen.mjs';

const POSITIEF = [
  [/jaarverslag|jaarbericht|jaarrekening|annual[-_ ]?report|impact[-_ ]?report|jaaroverzicht/i, 7],
  [/toekenning|toegekend|gehonoreerd|verleend|uitgekeerd|awarded|grants?[-_ ]?(made|awarded|list|overview)|funded[-_ ]?projects|projectenlijst|overzicht[-_ ]?projecten|ondersteunde[-_ ]?projecten|gesteunde/i, 6],
  [/anbi|publicatieplicht|financi[eë]el|financi[eë]n|cijfers|resultaten|transparantie/i, 4],
  [/projecten|projects|wat[-_ ]?we[-_ ]?steunen|onze[-_ ]?partners|partners|portfolio/i, 3],
  [/bedrag|hoeveel|maximaal|minimaal|voorwaarden|criteria|faq|veelgestelde|aanvragen|aanvraag|apply|guidelines|richtlijnen|how[-_ ]?to[-_ ]?apply/i, 3],
];
const NEGATIEF = /privacy|cookie|login|inloggen|nieuwsbrief|newsletter|vacature|career|contact|disclaimer|sitemap|facebook|twitter|linkedin|instagram|youtube|whatsapp|\/tag\/|\/category\/|\/wp-json|\/feed|\.(jpg|jpeg|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|mp3)(\?|$)/i;

export function scoreLink(link) {
  const hooi = `${link.url} ${link.tekst}`;
  if (NEGATIEF.test(hooi)) return 0;
  let s = 0;
  for (const [re, w] of POSITIEF) if (re.test(hooi)) s += w;
  if (/\.pdf(\?|$)/i.test(link.url)) s += 2;
  const j = /(20(2[2-9]))/.exec(link.url);
  if (j) s += 1;
  return s;
}

export function kiesLinks(links, { basisUrl, minScore = 3, max = 6, alleenZelfdeDomein = true, gezien = new Set() }) {
  const dom = basisDomein(new URL(basisUrl).hostname);
  return links
    .filter((l) => !gezien.has(l.url))
    .filter((l) => {
      try {
        return !alleenZelfdeDomein || basisDomein(new URL(l.url).hostname) === dom;
      } catch {
        return false;
      }
    })
    .map((l) => ({ ...l, score: scoreLink(l) }))
    .filter((l) => l.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

export function schoonUrl(u) {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) x.searchParams.delete(k);
    x.hash = '';
    return x.toString();
  } catch {
    return null;
  }
}

// Webzoeken via de Responses API met de gehoste web_search-tool (zoals de rest van het platform). Geeft ALLEEN adressen terug.
export async function zoekAdressen({ naam, type, apiKey, model = 'gpt-5.5', fetchImpl = globalThis.fetch, max = 6 }) {
  const wat = type === 'regeling' ? 'subsidieregeling' : 'fonds';
  const vraag = `Zoek webadressen voor het Nederlandse of internationale ${wat} "${naam}": (1) de officiële pagina of website, (2) jaarverslagen of jaarberichten (liefst PDF), (3) pagina's of artikelen die laten zien welke bedragen het per toekenning geeft of welke minimum- en maximumbedragen gelden. Antwoord met alleen een lijst webadressen.`;
  const res = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    // Zelfde aanroepvorm als de webverkenner van het platform: gpt-4o ondersteunt de web_search-tool op de Responses API niet, daarom gpt-5.5.
    body: JSON.stringify({ model, input: vraag, tools: [{ type: 'web_search' }], tool_choice: 'required', reasoning: { effort: 'low' }, max_output_tokens: 3000, store: false }),
  });
  if (!res.ok) throw new Error(`zoeken_http_${res.status}`);
  const j = await res.json();
  const urls = [];
  let zoekAanroepen = 0;
  for (const item of j.output ?? []) {
    if (item.type === 'web_search_call') zoekAanroepen++;
    for (const c of item.content ?? []) for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url) urls.push(a.url);
  }
  const uniek = [...new Set(urls.map(schoonUrl).filter(Boolean))];
  return { urls: uniek.slice(0, max), zoekAanroepen, usage: j.usage ?? null };
}
