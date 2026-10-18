// Eén record (fonds of regeling) onderzoeken: pagina's vinden, ophalen, laten extraheren, controleren, rekenen.
import { basisDomein } from './ophalen.mjs';
import { kiesLinks, schoonUrl, zoekAdressen } from './zoeken.mjs';
import { bevatNaam, bouwExtractieBericht, jaarUitUrl, leesItems, MAX_PASSAGES_PER_AANROEP, selecteerPassages, verifieerItems } from './extractie.mjs';
import { berekenVoorstel } from './rekenen.mjs';

export const MAX_DOCUMENTEN = 14;

function hostVan(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function verwerkRecord(record, { ophaler, modelAanroep, zoekAan = false, apiKey = null, zoekModel = 'gpt-5.5', fetchImpl, startUrls = [], log = () => {}, huidigJaar = new Date().getFullYear() }) {
  const t0 = Date.now();
  const gezien = new Set();
  const documenten = [];
  const kosten = { modelAanroepen: 0, inputTokens: 0, outputTokens: 0, zoekAanroepen: 0, zoekInputTokens: 0, zoekOutputTokens: 0 };
  const items = [];
  const afgekeurd = [];
  const bronnen = [];
  const eigenDomein = record.website ? basisDomein(hostVan(record.website)) : null;

  async function neem(url, bronSoort) {
    const u = schoonUrl(url);
    if (!u || gezien.has(u) || documenten.length >= MAX_DOCUMENTEN) return null;
    gezien.add(u);
    const d = await ophaler.haal(u);
    const info = { url: u, soort: d.soort ?? null, ok: d.ok, fout: d.fout ?? null, tekens: d.tekst?.length ?? 0, bronSoort };
    documenten.push(info);
    if (!d.ok) return null;
    if (bronSoort === 'derde' && !bevatNaam(d.tekst + ' ' + (d.titel ?? ''), record.naam)) {
      info.overgeslagen = 'naam_niet_gevonden';
      return null;
    }
    info.eindUrl = d.eindUrl;
    await extraheer(d, bronSoort);
    return d;
  }

  async function extraheer(d, bronSoort) {
    const { passages } = selecteerPassages(d.tekst);
    if (!passages.length) return;
    const jaar = jaarUitUrl(d.eindUrl) ?? jaarUitUrl(d.url);
    for (let i = 0; i < passages.length; i += MAX_PASSAGES_PER_AANROEP) {
      const deel = passages.slice(i, i + MAX_PASSAGES_PER_AANROEP);
      let uit;
      try {
        uit = await modelAanroep(bouwExtractieBericht({ naam: record.naam, type: record.type, bronUrl: d.eindUrl, passages: deel }));
      } catch (e) {
        log(`  model mislukt (${e.message})`);
        continue;
      }
      kosten.modelAanroepen++;
      kosten.inputTokens += uit.usage?.prompt_tokens ?? 0;
      kosten.outputTokens += uit.usage?.completion_tokens ?? 0;
      const { geldig, afgekeurd: af } = verifieerItems(leesItems(uit.tekst), deel.join('\n'), { jaarUitUrl: jaar });
      for (const g of geldig) items.push({ ...g, bronUrl: d.eindUrl, bronSoort });
      for (const a of af) afgekeurd.push({ reden: a.reden, bronUrl: d.eindUrl });
    }
  }

  // 1) eigen site: startpagina en de meest belovende links
  const starts = [...new Set([...(record.website ? [record.website] : []), ...startUrls])];
  for (const s of starts) {
    const d = await neem(s, eigenDomein && basisDomein(hostVan(s)) === eigenDomein ? 'eigen' : 'derde');
    if (!d) continue;
    const niveau1 = kiesLinks(d.links, { basisUrl: d.eindUrl, gezien });
    for (const l of niveau1) {
      const d2 = await neem(l.url, 'eigen');
      if (!d2) continue;
      for (const l2 of kiesLinks(d2.links, { basisUrl: d2.eindUrl, minScore: 6, max: 3, gezien })) await neem(l2.url, 'eigen');
    }
  }

  // 2) webzoeken naar losse adressen als er geen site is of bijna niets gevonden werd
  const bedragenTot = () => items.filter((i) => i.soort === 'toekenning').length;
  if (zoekAan && apiKey && (!record.website || bedragenTot() < 5) && documenten.length < MAX_DOCUMENTEN) {
    try {
      const z = await zoekAdressen({ naam: record.naam, type: record.type, apiKey, model: zoekModel, fetchImpl });
      kosten.zoekAanroepen += z.zoekAanroepen;
      kosten.zoekInputTokens += z.usage?.input_tokens ?? 0;
      kosten.zoekOutputTokens += z.usage?.output_tokens ?? 0;
      for (const u of z.urls) {
        const dom = basisDomein(hostVan(u));
        const d = await neem(u, eigenDomein && dom === eigenDomein ? 'eigen' : 'derde');
        if (d && !record.website && !eigenDomein) {
          // zonder bekende site: pagina's waarvan de host de naam bevat tellen als eigen
          const toks = record.naam.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((x) => x.length > 3 && !['stichting', 'fonds', 'foundation'].includes(x));
          const info = documenten[documenten.length - 1];
          if (toks.some((x) => dom.replace(/[^a-z0-9]/g, '').includes(x))) info.bronSoort = 'eigen';
        }
      }
    } catch (e) {
      log(`  zoeken mislukt (${e.message})`);
    }
  }

  for (const it of items) {
    const doc = documenten.find((d) => d.url === it.bronUrl || d.eindUrl === it.bronUrl);
    it.bronSoort = doc?.bronSoort ?? it.bronSoort;
    if (!bronnen.some((b) => b.url === it.bronUrl)) bronnen.push({ url: it.bronUrl, eigen: it.bronSoort === 'eigen' });
  }

  const rek = berekenVoorstel({ items, bronnen, huidigJaar });
  return {
    id: record.id,
    type: record.type,
    naam: record.naam,
    website: record.website ?? null,
    documenten,
    bronnen,
    items,
    afgekeurdAantal: afgekeurd.length,
    afgekeurdRedenen: afgekeurd.reduce((m, a) => ((m[a.reden] = (m[a.reden] ?? 0) + 1), m), {}),
    ...rek,
    kosten,
    duurMs: Date.now() - t0,
    gelopenOp: new Date().toISOString(),
  };
}
