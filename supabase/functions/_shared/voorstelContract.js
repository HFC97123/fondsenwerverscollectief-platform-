// Gedeeld voorstelcontract voor een dekkingsplan en actieplan (versie 1). ZUIVER: geen imports, geen React, geen netwerk,
// geen opslag, zodat dezelfde module in de browser (projectpagina, chat) en, als gesynchroniseerde kopie, in de Edge
// Function kan draaien (zie README.voorstel.md). Bedragen worden hier nooit berekend uit de database: de aanroeper geeft de
// dekking mee (berekenDekking uit dekkingsplan.js), zodat er één rekenregel blijft.
//
// Verdeling van werk (besluit van de gebruiker):
//   - Het taalmodel mag meedenken: financieringsmix, aanbevolen aanvraagbedragen, inhoudelijke acties, volgorde en prioriteit.
//   - Deze code valideert: bedragen en bijdragegrenzen, het resterende financieringsgat, totalen en dubbeltellingen, bronnen,
//     deadlines en terugplanning, en de structuur vóór opslag. Een voorgesteld bedrag telt na opslag als Gepland, nooit als
//     Aangevraagd of Toegekend (status 'interesting').
//   - Geverifieerde externe fondsdeadlines, voorgestelde interne streefdatums en nog te verifiëren informatie blijven apart.

export const VOORSTEL_VERSIE = 1;
export const MAX_REGELS = 12;
export const MAX_VRAGEN = 3;
export const MAX_ACTIES = 30;

export const VOORSTEL_STATUS = { UITVRAAG: 'uitvraag', CONCEPT: 'concept', DEFINITIEF: 'definitief' };
export const BRON_SOORT = { REGELING: 'regeling', FONDS: 'fonds', ONLINE: 'online' };
// LET OP: dit is de uitkomst van de CITAATCONTROLE in dit contract (de datum staat letterlijk in het citaat dat het model aanleverde). Het is
// geen bronverificatie: die doet alleen de server na het zelf ophalen van de pagina (zie verificatieWeergave). Toon dit nooit als
// "geverifieerd door Subsidie Kompas"; gebruik daarvoor uitsluitend de metadata van de server.
export const DEADLINE_STATUS = { GEVERIFIEERD: 'geverifieerd', TE_VERIFIEREN: 'te-verifieren' };
export const DATUM_TYPE = { STREEF: 'streef', EXTERN: 'extern' };

const MAX = { naam: 200, motivatie: 600, onderdeel: 200, voorwaarde: 300, onzekerheid: 300, titel: 200, toelichting: 600, sleutel: 120 };
const MAX_LIJST = 6;
const MAX_BEDRAG = 1e12;
// Dekkingsdoel: hoeveel boven het financieringsgat een voorstel mag uitkomen omdat een afwijzing normaal is (Pro 1.20, Premium 1.40).
// Alleen de SERVER bepaalt dit (uit de tierconfiguratie); een waarde buiten 1 t/m 1,6 telt als 1 (geen buffer).
export const MAX_DEKKINGSDOEL = 1.6;
export function toegestaneSom(gat, dekkingsdoel) {
  const f = typeof dekkingsdoel === 'number' && Number.isFinite(dekkingsdoel) && dekkingsdoel >= 1 && dekkingsdoel <= MAX_DEKKINGSDOEL ? dekkingsdoel : 1;

  // Eerst op centen afronden: 100000 * 1.1 is in floating point 110000.00000000001 en mag niet 110001 worden.
  return Math.ceil(Math.round(gat * f * 100) / 100);
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITEITEN = ['high', 'normal', 'low'];

const tekst = (v) => (v == null ? '' : String(v));
const kort = (v, max) => tekst(v).trim().slice(0, max);

// ---------------------------------------------------------------------------
// Kleine hulpfuncties
// ---------------------------------------------------------------------------

export function isEchteDatum(iso) {
  if (!ISO.test(tekst(iso))) {
    return false;
  }

  const [j, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(j, m - 1, d));

  return x.getUTCFullYear() === j && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
}

export function voegDagenToe(iso, dagen) {
  const [j, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(j, m - 1, d + dagen));

  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

// Een bedrag uit het contract: een eindig getal >= 0, op hele euro's, of null. Geen tekstparsing: het contract draagt getallen.
export function contractBedrag(v) {
  if (v == null || v === '' || typeof v === 'boolean') {
    return null;
  }

  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));

  if (!Number.isFinite(n) || n < 0 || n >= MAX_BEDRAG) {
    return null;
  }

  return Math.round(n);
}

// Een veilige bron-URL: http(s), een echte host met een punt, geen inloggegevens in de URL, geen lokaal adres.
export function veiligeUrl(waarde) {
  const t = kort(waarde, 2000);

  if (!t) {
    return null;
  }

  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();

    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return null;
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;

    return u.toString();
  } catch (e) {
    return null;
  }
}

// Naam voor vergelijking: hoofdletters, accenten en leestekens weg.
export function normaliseerNaam(naam) {
  return tekst(naam)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const bevatHeleWoorden = (groot, klein) => klein.length > 0 && (` ${groot} `).includes(` ${klein} `);

// Zelfde financier? Gelijke genormaliseerde naam, of de ene (van minstens 10 tekens) staat als hele woorden in de andere.
export function zelfdeFinancier(a, b) {
  const x = normaliseerNaam(a);
  const y = normaliseerNaam(b);

  if (!x || !y) {
    return false;
  }

  if (x === y) {
    return true;
  }

  return (x.length >= 10 && bevatHeleWoorden(y, x)) || (y.length >= 10 && bevatHeleWoorden(x, y));
}

function slug(t) {
  return normaliseerNaam(t).replace(/ /g, '-').slice(0, 60);
}

// Stabiele sleutels: dezelfde financier of taak krijgt bij een nieuw voorstel dezelfde sleutel, zodat herhaald opslaan
// niets dubbel toevoegt (de database dwingt dit met een unieke index af).
export function regelSleutelVan(regel) {
  if (regel.type === BRON_SOORT.ONLINE) return `r:online:${slug(regel.naam)}`;

  return `r:${regel.type}:${regel.id}`;
}

export function actieSleutelVan(actie) {
  return `a:${actie.regelSleutel || 'project'}:${slug(actie.titel)}`.slice(0, MAX.sleutel);
}

// ---------------------------------------------------------------------------
// 1. Volledigheidscontrole: wat ontbreekt of is tegenstrijdig?
// ---------------------------------------------------------------------------

const LEEG = (v) => tekst(Array.isArray(v) ? v.join(', ') : v).trim() === '';
const BEGROTING_TOLERANTIE = 0.01; // 1%: kleine verschillen door afronding zijn geen tegenstrijdigheid

function bedragUitInvoer(v) {
  return contractBedrag(v);
}

function voldoendeTekst(...delen) {
  return delen.map((d) => tekst(d).trim()).filter(Boolean).join(' ').length >= 25;
}

// project: { naam, omschrijving, doelstellingen, activiteiten, doelgroep, regio, periodeVan, periodeTot, planning, begroting, eigenBijdrage }
// antwoorden (uit hetzelfde gesprek of het invulpaneel): { doel, regio, doelgroep, looptijd, begroting, eigenBijdrage, periodeVan, periodeTot, keuzes: { [conflictSleutel]: optieSleutel } }
// documentBedragen: [{ bron: 'begroting.pdf', bedrag: 85000 }] (alleen bedragen die de documentextractie betrouwbaar herkende)
// -> zie het retourobject onderaan; de functie verandert niets aan het project.
export function beoordeelProject({ project, antwoorden, documentBedragen } = {}) {
  const p = project || {};
  const a = antwoorden || {};
  const keuzes = a.keuzes || {};
  const docs = (Array.isArray(documentBedragen) ? documentBedragen : [])
    .map((d) => ({ bron: kort(d && d.bron, 120) || 'document', bedrag: bedragUitInvoer(d && d.bedrag) }))
    .filter((d) => d.bedrag != null && d.bedrag > 0);

  const aannames = [];
  const vragen = [];
  const tegenstrijdigheden = [];
  const ontbrekend = [];

  // --- Essentieel: doel en uitvoeringsgebied -----------------------------------------------------------------------
  const heeftDoel = voldoendeTekst(p.omschrijving, p.doelstellingen, p.activiteiten) || voldoendeTekst(a.doel);
  const heeftRegio = !LEEG(p.regio) || !LEEG(a.regio);

  if (!heeftDoel) {
    ontbrekend.push({ veld: 'doel', soort: 'essentieel' });
    vragen.push({
      sleutel: 'doel',
      veld: 'doel',
      soort: 'essentieel',
      blokkerend: true,
      invoer: 'tekst',
      tekst: 'Wat wil het project bereiken en welke activiteiten voert het uit?',
      reden: 'Zonder projectdoel kan Subsidiekompas geen passende financiers zoeken.',
    });
  }

  if (!heeftRegio) {
    ontbrekend.push({ veld: 'regio', soort: 'essentieel' });
    vragen.push({
      sleutel: 'regio',
      veld: 'regio',
      soort: 'essentieel',
      blokkerend: true,
      invoer: 'tekst',
      tekst: 'In welk gebied wordt het project uitgevoerd (gemeente, regio of land)?',
      reden: 'Veel fondsen werken alleen in een bepaald gebied; zonder uitvoeringsgebied is matching onbetrouwbaar.',
    });
  }

  // --- Aanvullend: doelgroep en looptijd (concept gaat door met een aanname) -------------------------------------------
  if (LEEG(p.doelgroep) && LEEG(a.doelgroep)) {
    ontbrekend.push({ veld: 'doelgroep', soort: 'aanvullend' });
    aannames.push({ veld: 'doelgroep', tekst: 'De doelgroep is niet ingevuld: financiers zijn breed gezocht en de doelgroepeisen moeten nog worden gecontroleerd.' });
  }

  const heeftLooptijd = !LEEG(p.periodeVan) || !LEEG(p.periodeTot) || !LEEG(p.planning) || !LEEG(a.looptijd) || !LEEG(a.periodeVan) || !LEEG(a.periodeTot);

  if (!heeftLooptijd) {
    ontbrekend.push({ veld: 'looptijd', soort: 'aanvullend' });
    aannames.push({ veld: 'looptijd', tekst: 'De looptijd is niet ingevuld: streefdatums in het actieplan zijn indicatief en gaan uit van vandaag.' });
  }

  // --- Begroting en eigen bijdrage (met mogelijke tegenstrijdigheden) --------------------------------------------------
  const projectBegroting = bedragUitInvoer(p.begroting) > 0 ? bedragUitInvoer(p.begroting) : null;
  const antwoordBegroting = bedragUitInvoer(a.begroting) > 0 ? bedragUitInvoer(a.begroting) : null;
  const eigenProject = bedragUitInvoer(p.eigenBijdrage);
  const eigenAntwoord = bedragUitInvoer(a.eigenBijdrage);
  const eigenBijdrage = eigenAntwoord != null ? eigenAntwoord : eigenProject != null ? eigenProject : 0;

  // Kandidaat-begrotingen: project, antwoord uit het gesprek en documenten, ontdubbeld binnen de tolerantie.
  const kandidaten = [];
  const voegKandidaat = (sleutel, label, bedrag) => {
    if (bedrag == null) return;
    if (kandidaten.some((k) => Math.abs(k.bedrag - bedrag) <= Math.max(1, k.bedrag * BEGROTING_TOLERANTIE))) return;

    kandidaten.push({ sleutel, label, bedrag });
  };

  voegKandidaat('project', 'Begroting in de projectgegevens', projectBegroting);
  voegKandidaat('gesprek', 'Begroting uit dit gesprek', antwoordBegroting);
  docs.forEach((d, i) => voegKandidaat(`doc-${i}`, `Begroting in ${d.bron}`, d.bedrag));

  let begroting = null;
  let begrotingBron = null;

  if (kandidaten.length === 1) {
    begroting = kandidaten[0].bedrag;
    begrotingBron = kandidaten[0].sleutel;

    if (begrotingBron !== 'project') {
      aannames.push({ veld: 'begroting', tekst: `${kandidaten[0].label} (${kandidaten[0].bedrag}) is gebruikt omdat de projectgegevens geen begroting hebben; sla de begroting op in het project om dit vast te leggen.` });
    }
  } else if (kandidaten.length > 1) {
    const keuze = kandidaten.find((k) => k.sleutel === keuzes['begroting']);

    if (keuze) {
      begroting = keuze.bedrag;
      begrotingBron = keuze.sleutel;
    } else {
      tegenstrijdigheden.push({
        sleutel: 'begroting',
        veld: 'begroting',
        opgelost: false,
        tekst: 'Er zijn verschillende begrotingen gevonden. Welk bedrag geldt voor dit project?',
        opties: kandidaten.map((k) => ({ sleutel: k.sleutel, label: k.label, waarde: k.bedrag })),
      });
      vragen.push({
        sleutel: 'begroting-keuze',
        veld: 'begroting',
        soort: 'tegenstrijdig',
        blokkerend: true,
        invoer: 'keuze',
        tekst: 'Er zijn verschillende begrotingen gevonden. Welk bedrag geldt voor dit project?',
        reden: 'Subsidiekompas kiest niet stilzwijgend tussen twee bedragen.',
        opties: kandidaten.map((k) => ({ sleutel: k.sleutel, label: `${k.label}: € ${k.bedrag.toLocaleString('nl-NL')}`, waarde: k.bedrag })),
      });
    }
  }

  const eigenBovenBegroting = begroting != null && eigenBijdrage > begroting;

  if (eigenBovenBegroting) {
    tegenstrijdigheden.push({
      sleutel: 'eigen-boven-begroting',
      veld: 'eigenBijdrage',
      opgelost: false,
      tekst: `De eigen bijdrage (€ ${eigenBijdrage.toLocaleString('nl-NL')}) is hoger dan de begroting (€ ${begroting.toLocaleString('nl-NL')}).`,
      opties: [],
    });
    vragen.push({
      sleutel: 'eigen-boven-begroting',
      veld: 'eigenBijdrage',
      soort: 'tegenstrijdig',
      blokkerend: true,
      invoer: 'bedrag',
      tekst: `De eigen bijdrage (€ ${eigenBijdrage.toLocaleString('nl-NL')}) is hoger dan de begroting (€ ${begroting.toLocaleString('nl-NL')}). Wat is de juiste eigen bijdrage?`,
      reden: 'Met deze cijfers valt er niets te financieren; een van beide klopt niet.',
    });
  }

  const van = tekst(a.periodeVan || p.periodeVan).trim();
  const tot = tekst(a.periodeTot || p.periodeTot).trim();

  if (isEchteDatum(van) && isEchteDatum(tot) && tot < van) {
    tegenstrijdigheden.push({
      sleutel: 'periode',
      veld: 'looptijd',
      opgelost: false,
      tekst: `De einddatum (${tot}) ligt vóór de startdatum (${van}).`,
      opties: [],
    });
    vragen.push({
      sleutel: 'periode',
      veld: 'looptijd',
      soort: 'tegenstrijdig',
      blokkerend: true,
      invoer: 'tekst',
      tekst: `De einddatum (${tot}) ligt vóór de startdatum (${van}). Wat zijn de juiste start- en einddatum?`,
      reden: 'De looptijd bepaalt welke fondsen en deadlines passen.',
    });
  }

  // --- Zonder begroting: onderzoeken mag, bedragen niet ----------------------------------------------------------------
  const geenBegroting = kandidaten.length === 0;

  if (geenBegroting) {
    ontbrekend.push({ veld: 'begroting', soort: 'bedragen' });
    vragen.push({
      sleutel: 'begroting',
      veld: 'begroting',
      soort: 'bedragen',
      blokkerend: false,
      invoer: 'bedrag',
      tekst: "Wat is de totale projectbegroting in euro's?",
      reden: 'Zonder begroting kan Subsidiekompas financiers onderzoeken, maar geen sluitend dekkingsplan met bedragen voorstellen.',
    });
  }

  // Volgorde: blokkerend eerst (essentieel, daarna tegenstrijdig), dan bedragen. Maximaal drie per ronde; de rest volgt.
  const rang = { essentieel: 0, tegenstrijdig: 1, bedragen: 2 };
  const gesorteerd = vragen.slice().sort((x, y) => rang[x.soort] - rang[y.soort]);
  const dezeRonde = gesorteerd.slice(0, MAX_VRAGEN);
  const volgendeRonde = gesorteerd.slice(MAX_VRAGEN);
  const blokkerend = gesorteerd.filter((v) => v.blokkerend);
  const kanOnderzoeken = !ontbrekend.some((o) => o.soort === 'essentieel') && !tegenstrijdigheden.some((t) => !t.opgelost);
  const bedragenToegestaan = kanOnderzoeken && begroting != null && begroting > 0;

  let status = VOORSTEL_STATUS.DEFINITIEF;

  if (blokkerend.length) {
    status = VOORSTEL_STATUS.UITVRAAG;
  } else if (aannames.length || !bedragenToegestaan) {
    status = VOORSTEL_STATUS.CONCEPT;
  }

  return {
    status,
    kanOnderzoeken,
    bedragenToegestaan,
    begroting,
    begrotingBron,
    eigenBijdrage,
    ontbrekend,
    tegenstrijdigheden,
    aannames,
    vragen: dezeRonde,
    volgendeRonde,
  };
}

// ---------------------------------------------------------------------------
// 2. Terugplannen van acties vanaf een geverifieerde fondsdeadline
// ---------------------------------------------------------------------------

// Eerste stap van elk plan zonder betrouwbare deadline. Eén vaste titel, zodat de planningsmotor, dit vangnet en het ontdubbelen dezelfde
// stap herkennen.
export function navragenTitel(naam) {
  return `Contact opnemen met ${naam} over passendheid, aanvraag en behandeltermijn`.slice(0, MAX.titel);
}

// Herkomst van een actiedatum: uit de bron, berekend uit een bekende deadline of termijn, of een voorlopige planningsaanname.
export const DATUM_HERKOMST = ['bron', 'berekend', 'aanname'];
// Fases van het actieplan. 'ontvangst' t/m 'vervolg' vinden NA het indienen plaats en mogen dus na de deadline vallen.
export const ACTIE_FASES = ['navragen', 'passendheid', 'adviseur', 'contact', 'stukken', 'schrijven', 'review', 'indienen', 'ontvangst', 'vragen', 'beoordeling', 'besluit', 'vervolg'];
const NA_INDIENEN = ['ontvangst', 'vragen', 'beoordeling', 'besluit', 'vervolg'];

export function verificatieActie(regel, vandaag) {
  return {
    titel: navragenTitel(regel.naam),
    regelSleutel: regel.sleutel,
    financier: regel.naam,
    datum: isEchteDatum(vandaag) ? voegDagenToe(vandaag, 7) : null,
    datumType: DATUM_TYPE.STREEF,
    externeDeadline: null,
    prioriteit: 'high',
    toelichting: 'Er is nog geen indiendatum bekend. Vraag na of uw project past, wanneer u kunt aanvragen en hoe lang de behandeling duurt.',
    automatisch: true,
    fase: 'navragen',
    datumHerkomst: 'aanname',
    datumBron: 'eigen streefdatum',
    datumControle: null,
  };
}

// Een reeks acties voor één regel met een geverifieerde deadline. Datums liggen nooit vóór vandaag en nooit na de
// deadline; zit er weinig tijd tussen, dan schuiven de stappen naar vandaag toe in dezelfde volgorde.
export function plantTerug(regel, vandaag) {
  const deadline = regel.deadline && regel.deadline.status === DEADLINE_STATUS.GEVERIFIEERD ? regel.deadline.datum : null;

  if (!deadline || !isEchteDatum(deadline) || !isEchteDatum(vandaag)) {
    return [verificatieActie(regel, vandaag)];
  }

  // Slank: alleen indienen op de sluitingsdatum en de uitslag, ongeveer 3 maanden later. Geen losse voorbereidingsstappen.
  return [
    {
      titel: `Aanvraag bij ${regel.naam} indienen`.slice(0, MAX.titel),
      regelSleutel: regel.sleutel,
      financier: regel.naam,
      datum: deadline < vandaag ? vandaag : deadline,
      datumType: DATUM_TYPE.STREEF,
      externeDeadline: deadline,
      prioriteit: 'high',
      toelichting: `Uiterste indiendatum: ${deadline}.`,
      automatisch: true,
      fase: 'indienen',
      datumHerkomst: 'bron',
      datumBron: 'sluitingsdatum van de financier',
      datumControle: null,
    },
    {
      titel: `Uitslag van ${regel.naam} verwacht`.slice(0, MAX.titel),
      regelSleutel: regel.sleutel,
      financier: regel.naam,
      datum: voegDagenToe(deadline < vandaag ? vandaag : deadline, 91),
      datumType: DATUM_TYPE.STREEF,
      externeDeadline: null,
      prioriteit: 'normal',
      toelichting: 'Binnen ongeveer 3 maanden na indienen.',
      automatisch: true,
      fase: 'besluit',
      datumHerkomst: 'aanname',
      datumBron: 'ongeveer 3 maanden na indienen',
      datumControle: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// 2b. Inhoudelijke verificatie tegen de bron
// ---------------------------------------------------------------------------
// Een https-url en een controledatum zijn alleen HERKOMSTGEGEVENS (waar het vandaan komt en wanneer). De inhoud wordt als volgt
// gecontroleerd, in code en niet door het model:
//  * regeling of fonds uit de database: id, naam, bijdragegrenzen en deadline komen UITSLUITEND uit het databaserecord dat de
//    server onder het abonnement van het lid heeft opgehaald (ctx.bekendeBronnen). Een id dat daar niet in staat (verzonnen of
//    niet toegestaan) wordt geweigerd; wat het model over naam, grenzen of deadline zegt telt niet.
//  * online gevonden financier: de server heeft de pagina daadwerkelijk opgehaald (ctx.opgehaaldeBronnen: url, tekst, moment).
//    De url moet daarin voorkomen; de naam van de financier moet in die paginatekst staan; een geciteerd fragment moet letterlijk
//    in de tekst staan; een deadline is alleen 'geverifieerd' als de datum in dat fragment staat; een voorwaarde is alleen
//    bevestigd als haar kernwoorden in de tekst staan, anders wordt het een onzekerheid. Controledatum = het ophaalmoment van de
//    server, niet wat het model opgeeft.
// Dit is een controle op overeenkomst met de opgehaalde tekst, geen juridisch oordeel: de interface toont de bron, het fragment
// en de onzekerheden, en het lid blijft de aanvraagvoorwaarden zelf bevestigen.

const STOPWOORDEN = new Set(['de', 'het', 'een', 'van', 'voor', 'en', 'der', 'den', 'the', 'and', 'bij', 'met', 'op', 'in', 'te', 'aan', 'als', 'of', 'is']);
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function sigWoorden(t) {
  return normaliseerNaam(t)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWOORDEN.has(w));
}

const staatInTekst = (groot, woord) => ` ${groot} `.includes(` ${woord} `);

export function bronUrlSleutel(url) {
  try {
    const u = new URL(tekst(url).trim());

    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch (e) {
    return '';
  }
}

// Staat de datum (in gangbare Nederlandse notaties) in dit fragment?
export function datumInFragment(iso, fragment) {
  if (!isEchteDatum(iso) || !tekst(fragment).trim()) return false;

  const [j, m, d] = iso.split('-');
  const dag = String(Number(d));
  const mnd = String(Number(m));
  const naam = MAANDEN[Number(m) - 1];
  const varianten = [`${j} ${m} ${d}`, `${dag} ${mnd} ${j}`, `${d} ${m} ${j}`, `${dag} ${naam} ${j}`, `${d} ${naam} ${j}`, `${dag} ${naam.slice(0, 3)} ${j}`].map((x) => normaliseerNaam(x));
  const norm = ` ${normaliseerNaam(fragment)} `;

  return varianten.some((x) => norm.includes(` ${x} `));
}

// Controle van één online regel tegen de opgehaalde bronnen. -> { ok, code, bron: { url, gecontroleerdOp, fragment }, deadlineBevestigd, voorwaarden, onbevestigd }
function controleerOnlineBron(r, ruweBron, opgehaald) {
  const url = veiligeUrl(ruweBron && ruweBron.url);

  if (!url) return { ok: false, code: 'online-zonder-bron' };

  const sleutel = bronUrlSleutel(url);
  const entry = (Array.isArray(opgehaald) ? opgehaald : []).find((e) => e && bronUrlSleutel(e.url) === sleutel && tekst(e.tekst).trim());

  if (!entry) return { ok: false, code: 'bron-niet-opgehaald' };

  const gecontroleerdOp = isEchteDatum(tekst(entry.opgehaaldOp).slice(0, 10)) ? tekst(entry.opgehaaldOp).slice(0, 10) : null;

  if (!gecontroleerdOp) return { ok: false, code: 'online-zonder-bron' };

  const norm = normaliseerNaam(entry.tekst);
  const naamWoorden = sigWoorden(r.naam);

  if (!naamWoorden.length || !naamWoorden.every((w) => staatInTekst(norm, w))) return { ok: false, code: 'bron-bevestigt-financier-niet' };

  // Fragment: letterlijk in de paginatekst, anders vervalt het (en daarmee de bevestiging van de deadline).
  const fragmentRuw = kort(ruweBron && ruweBron.fragment, 300);
  const fragmentOk = fragmentRuw && normaliseerNaam(entry.tekst).includes(normaliseerNaam(fragmentRuw));

  const voorwaarden = [];
  const onbevestigd = [];

  lijst(r.voorwaarden, MAX_LIJST, MAX.voorwaarde).forEach((vw) => {
    const w = sigWoorden(vw);
    const gevonden = w.filter((x) => staatInTekst(norm, x)).length;

    (w.length && gevonden / w.length >= 0.6 ? voorwaarden : onbevestigd).push(vw);
  });

  return {
    ok: true,
    bron: { url, gecontroleerdOp, fragment: fragmentOk ? fragmentRuw : null, soort: 'online' },
    fragmentVervallen: Boolean(fragmentRuw) && !fragmentOk,
    voorwaarden,
    onbevestigd,
  };
}

// ---------------------------------------------------------------------------
// 3. Validatie van een voorstel (vóór tonen en vóór opslaan)
// ---------------------------------------------------------------------------

function lijst(v, maxItems, maxTekst) {
  return (Array.isArray(v) ? v : []).map((x) => kort(x, maxTekst)).filter(Boolean).slice(0, maxItems);
}

// Kenmerken van een financier uit de database (alleen om te tonen; heeft geen invloed op bedragen of planning). Alles is begrensd; een onbekend
// veld blijft leeg (null of een lege lijst), zodat de weergave "Nog niet bekend" kan tonen in plaats van iets te verzinnen.
function leesKenmerken(k) {
  if (!k || typeof k !== 'object') return null;

  const url = veiligeUrl(k.website);

  return {
    beschrijving: kort(k.beschrijving, 400) || null,
    doelgroepen: lijst(k.doelgroepen, 10, 80),
    disciplines: lijst(k.disciplines, 10, 80),
    werkgebieden: lijst(k.werkgebieden, 10, 80),
    bandbreedte: kort(k.bandbreedte, 160) || null,
    website: url && url.startsWith('https://') ? url.slice(0, 500) : null,
    passendheid: k.passendheid === 'aantoonbaar' || k.passendheid === 'mogelijk' ? k.passendheid : null,
    controleren: lijst(k.controleren, 6, 220),
  };
}

// grondslag: { database: ISO|null } voor een databaserecord (de datum komt uit het record), of { bron } voor een online bron
// met bevestigd fragment. Een datum die het model zelf noemt wordt nooit overgenomen zonder grondslag.
function leesDeadline(raw, grondslag, vandaag) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const gevraagd = isEchteDatum(tekst(d.datum).slice(0, 10)) ? tekst(d.datum).slice(0, 10) : null;
  const waarschuwingen = [];
  const claimde = d.status === DEADLINE_STATUS.GEVERIFIEERD || Boolean(gevraagd);
  const geef = (datum) => ({ deadline: { status: DEADLINE_STATUS.GEVERIFIEERD, datum, verlopen: isEchteDatum(vandaag) ? datum < vandaag : false }, waarschuwingen });

  if (grondslag && grondslag.database !== undefined) {
    // De databasedatum is leidend; een afwijkende datum van het model wordt genegeerd.
    if (isEchteDatum(grondslag.database)) {
      if (gevraagd && gevraagd !== grondslag.database) waarschuwingen.push('deadline-afwijkend-van-database');

      return geef(grondslag.database);
    }
  } else if (grondslag && grondslag.fragment && gevraagd && d.status === DEADLINE_STATUS.GEVERIFIEERD && datumInFragment(gevraagd, grondslag.fragment)) {
    return geef(gevraagd);
  }

  if (claimde) waarschuwingen.push('deadline-niet-geverifieerd');

  return { deadline: { status: DEADLINE_STATUS.TE_VERIFIEREN, datum: null, verlopen: false }, waarschuwingen };
}

// Past bedragen binnen de grenzen van de regeling. Geeft { bedrag, gecorrigeerd }.
function binnenGrenzen(bedrag, min, max) {
  if (bedrag == null) return { bedrag: null, gecorrigeerd: false };

  let b = bedrag;

  if (max != null && b > max) b = max;
  if (min != null && b < min) b = min;

  return { bedrag: b, gecorrigeerd: b !== bedrag };
}

// raw: het voorstel zoals de server of het model het levert. ctx:
//   projectId          het project waarvoor het voorstel is (moet gelijk zijn aan raw.projectId)
//   dekking            berekenDekking(...) van het project MET de effectieve begroting
//   bestaandeRegels    regels uit het dekkingsplan: [{ schemeId, funderId, naam, financierNaam }] (voor "staat al")
//   bedragenToegestaan zie beoordeelProject; false = alle bedragen worden leeggemaakt
//   vandaag            ISO-datum
//   dekkingsdoel       optioneel, alleen van de server: factor (1 t/m 1,6) waarmee de som het financieringsgat mag overschrijden
// -> { ok, voorstel, fouten: [{ pad, code }], waarschuwingen: [{ pad, code }] }
export function valideerVoorstel(raw, ctx) {
  const c = ctx || {};
  const fouten = [];
  const waarschuwingen = [];
  const fout = (pad, code) => fouten.push({ pad, code });
  const waarschuw = (pad, code) => waarschuwingen.push({ pad, code });
  const vandaag = isEchteDatum(c.vandaag) ? c.vandaag : null;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, voorstel: null, fouten: [{ pad: '', code: 'geen-object' }], waarschuwingen };
  }

  if (raw.versie !== VOORSTEL_VERSIE) {
    return { ok: false, voorstel: null, fouten: [{ pad: 'versie', code: 'onbekende-versie' }], waarschuwingen };
  }

  if (!UUID.test(tekst(raw.projectId)) || raw.projectId !== c.projectId) {
    return { ok: false, voorstel: null, fouten: [{ pad: 'projectId', code: 'ander-project' }], waarschuwingen };
  }

  const status = Object.values(VOORSTEL_STATUS).includes(raw.status) ? raw.status : VOORSTEL_STATUS.CONCEPT;
  const bedragenToegestaan = c.bedragenToegestaan !== false;
  const bestaande = Array.isArray(c.bestaandeRegels) ? c.bestaandeRegels : [];
  const gat = c.dekking && c.dekking.heeftBegroting ? Math.max(0, c.dekking.nogTePlannen || 0) : 0;

  // --- Regels --------------------------------------------------------------------------------------------------------
  const ruweRegels = Array.isArray(raw.regels) ? raw.regels : [];

  if (ruweRegels.length > MAX_REGELS) waarschuw('regels', 'te-veel-regels');

  const regels = [];

  ruweRegels.slice(0, MAX_REGELS).forEach((r, i) => {
    const pad = `regels[${i}]`;

    if (!r || typeof r !== 'object') return fout(pad, 'geen-object');

    const type = Object.values(BRON_SOORT).includes(r.type) ? r.type : null;
    const naam = kort(r.naam, MAX.naam);

    if (!type) return fout(pad, 'onbekend-type');
    if (!naam) return fout(pad, 'naam-ontbreekt');
    if (type !== BRON_SOORT.ONLINE && !UUID.test(tekst(r.id))) return fout(pad, 'ongeldig-id');

    let bron;
    let grondslag;
    let voorwaarden = lijst(r.voorwaarden, MAX_LIJST, MAX.voorwaarde);
    let onzekerheden = lijst(r.onzekerheden, MAX_LIJST, MAX.onzekerheid);
    let regelNaam = naam;
    let grenzenBron = { min: contractBedrag(r.grenzen && r.grenzen.min), max: contractBedrag(r.grenzen && r.grenzen.max) };
    let gever = kort(r.gever, MAX.naam);

    if (type === BRON_SOORT.ONLINE) {
      const ctl = controleerOnlineBron({ ...r, naam }, r.bron, c.opgehaaldeBronnen);

      if (!ctl.ok) return fout(pad, ctl.code);

      bron = ctl.bron;
      grondslag = { fragment: ctl.bron.fragment };
      voorwaarden = ctl.voorwaarden;
      onzekerheden = [...ctl.onbevestigd.map((x) => kort(`Niet bevestigd in de bron: ${x}`, MAX.onzekerheid)), ...onzekerheden].slice(0, MAX_LIJST);

      if (ctl.fragmentVervallen) waarschuw(pad, 'fragment-niet-in-bron');
      if (ctl.onbevestigd.length) waarschuw(pad, 'voorwaarde-niet-bevestigd');
    } else {
      // Regeling of fonds: alles wat telt komt uit het databaserecord dat de server onder het abonnement van het lid ophaalde.
      const rec = c.bekendeBronnen && Object.prototype.hasOwnProperty.call(c.bekendeBronnen, tekst(r.id).toLowerCase()) ? c.bekendeBronnen[tekst(r.id).toLowerCase()] : null;

      if (!rec) return fout(pad, 'onbekende-bron');

      bron = { url: null, gecontroleerdOp: null, soort: 'database' };
      grondslag = { database: isEchteDatum(rec.deadline) ? rec.deadline : null };
      regelNaam = kort(rec.naam, MAX.naam) || naam;
      gever = kort(rec.gever, MAX.naam) || gever;
      grenzenBron = { min: contractBedrag(rec.min), max: contractBedrag(rec.max) };

      // Een cofinancieringseis staat alleen als tekst in de database: die rekenen we niet na, maar ze verdwijnt ook niet stil.
      const cof = kort(rec.cofinanciering, 200);

      if (cof) onzekerheden = [kort(`Cofinancieringseis (niet automatisch gecontroleerd): ${cof}`, MAX.onzekerheid), ...onzekerheden].slice(0, MAX_LIJST);
    }

    const regel = {
      type,
      id: type === BRON_SOORT.ONLINE ? null : tekst(r.id).toLowerCase(),
      naam: regelNaam,
      regeling: kort(r.regeling, MAX.naam),
      gever,
      herkomst: type === BRON_SOORT.ONLINE ? 'online' : 'database',
      bron,
      motivatie: kort(r.motivatie, MAX.motivatie),
      kenmerken: type === BRON_SOORT.ONLINE ? null : leesKenmerken(r.kenmerken),
      onderdeel: kort(r.onderdeel, MAX.onderdeel),
      voorwaarden,
      onzekerheden,
      staatAl: false,
      selecteerbaar: true,
    };

    regel.sleutel = regelSleutelVan(regel);

    // Bedrag: alleen als er een begroting is; binnen de grenzen van de regeling (uit het record, niet van het model).
    const { min, max } = grenzenBron;
    const voorgesteld = bedragenToegestaan ? contractBedrag(r.bedrag) : null;

    if (!bedragenToegestaan && r.bedrag != null && r.bedrag !== '') waarschuw(pad, 'bedrag-zonder-begroting');

    const begrensd = binnenGrenzen(voorgesteld, min, max);

    regel.bedrag = begrensd.bedrag;
    regel.grenzen = { min, max };
    regel.bedragGecorrigeerd = begrensd.gecorrigeerd;

    if (begrensd.gecorrigeerd) waarschuw(pad, 'bedrag-aangepast-aan-grenzen');

    // Deadline: alleen een geverifieerde datum wordt getoond.
    const dl = leesDeadline(r.deadline, grondslag, vandaag);

    regel.deadline = dl.deadline;
    dl.waarschuwingen.forEach((code) => waarschuw(pad, code));

    // Staat deze financier al in het dekkingsplan? Dan wordt hij niet (opnieuw) toegevoegd en nooit overschreven.
    regel.staatAl = bestaande.some((b) =>
      type === BRON_SOORT.REGELING
        ? b.schemeId === regel.id
        : type === BRON_SOORT.FONDS
          ? b.funderId === regel.id
          : zelfdeFinancier(b.financierNaam || b.naam, regel.naam),
    );

    if (regel.staatAl) {
      regel.selecteerbaar = false;
      regel.bedrag = null;
    }

    // Het bedrag zoals voorgesteld, vóór wijzigingen van het lid in de preview. Alleen ter vergelijking; telt nergens mee.
    regel.oorspronkelijkBedrag = regel.bedrag;

    // Dubbel binnen het voorstel zelf.
    if (regels.some((x) => x.sleutel === regel.sleutel || (x.type === BRON_SOORT.ONLINE && regel.type === BRON_SOORT.ONLINE && zelfdeFinancier(x.naam, regel.naam)))) {
      waarschuw(pad, 'dubbel-in-voorstel');

      return;
    }

    regels.push(regel);
  });

  // --- Totalen en financieringsgat -------------------------------------------------------------------------------------
  const som = regels.filter((r) => r.selecteerbaar).reduce((t, r) => t + (r.bedrag || 0), 0);

  if (som > toegestaneSom(gat, c.dekkingsdoel)) fout('regels', 'boven-financieringsgat');

  // --- Acties --------------------------------------------------------------------------------------------------------
  const ruweActies = Array.isArray(raw.acties) ? raw.acties : [];
  const acties = [];

  if (ruweActies.length > MAX_ACTIES) waarschuw('acties', 'te-veel-acties');

  ruweActies.slice(0, MAX_ACTIES).forEach((a, i) => {
    const pad = `acties[${i}]`;

    if (!a || typeof a !== 'object') return fout(pad, 'geen-object');

    const titel = kort(a.titel, MAX.titel);

    if (!titel) return fout(pad, 'titel-ontbreekt');

    const regel = a.regelSleutel ? regels.find((r) => r.sleutel === a.regelSleutel) : null;

    if (a.regelSleutel && !regel) waarschuw(pad, 'onbekende-regel');

    let datum = isEchteDatum(tekst(a.datum).slice(0, 10)) ? tekst(a.datum).slice(0, 10) : null;
    const extern = regel && regel.deadline.status === DEADLINE_STATUS.GEVERIFIEERD ? regel.deadline.datum : null;

    // Het model kan geen externe deadline verzinnen: de externe datum komt uitsluitend van een geverifieerde regel.
    if (a.datumType === DATUM_TYPE.EXTERN && !extern) {
      datum = null;
      waarschuw(pad, 'externe-datum-niet-geverifieerd');
    } else if (a.datumType === DATUM_TYPE.EXTERN && extern) {
      datum = extern;
    }

    // Terugplanning: een interne streefdatum ligt niet in het verleden en niet na de externe deadline.
    const fase = ACTIE_FASES.includes(a.fase) ? a.fase : null;

    if (datum && a.datumType !== DATUM_TYPE.EXTERN) {
      if (vandaag && datum < vandaag) {
        datum = vandaag;
        waarschuw(pad, 'streefdatum-verleden');
      }

      // Opvolging (ontvangst, beoordeling, besluit) vindt na het indienen plaats en mag dus na de deadline liggen.
      if (extern && datum > extern && !NA_INDIENEN.includes(fase)) {
        datum = vandaag && voegDagenToe(extern, -3) < vandaag ? vandaag : voegDagenToe(extern, -3);
        waarschuw(pad, 'streefdatum-na-deadline');
      }
    }

    const actie = {
      titel,
      regelSleutel: regel ? regel.sleutel : null,
      financier: kort(a.financier, MAX.naam) || (regel ? regel.naam : ''),
      datum,
      datumType: a.datumType === DATUM_TYPE.EXTERN && extern ? DATUM_TYPE.EXTERN : DATUM_TYPE.STREEF,
      externeDeadline: extern,
      prioriteit: PRIORITEITEN.includes(a.prioriteit) ? a.prioriteit : 'normal',
      toelichting: kort(a.toelichting, MAX.toelichting),
      automatisch: a.automatisch === true,
      fase,
      datumHerkomst: datum && DATUM_HERKOMST.includes(a.datumHerkomst) ? a.datumHerkomst : null,
      datumBron: datum ? kort(a.datumBron, 300) || null : null,
      datumControle: datum && isEchteDatum(tekst(a.datumControle).slice(0, 10)) ? tekst(a.datumControle).slice(0, 10) : null,
    };

    actie.sleutel = actieSleutelVan(actie);

    if (acties.some((x) => x.sleutel === actie.sleutel)) {
      waarschuw(pad, 'dubbele-actie');

      return;
    }

    acties.push(actie);
  });

  // Een regel zonder geverifieerde deadline krijgt altijd een verificatietaak: nooit een verzonnen datum, wel een vervolgstap.
  regels
    .filter((r) => r.selecteerbaar && r.deadline.status !== DEADLINE_STATUS.GEVERIFIEERD)
    .forEach((r) => {
      const v = verificatieActie(r, vandaag);

      v.sleutel = actieSleutelVan(v);

      if (!acties.some((x) => x.sleutel === v.sleutel)) acties.push(v);
    });

  const voorstel = {
    versie: VOORSTEL_VERSIE,
    projectId: raw.projectId,
    gegenereerdOp: isEchteDatum(tekst(raw.gegenereerdOp).slice(0, 10)) ? tekst(raw.gegenereerdOp).slice(0, 10) : vandaag,
    status,
    aannames: (Array.isArray(raw.aannames) ? raw.aannames : []).map((x) => kort(x && x.tekst != null ? x.tekst : x, 300)).filter(Boolean).slice(0, 8),
    regels,
    nietToegewezen: Math.max(0, gat - som),
    acties,
  };

  return { ok: fouten.length === 0, voorstel, fouten, waarschuwingen };
}

// ---------------------------------------------------------------------------
// 4. Live totalen voor de preview (selectie en aangepaste bedragen)
// ---------------------------------------------------------------------------

// selectie: Set of array met regelsleutels; standaard alle selecteerbare regels.
export function berekenTotalen(voorstel, dekking, selectie) {
  const geselecteerd = selectie ? new Set(selectie) : null;
  const regels = (voorstel && voorstel.regels ? voorstel.regels : []).filter((r) => r.selecteerbaar && (!geselecteerd || geselecteerd.has(r.sleutel)));
  const voorgesteld = regels.reduce((t, r) => t + (r.bedrag || 0), 0);
  const heeftBegroting = Boolean(dekking && dekking.heeftBegroting);
  const gat = heeftBegroting ? Math.max(0, dekking.nogTePlannen || 0) : 0;

  return {
    aantal: regels.length,
    voorgesteld,
    gat,
    nietToegewezen: Math.max(0, gat - voorgesteld),
    overboeking: Math.max(0, voorgesteld - gat),
    // Na opslag telt dit als Gepland (status 'interesting'), nooit als Aangevraagd of Toegekend.
    nieuwGepland: (dekking ? dekking.gepland || 0 : 0) + voorgesteld,
    nieuwNogTePlannen: heeftBegroting ? Math.max(0, gat - voorgesteld) : 0,
    zonderBedrag: regels.filter((r) => r.bedrag == null).length,
  };
}

// Brengt de bedragen terug tot het financieringsgat: evenredig verlaagd, op hele euro's, nooit onder het minimum van de
// regeling (kan dat niet, dan valt de regel met het laagste bedrag af). De bedragen verhogen gebeurt hier nooit.
export function schaalNaarGat(regels, gat) {
  const lijstRegels = (regels || []).map((r) => ({ ...r }));
  const selecteerbaar = () => lijstRegels.filter((r) => r.selecteerbaar && r.bedrag);
  let som = selecteerbaar().reduce((t, r) => t + r.bedrag, 0);

  if (som <= gat || som === 0) {
    return lijstRegels;
  }

  const factor = gat / som;

  selecteerbaar().forEach((r) => {
    const min = r.grenzen && r.grenzen.min != null ? r.grenzen.min : 0;

    r.bedrag = Math.max(min, Math.floor(r.bedrag * factor));
  });

  som = selecteerbaar().reduce((t, r) => t + r.bedrag, 0);

  // Door minima kan de som nog boven het gat liggen: laat de kleinste regel vallen tot het past.
  while (som > gat && selecteerbaar().length) {
    const kleinste = selecteerbaar().sort((x, y) => x.bedrag - y.bedrag)[0];

    som -= kleinste.bedrag;
    kleinste.bedrag = null;
    kleinste.selecteerbaar = false;
  }

  return lijstRegels;
}

// Weergave van de verificatiemetadata die de SERVER bij een voorgestelde regel heeft vastgelegd (kolom funding.voorstel, versie 2,
// gelezen via de gemaskeerde RPC kompas_voorstel_metadata). De client BOUWT deze metadata nooit: de database weigert elke
// schrijfpoging van een ingelogd lid, en alleen de Edge Function (service_role) kan haar aanmaken na zelf de bron te hebben opgehaald.
//
// Regel voor de interface: het woord "geverifieerd" verschijnt alleen als de metadata van de server komt (versie 2 én
// server_generated === true) én de server de status 'geverifieerd' heeft vastgelegd. Alles wat daar niet aan voldoet, wordt getoond als
// "niet gecontroleerd". De status van de server wordt hier niet opnieuw berekend of "verbeterd".
export const VERIFICATIE_STATUS = { GEVERIFIEERD: 'geverifieerd', GEDEELTELIJK: 'gedeeltelijk', ONZEKER: 'onzeker', CONFLICT: 'conflict', NIET_GECONTROLEERD: 'niet_gecontroleerd' };
export const VELD_STATUS = { BEVESTIGD: 'confirmed', ONZEKER: 'uncertain', CONFLICT: 'conflict', NIET_GECONTROLEERD: 'not_checked' };

export const VERIFICATIE_LABEL = {
  geverifieerd: 'Geverifieerd door Subsidie Kompas',
  gedeeltelijk: 'Gedeeltelijk geverifieerd',
  onzeker: 'Onzeker',
  conflict: 'Conflict tussen database en website',
  niet_gecontroleerd: 'Niet gecontroleerd',
};

export const VELD_LABEL = {
  fondsnaam: 'Fondsnaam', deadline: 'Deadline', bedrag_min: 'Minimale bijdrage', bedrag_max: 'Maximale bijdrage', voorwaarden: 'Voorwaarden',
  cofinanciering: 'Cofinanciering', doelgroep: 'Doelgroep', aanvragertype: 'Type aanvrager', geografie: 'Werkgebied',
};

export const GEEN_BRONCONTROLE = 'Bron kon niet automatisch worden gecontroleerd.';

// -> null (regel is niet voorgesteld) | { status, label, serverGeverifieerd, bronUrl, gecontroleerdOp,
//      bevestigd: [label], onzeker: [label], nietGecontroleerd: [label], conflicten: [{ veld, label, online, database, fragment }], melding }
export function verificatieWeergave(meta) {
  if (!meta || typeof meta !== 'object') return null;

  const vanServer = meta.versie === 2 && meta.server_generated === true;
  const ver = vanServer && meta.verificatie && typeof meta.verificatie === 'object' ? meta.verificatie : null;
  const bekend = ver && Object.keys(VERIFICATIE_LABEL).indexOf(ver.status) !== -1;
  const status = bekend ? ver.status : VERIFICATIE_STATUS.NIET_GECONTROLEERD;
  const velden = bekend && ver.velden && typeof ver.velden === 'object' ? ver.velden : {};
  const uit = { status, label: VERIFICATIE_LABEL[status], serverGeverifieerd: status === VERIFICATIE_STATUS.GEVERIFIEERD, bronUrl: null, gecontroleerdOp: null, bevestigd: [], onzeker: [], nietGecontroleerd: [], conflicten: [], melding: '' };

  if (bekend) {
    const url = veiligeUrl(ver.bron_url);
    uit.bronUrl = url && url.indexOf('https://') === 0 ? url : null;
    uit.gecontroleerdOp = typeof ver.gecontroleerd_op === 'string' ? ver.gecontroleerd_op.slice(0, 10) : null;
  }

  Object.keys(VELD_LABEL).forEach((naam) => {
    const v = velden[naam];
    const label = VELD_LABEL[naam];

    if (!v || typeof v !== 'object' || v.status === VELD_STATUS.NIET_GECONTROLEERD) uit.nietGecontroleerd.push(label);
    else if (v.status === VELD_STATUS.BEVESTIGD) uit.bevestigd.push(label);
    else if (v.status === VELD_STATUS.ONZEKER) uit.onzeker.push(label);
    else if (v.status === VELD_STATUS.CONFLICT) uit.conflicten.push({ veld: naam, label, online: String(v.waarde || ''), database: String(v.db_waarde || ''), fragment: String(v.fragment || '') });
    else uit.nietGecontroleerd.push(label);
  });

  if (status === VERIFICATIE_STATUS.NIET_GECONTROLEERD) uit.melding = GEEN_BRONCONTROLE;

  return uit;
}

// Het huidige dekkingsplan-regel (requested, status) naast de oorspronkelijke voorstelmetadata: wat is door het lid gewijzigd?
// De metadata is onveranderlijk; wijzigingen staan alleen in de gewone kolommen. Alleen voor weergave.
export function vergelijkMetVoorstel(huidig, meta) {
  if (!huidig || !meta || typeof meta !== 'object') return null;

  const voorgesteld = Number.isFinite(meta.voorgesteld_bedrag) ? meta.voorgesteld_bedrag : null;
  const nu = Number.isFinite(huidig.requested) ? huidig.requested : null;
  const bedragGewijzigd = voorgesteld !== nu;
  const statusGewijzigd = huidig.status !== 'interesting';

  return {
    voorgesteldBedrag: voorgesteld,
    huidigBedrag: nu,
    bedragGewijzigd,
    statusGewijzigd,
    status: huidig.status,
    aangepast: bedragGewijzigd || statusGewijzigd,
    voorgesteldOp: meta.voorgesteld_op || null,
    herkomst: meta.herkomst || null,
  };
}

// Schalen met volledige hercontrole. schaalNaarGat alleen verlaagt bedragen en respecteert de minima; daarna wordt het
// HELE voorstel opnieuw door valideerVoorstel gehaald (bijdragegrenzen uit het databaserecord, gat, dubbelen, bestaande regels,
// acties en deadlines), zodat de uitkomst nooit minder streng gecontroleerd is dan het origineel.
// -> zelfde vorm als valideerVoorstel, plus { geschaald: boolean }
export function schaalEnControleer(raw, ctx) {
  const eerste = valideerVoorstel(raw, ctx);

  if (!eerste.voorstel || !eerste.fouten.some((f) => f.code === 'boven-financieringsgat')) {
    return { ...eerste, geschaald: false };
  }

  const c = ctx || {};
  const gat = c.dekking && c.dekking.heeftBegroting ? Math.max(0, c.dekking.nogTePlannen || 0) : 0;
  const geschaald = schaalNaarGat(eerste.voorstel.regels, toegestaneSom(gat, c.dekkingsdoel));
  const perSleutel = new Map(geschaald.map((r) => [r.sleutel, r]));
  const ruweRegels = Array.isArray(raw.regels) ? raw.regels : [];
  const nieuweRegels = [];
  const vervallen = [];

  ruweRegels.forEach((r) => {
    const sleutel = r && r.type ? regelSleutelVan({ type: r.type, id: tekst(r.id).toLowerCase(), naam: kort(r.naam, MAX.naam) }) : null;
    const g = sleutel ? perSleutel.get(sleutel) : null;

    if (!g) {
      nieuweRegels.push(r);

      return;
    }

    if (g.selecteerbaar && g.bedrag) nieuweRegels.push({ ...r, bedrag: g.bedrag });
    else if (!g.selecteerbaar && !g.staatAl) vervallen.push(sleutel);
    else nieuweRegels.push(r);
  });

  const tweede = valideerVoorstel({ ...raw, regels: nieuweRegels }, c);

  return {
    ...tweede,
    geschaald: true,
    waarschuwingen: [...tweede.waarschuwingen, { pad: 'regels', code: 'bedragen-geschaald' }, ...vervallen.map((sl) => ({ pad: sl, code: 'regel-vervallen-door-gat' }))],
  };
}
