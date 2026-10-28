import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'aanvraag-service';

const aanroepen = [];
let antwoord = { data: { ok: true }, error: null };
let tabelAntwoord = { data: null, error: null };
const filters = [];

globalThis.__supabase = {
  functions: { invoke: async (naam, opties) => { aanroepen.push({ naam, body: opties.body }); if (antwoord instanceof Error) throw antwoord; return antwoord; } },
  from(tabel) {
    const q = { tabel, select() { return q; }, eq(k, v) { filters.push([k, v]); return q; }, is(k, v) { filters.push([k, v]); return q; }, maybeSingle: async () => tabelAntwoord };
    filters.push(['tabel', tabel]);
    return q;
  },
};

const S = await import('../../src/data/services/aanvraagAssistent.js');

sectie('1. Wat naar de server gaat');
{
  await S.haalAssistentStatus();
  gelijk('status', aanroepen.at(-1), { naam: 'aanvraag-assistent', body: { mode: 'status' } });
  await S.haalCriteriaOp({ projectId: 'p1', fondsLabel: 'Fonds A', websiteUrls: ['https://a.nl', '', 'https://b.nl', 'https://c.nl'], formulierTekst: 'Vraag 1' });
  gelijk('criteria ophalen: maximaal twee adressen, geen lege', aanroepen.at(-1).body, { mode: 'eisen-ophalen', projectId: 'p1', fondsLabel: 'Fonds A', websiteUrls: ['https://a.nl', 'https://b.nl'], formulierTekst: 'Vraag 1' });
  await S.beoordeelAanvraag({ projectId: 'p1', aanvraagId: 'a1', aanvraagTekst: 'tekst', eisen: [{ id: 'e1' }], fondsLabel: 'F' });
  check('beoordelen met aanvraag', aanroepen.at(-1).body.mode === 'beoordelen' && aanroepen.at(-1).body.aanvraagId === 'a1');
  await S.beoordeelAanvraag({ projectId: 'p1', aanvraagTekst: 'tekst', eisen: [] });
  check('beoordelen zonder aanvraag stuurt geen aanvraagId mee', !('aanvraagId' in aanroepen.at(-1).body));
  await S.schrijfProjectplan({ projectId: 'p1' });
  check('algemeen plan: geen aanvraagId', aanroepen.at(-1).body.mode === 'plan-schrijven' && !('aanvraagId' in aanroepen.at(-1).body));
  await S.schrijfProjectplan({ projectId: 'p1', aanvraagId: 'a1' });
  gelijk('plan voor een fonds', aanroepen.at(-1).body, { mode: 'plan-schrijven', projectId: 'p1', aanvraagId: 'a1' });
  await S.bewaarCriteria({ aanvraagId: 'a1', criteria: 'geen lijst' });
  gelijk('criteria bewaren: altijd een lijst', aanroepen.at(-1).body.criteria, []);
  await S.haalVragen('a1');
  gelijk('vragen ophalen', aanroepen.at(-1).body, { mode: 'vragen', aanvraagId: 'a1' });
  await S.leesFormulier({ projectId: 'p1', aanvraagId: 'a1', formulierTekst: '1. Een vraag' });
  gelijk('formulier lezen: alleen de tekst gaat mee, geen bestand', aanroepen.at(-1).body, { mode: 'vragen-lezen', projectId: 'p1', aanvraagId: 'a1', formulierTekst: '1. Een vraag' });
  const voor = aanroepen.length;
  const leeg = await S.leesFormulier({ projectId: 'p1', aanvraagId: 'a1', formulierTekst: '' });
  check('formulier lezen zonder tekst gaat niet naar de server', leeg.ok === false && leeg.reden === 'ongeldig' && aanroepen.length === voor);
  await S.leesFormulier({ projectId: 'p1', aanvraagId: 'a1', afbeeldingen: ['data:image/jpeg;base64,QUJD', '', 5] });
  gelijk('formulier uit afbeeldingen: alleen de afbeeldingen gaan mee, lege delen niet', aanroepen.at(-1).body, { mode: 'vragen-lezen', projectId: 'p1', aanvraagId: 'a1', afbeeldingen: ['data:image/jpeg;base64,QUJD'] });
  await S.leesFormulier({ projectId: 'p1', aanvraagId: 'a1', formulierTekst: '1. Een vraag', afbeeldingen: ['data:image/jpeg;base64,QUJD'] });
  check('tekst en afbeeldingen kunnen samen mee', aanroepen.at(-1).body.formulierTekst === '1. Een vraag' && aanroepen.at(-1).body.afbeeldingen.length === 1);
  const voorFoto = aanroepen.length;
  const geenFoto = await S.leesFormulier({ projectId: 'p1', aanvraagId: 'a1', afbeeldingen: [] });
  check('zonder tekst en zonder afbeeldingen gaat het niet naar de server', geenFoto.ok === false && aanroepen.length === voorFoto);
  await S.bewaarVragen({ aanvraagId: 'a1', vragen: [{ id: 'v1', tekst: 'Een vraag', maxTekens: 800, geenLimiet: false }], bevestig: true, stukken: [{ id: 's1', tekst: 'ANBI-status' }] });
  gelijk('vragen bevestigen: de lijst, bevestig en de stukken', aanroepen.at(-1).body, { mode: 'vragen-bewaren', aanvraagId: 'a1', vragen: [{ id: 'v1', tekst: 'Een vraag', maxTekens: 800, geenLimiet: false }], bevestig: true, stukken: [{ id: 's1', tekst: 'ANBI-status' }] });
  await S.bewaarVragen({ aanvraagId: 'a1', vragen: [{ id: 'v1', tekst: 'Projectplan', maxTekens: null, geenLimiet: true }], bevestig: true, zonderFormulier: true });
  check('zonder formulier: de markering gaat mee naar de server', aanroepen.at(-1).body.zonderFormulier === true && aanroepen.at(-1).body.bevestig === true);
  await S.bewaarVragen({ aanvraagId: 'a1', vragen: [{ id: 'v1', tekst: 'Een vraag', maxTekens: 500, geenLimiet: false }], bevestig: true });
  check('met formulier: geen markering', !('zonderFormulier' in aanroepen.at(-1).body));
  await S.bewaarVragen({ aanvraagId: 'a1', stukken: [] });
  gelijk('alleen stukken bewaren stuurt geen vragen mee', aanroepen.at(-1).body, { mode: 'vragen-bewaren', aanvraagId: 'a1', stukken: [] });
  await S.bewaarVragen({ aanvraagId: 'a1', vragen: [{ id: 'v1', tekst: 'Een vraag', maxTekens: null, geenLimiet: false }] });
  check('zonder bevestig vraagt de service nooit om bevestigen', aanroepen.at(-1).body.bevestig === false);
  await S.schrijfAntwoorden({ projectId: 'p1', aanvraagId: 'a1' });
  gelijk('antwoorden schrijven voor alle vragen: geen vraagIds', aanroepen.at(-1).body, { mode: 'antwoorden-schrijven', projectId: 'p1', aanvraagId: 'a1' });
  await S.schrijfAntwoorden({ projectId: 'p1', aanvraagId: 'a1', vraagIds: ['v2'] });
  gelijk('antwoorden schrijven voor één vraag', aanroepen.at(-1).body.vraagIds, ['v2']);
  check('niets van abonnement of limieten gaat vanuit de client mee', aanroepen.every((a) => !/tier|limiet|abonnement|uitkomst|zekerheid/i.test(JSON.stringify(Object.keys(a.body)))));
}

sectie('2. Antwoorden en fouten');
{
  antwoord = { data: { ok: true, aanvragen: [] }, error: null };
  const ok = await S.haalAanvragen('p1');
  check('gelukt', ok.ok === true && Array.isArray(ok.antwoord.aanvragen));

  const voor = aanroepen.length;
  const geen = await S.haalAanvragen('');
  check('zonder projectId: geen aanroep, nette fout', geen.ok === false && geen.reden === 'ongeldig' && aanroepen.length === voor);
  check('zonder aanvraagId: geen aanroep', (await S.haalAanvraag('')).ok === false && aanroepen.length === voor);

  antwoord = { data: { ok: false }, error: null };
  check('antwoord zonder ok=true is een fout', (await S.haalAssistentStatus()).ok === false);
  antwoord = { data: null, error: null };
  check('leeg antwoord is een fout', (await S.haalAssistentStatus()).ok === false);
  antwoord = new Error('netwerk');
  const net = await S.haalAssistentStatus();
  check('uitzondering (netwerk) wordt een nette fout, nooit gegooid', net.ok === false && /Dit lukte nu niet/.test(net.melding));

  antwoord = { data: null, error: { context: { status: 404, json: async () => ({ ok: false, reden: 'niet-beschikbaar', error: 'Deze functie is nog niet beschikbaar.' }) } } };
  const uit = await S.haalAssistentStatus();
  check('functie uit (404): reden en status komen door', uit.ok === false && uit.reden === 'niet-beschikbaar' && uit.status === 404);

  antwoord = { data: null, error: { context: { status: 429, json: async () => ({ ok: false, reden: 'maand-op', error: 'U heeft deze maand al een plan laten schrijven.' }) } } };
  const op = await S.schrijfProjectplan({ projectId: 'p1' });
  check('maand op: de tekst van de server wordt getoond', op.reden === 'maand-op' && op.melding === 'U heeft deze maand al een plan laten schrijven.' && op.status === 429);

  antwoord = { data: null, error: { context: { status: 500, json: async () => ({ ok: false, error: 'x'.repeat(900) }) } } };
  check('een veel te lange servertekst wordt vervangen door de algemene melding', /Dit lukte nu niet/.test((await S.haalAssistentStatus()).melding));
  antwoord = { data: null, error: { message: 'kapot' } };
  check('fout zonder leesbare inhoud: algemene melding', /Dit lukte nu niet/.test((await S.haalAssistentStatus()).melding));
}

sectie('3. Een bewaarde beoordeling terugzien');
{
  tabelAntwoord = { data: { id: 'b1', uitkomst: 'eerst-aanvullen', eisen: [], resultaat: {} }, error: null };
  const r = await S.haalBeoordeling('b1');
  check('gelezen uit de eigen tabel op id (de tabel heeft geen verberg-kolom)', r.ok && r.beoordeling.id === 'b1' && filters.some(([k, v]) => k === 'tabel' && v === 'subsidie_kompas_aanvraag_beoordelingen') && filters.some(([k, v]) => k === 'id' && v === 'b1') && !filters.some(([k]) => k === 'verborgen_op'));
  tabelAntwoord = { data: null, error: { message: 'x' } };
  check('fout: ok=false, geen uitzondering', (await S.haalBeoordeling('b1')).ok === false);
  check('zonder id: ok=false', (await S.haalBeoordeling('')).ok === false);
}

klaar('aanvraag-service');
