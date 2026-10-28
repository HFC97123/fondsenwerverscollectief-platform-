// Aanvraag-assistent: bewaarde versies (concept en definitief) met nagebootste verbindingen. Geen maandruimte, alleen eigen versies, maximaal 20 per aanvraag.
//   node tests/aanvraag-assistent/run.mjs   (vanuit de repo-root)
import { verwerk, schoneOnderdelen, MAX_VERSIES } from '../../supabase/functions/_shared/aanvraagHandler.ts';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'aanvraag-versies';

const USER = '11111111-1111-4111-8111-111111111111';
const ANDER = '22222222-2222-4222-8222-222222222222';
const AANVRAAG = '44444444-4444-4444-8444-444444444444';
const ANDERE_AANVRAAG = '55555555-5555-4555-8555-555555555555';
const NU = new Date('2026-10-26T12:00:00Z');
const UUID = (n) => `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`;

function omgeving(opties = {}) {
  const o = { tier: 'premium', vlag: true, zonderVersieFuncties: false, ...opties };
  const log = { reserveringen: 0, modelAanroepen: 0 };
  const aanvragen = new Map([
    [AANVRAAG, { id: AANVRAAG, user: USER, soort: 'fonds', status: 'concept', definitieve_versie_id: null }],
    [ANDERE_AANVRAAG, { id: ANDERE_AANVRAAG, user: ANDER, soort: 'fonds', status: 'concept', definitieve_versie_id: null }],
  ]);
  const versies = new Map();
  let teller = 0;
  const deps = {
    modelNaam: 'test-model',
    nu: () => NU,
    vlagAan: () => o.vlag,
    userUitToken: async (t) => (t === 'goed-token' ? { id: USER } : t === 'ander-token' ? { id: ANDER } : null),
    leesProfiel: async () => ({ profiel: { subscription_tier: o.tier, subscription_active: o.tier !== 'free', trial_ends_at: null, role: 'user' }, storing: false }),
    rateLimitOk: async () => true,
    projectIsVanGebruiker: async () => true,
    telRijen: async () => 0,
    reserveer: async () => { log.reserveringen += 1; return { ok: true, id: 'r', gebruikt: 0 }; },
    planStand: async () => ({ gebruikt: 0, projectKlaar: false }),
    planReserveer: async () => { log.reserveringen += 1; return { ok: true, id: 'p', gebruikt: 0 }; },
    rondAf: async () => {},
    lijstAanvragen: async () => [],
    leesAanvraag: async () => null,
    bewaarAanvraag: async () => null,
    leesPlanBron: async () => null,
    slaBeoordelingOp: async () => null,
    haalPagina: async () => ({ ok: false, reden: 'niet-bereikbaar' }),
    roep: async () => { log.modelAanroepen += 1; throw new Error('geen model nodig'); },
    meldGebruik: async () => {},
  };

  if (!o.zonderVersieFuncties) {
    Object.assign(deps, {
      leesVersieStand: async (u, id) => { const a = aanvragen.get(id); return a && a.user === u ? { id: a.id, soort: a.soort, status: a.status, definitieve_versie_id: a.definitieve_versie_id } : null; },
      lijstVersies: async (u, id) => { const a = aanvragen.get(id); if (!a || a.user !== u) return []; return [...versies.values()].filter((v) => v.aanvraag_id === id).map(({ antwoorden, ...rest }) => rest).sort((x, y) => y.nummer - x.nummer); },
      leesVersie: async (u, id) => { const v = versies.get(id); return v && v.user_id === u ? { ...v } : null; },
      maakVersie: async (rij) => {
        teller += 1;
        const nummer = Math.max(0, ...[...versies.values()].filter((v) => v.aanvraag_id === rij.aanvraag_id).map((v) => v.nummer)) + 1;
        const v = { id: UUID(teller), aanvraag_id: rij.aanvraag_id, user_id: rij.user_id, nummer, naam: rij.naam, status: rij.status, herkomst: rij.herkomst, antwoorden: rij.antwoorden, beoordeling_id: null, created_at: NU.toISOString(), updated_at: NU.toISOString() };
        versies.set(v.id, v);
        return { ...v };
      },
      werkVersieBij: async (u, id, velden) => { const v = versies.get(id); if (!v || v.user_id !== u) return false; Object.assign(v, velden); return true; },
      verwijderVersie: async (u, id) => { const v = versies.get(id); if (!v || v.user_id !== u) return false; versies.delete(id); return true; },
      zetAanvraagStatus: async (u, id, velden) => { const a = aanvragen.get(id); if (!a || a.user !== u) return false; a.status = velden.status; if ('definitieve_versie_id' in velden) a.definitieve_versie_id = velden.definitieve_versie_id ?? null; return true; },
    });
  }

  return { deps, log, aanvragen, versies };
}

const vraag = (body, token = 'goed-token') => ({ method: 'POST', authorization: `Bearer ${token}`, bodyText: JSON.stringify(body) });
const tekst = [{ id: 'aanleiding', titel: 'Aanleiding', tekst: 'In Poelenburg groeit een kwart van de kinderen op met een laag inkomen.' }, { id: 'doelgroep', titel: 'Doelgroep', tekst: 'Wij bereiken 40 kinderen.' }];

sectie('1. Wie mag versies gebruiken?');
{
  const e = omgeving();
  gelijk('zonder token: 401', (await verwerk(vraag({ mode: 'versies', aanvraagId: AANVRAAG }, ''), e.deps)).status, 401);
  gelijk('Free: 403', (await verwerk(vraag({ mode: 'versies', aanvraagId: AANVRAAG }), omgeving({ tier: 'free' }).deps)).status, 403);
  gelijk('vlag uit: 404', (await verwerk(vraag({ mode: 'versies', aanvraagId: AANVRAAG }), omgeving({ vlag: false }).deps)).status, 404);
  const zonder = omgeving({ zonderVersieFuncties: true });
  gelijk('zonder opslagfuncties: 503, geen crash', (await verwerk(vraag({ mode: 'versies', aanvraagId: AANVRAAG }), zonder.deps)).status, 503);
  gelijk('andermans aanvraag: 404', (await verwerk(vraag({ mode: 'versies', aanvraagId: ANDERE_AANVRAAG }), e.deps)).status, 404);
  gelijk('ongeldig id: 400', (await verwerk(vraag({ mode: 'versies', aanvraagId: 'x' }), e.deps)).status, 400);
}

sectie('2. Een eerste versie bewaren en later bijwerken');
{
  const e = omgeving();
  let r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: tekst, herkomst: 'ai', naam: 'Eerste opzet' }), e.deps);
  gelijk('nieuwe versie: 200', r.status, 200);
  gelijk('nummer 1, concept', [r.body.versie.nummer, r.body.versie.status, r.body.nieuw], [1, 'concept', true]);
  check('herkomst komt van de server, niet van de client (lid)', r.body.versie.herkomst === 'lid');
  const id = r.body.versie.id;
  r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, versieId: id, antwoorden: [{ id: 'aanleiding', titel: 'Aanleiding', tekst: 'Aangepast.' }] }), e.deps);
  check('een concept wordt op zijn plaats bijgewerkt (zelfde id, geen nieuwe versie)', r.status === 200 && r.body.nieuw === false && r.body.versie.id === id && e.versies.size === 1);
  gelijk('de nieuwe tekst staat erin', e.versies.get(id).antwoorden[0].tekst, 'Aangepast.');
  check('de naam blijft behouden als er geen nieuwe is', e.versies.get(id).naam === 'Eerste opzet');
  r = await verwerk(vraag({ mode: 'versie', versieId: id }), e.deps);
  check('een versie ophalen geeft de antwoorden mee', r.status === 200 && r.body.versie.antwoorden.length === 1 && r.body.aanvraagStatus === 'concept');
  r = await verwerk(vraag({ mode: 'versies', aanvraagId: AANVRAAG }), e.deps);
  check('de lijst is licht: geen antwoorden', r.status === 200 && r.body.versies.length === 1 && !('antwoorden' in r.body.versies[0]) && r.body.maxVersies === MAX_VERSIES);
  check('bewaren kost geen maandruimte en geen model', e.log.reserveringen === 0 && e.log.modelAanroepen === 0);
}

sectie('3. Schoonmaken van wat de client stuurt');
{
  const e = omgeving();
  const r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: [{ id: 'a', titel: 'Kop\u0000 met\nregeleinde', tekst: 'Tekst met \u0000 nul en\r\nnieuwe regel' }] }), e.deps);
  const opgeslagen = e.versies.get(r.body.versie.id).antwoorden[0];
  check('geen nul-tekens (die zou de database weigeren)', !opgeslagen.tekst.includes('\u0000') && !opgeslagen.titel.includes('\u0000'));
  check('titel zonder regeleinden, tekst met genormaliseerde regeleinden', !/[\n\r]/.test(opgeslagen.titel) && opgeslagen.tekst.includes('\n') && !opgeslagen.tekst.includes('\r'));
  for (const [naam, antwoorden] of [
    ['lege lijst', []],
    ['geen lijst', 'tekst'],
    ['dubbel id', [{ id: 'a', titel: '', tekst: 'x' }, { id: 'a', titel: '', tekst: 'y' }]],
    ['ongeldig id', [{ id: 'a b!', titel: '', tekst: 'x' }]],
    ['tekst geen tekst', [{ id: 'a', titel: '', tekst: 5 }]],
    ['te lange tekst', [{ id: 'a', titel: '', tekst: 'x'.repeat(20001) }]],
    ['te veel onderdelen', Array.from({ length: 61 }, (_, i) => ({ id: `o${i}`, titel: '', tekst: 'x' }))],
    ['totaal te lang', Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, titel: '', tekst: 'x'.repeat(15000) }))],
  ]) {
    gelijk(`ongeldig wordt geweigerd: ${naam}`, (await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden }), e.deps)).status, 400);
  }
  check('een onderdeel zonder id mag (aanvraag zonder formulier)', schoneOnderdelen([{ titel: '', tekst: 'alles in één tekst' }]) !== null);
}

sectie('4. Definitief maken, verder werken en terug naar concept');
{
  const e = omgeving();
  let r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: [{ id: 'a', titel: '', tekst: '   ' }] }), e.deps);
  const leeg = r.body.versie.id;
  r = await verwerk(vraag({ mode: 'versie-wijzigen', versieId: leeg, actie: 'definitief' }), e.deps);
  gelijk('een lege versie kan niet definitief', [r.status, r.body.reden], [400, 'leeg']);
  r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, versieId: leeg, antwoorden: tekst }), e.deps);
  r = await verwerk(vraag({ mode: 'versie-wijzigen', versieId: leeg, actie: 'definitief' }), e.deps);
  check('definitief: versie en aanvraag staan op definitief en de aanvraag wijst naar de versie', r.status === 200 && e.versies.get(leeg).status === 'definitief' && e.aanvragen.get(AANVRAAG).status === 'definitief' && e.aanvragen.get(AANVRAAG).definitieve_versie_id === leeg);
  r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, versieId: leeg, antwoorden: [{ id: 'aanleiding', titel: 'Aanleiding', tekst: 'Weer iets anders' }] }), e.deps);
  check('verder werken na definitief maakt een nieuw concept, de definitieve blijft ongemoeid', r.body.nieuw === true && r.body.versie.nummer === 2 && e.versies.get(leeg).antwoorden.length === 2 && e.versies.get(leeg).status === 'definitief');
  check('de aanvraag staat weer op concept, de definitieve versie blijft aangewezen', e.aanvragen.get(AANVRAAG).status === 'concept' && e.aanvragen.get(AANVRAAG).definitieve_versie_id === leeg);
  const concept2 = r.body.versie.id;
  r = await verwerk(vraag({ mode: 'versie-wijzigen', versieId: concept2, actie: 'definitief' }), e.deps);
  check('een nieuwe definitieve versie vervangt de aanwijzing', r.status === 200 && e.aanvragen.get(AANVRAAG).definitieve_versie_id === concept2 && e.versies.get(leeg).status === 'definitief');
  r = await verwerk(vraag({ mode: 'versie-wijzigen', versieId: concept2, actie: 'concept' }), e.deps);
  check('terug naar concept: aanvraag op concept, versie blijft bewaard als definitief', r.status === 200 && e.aanvragen.get(AANVRAAG).status === 'concept' && e.versies.get(concept2).status === 'definitief');
  gelijk('andermans versie wijzigen: 404', (await verwerk(vraag({ mode: 'versie-wijzigen', versieId: concept2, actie: 'definitief' }, 'ander-token'), e.deps)).status, 404);
}

sectie('5. Hernoemen en verwijderen');
{
  const e = omgeving();
  let r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: tekst }), e.deps);
  const a = r.body.versie.id;
  r = await verwerk(vraag({ mode: 'versie-wijzigen', versieId: a, actie: 'hernoem', naam: '  Met begroting  ' }), e.deps);
  check('hernoemen', r.status === 200 && e.versies.get(a).naam === 'Met begroting');
  gelijk('lege naam: 400', (await verwerk(vraag({ mode: 'versie-wijzigen', versieId: a, actie: 'hernoem', naam: '  ' }), e.deps)).status, 400);
  gelijk('onbekende actie: 400', (await verwerk(vraag({ mode: 'versie-wijzigen', versieId: a, actie: 'wissen' }), e.deps)).status, 400);
  await verwerk(vraag({ mode: 'versie-wijzigen', versieId: a, actie: 'definitief' }), e.deps);
  r = await verwerk(vraag({ mode: 'versie-verwijderen', versieId: a }), e.deps);
  gelijk('de definitieve versie verwijderen mag niet', [r.status, r.body.reden], [409, 'definitief']);
  r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, versieId: a, antwoorden: tekst }), e.deps);
  const b = r.body.versie.id;
  gelijk('andermans versie verwijderen: 404', (await verwerk(vraag({ mode: 'versie-verwijderen', versieId: b }, 'ander-token'), e.deps)).status, 404);
  r = await verwerk(vraag({ mode: 'versie-verwijderen', versieId: b }), e.deps);
  check('een gewone versie verwijderen', r.status === 200 && !e.versies.has(b) && e.versies.has(a));
}

sectie('6. Maximaal 20 versies per aanvraag');
{
  const e = omgeving();
  const ids = [];
  for (let i = 0; i < MAX_VERSIES; i += 1) {
    const r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: [{ id: 'a', titel: '', tekst: `versie ${i + 1}` }] }), e.deps);
    ids.push(r.body.versie.id);
  }
  gelijk('20 versies', e.versies.size, 20);
  // Maak de eerste definitief en bewaar een 21e: het oudste concept (nummer 2) gaat weg, de definitieve (nummer 1) niet.
  await verwerk(vraag({ mode: 'versie-wijzigen', versieId: ids[0], actie: 'definitief' }), e.deps);
  const r = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: [{ id: 'a', titel: '', tekst: 'versie 21' }] }), e.deps);
  check('de 21e komt erbij; het aantal blijft 20', r.status === 200 && e.versies.size === 20);
  check('de definitieve versie blijft, het oudste concept (nummer 2) is weg', e.versies.has(ids[0]) && !e.versies.has(ids[1]));
  check('de nieuwste versie heeft nummer 21', r.body.versie.nummer === 21);

  // Alles definitief: er is niets om op te ruimen.
  const v = omgeving();
  for (let i = 0; i < MAX_VERSIES; i += 1) {
    const x = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: [{ id: 'a', titel: '', tekst: `v${i}` }] }), v.deps);
    v.versies.get(x.body.versie.id).status = 'definitief';
  }
  const vol = await verwerk(vraag({ mode: 'versie-bewaren', aanvraagId: AANVRAAG, antwoorden: [{ id: 'a', titel: '', tekst: 'nog een' }] }), v.deps);
  gelijk('alleen definitieve versies: 409 versies-vol', [vol.status, vol.body.reden], [409, 'versies-vol']);
}

klaar('aanvraag-versies');
