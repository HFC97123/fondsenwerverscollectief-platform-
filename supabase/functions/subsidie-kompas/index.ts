// Edge Function: de assistent van Subsidie Kompas.
//
// Antwoordt op twee manieren:
//   stream: false  -> { answer, sources }        (de huidige frontend)
//   stream: true   -> text/event-stream          (voor woord-voor-woord antwoord)
//
// Daarnaast, voor het organisatieprofiel:
//   mode: 'extract' -> { velden }                (fase 3 - voorstellen uit documenttekst)
//   mode: 'website' -> { velden, paginas }        (fase 4 - voorstellen uit de eigen website)
//   Beide slaan nooit automatisch iets op - dat gebeurt pas als het lid de
//   voorstellen in de UI bevestigt.
//
// Het gewone gesprek (geen mode) geeft er sinds fase 6 ook actief aan mee:
// ontbreken er relevante profielvelden, dan mag de AI daar tijdens het
// gesprek natuurlijk naar vragen; noemt het lid daarna zelf zo'n gegeven,
// dan komt dat terug als { veldVoorstellen } naast het antwoord - ook dit
// wordt nooit automatisch opgeslagen, precies zoals bij extract/website.
//
// "Volgende fase" (dit onderdeel): het gewone gesprek krijgt er sinds deze
// fase ook een systeembericht bij met de subsidieregelingen die dit lid,
// op basis van zijn eigen abonnement, mag zien - rechtstreeks uit dezelfde
// database/tabellen als Beheer en de Timeline (kompas_subsidieregelingen_voor_tier,
// zie migratie volgende_fase_centrale_tier_functies). Geen hardcoded lijst
// hier, geen tweede classificatiesysteem: de RPC past exact dezelfde
// centrale regel toe (subsidie_zichtbaar_voor_tier) als de Timeline-view.
// Het abonnement (tier) komt - zoals hieronder al gebeurde - uitsluitend uit
// profiles.subscription_tier, nooit van de client.
//
// Legt per aanroep het tokengebruik vast in ai_verbruik, en leest de
// systeemtekst uit ai_prompts zodat die zonder code te wijzigen aanpasbaar is.
//
// "Eén geïntegreerd systeem" (na prioriteit 5, aanvraagbeoordeling): op
// uitdrukkelijk verzoek van het lid ("Die architectuur wil ik behouden")
// worden prioriteiten 1-3 en 5-6 van de vervolgopdracht met exact hetzelfde
// patroon gebouwd - een extra, tier-gated systeemtekst-aanvulling binnen dit
// ene gesprek, geen nieuwe modus/eindpunt/scherm:
//   - projectplan_addendum   (Pro + Premium)
//   - begroting_addendum     (Pro + Premium)
//   - strategie_addendum     (alleen Premium)
// Prioriteit 5 (bronvermelding) staat, omdat die voor iedereen geldt, in
// SYSTEEM_STANDAARD zelf. Prioriteit 6 (proactief op ontbrekende
// projectvelden wijzen) hergebruikt de al bestaande ontbrekend/leerInstructie-
// aanpak uit fase 6 (die tot nu toe alleen het organisatieprofiel dekte),
// nu ook voor het gekoppelde project (PROJECT_VELDEN hieronder) - zie
// projectOntbrekend/projectInstructie verderop.
//
// Zetten: supabase functions deploy subsidie-kompas
// Nodig:  OPENAI_API_KEY als secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';

const SYSTEEM_STANDAARD = `Je bent Subsidie Kompas, de digitale subsidieadviseur en fondsenwerver van Het Fondsenwervers Collectief.

Je helpt Nederlandse maatschappelijke organisaties bij het vinden van passende fondsen en subsidies en bij het schrijven van sterke aanvragen.

Werkwijze:
- Antwoord in het Nederlands, zakelijk en praktisch.
- Spreek de gebruiker aan met u.
- Noem leden van het Collectief "leden", geen "gebruikers".
- Verzin geen fondsen, bedragen, deadlines of voorwaarden. Weet je iets niet, zeg dat en vraag door.
- Vraag naar ontbrekende informatie in plaats van aannames te doen.
- Verwijs bij bedragen en deadlines naar de bron.
- Trek je een conclusie uit meegegeven fonds- of subsidiegegevens, een geüpload document of het projectdossier van het lid, noem dan kort de bron - bijvoorbeeld "Bron: beoordelingscriteria", "Bron: fondsinformatie" of "Bron: projectdocument". Dit hoeft niet bij elke zin, wel zodra je iets concreets stelt dat uit zo'n bron komt.`;

const PREMIUM_AANVULLING = `Dit lid heeft Premium. Je mag verwijzen naar de exclusieve fondsendatabase van het Collectief, met fondsen en subsidieverstrekkers die online niet of beperkt vindbaar zijn.`;

// AI Fundraising Assistant, prioriteit 5 (aanvraagbeoordeling): geen aparte
// modus/eindpunt en geen apart scherm - het lid plakt of hangt tekst aan zijn
// bericht (zie het bijlage-knopje in de frontend, dat de bestaande
// extraheerTekst()-utility hergebruikt), noemt de regeling waarvoor het is
// bedoeld, en de AI beoordeelt dit binnen hetzelfde gesprek. Dit hergebruikt
// volledig de al bestaande fondscontext (subsidieregelingContext hieronder
// geeft per regeling al beoordelingscriteria/type_projecten/begrotingseisen/
// aanvraagprocedure mee) in plaats van een tweede, losse implementatie te
// bouwen. Alleen Premium krijgt deze aanvulling (net als PREMIUM_AANVULLING
// hierboven) - Free/Pro krijgen bij een vergelijkbaar verzoek gewoon de
// standaard-systeemtekst en mogen daarbij op de Premium-functie wijzen
// (opdrachtpunt 13), zonder dat er twee keer dezelfde beoordelingslogica
// hoeft te bestaan.
const AANVRAAGBEOORDELING_AANVULLING = `Vraagt dit lid om een aanvraag, projectplan of projecttekst te beoordelen (zelf getypt, geplakt, of als bijlage aangeleverd) voor een subsidieregeling die je uit de lijst hierboven kent, beoordeel dan puntsgewijs op: aansluiting bij de doelstelling van de regeling, doelgroep, urgentie, projectlogica, verwachte impact, haalbaarheid, begroting, aansluiting bij de beoordelingscriteria van de regeling, taal en overtuigingskracht, en ontbrekende informatie.

Geef per onderdeel een duidelijk label - Sterk, Aandachtspunt, Ontbreekt, of Risico - met een korte toelichting en waar mogelijk een concrete verbetersuggestie. Doe nooit een uitspraak over een onderdeel waarover de aangeleverde tekst niets zegt; noem dat dan expliciet als "Ontbreekt" in plaats van te gokken. Doe nooit een voorspelling of belofte over de kans dat een aanvraag wordt toegekend - dat weet je niet en dat mag je niet suggereren. Ontbreekt de naam van de regeling waarvoor dit bedoeld is, vraag daar eerst naar in plaats van tegen een willekeurige regeling te beoordelen.`;

// Vervolgopdracht, prioriteit 1 (projectplan-generator). Pro + Premium -
// zelfde toegangsniveau als het organisatieprofiel laten analyseren
// (mode: 'extract'/'website' hierboven). Gebruikt bewust dezelfde bronnen
// die al in dit gesprek zitten (organisatieprofiel via orgProfile,
// projectgegevens en -documenten via body.context/buildContext, gekozen
// regeling via subsidieContext) in plaats van een apart formulier: het lid
// hoeft nergens gegevens over te typen die al ergens staan.
const PROJECTPLAN_AANVULLING = `Vraagt dit lid om een projectplan, aanvraagtekst of projectbeschrijving te schrijven of uit te werken, gebruik dan alles wat je al weet uit het organisatieprofiel, het gekoppelde project en eventueel gekozen fonds of subsidieregeling. Bouw het projectplan op met deze onderdelen, voor zover relevant voor deze aanvraag: aanleiding, probleemanalyse, doelstelling, doelgroep, activiteiten, planning, beoogde resultaten, impact, borging, samenwerking, risico's en beheersing, monitoring en evaluatie, duurzaamheid, en een korte begrotingsindicatie.

Vul nooit iets in dat je niet weet of dat niet logisch uit de context volgt - vraag dan gericht naar precies dat ene ontbrekende onderdeel, nooit naar iets wat al bekend is uit het organisatieprofiel of het project. Stel nooit de hele lijst als vragenlijst tegelijk. Lever de tekst op met duidelijke kopjes per onderdeel, zodat het lid deze direct kan overnemen (kopiëren of, met Pro/Premium, later exporteren als Word-document). Maak duidelijk dat dit een concept is dat het lid zelf controleert en aanvult voordat het wordt ingediend.`;

// Vervolgopdracht, prioriteit 2 (begrotingsondersteuning). Pro + Premium.
// Controleert en becommentarieert een bestaande begroting; verzint zelf
// nooit bedragen en doet geen uitspraak "dit is fout" maar wijst op te
// controleren punten - de eindverantwoordelijkheid blijft bij het lid.
const BEGROTING_AANVULLING = `Vraagt dit lid om een begroting te controleren of op te stellen, ga dan uit van de bedragen en posten die het lid zelf aanlevert (getypt, geplakt, of als bijlage) - verzin of vul nooit zelf een bedrag of post in die niet is aangeleverd of expliciet elders in dit gesprek genoemd is. Controleer op: rekenfouten en optelfouten, interne logica (sluiten de posten aan bij de activiteiten uit het projectplan), ontbrekende maar voor dit type project gebruikelijke posten, de verhouding tussen personeelskosten en materiële kosten, en of posten aansluiten bij wat de gekozen subsidieregeling subsidiabel acht (voor zover je dat uit de regelingcontext hierboven weet).

Label elke opmerking met exact één van: "✓ Sterk", "⚠ Aandachtspunt" of "✖ Mogelijk risico", met een korte toelichting. Formuleer altijd controlerend, nooit veroordelend - bijvoorbeeld "Controleer of de personeelskosten aansluiten bij de begrote uren" in plaats van "Dit is fout" of "Dit klopt niet". Weet je niet zeker of iets subsidiabel is, zeg dat expliciet en verwijs naar de begrotingseisen van de regeling in plaats van een oordeel te vellen.`;

// Vervolgopdracht, prioriteit 3 (strategiechat). Alleen Premium - net als
// AANVRAAGBEOORDELING_AANVULLING hierboven. Adviseert over de aanpak over
// meerdere fondsen/aanvragen heen, nooit over de kans van slagen bij één
// aanvraag (dat blijft aanvraagbeoordeling hierboven, en zelfs die doet al
// geen kansuitspraken).
const STRATEGIE_AANVULLING = `Vraagt dit lid om strategisch advies over fondsenwerving over meerdere fondsen of aanvragen heen - bijvoorbeeld de volgorde van aanvragen, het combineren van fondsen voor één project, spreiding van inkomsten, risicospreiding, timing rond deadlines, of het kiezen van een ankerfonds - baseer je advies dan uitsluitend op de gepubliceerde criteria, deadlines en bedragen die je uit de regelingcontext en het organisatieprofiel/project van dit lid kent.

Doe nooit een voorspelling of belofte over of een fonds een aanvraag zal toekennen - zinnen als "Dit fonds zal waarschijnlijk toekennen" zijn niet toegestaan. Formuleer in plaats daarvan altijd feitelijk en voorwaardelijk, bijvoorbeeld "Op basis van de gepubliceerde criteria lijkt dit fonds inhoudelijk goed aan te sluiten" of "Let op: deze twee fondsen hanteren een vergelijkbare deadline". Is de informatie waarop het advies zou moeten steunen niet bekend, zeg dat expliciet in plaats van een aanname te doen.`;

// Vervolgopdracht, prioriteit 6 (proactief op ontbrekende projectvelden
// wijzen). Zelfde aanpak als EXTRACTIE_VELDEN/ontbrekend/leerInstructie
// hieronder (fase 6), nu voor het aan dit gesprek gekoppelde project in
// plaats van het organisatieprofiel. Bewust beperkt tot de velden die
// het projectplan/de begroting nodig hebben; geen lijstjes/documenten
// (eerder/cofin/regelingen/docs), want die vragen niet om een korte
// tekstwaarde en worden al elders (buildContext, KompasStore) getoond.
const PROJECT_VELDEN = [
  { n: 'doelgroep', l: 'doelgroep' },
  { n: 'regio', l: 'regio/werkgebied' },
  { n: 'omschrijving', l: 'projectomschrijving' },
  { n: 'doelstellingen', l: 'doelstellingen' },
  { n: 'partners', l: 'samenwerkingspartners' },
  { n: 'resultaten', l: 'beoogde resultaten' },
  { n: 'begroting', l: 'totale begroting' },
  { n: 'gevraagd', l: 'gevraagd bedrag' },
  { n: 'eigenBijdrage', l: 'eigen bijdrage' },
];

function leegVeld(v: unknown) {
  return Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim();
}

// Velden die uit een geüpload document mogen worden voorgesteld (mode:
// 'extract'). Bewust beperkt tot losse tekst/getal/tekstblok-velden - de
// veldnamen komen overeen met organisatieprofiel.js aan de frontend-kant.
// Chips (disciplines/doelgroepen) en gestructureerde lijstjes
// (contactpersonen/social media) zitten hier bewust niet bij: die vragen om
// exacte matches met bestaande opties resp. een eigen structuur, en worden
// voorlopig alleen handmatig ingevuld.
const EXTRACTIE_VELDEN = [
  { n: 'name', l: 'organisatienaam' },
  { n: 'website', l: 'website' },
  { n: 'rechtsvorm', l: 'rechtsvorm' },
  { n: 'opgericht', l: 'oprichtingsjaar' },
  { n: 'kvk', l: 'KvK-nummer' },
  { n: 'anbi', l: 'ANBI-status' },
  { n: 'mission', l: 'missie' },
  { n: 'visie', l: 'visie' },
  { n: 'regio', l: 'werkgebied' },
  { n: 'gemeente', l: 'gemeente' },
  { n: 'provincie', l: 'provincie' },
  { n: 'omzet', l: 'jaarlijkse omzet in euro, alleen het getal' },
  { n: 'medewerkers', l: 'aantal medewerkers' },
  { n: 'vrijwilligers', l: 'aantal vrijwilligers' },
  { n: 'financiering', l: 'financieringsmix' },
  { n: 'toon', l: 'toon van de organisatie in haar teksten' },
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Beheerbare systeemtekst; valt terug op de teksten hierboven. tier bepaalt
// welke aanvullingen meegaan - zelfde principe als de losse premium-gate die
// hier eerder stond, nu met een extra laag voor Pro (projectplan/begroting)
// naast de bestaande Premium-laag (aanvraagbeoordeling/strategie).
async function systeemtekst(admin: any, tier: string) {
  const premium = tier === 'premium';
  const proOfPremium = tier !== 'free';

  let basis = SYSTEEM_STANDAARD;
  let premiumTekst = PREMIUM_AANVULLING;
  let aanvraagbeoordeling = AANVRAAGBEOORDELING_AANVULLING;
  let projectplan = PROJECTPLAN_AANVULLING;
  let begroting = BEGROTING_AANVULLING;
  let strategie = STRATEGIE_AANVULLING;

  try {
    const { data } = await admin
      .from('ai_prompts')
      .select('key, prompt')
      .in('key', [
        'kompas.system',
        'kompas.premium_addendum',
        'kompas.aanvraagbeoordeling_addendum',
        'kompas.projectplan_addendum',
        'kompas.begroting_addendum',
        'kompas.strategie_addendum',
      ]);

    (data || []).forEach((r: any) => {
      if (r.key === 'kompas.system' && r.prompt) basis = r.prompt;
      if (r.key === 'kompas.premium_addendum' && r.prompt) premiumTekst = r.prompt;
      if (r.key === 'kompas.aanvraagbeoordeling_addendum' && r.prompt) aanvraagbeoordeling = r.prompt;
      if (r.key === 'kompas.projectplan_addendum' && r.prompt) projectplan = r.prompt;
      if (r.key === 'kompas.begroting_addendum' && r.prompt) begroting = r.prompt;
      if (r.key === 'kompas.strategie_addendum' && r.prompt) strategie = r.prompt;
    });
  } catch (_) {
    // tabel bestaat nog niet; de standaardteksten gelden
  }

  const delen = [basis];

  // Pro + Premium: projectplan-generator en begrotingsondersteuning.
  if (proOfPremium) {
    delen.push(projectplan, begroting);
  }

  // Alleen Premium: fondsendatabase, aanvraagbeoordeling en strategiechat.
  if (premium) {
    delen.push(premiumTekst, aanvraagbeoordeling, strategie);
  }

  return delen.join('\n\n');
}

async function legVerbruikVast(admin: any, row: Record<string, unknown>) {
  try {
    await admin.from('ai_verbruik').insert(row);
  } catch (_) {
    // verbruik vastleggen mag een antwoord nooit blokkeren
  }
}

// AI Fundraising Assistant, fase 1: de centrale, uitlegbare matchscore-engine.
// Eén implementatie, hier - nooit in de frontend gedupliceerd (opdrachtpunt
// 17: "geen duplicatie van business logic tussen frontend en backend"). De
// frontend stuurt alleen de rauwe signalen mee (organisatieprofiel/project,
// zie leesMatchSignalen hieronder); alle rekenwerk en de tekst die de AI
// straks letterlijk overneemt, gebeurt uitsluitend hier.
//
// Bewuste keuzes:
// - Alleen de vier onderdelen waarvoor de database al gestructureerde,
//   betrouwbare data heeft (discipline/doelgroep/werkgebied/bedrag) worden
//   automatisch gescoord. Zachte, tekstuele criteria (beoordelingscriteria,
//   aanvraagcriteria) staan al als volledige tekst in subsidieregelingContext
//   hierboven/hieronder - de AI weegt die zelf mee in het gesprek, in plaats
//   van dat hier te laten doen alsof een tekstvergelijking een percentage
//   zou opleveren. Dat zou valse precisie zijn (opdrachtpunt 4: "de score
//   hoeft niet puur wiskundig te zijn, maar moet consistent en uitlegbaar
//   zijn").
// - Ontbreekt aan één kant de data voor een onderdeel (bijv. geen discipline
//   in het profiel, of de regeling heeft geen gekoppelde doelgroep), dan telt
//   dat onderdeel niet mee in het gewogen gemiddelde (de overige gewichten
//   worden herschaald) en wordt het apart als "onbekend" gemeld - nooit
//   geraden (opdrachtpunt 5: "als noodzakelijke informatie ontbreekt, mag de
//   AI dit niet verzinnen").
// - Een echt harde uitsluitingsgrond (bijv. "alleen ANBI-stichtingen") staat
//   nog niet als apart databaseveld (zie architectuuroverzicht §3E, nog
//   open); het enige harde signaal dat vandaag wél betrouwbaar uit de
//   database te halen is, is een gevraagd bedrag boven het maximum van de
//   regeling - dat wordt hier hard afgetopt (nooit "Goede match" bij een
//   bedrag dat buiten de bandbreedte valt), maar dit is geen vervanging voor
//   echte uitsluitingscriteria. Dat blijft een openstaand punt.
const MATCH_GEWICHTEN = { discipline: 0.3, doelgroep: 0.3, werkgebied: 0.25, bedrag: 0.15 };

function normaliseerTekst(t: unknown) {
  return String(t || '').trim().toLowerCase();
}

// Zelfde fuzzy-overlapmaat als de bestaande kansrijkheid()-heuristiek aan de
// frontend-kant (DeadlinesPage.jsx): substring beide kanten op, geen exacte
// match vereist tussen bijv. "Jeugd" en "Jeugd en jongeren".
function overlapt(a: string, b: string) {
  if (!a || !b) return false;

  return a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

function scoreLijstOverlap(orgWaarden: string[], regelingWaarden: string[]) {
  if (!orgWaarden?.length || !regelingWaarden?.length) {
    return null;
  }

  const orgGenorm = orgWaarden.map(normaliseerTekst).filter(Boolean);
  const regelingGenorm = regelingWaarden.map(normaliseerTekst).filter(Boolean);

  if (!orgGenorm.length || !regelingGenorm.length) {
    return null;
  }

  const aansluitend = regelingGenorm.filter((rw) => orgGenorm.some((ow) => overlapt(ow, rw)));

  return { score: Math.round((aansluitend.length / regelingGenorm.length) * 100), aansluitend };
}

function scoreWerkgebied(orgWerkgebied: string, regelingWerkgebieden: string[]) {
  const org = normaliseerTekst(orgWerkgebied);
  const lijst = (regelingWerkgebieden || []).map(normaliseerTekst).filter(Boolean);

  if (!org || !lijst.length) {
    return null;
  }

  const landelijk = lijst.filter((w) => w === 'nederland' || w === 'landelijk');
  const sluitAan = landelijk.length > 0 || lijst.some((w) => overlapt(org, w));

  return { score: sluitAan ? 100 : 0, landelijk: landelijk.length > 0 };
}

function scoreBedrag(gevraagd: number | null, bedragMin: number | null, bedragMax: number | null) {
  if (gevraagd == null || (bedragMin == null && bedragMax == null)) {
    return null;
  }

  if (bedragMax != null && gevraagd > bedragMax) {
    return { score: 20, hardeCap: true, reden: `het gevraagde bedrag (€ ${gevraagd.toLocaleString('nl-NL')}) ligt boven het maximum van deze regeling (€ ${bedragMax.toLocaleString('nl-NL')})` };
  }

  if (bedragMin != null && gevraagd < bedragMin) {
    return { score: 60, hardeCap: false, reden: `het gevraagde bedrag (€ ${gevraagd.toLocaleString('nl-NL')}) ligt onder de gebruikelijke ondergrens van deze regeling (€ ${bedragMin.toLocaleString('nl-NL')}) - mogelijk nog steeds bespreekbaar` };
  }

  return { score: 100, hardeCap: false, reden: 'het gevraagde bedrag past binnen de gebruikelijke bandbreedte van deze regeling' };
}

// Geeft { totaal, onderdelen, sterkePunten, aandachtspunten, onzekereInfo }
// terug, of { totaal: null, ... } als er over geen enkel onderdeel iets te
// zeggen valt (bijv. een lid zonder ingevuld profiel).
function berekenMatch(regeling: any, signalen: MatchSignalen) {
  const onderdelen: { naam: string; gewicht: number; score: number; toelichting: string }[] = [];
  const sterkePunten: string[] = [];
  const aandachtspunten: string[] = [];
  const onzekereInfo: string[] = [];
  let hardeCap: number | null = null;

  const discipline = scoreLijstOverlap(signalen.themas, regeling.themas_namen || []);

  if (discipline) {
    onderdelen.push({ naam: 'Discipline', gewicht: MATCH_GEWICHTEN.discipline, score: discipline.score, toelichting: discipline.aansluitend.length ? `sluit aan op ${discipline.aansluitend.join(', ')}` : 'sluit niet aan bij de disciplines in het profiel' });
    (discipline.score >= 70 ? sterkePunten : aandachtspunten).push(discipline.score >= 70 ? `de discipline sluit aan (${discipline.aansluitend.join(', ')})` : 'de discipline van deze regeling sluit niet aan bij het profiel');
  } else {
    onzekereInfo.push('geen discipline bekend om te vergelijken (in het profiel of bij deze regeling)');
  }

  const doelgroep = scoreLijstOverlap(signalen.doelgroepen, regeling.doelgroepen_namen || []);

  if (doelgroep) {
    onderdelen.push({ naam: 'Doelgroep', gewicht: MATCH_GEWICHTEN.doelgroep, score: doelgroep.score, toelichting: doelgroep.aansluitend.length ? `sluit aan op ${doelgroep.aansluitend.join(', ')}` : 'sluit niet aan bij de doelgroepen in het profiel' });
    (doelgroep.score >= 70 ? sterkePunten : aandachtspunten).push(doelgroep.score >= 70 ? `de doelgroep sluit aan (${doelgroep.aansluitend.join(', ')})` : 'de doelgroep van deze regeling sluit niet aan bij het profiel');
  } else {
    onzekereInfo.push('geen doelgroep bekend om te vergelijken (in het profiel of bij deze regeling)');
  }

  const werkgebied = scoreWerkgebied(signalen.werkgebied, regeling.werkgebieden_namen || []);

  if (werkgebied) {
    onderdelen.push({ naam: 'Werkgebied', gewicht: MATCH_GEWICHTEN.werkgebied, score: werkgebied.score, toelichting: werkgebied.score === 100 ? 'het werkgebied sluit aan' : 'het werkgebied van deze regeling wijkt af' });
    (werkgebied.score === 100 ? sterkePunten : aandachtspunten).push(werkgebied.score === 100 ? 'het werkgebied sluit aan' : 'het werkgebied wijkt af van het profiel');
  } else {
    onzekereInfo.push('geen werkgebied bekend om te vergelijken');
  }

  const bedrag = scoreBedrag(signalen.gevraagdBedrag, regeling.bedrag_min ?? null, regeling.bedrag_max ?? null);

  if (bedrag) {
    onderdelen.push({ naam: 'Bedrag', gewicht: MATCH_GEWICHTEN.bedrag, score: bedrag.score, toelichting: bedrag.reden });
    (bedrag.score >= 70 ? sterkePunten : aandachtspunten).push(bedrag.reden);

    if (bedrag.hardeCap) {
      hardeCap = 40;
    }
  } else {
    onzekereInfo.push('geen gevraagd bedrag of financieringsbandbreedte bekend om te vergelijken');
  }

  if (!onderdelen.length) {
    return { totaal: null, onderdelen: [], sterkePunten: [], aandachtspunten: [], onzekereInfo };
  }

  const totaalGewicht = onderdelen.reduce((t, o) => t + o.gewicht, 0);
  let totaal = Math.round(onderdelen.reduce((t, o) => t + o.score * o.gewicht, 0) / totaalGewicht);

  if (hardeCap != null && totaal > hardeCap) {
    totaal = hardeCap;
  }

  return { totaal, onderdelen, sterkePunten, aandachtspunten, onzekereInfo };
}

type MatchSignalen = { themas: string[]; doelgroepen: string[]; werkgebied: string; gevraagdBedrag: number | null };

// Leest en ontsmet body.matchSignalen (fase 1 van de AI Fundraising
// Assistant). Alleen scalaire/array-van-tekst-velden, hard begrensd op
// lengte/aantal - dit komt rechtstreeks van de client, dus nooit ongefilterd
// doorzetten. Geeft null terug zolang er niets bruikbaars in zit, zodat de
// aanroeper simpelweg geen matchscores berekent (het gesprek werkt dan zoals
// voorheen, puur op de reguliere subsidieregelingContext hierboven).
function leesMatchSignalen(body: any): MatchSignalen | null {
  const ruw = body?.matchSignalen;

  if (!ruw || typeof ruw !== 'object') {
    return null;
  }

  const naarLijst = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => String(x || '').slice(0, 100)).filter(Boolean).slice(0, 20)
      : [];

  const themas = naarLijst(ruw.themas);
  const doelgroepen = naarLijst(ruw.doelgroepen);
  const werkgebied = String(ruw.werkgebied || '').slice(0, 100);
  const gevraagdBedragRuw = Number(ruw.gevraagdBedrag);
  const gevraagdBedrag = Number.isFinite(gevraagdBedragRuw) && gevraagdBedragRuw > 0 ? gevraagdBedragRuw : null;

  if (!themas.length && !doelgroepen.length && !werkgebied && gevraagdBedrag == null) {
    return null;
  }

  return { themas, doelgroepen, werkgebied, gevraagdBedrag };
}

// Deadline-architectuur, enkelvoudige koppeling: funder-brede datamomenten
// (geen regelingkoppeling - subsidieregeling_id is null) via een eigen
// sibling-RPC (kompas_funder_deadlines_voor_tier), met exact dezelfde
// centrale tier-regel (subsidie_zichtbaar_voor_tier) als subsidieregelingContext
// hieronder - geen tweede rechtenmodel. Los van kompas_subsidieregelingen_voor_tier
// gehouden (niet die RPC's kolomvorm uitgebreid) omdat funder-brede data geen
// regelingspecifieke velden heeft (begrotingseisen, aanvraagprocedure, etc.).
// tier komt, net als hieronder, uitsluitend server-side uit profiles.subscription_tier.
async function funderDeadlineContext(admin: any, tier: string): Promise<{ tekst: string; funderIds: Set<string> } | null> {
  try {
    const { data, error } = await admin.rpc('kompas_funder_deadlines_voor_tier', { p_tier: tier });

    if (error || !Array.isArray(data) || !data.length) {
      return null;
    }

    const funderIds = new Set<string>(data.map((f: any) => String(f.funder_id)));

    const regels = data.map((f: any) => {
      const lijnen: string[] = [];

      lijnen.push(
        `- ${f.funder_naam}${f.type_gever ? ` (${f.type_gever})` : ''} — funder-brede deadline, sluit ${f.deadline_datum ?? 'onbekend'}${f.sluitingstijd ? ` om ${String(f.sluitingstijd).slice(0, 5)}` : ''}, toegangsniveau: ${f.access_tier || 'onbekend'}`,
      );

      if (f.datamoment_naam) lijnen.push(`  Naam: ${f.datamoment_naam}`);
      if (f.themas_namen?.length) lijnen.push(`  Disciplines: ${f.themas_namen.join(', ')}`);
      if (f.doelgroepen_namen?.length) lijnen.push(`  Doelgroepen: ${f.doelgroepen_namen.join(', ')}`);
      if (f.werkgebieden_namen?.length) lijnen.push(`  Werkgebied: ${f.werkgebieden_namen.join(', ')}`);

      const bijdrage = [
        f.bandbreedte_bijdrage_naam,
        f.bijdrage_min || f.bijdrage_max ? `(€ ${f.bijdrage_min ?? '?'} - € ${f.bijdrage_max ?? '?'})` : null,
      ]
        .filter(Boolean)
        .join(' ');

      if (bijdrage) lijnen.push(`  Bijdrage: ${bijdrage}`);
      if (f.toelichting) lijnen.push(`  Toelichting: ${f.toelichting}`);
      if (f.funder_missie) lijnen.push(`  Missie: ${f.funder_missie}`);
      if (f.funder_aanvraagcriteria) lijnen.push(`  Aanvraagcriteria (algemeen, geldt voor het hele fonds): ${f.funder_aanvraagcriteria}`);
      if (f.funder_website) lijnen.push(`  Website: ${f.funder_website}`);

      return lijnen.join('\n');
    });

    const kop =
      'Hieronder staan funder-brede deadlines: deze gelden voor het hele fonds (niet voor één specifieke subsidieregeling uit de lijst hierboven of hieronder) en zijn, op basis van het abonnement van dit lid, zichtbaar. Verzin nooit een fonds, bedrag, deadline of voorwaarde die hier niet in staat. Noem bij advies duidelijk dat dit een deadline van het fonds zelf is, niet van één specifieke regeling.\n\n';

    return { tekst: (kop + regels.join('\n')).slice(0, 30000), funderIds };
  } catch (_) {
    return null;
  }
}

// Architectuurregel "Reviewed bepaalt opname in de centrale dataset": de AI moet
// ALLE door een beheerder beoordeelde Funders kunnen uitlezen, niet alleen de
// funders die (via funderDeadlineContext hierboven) toevallig een eigen,
// toekomstig datamoment hebben. Zonder dit zou een beoordeeld vermogensfonds
// zonder eigen aanvraagronde/vergaderdatum (bijv. een fonds dat uitsluitend op
// uitnodiging schenkt) voor de AI onzichtbaar blijven, terwijl het wel
// "Beoordeeld" staat. Zelfde tier-regel (subsidie_zichtbaar_voor_tier via de
// RPC), geen tweede rechtenmodel. Om dubbele/overlappende vermelding met
// funderDeadlineContext te voorkomen, filtert deze functie fondsen eruit die
// daar al met hun eigen deadline in staan (dezelfde funder_id) - dit blok gaat
// dus alleen over beoordeelde fondsen zonder eigen funder-brede deadline; een
// fonds met eigen subsidieregelingen staat sowieso al in subsidieregelingContext.
async function funderAlgemeneContext(admin: any, tier: string, reedsGenoemdeFunderIds: Set<string>) {
  try {
    const { data, error } = await admin.rpc('kompas_funders_voor_tier', { p_tier: tier });

    if (error || !Array.isArray(data) || !data.length) {
      return null;
    }

    const overige = data.filter((f: any) => !reedsGenoemdeFunderIds.has(String(f.funder_id)));
    if (!overige.length) return null;

    const regels = overige.map((f: any) => {
      const lijnen: string[] = [];

      lijnen.push(`- ${f.funder_naam}${f.funder_type ? ` (${f.funder_type})` : ''} — toegangsniveau: ${f.access_tier || 'onbekend'}`);

      if (f.themas_namen?.length) lijnen.push(`  Disciplines: ${f.themas_namen.join(', ')}`);
      if (f.doelgroepen_namen?.length) lijnen.push(`  Doelgroepen: ${f.doelgroepen_namen.join(', ')}`);
      if (f.werkgebieden_namen?.length) lijnen.push(`  Werkgebied: ${f.werkgebieden_namen.join(', ')}`);

      const bijdrage = [
        f.bandbreedte_bijdrage_naam,
        f.bijdrage_min || f.bijdrage_max ? `(€ ${f.bijdrage_min ?? '?'} - € ${f.bijdrage_max ?? '?'})` : null,
      ]
        .filter(Boolean)
        .join(' ');

      if (bijdrage) lijnen.push(`  Bijdrage: ${bijdrage}`);
      if (f.missie) lijnen.push(`  Missie: ${f.missie}`);
      if (f.aanvraagcriteria) lijnen.push(`  Aanvraagcriteria: ${f.aanvraagcriteria}`);
      if (f.funder_website) lijnen.push(`  Website: ${f.funder_website}`);

      return lijnen.join('\n');
    });

    const kop =
      'Hieronder staan overige, door een beheerder beoordeelde fondsen zonder eigen, eerstvolgende aanvraagronde of vergaderdatum (bijv. fondsen die uitsluitend op uitnodiging of doorlopend schenken). Zijn, op basis van het abonnement van dit lid, zichtbaar. Verzin nooit een fonds, bedrag of voorwaarde die hier niet in staat.\n\n';

    return (kop + regels.join('\n')).slice(0, 30000);
  } catch (_) {
    return null;
  }
}

// "Volgende fase": de subsidieregelingen die dit lid, op basis van zijn eigen
// abonnement, mag zien - via de RPC die exact dezelfde centrale regel
// toepast als de Timeline (subsidie_zichtbaar_voor_tier). tier komt hierboven
// al veilig uit profiles.subscription_tier, nooit van de client. Geeft een
// kant-en-klaar systeembericht terug, of null als er niets te tonen is of de
// aanroep mislukt (mag het gesprek zelf nooit blokkeren).
//
// AI Fundraising Assistant, fase 1: geeft matchSignalen mee (optioneel, kan
// null zijn), dan krijgt elke regeling er een uitlegbare matchscore bij
// (berekenMatch hierboven) en worden de regelingen aflopend op matchscore
// gesorteerd - zodat de sterkste kandidaten bovenaan staan en dus als eerste
// binnen de 60000-tekens-afkap hieronder vallen.
async function subsidieregelingContext(admin: any, tier: string, matchSignalen: MatchSignalen | null) {
  try {
    const { data, error } = await admin.rpc('kompas_subsidieregelingen_voor_tier', { p_tier: tier });

    if (error || !Array.isArray(data)) {
      return null;
    }

    if (!data.length) {
      return 'Er staan op dit moment geen subsidieregelingen in de database van Het Fondsenwervers Collectief die dit lid, op basis van zijn abonnement, mag zien. Verzin er zelf geen bij - zeg dat eerlijk en vraag zo nodig door naar wat het lid zoekt.';
    }

    // AI Fundraising Assistant, fase 1: matchscore per regeling berekenen (als
    // er signalen zijn) en de lijst daarop sorteren - de sterkste match komt
    // bovenaan, in plaats van de bestaande status/deadline-volgorde uit de RPC.
    const metMatch = data.map((r: any) => ({ r, match: matchSignalen ? berekenMatch(r, matchSignalen) : null }));

    if (matchSignalen) {
      metMatch.sort((a: any, b: any) => (b.match?.totaal ?? -1) - (a.match?.totaal ?? -1));
    }

    const perRegeling = metMatch.map(({ r, match }: any) => {
      const regelLijnen: string[] = [];

      regelLijnen.push(
        `- ${r.naam}${r.status ? ` (${r.status}${r.deadline_datum ? `, deadline ${r.deadline_datum}${r.sluitingstijd ? ` om ${String(r.sluitingstijd).slice(0, 5)}` : ''}` : ''})` : ''} — gever: ${r.funder_naam || 'onbekend'} (${r.type_gever || 'onbekend type'}), toegangsniveau: ${r.access_tier || 'onbekend'}`,
      );

      if (r.themas_namen?.length) regelLijnen.push(`  Disciplines: ${r.themas_namen.join(', ')}`);
      if (r.doelgroepen_namen?.length) regelLijnen.push(`  Doelgroepen: ${r.doelgroepen_namen.join(', ')}`);
      if (r.werkgebieden_namen?.length) regelLijnen.push(`  Werkgebied: ${r.werkgebieden_namen.join(', ')}`);

      if (match && match.totaal != null) {
        const onderdelenTekst = match.onderdelen.map((o: any) => `${o.naam} ${o.score}% (${o.toelichting})`).join('; ');

        regelLijnen.push(`  Matchscore met dit lid: ${match.totaal}% — ${onderdelenTekst}.`);

        if (match.sterkePunten.length) regelLijnen.push(`  Sterke punten van deze match: ${match.sterkePunten.join('; ')}.`);
        if (match.aandachtspunten.length) regelLijnen.push(`  Aandachtspunten van deze match: ${match.aandachtspunten.join('; ')}.`);
        if (match.onzekereInfo.length) regelLijnen.push(`  Niet mee te wegen (onbekend): ${match.onzekereInfo.join('; ')}.`);
      } else if (match) {
        regelLijnen.push('  Matchscore: kan niet worden berekend - onvoldoende profiel-/projectinformatie bekend.');
      }

      const bijdrage = [
        r.bandbreedte_bijdrage_naam,
        r.bedrag_min || r.bedrag_max ? `(€ ${r.bedrag_min ?? '?'} - € ${r.bedrag_max ?? '?'})` : null,
      ]
        .filter(Boolean)
        .join(' ');

      if (bijdrage) regelLijnen.push(`  Bijdrage: ${bijdrage}`);
      if (r.deadline_omschrijving) regelLijnen.push(`  Openstelling/deadline: ${r.deadline_omschrijving}`);
      // Meerdere aanvraagrondes: eerstvolgende ronde komt uit dezelfde centrale
      // rondelogica als de Timeline (subsidieregeling_volgende_ronde). deadline_datum
      // hierboven is al ronde-aware; deze regel voegt alleen de beoordelingsinfo
      // en het totaal aantal (huidige + historische) rondes toe.
      if ((r.rondes_aantal ?? 0) > 0) {
        const beoordeling = r.beoordelingsdatum || r.beoordelingsperiode_ronde;
        regelLijnen.push(
          `  Eerstvolgende aanvraagronde: sluit ${r.deadline_datum ?? 'onbekend'}${r.sluitingstijd ? ` om ${String(r.sluitingstijd).slice(0, 5)}` : ''}${beoordeling ? `; beoordeling ${r.beoordelingsdatum ? `op ${r.beoordelingsdatum}` : r.beoordelingsperiode_ronde}` : ''} (in totaal ${r.rondes_aantal} aanvraagronde${r.rondes_aantal === 1 ? '' : 's'} voor deze regeling, inclusief eventuele afgelopen rondes).`,
        );
      }
      if (r.aanvraagcriteria) regelLijnen.push(`  Aanvraagcriteria (regeling): ${r.aanvraagcriteria}`);
      if (r.beoordelingscriteria) regelLijnen.push(`  Beoordelingscriteria: ${r.beoordelingscriteria}`);
      if (r.type_projecten) regelLijnen.push(`  Type projecten: ${r.type_projecten}`);
      if (r.begrotingseisen) regelLijnen.push(`  Begrotingseisen: ${r.begrotingseisen}`);
      if (r.eigen_bijdrage) regelLijnen.push(`  Eigen bijdrage: ${r.eigen_bijdrage}`);
      if (r.cofinanciering) regelLijnen.push(`  Cofinanciering: ${r.cofinanciering}`);
      if (r.behandeltermijn) regelLijnen.push(`  Behandeltermijn: ${r.behandeltermijn}`);
      if (r.aanvraagprocedure) regelLijnen.push(`  Aanvraagprocedure: ${r.aanvraagprocedure}`);
      if (r.aanvraaglink) regelLijnen.push(`  Aanvraaglink: ${r.aanvraaglink}`);
      if (r.funder_missie) regelLijnen.push(`  Missie gever: ${r.funder_missie}`);
      if (r.funder_aanvraagcriteria) regelLijnen.push(`  Aanvraagcriteria (gever, algemeen): ${r.funder_aanvraagcriteria}`);
      if (r.funder_website) regelLijnen.push(`  Website gever: ${r.funder_website}`);

      return regelLijnen.join('\n');
    });

    const kop =
      'Hieronder staan de subsidieregelingen die dit lid, op basis van zijn abonnement, mag zien - rechtstreeks uit de database van Het Fondsenwervers Collectief (beheerd via Beheer -> Subsidieregelingen), aflopend gesorteerd op matchscore als die berekend kon worden. Gebruik uitsluitend deze lijst voor concreet fondsadvies: verzin nooit een regeling, gever, bedrag, deadline of voorwaarde die hier niet in staat. Is er niets passends bij, zeg dat eerlijk in plaats van een regeling te verzinnen.' +
      (matchSignalen
        ? ' Staat er een matchscore/percentage bij een regeling, gebruik dan uitsluitend dat getal en die toelichting als je een percentage of "sterke match"/"aandachtspunt" noemt - bereken of schat nooit zelf een eigen percentage. Staat een onderdeel onder "Niet mee te wegen (onbekend)", doe daar dan geen uitspraak over en verzin geen score - zeg desgewenst dat je dat niet kunt beoordelen en vraag er evt. naar.'
        : '')
      + '\n\n';

    return (kop + perRegeling.join('\n')).slice(0, 60000);
  } catch (_) {
    return null;
  }
}

// Gedeeld door mode: 'extract' (fase 3) en mode: 'website' (fase 4): dezelfde
// vraag aan de AI, alleen de bronomschrijving in de systeemtekst verschilt.
async function voorstelUitTekst(apiKey: string, model: string, tekst: string, bronOmschrijving: string) {
  const veldenLijst = EXTRACTIE_VELDEN.map((v) => `${v.n} (${v.l})`).join(', ');

  const systeemExtractie = `Je helpt Nederlandse maatschappelijke organisaties hun organisatieprofiel in Subsidie Kompas aan te vullen op basis van ${bronOmschrijving}.

Lees de tekst hieronder en haal er uitsluitend gegevens uit die je met voldoende zekerheid in de tekst kunt terugvinden. Verzin nooit informatie en doe geen aannames. Laat een veld gewoon weg als het niet duidelijk in de tekst staat.

De toegestane velden zijn: ${veldenLijst}.

Antwoord uitsluitend met geldige JSON in de vorm {"velden": {"veldnaam": "waarde"}}, met alleen de velden waarover je zeker bent en uitsluitend de hierboven genoemde veldnamen.`;

  const antwoord = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systeemExtractie },
        { role: 'user', content: tekst.slice(0, 20000) },
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!antwoord.ok) {
    return { voorstel: null as Record<string, string> | null, usage: null as any, mislukt: true };
  }

  const data = await antwoord.json();
  const ruw = data.choices?.[0]?.message?.content;
  const toegestaan = new Set(EXTRACTIE_VELDEN.map((v) => v.n));
  const voorstel: Record<string, string> = {};

  try {
    const parsed = JSON.parse(ruw || '{}');
    const velden = parsed?.velden && typeof parsed.velden === 'object' ? parsed.velden : {};

    Object.entries(velden).forEach(([k, v]) => {
      if (toegestaan.has(k) && v != null && String(v).trim()) {
        voorstel[k] = String(v).slice(0, 2000);
      }
    });
  } catch (_) {
    // laat voorstel leeg; de frontend toont dan "geen voorstellen gevonden"
  }

  return { voorstel, usage: data.usage, mislukt: false };
}

// Zelfde patroon als aan de frontend-kant (organisatieprofiel.js/projecten.js):
// een lid kan een document of website laten analyseren vóórdat er een
// organisatieprofiel is ingevuld, dus wordt er dan een naamloze organisatie
// aangemaakt zodat de herkomst (fase 4: website_sources) ergens aan kan hangen.
async function huidigeOfNieuweOrganisatie(admin: any, userId: string) {
  const { data: bestaand } = await admin
    .from('subsidie_kompas_organizations')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (bestaand?.id) {
    return bestaand.id;
  }

  const { data: nieuw, error } = await admin
    .from('subsidie_kompas_organizations')
    .insert({ user_id: userId, organization_name: 'Naamloze organisatie' })
    .select('id')
    .single();

  return error ? null : nieuw.id;
}

// Ruwe, afhankelijkheidsvrije HTML-naar-tekst-conversie (Deno Edge Functions
// hebben geen DOM beschikbaar en een DOM-parser als afhankelijkheid toevoegen
// is voor dit doel niet nodig - alleen leesbare tekst voor de AI, geen opmaak).
function tekstUitHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function paginaTitel(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return m ? tekstUitHtml(m[1]).slice(0, 200) : '';
}

// Zoekt op de homepage naar links die waarschijnlijk naar "over ons"/"missie"/
// "contact"-achtige pagina's leiden - bewust licht gehouden (geen diepere
// crawl), zoals afgesproken: bij onduidelijkheid vraagt Subsidie Kompas zelf
// door in het gesprek in plaats van dieper te graven op de website.
const PAGINA_TREFWOORDEN = [
  'over-ons', 'over_ons', 'overons', 'about', 'missie', 'mission',
  'wie-zijn-wij', 'wie-we-zijn', 'contact', 'wat-we-doen', 'doelstelling',
];

function vindOndersteunendePaginas(basis: URL, html: string, max = 2) {
  const gevonden: string[] = [];
  const re = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  let m;

  while ((m = re.exec(html)) && gevonden.length < max) {
    try {
      const url = new URL(m[1], basis);

      if (url.origin !== basis.origin || url.href === basis.href) {
        continue;
      }

      const pad = url.pathname.toLowerCase();

      if (PAGINA_TREFWOORDEN.some((w) => pad.indexOf(w) !== -1) && gevonden.indexOf(url.href) === -1) {
        gevonden.push(url.href);
      }
    } catch (_) {
      // ongeldige href; overslaan
    }
  }

  return gevonden;
}

// Geen interne/lokale adressen laten ophalen door de server - dit is een
// publiek bereikbare functie (achter inlog + Pro/Premium), dus een simpele
// bescherming tegen misbruik als open "URL-ophaler".
function isVeiligeUrl(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return false;
  }

  const host = u.hostname.toLowerCase();

  if (host === 'localhost' || host === '0.0.0.0' || host === '::1') {
    return false;
  }

  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return false;
  }

  return true;
}

async function haalPaginaOp(url: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SubsidieKompasBot/1.0 (+https://hetfondsenwerverscollectief.nl)' },
    });

    clearTimeout(timer);

    if (!res.ok) {
      return null;
    }

    return (await res.text()).slice(0, 400000);
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    return json({ error: 'De assistent is niet geconfigureerd.' }, 500);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  // Wie vraagt dit, en met welk abonnement?
  const authHeader = req.headers.get('Authorization') || '';
  let profileId: string | null = null;
  let tier = 'free';

  if (authHeader.startsWith('Bearer ')) {
    const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    const user = userData?.user;

    if (user) {
      profileId = user.id;

      const { data: profiel } = await admin
        .from('profiles')
        .select('subscription_tier, subscription_active')
        .eq('id', user.id)
        .single();

      if (profiel?.subscription_active && profiel.subscription_tier) {
        tier = profiel.subscription_tier;
      }
    }
  }

  let body: any;

  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  }

  // Documentanalyse voor het organisatieprofiel (fase 3). Los van het
  // gesprek hieronder: geen chatgeschiedenis, alleen documenttekst in,
  // voorgestelde veldwaarden uit. Wordt nooit automatisch opgeslagen - dat
  // gebeurt pas als het lid de voorstellen in de UI bevestigt.
  if (body.mode === 'extract') {
    if (tier === 'free') {
      return json({ error: 'Documenten laten analyseren is een Pro- en Premium-functie.' }, 403);
    }

    const tekst = String(body.text || '').slice(0, 20000);

    if (!tekst.trim()) {
      return json({ error: 'Geen tekst ontvangen om te analyseren.' }, 400);
    }

    const { voorstel, usage, mislukt } = await voorstelUitTekst(
      apiKey,
      MODEL,
      tekst,
      'een geüpload document (bijvoorbeeld een beleidsplan, jaarverslag, projectplan, meerjarenstrategie, begroting, impactrapport of evaluatie)',
    );

    if (mislukt) {
      return json({ error: 'Het document kon niet worden geanalyseerd. Probeer het opnieuw.' }, 502);
    }

    if (profileId) {
      await legVerbruikVast(admin, {
        profile_id: profileId,
        gesprek_id: null,
        model: MODEL,
        tokens_in: usage?.prompt_tokens ?? null,
        tokens_uit: usage?.completion_tokens ?? null,
      });
    }

    return json({ velden: voorstel });
  }

  // Website laten analyseren voor het organisatieprofiel (fase 4). Haalt
  // alleen de homepage plus, indien te vinden, een paar voor de hand liggende
  // pagina's op (over ons/missie/contact) - geen diepere crawl. Is iets
  // onduidelijk, dan vraagt Subsidie Kompas daar in het gesprek zelf naar,
  // zoals afgesproken.
  if (body.mode === 'website') {
    if (tier === 'free') {
      return json({ error: 'Website laten analyseren is een Pro- en Premium-functie.' }, 403);
    }

    let basis: URL;

    try {
      const ruweUrl = String(body.url || '').trim();

      if (!ruweUrl) {
        throw new Error('leeg');
      }

      basis = new URL(/^https?:\/\//i.test(ruweUrl) ? ruweUrl : `https://${ruweUrl}`);
    } catch (_) {
      return json({ error: 'Dit is geen geldig website-adres.' }, 400);
    }

    if (!isVeiligeUrl(basis)) {
      return json({ error: 'Deze website kan niet worden geanalyseerd.' }, 400);
    }

    const homepageHtml = await haalPaginaOp(basis.href);

    if (!homepageHtml) {
      return json({ error: 'De website kon niet worden bereikt. Controleer het adres.' }, 502);
    }

    const paginas = [
      { url: basis.href, titel: paginaTitel(homepageHtml), tekst: tekstUitHtml(homepageHtml).slice(0, 8000) },
    ];

    for (const link of vindOndersteunendePaginas(basis, homepageHtml, 2)) {
      const html = await haalPaginaOp(link);

      if (html) {
        paginas.push({ url: link, titel: paginaTitel(html), tekst: tekstUitHtml(html).slice(0, 8000) });
      }
    }

    const samengevoegdeTekst = paginas
      .map((p) => `Pagina: ${p.titel || p.url}\n${p.tekst}`)
      .join('\n\n')
      .slice(0, 20000);

    if (!samengevoegdeTekst.trim()) {
      return json({ error: 'Er kon geen bruikbare tekst van de website worden gelezen.' }, 502);
    }

    const { voorstel, usage, mislukt } = await voorstelUitTekst(
      apiKey,
      MODEL,
      samengevoegdeTekst,
      'de eigen website van de organisatie',
    );

    if (mislukt) {
      return json({ error: 'De website kon niet worden geanalyseerd. Probeer het opnieuw.' }, 502);
    }

    if (profileId) {
      const organizationId = await huidigeOfNieuweOrganisatie(admin, profileId);

      if (organizationId) {
        for (const p of paginas) {
          const { data: bestaand } = await admin
            .from('subsidie_kompas_website_sources')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('url', p.url)
            .maybeSingle();

          const rij = {
            user_id: profileId,
            organization_id: organizationId,
            url: p.url,
            page_title: p.titel || null,
            extracted_text: p.tekst || null,
            last_scraped_at: new Date().toISOString(),
          };

          if (bestaand?.id) {
            await admin.from('subsidie_kompas_website_sources').update(rij).eq('id', bestaand.id);
          } else {
            await admin.from('subsidie_kompas_website_sources').insert(rij);
          }
        }
      }

      await legVerbruikVast(admin, {
        profile_id: profileId,
        gesprek_id: null,
        model: MODEL,
        tokens_in: usage?.prompt_tokens ?? null,
        tokens_uit: usage?.completion_tokens ?? null,
      });
    }

    return json({ velden: voorstel, paginas: paginas.map((p) => ({ url: p.url, titel: p.titel })) });
  }

  const berichten = Array.isArray(body.messages) ? body.messages : [];

  if (!berichten.length) {
    return json({ error: 'Geen vraag ontvangen.' }, 400);
  }

  // Het abonnement komt uit het profiel, niet uit de aanvraag. De browser kan
  // dit dus niet ophogen.
  const systeem = await systeemtekst(admin, tier);

  // "Volgende fase": de subsidieregelingen die dit lid mag zien, rechtstreeks
  // uit dezelfde database als Beheer/Timeline - server-side gefilterd op
  // tier, nooit op basis van iets dat de client meestuurt.
  //
  // AI Fundraising Assistant, fase 1: matchSignalen komt wel van de client
  // (het organisatieprofiel/project van dit lid), maar bepaalt uitsluitend de
  // sortering en de uitleg-tekst binnen de al tier-gefilterde lijst hierboven
  // - het kan nooit een regeling zichtbaar maken die dit lid, op basis van
  // zijn abonnement, sowieso al niet mag zien.
  const matchSignalen = leesMatchSignalen(body);
  const subsidieContext = await subsidieregelingContext(admin, tier, matchSignalen);

  // Deadline-architectuur, enkelvoudige koppeling, testpunt 9: filters/AI
  // moeten zowel funder-brede als regeling-specifieke deadlines respecteren,
  // met dezelfde Free/Pro/Premium-rechten. Regeling-specifieke deadlines
  // zitten al in subsidieContext hierboven; funder-brede deadlines komen
  // hier als apart systeembericht bij, uit dezelfde tier-gefilterde RPC-familie.
  const funderDeadlineResultaat = await funderDeadlineContext(admin, tier);
  const funderDeadlineTekst = funderDeadlineResultaat?.tekst ?? null;

  // Architectuurregel "Reviewed bepaalt opname in de centrale dataset": ook
  // beoordeelde fondsen zonder eigen funder-brede deadline moeten door de AI
  // uitgelezen kunnen worden (missie, criteria, classificaties, bandbreedte).
  // Fondsen die hierboven al met hun eigen deadline zijn genoemd, worden hier
  // overgeslagen om dubbele vermelding te voorkomen.
  const funderAlgemeenTekst = await funderAlgemeneContext(admin, tier, funderDeadlineResultaat?.funderIds ?? new Set<string>());

  // Fase 6, punt 1: actief leren tijdens gesprekken. Zelfde gate als
  // mode: 'extract'/'website' hierboven (geen Free-toegang), en alleen als
  // de frontend het huidige profiel meestuurt (alleen Pro/Premium doet dat -
  // zie chat.js). orgProfile bevat alleen de scalaire velden uit
  // EXTRACTIE_VELDEN; ontbrekend is wat daarvan nog leeg is.
  const magOrganisatiegeheugen = tier !== 'free';
  const orgProfile = magOrganisatiegeheugen && body.orgProfile && typeof body.orgProfile === 'object' ? body.orgProfile : null;
  const ontbrekend = orgProfile ? EXTRACTIE_VELDEN.filter((v) => !String(orgProfile[v.n] || '').trim()) : [];

  const leerInstructie = ontbrekend.length
    ? `Dit lid laat je actief helpen het organisatieprofiel aan te vullen. Nog niet ingevuld: ${ontbrekend
        .map((v) => v.l)
        .join(', ')}. Vraag hier alleen naar als dat vanzelf in het gesprek past - nooit een vragenlijst afwerken, hooguit één gerichte vraag per antwoord, en alleen wanneer het relevant is voor waar het lid het op dat moment over heeft. Zeg nooit dat je iets al hebt opgeslagen: dat gebeurt pas als het lid dat straks zelf in een apart voorstel bevestigt.`
    : '';

  // Vervolgopdracht, prioriteit 6: zelfde aanpak als hierboven, nu voor het
  // aan dit gesprek gekoppelde project (body.project, alleen meegestuurd
  // door de frontend als er een project gekoppeld is - zie chat.js). Geen
  // aparte opslag: net als orgProfile hierboven is dit alleen input voor de
  // instructietekst, nooit iets dat hier wordt weggeschreven.
  const project = magOrganisatiegeheugen && body.project && typeof body.project === 'object' ? body.project : null;
  const projectOntbrekend = project ? PROJECT_VELDEN.filter((v) => leegVeld(project[v.n])) : [];

  const projectInstructie = projectOntbrekend.length
    ? `Voor het project waaraan dit gesprek gekoppeld is, ontbreekt nog: ${projectOntbrekend
        .map((v) => v.l)
        .join(', ')}. Wijs het lid hier proactief op zodra dat past in het gesprek - bijvoorbeeld door aan te bieden er samen een eerste opzet voor te maken - maar dring niet aan en werk dit nooit af als vragenlijst. Sla niets automatisch op: het lid vult het project zelf aan in het projectformulier.`
    : '';

  const invoer = [
    { role: 'system', content: systeem },
    ...(subsidieContext ? [{ role: 'system', content: subsidieContext }] : []),
    ...(funderDeadlineTekst ? [{ role: 'system', content: funderDeadlineTekst }] : []),
    ...(funderAlgemeenTekst ? [{ role: 'system', content: funderAlgemeenTekst }] : []),
    ...(leerInstructie ? [{ role: 'system', content: leerInstructie }] : []),
    ...(projectInstructie ? [{ role: 'system', content: projectInstructie }] : []),
    ...(body.context ? [{ role: 'system', content: String(body.context).slice(0, 24000) }] : []),
    ...berichten
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 12000) })),
  ];

  const wilStream = body.stream === true;

  const antwoord = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: invoer,
      temperature: 0.3,
      max_tokens: 2000,
      stream: wilStream,
      ...(wilStream ? { stream_options: { include_usage: true } } : {}),
    }),
  });

  if (!antwoord.ok) {
    return json({ error: 'De assistent kon geen antwoord geven. Probeer het opnieuw.' }, 502);
  }

  // Antwoord in één keer.
  if (!wilStream) {
    const data = await antwoord.json();
    const tekst = data.choices?.[0]?.message?.content;

    if (!tekst) {
      return json({ error: 'De assistent gaf een leeg antwoord.' }, 502);
    }

    // Fase 6, punt 1 (vervolg): is er iets ontbrekends waar het lid net zelf
    // iets over gezegd kan hebben, laat dat dan uit het gesprek zelf voorstellen
    // - met dezelfde functie als document-/website-analyse, alleen met een
    // stukje gespreksgeschiedenis in plaats van een document als bron. Mislukt
    // dit, dan blijft het gewone antwoord gewoon staan; dit mag dat nooit breken.
    let veldVoorstellen: Record<string, string> = {};
    let leerTokensIn = 0;
    let leerTokensUit = 0;

    const laatsteLidBericht = berichten
      .slice()
      .reverse()
      .find((m: any) => m && m.role === 'user' && m.content);
    const bevatMogelijkNieuweInfo = !!laatsteLidBericht && String(laatsteLidBericht.content).trim().length >= 8;

    if (magOrganisatiegeheugen && ontbrekend.length && bevatMogelijkNieuweInfo) {
      try {
        const fragment = berichten
          .slice(-6)
          .map((m: any) => `${m.role === 'user' ? 'Lid' : 'Subsidie Kompas'}: ${String(m.content || '').slice(0, 2000)}`)
          .join('\n');

        const { voorstel, usage, mislukt } = await voorstelUitTekst(
          apiKey,
          MODEL,
          fragment,
          'een lopend gesprek met dit lid in Subsidie Kompas - haal alleen gegevens eruit die het lid zelf expliciet heeft genoemd, nooit afgeleid of aangenomen',
        );

        if (!mislukt && voorstel) {
          Object.entries(voorstel).forEach(([k, v]) => {
            const huidig = orgProfile ? String(orgProfile[k] || '').trim() : '';

            if (!huidig || huidig !== String(v).trim()) {
              veldVoorstellen[k] = v;
            }
          });

          leerTokensIn = usage?.prompt_tokens ?? 0;
          leerTokensUit = usage?.completion_tokens ?? 0;
        }
      } catch (_) {
        // voorstellen ophalen mag het antwoord zelf nooit blokkeren
      }
    }

    if (profileId) {
      await legVerbruikVast(admin, {
        profile_id: profileId,
        gesprek_id: body.conversationId ?? null,
        model: MODEL,
        tokens_in: (data.usage?.prompt_tokens ?? 0) + leerTokensIn || null,
        tokens_uit: (data.usage?.completion_tokens ?? 0) + leerTokensUit || null,
      });
    }

    return json({ answer: tekst, sources: [], veldVoorstellen });
  }

  // Antwoord woord voor woord. De frontend leest dit met een EventSource-achtige
  // lus; elke regel is 'data: {json}'.
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = antwoord.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let volledig = '';
      let usage: any = null;

      const stuur = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        for (;;) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const regels = buffer.split('\n');
          buffer = regels.pop() || '';

          for (const regel of regels) {
            const t = regel.trim();

            if (!t.startsWith('data:')) continue;

            const payload = t.slice(5).trim();

            if (payload === '[DONE]') continue;

            try {
              const deel = JSON.parse(payload);
              const stukje = deel.choices?.[0]?.delta?.content;

              if (deel.usage) usage = deel.usage;

              if (stukje) {
                volledig += stukje;
                stuur({ delta: stukje });
              }
            } catch (_) {
              // onvolledig fragment; volgende ronde
            }
          }
        }

        stuur({ done: true, answer: volledig, sources: [] });
      } catch (_) {
        stuur({ error: 'De verbinding met de assistent viel weg.' });
      } finally {
        controller.close();

        if (profileId) {
          await legVerbruikVast(admin, {
            profile_id: profileId,
            gesprek_id: body.conversationId ?? null,
            model: MODEL,
            tokens_in: usage?.prompt_tokens ?? null,
            tokens_uit: usage?.completion_tokens ?? null,
          });
        }
      }
    },
  });

  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
});
