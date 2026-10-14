import {
  VOORSTEL_VERSIE, MAX_REGELS, MAX_VRAGEN, VOORSTEL_STATUS, BRON_SOORT, DEADLINE_STATUS, DATUM_TYPE,
  beoordeelProject, valideerVoorstel, berekenTotalen, schaalNaarGat, plantTerug, verificatieActie, voegDagenToe,
  contractBedrag, verificatieWeergave, GEEN_BRONCONTROLE, schaalEnControleer, vergelijkMetVoorstel, datumInFragment, bronUrlSleutel, veiligeUrl, zelfdeFinancier, normaliseerNaam, regelSleutelVan, actieSleutelVan, isEchteDatum,
} from '../../src/features/kompas-app/financiering/voorstel.js';
import { berekenDekking } from '../../src/features/kompas-app/financiering/dekkingsplan.js';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

const VANDAAG = '2026-10-12';
const PID = '11111111-1111-4111-8111-111111111111';
const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VOLLEDIG = {
  naam: 'Buurtmoestuin', omschrijving: 'Een gemeenschappelijke moestuin waar buurtbewoners samen groenten verbouwen en leren koken.',
  doelstellingen: 'Sociale cohesie vergroten.', activiteiten: 'Wekelijkse tuindagen en kookworkshops.', doelgroep: ['Ouderen', 'Jongeren'],
  regio: 'Rotterdam-Zuid', periodeVan: '2027-01-01', periodeTot: '2027-12-31', planning: '', begroting: 80000, eigenBijdrage: 10000,
};

console.log('== helpers');
gelijk('contractBedrag: getallen, komma, afronden, afwijzen', [contractBedrag(1500.4), contractBedrag('2500,6'), contractBedrag(-1), contractBedrag(NaN), contractBedrag(null), contractBedrag('abc'), contractBedrag(true), contractBedrag(1e12)], [1500, 2501, null, null, null, null, null, null]);
check('veiligeUrl: https ok, lokaal/inlog/rare protocollen geweigerd', veiligeUrl('https://www.fonds.nl/aanvragen') != null && veiligeUrl('javascript:alert(1)') == null && veiligeUrl('https://user:pw@fonds.nl') == null && veiligeUrl('http://localhost:3000') == null && veiligeUrl('http://10.0.0.1/x') == null && veiligeUrl('ftp://fonds.nl') == null && veiligeUrl('fonds') == null);
check('zelfdeFinancier: hoofdletters, accenten, hele woorden; niet bij korte of ongelijke namen', zelfdeFinancier('Stichting Dinamo Fonds', 'stichting dinamo-fonds') && zelfdeFinancier('Prins Bernhard Cultuurfonds', 'Prins Bernhard Cultuurfonds Zuid-Holland') && !zelfdeFinancier('Fonds A', 'Fonds B') && !zelfdeFinancier('Oranje Fonds', 'Oranje Fondsen en Stichting X'));
check('zelfdeFinancier: korte naam is geen deelstring van een langere', !zelfdeFinancier('VSB', 'VSBfonds Rotterdam') && !zelfdeFinancier('', 'x'));
gelijk('normaliseerNaam', normaliseerNaam('  Fondsé  Één-Twee! '), 'fondse een twee');
gelijk('voegDagenToe over maand- en jaargrens', [voegDagenToe('2026-12-30', 3), voegDagenToe('2026-03-01', -1)], ['2027-01-02', '2026-02-28']);
check('isEchteDatum', isEchteDatum('2026-02-28') && !isEchteDatum('2026-02-30'));

console.log('== volledigheidscontrole');
const volledig = beoordeelProject({ project: VOLLEDIG });
gelijk('volledig project: geen vragen, definitief, bedragen toegestaan', [volledig.vragen.length, volledig.status, volledig.bedragenToegestaan, volledig.begroting, volledig.eigenBijdrage, volledig.aannames.length], [0, 'definitief', true, 80000, 10000, 0]);
const leeg = beoordeelProject({ project: { naam: 'X' } });
gelijk('leeg project: doel en regio blokkeren; begroting volgt als derde', [leeg.status, leeg.vragen.map((v) => v.sleutel)], ['uitvraag', ['doel', 'regio', 'begroting']]);
check('leeg project: niet onderzoeken, geen bedragen', !leeg.kanOnderzoeken && !leeg.bedragenToegestaan);
check('leeg project: doelgroep en looptijd zijn aannames, geen vragen', leeg.aannames.map((a) => a.veld).sort().join() === 'doelgroep,looptijd' && !leeg.vragen.some((v) => v.veld === 'doelgroep' || v.veld === 'looptijd'));
const zonderRegio = beoordeelProject({ project: { ...VOLLEDIG, regio: '' } });
gelijk('alleen regio ontbreekt: één gerichte vraag', zonderRegio.vragen.map((v) => v.sleutel), ['regio']);
const metAntwoord = beoordeelProject({ project: { ...VOLLEDIG, regio: '' }, antwoorden: { regio: 'Rotterdam-Zuid' } });
gelijk('antwoord uit het gesprek wordt gebruikt: geen vraag meer', [metAntwoord.vragen.length, metAntwoord.status], [0, 'definitief']);
const kort = beoordeelProject({ project: { ...VOLLEDIG, omschrijving: 'Moestuin', doelstellingen: '', activiteiten: '' } });
gelijk('te korte projectbeschrijving telt niet als doel', kort.vragen.map((v) => v.sleutel), ['doel']);
const zonderBegroting = beoordeelProject({ project: { ...VOLLEDIG, begroting: '' } });
gelijk('zonder begroting: concept, onderzoeken mag, bedragen niet, één niet-blokkerende vraag', [zonderBegroting.status, zonderBegroting.kanOnderzoeken, zonderBegroting.bedragenToegestaan, zonderBegroting.vragen.map((v) => [v.sleutel, v.blokkerend])], ['concept', true, false, [['begroting', false]]]);
const metBegrotingAntwoord = beoordeelProject({ project: { ...VOLLEDIG, begroting: '' }, antwoorden: { begroting: '60000' } });
gelijk('begroting uit het gesprek: bedragen toegestaan, met een aanname dat het niet is opgeslagen', [metBegrotingAntwoord.bedragenToegestaan, metBegrotingAntwoord.begroting, metBegrotingAntwoord.aannames.some((a) => a.veld === 'begroting'), metBegrotingAntwoord.status], [true, 60000, true, 'concept']);
const tegenstrijdig = beoordeelProject({ project: VOLLEDIG, documentBedragen: [{ bron: 'begroting-2027.xlsx', bedrag: 95000 }] });
gelijk('tegenstrijdige begrotingen (project en document): uitvraag, géén stille keuze', [tegenstrijdig.status, tegenstrijdig.begroting, tegenstrijdig.bedragenToegestaan, tegenstrijdig.tegenstrijdigheden.length, tegenstrijdig.vragen[0].invoer, tegenstrijdig.vragen[0].opties.length], ['uitvraag', null, false, 1, 'keuze', 2]);
const opgelost = beoordeelProject({ project: VOLLEDIG, documentBedragen: [{ bron: 'begroting-2027.xlsx', bedrag: 95000 }], antwoorden: { keuzes: { begroting: 'doc-0' } } });
gelijk('na een keuze: die begroting geldt en de vraag verdwijnt', [opgelost.begroting, opgelost.begrotingBron, opgelost.vragen.length, opgelost.status], [95000, 'doc-0', 0, 'definitief']);
const binnenTolerantie = beoordeelProject({ project: VOLLEDIG, documentBedragen: [{ bron: 'x.pdf', bedrag: 80300 }] });
gelijk('verschil binnen 1% is geen tegenstrijdigheid', [binnenTolerantie.tegenstrijdigheden.length, binnenTolerantie.begroting], [0, 80000]);
const enigDocument = beoordeelProject({ project: { ...VOLLEDIG, begroting: '' }, documentBedragen: [{ bron: 'begroting.pdf', bedrag: 72000 }] });
gelijk('geen projectbegroting maar één documentbedrag: gebruikt met aanname, geen vraag', [enigDocument.begroting, enigDocument.vragen.length, enigDocument.aannames.length > 0], [72000, 0, true]);
const eigenBoven = beoordeelProject({ project: { ...VOLLEDIG, eigenBijdrage: 90000 } });
gelijk('eigen bijdrage boven begroting: blokkerende tegenstrijdigheid', [eigenBoven.status, eigenBoven.vragen[0].sleutel, eigenBoven.vragen[0].invoer], ['uitvraag', 'eigen-boven-begroting', 'bedrag']);
const gecorrigeerd = beoordeelProject({ project: { ...VOLLEDIG, eigenBijdrage: 90000 }, antwoorden: { eigenBijdrage: '9000' } });
gelijk('gecorrigeerde eigen bijdrage lost het op', [gecorrigeerd.status, gecorrigeerd.eigenBijdrage], ['definitief', 9000]);
const periode = beoordeelProject({ project: { ...VOLLEDIG, periodeVan: '2027-06-01', periodeTot: '2027-01-01' } });
gelijk('einddatum voor startdatum: gerichte vraag', [periode.status, periode.vragen.map((v) => v.sleutel)], ['uitvraag', ['periode']]);
const veel = beoordeelProject({ project: { naam: 'X', begroting: 50000, eigenBijdrage: 60000, periodeVan: '2027-06-01', periodeTot: '2027-01-01' }, documentBedragen: [{ bron: 'a', bedrag: 10 }] });
check('nooit meer dan drie vragen per ronde, blokkerende eerst, rest in volgende ronde', veel.vragen.length <= MAX_VRAGEN && veel.vragen.slice(0, 2).every((v) => v.soort === 'essentieel') && veel.vragen.length + veel.volgendeRonde.length >= 4, JSON.stringify(veel.vragen.map((v) => v.sleutel)));
check('beoordeelProject verandert het project niet', (() => { const p = JSON.parse(JSON.stringify(VOLLEDIG)); beoordeelProject({ project: p, antwoorden: { begroting: '1' } }); return JSON.stringify(p) === JSON.stringify(VOLLEDIG); })());
check('zonder invoer geen fout', beoordeelProject().status === 'uitvraag');

console.log('== validatie van een voorstel');
const dekking = (extra = {}) => berekenDekking({ begroting: 80000, overige: 10000, regels: [], ...extra });
const TWAALF = Array.from({ length: 12 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`);
// Het databaserecord zoals de server dat onder het abonnement van het lid ophaalt: de ENIGE bron voor naam, grenzen en deadline.
const bk = (o = {}) => {
  const rec = (naam, extra = {}) => ({ naam, gever: 'Fonds A', deadline: '2026-12-01', min: null, max: null, cofinanciering: '', ...extra, ...o });
  const kaart = { [U1]: rec('Regeling A'), [U2]: rec('Regeling B', { gever: 'Fonds B' }) };

  TWAALF.forEach((id, i) => { kaart[id] = rec(`Regeling ${i}`); });

  return kaart;
};
const PAGINA = 'Buurtfonds Zuid steunt Buurtinitiatieven in de wijk. Alleen voor ANBI instellingen. Aanvragen kan tot 15 november 2026 via het formulier.';
const BRONNEN = [{ url: 'https://buurtfonds.example.nl/aanvragen', tekst: PAGINA, opgehaaldOp: VANDAAG }];
const ctx = (extra = {}) => ({ projectId: PID, dekking: dekking(), bestaandeRegels: [], bedragenToegestaan: true, vandaag: VANDAAG, bekendeBronnen: bk(), opgehaaldeBronnen: BRONNEN, ...extra });
const regelDb = (o = {}) => ({ type: 'regeling', id: U1, naam: 'Regeling A', gever: 'Fonds A', bedrag: 20000, motivatie: 'Past bij het project.', onderdeel: 'Tuinaanleg', deadline: { status: 'geverifieerd', datum: '2026-12-01' }, ...o });
const regelOnline = (o = {}) => ({ type: 'online', naam: 'Buurtfonds Zuid', regeling: 'Buurtinitiatieven', gever: 'Buurtfonds Zuid', bedrag: 15000, bron: { url: 'https://buurtfonds.example.nl/aanvragen', fragment: 'Aanvragen kan tot 15 november 2026' }, deadline: { status: 'geverifieerd', datum: '2026-11-15' }, voorwaarden: ['Alleen voor ANBI'], onzekerheden: ['Cofinanciering onbekend'], ...o });
const voorstel = (o = {}) => ({ versie: VOORSTEL_VERSIE, projectId: PID, gegenereerdOp: VANDAAG, status: 'definitief', regels: [regelDb()], acties: [], ...o });
const v = (raw, c) => valideerVoorstel(raw, c || ctx());
const codes = (r) => r.fouten.map((f) => f.code);
const wcodes = (r) => r.waarschuwingen.map((f) => f.code);

check('geen object / array / null geweigerd', !v(null).ok && !v([]).ok && !v('x').ok);
gelijk('onbekende versie geweigerd', codes(v({ ...voorstel(), versie: 2 })), ['onbekende-versie']);
gelijk('voorstel voor een ander project geweigerd', codes(v({ ...voorstel(), projectId: '22222222-2222-4222-8222-222222222222' })), ['ander-project']);
gelijk('ongeldig project-id geweigerd', codes(v({ ...voorstel(), projectId: 'x' }, ctx({ projectId: 'x' }))), ['ander-project']);
const basis = v(voorstel());
check('geldig voorstel: ok, één regel, sleutel stabiel', basis.ok && basis.voorstel.regels.length === 1 && basis.voorstel.regels[0].sleutel === `r:regeling:${U1}`);
gelijk('financieringsgat en niet-toegewezen kloppen (80.000 - 10.000 eigen - 20.000 voorstel)', [basis.voorstel.nietToegewezen, dekking().nogTePlannen], [50000, 70000]);
gelijk('regeling die niet in de opgehaalde databaserecords staat (verzonnen of niet toegestaan voor dit abonnement) geweigerd', codes(v(voorstel({ regels: [regelDb({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })] }))), ['onbekende-bron']);
gelijk('zonder bekendeBronnen in de context wordt elke databaseregel geweigerd (faalt dicht)', codes(v(voorstel(), ctx({ bekendeBronnen: undefined }))), ['onbekende-bron']);
gelijk('naam en gever komen uit het record, niet van het model', (() => { const r = v(voorstel({ regels: [regelDb({ naam: 'Verzonnen naam', gever: 'Verzonnen gever' })] })).voorstel.regels[0]; return [r.naam, r.gever]; })(), ['Regeling A', 'Fonds A']);
check('regel met ongeldig id geweigerd', codes(v(voorstel({ regels: [regelDb({ id: 'x' })] }))).includes('ongeldig-id'));
check('regel zonder naam of met onbekend type geweigerd', codes(v(voorstel({ regels: [regelDb({ naam: ' ' }), regelDb({ type: 'foo' })] }))).join() === 'naam-ontbreekt,onbekend-type');
const online = v(voorstel({ regels: [regelOnline()] }));
check('online financier met opgehaalde bron: ok, herkomst online, geen id, controledatum = ophaalmoment van de server', online.ok && online.voorstel.regels[0].herkomst === 'online' && online.voorstel.regels[0].id === null && online.voorstel.regels[0].bron.url.startsWith('https://') && online.voorstel.regels[0].bron.gecontroleerdOp === VANDAAG);
gelijk('online: voorwaarde bevestigd in de bron blijft voorwaarde, niet-bevestigde onzekerheid blijft onzekerheid', [online.voorstel.regels[0].voorwaarden, online.voorstel.regels[0].onzekerheden], [['Alleen voor ANBI'], ['Cofinanciering onbekend']]);
const onbev = v(voorstel({ regels: [regelOnline({ voorwaarden: ['Alleen voor ANBI', 'Minimaal vijftig vrijwilligers aanwezig'] })] }));
gelijk('online: voorwaarde die niet in de bron staat wordt "niet bevestigd" (onzekerheid), geen voorwaarde', [onbev.voorstel.regels[0].voorwaarden, onbev.voorstel.regels[0].onzekerheden[0], wcodes(onbev).includes('voorwaarde-niet-bevestigd')], [['Alleen voor ANBI'], 'Niet bevestigd in de bron: Minimaal vijftig vrijwilligers aanwezig', true]);
gelijk('online zonder bron-url geweigerd', codes(v(voorstel({ regels: [regelOnline({ bron: { url: null } })] }))), ['online-zonder-bron']);
gelijk('online met onveilige url geweigerd', codes(v(voorstel({ regels: [regelOnline({ bron: { url: 'javascript:alert(1)' } })] }))), ['online-zonder-bron']);
gelijk('online met een url die de server NIET heeft opgehaald geweigerd (https-url alleen is geen bewijs)', codes(v(voorstel({ regels: [regelOnline({ bron: { url: 'https://verzonnen.example.nl/fonds' } })] }))), ['bron-niet-opgehaald']);
gelijk('online met opgehaalde pagina die de financier niet noemt geweigerd (naam moet in de paginatekst staan)', codes(v(voorstel({ regels: [regelOnline({ naam: 'Heel Ander Fonds' })] }))), ['bron-bevestigt-financier-niet']);
gelijk('de controledatum komt van de server, niet van het model', v(voorstel({ regels: [regelOnline({ bron: { url: 'https://buurtfonds.example.nl/aanvragen', gecontroleerdOp: '2020-01-01' } })] })).voorstel.regels[0].bron.gecontroleerdOp, VANDAAG);
check('url-vergelijking negeert hoofdletters in host, hash en slot-slash', bronUrlSleutel('https://Buurtfonds.example.nl/aanvragen/#top') === bronUrlSleutel('https://buurtfonds.example.nl/aanvragen') && bronUrlSleutel('https://buurtfonds.example.nl/a?x=1') !== bronUrlSleutel('https://buurtfonds.example.nl/a'));
check('zonder opgehaalde bronnen in de context wordt elke online regel geweigerd (faalt dicht)', codes(v(voorstel({ regels: [regelOnline()] }), ctx({ opgehaaldeBronnen: undefined }))).join() === 'bron-niet-opgehaald');
check('online sleutel afgeleid van naam; hoofdletters en accenten maken geen tweede regel', regelSleutelVan({ type: 'online', naam: 'Buurtfonds Zuid' }) === regelSleutelVan({ type: 'online', naam: 'BUURTFONDS  zuid' }));
const dubbelOnline = v(voorstel({ regels: [regelOnline(), regelOnline({ naam: 'buurtfonds zuid' })] }));
check('dezelfde online financier twee keer: één blijft, waarschuwing', dubbelOnline.voorstel.regels.length === 1 && wcodes(dubbelOnline).includes('dubbel-in-voorstel'));
check('dezelfde databaseregeling twee keer: één blijft', v(voorstel({ regels: [regelDb(), regelDb({ bedrag: 1000 })] })).voorstel.regels.length === 1);
const te = v(voorstel({ regels: Array.from({ length: 12 }, (_, i) => regelDb({ id: TWAALF[i], naam: `Regeling ${i}`, bedrag: 1000 })) }));
check(`maximaal ${MAX_REGELS} regels, rest weggelaten met waarschuwing`, te.voorstel.regels.length === MAX_REGELS && wcodes(te).includes('te-veel-regels'));

console.log('== bedragen en grenzen');
const zonderBegr = v(voorstel({ regels: [regelDb({ bedrag: 5000 })] }), ctx({ bedragenToegestaan: false, dekking: berekenDekking({ begroting: '', overige: 0, regels: [] }) }));
check('zonder begroting worden bedragen weggehaald (geen sluitend plan met bedragen)', zonderBegr.ok && zonderBegr.voorstel.regels[0].bedrag === null && wcodes(zonderBegr).includes('bedrag-zonder-begroting'));
const boven = v(voorstel({ regels: [regelDb({ bedrag: 90000 })] }));
gelijk('totaal boven het financieringsgat: fout, voorstel wel teruggegeven', [boven.ok, codes(boven), boven.voorstel.nietToegewezen], [false, ['boven-financieringsgat'], 0]);
const GR = ctx({ bekendeBronnen: bk({ min: 5000, max: 25000 }) });
const maxGrens = v(voorstel({ regels: [regelDb({ bedrag: 40000 })] }), GR);
gelijk('bedrag boven het maximum van de regeling wordt teruggebracht, met waarschuwing', [maxGrens.voorstel.regels[0].bedrag, maxGrens.voorstel.regels[0].bedragGecorrigeerd, wcodes(maxGrens)], [25000, true, ['bedrag-aangepast-aan-grenzen']]);
gelijk('bedrag onder het minimum wordt opgetrokken', v(voorstel({ regels: [regelDb({ bedrag: 1000 })] }), GR).voorstel.regels[0].bedrag, 5000);
gelijk('grenzen die het model zelf opgeeft tellen niet: alleen het record', v(voorstel({ regels: [regelDb({ bedrag: 90000, grenzen: { min: 1, max: 999999 } })] }), ctx({ bekendeBronnen: bk({ max: 25000 }) })).voorstel.regels[0].bedrag, 25000);
gelijk('ongeldige bedragen (negatief, tekst) worden null', [v(voorstel({ regels: [regelDb({ bedrag: -50 })] })).voorstel.regels[0].bedrag, v(voorstel({ regels: [regelDb({ bedrag: 'veel' })] })).voorstel.regels[0].bedrag], [null, null]);
check('bestaande financiering telt mee in het gat: toegekend 30.000 laat 40.000 ruimte', (() => { const d = dekking({ regels: [{ status: 'awarded', awarded: 30000, requested: null }] }); return v(voorstel({ regels: [regelDb({ bedrag: 40000 })] }), ctx({ dekking: d })).ok && !v(voorstel({ regels: [regelDb({ bedrag: 40001 })] }), ctx({ dekking: d })).ok; })());
check('al geplande regels (Gepland) tellen mee in het gat', (() => { const d = dekking({ regels: [{ status: 'interesting', requested: 30000 }] }); return d.nogTePlannen === 40000 && !v(voorstel({ regels: [regelDb({ bedrag: 40001 })] }), ctx({ dekking: d })).ok; })());

console.log('== bestaande regels blijven behouden');
const bestaand = [{ schemeId: U1, funderId: null, naam: 'Regeling A' }, { schemeId: null, funderId: null, financierNaam: 'Buurtfonds Zuid', naam: 'Buurtfonds Zuid' }];
const sa = v(voorstel({ regels: [regelDb(), regelOnline(), regelDb({ id: U2, naam: 'Regeling B', bedrag: 10000 })] }), ctx({ bestaandeRegels: bestaand }));
gelijk('staat al: databaseregeling en online financier op naam herkend en niet selecteerbaar', sa.voorstel.regels.map((r) => [r.naam, r.staatAl, r.selecteerbaar]), [['Regeling A', true, false], ['Buurtfonds Zuid', true, false], ['Regeling B', false, true]]);
gelijk('staat-al regels krijgen geen bedrag en tellen niet mee in het totaal', [sa.voorstel.regels[0].bedrag, sa.voorstel.regels[1].bedrag, berekenTotalen(sa.voorstel, dekking()).voorgesteld], [null, null, 10000]);
check('een bestaande regel wordt nooit overschreven: er is geen schrijfpad in het contract (alleen nieuwe regels zijn selecteerbaar)', sa.voorstel.regels.filter((r) => r.selecteerbaar).length === 1);

console.log('== deadlines: alleen geverifieerd, tegen de bron');
const dbDl = v(voorstel());
gelijk('databaseregel: de deadline uit het record is geverifieerd', dbDl.voorstel.regels[0].deadline, { status: 'geverifieerd', datum: '2026-12-01', verlopen: false });
const modelAfwijkt = v(voorstel({ regels: [regelDb({ deadline: { status: 'geverifieerd', datum: '2026-12-15' } })] }));
gelijk('een andere datum van het model wordt genegeerd: het record is leidend, met waarschuwing', [modelAfwijkt.voorstel.regels[0].deadline.datum, wcodes(modelAfwijkt)], ['2026-12-01', ['deadline-afwijkend-van-database']]);
const recordZonder = ctx({ bekendeBronnen: bk({ deadline: null }) });
const gok = v(voorstel({ regels: [regelDb({ deadline: { status: 'geverifieerd', datum: '2026-12-01' } })] }), recordZonder);
gelijk('record zonder deadline: de claim van het model telt niet, te verifiëren, datum null', [gok.voorstel.regels[0].deadline.status, gok.voorstel.regels[0].deadline.datum, wcodes(gok)], ['te-verifieren', null, ['deadline-niet-geverifieerd']]);
gelijk('geen deadline gegeven en geen record-datum: te verifiëren', v(voorstel({ regels: [regelDb({ deadline: null })] }), recordZonder).voorstel.regels[0].deadline.status, 'te-verifieren');
gelijk('ongeldige datum in het record nooit geverifieerd', v(voorstel(), ctx({ bekendeBronnen: bk({ deadline: '2026-02-30' }) })).voorstel.regels[0].deadline.status, 'te-verifieren');
check('verlopen geverifieerde deadline wordt gemarkeerd', v(voorstel(), ctx({ bekendeBronnen: bk({ deadline: '2026-09-01' }) })).voorstel.regels[0].deadline.verlopen === true);
const onl = v(voorstel({ regels: [regelOnline()] }));
gelijk('online deadline: geverifieerd alleen omdat de datum in het letterlijk geciteerde fragment staat (15 november 2026)', onl.voorstel.regels[0].deadline, { status: 'geverifieerd', datum: '2026-11-15', verlopen: false });
check('online fragment wordt bewaard als bewijs', onl.voorstel.regels[0].bron.fragment === 'Aanvragen kan tot 15 november 2026');
const zonderFrag = v(voorstel({ regels: [regelOnline({ bron: { url: 'https://buurtfonds.example.nl/aanvragen' } })] }));
gelijk('online claim "geverifieerd" zonder fragment: te verifiëren (url en controledatum alleen zijn onvoldoende)', [zonderFrag.voorstel.regels[0].deadline.status, wcodes(zonderFrag)], ['te-verifieren', ['deadline-niet-geverifieerd']]);
const verzFrag = v(voorstel({ regels: [regelOnline({ bron: { url: 'https://buurtfonds.example.nl/aanvragen', fragment: 'Aanvragen kan tot 20 november 2026' } })] }));
gelijk('online fragment dat niet in de bron staat vervalt; deadline blijft te verifiëren', [verzFrag.voorstel.regels[0].bron.fragment, verzFrag.voorstel.regels[0].deadline.status, wcodes(verzFrag).includes('fragment-niet-in-bron')], [null, 'te-verifieren', true]);
const anderDatum = v(voorstel({ regels: [regelOnline({ deadline: { status: 'geverifieerd', datum: '2026-11-20' } })] }));
gelijk('online datum die niet in het fragment staat: te verifiëren', anderDatum.voorstel.regels[0].deadline.status, 'te-verifieren');
check('datumInFragment kent gangbare Nederlandse notaties', ['15 november 2026', '15-11-2026', '15/11/2026', '15.11.2026', '2026-11-15', '15 nov 2026', '15 november 2026.'].every((f) => datumInFragment('2026-11-15', `Sluiting: ${f}`)) && !datumInFragment('2026-11-15', 'Sluiting 16 november 2026') && !datumInFragment('2026-11-15', '') && !datumInFragment('2026-02-30', '30 februari 2026'));
const verif = v(voorstel({ regels: [regelDb({ deadline: null })] }), recordZonder);
gelijk('zonder geverifieerde deadline komt er automatisch een verificatietaak (geen verzonnen datum)', verif.voorstel.acties.map((a) => [a.titel, a.automatisch, a.externeDeadline]), [['Deadline en openstelling van Regeling A verifiëren', true, null]]);
gelijk('verificatietaak: interne streefdatum over 7 dagen, hoge prioriteit', [verif.voorstel.acties[0].datum, verif.voorstel.acties[0].datumType, verif.voorstel.acties[0].prioriteit], ['2026-10-19', 'streef', 'high']);
check('geen tweede verificatietaak als het model die zelf al gaf', (() => { const a = verificatieActie({ sleutel: `r:regeling:${U1}`, naam: 'Regeling A' }, VANDAAG); return v(voorstel({ regels: [regelDb({ deadline: null })], acties: [{ ...a, regelSleutel: `r:regeling:${U1}` }] }), recordZonder).voorstel.acties.length === 1; })());
const cofRec = v(voorstel(), ctx({ bekendeBronnen: bk({ cofinanciering: 'Minimaal 20% eigen financiering' }) }));
check('cofinancieringseis uit het record wordt niet stil genegeerd: onzekerheid "niet automatisch gecontroleerd"', cofRec.voorstel.regels[0].onzekerheden[0].startsWith('Cofinancieringseis (niet automatisch gecontroleerd): Minimaal 20%'));

console.log('== acties en terugplanning');
const sl = `r:regeling:${U1}`;
const act = (o = {}) => ({ titel: 'Vooroverleg plannen', regelSleutel: sl, datum: '2026-11-10', datumType: 'streef', prioriteit: 'high', toelichting: 'Bel de contactpersoon.', ...o });
const a1 = v(voorstel({ acties: [act()] }));
gelijk('interne streefdatum blijft zichtbaar naast de externe deadline', [a1.voorstel.acties[0].datum, a1.voorstel.acties[0].datumType, a1.voorstel.acties[0].externeDeadline], ['2026-11-10', 'streef', '2026-12-01']);
const na = v(voorstel({ acties: [act({ datum: '2026-12-20' })] }));
gelijk('streefdatum na de externe deadline wordt teruggezet (3 dagen ervoor), met waarschuwing', [na.voorstel.acties[0].datum, wcodes(na)], ['2026-11-28', ['streefdatum-na-deadline']]);
const verl = v(voorstel({ acties: [act({ datum: '2026-09-01' })] }));
gelijk('streefdatum in het verleden wordt vandaag', [verl.voorstel.acties[0].datum, wcodes(verl)], [VANDAAG, ['streefdatum-verleden']]);
const nogEerder = v(voorstel({ acties: [act({ datum: '2026-11-01' })] }), ctx({ bekendeBronnen: bk({ deadline: '2026-10-13' }) }));
gelijk('deadline overmorgen: teruggezet tot niet vóór vandaag', nogEerder.voorstel.acties[0].datum, VANDAAG);
const ext = v(voorstel({ acties: [act({ titel: 'Aanvraag indienen', datumType: 'extern', datum: '2026-11-30' })] }));
gelijk('externe datum komt alleen van de geverifieerde regeldeadline (model kan hem niet kiezen)', [ext.voorstel.acties[0].datum, ext.voorstel.acties[0].datumType], ['2026-12-01', 'extern']);
const extVerz = v(voorstel({ regels: [regelDb({ deadline: null })], acties: [act({ titel: 'Aanvraag indienen', datumType: 'extern', datum: '2026-11-30' })] }), ctx({ bekendeBronnen: bk({ deadline: null }) }));
check('externe datum zonder geverifieerde deadline: datum weg, waarschuwing', extVerz.voorstel.acties.find((a) => a.titel === 'Aanvraag indienen').datum === null && wcodes(extVerz).includes('externe-datum-niet-geverifieerd'));
check('actie zonder titel geweigerd; actie met onbekende regel blijft maar zonder koppeling', codes(v(voorstel({ acties: [act({ titel: ' ' })] }))).includes('titel-ontbreekt') && v(voorstel({ acties: [act({ regelSleutel: 'r:bestaat:niet' })] })).voorstel.acties[0].regelSleutel === null);
check('prioriteit onbekend wordt normaal; status is altijd todo (er is geen statusveld in het contract)', v(voorstel({ acties: [act({ prioriteit: 'spoed' })] })).voorstel.acties[0].prioriteit === 'normal' && !('status' in a1.voorstel.acties[0]));
check('dezelfde actie twee keer: één, waarschuwing', (() => { const r = v(voorstel({ acties: [act(), act({ titel: 'vooroverleg  PLANNEN' })] })); return r.voorstel.acties.length === 1 && wcodes(r).includes('dubbele-actie'); })());
check('actiesleutel stabiel per financier en titel', actieSleutelVan({ regelSleutel: sl, titel: 'Vooroverleg plannen' }) === a1.voorstel.acties[0].sleutel && actieSleutelVan({ regelSleutel: null, titel: 'Begroting aanvullen' }).startsWith('a:project:'));
const pl = plantTerug({ sleutel: sl, naam: 'Regeling A', deadline: { status: 'geverifieerd', datum: '2026-12-01' } }, VANDAAG);
gelijk('terugplannen: vijf stappen in volgorde vóór de deadline', pl.map((a) => a.datum), ['2026-11-03', '2026-11-07', '2026-11-10', '2026-11-17', '2026-11-28']);
check('terugplannen: externe deadline staat bij elke stap, interne datums zijn streefdatums', pl.every((a) => a.externeDeadline === '2026-12-01' && a.datumType === 'streef'));
const krap = plantTerug({ sleutel: sl, naam: 'Regeling A', deadline: { status: 'geverifieerd', datum: '2026-10-20' } }, VANDAAG);
check('weinig tijd: nooit vóór vandaag, nooit na de deadline, volgorde behouden', krap.every((a) => a.datum >= VANDAAG && a.datum <= '2026-10-20') && krap.map((a) => a.datum).join() === krap.map((a) => a.datum).sort().join());
gelijk('terugplannen zonder geverifieerde deadline: alleen een verificatietaak', plantTerug({ sleutel: sl, naam: 'Regeling A', deadline: { status: 'te-verifieren', datum: null } }, VANDAAG).map((a) => a.automatisch && a.titel), ['Deadline en openstelling van Regeling A verifiëren']);

console.log('== totalen en schalen');
const goed = v(voorstel({ regels: [regelDb({ bedrag: 20000 }), regelDb({ id: U2, naam: 'Regeling B', bedrag: 30000 })] })).voorstel;
const t = berekenTotalen(goed, dekking());
gelijk('totalen: voorgesteld, gat, niet-toegewezen, nieuw gepland', [t.voorgesteld, t.gat, t.nietToegewezen, t.overboeking, t.nieuwGepland, t.nieuwNogTePlannen], [50000, 70000, 20000, 0, 50000, 20000]);
const tSel = berekenTotalen(goed, dekking(), [`r:regeling:${U2}`]);
gelijk('selectie: alleen aangevinkte regels tellen mee', [tSel.aantal, tSel.voorgesteld], [1, 30000]);
const tOver = berekenTotalen({ regels: [{ sleutel: 'a', selecteerbaar: true, bedrag: 90000 }] }, dekking());
gelijk('overboeking wordt gemeld, niet weggewerkt', [tOver.overboeking, tOver.nietToegewezen], [20000, 0]);
check('zonder begroting: gat 0 en geen nieuw gat', berekenTotalen(goed, berekenDekking({ begroting: '', overige: 0, regels: [] })).nieuwNogTePlannen === 0);
check('voorgesteld bedrag telt na opslag als Gepland, nooit als Aangevraagd of Toegekend (rekenregel van het dekkingsplan)', (() => { const d = berekenDekking({ begroting: 80000, overige: 10000, regels: [{ status: 'interesting', requested: 50000, awarded: null }] }); return d.gepland === 50000 && d.aangevraagd === 0 && d.toegekend === 0 && d.nogTePlannen === 20000; })());
const geschaald = schaalNaarGat([{ selecteerbaar: true, bedrag: 60000, grenzen: {} }, { selecteerbaar: true, bedrag: 40000, grenzen: {} }], 50000);
gelijk('schaalNaarGat: evenredig verlaagd tot het gat', [geschaald[0].bedrag, geschaald[1].bedrag, geschaald[0].bedrag + geschaald[1].bedrag <= 50000], [30000, 20000, true]);
const nietBoven = schaalNaarGat([{ selecteerbaar: true, bedrag: 10000, grenzen: {} }], 50000);
gelijk('schaalNaarGat verhoogt nooit', nietBoven[0].bedrag, 10000);
const metMin = schaalNaarGat([{ selecteerbaar: true, bedrag: 40000, grenzen: { min: 35000 } }, { selecteerbaar: true, bedrag: 20000, grenzen: { min: 15000 } }], 45000);
check('schaalNaarGat: minimum gerespecteerd; past het niet, dan valt de kleinste regel af', metMin.reduce((s, r) => s + (r.bedrag || 0), 0) <= 45000 && metMin.some((r) => r.selecteerbaar === false) && metMin.filter((r) => r.selecteerbaar).every((r) => r.bedrag >= 35000 || r.bedrag >= 15000));
check('schaalNaarGat verandert de invoer niet', (() => { const inv = [{ selecteerbaar: true, bedrag: 60000, grenzen: {} }]; schaalNaarGat(inv, 100); return inv[0].bedrag === 60000; })());

console.log('== weergave van server-verificatie (de client bouwt nooit metadata)');
const H64 = '0123456789abcdef'.repeat(4);
const serverMeta = (ver, extra = {}) => ({ versie: 2, server_generated: true, herkomst: 'online', voorgesteld_op: VANDAAG, voorgesteld_bedrag: 20000, verificatie: ver, ...extra });
const wGev = verificatieWeergave(serverMeta({ status: 'geverifieerd', gecontroleerd_op: '2026-10-14T10:00:00Z', bron_url: 'https://buurtfonds.example.nl/a', pagina_sha256: H64, velden: { fondsnaam: { status: 'confirmed' }, deadline: { status: 'confirmed', fragment: 'tot 15 november' }, doelgroep: { status: 'not_checked' } } }));
gelijk('server-geverifieerd: label, bron, controledatum, bevestigde en niet-gecontroleerde velden', [wGev.label, wGev.serverGeverifieerd, wGev.bronUrl, wGev.gecontroleerdOp, wGev.bevestigd, wGev.nietGecontroleerd.includes('Doelgroep'), wGev.nietGecontroleerd.includes('Voorwaarden')], ['Geverifieerd door Subsidie Kompas', true, 'https://buurtfonds.example.nl/a', '2026-10-14', ['Fondsnaam', 'Deadline'], true, true]);
const wFake = verificatieWeergave({ versie: 2, server_generated: false, herkomst: 'online', verificatie: { status: 'geverifieerd', bron_url: 'https://x.example.nl/a' } });
gelijk('clientclaim (server_generated niet true): nooit "geverifieerd"', [wFake.status, wFake.serverGeverifieerd, wFake.melding, wFake.bronUrl], ['niet_gecontroleerd', false, GEEN_BRONCONTROLE, null]);
const wV1 = verificatieWeergave({ versie: 1, herkomst: 'online', deadline: { status: 'geverifieerd', datum: '2026-11-15' } });
gelijk('oude versie-1 metadata (deadline.status geverifieerd) wordt niet als verificatie getoond', [wV1.status, wV1.serverGeverifieerd], ['niet_gecontroleerd', false]);
gelijk('onbekende status wordt niet doorgegeven', verificatieWeergave(serverMeta({ status: 'verified' })).status, 'niet_gecontroleerd');
const wCon = verificatieWeergave(serverMeta({ status: 'conflict', gecontroleerd_op: '2026-10-14T10:00:00Z', bron_url: 'https://f.example.nl/a', pagina_sha256: H64, velden: { fondsnaam: { status: 'confirmed' }, deadline: { status: 'conflict', waarde: '2026-11-15', db_waarde: '2026-11-12', fragment: 'tot 15 november 2026' } } }));
gelijk('conflict: veld, online waarde, databasewaarde en controledatum zichtbaar', [wCon.status, wCon.conflicten, wCon.gecontroleerdOp, wCon.serverGeverifieerd], ['conflict', [{ veld: 'deadline', label: 'Deadline', online: '2026-11-15', database: '2026-11-12', fragment: 'tot 15 november 2026' }], '2026-10-14', false]);
gelijk('gedeeltelijk en onzeker krijgen hun eigen label', [verificatieWeergave(serverMeta({ status: 'gedeeltelijk' })).label, verificatieWeergave(serverMeta({ status: 'onzeker' })).label], ['Gedeeltelijk geverifieerd', 'Onzeker']);
gelijk('niet gecontroleerd toont de faalmelding', verificatieWeergave(serverMeta({ status: 'niet_gecontroleerd' })).melding, 'Bron kon niet automatisch worden gecontroleerd.');
gelijk('http-bron wordt niet als link getoond', verificatieWeergave(serverMeta({ status: 'onzeker', bron_url: 'http://x.example.nl/a' })).bronUrl, null);
gelijk('regeling zonder verificatieblok: niet gecontroleerd (geen claim)', verificatieWeergave({ versie: 2, server_generated: true, herkomst: 'regeling', voorgesteld_op: VANDAAG }).serverGeverifieerd, false);
check('zonder metadata (geen voorgestelde regel): geen weergave', verificatieWeergave(null) === null && verificatieWeergave('x') === null);
check('de weergave verandert de invoer niet', (() => { const m = serverMeta({ status: 'onzeker', velden: { deadline: { status: 'uncertain' } } }); const t = JSON.stringify(m); verificatieWeergave(m); return t === JSON.stringify(m); })());

console.log('== gebruikerswijzigingen naast de oorspronkelijke metadata');
const orig = v(voorstel({ regels: [regelDb({ bedrag: 20000 })] })).voorstel.regels[0];
gelijk('validatie legt het oorspronkelijk voorgestelde bedrag vast', [orig.bedrag, orig.oorspronkelijkBedrag], [20000, 20000]);
const gewijzigd = { ...orig, bedrag: 15000 };
const metaGew = serverMeta({ status: 'niet_gecontroleerd' }, { voorgesteld_bedrag: orig.oorspronkelijkBedrag });
gelijk('lid past het bedrag in de preview aan: metadata bewaart het oorspronkelijke bedrag, requested_amount krijgt het aangepaste', [metaGew.voorgesteld_bedrag, gewijzigd.bedrag], [20000, 15000]);
const vgl = vergelijkMetVoorstel({ requested: 15000, status: 'interesting' }, metaGew);
gelijk('vergelijking: voorgesteld 20.000, nu 15.000, aangepast', [vgl.voorgesteldBedrag, vgl.huidigBedrag, vgl.bedragGewijzigd, vgl.statusGewijzigd, vgl.aangepast], [20000, 15000, true, false, true]);
gelijk('ongewijzigd: niet aangepast', vergelijkMetVoorstel({ requested: 20000, status: 'interesting' }, metaGew).aangepast, false);
gelijk('status veranderd (bijv. Aangevraagd of Ingetrokken): zichtbaar als wijziging', [vergelijkMetVoorstel({ requested: 20000, status: 'withdrawn' }, metaGew).statusGewijzigd, vergelijkMetVoorstel({ requested: 20000, status: 'submitted' }, metaGew).aangepast], [true, true]);
check('zonder metadata geen vergelijking (regel is niet voorgesteld)', vergelijkMetVoorstel({ requested: 1, status: 'interesting' }, null) === null);
check('metadata blijft onveranderd na een vergelijking', (() => { const m = JSON.stringify(metaGew); vergelijkMetVoorstel({ requested: 1, status: 'x' }, metaGew); return m === JSON.stringify(metaGew); })());

console.log('== schalen met volledige hercontrole');
const groot = voorstel({ regels: [regelDb({ bedrag: 60000 }), regelDb({ id: U2, naam: 'Regeling B', bedrag: 40000 })] });
const sc = schaalEnControleer(groot, ctx());
gelijk('te veel gevraagd (100.000 voor een gat van 70.000): geschaald en daarna weer geldig', [sc.geschaald, sc.ok, sc.voorstel.regels.map((r) => r.bedrag), wcodes(sc).includes('bedragen-geschaald')], [true, true, [42000, 28000], true]);
check('na het schalen is het hele voorstel opnieuw gevalideerd: totaal <= gat', sc.voorstel.regels.reduce((t, r) => t + (r.bedrag || 0), 0) <= dekking().nogTePlannen);
const scMin = schaalEnControleer(voorstel({ regels: [regelDb({ bedrag: 60000 }), regelDb({ id: U2, naam: 'Regeling B', bedrag: 40000 })] }), ctx({ bekendeBronnen: bk({ min: 35000 }) }));
check('minima na het schalen: een regel die onder zijn minimum zou komen valt af (nooit onder de grens), voorstel blijft geldig', scMin.ok && scMin.voorstel.regels.every((r) => r.bedrag == null || r.bedrag >= 35000) && scMin.voorstel.regels.reduce((t, r) => t + (r.bedrag || 0), 0) <= dekking().nogTePlannen && wcodes(scMin).includes('regel-vervallen-door-gat'), JSON.stringify([scMin.fouten, scMin.voorstel.regels.map((r) => r.bedrag), wcodes(scMin)]));
const scGr = schaalEnControleer(voorstel({ regels: [regelDb({ bedrag: 200000 })] }), ctx({ bekendeBronnen: bk({ max: 90000 }) }));
check('grenzen uit het record blijven gelden bij schalen (max 90.000, gat 70.000)', scGr.ok && scGr.voorstel.regels[0].bedrag <= 70000);
const scBestaand = schaalEnControleer(voorstel({ regels: [regelDb({ bedrag: 60000 }), regelDb({ id: U2, naam: 'Regeling B', bedrag: 40000 })] }), ctx({ bestaandeRegels: [{ schemeId: U2, funderId: null, naam: 'Regeling B' }] }));
check('bestaande regels blijven na het schalen onaangeroerd en niet selecteerbaar', scBestaand.voorstel.regels.find((r) => r.id === U2).staatAl === true && scBestaand.voorstel.regels.find((r) => r.id === U2).selecteerbaar === false);
check('een voorstel dat al past wordt niet geschaald', schaalEnControleer(voorstel(), ctx()).geschaald === false);
check('schaalEnControleer verandert de invoer niet', (() => { const inv = JSON.stringify(groot); schaalEnControleer(groot, ctx()); return inv === JSON.stringify(groot); })());

console.log('== constanten en vorm');
check('constanten', VOORSTEL_VERSIE === 1 && MAX_REGELS === 8 && MAX_VRAGEN === 3 && VOORSTEL_STATUS.UITVRAAG === 'uitvraag' && BRON_SOORT.ONLINE === 'online' && DEADLINE_STATUS.TE_VERIFIEREN === 'te-verifieren' && DATUM_TYPE.EXTERN === 'extern');
check('het contract kent geen status Aangevraagd of Toegekend voor een voorstel en geen schrijfstatus', !JSON.stringify(basis.voorstel).includes('submitted') && !JSON.stringify(basis.voorstel).includes('awarded'));
check('module is zuiver: geen imports', !/^\s*import\s/m.test(await (await import('node:fs/promises')).readFile('src/features/kompas-app/financiering/voorstel.js', 'utf8')));

console.log(`\n${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
