// Aanvraag-assistent: het formulier van een fonds (vragen met tekenlimiet, stukken) en antwoorden schrijven, met nagebootste verbindingen.
//   node tests/aanvraag-assistent/run.mjs   (vanuit de repo-root)
import { verwerk } from '../../supabase/functions/_shared/aanvraagHandler.ts';
import { leesVragen, schoneVragen, schoneStukken, sectiesUitVragen, standaardStukken, MAX_HERSCHRIJVEN_PER_MAAND } from '../../supabase/functions/_shared/aanvraagVragen.ts';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'aanvraag-vragen';

const USER = '11111111-1111-4111-8111-111111111111';
const ANDER = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const AANVRAAG = '44444444-4444-4444-8444-444444444444';
const ANDERE_AANVRAAG = '55555555-5555-4555-8555-555555555555';
const FORMULIER = `Aanvraagformulier Cultuurfonds
1. Beschrijf de aanleiding en het doel van uw project (maximaal 1500 tekens).
2. Wie is de doelgroep en hoeveel mensen bereikt u? Maximaal 250 woorden.
3. Hoe wordt het project gefinancierd? Noem uw eigen bijdrage.
Naam contactpersoon: ____
Voeg bij uw aanvraag een begroting en de jaarrekening van het laatste boekjaar (niet ouder dan 12 maanden) toe.`;
const PLANBRON = {
  project: { naam: 'Samen Spelen', omschrijving: 'Sport en spel voor kinderen in Rotterdam-Zuid.', doelgroep: 'Kinderen van 6 tot 12 jaar', doelstellingen: 'Kinderen bewegen meer en leren samenwerken.', activiteiten: 'Wekelijkse sportlessen en een zomerkamp.', begroting: 40000, gevraagd: 25000, regio: 'Rotterdam-Zuid', impact: 'Kinderen bewegen meer.', planning: 'Januari tot en met december 2027.' },
  info: { aanleiding: 'In de wijk zijn weinig plekken om veilig te spelen.', borging: 'De gemeente neemt de lessen na twee jaar over.' },
  organisatie: { name: 'Stichting Samen Spelen', rechtsvorm: 'stichting', opgericht: 2015, mission: 'Elk kind verdient een plek om te spelen.' },
};

let nu = new Date('2026-10-26T12:00:00Z');

function omgeving(opties = {}) {
  const o = { tier: 'pro', zonderVragenFuncties: false, modelFaalt: false, vragenAntwoord: null, ...opties };
  const log = { reserveringen: [], afgerond: [], modelAanroepen: 0, gebruik: [], tellingBeoordelingen: 0 };
  const aanvragen = new Map([
    [AANVRAAG, { id: AANVRAAG, user: USER, program_id: PROJECT, soort: 'fonds', fonds_label: 'Cultuurfonds', criteria: [{ id: 'e1', tekst: 'Past bij het doel van het fonds', soort: 'criterium', gewicht: 2, bronType: 'website', bronStuk: 'x', zekerheid: 'middel' }], vragen: null, stukken: null, schrijf_maand: null, schrijf_aantal: 0 }],
    [ANDERE_AANVRAAG, { id: ANDERE_AANVRAAG, user: ANDER, program_id: PROJECT, soort: 'fonds', fonds_label: 'Ander', criteria: [], vragen: null, stukken: null, schrijf_maand: null, schrijf_aantal: 0 }],
  ]);
  let teller = 0;
  const deps = {
    modelNaam: 'test-model',
    nu: () => nu,
    vlagAan: () => true,
    userUitToken: async (t) => (t === 'goed-token' ? { id: USER } : t === 'ander-token' ? { id: ANDER } : null),
    leesProfiel: async () => ({ profiel: { subscription_tier: o.tier, subscription_active: o.tier !== 'free', trial_ends_at: null, role: 'user' }, storing: false }),
    rateLimitOk: async () => true,
    projectIsVanGebruiker: async (p, u) => p === PROJECT && (u === USER || u === ANDER),
    telRijen: async (u, soort) => (soort === 'beoordelingen' ? log.reserveringen.filter((r) => r.soort === 'beoordelingen' && log.afgerond.find((a) => a.id === r.id)?.succes).length + log.tellingBeoordelingen : log.reserveringen.filter((r) => r.soort === soort && log.afgerond.find((a) => a.id === r.id)?.succes).length),
    reserveer: async (u, soort, limiet) => {
      const gebruikt = log.reserveringen.filter((r) => r.soort === soort && log.afgerond.find((a) => a.id === r.id)?.succes).length + (soort === 'beoordelingen' ? log.tellingBeoordelingen : 0);

      if (gebruikt >= limiet) return { ok: false, reden: 'maand-op', gebruikt };

      teller += 1;
      log.reserveringen.push({ id: `r${teller}`, soort });

      return { ok: true, id: `r${teller}`, gebruikt };
    },
    planStand: async () => ({ gebruikt: 0, projectKlaar: false }),
    planReserveer: async () => ({ ok: false, reden: 'storing' }),
    rondAf: async (id, u, succes) => { log.afgerond.push({ id, succes }); },
    lijstAanvragen: async () => [],
    leesAanvraag: async () => null,
    bewaarAanvraag: async () => null,
    leesPlanBron: async () => PLANBRON,
    slaBeoordelingOp: async () => null,
    haalPagina: async () => ({ ok: false, reden: 'niet-bereikbaar' }),
    roep: async (systeem, gebruiker) => {
      log.modelAanroepen += 1;

      if (o.modelFaalt) return null;

      if (/Je haalt uit de tekst van het aanvraagformulier/.test(systeem)) {
        return {
          inhoud: JSON.stringify(
            o.vragenAntwoord ?? {
              vragen: [
                { vraag: 'Beschrijf de aanleiding en het doel van uw project.', bronstuk: '1. Beschrijf de aanleiding en het doel van uw project (maximaal 1500 tekens).', maxTekens: 1500 },
                { vraag: 'Wie is de doelgroep en hoeveel mensen bereikt u?', bronstuk: 'Wie is de doelgroep en hoeveel mensen bereikt u? Maximaal 250 woorden.', maxTekens: 1500 },
                { vraag: 'Hoe wordt het project gefinancierd? Noem uw eigen bijdrage.', bronstuk: 'Hoe wordt het project gefinancierd? Noem uw eigen bijdrage.', maxTekens: null },
                { vraag: 'Een vraag die er niet staat', bronstuk: 'Deze zin staat niet in het formulier', maxTekens: 500 },
              ],
              stukken: [
                { stuk: 'Begroting', bronstuk: 'Voeg bij uw aanvraag een begroting', maxLeeftijdMaanden: null },
                { stuk: 'Jaarrekening', bronstuk: 'de jaarrekening van het laatste boekjaar (niet ouder dan 12 maanden)', maxLeeftijdMaanden: 12 },
                { stuk: 'Verzonnen stuk', bronstuk: 'staat nergens', maxLeeftijdMaanden: null },
              ],
            },
          ),
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        };
      }

      if (/Je schrijft één onderdeel/.test(systeem)) {
        const inv = JSON.parse(gebruiker);

        return { inhoud: JSON.stringify({ tekst: `${inv.feiten[0].tekst} Dit antwoord hoort bij: ${inv.onderdeel.titel.slice(0, 20)}.`, gebruikt: [inv.feiten[0].id], vragen: [] }), usage: { prompt_tokens: 10, completion_tokens: 5 } };
      }

      throw new Error('onbekende modelvraag');
    },
    meldGebruik: async (m) => { log.gebruik.push(m); },
  };

  if (!o.zonderVragenFuncties) {
    Object.assign(deps, {
      leesVragenStand: async (u, id) => {
        const a = aanvragen.get(id);

        return a && a.user === u ? { id: a.id, program_id: a.program_id, soort: a.soort, fonds_label: a.fonds_label, criteria: a.criteria, vragen: a.vragen, stukken: a.stukken, schrijf_maand: a.schrijf_maand, schrijf_aantal: a.schrijf_aantal } : null;
      },
      bewaarVragenStukken: async (u, id, velden) => {
        const a = aanvragen.get(id);

        if (!a || a.user !== u) return false;

        Object.assign(a, velden);

        return true;
      },
    });
  }

  return { deps, log, aanvragen };
}

const vraag = (body, token = 'goed-token') => ({ method: 'POST', authorization: `Bearer ${token}`, bodyText: JSON.stringify(body) });
const lezen = (e, extra = {}) => verwerk(vraag({ mode: 'vragen-lezen', projectId: PROJECT, aanvraagId: AANVRAAG, formulierTekst: FORMULIER, ...extra }), e.deps);

sectie('1. Het formulier lezen: alleen wat letterlijk in de tekst staat');
{
  const ruw = {
    vragen: [
      { vraag: 'Beschrijf de aanleiding.', bronstuk: '1. Beschrijf de aanleiding en het doel van uw project (maximaal 1500 tekens).', maxTekens: 1500 },
      { vraag: 'Doelgroep?', bronstuk: 'Wie is de doelgroep en hoeveel mensen bereikt u? Maximaal 250 woorden.', maxTekens: 1500 },
      { vraag: 'Financiering?', bronstuk: 'Hoe wordt het project gefinancierd?', maxTekens: 999 },
      { vraag: 'Verzonnen vraag', bronstuk: 'Dit staat niet in het formulier', maxTekens: 100 },
      { vraag: 'Doelgroep?', bronstuk: 'Wie is de doelgroep en hoeveel mensen bereikt u?', maxTekens: null },
      { vraag: 'x', bronstuk: 'Naam contactpersoon', maxTekens: null },
    ],
    stukken: [
      { stuk: 'Begroting', bronstuk: 'Voeg bij uw aanvraag een begroting', maxLeeftijdMaanden: null },
      { stuk: 'Jaarrekening', bronstuk: 'de jaarrekening van het laatste boekjaar (niet ouder dan 12 maanden)', maxLeeftijdMaanden: 6 },
      { stuk: 'Statuten', bronstuk: 'staat nergens', maxLeeftijdMaanden: null },
    ],
  };
  const u = leesVragen(ruw, FORMULIER);

  gelijk('3 geldige vragen, de verzonnen en de te korte vallen weg', u.vragen.map((v) => v.tekst), ['Beschrijf de aanleiding.', 'Doelgroep?', 'Financiering?']);
  gelijk('tekenlimiet uit het bronstuk (1500 tekens) wordt overgenomen', u.vragen[0].maxTekens, 1500);
  gelijk('250 woorden staat in het bronstuk: 1500 tekens (maal 6) wordt overgenomen', u.vragen[1].maxTekens, 1500);
  gelijk('een limiet die niet in het bronstuk staat (999) wordt null: wij verzinnen geen limiet', u.vragen[2].maxTekens, null);
  gelijk('ids lopen op in de volgorde van het formulier', u.vragen.map((v) => v.id), ['v1', 'v2', 'v3']);
  gelijk('statistiek: 1 zonder geldig bronstuk + 1 te korte, 1 dubbel', [u.stat.zonderGeldigBronstuk, u.stat.dubbel], [2, 1]);
  check('niemand heeft een limiet gekozen: nog niets "geen limiet"', u.vragen.every((v) => v.geenLimiet === false));
  gelijk('de lijst met stukken begint met de 4 standaardstukken', u.stukken.slice(0, 4).map((s) => s.sleutel), ['anbi', 'statuten', 'jaarrekening', 'jaarverslag']);
  check('een stuk uit het formulier komt erbij, met bron formulier', u.stukken.some((s) => s.tekst === 'Begroting' && s.bron === 'formulier'));
  check('een stuk zonder bronstuk wordt genegeerd', !u.stukken.some((s) => s.tekst === 'Statuten' && s.bron === 'formulier') && u.stukken.length === 5);
  gelijk('jaarrekening staat al in de standaardlijst: niet dubbel, de leeftijd uit het formulier geldt niet over 12 maanden heen (12 blijft)', [u.stukken.filter((s) => s.sleutel === 'jaarrekening').length, u.stukken.find((s) => s.sleutel === 'jaarrekening').maxLeeftijdMaanden], [1, 12]);
  check('onleesbaar antwoord geeft lege lijsten, geen crash', leesVragen('rommel', FORMULIER).vragen.length === 0 && leesVragen(null, FORMULIER).stukken.length === 4);
  gelijk('standaardStukken: 4 stukken, ids s1..s4', standaardStukken().map((s) => s.id), ['s1', 's2', 's3', 's4']);
}

sectie('2. Wat het lid terugstuurt: tekenlimiet is verplicht');
{
  const l = [{ id: 'v1', tekst: 'Beschrijf het project', maxTekens: 1500 }, { id: 'v2', tekst: 'Doelgroep en bereik', maxTekens: null, geenLimiet: true }];
  const ok = schoneVragen(l, true);

  check('met limiet of "geen limiet" bij elke vraag: bevestigd', ok && ok.bevestigd === true && ok.lijst.length === 2);
  gelijk('bij "geen limiet" is maxTekens null', ok.lijst[1].maxTekens, null);
  gelijk('zonder limiet bij een vraag: bevestigen mislukt', schoneVragen([{ id: 'v1', tekst: 'Beschrijf het project' }], true), null);
  const los = schoneVragen([{ id: 'v1', tekst: 'Beschrijf het project' }], false);

  check('zonder bevestigen mag een lijst zonder limieten wel bewaard worden (onbevestigd)', los && los.bevestigd === false);
  for (const [naam, inv] of [['geen lijst', 'x'], ['lege lijst', []], ['te korte vraag', [{ tekst: 'ab', maxTekens: 5 }]], ['limiet nul', [{ tekst: 'Een vraag', maxTekens: 0 }]], ['limiet te groot', [{ tekst: 'Een vraag', maxTekens: 999999999 }]], ['te veel vragen', Array.from({ length: 41 }, () => ({ tekst: 'Een vraag', maxTekens: 5 }))]]) {
    gelijk(`ongeldig: ${naam}`, schoneVragen(inv, false), null);
  }
  const ids = schoneVragen([{ id: 'v1', tekst: 'Een vraag', maxTekens: 5 }, { id: 'v1', tekst: 'Nog een vraag', maxTekens: 5 }, { tekst: 'Zonder id', maxTekens: 5 }], false);

  gelijk('dubbele of ontbrekende ids worden uniek gemaakt', ids.lijst.map((v) => v.id), ['v1', 'v2', 'v3']);
  const s = schoneStukken([{ tekst: 'ANBI-status', bron: 'standaard', sleutel: 'anbi', klaar: true, documentNaam: 'anbi.pdf' }, { tekst: 'Eigen stuk', bron: 'raar', sleutel: 'onzin', klaar: 'ja' }]);

  check('stukken: bron en sleutel worden gecontroleerd, "klaar" alleen als echt waar', s && s[0].klaar === true && s[0].documentNaam === 'anbi.pdf' && s[1].bron === 'lid' && s[1].sleutel === null && s[1].klaar === false);
  gelijk('stukken: een stuk zonder tekst is ongeldig', schoneStukken([{ tekst: '' }]), null);
  gelijk('sectiesUitVragen: titel, limiet en volgorde', sectiesUitVragen([{ id: 'v1', tekst: 'Eerste', maxTekens: 800, geenLimiet: false }, { id: 'v2', tekst: 'Tweede', maxTekens: null, geenLimiet: true }]).map((d) => [d.id, d.maxTekens ?? null]), [['v1', 800], ['v2', null]]);
  gelijk('sectiesUitVragen met een keuze', sectiesUitVragen([{ id: 'v1', tekst: 'Eerste', maxTekens: 800, geenLimiet: false }, { id: 'v2', tekst: 'Tweede', maxTekens: null, geenLimiet: true }], ['v2']).map((d) => d.id), ['v2']);
}

sectie('3. Wie mag dit? En zonder opslagfuncties?');
{
  const e = omgeving();
  gelijk('zonder token: 401', (await verwerk(vraag({ mode: 'vragen', aanvraagId: AANVRAAG }, ''), e.deps)).status, 401);
  gelijk('Free: 403', (await verwerk(vraag({ mode: 'vragen', aanvraagId: AANVRAAG }), omgeving({ tier: 'free' }).deps)).status, 403);
  gelijk('zonder opslagfuncties: 503, geen crash', (await verwerk(vraag({ mode: 'vragen', aanvraagId: AANVRAAG }), omgeving({ zonderVragenFuncties: true }).deps)).status, 503);
  gelijk('andermans aanvraag: 404', (await verwerk(vraag({ mode: 'vragen', aanvraagId: ANDERE_AANVRAAG }), e.deps)).status, 404);
  gelijk('ongeldig id: 400', (await verwerk(vraag({ mode: 'vragen', aanvraagId: 'x' }), e.deps)).status, 400);
  const r = await verwerk(vraag({ mode: 'vragen', aanvraagId: AANVRAAG }), e.deps);

  check('nog geen vragen: de standaardstukken komen mee', r.status === 200 && r.body.vragen === null && r.body.stukken.length === 4);
  gelijk('een formulier lezen voor andermans aanvraag: 404', (await verwerk(vraag({ mode: 'vragen-lezen', projectId: PROJECT, aanvraagId: ANDERE_AANVRAAG, formulierTekst: FORMULIER }), e.deps)).status, 404);
}

sectie('4. Een formulier lezen en het resultaat bewaren');
{
  const e = omgeving();
  gelijk('te korte tekst: 400', (await lezen(e, { formulierTekst: 'kort' })).status, 400);
  gelijk('te lange tekst: 413', (await lezen(e, { formulierTekst: 'x'.repeat(40_001) })).status, 413);
  gelijk('een ander project dan de aanvraag: 404', (await verwerk(vraag({ mode: 'vragen-lezen', projectId: '66666666-6666-4666-8666-666666666666', aanvraagId: AANVRAAG, formulierTekst: FORMULIER }), e.deps)).status, 404);
  const r = await lezen(e);

  gelijk('200 en 3 vragen (de verzonnen vraag valt weg)', [r.status, r.body.vragen.lijst.length], [200, 3]);
  check('de lijst is nog niet bevestigd', r.body.vragen.bevestigd === false);
  check('er is een limiet gevonden (1500) en bij de derde vraag niet: het lid moet die invullen', r.body.vragen.lijst[0].maxTekens === 1500 && r.body.vragen.lijst[2].maxTekens === null);
  check('de stukken: 4 standaard plus de begroting uit het formulier', r.body.stukken.length === 5 && r.body.stukken.some((s) => s.tekst === 'Begroting'));
  check('het resultaat is bewaard bij de aanvraag', e.aanvragen.get(AANVRAAG).vragen.lijst.length === 3 && e.aanvragen.get(AANVRAAG).stukken.length === 5);
  check('het formulier zelf is nergens bewaard', !JSON.stringify([...e.aanvragen.values()]).includes('Aanvraagformulier Cultuurfonds') && !JSON.stringify(e.log.gebruik).includes('Beschrijf de aanleiding'));
  check('het kostte één formulierlezing, niet een beoordeling', e.log.reserveringen.length === 1 && e.log.reserveringen[0].soort === 'eisen');
  check('gebruik is gelogd als aanvraag_vragen, gelukt', e.log.gebruik.length === 1 && e.log.gebruik[0].actie === 'aanvraag_vragen' && e.log.gebruik[0].succes === true);

  const leeg = omgeving({ vragenAntwoord: { vragen: [], stukken: [] } });
  const l = await lezen(leeg);

  gelijk('geen vragen gevonden: 422 geen-vragen', [l.status, l.body.reden], [422, 'geen-vragen']);
  check('en dat telt niet mee (afgerond als mislukt), er is niets bewaard', leeg.log.afgerond[0].succes === false && leeg.aanvragen.get(AANVRAAG).vragen === null);
  const stuk = omgeving({ modelFaalt: true });
  const m = await lezen(stuk);

  gelijk('modelstoring: 502 ai-mislukt, telt niet mee', [m.status, m.body.reden, stuk.log.afgerond[0].succes], [502, 'ai-mislukt', false]);
}

sectie('5. De vragenlijst bevestigen: eerst de tekenlimiet');
{
  const e = omgeving();
  await lezen(e);
  const lijst = e.aanvragen.get(AANVRAAG).vragen.lijst;
  let r = await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, vragen: lijst, bevestig: true }), e.deps);

  gelijk('bevestigen zonder limiet bij vraag 3: 400 limiet', [r.status, r.body.reden], [400, 'limiet']);
  check('de tekst zegt dat wij zonder limiet niet kunnen helpen', /Zonder tekenlimiet/.test(r.body.error));
  check('en de lijst is niet bevestigd', e.aanvragen.get(AANVRAAG).vragen.bevestigd === false);
  r = await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, vragen: lijst.map((v, i) => (i === 2 ? { ...v, maxTekens: 800 } : v)), bevestig: true }), e.deps);
  check('met een limiet bij elke vraag: bevestigd', r.status === 200 && r.body.vragen.bevestigd === true && e.aanvragen.get(AANVRAAG).vragen.bevestigd === true);
  r = await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, vragen: lijst.map((v, i) => (i === 2 ? { ...v, maxTekens: null, geenLimiet: true } : v)), bevestig: true }), e.deps);
  check('"dit fonds heeft geen limiet" telt ook', r.status === 200 && r.body.vragen.bevestigd === true && r.body.vragen.lijst[2].geenLimiet === true);
  r = await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, stukken: [{ id: 's1', tekst: 'ANBI-status', bron: 'standaard', sleutel: 'anbi', klaar: true, documentNaam: 'anbi.pdf' }] }), e.deps);
  check('de stukkenlijst bewaren (checklist) laat de vragen ongemoeid', r.status === 200 && e.aanvragen.get(AANVRAAG).stukken[0].klaar === true && e.aanvragen.get(AANVRAAG).vragen.bevestigd === true);
  gelijk('niets meegestuurd: 400', (await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG }), e.deps)).status, 400);
  gelijk('ongeldige stukken: 400', (await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, stukken: [{ tekst: '' }] }), e.deps)).status, 400);
  gelijk('andermans aanvraag wijzigen: 404', (await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, stukken: [{ tekst: 'Iets' }] }, 'ander-token'), e.deps)).status, 404);
}

sectie('6. Antwoorden schrijven: één beoordeling per fonds');
{
  const e = omgeving();
  const schrijf = (extra = {}, token = 'goed-token') => verwerk(vraag({ mode: 'antwoorden-schrijven', projectId: PROJECT, aanvraagId: AANVRAAG, ...extra }, token), e.deps);

  let r = await schrijf();
  gelijk('zonder vragenlijst: 409', [r.status, r.body.reden], [409, 'vragen-niet-bevestigd']);
  await lezen(e);
  r = await schrijf();
  gelijk('met een onbevestigde lijst: 409', [r.status, r.body.reden], [409, 'vragen-niet-bevestigd']);
  check('en dan is er niets verbruikt', e.log.reserveringen.filter((x) => x.soort === 'beoordelingen').length === 0);

  const lijst = e.aanvragen.get(AANVRAAG).vragen.lijst.map((v) => ({ ...v, maxTekens: v.maxTekens ?? 800 }));

  await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, vragen: lijst, bevestig: true }), e.deps);
  gelijk('onbekende vraag: 400', (await schrijf({ vraagIds: ['v9'] })).status, 400);
  r = await schrijf();
  gelijk('alle vragen: 200 en 3 antwoorden', [r.status, r.body.antwoorden.length], [200, 3]);
  check('de antwoorden hebben het id van de vraag en de limiet erbij', r.body.antwoorden.map((a) => a.id).join() === 'v1,v2,v3' && r.body.antwoorden[0].maxTekens === 1500 && r.body.antwoorden[2].maxTekens === 800);
  check('de tekst rust op de feiten van het project', /Samen Spelen/.test(r.body.antwoorden[0].tekst) && r.body.antwoorden[0].herkomst.includes('Projectgegevens'));
  check('het telt als één beoordeling (niet drie)', r.body.telde === true && e.log.reserveringen.filter((x) => x.soort === 'beoordelingen').length === 1);
  check('de maand en het aantal staan nu op de aanvraag', e.aanvragen.get(AANVRAAG).schrijf_maand === '2026-10' && e.aanvragen.get(AANVRAAG).schrijf_aantal === 3);
  check('gelogd als aanvraag_antwoorden, gelukt', e.log.gebruik.at(-1).actie === 'aanvraag_antwoorden' && e.log.gebruik.at(-1).succes === true);

  r = await schrijf({ vraagIds: ['v2'] });
  check('één vraag opnieuw schrijven in dezelfde maand kost niets extra', r.status === 200 && r.body.antwoorden.length === 1 && r.body.telde === false && e.log.reserveringen.filter((x) => x.soort === 'beoordelingen').length === 1);
  gelijk('en het aantal loopt op (bovengrens tegen misbruik)', e.aanvragen.get(AANVRAAG).schrijf_aantal, 4);

  e.aanvragen.get(AANVRAAG).schrijf_aantal = MAX_HERSCHRIJVEN_PER_MAAND - 1;
  r = await schrijf({ vraagIds: ['v1', 'v2'] });
  gelijk('te vaak opnieuw schrijven binnen één fonds: 429', [r.status, r.body.reden], [429, 'herschrijven-op']);

  e.aanvragen.get(AANVRAAG).schrijf_aantal = 3;
  nu = new Date('2026-11-02T12:00:00Z');
  r = await schrijf({ vraagIds: ['v1'] });
  check('in een nieuwe maand telt het weer als een beoordeling', r.status === 200 && r.body.telde === true && e.log.reserveringen.filter((x) => x.soort === 'beoordelingen').length === 2 && e.aanvragen.get(AANVRAAG).schrijf_maand === '2026-11' && e.aanvragen.get(AANVRAAG).schrijf_aantal === 1);
  nu = new Date('2026-10-26T12:00:00Z');
  gelijk('andermans aanvraag: 404', (await schrijf({}, 'ander-token')).status, 404);

  const vol = omgeving();

  vol.log.tellingBeoordelingen = 6;
  await lezen(vol);
  await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, vragen: vol.aanvragen.get(AANVRAAG).vragen.lijst.map((v) => ({ ...v, maxTekens: 800 })), bevestig: true }), vol.deps);
  const op = await verwerk(vraag({ mode: 'antwoorden-schrijven', projectId: PROJECT, aanvraagId: AANVRAAG }), vol.deps);

  gelijk('maand op (6 van 6): 429 maand-op en er is niets geschreven', [op.status, op.body.reden, vol.log.modelAanroepen], [429, 'maand-op', 1]);

  const faal = omgeving();

  await lezen(faal);
  await verwerk(vraag({ mode: 'vragen-bewaren', aanvraagId: AANVRAAG, vragen: faal.aanvragen.get(AANVRAAG).vragen.lijst.map((v) => ({ ...v, maxTekens: 800 })), bevestig: true }), faal.deps);
  faal.deps.roep = async () => null;
  const f = await verwerk(vraag({ mode: 'antwoorden-schrijven', projectId: PROJECT, aanvraagId: AANVRAAG }), faal.deps);

  gelijk('modelstoring: 502 en het telt niet mee', [f.status, f.body.reden, faal.log.afgerond.filter((a) => !a.succes).length, faal.aanvragen.get(AANVRAAG).schrijf_maand], [502, 'ai-mislukt', 1, null]);
}

klaar('aanvraag-vragen');
