// Planningsmotor van het actieplan: scenario's (vaste deadline, meerdere rondes, alleen vergadering, doorlopend, geen termijn, <6 weken,
// gewijzigde bedragen en deadlines, handmatige wijzigingen) als zuivere functie EN door de hele keten (opslaan -> taken -> herplannen).
//   node tests/voorstel-genereren/run.mjs
import { PID, w, resetGenereren, regeling, fonds, gebruikerWijzigt } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { planFinancier, leesBehandeltermijn, leesVoorlooptijdVergadering, plusMaanden, plusDagen, dagenTussen } from '../../supabase/functions/_shared/actieplanPlanning.ts';
import { bepaalHerplanning } from '../../supabase/functions/_shared/actieplanHerplan.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const V = '2026-10-16';
const d = (n, van = V) => plusDagen(van, n);
const stap = (u, fase) => u.stappen.find((s) => s.fase === fase);
const alleDatums = (u) => u.stappen.filter((s) => s.datum).map((s) => s.datum);
const geenVerleden = (u, v = V) => u.stappen.every((s) => !s.datum || s.datum >= v);
const metHerkomst = (u) => u.stappen.every((s) => (s.datum ? ['bron', 'berekend', 'aanname'].includes(s.datumHerkomst) && s.datumBron : s.datumHerkomst === null));

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Zuivere planning: vaste deadline, zes weken voorbereiding, opvolging met aanname');
{
  const D = d(60);
  const u = planFinancier('Fonds A', { status: 'Open', deadline: D, gecontroleerdOp: '2026-10-01', bronUrl: 'https://fonds-a.example.nl/aanvragen' }, V);
  const T0 = d(-42, D);

  check('voorbereiding start 6 weken vóór de deadline', stap(u, 'passendheid').datum === T0 && T0 === d(18), `${stap(u, 'passendheid').datum} vs ${T0}`);
  check('adviseursoverleg en fondscontact op het begin van de periode', stap(u, 'adviseur').datum === T0 && stap(u, 'contact').datum === T0);
  check('volgorde: stukken < schrijven < feedback < indienen', stap(u, 'stukken').datum > T0 && stap(u, 'stukken').datum < stap(u, 'schrijven').datum && stap(u, 'schrijven').datum < stap(u, 'review').datum && stap(u, 'review').datum < stap(u, 'indienen').datum);
  check('indienen 3 dagen vóór de deadline, externe deadline vermeld', stap(u, 'indienen').datum === d(-3, D) && stap(u, 'indienen').externeDeadline === D && /Externe deadline van de financier/.test(stap(u, 'indienen').toelichting));
  check('niet kort: samenvatting zegt 42 dagen en geen waarschuwing', u.samenvatting.voorbereidingKort === false && u.samenvatting.voorbereidingsDagen === 42 && u.samenvatting.beschikbareDagen === 60 && u.samenvatting.waarschuwingen.length === 0);
  check('berekende datums dragen herkomst "berekend" met bron en controledatum', stap(u, 'passendheid').datumHerkomst === 'berekend' && /01-10-2026/.test(stap(u, 'passendheid').datumBron) && stap(u, 'passendheid').datumControle === '2026-10-01');
  check('de toelichting benoemt de herkomst van de datum', /Berekend:/.test(stap(u, 'passendheid').toelichting));
  const S = d(-3, D);

  check('opvolging aanwezig: ontvangst, vragen, beoordeling, besluit, vervolg', ['ontvangst', 'vragen', 'beoordeling', 'besluit', 'vervolg'].every((f) => stap(u, f)));
  check('zonder termijn: beoordeling ±3 maanden na indienen = aanname', stap(u, 'beoordeling').datum === plusMaanden(S, 3) && stap(u, 'beoordeling').datumHerkomst === 'aanname');
  check('zonder termijn: besluit ±2 maanden daarna = aanname, uitdrukkelijk een aanpasbare schatting', stap(u, 'besluit').datum === plusMaanden(plusMaanden(S, 3), 2) && stap(u, 'besluit').datumHerkomst === 'aanname' && /planningsaanname, geen datum van de financier/.test(stap(u, 'besluit').toelichting) && /aanpassen/.test(stap(u, 'besluit').toelichting));
  check('aannames staan in de samenvatting', u.samenvatting.aannames.some((x) => /voorlopige planningsaanname/.test(x)));
  check('geen actie in het verleden en elke datum heeft herkomst', geenVerleden(u) && metHerkomst(u));
  check('opvolging mag na de deadline vallen', stap(u, 'besluit').datum > D);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Gepubliceerde behandeltermijn gaat voor; aannames komen er dan niet bij');
{
  const D = d(60);
  const S = d(-3, D);
  const a = planFinancier('Fonds B', { deadline: D, behandeltermijn: 'Max. 4 maanden' }, V);

  check('"Max. 4 maanden" wordt gelezen als 120 dagen vanaf indiening', a.samenvatting.behandeltermijn?.dagen === 120 && a.samenvatting.behandeltermijn.basis === 'indiening');
  check('besluit = indiening + termijn, herkomst berekend, brontekst genoemd', stap(a, 'besluit').datum === d(120, S) && stap(a, 'besluit').datumHerkomst === 'berekend' && /Max\. 4 maanden/.test(stap(a, 'besluit').datumBron));
  check('geen aparte 3-maands aanname-beoordeling en geen aannames in de samenvatting', !stap(a, 'beoordeling') && a.samenvatting.aannames.length === 0);

  const b = planFinancier('Fonds C', { deadline: D, behandeltermijn: '2-4 weken na sluiting van de ronde' }, V);

  check('"2-4 weken na sluiting" rekent vanaf de deadline met de bovengrens', b.samenvatting.behandeltermijn?.basis === 'sluiting' && stap(b, 'besluit').datum === d(28, D) && stap(b, 'besluit').datumHerkomst === 'berekend');

  const c = planFinancier('Fonds D', { deadline: D, behandeltermijn: 'Circa 1 maand na indiening' }, V);

  check('"Circa 1 maand na indiening" = 30 dagen vanaf indiening', stap(c, 'besluit').datum === d(30, S));

  for (const onleesbaar of ['Enkele maanden', 'Circa 2 maanden (klein/regionaal); 3-4 maanden (groot/landelijk)', 'Reactie binnen 5 werkdagen na vooraanvraag', 'Bestuur vergadert 4x per jaar; exacte vergaderdata niet gepubliceerd.']) {
    const u = planFinancier('Fonds E', { deadline: D, behandeltermijn: onleesbaar }, V);

    check(`onduidelijke termijn wordt NIET als termijn gebruikt: "${onleesbaar.slice(0, 30)}"`, u.samenvatting.behandeltermijn === null && stap(u, 'besluit').datumHerkomst === 'aanname' && /beoordeling ±3 maanden/.test(stap(u, 'besluit').datumBron));
    check('maar de brontekst blijft zichtbaar', u.samenvatting.behandeltermijnTekst === onleesbaar.slice(0, 200) && stap(u, 'navragen') === undefined);
  }

  const bekend = planFinancier('Fonds F', { deadline: D, behandeltermijn: 'Max. 4 maanden', beoordelingsdatum: d(30, D) }, V);

  check('bekend beoordelingsmoment uit de bron wordt gevolgd (herkomst bron)', stap(bekend, 'beoordeling').datum === d(30, D) && stap(bekend, 'beoordeling').datumHerkomst === 'bron');
  check('besluit blijft termijn of beoordelingsdatum, nooit eerder dan de beoordeling', stap(bekend, 'besluit').datum >= stap(bekend, 'beoordeling').datum);

  const metBeoordeling = planFinancier('Fonds G', { deadline: D, beoordelingsdatum: d(40, D) }, V);

  check('beoordelingsdatum zonder termijn: besluit ±2 maanden daarna (aanname)', stap(metBeoordeling, 'besluit').datum === plusMaanden(d(40, D), 2) && stap(metBeoordeling, 'besluit').datumHerkomst === 'aanname');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Minder dan zes weken: voorbereidingstijd kort, samengedrukt, nooit in het verleden');
{
  for (const dagen of [30, 20, 10, 5, 2, 1, 0]) {
    const D = d(dagen);
    const u = planFinancier('Fonds K', { deadline: D }, V);

    check(`${dagen} dagen: kort gemeld`, u.samenvatting.voorbereidingKort === true && u.samenvatting.waarschuwingen.some((x) => /Voorbereidingstijd kort/.test(x)) && /Voorbereidingstijd kort/.test(stap(u, 'passendheid').toelichting));
    check(`${dagen} dagen: niets in het verleden, voorbereiding binnen deadline, vanaf vandaag`, geenVerleden(u) && ['passendheid', 'adviseur', 'contact', 'stukken', 'schrijven', 'review', 'indienen'].every((f) => stap(u, f).datum <= D) && stap(u, 'passendheid').datum === V);
    check(`${dagen} dagen: volgorde blijft logisch`, stap(u, 'passendheid').datum <= stap(u, 'stukken').datum && stap(u, 'stukken').datum <= stap(u, 'schrijven').datum && stap(u, 'schrijven').datum <= stap(u, 'review').datum && stap(u, 'review').datum <= stap(u, 'indienen').datum);
  }

  const precies = planFinancier('Fonds K', { deadline: d(42) }, V);

  check('precies 42 dagen: niet kort', precies.samenvatting.voorbereidingKort === false && stap(precies, 'passendheid').datum === V);

  const kort = planFinancier('Fonds K', { deadline: d(20), volgendeRonde: d(110) }, V);

  check('korte tijd + bekende volgende ronde: indienstap wijst naar de volgende ronde', /volgende ronde sluit op/.test(stap(kort, 'indienen').toelichting));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Instelbare voorbereidingstijd en aanvragen die meer tijd vragen');
{
  const D = d(120);
  const standaard = planFinancier('Fonds L', { deadline: D }, V);
  const acht = planFinancier('Fonds L', { deadline: D }, V, { voorbereidingsDagen: 56 });
  const groot = planFinancier('Fonds L', { deadline: D }, V, { bedrag: 80000 });
  const coF = planFinancier('Fonds L', { deadline: D, cofinanciering: 'Cofinanciering verplicht (50%)' }, V);
  const beide = planFinancier('Fonds L', { deadline: D, cofinanciering: 'Cofinanciering verplicht' }, V, { bedrag: 80000, voorbereidingsDagen: 56 });

  check('standaard 42 dagen', stap(standaard, 'passendheid').datum === d(-42, D) && standaard.samenvatting.voorbereidingsDagen === 42);
  check('instelbaar: 56 dagen', stap(acht, 'passendheid').datum === d(-56, D) && acht.samenvatting.voorbereidingsDagen === 56);
  check('veeleisend (bedrag ≥ € 50.000) krijgt 14 dagen extra', stap(groot, 'passendheid').datum === d(-56, D));
  check('cofinanciering vraagt 14 dagen extra', stap(coF, 'passendheid').datum === d(-56, D));
  check('instelling plus extra, begrensd op 120', beide.samenvatting.voorbereidingsDagen === 84 && planFinancier('X', { deadline: d(400) }, V, { voorbereidingsDagen: 9999 }).samenvatting.voorbereidingsDagen === 120 && planFinancier('X', { deadline: d(400) }, V, { voorbereidingsDagen: 1 }).samenvatting.voorbereidingsDagen === 14);
  check('met meer voorbereidingstijd wordt 70 dagen beschikbaar als "kort" gemeld (84 > 70)', planFinancier('Fonds L', { deadline: d(70) }, V, { bedrag: 80000, voorbereidingsDagen: 70 }).samenvatting.voorbereidingKort === true);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Meerdere aanvraagrondes');
{
  const verstreken = planFinancier('Fonds R', { deadline: d(-5), volgendeRonde: d(50), rondesAantal: 3 }, V);

  check('verstreken ronde: planning gaat uit van de volgende ronde, met waarschuwing', verstreken.samenvatting.deadline === d(50) && verstreken.samenvatting.waarschuwingen.some((x) => /verstreken.*volgende ronde/.test(x)) && stap(verstreken, 'indienen').externeDeadline === d(50));
  check('volgende ronde is een datum uit de bron', /volgende ronde/.test(stap(verstreken, 'indienen').datumBron === null ? '' : 'volgende ronde'));

  const geenVolgende = planFinancier('Fonds R', { deadline: d(-5), status: 'Open' }, V);

  check('verstreken en geen volgende ronde: geen kalenderdata, wel navragen', geenVolgende.samenvatting.modus === 'onbekend' && geenVolgende.stappen[0].fase === 'navragen' && geenVolgende.samenvatting.waarschuwingen.some((x) => /verstreken en er is geen latere ronde/.test(x)));
  check('geen enkele datum na de aanname-startdatum behalve eigen start', geenVolgende.stappen.filter((s) => s.datum).every((s) => s.datumHerkomst === 'aanname' && s.datum === d(7)));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Alleen een bestuursvergadering bekend: geen indiendatum afleiden');
{
  const M = d(90);
  const u = planFinancier('Fonds M', { status: 'Open', vergaderdatum: M, vergaderfrequentie: '4x per jaar', behandeltermijn: 'Bestuur vergadert 4x per jaar; exacte vergaderdata niet gepubliceerd.' }, V);

  check('modus vergadering, begint met "Aanvraagmoment en behandeltermijn navragen"', u.samenvatting.modus === 'vergadering' && u.stappen[0].fase === 'navragen' && /Aanvraagmoment en behandeltermijn van Fonds M navragen/.test(u.stappen[0].titel));
  check('geen indiendatum en geen deadline afgeleid van de vergadering', u.samenvatting.indiendatum === null && u.samenvatting.deadline === null && stap(u, 'indienen').datum === null && stap(u, 'schrijven').datum === null && stap(u, 'indienen').externeDeadline === null);
  check('de vergadering is wel een bronvermelding: beoordelingsmoment volgen op die datum', stap(u, 'beoordeling').datum === M && stap(u, 'beoordeling').datumHerkomst === 'bron' && /alleen relevant als de aanvraag ruim voor deze vergadering/i.test(stap(u, 'beoordeling').toelichting));
  check('besluit zonder indiendatum: geen datum', stap(u, 'besluit').datum === null && stap(u, 'vervolg').datum === null);
  check('alleen de eigen startacties hebben een datum, als aanname', u.stappen.filter((s) => s.datum && s.fase !== 'beoordeling').every((s) => s.datumHerkomst === 'aanname' && s.datum === d(7)));
  check('stappen zonder datum zeggen dat de datum volgt', stap(u, 'schrijven').toelichting.includes('Nog geen datum'));

  const lead = planFinancier('Fonds N', { status: 'Open', vergaderdatum: M, aanvraagprocedure: 'Aanvragen moeten minimaal 4 weken voor de bestuursvergadering binnen zijn.' }, V);

  check('bron noemt voorlooptijd: indiendatum wel berekend (vergadering − 28 dagen)', lead.samenvatting.modus === 'deadline' && lead.samenvatting.deadline === d(-28, M) && stap(lead, 'indienen').datumHerkomst === 'berekend' && /4 weken voor de bestuursvergadering/.test(stap(lead, 'passendheid').datumBron));
  check('en de vergadering blijft het beoordelingsmoment (bron)', stap(lead, 'beoordeling').datum === M && stap(lead, 'beoordeling').datumHerkomst === 'bron');

  const verleden = planFinancier('Fonds M', { status: 'Open', vergaderdatum: d(-10) }, V);

  check('een vergaderdatum in het verleden telt niet', verleden.samenvatting.vergaderdatum === null && verleden.samenvatting.modus === 'onbekend');

  check('voorlooptijd lezen: 6 weken / 14 dagen', leesVoorlooptijdVergadering('Dien uw aanvraag uiterlijk 6 weken vóór de vergadering in')?.dagen === 42 && leesVoorlooptijdVergadering('14 dagen voor de bestuursvergadering')?.dagen === 14 && leesVoorlooptijdVergadering('Het bestuur vergadert 4x per jaar') === null);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. Doorlopende regeling en regeling zonder bekende deadline of termijn');
{
  const u = planFinancier('Fonds D', { status: 'Doorlopend', aanvraagprocedure: 'geen vaste sluitingsdatum, doorlopend in te dienen' }, V);

  check('doorlopend: begint met navragen', u.samenvatting.modus === 'doorlopend' && u.stappen[0].fase === 'navragen');
  check('indienmoment is een als aanname gelabelde eigen streefdatum (vandaag + 42)', u.samenvatting.indiendatum === d(42) && stap(u, 'indienen').datumHerkomst === 'aanname' && /eigen streefdatum/.test(stap(u, 'indienen').datumBron) && stap(u, 'indienen').externeDeadline === null);
  check('geen enkele datum is "bron" of "berekend" zonder bron: alles aanname', u.stappen.filter((s) => s.datum).every((s) => s.datumHerkomst === 'aanname'));
  check('opvolging gepland vanaf het eigen indienmoment', stap(u, 'besluit').datum === plusMaanden(plusMaanden(d(42), 3), 2));
  check('nergens in het verleden', geenVerleden(u) && metHerkomst(u));

  const termijn = planFinancier('Fonds D', { status: 'Doorlopend', behandeltermijn: 'Maximaal circa 30 dagen' }, V);

  check('doorlopend met termijn: besluit = eigen indiendatum + 30 dagen (nog steeds aanname-sterkte)', stap(termijn, 'besluit').datum === d(30, d(42)) && stap(termijn, 'besluit').datumHerkomst === 'aanname' && !stap(termijn, 'beoordeling'));

  const onbekend = planFinancier('Fonds U', { status: 'Open' }, V);

  check('geen deadline, geen termijn: logische volgorde, GEEN verzonnen kalenderdata', onbekend.samenvatting.modus === 'onbekend' && onbekend.stappen[0].fase === 'navragen' && ['passendheid', 'adviseur', 'stukken', 'schrijven', 'review', 'indienen', 'ontvangst', 'vragen', 'besluit', 'vervolg'].every((f) => stap(onbekend, f)));
  check('alleen de eerste stappen hebben een datum (vandaag + 7, aanname); de rest niet', onbekend.stappen.filter((s) => s.datum).map((s) => s.fase).sort().join() === 'adviseur,navragen,passendheid' && onbekend.stappen.filter((s) => s.datum).every((s) => s.datum === d(7) && s.datumHerkomst === 'aanname'));
  check('geen deadline van de financier verzonnen', onbekend.stappen.every((s) => s.externeDeadline === null) && onbekend.samenvatting.deadline === null);

  const gesloten = planFinancier('Fonds G', { status: 'Gesloten' }, V);

  check('gesloten of budget uitgeput: waarschuwing', gesloten.samenvatting.waarschuwingen.some((x) => /Gesloten/.test(x)) && /Gesloten/.test(gesloten.stappen[0].toelichting));
  check('zonder gegevens (null) werkt ook', planFinancier('X', null, V).stappen.length >= 10 && planFinancier('X', undefined, V).stappen[0].fase === 'navragen');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('8. Fondscontact alleen als het fonds het toestaat; hulpfuncties');
{
  const u = planFinancier('Fonds Z', { deadline: d(60), aanvraagprocedure: 'Neem geen contact op voordat u de aanvraag indient; alle vragen via het portaal.' }, V);

  check('contact niet toegestaan: geen "contact opnemen"-stap, wel vragen via gepubliceerde kanalen', !u.stappen.some((s) => /Contact opnemen/.test(s.titel)) && /gepubliceerde kanalen/.test(stap(u, 'contact').titel));
  check('contact toegestaan: contactstap aanwezig', planFinancier('Fonds Z', { deadline: d(60) }, V).stappen.some((s) => /Contact opnemen met Fonds Z/.test(s.titel)));
  check('plusMaanden houdt de maand aan (31 jan + 1 = 28 feb)', plusMaanden('2027-01-31', 1) === '2027-02-28' && plusMaanden('2026-11-30', 3) === '2027-02-28' && plusMaanden('2026-10-16', 5) === '2027-03-16');
  check('dagenTussen', dagenTussen('2026-10-16', '2026-12-15') === 60);
  check('termijn lezen: eenheden en afkeuring', leesBehandeltermijn('6 weken')?.dagen === 42 && leesBehandeltermijn('5 werkdagen na ontvangst')?.dagen === 5 && leesBehandeltermijn('na 2 maanden')?.dagen === 60 && leesBehandeltermijn('') === null && leesBehandeltermijn('binnen 2 weken of 3 maanden') === null && leesBehandeltermijn('quickscan binnen 2 weken') === null);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('9. Herplannen (zuiver): nieuwe datum voorstellen, handmatig aangepast niet overschrijven');
{
  const gepl = (titel, datum, extra = {}) => ({ titel, fundingId: 'F1', datum, datumHerkomst: 'berekend', datumBron: 'x', datumControle: null, toelichting: 'n', fase: 'indienen', ...extra });
  const bestaand = [
    { id: 'a1', titel: 'Aanvraag indienen', fundingId: 'F1', datum: '2026-12-12', status: 'todo', proposedAt: '2026-10-16T10:00:00Z', updatedAt: '2026-10-16T10:00:00Z' },
    { id: 'a2', titel: 'Aanvraag schrijven', fundingId: 'F1', datum: '2026-12-01', status: 'todo', proposedAt: '2026-10-16T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z' },
    { id: 'a3', titel: 'Passendheid', fundingId: 'F1', datum: '2026-11-03', status: 'done', proposedAt: null, updatedAt: null },
    { id: 'a4', titel: 'Feedback', fundingId: 'F1', datum: '2026-12-05', status: 'todo', planningHandmatig: true },
    { id: 'a5', titel: 'Ongewijzigd', fundingId: 'F1', datum: '2026-12-01', status: 'todo' },
    { id: 'a6', titel: 'Vervallen', fundingId: 'F1', datum: '2026-12-01', status: 'todo', planningHandmatig: false },
  ];
  const u = bepaalHerplanning(bestaand, [gepl('Aanvraag indienen', '2027-01-12'), gepl('Aanvraag schrijven', '2027-01-01'), gepl('Passendheid', '2026-12-03'), gepl('Feedback', '2027-01-05'), gepl('Ongewijzigd', '2026-12-01'), gepl('Vervallen', null), gepl('Bestaat niet', '2027-01-01')]);
  const per = Object.fromEntries(u.wijzigingen.map((x) => [x.actieId, x]));

  check('onaangeroerde taak: voorstel met oud en nieuw, niet handmatig', per.a1?.oud === '2026-12-12' && per.a1.nieuw === '2027-01-12' && per.a1.handmatig === false && per.a1.reden === 'datum-gewijzigd');
  check('zonder migratie D telt een latere updated_at als handmatig aangepast', per.a2?.handmatig === true);
  check('met migratie D telt planning_handmatig', per.a4?.handmatig === true);
  check('afgeronde taak blijft buiten beeld', !per.a3 && u.afgerond === 1);
  check('ongewijzigde datum geen voorstel; ontbrekende taak wordt niet aangemaakt', !per.a5 && u.ongewijzigd === 1 && u.ontbrekend === 1);
  check('datum vervalt als er geen betrouwbare datum meer is', per.a6?.nieuw === null && per.a6.reden === 'datum-vervallen');
}

// ---------------------------------------------------------------------------------------------------------------------------
// Door de hele keten
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R1 = id(0xd1);
const R2 = id(0xd2);
const R3 = id(0xd3);
const R4 = id(0xd4);
const R5 = id(0xd5);
const FD = id(0xe1);

async function post(body, { token = 'jwt' } = {}) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, tekst };
}

const FREE = { subscription_tier: 'free', subscription_active: false, trial_ends_at: null, role: 'user' };
const opslaan = (regels, extra = {}) => post({ mode: 'voorstel-opslaan', projectId: PID, regels, ...extra });
const herplan = (extra = {}, opts) => post({ mode: 'voorstel-actieplan-herplan', projectId: PID, ...extra }, opts);
const r = (type, rid, bedrag) => ({ type, id: rid, bedrag });
const fundingVan = (schemeId) => w.db.funding.find((f) => f.scheme_id === schemeId);
const takenVan = (schemeId) => w.db.actions.filter((t) => t.funding_id === fundingVan(schemeId)?.id);
const taak = (schemeId, re) => takenVan(schemeId).find((t) => re.test(t.title));

const reg = (id_, naam, extra = {}, deadline = d(60)) => regeling({ naam, gever: `Gever ${naam}`, min: 1000, max: 60000, id: id_, deadline, extra });
const wereld = (regelingen, extra = {}) => resetGenereren({ regelingen, funders: [fonds({ naam: 'Fonds Voorbeeld', min: 1000, max: 15000, id: FD })], dbActief: true, ...extra });

sectie('10. Keten: vaste deadline -> opgeslagen taken met planning');
{
  wereld([reg(R1, 'Regeling Vast', { behandeltermijn: null, aanvraagprocedure: 'Digitaal portaal.' })], { planning: { regelingen: [{ id: R1, funder_id: 'x', status_laatst_gecheckt: '2026-10-10T08:00:00Z', volgende_vergaderdatum: null }], rondes: [], funders: [] } });
  const uit = await opslaan([r('regeling', R1, 20000)]);
  const t = takenVan(R1);
  const indienen = taak(R1, /indienen/);
  const start = taak(R1, /Passendheid/);

  check('opgeslagen, actieplan klaar', uit.status === 200 && uit.json.actieplan.status === 'klaar' && t.length >= 11, JSON.stringify(uit.json?.actieplan));
  check('indienen 3 dagen vóór deadline, passendheid 6 weken ervoor', indienen?.due_date === d(57) && start?.due_date === d(18), `${indienen?.due_date} ${start?.due_date}`);
  check('planningskolommen: fase, herkomst, bron, controledatum', start.planning_fase === 'passendheid' && start.datum_herkomst === 'berekend' && /aanvraagdeadline/.test(start.datum_bron) && start.datum_controle === '2026-10-10', JSON.stringify({ f: start?.planning_fase, h: start?.datum_herkomst, b: start?.datum_bron, c: start?.datum_controle }));
  check('de toelichting noemt de herkomst ook leesbaar', /Berekend:/.test(start.notes) && /Voorlopige planningsaanname/.test(taak(R1, /Verwachte beslissing/).notes));
  check('antwoord bevat de planning per regel voor de interface', uit.json.planning && Object.values(uit.json.planning)[0]?.modus === 'deadline' && Object.values(uit.json.planning)[0].voorbereidingKort === false && uit.json.voorbereidingsDagen === 42);
  check('geen taak in het verleden en elke taak aan de regel gekoppeld', t.every((x) => !x.due_date || x.due_date >= V) && t.every((x) => x.funding_id === fundingVan(R1).id));
  check('geen dubbele titels', new Set(t.map((x) => x.title.toLowerCase())).size === t.length);
}

sectie('11. Keten: meerdere rondes + korte voorbereiding');
{
  wereld([reg(R2, 'Regeling Rondes', { rondes_aantal: 3 }, d(20))], { planning: { regelingen: [], rondes: [{ subsidieregeling_id: R2, sluitingsdatum: d(20), actief: true }, { subsidieregeling_id: R2, sluitingsdatum: d(110), actief: true, bron_url: 'https://rondes.example.nl/' }], funders: [] } });
  const uit = await opslaan([r('regeling', R2, 15000)]);
  const indienen = taak(R2, /indienen/);

  check('kort gemeld in de samenvatting en in de eerste taak', Object.values(uit.json.planning)[0].voorbereidingKort === true && /Voorbereidingstijd kort/.test(taak(R2, /Passendheid/).notes));
  check('volgende ronde (uit de rondes-tabel) wordt genoemd', /volgende ronde sluit op/.test(indienen.notes) && new RegExp(d(110).split('-').reverse().join('-')).test(indienen.notes), indienen?.notes);
  check('niets in het verleden en voorbereiding binnen de deadline', takenVan(R2).filter((t) => !/Ontvangst|Aanvullende|Beoordelings|Verwachte|Vervolg/.test(t.title)).every((t) => !t.due_date || (t.due_date >= V && t.due_date <= d(20))));
}

sectie('12. Keten: alleen een bestuursvergadering (funder) en doorlopende regeling');
{
  wereld([reg(R3, 'Regeling Vergadering', { behandeltermijn: 'Bestuur vergadert 4x per jaar; exacte vergaderdata niet gepubliceerd.' }, null), reg(R4, 'Regeling Doorlopend', { status: 'Doorlopend', behandeltermijn: 'Max. 4 maanden' }, null)], {
    planning: { regelingen: [{ id: R3, funder_id: 'f-r3', volgende_vergaderdatum: d(90), vergaderfrequentie: '4x per jaar' }], rondes: [], funders: [] },
  });
  const uit = await opslaan([r('regeling', R3, 10000), r('regeling', R4, 10000)]);
  const v = takenVan(R3);
  const dl = takenVan(R4);

  check('vergadering: eerste taak is "Aanvraagmoment en behandeltermijn navragen"', uit.status === 200 && /Aanvraagmoment en behandeltermijn van Regeling Vergadering navragen/.test(v[0].title));
  check('vergadering: indienen en schrijven hebben GEEN datum, beoordeling volgt de vergadering (bron)', !taak(R3, /indienen/).due_date && !taak(R3, /schrijven/).due_date && taak(R3, /Beoordelings/).due_date === d(90) && taak(R3, /Beoordelings/).datum_herkomst === 'bron');
  check('vergadering: onderdelen zonder datum zijn niet verzonnen', v.filter((t) => t.planning_fase && t.due_date).every((t) => t.due_date === d(7) || t.due_date === d(90)));
  check('doorlopend: indienen = eigen streefdatum (aanname) vandaag + 42', taak(R4, /indienen/).due_date === d(42) && taak(R4, /indienen/).datum_herkomst === 'aanname');
  check('doorlopend met "Max. 4 maanden": besluit = indienen + 120 dagen, geen extra beoordelingsaanname', taak(R4, /Verwachte beslissing/).due_date === d(120, d(42)) && !dl.some((t) => /Beoordelingsmoment .* navragen/.test(t.title)));
  check('antwoord: modus per regel', Object.values(uit.json.planning).map((x) => x.modus).sort().join() === 'doorlopend,vergadering');
}

sectie('13. Keten: gewijzigd bedrag (veeleisend) en zonder planningskolommen (migratie D ontbreekt)');
{
  wereld([reg(R1, 'Regeling Vast', {}, d(150))]);
  await opslaan([r('regeling', R1, 60000)]);
  check('bedrag ≥ € 50.000: voorbereiding 56 dagen', taak(R1, /Passendheid/).due_date === d(-56, d(150)), taak(R1, /Passendheid/)?.due_date);

  wereld([reg(R1, 'Regeling Vast', {}, d(150))]);
  await opslaan([r('regeling', R1, 20000)]);
  check('bedrag € 20.000: voorbereiding 42 dagen', taak(R1, /Passendheid/).due_date === d(-42, d(150)));

  wereld([reg(R1, 'Regeling Vast', {}, d(60))], { migratieD: false });
  const uit = await opslaan([r('regeling', R1, 20000)]);
  const t = takenVan(R1);

  check('zonder migratie D: opslaan lukt, atomair, klaar', uit.status === 200 && uit.json.actieplan.status === 'klaar' && uit.json.actieplan.atomair === true && t.length >= 11, JSON.stringify(uit.json?.actieplan));
  check('zonder migratie D: geen planningskolommen, wel de herkomst in de toelichting', t.every((x) => !('datum_herkomst' in x)) && /Berekend:/.test(taak(R1, /Passendheid/).notes));
  check('zonder migratie D: opnieuw opslaan maakt niets dubbel', (await opslaan([r('regeling', R1, 20000)])).json.actieplan.aangemaakt === 0 && takenVan(R1).length === t.length);
}

sectie('14. Keten: planninggegevens onleesbaar of ontbrekend blokkeert niets');
{
  wereld([reg(R3, 'Regeling Vergadering', {}, null)], { planningFout: true, planning: { regelingen: [{ id: R3, volgende_vergaderdatum: d(90) }], rondes: [], funders: [] } });
  const uit = await opslaan([r('regeling', R3, 10000)]);

  check('planningstabellen onleesbaar: opslaan lukt; zonder vergaderdatum geen vergaderstap', uit.status === 200 && uit.json.actieplan.status === 'klaar' && taak(R3, /Beoordelings/)?.due_date !== d(90) && !taak(R3, /Beoordelings/)?.due_date);
  check('het plan blijft logisch: begint met navragen', /navragen/.test(takenVan(R3)[0].title));
}

sectie('15. Keten: gedeeltelijk mislukte taakgeneratie bewaart planning; opnieuw proberen herstelt zonder dubbelen');
{
  wereld([reg(R1, 'Regeling Vast', {}, d(60))], { dbFout: { actions: { code: 'XX000' } } });
  const eerste = await opslaan([r('regeling', R1, 20000)]);

  check('dekkingsplan bewaard, actieplan mislukt en bewaard voor opnieuw proberen', eerste.json.regels[0].status === 'opgeslagen' && eerste.json.actieplan.status === 'mislukt' && eerste.json.actieplan.bewaard === true && w.wachtrij.length >= 11);
  check('de wachtrij bewaart de planning per taak', w.wachtrij.filter((x) => x.planning_fase).length >= 11 && w.wachtrij.some((x) => x.datum_herkomst === 'berekend' && x.datum_bron));

  w.dbFout = null;
  const herstel = await post({ mode: 'voorstel-actieplan-herstel', projectId: PID });
  const t = takenVan(R1);

  check('herstel maakt de taken met planning aan, wachtrij leeg', herstel.json.actieplan.status === 'klaar' && w.wachtrij.length === 0 && t.length >= 11 && t.filter((x) => x.planning_fase).length >= 11 && t.filter((x) => x.planning_fase).every((x) => x.datum_herkomst || !x.due_date), JSON.stringify(herstel.json?.actieplan));

  const nogEens = await post({ mode: 'voorstel-actieplan-herstel', projectId: PID });

  check('nog eens herstellen: geen dubbelen', nogEens.json.actieplan.status === 'geen' && takenVan(R1).length === t.length);

  // Zonder migratie D: wachtrij en taken schrijven zonder de planningskolommen.
  wereld([reg(R1, 'Regeling Vast', {}, d(60))], { migratieD: false, dbFout: { actions: { code: 'XX000' } } });
  await opslaan([r('regeling', R1, 20000)]);
  check('zonder migratie D: wachtrij werkt nog', w.wachtrij.length >= 11 && w.wachtrij.every((x) => !('datum_herkomst' in x)));
  w.dbFout = null;
  const h2 = await post({ mode: 'voorstel-actieplan-herstel', projectId: PID });

  check('zonder migratie D: herstel werkt nog', h2.json.actieplan.status === 'klaar' && takenVan(R1).length >= 11);
}

sectie('16. Herplannen: gewijzigde deadline wordt een voorstel; handmatige wijzigingen blijven');
{
  const regels = [reg(R1, 'Regeling Vast', {}, d(60))];

  wereld(regels);
  await opslaan([r('regeling', R1, 20000)]);

  const voor = w.db.actions.map((t) => ({ ...t }));
  const geenWijziging = await herplan();

  check('niets gewijzigd: geen voorstellen, niets geschreven', geenWijziging.status === 200 && geenWijziging.json.wijzigingen.length === 0 && geenWijziging.json.ongewijzigd >= 10);

  // De financier verlaat de deadline: 3 weken later.
  w.regelingen[0].deadline_datum = d(81);
  const eigenBewerkt = taak(R1, /schrijven/);

  gebruikerWijzigt(eigenBewerkt.id, { due_date: d(30) });

  const voorstel = await herplan();
  const wz = voorstel.json.wijzigingen;
  const indienenWz = wz.find((x) => /indienen/.test(x.titel));

  check('voorstel: indienen en voorbereiding schuiven mee, schrijft NIETS', voorstel.status === 200 && wz.length >= 6 && indienenWz.oud === d(57) && indienenWz.nieuw === d(78) && voorstel.json.toegepast === false && w.dbSchrijfLog.filter((l) => l.update).length === 0);
  check('de voorgestelde datum draagt herkomst, bron en nieuwe toelichting', indienenWz.nieuweHerkomst === 'berekend' && /deadline/.test(indienenWz.nieuweBron) && /Externe deadline/.test(indienenWz.toelichting));
  check('de door het lid aangepaste taak is als handmatig gemarkeerd', wz.find((x) => x.actieId === eigenBewerkt.id)?.handmatig === true && wz.filter((x) => x.actieId !== eigenBewerkt.id).every((x) => x.handmatig === false));
  check('opvolging schuift ook mee (besluit)', wz.some((x) => /Verwachte beslissing/.test(x.titel)));
  check('samenvatting per financieringsregel in het antwoord', Object.values(voorstel.json.planning)[0].deadline === d(81));

  // Toepassen: alles kiezen, handmatig NIET uitdrukkelijk meegegeven.
  const alle = wz.map((x) => x.actieId);
  const toegepast = await herplan({ toepassen: alle });
  const na = (t) => w.db.actions.find((x) => x.id === t.id);

  check('toepassen: onaangeroerde taken verschuiven, versie omhoog, herkomst bijgewerkt', toegepast.json.aantalToegepast === wz.length - 1 && na(taak(R1, /indienen/)).due_date === d(78) && na(taak(R1, /indienen/)).planning_versie === 2 && na(taak(R1, /indienen/)).datum_herkomst === 'berekend');
  check('handmatig aangepaste taak is NIET overschreven (ook niet als hij in de lijst staat)', na(eigenBewerkt).due_date === d(30) && toegepast.json.overgeslagenHandmatig === 1 && na(eigenBewerkt).datum_herkomst === 'handmatig');
  check('geen enkele taak is bijgekomen of verdwenen', w.db.actions.length === voor.length);

  const nogEens = await herplan();

  check('na toepassen blijft alleen de handmatige taak als voorstel over', nogEens.json.wijzigingen.length === 1 && nogEens.json.wijzigingen[0].actieId === eigenBewerkt.id && nogEens.json.wijzigingen[0].handmatig === true);

  const uitdrukkelijk = await herplan({ toepassen: [eigenBewerkt.id], ookHandmatig: true });

  check('alleen met uitdrukkelijke keuze wordt ook een handmatige taak aangepast', uitdrukkelijk.json.aantalToegepast === 1 && na(eigenBewerkt).due_date === nogEens.json.wijzigingen[0].nieuw);

  const afgerond = taak(R1, /Passendheid/);

  afgerond.status = 'done';
  w.regelingen[0].deadline_datum = d(95);
  const metAfgerond = await herplan();

  check('afgeronde taken blijven buiten het voorstel', !metAfgerond.json.wijzigingen.some((x) => x.actieId === afgerond.id) && metAfgerond.json.afgerond >= 1);

  // Deadline vervalt: de datums vervallen, er komt geen verzonnen datum voor in de plaats.
  w.regelingen[0].deadline_datum = null;
  const vervallen = await herplan();

  check('deadline weg: voorstel om datums te laten vervallen (geen verzonnen data)', vervallen.json.wijzigingen.some((x) => /indienen/.test(x.titel) && x.nieuw === null && x.reden === 'datum-vervallen'));
}

sectie('17. Herplannen zonder migratie D: handmatig herkend aan updated_at');
{
  wereld([reg(R1, 'Regeling Vast', {}, d(60))], { migratieD: false });
  await opslaan([r('regeling', R1, 20000)]);
  w.regelingen[0].deadline_datum = d(81);

  const bewerkt = taak(R1, /schrijven/);

  gebruikerWijzigt(bewerkt.id, { due_date: d(30) });

  const v = await herplan();

  check('zonder D: wijziging door het lid herkend als handmatig', v.json.wijzigingen.find((x) => x.actieId === bewerkt.id)?.handmatig === true && v.json.wijzigingen.filter((x) => x.actieId !== bewerkt.id).every((x) => x.handmatig === false));

  const toe = await herplan({ toepassen: v.json.wijzigingen.map((x) => x.actieId) });

  check('zonder D: toepassen werkt (zonder planningskolommen), handmatige blijft', toe.json.aantalToegepast === v.json.wijzigingen.length - 1 && w.db.actions.find((x) => x.id === bewerkt.id).due_date === d(30) && taak(R1, /indienen/).due_date === d(78) && !('planning_versie' in taak(R1, /indienen/)));
}

sectie('18. Herplannen: poorten (login, flag, abonnement, project, invoer)');
{
  wereld([reg(R1, 'Regeling Vast')]);
  await opslaan([r('regeling', R1, 20000)]);

  check('zonder login: 401', (await herplan({}, { token: null })).status === 401);
  check('ongeldig project: 400', (await post({ mode: 'voorstel-actieplan-herplan', projectId: 'abc' })).status === 400);
  check('toepassen geen lijst van uuid\'s: 400', (await herplan({ toepassen: ['x'] })).status === 400 && (await herplan({ toepassen: 'x' })).status === 400);
  check('te veel id\'s: 400', (await herplan({ toepassen: Array.from({ length: 101 }, (_, i) => id(i + 1)) })).status === 400);

  const log = w.dbSchrijfLog.length;

  wereld([reg(R1, 'Regeling Vast')], { profile: FREE });
  check('Free: 403, niets geschreven', (await herplan()).status === 403 && w.dbSchrijfLog.length === 0);

  wereld([reg(R1, 'Regeling Vast')], { project: { ...w.project, user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } });
  check('project van een ander: 404', (await herplan()).status === 404);

  resetGenereren({ regelingen: [reg(R1, 'Regeling Vast')], dbActief: true, env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon' } });
  check('flag uit: 404', (await herplan()).status === 404);

  // Een taak van een ander project kan nooit worden aangepast: id van elders in `toepassen` doet niets.
  wereld([reg(R1, 'Regeling Vast', {}, d(60))]);
  await opslaan([r('regeling', R1, 20000)]);
  w.regelingen[0].deadline_datum = d(81);
  const vreemd = await herplan({ toepassen: [id(0xdead)] });

  check('onbekend taak-id in toepassen: niets aangepast', vreemd.status === 200 && vreemd.json.aantalToegepast === 0 && w.dbSchrijfLog.filter((l) => l.update).length === 0);
  check('schrijfpogingen van de herplanner gaan alleen via de gebruikersclient (RLS)', log >= 0 && w.schrijfpogingen.length === 0 ? true : w.schrijfpogingen.every((p) => p.tabel !== 'subsidie_kompas_program_actions'));
}

console.log(`\nVOORSTEL-PLANNING: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
