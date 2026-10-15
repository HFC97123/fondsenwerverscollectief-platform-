// Fragmentzoeker (Fase C): de server vindt zelf de citaten; de B1-regels beslissen of ze iets bewijzen.
import { extractReadableText } from '../../supabase/functions/_shared/readableText.ts';
import { maakBronPagina, verifySourceEvidence, compareDatabaseAndWeb } from '../../supabase/functions/_shared/sourceEvidence.ts';
import { zoekFragmenten } from '../../supabase/functions/_shared/fragmentZoeker.ts';
import { verifieerBron } from '../../supabase/functions/_shared/verificationResult.ts';
import { check, gelijk, sectie, klaar, stand, html, omgeving, pagina as paginaSpec, OPENBAAR } from './hulp.mjs';

stand.naam = 'zoeker';

const VANDAAG = '2026-10-14';
const FONDS = { naam: 'Rotterdams Jongerencultuurfonds' };

async function bron(body, host = 'www.fonds-a.example.nl') {
  const url = `https://${host}/aanvragen`;
  const l = extractReadableText(html(body));

  return maakBronPagina({ ok: true, bronUrl: url, eindUrl: url, hostnaam: host, httpStatus: 200, contentType: 'text/html', tekst: '', bytes: 1, redirects: 0, duurMs: 1, dnsGepind: false }, l.text);
}

// Volledige route: zoeken -> B1-bewijs -> vergelijking. Geeft per veld de vergelijking terug.
async function volledig(body, db, financier = FONDS) {
  const p = await bron(body);
  const z = zoekFragmenten(p, db, VANDAAG);
  const b = await verifySourceEvidence(p, financier, z.claims);
  const uit = {};

  for (const veld of Object.keys(b.velden)) {
    if (veld === 'fondsnaam') continue;

    uit[veld] = compareDatabaseAndWeb(veld, z.claims[veld]?.db, b.velden[veld]);
  }

  for (const [veld, o] of Object.entries(z.oordelen)) if (!uit[veld]) uit[veld] = o;

  return { uit, z };
}

const NAAM = '<h1>Rotterdams Jongerencultuurfonds</h1>';

sectie('1. Deadline: gelijk aan de database -> confirmed met eigen citaat');
{
  const { uit, z } = await volledig(`${NAAM}<p>Aanvragen kan tot 12 november 2026.</p>`, { deadline: '2026-11-12' });

  check('citaat door de zoeker gevonden', (z.claims.deadline?.fragment ?? '').endsWith('Aanvragen kan tot 12 november 2026.') && z.claims.deadline.fragment.length <= 300, JSON.stringify(z.claims));
  check('B1 bevestigt, gelijk aan database', uit.deadline.status === 'confirmed' && uit.deadline.reden === 'ok|gelijk_aan_database', JSON.stringify(uit.deadline));
  check('fragment en hash aanwezig', !!uit.deadline.fragment && /^[0-9a-f]{64}$/.test(uit.deadline.fragment_sha256));
}

sectie('2. Deadline: afwijkend -> conflict met beide waarden');
{
  const { uit } = await volledig(`${NAAM}<p>De deadline voor aanvragen is 15 november 2026.</p>`, { deadline: '2026-11-12' });

  check('conflict', uit.deadline.status === 'conflict', JSON.stringify(uit.deadline));
  check('webwaarde, databasewaarde en citaat', uit.deadline.waarde === '2026-11-15' && uit.deadline.db_waarde === '2026-11-12' && /15 november 2026/.test(uit.deadline.fragment));

  const verleden = await volledig(`${NAAM}<p>De deadline voor aanvragen was 15 november 2025.</p>`, { deadline: '2026-11-12' });

  check('verouderde pagina (datum in het verleden) is geen conflict maar onzeker', verleden.uit.deadline.status === 'uncertain' && verleden.uit.deadline.reden === 'web_datum_verstreken', JSON.stringify(verleden.uit.deadline));

  const voorbehoud = await volledig(`${NAAM}<p>Naar verwachting is de deadline 15 november 2026.</p>`, { deadline: '2026-11-12' });

  check('voorbehoud in de zin: geen conflict', voorbehoud.uit.deadline.status === 'uncertain', JSON.stringify(voorbehoud.uit.deadline));

  const zonderContext = await volledig(`${NAAM}<p>Het jaarfeest is op 15 november 2026 in Rotterdam.</p>`, { deadline: '2026-11-12' });

  check('datum zonder deadlinecontext: geen conflict', zonderContext.uit.deadline.status === 'uncertain', JSON.stringify(zonderContext.uit.deadline));
}

sectie('3. Deadline: meerdere kandidaten, geen kandidaat, gelijk onder meerdere');
{
  const meer = await volledig(`${NAAM}<p>Eerste ronde: uiterlijk 15 november 2026 indienen.</p><p>Tweede ronde: uiterlijk 20 december 2026 indienen.</p>`, { deadline: '2026-11-12' });

  check('twee verschillende rondes zonder de databasedatum: onzeker, geen conflict', meer.uit.deadline.status === 'uncertain' && meer.uit.deadline.reden === 'meerdere_datumkandidaten', JSON.stringify(meer.uit.deadline));

  const metGelijk = await volledig(`${NAAM}<p>Eerste ronde: uiterlijk 12 november 2026 indienen.</p><p>Tweede ronde: uiterlijk 20 december 2026 indienen.</p>`, { deadline: '2026-11-12' });

  check('databasedatum staat bij een van de rondes: confirmed', metGelijk.uit.deadline.status === 'confirmed', JSON.stringify(metGelijk.uit.deadline));

  const geen = await volledig(`${NAAM}<p>Wij steunen jongeren in Rotterdam.</p>`, { deadline: '2026-11-12' });

  check('geen datum op de pagina: onzeker', geen.uit.deadline.status === 'uncertain' && geen.uit.deadline.reden === 'geen_datum_op_pagina_gevonden', JSON.stringify(geen.uit.deadline));

  const zonderJaar = await volledig(`${NAAM}<p>Aanvragen kan tot 12 november.</p>`, { deadline: '2026-11-12' });

  check('datum zonder jaar telt niet als bewijs', zonderJaar.uit.deadline.status === 'uncertain', JSON.stringify(zonderJaar.uit.deadline));

  const bereik = await volledig(`${NAAM}<p>Open van 1 september tot en met 12 november 2026.</p>`, { deadline: '2026-11-12' });

  check('"van 1 september tot en met 12 november 2026": de einddatum is een eenduidig citaat', bereik.uit.deadline.status === 'confirmed', JSON.stringify(bereik.uit.deadline));

  const geenDb = zoekFragmenten(await bron(`${NAAM}<p>Aanvragen kan tot 12 november 2026.</p>`), {}, VANDAAG);

  check('geen databasewaarde: niets gezocht, niets geclaimd', Object.keys(geenDb.claims).length === 0 && Object.keys(geenDb.oordelen).length === 0);
}

sectie('4. Bedragen: minimaal en maximaal in een zin, conflict, kandidaten');
{
  const { uit } = await volledig(`${NAAM}<p>U kunt minimaal &euro; 5.000 en maximaal &euro; 25.000 aanvragen per project.</p>`, { bedrag_min: 5000, bedrag_max: 25000 });

  check('minimaal bevestigd', uit.bedrag_min.status === 'confirmed' && uit.bedrag_min.reden === 'ok|gelijk_aan_database', JSON.stringify(uit.bedrag_min));
  check('maximaal bevestigd', uit.bedrag_max.status === 'confirmed' && uit.bedrag_max.reden === 'ok|gelijk_aan_database', JSON.stringify(uit.bedrag_max));
  check('de twee citaten zijn gescheiden (elk met precies een bedrag)', !/25\.000/.test(uit.bedrag_min.fragment) && !/5\.000 en/.test(uit.bedrag_max.fragment), `${uit.bedrag_min.fragment} || ${uit.bedrag_max.fragment}`);

  const conflict = await volledig(`${NAAM}<p>De bijdrage bedraagt maximaal &euro; 30.000 per aanvraag.</p>`, { bedrag_max: 25000 });

  check('afwijkend maximum met specifieke context: conflict', conflict.uit.bedrag_max.status === 'conflict' && conflict.uit.bedrag_max.db_waarde === '25000' && conflict.uit.bedrag_max.waarde === '30000', JSON.stringify(conflict.uit.bedrag_max));

  const meer = await volledig(`${NAAM}<p>Maximaal &euro; 10.000 voor kleine projecten.</p><p>Maximaal &euro; 50.000 voor grote projecten.</p>`, { bedrag_max: 25000 });

  check('twee verschillende maxima: onzeker', meer.uit.bedrag_max.status === 'uncertain' && meer.uit.bedrag_max.reden === 'meerdere_bedragkandidaten', JSON.stringify(meer.uit.bedrag_max));

  const losContext = await volledig(`${NAAM}<p>Wij hebben vorig jaar &euro; 30.000 uitgekeerd aan culturele projecten.</p>`, { bedrag_max: 25000 });

  check('bedrag zonder min/max-context: geen conflict', losContext.uit.bedrag_max.status === 'uncertain', JSON.stringify(losContext.uit.bedrag_max));

  const voorbehoud = await volledig(`${NAAM}<p>Het maximum is circa &euro; 30.000.</p>`, { bedrag_max: 25000 });

  check('"circa": geen conflict', voorbehoud.uit.bedrag_max.status === 'uncertain', JSON.stringify(voorbehoud.uit.bedrag_max));

  const nul = zoekFragmenten(await bron(`${NAAM}<p>Maximaal &euro; 25.000.</p>`), { bedrag_min: 0, bedrag_max: null }, VANDAAG);

  check('bedragen 0 of ontbrekend worden niet gezocht', Object.keys(nul.claims).length === 0);
}

sectie('5. Financier eerst, ook voor wat de zoeker vindt');
{
  const { uit } = await volledig('<h1>Een Ander Fonds</h1><p>Aanvragen kan tot 12 november 2026.</p>', { deadline: '2026-11-12' });

  check('financier niet op de pagina: deadline nooit confirmed', uit.deadline.status === 'uncertain' && uit.deadline.reden === 'financier_not_found', JSON.stringify(uit.deadline));
}

sectie('6. Verborgen en scripttekst telt niet; pathologische invoer');
{
  const verborgen = await volledig(`${NAAM}<div hidden><p>Aanvragen kan tot 12 november 2026.</p></div><script>var s="deadline 12 november 2026"</script>`, { deadline: '2026-11-12' });

  check('datum in verborgen element of script wordt niet gevonden', verborgen.uit.deadline.status === 'uncertain' && verborgen.uit.deadline.reden === 'geen_datum_op_pagina_gevonden', JSON.stringify(verborgen.uit.deadline));

  const veel = '<p>Aanvragen kan tot 12 november 2026.</p>'.repeat(20000);
  const t0 = performance.now();
  const r = await volledig(`${NAAM}${veel}`, { deadline: '2026-11-12', bedrag_max: 25000 });
  const ms = performance.now() - t0;

  check(`20.000 dezelfde zinnen: ${ms.toFixed(0)} ms (grens 3000) en nog steeds confirmed`, ms < 3000 && r.uit.deadline.status === 'confirmed');

  const bedragen = '€1 '.repeat(150000);
  const t1 = performance.now();
  const r2 = await volledig(`${NAAM}<p>${bedragen}</p>`, { bedrag_max: 25000 });
  const ms2 = performance.now() - t1;

  check(`150.000 bedragen: ${ms2.toFixed(0)} ms (grens 3000), begrensd en onzeker`, ms2 < 3000 && r2.uit.bedrag_max.status === 'uncertain', JSON.stringify(r2.uit.bedrag_max));

  const datums = '1 jan 2027 '.repeat(100000);
  const t2 = performance.now();
  const r3 = await volledig(`${NAAM}<p>${datums}</p>`, { deadline: '2026-11-12' });
  const ms3 = performance.now() - t2;

  check(`100.000 datums: ${ms3.toFixed(0)} ms (grens 3000), nooit confirmed`, ms3 < 3000 && r3.uit.deadline.status !== 'confirmed', JSON.stringify(r3.uit.deadline));

  const unicode = await volledig(`${NAAM}<p>İstanbul fonds: Aanvragen kan tot 12 november 2026.</p>`, { deadline: '2026-11-12' });

  check('tekst met een teken waarvan kleine letters een andere lengte hebben: veilig onzeker', ['uncertain', 'confirmed'].includes(unicode.uit.deadline.status));
}

sectie('7. Hook in verifieerBron: zoeker voedt dezelfde keten; geen toegang = geen zoeker');
{
  const host = 'www.fonds-a.example.nl';
  const url = `https://${host}/aanvragen`;
  const w = omgeving({ dns: { [host]: [OPENBAAR] }, paginas: { [url]: paginaSpec(`${NAAM}<p>De deadline voor aanvragen is 15 november 2026.</p>`) } });
  let aangeroepen = 0;
  const bepaalClaims = (p) => {
    aangeroepen += 1;

    return zoekFragmenten(p, { deadline: '2026-11-12' }, VANDAAG);
  };
  const deps = { resolveHost: w.resolveHost, fetchImpl: w.fetchImpl, datumNu: () => new Date('2026-10-14T10:00:00Z') };
  const u = await verifieerBron({ toegang: { zichtbaar: true }, verificatieId: 'z-1', bronUrl: url, financier: FONDS, claims: {}, bepaalClaims }, deps);

  check('conflict via de volledige keten, schema-geldig blok, samenvatting conflict', u.samenvatting === 'conflict' && u.verificatie.velden.deadline.status === 'conflict' && u.verificatie.velden.deadline.db_waarde === '2026-11-12', JSON.stringify(u.verificatie));

  const w2 = omgeving({ dns: { [host]: [OPENBAAR] }, paginas: { [url]: paginaSpec(NAAM) } });
  aangeroepen = 0;
  const u2 = await verifieerBron({ toegang: { zichtbaar: false }, bronUrl: url, financier: FONDS, claims: {}, bepaalClaims }, { resolveHost: w2.resolveHost, fetchImpl: w2.fetchImpl });

  check('zonder toegang wordt de zoeker niet aangeroepen en is er geen netwerk', aangeroepen === 0 && !u2.uitgevoerd && w2.calls.dns.length === 0 && w2.calls.fetch.length === 0);

  const w3 = omgeving({ dns: { [host]: [OPENBAAR] }, paginas: { [url]: paginaSpec(NAAM) } });
  const u3 = await verifieerBron({ toegang: { zichtbaar: true }, bronUrl: url, financier: FONDS, claims: {}, bepaalClaims: () => { throw new Error('stuk'); } }, { resolveHost: w3.resolveHost, fetchImpl: w3.fetchImpl });

  check('een zoeker die een fout gooit: geen throw, onverwachte_fout, niet_gecontroleerd', u3.categorie === 'onverwachte_fout' && u3.samenvatting === 'niet_gecontroleerd');
}

klaar('ZOEKER');
