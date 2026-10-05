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
// RUNTIME IDENTIEK VOOR ALLE ABONNEMENTEN (2026-09-28): de drie RPC-aanroepen
// hierboven (en de twee funder-RPC's, zie subsidieregelingContext/
// funderDeadlineContext/funderAlgemeneContext verderop) gaven tot deze
// wijziging alleen de voor het eigen abonnement zichtbare rijen door - het
// model kreeg Premium-only data dus nooit te zien bij een Free- of
// Pro-aanvraag, wat er ook in kompas.system staat. Op uitdrukkelijk verzoek
// ("Runtime identiek voor alle abonnementen", "licentiefilter pas op het
// einde") roepen deze drie functies de RPC's voortaan altijd aan met
// p_tier: 'premium' - dat is, via dezelfde centrale regel
// (subsidie_zichtbaar_voor_tier), exact de vereniging van alle
// toegangsniveaus, dus de volledige, door een beheerder beoordeelde
// database. Geen nieuwe RPC's, geen wijziging aan subsidie_zichtbaar_voor_tier
// of aan de _voor_tier-RPC's zelf (Beheer en de Timeline blijven die
// ongewijzigd met de echte tier aanroepen). Elke rij behoudt haar eigen
// access_tier-veld; de zichtbaarheid voor de gebruiker wordt nu uitsluitend
// nog bepaald door kompas.system (ZICHTBAARHEID VAN MATCHES PER
// ACCOUNTNIVEAU) en de bijgewerkte runtimeContextBericht() hieronder - niet
// meer door de database.
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
// Prioriteit 5 (bronvermelding) staat, omdat die voor iedereen geldt, in de
// systeemtekst zelf (kompas.system in ai_prompts). Prioriteit 6 (proactief op ontbrekende
// projectvelden wijzen) hergebruikt de al bestaande ontbrekend/leerInstructie-
// aanpak uit fase 6 (die tot nu toe alleen het organisatieprofiel dekte),
// nu ook voor het gekoppelde project (PROJECT_VELDEN hieronder) - zie
// projectOntbrekend/projectInstructie verderop.
//
// Zetten: supabase functions deploy subsidie-kompas
// Nodig:  OPENAI_API_KEY als secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';

// STAP 3 (websearch, 2026-09-13): apart, eigen model uitsluitend voor de
// hoofdchat-aanroep hieronder (Responses API + web_search-tool). MODEL
// hierboven (gpt-4o, Chat Completions) blijft ongewijzigd voor
// voorstelUitTekst()/extract/website/de leerstap - géén van die aanroepen
// heeft websearch nodig en gpt-4o functioneert daar prima; dit is dus bewust
// geen algehele modelwijziging.
//
// Waarom een ander model hier: actuele, officiële OpenAI-documentatie
// (developers.openai.com, geraadpleegd 2026-09-13) laat zien dat gpt-4o de
// web_search-tool op de Responses API niet ondersteunt, en dat de oude
// Chat-Completions-varianten die dat wel konden (gpt-4o-search-preview /
// gpt-4o-mini-search-preview) sinds 2026-07-23 zijn uitgefaseerd. Een
// modelwijziging is dus strikt noodzakelijk om websearch als echte tool
// mogelijk te maken - niet voor kwaliteit (dat doen we eventueel later).
// gpt-5.5 is het model dat OpenAI's eigen documentatie voor "nieuwe
// websearch-integraties" met de Responses API aanbeveelt.
const CHAT_MODEL = Deno.env.get('OPENAI_CHAT_MODEL') || 'gpt-5.5';

// RC1 stap 7 (7B - BE1, runtime hardening): expliciete timeouts voor elke
// rechtstreekse OpenAI-aanroep in dit bestand - vóór deze stap had geen van
// de vier aanroepen enige timeout/AbortController/retry (RC1-bevinding
// BE1). Beide waarden blijven ruim onder de Supabase Edge Function
// "Request idle timeout" van 150s (geldt ongeacht plan - geverifieerd via
// de actuele Supabase-documentatie vóór implementatie, zie rapportage RC1
// stap 7). KORTE_CALL_TIMEOUT_MS geldt voor de drie kleinere
// extractie-/structureeraanroepen (voorstelUitTekst/budgetUitTekst/
// projectdossierUitGesprek); HOOFDCHAT_TIMEOUT_MS voor de hoofdchat
// (/v1/responses, soms gestreamd).
const KORTE_CALL_TIMEOUT_MS = 45_000;
const HOOFDCHAT_TIMEOUT_MS = 120_000;

// RC1 stap 7 (7C - BE2, runtime hardening): minimale rate-limitregel - zie
// kompas_check_rate_limit() (databasefunctie, migratie
// 20261003175209_kompas_rate_limit_minimal.sql) voor de atomische
// handhaving zelf. Bewust ruim genoeg om normaal gesprekgebruik nooit te
// hinderen, strak genoeg om herhaald, geautomatiseerd misbruik duidelijk af
// te remmen. Geen per-tier verschil (zie rapportage): dit is
// misbruikbeveiliging, geen abonnementsfeature.
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// RC1 stap 7 (7B - BE1): kleine, gedeelde helper die elke rechtstreekse
// OpenAI-aanroep hieronder een expliciete timeout geeft en een eventuele
// timeout/netwerkfout al hier onderscheidt van een geslaagde aanroep -
// vóór verdere verwerking (JSON parsen, non-2xx-afhandeling, etc.). Bewust
// GEEN automatische retry: een OpenAI-aanroep kan al kosten/verwerking
// hebben veroorzaakt vóórdat een netwerkfout zichtbaar wordt, en opnieuw
// proberen zou dat risico verdubbelen in plaats van oplossen - het lid kan
// zelf opnieuw vragen.
//
// AbortSignal.timeout(ms) is een standaard Web-API (ook in Deno): het geeft
// fetch() een signal dat na `ms` milliseconden afgaat. Dat signal blijft,
// volgens de fetch-specificatie, gekoppeld aan de VOLLEDIGE aanroep - dus
// niet alleen aan het ontvangen van de response-headers, maar ook aan het
// nog moeten uitlezen van een streaming response.body hierna. Voor de
// hoofdchat-aanroep (die hierna soms als stream wordt uitgelezen, zie
// Deno.serve() verderop) is dit dus geen schijnzekerheid die alleen de
// verbindingsopbouw beschermt: dezelfde timer blijft actief tot de hele
// aanroep (inclusief het uitlezen van de stream) is afgerond. Dit gedrag is
// voorafgaand aan implementatie expliciet empirisch geverifieerd (zie
// testrapportage RC1 stap 7) - niet alleen aangenomen op basis van de
// specificatie.
type OpenAiFetchUitkomst =
  | { ok: true; response: Response }
  | { ok: false; soort: 'timeout' | 'netwerk'; fout: unknown };

async function fetchOpenAiMetTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<OpenAiFetchUitkomst> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

    return { ok: true, response };
  } catch (fout: any) {
    // AbortSignal.timeout() laat fetch() falen met een fout waarvan
    // `name === 'TimeoutError'` (standaard Web-API-gedrag) - dat
    // onderscheiden we hier van elke andere netwerkfout (DNS, geweigerde
    // verbinding, verbroken verbinding), die een andere `name` heeft.
    const soort: 'timeout' | 'netwerk' = fout?.name === 'TimeoutError' ? 'timeout' : 'netwerk';

    return { ok: false, soort, fout };
  }
}

// Runtime-audit (2026-09-13): er is bewust GEEN hardcoded reservepersona meer
// voor de systeemtekst of de tier-aanvullingen (voorheen SYSTEEM_STANDAARD,
// PREMIUM_AANVULLING, AANVRAAGBEOORDELING_AANVULLING, PROJECTPLAN_AANVULLING,
// BEGROTING_AANVULLING, STRATEGIE_AANVULLING - allemaal verwijderd). De
// volledige inhoudelijke persona van Subsidie Kompas leeft uitsluitend in de
// database (tabel ai_prompts, sleutel kompas.system plus de vijf
// *_addendum-sleutels) en wordt bij iedere aanvraag vers opgehaald in
// systeemtekst() hieronder. Ontbreekt kompas.system, is de tekst leeg, of kan
// de tabel niet gelezen worden, dan start het gesprek niet: Deno.serve()
// hieronder geeft dan uitsluitend een technische foutmelding terug. Een
// storing mag nooit stilzwijgend een oude of afwijkende Subsidie
// Kompas-tekst activeren.

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

// Verstevigen Projectplan-runtime, punten 2/3 (2026-09-30): het compacte,
// intern bijgehouden Projectdossier - los van PROJECT_VELDEN hierboven, dat
// over het opgeslagen, formele Project-record gaat (alleen aanwezig als er
// een project gekoppeld is). Dit dossier bestaat wél voor élk Projectplan-
// gesprek (ook zonder gekoppeld project, en ook voor Free binnen de lopende
// sessie) en wordt uitsluitend uit het gesprek zelf gedestilleerd - zie
// projectdossierUitGesprek() verderop. Bewust een eigen, kleine allowlist in
// plaats van PROJECT_VELDEN hergebruiken: de velden komen deels overeen,
// maar dit dossier dekt ook zaken die geen projectveld zijn (schrijfstijl,
// fonds/generiek-keuze) en gebruikt de exacte namen uit de opdracht.
const DOSSIER_VELDEN = [
  'projectnaam',
  'doelgroep',
  'probleem',
  'doel',
  'activiteiten',
  'locatie',
  'planning',
  'resultaten',
  'impact',
  'partners',
  'begroting',
  'schrijfstijl',
  'fondsKeuze',
] as const;

// Leest en saniteert een door de client meegestuurd Projectdossier (het
// vorige antwoord van de Edge Function zelf, puur doorgegeven - zie
// chat.js). Zelfde voorzichtigheidsprincipe als leesMatchSignalen elders in
// dit bestand: alleen bekende veldnamen, alleen tekst, met een lengteplafond
// per veld, zodat een gemanipuleerd of kapot object nooit ongefilterd in de
// modelcontext terechtkomt.
function leesProjectDossier(body: any): Record<string, string> | null {
  const ruw = body?.projectDossier;

  if (!ruw || typeof ruw !== 'object') {
    return null;
  }

  const schoon: Record<string, string> = {};

  DOSSIER_VELDEN.forEach((veld) => {
    const w = (ruw as Record<string, unknown>)[veld];

    if (w != null && String(w).trim()) {
      schoon[veld] = String(w).slice(0, 800);
    }
  });

  return Object.keys(schoon).length ? schoon : null;
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

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// Haalt de inhoudelijk leidende systeemtekst en de tier-aanvullingen
// uitsluitend uit ai_prompts - geen hardcoded reservetekst meer (zie de
// toelichting hierboven). Geeft `null` terug wanneer kompas.system ontbreekt,
// leeg is, of de tabel niet gelezen kon worden; de aanroeper (Deno.serve
// hieronder) behandelt dat als een technische storing en stuurt dan
// uitsluitend een foutmelding terug, nooit een gesprek met vervangende
// inhoud. Een *_addendum-sleutel die ontbreekt of leeg/alleen-witruimte is,
// levert gewoonweg geen extra tekstblok op voor die tier - ook hier geen
// impliciete oude aanvullingstekst.
// Verstevigen Projectplan-runtime, punt 4 (2026-09-30): modus als derde,
// optionele parameter - alleen gebruikt om kompas.projectplan_addendum
// specifiek te vernauwen (zie hieronder). Alle overige addenda blijven
// bewust tier-only: 'projectplan' is de enige modus die de frontend
// betrouwbaar stuurt (KompasToolPage.jsx); de andere workflow-modi
// (begroting, strategie, aanvraagbeoordeling) worden nooit vanuit de
// frontend gezet, dus hun addenda daaraan koppelen zou ze - zodra ze ooit
// gevuld worden - stilzwijgend altijd uitschakelen, ook voor de bestaande,
// modus-onafhankelijke vrije-tekst-paden (bijv. de BEGROTING-sectie in
// kompas.system zelf). Vandaag heeft dit geen zichtbaar effect: alle vijf
// addenda staan nog op exact één spatie (leeg).
async function systeemtekst(admin: any, tier: string, modus: string): Promise<string | null> {
  const premium = tier === 'premium';
  const proOfPremium = tier !== 'free';

  let basis: string | null = null;
  let premiumTekst = '';
  let aanvraagbeoordeling = '';
  let projectplan = '';
  let begroting = '';
  let strategie = '';

  let rijen: any[] | null = null;

  try {
    const { data, error } = await admin
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

    if (error) {
      return null;
    }

    rijen = data;
  } catch (_) {
    return null;
  }

  (rijen || []).forEach((r: any) => {
    const waarde = typeof r.prompt === 'string' && r.prompt.trim() ? r.prompt : '';

    if (r.key === 'kompas.system' && waarde) basis = waarde;
    if (r.key === 'kompas.premium_addendum') premiumTekst = waarde;
    if (r.key === 'kompas.aanvraagbeoordeling_addendum') aanvraagbeoordeling = waarde;
    if (r.key === 'kompas.projectplan_addendum') projectplan = waarde;
    if (r.key === 'kompas.begroting_addendum') begroting = waarde;
    if (r.key === 'kompas.strategie_addendum') strategie = waarde;
  });

  if (!basis) {
    return null;
  }

  const delen = [basis as string];

  // Pro + Premium: projectplan-generator en begrotingsondersteuning.
  // projectplan_addendum is vanaf nu ook modus-gestuurd (zie toelichting bij
  // de functiesignatuur hierboven); begroting_addendum blijft bewust
  // tier-only.
  if (proOfPremium) {
    if (projectplan && modus === 'projectplan') delen.push(projectplan);
    if (begroting) delen.push(begroting);
  }

  // Alleen Premium: fondsendatabase, aanvraagbeoordeling en strategiechat.
  if (premium) {
    if (premiumTekst) delen.push(premiumTekst);
    if (aanvraagbeoordeling) delen.push(aanvraagbeoordeling);
    if (strategie) delen.push(strategie);
  }

  return delen.join('\n\n');
}

// Effectieve tier uit een profielrij: 'pro'/'premium' alleen bij een actief
// betaald abonnement of een nog lopende proefperiode, anders 'free'. Onbekende
// of ontbrekende tierwaarden vallen altijd terug op 'free'. Beheerders worden
// los hiervan afgehandeld (isAdmin, uitsluitend uit profiles.role).
function effectieveTier(
  profiel: { subscription_tier?: unknown; subscription_active?: unknown; trial_ends_at?: unknown } | null | undefined,
): 'free' | 'pro' | 'premium' {
  const ruw = profiel?.subscription_tier;

  if (ruw !== 'pro' && ruw !== 'premium') {
    return 'free';
  }

  if (profiel?.subscription_active === true) {
    return ruw;
  }

  const eind = typeof profiel?.trial_ends_at === 'string' ? Date.parse(profiel.trial_ends_at) : NaN;

  return Number.isFinite(eind) && eind > Date.now() ? ruw : 'free';
}

// STAP 1 (runtimecontext-tier, 2026-09-13): expliciete, betrouwbare mededeling
// van de server-side vastgestelde tier aan het model, zodat het model niet
// meer hoeft af te leiden of iemand Free, Pro of Premium is uit de zichtbare
// subsidieregelingen/fondsen. Geen nieuw classificatiesysteem: tierLabel()
// hergebruikt exact dezelfde twee predikaten (premium/proOfPremium) die
// systeemtekst() hierboven al gebruikt voor de addendum-selectie - 'PRO' dekt
// dus precies dezelfde bucket ("actief, niet free, niet premium") als de
// bestaande addendum-logica. kompas.system, de addenda en de bestaande
// Free/Pro/Premium-zichtbaarheid (RPC's) blijven ongewijzigd; dit voegt
// uitsluitend een kort, apart systeembericht toe.
function tierLabel(tier: string): 'FREE' | 'PRO' | 'PREMIUM' {
  if (tier === 'premium') return 'PREMIUM';
  if (tier === 'free') return 'FREE';
  return 'PRO';
}

// STAP 2 (runtimecontext-modus, 2026-09-13): net als STAP 1 voor de tier, geeft
// dit een expliciete, server-side gevalideerde actieve Subsidie Kompas-modus
// aan het model door - zodat het model niet zelf hoeft te raden welke
// workflow (fondsadvies, aanvraagbeoordeling, projectplan, begroting,
// strategie, actieplan) een gebruiker bedoelt.
//
// Analyse vooraf (zie rapport): de huidige frontend heeft geen aparte
// modi/routes/knoppen per workflow - Subsidie Kompas is één doorlopend
// chatscherm (KompasToolPage.jsx -> askKompas()). De enige plek waar de
// hoofdtekst van kompas.system al wél eigen, herkenbare secties per workflow
// heeft, zijn: "AANVRAAG BEOORDELEN", "PROJECTPLAN OPSTELLEN", "BEGROTING
// OPSTELLEN OF BEOORDELEN", "ACTIEPLAN EN DEADLINEPLANNING" en de
// fondsenscan-secties (fondsadvies) - en dat komt overeen met de bestaande
// (lege) addendum-sleutels aanvraagbeoordeling/projectplan/begroting/
// strategie in ai_prompts. Een aparte "projectontwikkeling"-modus leverde
// geen eigen, onderscheidend tekstdeel op (uitsluitend overlap met
// algemeen/fondsadvies/projectplan) en is daarom bewust niet overgenomen.
//
// Bewust een NIEUW veld (kompasMode) i.p.v. het bestaande body.mode:
// body.mode wordt al gebruikt voor twee losse, niet-conversationele
// hulpaanroepen (mode: 'extract' / 'website', zie hieronder in dit bestand)
// - dat hergebruiken voor de workflow-modus van het gesprek zelf zou hier
// verwarrend en dubbelzinnig zijn.
//
// Veiligheid: de client mag hooguit een sleutel uit KOMPAS_MODES sturen.
// resolveerModus() valideert dit server-side tegen de allowlist; elke
// onbekende, ontbrekende, lege of ongeldige waarde (bijvoorbeeld een
// verzonnen waarde als "premium-hack-ignore-system") valt terug op
// 'algemeen'. Er wordt nooit vrije tekst van de client als system-instructie
// doorgegeven - alleen deze ene, geverifieerde sleutel bepaalt welk label in
// het runtimecontext-bericht komt.
const KOMPAS_MODES = [
  'algemeen',
  'fondsadvies',
  'aanvraagbeoordeling',
  'projectplan',
  'begroting',
  'strategie',
  'actieplan',
] as const;

type KompasMode = (typeof KOMPAS_MODES)[number];

function resolveerModus(input: unknown): KompasMode {
  return typeof input === 'string' && (KOMPAS_MODES as readonly string[]).includes(input)
    ? (input as KompasMode)
    : 'algemeen';
}

function modusLabel(modus: KompasMode): string {
  const labels: Record<KompasMode, string> = {
    algemeen: 'ALGEMEEN',
    fondsadvies: 'FONDSADVIES',
    aanvraagbeoordeling: 'AANVRAAGBEOORDELING',
    projectplan: 'PROJECTPLAN',
    begroting: 'BEGROTING',
    strategie: 'STRATEGIE',
    actieplan: 'ACTIEPLAN',
  };

  return labels[modus];
}

// Combineert tier en modus in één runtimecontext-systembericht (in plaats van
// een tweede, los systeembericht toe te voegen) - zelfde functienaam en
// aanroepplek als in STAP 1, nu uitgebreid met de modus. Alle STAP 1-regels
// over de tier blijven letterlijk staan; er zijn uitsluitend modus-regels
// aan toegevoegd.
// STAP 3 (websearch, 2026-09-13): runtimeContextBericht() krijgt er, naast de
// STAP 1-tierregels en de STAP 2-modusregels (beide woordelijk ongewijzigd
// hierboven), een derde blok bij: hoe het model de nieuwe websearch-tool
// (zie Deno.serve() hieronder) hoort te gebruiken. Dit is bewust een
// technische/tool-gebruiksinstructie - geen nieuwe inhoudelijke workflow -
// en hoort daarom hier thuis, niet in kompas.system (dat blijft ongewijzigd)
// en niet als vierde, apart systeembericht ("geen dubbele systeemberichten").
function runtimeContextBericht(tier: string, modus: KompasMode): string {
  return `RUNTIMECONTEXT SUBSIDIE KOMPAS
Actieve toegang: ${tierLabel(tier)}.
Actieve modus: ${modusLabel(modus)}.
Dit zijn betrouwbare systeemgegevens.
Leid het toegangsniveau of de actieve modus niet zelf af uit de zichtbare resultaten of formuleringen van de gebruiker.
Pas de toegangs- en zichtbaarheidsregels uit kompas.system toe voor deze tier.
De databasecontext in de systeemberichten hieronder (subsidieregelingen en funders) bevat altijd de volledige database, inclusief onderdelen met een hoger toegangsniveau dan deze tier - dat is bewust zo (identiek onderzoek voor elk abonnement). Elk item heeft een eigen "toegangsniveau" (access_tier)-veld. Bepaal zelf, aan de hand daarvan en de regels in kompas.system (ZICHTBAARHEID VAN MATCHES PER ACCOUNTNIVEAU), welke resultaten je in je antwoord aan dit lid toont - nooit aan de hand van wat er wel of niet in de databasecontext staat.
Gebruik voor deze vraag primair de workflow voor de actieve modus uit kompas.system.
Alle overige instructies uit kompas.system blijven volledig van toepassing.
Gebruik alleen de daadwerkelijk server-side vastgestelde tier en modus.

WEBSEARCH BESCHIKBAAR
Je hebt een websearch-tool tot je beschikking voor actuele, publieke informatie (bijvoorbeeld actuele deadlines, bedragen, openstelling van een subsidieregeling, of aanvullende fondsen buiten deze database). Voor sommige vragen is de websearch-tool voor dit bericht verplicht gesteld (server-side bepaald, niet door het lid zelf af te dwingen) - gebruik hem dan ook daadwerkelijk. Is dat niet het geval, gebruik de tool dan zelfstandig wanneer actuele externe informatie nodig is voor een goed antwoord; dit is geen verplichte stap bij iedere vraag.
Vind je via websearch geen betrouwbaar of eenduidig antwoord, of is een bron niet te raadplegen, verzin dan nooit een actueel feit: zeg expliciet tegen het lid dat dit niet kon worden bevestigd.
Voor deadlines, bedragen en aanvraagvoorwaarden heeft de officiële website van de subsidieverstrekker of het fonds zelf de voorkeur boven secundaire bronnen.
Websearch is aanvullende, externe research en verandert nooit welke resultaten je in je antwoord aan dit lid mag tonen - dat wordt uitsluitend bepaald door kompas.system en het access_tier-veld per databaseresultaat, nooit door websearch.

STAP 4B - GESPREKSGESCHIEDENIS
Gebruik relevante feiten, keuzes en resultaten uit de meegegeven gespreksgeschiedenis bij vervolgvragen. Vraag informatie niet opnieuw als die al beschikbaar is, tenzij de gebruiker haar corrigeert of de informatie aantoonbaar ontbreekt.

STAP 4B - DATABASE VERSUS ACTUELE OFFICIËLE BRON
Voor tijdgevoelige gegevens zoals deadlines, openstelling, aanvraagbedragen en actuele voorwaarden is een actuele officiële bron leidend boven oudere opgeslagen database-informatie. Als beide van elkaar verschillen, benoem dat verschil expliciet.`;
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

// RC1 stap 2, productbeslissing (2026-10-01): vóór deze wijziging bestond er
// geen enkel server-side filter tussen de (bewust altijd volledige, zie
// "RUNTIME IDENTIEK VOOR ALLE ABONNEMENTEN" bovenaan dit bestand)
// kandidaatset/matching en de uiteindelijke OpenAI-tekst: elk record ging
// altijd met volledige naam/criteria/bedrag/deadline de prompt in, voor elke
// tier, met uitsluitend kompas.system als (niet-technische) rem. Deze
// functie is die ontbrekende laag: ze bepaalt, per record en vlak vóór de
// tekstopbouw in funderDeadlineContext/funderAlgemeneContext/
// subsidieregelingContext hieronder, of een record VOLUIT getoond mag
// worden. Ze spiegelt bewust de reviewed-tak van de databasefunctie
// subsidie_zichtbaar_voor_tier() (zelfde free/pro/premium-logica op basis
// van access_tier), met één toevoeging: isAdmin (server-side bepaald uit
// profiles.role, zie de tier-bepaling verderop) overstijgt access_tier
// volledig - dit lost RC1-bevinding F5 op (admin kreeg voorheen een
// gedegradeerde AI-context wanneer er geen actief betaald abonnement was).
// Een onbekende/ontbrekende access_tier-waarde wordt bewust NOOIT als
// zichtbaar beschouwd (fail closed), in plaats van zoals voorheen impliciet
// het geval was: gewoon volledig getoond.
//
// Verandert NIETS aan de candidate pool of de matching/ranking: de RPC's
// hieronder blijven zelf ongewijzigd altijd met p_tier: 'premium'
// aangeroepen, en berekenMatch() hierboven blijft ongewijzigd. Dit is
// uitsluitend de allerlaatste stap, ná sortering/scoring, vóórdat tekst
// wordt opgebouwd.
function isZichtbaarVoorTier(accessTier: unknown, tier: string, isAdmin: boolean): boolean {
  if (isAdmin) {
    return true;
  }

  switch (accessTier) {
    case 'free':
      return true;
    case 'pro':
      return tier === 'pro' || tier === 'premium';
    case 'premium':
      return tier === 'premium';
    default:
      return false;
  }
}

// RC1 stap 2, correctie (2026-10-02): de Free-cap van maximaal 3 volledige
// matches werd tot nu toe puur sequentieel verdeeld (subsidieregelingen
// eerst, dan funder-deadlines, dan overige fondsen) - een technisch toeval
// van aanroepvolgorde, geen businessregel. Vandaag heeft alléén een
// subsidieregeling met een daadwerkelijk door berekenMatch() berekende
// score (match.totaal != null) een inhoudelijk onderbouwde voorrang op de
// quota; fondsen worden niet gescoord (zie subsidieregelingKandidaten
// hieronder - geen nieuwe matchscore voor fondsen, berekenMatch() blijft
// ongewijzigd) en een subsidieregeling zonder bruikbare score heeft dus net
// zo min onderbouwde voorrang als een fonds.
//
// Deze functie verdeelt de gedeelde quota daarom expliciet over "lanes" in
// plaats van impliciet via de aanroepvolgorde: de lane op
// prioriteitLaneIndex (indien opgegeven) claimt plekken eerst, op volgorde
// van haar eigen, al-bestaande ranking (de gescoorde subsidieregelingen).
// Alle overige lanes (ongescoorde subsidieregelingen, funder-deadlines,
// overige fondsen) delen het restant vervolgens round-robin - telkens één
// plek per lane per ronde, in elke lane's eigen bestaande volgorde - zodat
// geen van die lanes de volledige resterende quota kan opeisen puur omdat
// ze toevallig als eerste aan de beurt zou zijn.
function verdeelQuotaOverLanes(laneGroottes: number[], prioriteitLaneIndex: number | null, totaalQuota: number): number[] {
  const toegekend = laneGroottes.map(() => 0);
  let resterend = totaalQuota;

  if (prioriteitLaneIndex != null) {
    const nemen = Math.min(laneGroottes[prioriteitLaneIndex], resterend);
    toegekend[prioriteitLaneIndex] = nemen;
    resterend -= nemen;
  }

  let vooruitgang = true;

  while (resterend > 0 && vooruitgang) {
    vooruitgang = false;

    for (let i = 0; i < laneGroottes.length; i++) {
      if (resterend <= 0) break;
      if (i === prioriteitLaneIndex) continue;

      if (toegekend[i] < laneGroottes[i]) {
        toegekend[i]++;
        resterend--;
        vooruitgang = true;
      }
    }
  }

  return toegekend;
}

// Deadline-architectuur, enkelvoudige koppeling: funder-brede datamomenten
// (geen regelingkoppeling - subsidieregeling_id is null) via een eigen
// sibling-RPC (kompas_funder_deadlines_voor_tier), met exact dezelfde
// centrale tier-regel (subsidie_zichtbaar_voor_tier) als subsidieregelingContext
// hieronder - geen tweede rechtenmodel. Los van kompas_subsidieregelingen_voor_tier
// gehouden (niet die RPC's kolomvorm uitgebreid) omdat funder-brede data geen
// regelingspecifieke velden heeft (begrotingseisen, aanvraagprocedure, etc.).
// RC1 stap 2, productbeslissing (2026-10-01): de RPC-aanroep hieronder
// blijft ongewijzigd altijd met 'premium' (volledige database/candidate
// pool, zie toelichting bovenaan dit bestand) - dat blijft bewust zo, zodat
// elke tier exact dezelfde, volledige set funder-deadlines onderzoekt.
// RC1 stap 2, correctie (2026-10-02): opgesplitst in een ophaal-/
// filterfunctie (deze) en een aparte tekstopbouwfunctie
// (bouwFunderDeadlineTekst hieronder). Reden: de Free-quota moet nu, over
// alle drie contextbronnen heen, EXPLICIET verdeeld worden (zie
// verdeelQuotaOverLanes hierboven) in plaats van sequentieel per functie te
// worden verbruikt - dat kan pas ná het ophalen van alle drie bronnen (zie
// de aanroepvolgorde in Deno.serve), dus de tekstopbouw moet apart van het
// ophalen/filteren staan.
async function funderDeadlineKandidaten(admin: any, tier: string, isAdmin: boolean) {
  try {
    const { data, error } = await admin.rpc('kompas_funder_deadlines_voor_tier', { p_tier: 'premium' });

    if (error || !Array.isArray(data) || !data.length) {
      return null;
    }

    const funderIds = new Set<string>(data.map((f: any) => String(f.funder_id)));

    const toegankelijk: any[] = [];
    const ontoegankelijk: any[] = [];

    for (const f of data) {
      if (isZichtbaarVoorTier(f.access_tier, tier, isAdmin)) {
        toegankelijk.push(f);
      } else {
        ontoegankelijk.push(f);
      }
    }

    return {
      toegankelijk,
      ontoegankelijkAantal: ontoegankelijk.length,
      ontoegankelijkPremiumAantal: ontoegankelijk.filter((f: any) => f.access_tier === 'premium').length,
      funderIds,
    };
  } catch (_) {
    return null;
  }
}

function bouwFunderDeadlineTekst(
  kandidaten: { toegankelijk: any[]; ontoegankelijkAantal: number; ontoegankelijkPremiumAantal: number } | null,
  aantalVolledig: number,
): string | null {
  if (!kandidaten) {
    return null;
  }

  const zichtbaar = kandidaten.toegankelijk.slice(0, aantalVolledig);
  const quotaVerborgenAantal = kandidaten.toegankelijk.length - zichtbaar.length;

  const regels = zichtbaar.map((f: any) => {
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

  // Fondsen die uitsluitend door de Free-quota (niet door access_tier) zijn
  // weggelaten, hebben altijd access_tier === 'free' (zie isZichtbaarVoorTier
  // hierboven - alleen 'free'-rijen bereiken deze tak bij tier 'free') en
  // tellen dus nooit mee in het Premium-subtotaal.
  const verborgenTotaal = quotaVerborgenAantal + kandidaten.ontoegankelijkAantal;
  const verborgenPremium = kandidaten.ontoegankelijkPremiumAantal;
  const aggregaatRegel = verborgenTotaal
    ? `\n\nAanvullende, voor dit lid niet volledig zichtbare fondsen met een eigen eerstvolgende deadline: ${verborgenTotaal} in totaal, waarvan ${verborgenPremium} uitsluitend beschikbaar binnen Premium. Noem hierover uitsluitend deze aantallen - nooit een naam, website, criterium, bedrag of andere inhoudelijke informatie.`
    : '';

  const kop =
    'Hieronder staan funder-brede deadlines waartoe dit lid, op basis van zijn abonnement, daadwerkelijk toegang heeft: deze gelden voor het hele fonds (niet voor één specifieke subsidieregeling uit de lijst hierboven of hieronder). Dit is NIET meer de volledige database: fondsen waar dit lid geen toegang toe heeft staan hier bewust niet (meer) in - zie in plaats daarvan de aparte aantallen onderaan. Verzin nooit een fonds, bedrag, deadline of voorwaarde die hier niet in staat. Noem bij advies duidelijk dat dit een deadline van het fonds zelf is, niet van één specifieke regeling.\n\n';

  const inhoud = regels.length
    ? regels.join('\n')
    : 'Er zijn voor dit lid op dit moment geen fondsen met een eigen, volledig zichtbare eerstvolgende deadline.';

  return (kop + inhoud + aggregaatRegel).slice(0, 30000);
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
// RC1 stap 2, productbeslissing (2026-10-01): zelfde aanpak als
// funderDeadlineKandidaten hierboven - de RPC-aanroep blijft ongewijzigd
// altijd met 'premium' (volledige candidate pool).
// RC1 stap 2, correctie (2026-10-02): zelfde opsplitsing in ophalen/
// filteren (deze functie) versus tekstopbouw (bouwFunderAlgemeneTekst
// hieronder) als bij funderDeadlineKandidaten - zie de toelichting daar.
async function funderAlgemeneKandidaten(admin: any, reedsGenoemdeFunderIds: Set<string>, tier: string, isAdmin: boolean) {
  try {
    const { data, error } = await admin.rpc('kompas_funders_voor_tier', { p_tier: 'premium' });

    if (error || !Array.isArray(data) || !data.length) {
      return null;
    }

    const overige = data.filter((f: any) => !reedsGenoemdeFunderIds.has(String(f.funder_id)));
    if (!overige.length) return null;

    const toegankelijk: any[] = [];
    const ontoegankelijk: any[] = [];

    for (const f of overige) {
      if (isZichtbaarVoorTier(f.access_tier, tier, isAdmin)) {
        toegankelijk.push(f);
      } else {
        ontoegankelijk.push(f);
      }
    }

    return {
      toegankelijk,
      ontoegankelijkAantal: ontoegankelijk.length,
      ontoegankelijkPremiumAantal: ontoegankelijk.filter((f: any) => f.access_tier === 'premium').length,
    };
  } catch (_) {
    return null;
  }
}

function bouwFunderAlgemeneTekst(
  kandidaten: { toegankelijk: any[]; ontoegankelijkAantal: number; ontoegankelijkPremiumAantal: number } | null,
  aantalVolledig: number,
): string | null {
  if (!kandidaten) {
    return null;
  }

  const zichtbaar = kandidaten.toegankelijk.slice(0, aantalVolledig);
  const quotaVerborgenAantal = kandidaten.toegankelijk.length - zichtbaar.length;

  const regels = zichtbaar.map((f: any) => {
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

  const verborgenTotaal = quotaVerborgenAantal + kandidaten.ontoegankelijkAantal;
  const verborgenPremium = kandidaten.ontoegankelijkPremiumAantal;
  const aggregaatRegel = verborgenTotaal
    ? `\n\nAanvullende, voor dit lid niet volledig zichtbare fondsen zonder eigen eerstvolgende aanvraagronde of vergaderdatum: ${verborgenTotaal} in totaal, waarvan ${verborgenPremium} uitsluitend beschikbaar binnen Premium. Noem hierover uitsluitend deze aantallen - nooit een naam, website, criterium, bedrag of andere inhoudelijke informatie.`
    : '';

  const kop =
    'Hieronder staan overige, door een beheerder beoordeelde fondsen waartoe dit lid, op basis van zijn abonnement, daadwerkelijk toegang heeft, zonder eigen eerstvolgende aanvraagronde of vergaderdatum (bijv. fondsen die uitsluitend op uitnodiging of doorlopend schenken). Dit is NIET meer de volledige database: fondsen waar dit lid geen toegang toe heeft staan hier bewust niet (meer) in - zie in plaats daarvan de aparte aantallen onderaan. Gebruik voor de onderstaande fondsen gewoon alle informatie (missie, disciplines, doelgroepen, werkgebied, aanvraagcriteria, bijdrage, website) om het fonds te bespreken of te adviseren. Het ontbreken van een bekende eerstvolgende datum is geen reden om een fonds minder te noemen of over te slaan. Vermeld dat er geen bekende, toekomstige deadline of vergaderdatum bekend is uitsluitend wanneer een lid daar expliciet naar vraagt. Verzin nooit een fonds, bedrag of voorwaarde die hier niet in staat.\n\n';

  const inhoud = regels.length
    ? regels.join('\n')
    : 'Er zijn voor dit lid op dit moment geen overige fondsen die met volledige details getoond mogen worden.';

  return (kop + inhoud + aggregaatRegel).slice(0, 30000);
}

// "Volgende fase": de subsidieregelingen die dit lid, op basis van zijn eigen
// abonnement, mag zien.
//
// AI Fundraising Assistant, fase 1: geeft matchSignalen mee (optioneel, kan
// null zijn), dan krijgt elke regeling er een uitlegbare matchscore bij
// (berekenMatch hierboven) en worden de regelingen aflopend op matchscore
// gesorteerd - zodat de sterkste kandidaten bovenaan staan.
// RUNTIME IDENTIEK VOOR ALLE ABONNEMENTEN (2026-09-28): de RPC-aanroep
// hieronder blijft ongewijzigd altijd met 'premium' (volledige candidate
// pool, zie toelichting bovenaan dit bestand) - de sortering hierboven
// gebeurt dus nog steeds over de volledige, tier-onafhankelijke set.
// RC1 stap 2, correctie (2026-10-02): opgesplitst in ophalen/scoren/
// sorteren/tier-filteren (deze functie) en tekstopbouw
// (bouwSubsidieregelingTekst hieronder). Reden: de Free-quota kan pas
// eerlijk verdeeld worden (zie verdeelQuotaOverLanes in Deno.serve) als ook
// bekend is hoeveel van de hier toegankelijke regelingen een daadwerkelijk
// berekende matchscore hebben (aantalGescoord) - en dat is pas ná het
// ophalen en scoren bekend, dus vóórdat de uiteindelijke quota verdeeld kan
// worden. Geen nieuwe matchscore, geen wijziging aan berekenMatch() zelf -
// uitsluitend tellen hoeveel van de AL berekende scores bruikbaar zijn.
async function subsidieregelingKandidaten(admin: any, matchSignalen: MatchSignalen | null, tier: string, isAdmin: boolean) {
  try {
    const { data, error } = await admin.rpc('kompas_subsidieregelingen_voor_tier', { p_tier: 'premium' });

    if (error || !Array.isArray(data)) {
      return { toegankelijk: [] as any[], aantalGescoord: 0, ontoegankelijkAantal: 0, ontoegankelijkPremiumAantal: 0, legeDatabaseTekst: null as string | null };
    }

    if (!data.length) {
      return {
        toegankelijk: [] as any[],
        aantalGescoord: 0,
        ontoegankelijkAantal: 0,
        ontoegankelijkPremiumAantal: 0,
        legeDatabaseTekst:
          'Er staan op dit moment geen subsidieregelingen in de database van Het Fondsenwervers Collectief. Verzin er zelf geen bij - zeg dat eerlijk en vraag zo nodig door naar wat het lid zoekt.',
      };
    }

    // AI Fundraising Assistant, fase 1: matchscore per regeling berekenen (als
    // er signalen zijn) en de lijst daarop sorteren - de sterkste match komt
    // bovenaan. Dit blijft ongewijzigd volledig en tier-onafhankelijk: de
    // tier-filter hieronder werkt op de ALLANG gesorteerde lijst, niet andersom.
    const metMatch = data.map((r: any) => ({ r, match: matchSignalen ? berekenMatch(r, matchSignalen) : null }));

    if (matchSignalen) {
      metMatch.sort((a: any, b: any) => (b.match?.totaal ?? -1) - (a.match?.totaal ?? -1));
    }

    const toegankelijk: typeof metMatch = [];
    const ontoegankelijk: typeof metMatch = [];

    for (const item of metMatch) {
      if (isZichtbaarVoorTier(item.r.access_tier, tier, isAdmin)) {
        toegankelijk.push(item);
      } else {
        ontoegankelijk.push(item);
      }
    }

    // Omdat metMatch hierboven al aflopend op match.totaal is gesorteerd
    // (ontbrekende/onberekenbare scores tellen daarbij als -1, dus altijd
    // achteraan), vormen de items mét een daadwerkelijk berekende score
    // (match.totaal != null) altijd een aaneengesloten voorvoegsel van
    // 'toegankelijk' - alleen die voorste reeks tellen volstaat dus, zonder
    // opnieuw te hoeven filteren of sorteren.
    let aantalGescoord = 0;
    for (const item of toegankelijk) {
      if (item.match && item.match.totaal != null) {
        aantalGescoord++;
      } else {
        break;
      }
    }

    return {
      toegankelijk,
      aantalGescoord,
      ontoegankelijkAantal: ontoegankelijk.length,
      ontoegankelijkPremiumAantal: ontoegankelijk.filter((item: any) => item.r.access_tier === 'premium').length,
      legeDatabaseTekst: null as string | null,
    };
  } catch (_) {
    return { toegankelijk: [] as any[], aantalGescoord: 0, ontoegankelijkAantal: 0, ontoegankelijkPremiumAantal: 0, legeDatabaseTekst: null as string | null };
  }
}

function bouwSubsidieregelingTekst(
  kandidaten: {
    toegankelijk: { r: any; match: any }[];
    ontoegankelijkAantal: number;
    ontoegankelijkPremiumAantal: number;
    legeDatabaseTekst: string | null;
  },
  aantalVolledig: number,
  matchSignalen: MatchSignalen | null,
): string | null {
  if (kandidaten.legeDatabaseTekst) {
    return kandidaten.legeDatabaseTekst;
  }

  const zichtbaar = kandidaten.toegankelijk.slice(0, aantalVolledig);
  const quotaVerborgenAantal = kandidaten.toegankelijk.length - zichtbaar.length;

  const perRegeling = zichtbaar.map(({ r, match }: any) => {
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

  const verborgenTotaal = quotaVerborgenAantal + kandidaten.ontoegankelijkAantal;
  const verborgenPremium = kandidaten.ontoegankelijkPremiumAantal;
  const aggregaatRegel = verborgenTotaal
    ? `\n\nAanvullende, voor dit lid niet volledig zichtbare subsidieregelingen: ${verborgenTotaal} in totaal, waarvan ${verborgenPremium} uitsluitend beschikbaar binnen Premium. Noem hierover uitsluitend deze aantallen - nooit een naam, gever, bedrag, deadline of andere inhoudelijke informatie.`
    : '';

  const kop =
    'Hieronder staan de subsidieregelingen uit de database van Het Fondsenwervers Collectief (beheerd via Beheer -> Subsidieregelingen) waartoe dit lid, op basis van zijn abonnement, daadwerkelijk toegang heeft, aflopend gesorteerd op matchscore als die berekend kon worden. Dit is NIET meer de volledige database: regelingen waar dit lid geen toegang toe heeft staan hier bewust niet (meer) in - zie in plaats daarvan de aparte aantallen onderaan. Gebruik uitsluitend deze lijst voor concreet fondsadvies: verzin nooit een regeling, gever, bedrag, deadline of voorwaarde die hier niet in staat. Is er niets passends bij, zeg dat eerlijk in plaats van een regeling te verzinnen.' +
    (matchSignalen
      ? ' Staat er een matchscore/percentage bij een regeling, gebruik dan uitsluitend dat getal en die toelichting als je een percentage of "sterke match"/"aandachtspunt" noemt - bereken of schat nooit zelf een eigen percentage. Staat een onderdeel onder "Niet mee te wegen (onbekend)", doe daar dan geen uitspraak over en verzin geen score - zeg desgewenst dat je dat niet kunt beoordelen en vraag er evt. naar.'
      : '')
    + '\n\n';

  const inhoud = perRegeling.length
    ? perRegeling.join('\n')
    : 'Er zijn voor dit lid op dit moment geen subsidieregelingen die met volledige details getoond mogen worden.';

  return (kop + inhoud + aggregaatRegel).slice(0, 60000);
}

// Gedeeld door mode: 'extract' (fase 3) en mode: 'website' (fase 4): dezelfde
// vraag aan de AI, alleen de bronomschrijving in de systeemtekst verschilt.
async function voorstelUitTekst(apiKey: string, model: string, tekst: string, bronOmschrijving: string) {
  const veldenLijst = EXTRACTIE_VELDEN.map((v) => `${v.n} (${v.l})`).join(', ');

  const systeemExtractie = `Je helpt Nederlandse maatschappelijke organisaties hun organisatieprofiel in Subsidie Kompas aan te vullen op basis van ${bronOmschrijving}.

Lees de tekst hieronder en haal er uitsluitend gegevens uit die je met voldoende zekerheid in de tekst kunt terugvinden. Verzin nooit informatie en doe geen aannames. Laat een veld gewoon weg als het niet duidelijk in de tekst staat.

De toegestane velden zijn: ${veldenLijst}.

Antwoord uitsluitend met geldige JSON in de vorm {"velden": {"veldnaam": "waarde"}}, met alleen de velden waarover je zeker bent en uitsluitend de hierboven genoemde veldnamen.`;

  const uitkomst = await fetchOpenAiMetTimeout('https://api.openai.com/v1/chat/completions', {
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
  }, KORTE_CALL_TIMEOUT_MS);

  if (!uitkomst.ok) {
    console.error(`[subsidie-kompas] voorstelUitTekst_${uitkomst.soort}`);
    return { voorstel: null as Record<string, string> | null, usage: null as any, mislukt: true };
  }

  const antwoord = uitkomst.response;

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

// RC1 stap 3D (2026-10-01): voorbereiding Excel-export voor begrotingen (zie
// claude/rc1-stap3-analyse-begrotingsflow-excel.md, optie C). GEEN Excel in
// deze stap - alleen de betrouwbare tussenlaag: bestaande, definitieve
// begrotingstekst uit de chat -> canonical, machineleesbare Budget.
//
// Zelfde architectuurpatroon als voorstelUitTekst() hierboven: een eigen,
// losse OpenAI-call (dus NIET bij elk chatbericht - alleen wanneer dit
// functioneel nodig is, bijv. straks vanuit een Excel-exportactie),
// temperature 0.1, response_format json_object, een harde toegestane-
// veldenstructuur, en defensieve JSON-parsing die nooit een onverwachte
// vorm laat doorsijpelen.
//
// VEILIGHEID (opdrachtpunt "Veiligheid extraction"): er wordt UITSLUITEND de
// begrotingstekst zelf meegestuurd - geen system prompt, geen Premium-
// database, geen verborgen funders, geen runtimecontext, geen Projectdossier-
// bronmetadata, geen persoonsgegevens, geen debugdata. De bestaande,
// structured projectfinanciering (budget_total/requested_amount/
// own_contribution/cofinanciers) wordt HIER NIET aan het taalmodel gevraagd -
// die bestaat al als echte getallen in de database en wordt pas later, in
// code (zie berekenBudget() in src/shared/budget/berekenBudget.js), met het
// resultaat van deze functie samengevoegd. Dat voorkomt een overbodige
// OpenAI-aanroep voor iets dat al structured data is.
//
// REKENWERK (opdrachtpunten "Rekenwerk niet vertrouwen op AI" /
// "Extraction ≠ rekenmachine"): deze functie berekent zelf NOOIT een bedrag.
// Ze leest per kostenregel hooguit drie losse, letterlijke gegevens -
// aantal, eenheidsprijs, en (indien de brontekst zelf al een totaal/subtotaal
// voor die regel noemt) het door de brontekst genoemde bedrag - en laat de
// vermenigvuldiging/validatie volledig aan berekenBudget() over. Zo kan een
// eventuele rekenfout van het taalmodel in de chattekst zelf (bijv. "10 x
// €250 = €3.000") achteraf in code worden gedetecteerd in plaats van stil te
// worden overgenomen.
const BUDGET_CATEGORIEEN = [
  'personeel',
  'inhuur',
  'activiteiten',
  'materialen',
  'locatie',
  'reiskosten',
  'communicatie',
  'vrijwilligers',
  'monitoring en evaluatie',
  'projectmanagement',
  'overhead',
  'onvoorzien',
  'overig',
];

async function budgetUitTekst(apiKey: string, model: string, begrotingTekst: string) {
  const categorieenLijst = BUDGET_CATEGORIEEN.join(', ');

  const systeemExtractie = `Je zet een al bestaande, definitieve begroting uit Subsidie Kompas om in een strikt gestructureerde vorm, voor intern gebruik (geen nieuwe begroting opstellen - uitsluitend de tekst hieronder structureren).

BELANGRIJKSTE REGEL: je bent een transcribent, geen rekenmachine en geen begrotingsopsteller.
- Lees per kostenpost UITSLUITEND wat letterlijk in de tekst staat: aantal, eenheidsprijs/tarief, en - als de tekst zelf al een bedrag of subtotaal voor die post noemt - dat genoemde bedrag.
- Vermenigvuldig, oftel of herbereken ZELF NOOIT. Geef aantal en eenheidsprijs apart door; het bedrag dat je meegeeft (statedAmount) is uitsluitend het bedrag dat de tekst zelf al noemt, nooit een eigen berekening.
- Verzin nooit een aantal of eenheidsprijs wanneer de tekst alleen een vast totaalbedrag voor een post noemt (bijv. "Vergunningen: €750") - laat quantity/unitPrice dan gewoon leeg (null) en geef alleen statedAmount door.
- Verzin nooit een kostenpost, categorie of bedrag die niet in de tekst voorkomt.
- Ontbreekt een bedrag/aantal/tarief voor een post, geef dan null door - vul nooit zelf aan.

Gebruik voor "category" uitsluitend een van: ${categorieenLijst}. Kies "overig" als niets anders past.

Antwoord uitsluitend met geldige JSON in exact deze vorm:
{"expenseLines": [{"category": "...", "description": "...", "notes": "..."|null, "quantity": number|null, "unitPrice": number|null, "statedAmount": number|null}], "meta": {"totalCostsStated": number|null, "requestedAmountStated": number|null, "isConceptStated": boolean}}

"meta.totalCostsStated" is uitsluitend het totaalbedrag dat de tekst zelf als einduitkomst noemt (voor latere controle - niet zelf berekenen). "meta.requestedAmountStated" is het bedrag dat expliciet als aangevraagd/gevraagd bedrag wordt genoemd, indien aanwezig. "meta.isConceptStated" is true wanneer de tekst zelf aangeeft een conceptscenario/niet-sluitende versie te zijn, anders false.`;

  const uitkomst = await fetchOpenAiMetTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systeemExtractie },
        { role: 'user', content: String(begrotingTekst || '').slice(0, 20000) },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  }, KORTE_CALL_TIMEOUT_MS);

  if (!uitkomst.ok) {
    console.error(`[subsidie-kompas] budgetUitTekst_${uitkomst.soort}`);
    return { budget: null as { expenseLines: any[]; meta: Record<string, unknown> } | null, usage: null as any, mislukt: true };
  }

  const antwoord = uitkomst.response;

  if (!antwoord.ok) {
    return { budget: null as { expenseLines: any[]; meta: Record<string, unknown> } | null, usage: null as any, mislukt: true };
  }

  const data = await antwoord.json();
  const ruw = data.choices?.[0]?.message?.content;
  const toegestaneCategorieen = new Set(BUDGET_CATEGORIEEN);
  const expenseLines: Array<Record<string, unknown>> = [];
  let meta: Record<string, unknown> = { totalCostsStated: null, requestedAmountStated: null, isConceptStated: false };

  // Alleen eindige getallen of null worden doorgelaten - een door het model
  // teruggegeven string, NaN of ander onverwacht type wordt hier al
  // genegeerd (null), niet pas verderop in de deterministische validator.
  const getalOfNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  try {
    const parsed = JSON.parse(ruw || '{}');
    const regels = Array.isArray(parsed?.expenseLines) ? parsed.expenseLines : [];

    regels.forEach((r: any) => {
      if (!r || typeof r !== 'object') {
        return;
      }

      const category = toegestaneCategorieen.has(String(r.category)) ? String(r.category) : 'overig';
      const description = typeof r.description === 'string' ? r.description.slice(0, 300) : '';

      if (!description) {
        return;
      }

      expenseLines.push({
        category,
        description,
        notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes.slice(0, 300) : null,
        quantity: getalOfNull(r.quantity),
        unitPrice: getalOfNull(r.unitPrice),
        statedAmount: getalOfNull(r.statedAmount),
      });
    });

    if (parsed?.meta && typeof parsed.meta === 'object') {
      meta = {
        totalCostsStated: getalOfNull(parsed.meta.totalCostsStated),
        requestedAmountStated: getalOfNull(parsed.meta.requestedAmountStated),
        isConceptStated: parsed.meta.isConceptStated === true,
      };
    }
  } catch (_) {
    // laat expenseLines leeg; de aanroeper behandelt dit als "niets
    // betrouwbaars gevonden", nooit als een gevulde, mogelijk verzonnen lijst
  }

  return { budget: { expenseLines, meta }, usage: data.usage, mislukt: false };
}

// Projectdossier - alleen betrouwbare feiten (2026-10-01): kleine
// tekstbewerkingen die nodig zijn om een "bron" voor een dossierveld te
// kunnen verifiëren, los van hoofdlettergebruik, leestekens en diakrieten
// (zodat "Scholen." en "scholen" als hetzelfde citaat tellen).
function normaliseerVoorVergelijking(tekst: string): string {
  return String(tekst || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Komt `citaat` (genormaliseerd) daadwerkelijk voor in `bronTekst`
// (genormaliseerd)? Een te kort citaat (< 2 tekens na normalisatie) wordt
// nooit als bewijs geaccepteerd - dat zou te triviaal te vervalsen zijn.
function citaatKomtVoorIn(citaat: string, bronTekst: string): boolean {
  const schoonCitaat = normaliseerVoorVergelijking(citaat);

  if (schoonCitaat.length < 2 || !bronTekst) {
    return false;
  }

  return normaliseerVoorVergelijking(bronTekst).includes(schoonCitaat);
}

// Herkenbaar bevestigende toon (Nederlands, bewust ruim) - een "bevestigd"
// dossierveld mag alleen landen wanneer het citaat van het lid hier ook
// daadwerkelijk op lijkt, niet op elke willekeurige reactie.
const BEVESTIGING_PATROON =
  /\b(ja+|jazeker|yes|klopt|correct|precies|inderdaad|akkoord|mee eens|eens|prima|top|oke|ok|oké|goed zo|dat is zo|dat is juist|dat klopt|doen we|nemen we (mee|over)|gaan we (doen|zo doen)|dat doen we|graag|zeker weten|helemaal mee eens)\b/i;

function isBevestiging(tekst: string): boolean {
  return BEVESTIGING_PATROON.test(String(tekst || ''));
}

// Zet het al opgeslagen organisatieprofiel en/of gekoppelde project om naar
// één leesbare tekst - zowel om in de prompt aan het model te tonen (als
// toegestane bron "profiel") als om een door het model opgegeven "profiel"-
// citaat tegen te verifiëren. Dezelfde EXTRACTIE_VELDEN/PROJECT_VELDEN-
// labels als elders in dit bestand, geen nieuwe veldenlijst.
function betrouwbareContextTekst(
  orgProfile: Record<string, unknown> | null,
  project: Record<string, unknown> | null,
): { weergave: string } | null {
  const orgRegels = orgProfile
    ? EXTRACTIE_VELDEN.filter((v) => !leegVeld((orgProfile as Record<string, unknown>)[v.n])).map(
        (v) => `${v.l}: ${String((orgProfile as Record<string, unknown>)[v.n])}`,
      )
    : [];
  const projectRegels = project
    ? PROJECT_VELDEN.filter((v) => !leegVeld((project as Record<string, unknown>)[v.n])).map(
        (v) => `${v.l}: ${String((project as Record<string, unknown>)[v.n])}`,
      )
    : [];

  if (!orgRegels.length && !projectRegels.length) {
    return null;
  }

  const weergave = [
    orgRegels.length ? `Organisatieprofiel - ${orgRegels.join('; ')}` : '',
    projectRegels.length ? `Gekoppeld project - ${projectRegels.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { weergave };
}

// Verifieert, server-side (dus zonder het model opnieuw te hoeven
// vertrouwen), of een door het model opgegeven bron voor één dossierveld
// daadwerkelijk klopt met wat er echt in het gesprek/profiel staat:
//   - "lid": het citaat moet woordelijk voorkomen in de LID-berichten zelf.
//   - "profiel": het citaat moet woordelijk voorkomen in het al opgeslagen
//     organisatieprofiel/project.
//   - "bevestigd": het `voorstelCitaat` moet woordelijk voorkomen in de
//     eerdere berichten van Subsidie Kompas zelf (er is dus echt iets
//     voorgesteld), ÉN het `citaat` moet woordelijk voorkomen in de
//     LID-berichten ÉN er herkenbaar bevestigend uitzien - anders is er
//     niets geldigs bevestigd.
// Alles wat niet aan één van deze drie gevallen voldoet, wordt afgewezen:
// het veld wordt dan genegeerd (de vorige waarde blijft staan) in plaats van
// het dossier te vervuilen met een voorstel dat nooit is bevestigd.
function valideerDossierBron(
  bronInfo: any,
  lidTekst: string,
  assistentTekst: string,
  profielTekst: string,
): boolean {
  if (!bronInfo || typeof bronInfo !== 'object') {
    return false;
  }

  const citaat = String(bronInfo.citaat || '').trim();

  if (!citaat) {
    return false;
  }

  if (bronInfo.type === 'lid') {
    return citaatKomtVoorIn(citaat, lidTekst);
  }

  if (bronInfo.type === 'profiel') {
    return Boolean(profielTekst) && citaatKomtVoorIn(citaat, profielTekst);
  }

  if (bronInfo.type === 'bevestigd') {
    const voorstelCitaat = String(bronInfo.voorstelCitaat || '').trim();

    return (
      Boolean(voorstelCitaat) &&
      citaatKomtVoorIn(voorstelCitaat, assistentTekst) &&
      citaatKomtVoorIn(citaat, lidTekst) &&
      isBevestiging(citaat)
    );
  }

  return false;
}

// Projectdossier - alleen betrouwbare feiten (2026-10-01): oorzaak van het
// in de acceptatietest gevonden risico was dat deze functie het volledige,
// afgewisselde Lid/Subsidie Kompas-transcript als gelijkwaardige invoer aan
// het model gaf en uitsluitend op de promptinstructie ("haal er uitsluitend
// informatie uit die het lid zelf expliciet heeft genoemd") vertrouwde om
// een eigen suggestie van de assistent zelf niet over te nemen - zonder
// enige server-side controle. Dat is gebleken onvoldoende betrouwbaar.
//
// Nieuwe aanpak: de assistent-berichten blijven IN het transcript staan
// (ze zijn nodig om te snappen waar een kort "ja, dat klopt" van het lid
// naar verwijst), maar worden nooit meer zelf vertrouwd. Het model moet nu
// per veld ook een "bron" opgeven (lid/profiel/bevestigd, met citaten), en
// valideerDossierBron() hierboven controleert die bron mechanisch tegen de
// echte tekst - een veld zonder geverifieerde bron wordt genegeerd. Zie ook
// de toelichting bij betrouwbareContextTekst() voor de nieuwe, derde
// toegestane bron (al opgeslagen organisatie-/projectgegevens).
async function projectdossierUitGesprek(
  apiKey: string,
  model: string,
  berichten: any[],
  bestaand: Record<string, string> | null,
  orgProfile: Record<string, unknown> | null,
  project: Record<string, unknown> | null,
) {
  const veldenLijst = DOSSIER_VELDEN.join(', ');

  const recent = berichten
    .slice(-16)
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content);

  const fragment = recent
    .map((m: any) => `${m.role === 'user' ? 'Lid' : 'Subsidie Kompas'}: ${String(m.content || '').slice(0, 2000)}`)
    .join('\n');

  // Alleen voor de server-side verificatie hieronder - tellen NOOIT mee als
  // bron, ook al staan ze (voor het begrijpen van een bevestiging) wél in
  // `fragment` hierboven.
  const lidTekst = recent
    .filter((m: any) => m.role === 'user')
    .map((m: any) => String(m.content || ''))
    .join('\n');
  const assistentTekst = recent
    .filter((m: any) => m.role === 'assistant')
    .map((m: any) => String(m.content || ''))
    .join('\n');

  const betrouwbareContext = betrouwbareContextTekst(orgProfile, project);

  const bestaandTekst =
    bestaand && Object.keys(bestaand).length
      ? `Dit is het al bekende Projectdossier (bijgewerkt tot en met het vorige bericht): ${JSON.stringify(
          bestaand,
        )}. Vul dit aan of corrigeer het op basis van het gesprek hieronder - geef altijd het volledige, bijgewerkte dossier terug (dus ook de velden die niet zijn veranderd), niet alleen wat er is toegevoegd.`
      : 'Er is nog geen eerder Projectdossier - stel het voor het eerst samen op basis van het gesprek hieronder.';

  const systeemExtractie = `Je houdt, uitsluitend voor intern gebruik, een compact Projectdossier bij voor een projectplan-gesprek in Subsidie Kompas. ${bestaandTekst}

BELANGRIJKSTE REGEL: het Projectdossier mag uitsluitend bestaan uit betrouwbare feiten. Een nieuw of gewijzigd veld mag UITSLUITEND worden opgenomen wanneer de waarde rechtstreeks komt uit een van deze drie bronnen:
1. Een expliciete uitspraak van het lid zelf in dit gesprek (bron "lid").
2. De hieronder meegegeven, al opgeslagen organisatie- of projectgegevens (bron "profiel").
3. Een eigen voorstel van Subsidie Kompas, maar ALLEEN wanneer het lid dat in dit gesprek expliciet en ondubbelzinnig heeft bevestigd (bron "bevestigd") - nooit alleen omdat Subsidie Kompas het heeft voorgesteld.

Een voorstel, suggestie, voorbeeld, aanname of automatische uitbreiding van Subsidie Kompas zelf is GEEN toegestane bron, zolang het lid dat niet expliciet heeft bevestigd. Bijvoorbeeld:
- Lid: "Ons project heet Buurtmoestuin Noord." -> WEL opslaan (bron "lid").
- Lid: "De doelgroep bestaat uit jongeren met een lichte verstandelijke beperking." -> WEL opslaan (bron "lid").
- Subsidie Kompas: "U zou kunnen samenwerken met scholen en welzijnsorganisaties." (het lid gaat hier niet expliciet mee akkoord) -> NIET opslaan.
- Subsidie Kompas: "Een mogelijke activiteit is een wekelijkse workshop." (geen bevestiging van het lid) -> NIET opslaan.
- Subsidie Kompas: "U zou kunnen samenwerken met scholen." gevolgd door Lid: "Ja, dat klopt." -> NU WEL opslaan (bron "bevestigd"), met de waarde uit het voorstel van Subsidie Kompas.

Het gesprek hieronder staat chronologisch, "Lid" en "Subsidie Kompas" afgewisseld. Gebruik de berichten van Subsidie Kompas zelf uitsluitend om te begrijpen waarnaar een kort bevestigend bericht van het lid verwijst - nooit als zelfstandige bron voor een nieuw feit.
${betrouwbareContext ? `\nAL OPGESLAGEN, BETROUWBARE GEGEVENS (mag gebruikt worden als bron "profiel"):\n${betrouwbareContext.weergave}\n` : ''}
Noemt het lid een eerder genoemd gegeven opnieuw, maar dan anders, dan vervangt die nieuwe waarde de oude.

De toegestane velden zijn uitsluitend: ${veldenLijst}.

Antwoord uitsluitend met geldige JSON in de vorm {"dossier": {"veldnaam": "waarde"}, "bronnen": {"veldnaam": {"type": "lid"|"profiel"|"bevestigd", "citaat": "korte, zo letterlijk mogelijke tekst uit een LID-bericht die deze waarde rechtvaardigt (bij 'profiel' in plaats daarvan een letterlijk citaat uit de hierboven genoemde opgeslagen gegevens)", "voorstelCitaat": "alleen bij type 'bevestigd': het letterlijke eerdere voorstel van Subsidie Kompas dat hiermee bevestigd wordt"}}}. Geef voor ELK veld in "dossier" ook het bijpassende veld in "bronnen" mee - een veld zonder geldige, controleerbare bron wordt genegeerd. Neem alleen velden op waarover je zeker bent, en uitsluitend de hierboven genoemde veldnamen. Houd elke waarde compact (één tot enkele zinnen, geen volledige lopende tekst).`;

  const uitkomst = await fetchOpenAiMetTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systeemExtractie },
        { role: 'user', content: fragment },
      ],
      temperature: 0.1,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
    }),
  }, KORTE_CALL_TIMEOUT_MS);

  if (!uitkomst.ok) {
    console.error(`[subsidie-kompas] projectdossierUitGesprek_${uitkomst.soort}`);
    return { dossier: bestaand, usage: null as any, mislukt: true };
  }

  const antwoord = uitkomst.response;

  if (!antwoord.ok) {
    return { dossier: bestaand, usage: null as any, mislukt: true };
  }

  const data = await antwoord.json();
  const ruw = data.choices?.[0]?.message?.content;
  const toegestaan = new Set<string>(DOSSIER_VELDEN as readonly string[]);
  const dossier: Record<string, string> = { ...(bestaand || {}) };

  try {
    const parsed = JSON.parse(ruw || '{}');
    const velden = parsed?.dossier && typeof parsed.dossier === 'object' ? parsed.dossier : {};
    const bronnen = parsed?.bronnen && typeof parsed.bronnen === 'object' ? parsed.bronnen : {};

    Object.entries(velden).forEach(([k, v]) => {
      if (!toegestaan.has(k) || v == null || !String(v).trim()) {
        return;
      }

      const geldig = valideerDossierBron(
        (bronnen as Record<string, unknown>)[k],
        lidTekst,
        assistentTekst,
        betrouwbareContext?.weergave || '',
      );

      if (geldig) {
        dossier[k] = String(v).slice(0, 800);
      }
      // Geen geldige, verifieerbare bron: het veld wordt genegeerd en de
      // vorige waarde (indien aanwezig) blijft gewoon staan. Dit is exact de
      // fix voor het in de acceptatietest gevonden risico: een voorstel van
      // de assistent zelf, zonder expliciete en verifieerbare bevestiging
      // door het lid, bereikt het Projectdossier nu nooit meer.
    });
  } catch (_) {
    // mislukte parse: het bestaande dossier blijft ongewijzigd staan, net als
    // voorstelUitTekst() hierboven bij een mislukte parse een leeg voorstel
    // teruggeeft in plaats van te falen.
  }

  return { dossier: Object.keys(dossier).length ? dossier : null, usage: data.usage, mislukt: false };
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

// STAP 3 (websearch): leest een Responses API-antwoord (ruwe JSON van
// https://api.openai.com/v1/responses, zowel het volledige niet-streaming-
// antwoord als het "response"-object binnen een response.completed-
// streamevent) en haalt daar de zichtbare tekst en, indien websearch is
// gebruikt, de bronnen (url_citation-annotaties) uit. Reproduceert bewust
// geen ruwe OpenAI-structuur naar de frontend: alleen platte tekst + een
// eenvoudige {title, url}-lijst, precies zoals het bestaande sources-veld
// dat al sinds langer door chat.js wordt doorgegeven verwacht.
function leesResponsesUitvoer(data: any): { tekst: string; bronnen: { title: string; url: string }[]; websearchGebruikt: boolean } {
  const output = Array.isArray(data?.output) ? data.output : [];
  let tekst = '';
  let websearchGebruikt = false;
  const gezienUrls = new Set<string>();
  const bronnen: { title: string; url: string }[] = [];

  for (const item of output) {
    if (item?.type === 'web_search_call') {
      websearchGebruikt = true;
      continue;
    }

    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;

    for (const deel of item.content) {
      if (typeof deel?.text === 'string') tekst += deel.text;

      if (Array.isArray(deel?.annotations)) {
        for (const a of deel.annotations) {
          const url = typeof a?.url === 'string' ? a.url : '';

          if (a?.type === 'url_citation' && url && !gezienUrls.has(url) && bronnen.length < 10) {
            gezienUrls.add(url);
            bronnen.push({ title: String(a.title || url).slice(0, 300), url: url.slice(0, 2000) });
          }
        }
      }
    }
  }

  // Bewuste, minimale terugvaloptie: sommige SDK's/antwoorden voegen een
  // kant-en-klare output_text-samenvatting toe. Alleen gebruikt als er via
  // de output-array hierboven (de officiële, documentbron) niets werd
  // gevonden - nooit in plaats daarvan.
  if (!tekst && typeof data?.output_text === 'string') tekst = data.output_text;

  return { tekst, bronnen, websearchGebruikt };
}

// STAP 4B, fix 1 (websearch betrouwbaar maken): de acceptatietest van STAP 3
// (claude/status-stap4a-acceptatietest.md) liet zien dat tool_choice: 'auto'
// onvoldoende betrouwbaar is - bij meerdere vragen waarvoor kompas.system
// expliciet actueel onderzoek voorschrijft (STAP 2 van de fondsenscan-
// werkwijze: "voer eerst actueel online fondsenonderzoek uit", en de losse
// regels over actuele deadlines/bedragen/openstelling) koos het model ervoor
// niet te zoeken. Dit is bewust GEEN AI-classifier en GEEN tweede modelcall:
// een klein, uitlegbaar regelsysteem dat alleen bepaalt of websearch dit ene
// bericht verplicht is (tool_choice: 'required') of, zoals voorheen, aan het
// model zelf overgelaten wordt (tool_choice: 'auto'). De classificatie
// gebeurt uitsluitend server-side, op basis van de laatste vraag van het lid
// en al bestaande server-side signalen (kompasMode, matchSignalen/project/
// context) - een lid kan dit nooit zelf afdwingen door iets in de prompttekst
// te zetten.
//
// Twee categorieën:
//  A. Fondsen/financiers ZOEKEN of MATCHEN (fondsadvies, fondsenscan,
//     aanvullende financier). kompas.system schrijft voor dat hiervoor altijd
//     eerst actueel online onderzoek plaatsvindt ("ongeacht accountniveau"),
//     maar ook dat er bij onvoldoende projectcontext eerst hooguit drie
//     verduidelijkende vragen worden gesteld in plaats van meteen gezocht.
//     Daarom alleen verplicht wanneer er al voldoende projectcontext is
//     (matchSignalen, een gekoppeld project, een contextveld, of dit is al
//     een vervolgvraag in hetzelfde gesprek) - anders blijft 'auto', zodat de
//     contextcontrole/verduidelijkende vragen uit kompas.system intact blijft.
//  B. Een concrete FEITELIJKE controle over een specifieke regeling/fonds
//     (deadline, openstelling, aanvraagbedrag, voorwaarden, "nog open/
//     beschikbaar/gesloten", verificatie). Dit is altijd verplicht, ongeacht
//     projectcontext: het gaat om een extern, publiek feit, niet om de eigen
//     projectmatching van het lid.
const WEBSEARCH_FONDSENONDERZOEK_PATRONEN: RegExp[] = [
  /\bfondsen?\b[\s\S]{0,40}\b(passen|zoeken|vinden|matchen)\b/i,
  /\b(financiers?|geldschieters?)\b[\s\S]{0,40}\b(zoeken|vinden)\b/i,
  /\baanvullend(e)?\b[\s\S]{0,40}\b(financier|fonds(en)?)\b/i,
  /\b(nieuwe|extra|andere)\b[\s\S]{0,40}\b(financier|fonds(en)?)\b/i,
  /\bfondsenscan\b/i,
  /\bsubsidieregeling(en)?\b[\s\S]{0,40}\b(zoeken|vinden)\b/i,
];

const WEBSEARCH_FEITELIJKE_CONTROLE_PATRONEN: RegExp[] = [
  /\bdeadline\b/i,
  /\bopenstelling\b/i,
  /\bnog\b[\s\S]{0,40}\b(indienen|aanvragen|open|beschikbaar|mogelijk)\b/i,
  /\bgesloten\b/i,
  /\b(maximale?|maximum|minimale?|minimum)\b[\s\S]{0,40}bedrag\b/i, // 'bedrag' zonder voorloop-\b: vangt ook samenstellingen als 'aanvraagbedrag'/'subsidiebedrag'
  /\bhoeveel\b[\s\S]{0,40}\b(aanvragen|subsidie|bijdrage|krijgen)\b/i,
  /\bactuele?\b[\s\S]{0,40}\b(voorwaarden|informatie|gegevens|status)\b/i,
  /\bklopt\b[\s\S]{0,40}\bnog\b/i,
  /\bverifi[eë]er/i,
];

function vereistWebsearch(berichten: any[], kompasMode: KompasMode, heeftProjectContext: boolean): boolean {
  const gebruikersBerichten = berichten.filter((m) => m && m.role === 'user' && m.content);
  const laatste = gebruikersBerichten.length ? String(gebruikersBerichten[gebruikersBerichten.length - 1].content) : '';

  if (WEBSEARCH_FEITELIJKE_CONTROLE_PATRONEN.some((r) => r.test(laatste))) {
    return true;
  }

  const ditIsFondsenonderzoek =
    kompasMode === 'fondsadvies' || WEBSEARCH_FONDSENONDERZOEK_PATRONEN.some((r) => r.test(laatste));

  if (!ditIsFondsenonderzoek) {
    return false;
  }

  // Al voldoende context om echt te gaan matchen (in plaats van eerst
  // verduidelijkende vragen te stellen, zoals kompas.system voorschrijft)?
  return heeftProjectContext || gebruikersBerichten.length > 1;
}

// Verbeterpunten Projectplan + Free/Pro/Premium, punt 5 (2026-10-01): een
// klein, uitlegbaar regelsysteem - zelfde stijl als de WEBSEARCH_*_PATRONEN
// hierboven - dat herkent of het lid in het gesprek zelf vraagt om een
// Word-, Excel- of PDF-document (of anderszins een exporteerbaar bestand).
// Bewust ruim geformuleerd (meerdere, elkaar overlappende patronen) zodat
// uiteenlopende formuleringen ("maak hier een Word-document van", "kun je
// dit exporteren naar PDF", "ik wil dit als Excel-bestand downloaden")
// allemaal worden herkend; een enkel gemist, ongebruikelijk geformuleerd
// verzoek leidt hooguit tot een gewoon chatantwoord in plaats van de
// upgrademelding, nooit tot een alsnog gegenereerd bestand (zie
// DOCUMENTGENERATIE hieronder: documenten worden sowieso nergens in dit
// bestand daadwerkelijk aangemaakt - dat gebeurt uitsluitend aan de
// frontend-kant, via de voor Free al verborgen exportknop).
const DOCUMENTGENERATIE_PATRONEN: RegExp[] = [
  /\b(maak|genereer|exporteer|stel op|schrijf|converteer)\b[\s\S]{0,40}(?:\b(?:word|pdf|excel)\b|\.docx|\.xlsx|\.pdf)/i,
  /\bzet\b[\s\S]{0,30}\bom\b[\s\S]{0,20}(?:\b(?:word|pdf|excel)\b|\.docx|\.xlsx|\.pdf)/i,
  /\b(word|pdf|excel)[-\s]?(bestand|document)\b/i,
  /\bdocument(en)?\b[\s\S]{0,30}\b(genereren|exporteren|downloaden|maken|aanmaken)\b/i,
  /\b(genereren|exporteren|downloaden|aanmaken)\b[\s\S]{0,30}\b(document|bestand|word|pdf|excel)\b/i,
  /\bdownload(en)?\b[\s\S]{0,20}\b(als|naar)?\s*(word|pdf|excel)\b/i,
  /\b(zet|maak)\b[\s\S]{0,20}\bhiervan\b[\s\S]{0,20}\been\b[\s\S]{0,20}\b(word|pdf|excel)\b/i,
];

function vraagtOmDocumentGeneratie(tekst: string): boolean {
  return DOCUMENTGENERATIE_PATRONEN.some((r) => r.test(tekst));
}

// RC1-acceptatietest, bevinding K3 (2026-10-01): de frontend stuurde
// body.kompasMode = 'projectplan' tot nu toe uitsluitend wanneer het lid de
// ene starterchip "Help mij een projectplan opzetten" gebruikte (zie
// KompasToolPage.jsx). Elke andere formulering ("Kun je mij helpen met een
// projectplan?", "Werk dit project uit tot een projectplan") kwam hier aan
// als 'algemeen', waardoor het Projectdossier-verificatiemechanisme
// hieronder (modus === 'projectplan') nooit werd geactiveerd. De frontend
// herkent dezelfde formuleringen inmiddels ook zelf (detecteerProjectplan-
// Intentie() in KompasToolPage.jsx, bewust dezelfde regels maar in een los
// JS-bestand dat deze Deno-functie niet kan importeren - houd beide bij
// wijziging synchroon), maar de server blijft hier, zoals bij
// vraagtOmDocumentGeneratie()/vereistWebsearch() hierboven, de uiteindelijke
// vangnet-controle: een lid kan dit nooit omzeilen door iets anders te
// typen, en een frontend die om wat voor reden dan ook toch 'algemeen'
// stuurt wordt hier alsnog gecorrigeerd. Geen extra taalmodel-aanroep.
//
// Bewust terughoudend, exact dezelfde regels als de frontend: een kale
// vermelding van het woord "project" (bijv. "Welke fondsen passen bij mijn
// project?", "Maak een begroting voor mijn project") activeert dit NOOIT -
// alleen het woord "projectplan" zelf in combinatie met een duidelijke
// vraag/actie, of een expliciete "project (verder) uitwerken/beschrijven
// voor een aanvraag"-formulering.
const PROJECTPLAN_ACTIECUE_PATROON =
  /\b(help|helpt|helpen|hulp|wil|wilt|graag|kun je|kan je|kunt u|maak|gemaakt|schrijf|schrijven|zet[\s\S]{0,10}om|omzetten|opzetten|opstellen|opstel|verbeter|verbeteren|werk[\s\S]{0,40}uit|uitwerken|aanvullen|uitbreiden)\b/i;

const PROJECTPLAN_WOORD_PATROON = /project\s*plan/i;

const PROJECTPLAN_UITWERKEN_PATRONEN: RegExp[] = [
  /\bproject(?:idee)?\b[\s\S]{0,50}\b(?:uit\s*te\s*werken|uitwerken|uit\s*werken)\b/i,
  /\b(?:uit\s*te\s*werken|uitwerken|uit\s*werken)\b[\s\S]{0,50}\bproject(?:idee)?\b/i,
];

const PROJECTPLAN_BESCHRIJVEN_PATRONEN: RegExp[] = [
  /\bproject\b[\s\S]{0,60}\bbeschrijven\b[\s\S]{0,40}\b(?:subsidie)?aanvraag\b/i,
  /\b(?:subsidie)?aanvraag\b[\s\S]{0,40}\bproject\b[\s\S]{0,60}\bbeschrijven\b/i,
];

function vraagtOmProjectplan(tekst: string): boolean {
  if (!tekst) {
    return false;
  }

  if (PROJECTPLAN_WOORD_PATROON.test(tekst) && PROJECTPLAN_ACTIECUE_PATROON.test(tekst)) {
    return true;
  }

  return (
    PROJECTPLAN_UITWERKEN_PATRONEN.some((r) => r.test(tekst)) ||
    PROJECTPLAN_BESCHRIJVEN_PATRONEN.some((r) => r.test(tekst))
  );
}

// RC1 stap 3D (2026-10-01): zelfde vangnet-architectuur als
// vraagtOmProjectplan() hierboven, voor begroting. Bewust dezelfde regels als
// detecteerBegrotingIntentie() in KompasToolPage.jsx (los bestand, kan hier
// niet geïmporteerd worden) - houd beide bij wijziging synchroon. Geen
// nieuwe, algemene intent-engine: een eigen, even kleine regelset.
//
// Bewust terughoudend, zelfde reden als vraagtOmProjectplan(): het woord
// "begroting"/"budget" alleen activeert dit nooit - er moet een duidelijke
// actie-/hulpcue bij staan, en een expliciete vraag OVER de begroting(sgrens)
// van een fonds/regeling (bijv. "Wat is de maximale begroting van dit
// fonds?") activeert dit nooit, ook niet als toevallig een actiecue in
// dezelfde zin staat.
const BEGROTING_WOORD_PATROON = /begroting|budget/i;

const BEGROTING_ACTIECUE_PATROON =
  /\b(help|helpt|helpen|hulp|wil|wilt|graag|kun je|kan je|kunt u|maak|gemaakt|schrijf|schrijven|opstel|opstellen|stel[\s\S]{0,10}op|werk[\s\S]{0,40}uit|uitwerken|aanvullen|uitbreiden|controleer|controleren|check|checken|doorreken|doorrekenen|onderbouw|onderbouwen)\b/i;

const BEGROTING_FONDS_VRAAG_PATRONEN: RegExp[] = [
  /\b(maximale|maximum)\s+begroting\b/i,
  /\bpercentage\b[\s\S]{0,40}\bbegroting\b/i,
  /\bbegroting\b[\s\S]{0,20}\btot\b[\s\S]{0,10}(€|\d)/i,
  /\bbegroting\b[\s\S]{0,40}\b(van|die|dat)\b[\s\S]{0,25}\b(dit|het|deze|die)\s+(fonds|regeling)\b/i,
];

function vraagtOmBegroting(tekst: string): boolean {
  if (!tekst) {
    return false;
  }

  if (BEGROTING_FONDS_VRAAG_PATRONEN.some((r) => r.test(tekst))) {
    return false;
  }

  return BEGROTING_WOORD_PATROON.test(tekst) && BEGROTING_ACTIECUE_PATROON.test(tekst);
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
  // RC1 stap 2, productbeslissing (2026-10-01): server-side admin-detectie,
  // los van subscription_tier/subscription_active. Voorheen bepaalde dit
  // blok uitsluitend het abonnementsniveau; een admin-account zonder actief
  // betaald abonnement werd daardoor - in tegenspraak met kompas.system, dat
  // Admin volledige toegang belooft (RC1-bevinding F5) - feitelijk als Free
  // behandeld. isAdmin wordt uitsluitend gebruikt in isZichtbaarVoorTier()
  // hierboven; de bestaande tier-variabele en de rest van de
  // abonnementslogica (o.a. runtimeContextBericht, huisstijlgates) blijven
  // ongewijzigd op het echte abonnement gebaseerd. Komt, net als
  // subscription_tier hierboven, uitsluitend uit profiles.role - nooit van
  // de client.
  let isAdmin = false;

  if (authHeader.startsWith('Bearer ')) {
    const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    const user = userData?.user;

    if (user) {
      profileId = user.id;

      const { data: profiel, error: profielFout } = await admin
        .from('profiles')
        .select('subscription_tier, subscription_active, trial_ends_at, role')
        .eq('id', user.id)
        .single();

      // Een geldige sessie ZONDER leesbaar profiel is een inconsistente
      // accountstatus (auth-user zonder profiles-rij, of de profielcontrole
      // zelf faalt). Dat mag nooit stilzwijgend als Free doorlopen: de
      // rate-limit-schrijfactie hieronder heeft een foreign key naar
      // profiles en zou voor zo'n account falen, waarna de bewust
      // fail-open limiter hem zou doorlaten. Daarom hier een gecontroleerde
      // weigering, vóór de limiter, RPC's, websearch en OpenAI. Anonieme
      // aanvragen (zonder Bearer-token) zijn hier niet door geraakt.
      if (!profiel) {
        console.error('[subsidie-kompas] profiel_ontbreekt_of_onleesbaar', profielFout?.code ?? 'onbekend');

        return json(
          { error: 'Uw account is niet volledig ingericht. Probeer het later opnieuw of neem contact op met Het Fondsenwervers Collectief.' },
          profielFout?.code === 'PGRST116' ? 403 : 503,
        );
      }

      // Effectieve tier, uitsluitend server-side uit het profiel (nooit van de
      // client): actief betaald abonnement OF een nog lopende proefperiode.
      // Zelfde regel als tierVan() in de frontend en
      // current_user_has_pro_access()/current_user_has_premium_access() in de
      // database. Voorheen telde hier alleen subscription_active, waardoor
      // een gebruiker met een geldige Pro-/Premium-trial server-side als Free
      // werd behandeld terwijl frontend en database hem al als Pro/Premium
      // zagen. Een verlopen trial zonder actief abonnement blijft Free.
      tier = effectieveTier(profiel);

      isAdmin = profiel.role === 'admin';
    }
  }

  // RC1 stap 7 (7C - BE2, runtime hardening): minimale, atomische
  // server-side rate limiter, vóór elke verdere verwerking (RPC's,
  // websearch, OpenAI-aanroepen) en vóór de mode-routing hieronder - dekt
  // zo chat/budget/extract/website uniform, zodat een andere body.mode geen
  // manier is om de limiter te omzeilen. Uitsluitend voor ingelogde
  // gebruikers (profileId hierboven al server-side vastgesteld, nooit uit
  // de client): voor niet-ingelogde Free-aanvragen (profileId === null) is
  // dit BEWUST nog niet geïmplementeerd. Er is, vóór implementatie,
  // expliciet geverifieerd of een betrouwbare, niet-spoofbare
  // client-identificatie (bijv. een proxy-IP-header) beschikbaar is voor
  // Supabase Edge Functions op het hosted platform - dat kon niet met
  // voldoende zekerheid worden vastgesteld (zie rapportage RC1 stap 7), dus
  // is dat deel van BE2, zoals vooraf afgesproken, hier NIET geïmplementeerd
  // in plaats van met een onbetrouwbare, spoofbare constructie.
  if (profileId) {
    const { data: binnenLimiet, error: limietFout } = await admin.rpc('kompas_check_rate_limit', {
      p_profile_id: profileId,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    // Kan de limiet zelf niet gecontroleerd worden (bijv. een tijdelijke
    // databasestoring), dan blokkeert dat de aanvraag NIET: rate limiting is
    // misbruikbeveiliging, geen kernfunctionaliteit, en mag een normaal
    // gesprek nooit breken (zelfde principe als legVerbruikVast() elders in
    // dit bestand).
    if (limietFout) {
      console.error('[subsidie-kompas] rate_limit_controle_mislukt');
    } else if (binnenLimiet === false) {
      console.error('[subsidie-kompas] rate_limit_overschreden');

      return json(
        { error: 'U verstuurt te veel verzoeken kort achter elkaar. Wacht even en probeer het opnieuw.' },
        429,
        { 'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS) },
      );
    }
  }

  let body: any;

  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  }

  // RC1 stap 3D-4 (2026-10-01): begroting -> gestructureerde Budget, voor de
  // Excel-export in de begrotingschat. Roept uitsluitend de al bestaande,
  // ongewijzigde budgetUitTekst() aan (RC1 stap 3D, hierboven) - geen nieuwe
  // extractielogica. budgetUitTekst() is zelf al een pure "transcribent"
  // (nooit een rekenmachine); al het rekenwerk en alle validatie gebeuren
  // uitsluitend client-side in berekenBudget() (src/shared/budget/
  // berekenBudget.js), nooit hier.
  if (body.mode === 'budget') {
    if (tier === 'free') {
      return json({ error: 'Begrotingen laten structureren is een Pro- en Premium-functie.' }, 403);
    }

    const begrotingTekst = String(body.text || '').slice(0, 20000);

    if (!begrotingTekst.trim()) {
      return json({ error: 'Geen begrotingstekst ontvangen om te structureren.' }, 400);
    }

    const { budget, usage, mislukt } = await budgetUitTekst(apiKey, MODEL, begrotingTekst);

    if (mislukt || !budget) {
      return json({ error: 'De begroting kon niet worden gestructureerd. Probeer het opnieuw.' }, 502);
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

    return json({ budget });
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

  // RC1 stap 7 (7D - C1, runtime hardening): bovengrens op het AANTAL
  // berichten, los van de al bestaande lengtebeperking per bericht/de
  // laatste-20-selectie verderop (gesprekshistorie in `invoer`). Zonder deze
  // grens zou een verzoek met duizenden berichten nog altijd volledig
  // ingelezen/doorlopen worden (o.a. de .reverse()/.find()-scans hieronder)
  // vóórdat alleen de laatste 20 daadwerkelijk in de prompt belanden. Ruim
  // boven elk normaal gesprek.
  const MAX_BERICHTEN = 500;

  if (berichten.length > MAX_BERICHTEN) {
    return json({ error: 'Dit gesprek is te lang geworden om in één keer te verwerken.' }, 400);
  }

  // Verbeterpunten Projectplan + Free/Pro/Premium (2026-10-01): het
  // abonnement bepaalt, net als tier hierboven, uitsluitend uit het profiel -
  // nooit van de client. Naar hier naar boven gehaald (stond voorheen pas
  // vlak vóór de invoer-opbouw) zodat zowel de documentgeneratie-blokkade
  // hieronder als matchSignalen/context verderop dezelfde, ene gate
  // gebruiken. Functioneel ongewijzigd voor wat al bestond - alleen eerder
  // berekend en op meer plekken toegepast.
  const magOrganisatiegeheugen = tier !== 'free';

  // Verbeterpunten Projectplan + Free/Pro/Premium, punt 5 (2026-10-01):
  // documentgeneratie (Word/Excel/PDF) is een Pro- en Premium-functie. Dit
  // werd tot nu toe uitsluitend afgedwongen door de exportknop in de
  // frontend te verbergen voor Free (KompasToolPage.jsx) - vraagt een
  // Free-gebruiker er in het gesprek zelf om, dan hing het antwoord af van
  // of het taalmodel kompas.system's instructie daarover goed volgde, zonder
  // enige server-side controle. Zelfde beredenering als vereistWebsearch()
  // verderop in dit bestand: een klein, uitlegbaar, server-side regelsysteem
  // dat de gebruiker nooit zelf kan omzeilen door iets anders te typen, en
  // dat de aanroep naar het taalmodel hier helemaal overslaat (dus ook geen
  // onnodige kosten of risico dat het model het toch camoufleert).
  const laatsteGebruikersBericht = berichten
    .slice()
    .reverse()
    .find((m: any) => m && m.role === 'user' && m.content);

  if (!magOrganisatiegeheugen && laatsteGebruikersBericht && vraagtOmDocumentGeneratie(String(laatsteGebruikersBericht.content))) {
    const upgradeMelding =
      'Documentexport is beschikbaar binnen Pro en Premium.\n\nMet Pro en Premium kunt u projectplannen, fondsenscans, strategieën en andere documenten automatisch laten genereren in de Subsidie Kompas-huisstijl.\n\nWilt u hier meer over weten? Bekijk de mogelijkheden van Pro en Premium.';
    const dossierOngewijzigd = leesProjectDossier(body);

    if (body.stream === true) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                answer: upgradeMelding,
                sources: [],
                veldVoorstellen: {},
                projectDossier: dossierOngewijzigd,
              })}\n\n`,
            ),
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    return json({ answer: upgradeMelding, sources: [], veldVoorstellen: {}, projectDossier: dossierOngewijzigd });
  }

  // STAP 2: de actieve workflow-modus komt uitsluitend uit het nieuwe,
  // aparte veld body.kompasMode (nooit uit body.mode, dat al iets anders
  // betekent - zie de toelichting bij resolveerModus() hierboven) en wordt
  // hier server-side gevalideerd/genormaliseerd vóór gebruik.
  //
  // Verstevigen Projectplan-runtime, punt 4 (2026-09-30): naar hierboven
  // verplaatst (stond voorheen pas vlak vóór de invoer-opbouw) omdat
  // systeemtekst() hieronder nu ook de modus nodig heeft voor de
  // addendum-selectie. Functioneel ongewijzigd - alleen eerder berekend.
  //
  // RC1-acceptatietest, bevinding K3 (2026-10-01): basisModus komt, zoals
  // voorheen, uitsluitend uit body.kompasMode. Stuurt de frontend 'algemeen'
  // terwijl het laatste bericht van het lid zelf een duidelijke
  // projectplanintentie bevat (vraagtOmProjectplan() hierboven), dan wordt
  // dat hier alsnog gecorrigeerd naar 'projectplan' - vóórdat systeemtekst()
  // en het Projectdossier-mechanisme verderop de modus gebruiken. Is de
  // frontend al expliciet met een andere, geldige modus gekomen (bijv.
  // 'projectplan' via de starterchip, of een eventuele toekomstige modus),
  // dan verandert hier niets: dit is uitsluitend een vangnet vóór
  // 'algemeen', nooit een overschrijving van een al gekozen modus.
  const basisModus = resolveerModus(body.kompasMode);
  // RC1 stap 3D (2026-10-01): begroting krijgt hetzelfde vangnet als
  // projectplan hierboven - stuurt de frontend 'algemeen' terwijl het
  // laatste bericht van het lid ondubbelzinnig om een begroting vraagt, dan
  // wordt dat hier alsnog gecorrigeerd. Is de frontend al met een andere,
  // geldige modus gekomen (ook 'begroting' zelf, via de eigen frontend-
  // detectie), dan verandert hier niets - dit is uitsluitend een vangnet
  // vóór 'algemeen'. Projectplan-detectie gaat voor bij een zin die
  // toevallig aan beide zou voldoen (geen van de aangeleverde testzinnen
  // doet dat).
  const laatsteGebruikersTekst = laatsteGebruikersBericht ? String(laatsteGebruikersBericht.content) : '';
  const modus: KompasMode =
    basisModus === 'algemeen' && laatsteGebruikersBericht && vraagtOmProjectplan(laatsteGebruikersTekst)
      ? 'projectplan'
      : basisModus === 'algemeen' && laatsteGebruikersBericht && vraagtOmBegroting(laatsteGebruikersTekst)
        ? 'begroting'
        : basisModus;

  // Het abonnement komt uit het profiel, niet uit de aanvraag. De browser kan
  // dit dus niet ophogen.
  const systeem = await systeemtekst(admin, tier, modus);

  // Runtime-audit (2026-09-13): geen enkele hardcoded reservepersona meer als
  // kompas.system ontbreekt/leeg is of ai_prompts niet gelezen kon worden -
  // zie systeemtekst() hierboven. In dat geval stopt de aanvraag hier, met
  // uitsluitend een technische foutmelding: nooit een gesprek starten met
  // vervangende, mogelijk sterk afwijkende inhoud.
  if (!systeem) {
    return json({ error: 'De systeemprompt kon niet worden geladen. Neem contact op met de beheerder.' }, 503);
  }

  // RUNTIME IDENTIEK VOOR ALLE ABONNEMENTEN (2026-09-28): de RPC-aanroepen
  // in subsidieregelingKandidaten/funderDeadlineKandidaten/
  // funderAlgemeneKandidaten hieronder blijven zelf ongewijzigd altijd de
  // volledige database ophalen, ongeacht het abonnement van dit lid - zie de
  // toelichting bovenaan dit bestand. Dat waarborgt dat matching/onderzoek
  // voor elke tier identiek en volledig blijft.
  // RC1 stap 2, productbeslissing (2026-10-01) + correctie (2026-10-02):
  // zichtbaarheid van de UITKOMST wordt niet langer alleen aan
  // kompas.system overgelaten - isZichtbaarVoorTier() filtert per record op
  // access_tier, en de gedeelde Free-cap van maximaal 3 volledige matches
  // wordt hieronder EXPLICIET verdeeld (verdeelQuotaOverLanes hierboven), in
  // plaats van impliciet via de toevallige aanroepvolgorde: alleen
  // subsidieregelingen met een daadwerkelijk berekende matchscore
  // (match.totaal != null) krijgen voorrang op basis van hun bestaande
  // ranking; alle overige toegankelijke kandidaten (ongescoorde regelingen,
  // funder-deadlines, overige fondsen) delen de resterende quota
  // round-robin, zodat geen enkele categorie de volledige quota kan opeisen
  // puur door call-order. Voor elke andere tier dan Free heeft dit geen
  // effect (daar bepaalt uitsluitend access_tier wat volledig getoond
  // wordt, zonder aantalslimiet).
  //
  // AI Fundraising Assistant, fase 1: matchSignalen komt wel van de client
  // (het organisatieprofiel/project van dit lid), maar bepaalt uitsluitend de
  // sortering en de uitleg-tekst binnen de volledige lijst hierboven - het
  // bepaalt zelf nooit welke regelingen in het antwoord aan dit lid getoond
  // mogen worden (dat doet uitsluitend isZichtbaarVoorTier()/de Free-cap
  // hieronder).
  // Verbeterpunten Projectplan + Free/Pro/Premium, punt 1 (2026-10-01):
  // matchSignalen is afgeleid van het organisatieprofiel/project van dit lid
  // en telt dus mee als "organisatiecontext" - zelfde gate als orgProfile/
  // project/context hieronder, in plaats van dit (zoals voorheen)
  // ongefilterd van de client over te nemen.
  const matchSignalen = magOrganisatiegeheugen ? leesMatchSignalen(body) : null;

  const VRIJE_TIER_MAX_VOLLEDIG = 3;

  const subsidieKandidaten = await subsidieregelingKandidaten(admin, matchSignalen, tier, isAdmin);

  // Deadline-architectuur, enkelvoudige koppeling, testpunt 9: filters/AI
  // moeten zowel funder-brede als regeling-specifieke deadlines respecteren.
  // Regeling-specifieke deadlines zitten al in subsidieKandidaten hierboven;
  // funder-brede deadlines komen hier als apart systeembericht bij, uit
  // dezelfde RPC-familie (nog steeds altijd de volledige database bij het
  // ophalen, zie hierboven).
  const funderDeadlineKand = await funderDeadlineKandidaten(admin, tier, isAdmin);

  // Architectuurregel "Reviewed bepaalt opname in de centrale dataset": ook
  // beoordeelde fondsen zonder eigen funder-brede deadline moeten door de AI
  // uitgelezen kunnen worden (missie, criteria, classificaties, bandbreedte).
  // Fondsen die hierboven al met hun eigen deadline zijn genoemd, worden hier
  // overgeslagen om dubbele vermelding te voorkomen.
  const funderAlgemeenKand = await funderAlgemeneKandidaten(admin, funderDeadlineKand?.funderIds ?? new Set<string>(), tier, isAdmin);

  // RC1 stap 2, correctie (2026-10-02): expliciete quotaverdeling, nu dat
  // alle drie bronnen bekend zijn. Lane 0 = subsidieregelingen MET een
  // daadwerkelijk berekende matchscore (prioriteit, op basis van hun eigen
  // bestaande ranking - zie subsidieregelingKandidaten hierboven); lane 1 =
  // subsidieregelingen ZONDER bruikbare score; lane 2 = funder-deadlines;
  // lane 3 = overige fondsen. Voor elke tier behalve Free blijft dit zonder
  // effect: aantalVolledig wordt dan simpelweg "alles wat toegankelijk is"
  // (geen cap) - exact zoals vóór deze correctie.
  const aantalToegankelijkRegelingen = subsidieKandidaten.toegankelijk.length;
  const aantalGescoordeRegelingen = subsidieKandidaten.aantalGescoord;
  const aantalOngescoordeRegelingen = aantalToegankelijkRegelingen - aantalGescoordeRegelingen;
  const aantalToegankelijkFunderDeadlines = funderDeadlineKand?.toegankelijk.length ?? 0;
  const aantalToegankelijkOverigeFunders = funderAlgemeenKand?.toegankelijk.length ?? 0;

  let aantalVolledigRegelingen: number;
  let aantalVolledigFunderDeadlines: number;
  let aantalVolledigOverigeFunders: number;

  if (!isAdmin && tier === 'free') {
    const toegekend = verdeelQuotaOverLanes(
      [aantalGescoordeRegelingen, aantalOngescoordeRegelingen, aantalToegankelijkFunderDeadlines, aantalToegankelijkOverigeFunders],
      0,
      VRIJE_TIER_MAX_VOLLEDIG,
    );

    aantalVolledigRegelingen = toegekend[0] + toegekend[1];
    aantalVolledigFunderDeadlines = toegekend[2];
    aantalVolledigOverigeFunders = toegekend[3];
  } else {
    aantalVolledigRegelingen = aantalToegankelijkRegelingen;
    aantalVolledigFunderDeadlines = aantalToegankelijkFunderDeadlines;
    aantalVolledigOverigeFunders = aantalToegankelijkOverigeFunders;
  }

  const subsidieContext = bouwSubsidieregelingTekst(subsidieKandidaten, aantalVolledigRegelingen, matchSignalen);
  const funderDeadlineTekst = bouwFunderDeadlineTekst(funderDeadlineKand, aantalVolledigFunderDeadlines);
  const funderAlgemeenTekst = bouwFunderAlgemeneTekst(funderAlgemeenKand, aantalVolledigOverigeFunders);

  // Fase 6, punt 1: actief leren tijdens gesprekken. Zelfde gate als
  // mode: 'extract'/'website' hierboven (geen Free-toegang), en alleen als
  // de frontend het huidige profiel meestuurt (alleen Pro/Premium doet dat -
  // zie chat.js). orgProfile bevat alleen de scalaire velden uit
  // EXTRACTIE_VELDEN; ontbrekend is wat daarvan nog leeg is.
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

  // Verstevigen Projectplan-runtime, punten 2/3 (2026-09-30): het door de
  // client meegestuurde, vorige Projectdossier (gesaniteerd, zie
  // leesProjectDossier hierboven). Alleen daadwerkelijk als contextbericht
  // meegegeven bij modus 'projectplan' - in elke andere modus is dit dossier
  // niet relevant en wordt het overgeslagen (het blijft dan gewoon staan aan
  // de clientkant, klaar voor de volgende keer dat de modus weer projectplan
  // is).
  const dossierBestaand = leesProjectDossier(body);

  const dossierInstructie =
    modus === 'projectplan' && dossierBestaand
      ? `HUIDIG PROJECTDOSSIER (bijgewerkt tot en met het vorige bericht in dit gesprek, uitsluitend voor jouw eigen interne gebruik - noem dit nooit aan de gebruiker en toon het nooit): ${JSON.stringify(
          dossierBestaand,
        )}. Gebruik dit als vertrekpunt: vul aan of corrigeer op basis van dit gesprek, en vraag niet opnieuw naar wat hier al in staat.`
      : '';

  // Verbeterpunten Projectplan + Free/Pro/Premium, punt 1 (2026-10-01): dit
  // vrije-tekst contextveld (buildContext() in chat.js) bevat het
  // organisatieprofiel, de projectenlijst en het actieve document van dit
  // lid - exact het soort "verborgen organisatiecontext" dat Free nooit mag
  // meekrijgen. Tot nu toe werd dit veld, in tegenstelling tot orgProfile/
  // project/matchSignalen hierboven, ongeacht de tier altijd meegestuurd
  // naar het model - dát was de daadwerkelijke oorzaak van het gevonden
  // risico (zie het bijbehorende rapport). Dezelfde magOrganisatiegeheugen-
  // gate als hierboven, nu ook hier toegepast, en dat ongeacht wat de
  // frontend meestuurt: ook een verouderde client of een debug-aanroep kan
  // dit niet meer omzeilen.
  const contextTekst = magOrganisatiegeheugen && body.context ? String(body.context).slice(0, 24000) : null;

  // STAP 4B, fix 1: hergebruikt uitsluitend al bestaande, hierboven al
  // berekende server-side signalen (matchSignalen, project, contextTekst) -
  // geen nieuw clientveld, dus niets dat het lid zelf kan sturen.
  const heeftProjectContext = Boolean(matchSignalen) || Boolean(project) || Boolean(contextTekst);

  const invoer = [
    { role: 'system', content: systeem },
    { role: 'system', content: runtimeContextBericht(tier, modus) },
    ...(subsidieContext ? [{ role: 'system', content: subsidieContext }] : []),
    ...(funderDeadlineTekst ? [{ role: 'system', content: funderDeadlineTekst }] : []),
    ...(funderAlgemeenTekst ? [{ role: 'system', content: funderAlgemeenTekst }] : []),
    ...(leerInstructie ? [{ role: 'system', content: leerInstructie }] : []),
    ...(dossierInstructie ? [{ role: 'system', content: dossierInstructie }] : []),
    ...(projectInstructie ? [{ role: 'system', content: projectInstructie }] : []),
    ...(contextTekst ? [{ role: 'system', content: contextTekst }] : []),
    ...berichten
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 12000) })),
  ];

  const wilStream = body.stream === true;

  // STAP 3 (websearch): de hoofdchat gaat van Chat Completions naar de
  // Responses API (https://api.openai.com/v1/responses), als enige plek in
  // dit bestand - voorstelUitTekst() hierboven blijft op Chat Completions.
  // 'messages' heet in de Responses API 'input'; de rolnaam 'system' wordt
  // daar 'developer' (zie actuele OpenAI-migratiedocumentatie) - user/
  // assistant blijven ongewijzigd. De inhoud van elk bericht (systeem,
  // runtimecontext, database-/organisatie-/projectcontext, geschiedenis)
  // blijft functioneel exact hetzelfde; alleen de rolnaam en de buitenste
  // veldnaam veranderen.
  const responsesInvoer = invoer.map((m: any) => ({
    role: m.role === 'system' ? 'developer' : m.role,
    content: m.content,
  }));

  // STAP 4B, fix 1: officiële OpenAI-documentatie (developers.openai.com,
  // web_search-gids, sectie Limitations, geraadpleegd 2026-09-13) noemt
  // expliciet: "With tool_choice: 'auto', search is optional. Use
  // tool_choice: 'required' [...] when search must run." 'required' is dus
  // een gedocumenteerde, geen verzonnen waarde. Bewust NIET de object-vorm
  // tool_choice: { type: 'web_search' } gebruikt om een specifieke tool af te
  // dwingen: dat stuit in de praktijk op een gemelde OpenAI-bug rond interne
  // aliassen (bijv. 'web_search' vs. 'web_search_preview'). Omdat hier maar
  // één tool wordt aangeboden, dwingt de generieke waarde 'required' hetzelfde
  // af (een verplichte aanroep van web_search) zonder dat risico.
  const toolChoice = vereistWebsearch(berichten, modus, heeftProjectContext) ? 'required' : 'auto';

  const hoofdchatUitkomst = await fetchOpenAiMetTimeout('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      input: responsesInvoer,
      tools: [{ type: 'web_search' }],
      tool_choice: toolChoice,
      // Geen temperature: gpt-5.5 is een redeneermodel en ondersteunt deze
      // parameter niet (actuele documentatie).
      //
      // STAP 4B, fix 2: de acceptatietest liet een projectplan-antwoord
      // midden in een zin afbreken. Oorzaak: bij redeneermodellen tellen
      // onzichtbare redeneertokens ook mee in max_output_tokens, en 4096 was
      // te krap voor een lang, meerdelig document (kompas.system's eigen
      // projectplan-structuur heeft negen stappen). OpenAI's eigen
      // documentatie over redeneermodellen (developers.openai.com,
      // geraadpleegd 2026-09-13) noemt expliciet: "OpenAI recommends
      // reserving at least 25,000 tokens for reasoning and outputs when you
      // start experimenting with these models." 25000 is dus geen verzonnen
      // of willekeurig extreem getal, maar exact deze aanbevolen startwaarde -
      // ruim boven de lengte van zelfs het langste antwoord uit de
      // acceptatietest (circa 6000 tokens geschat op basis van de ~19.000
      // tekens vóór de afbreking).
      max_output_tokens: 25000,
      reasoning: { effort: 'low' },
      // Bewust geen server-side bewaring bij OpenAI (default is 30 dagen):
      // dit gesprek kan persoonsgegevens en organisatie-/projectgegevens
      // bevatten, en de bestaande Chat Completions-aanroepen in dit bestand
      // kenden zo'n bewaring niet.
      store: false,
      stream: wilStream,
    }),
  }, HOOFDCHAT_TIMEOUT_MS);

  // RC1 stap 7 (7B - BE1): timeout en netwerkfout expliciet onderscheiden
  // van elkaar en van een non-2xx OpenAI-respons (hieronder, ongewijzigd).
  // Dit dekt het opzetten van de aanroep/ontvangen van de response-headers;
  // een timeout die pas tijdens het uitlezen van de stream afgaat, wordt
  // verderop opgevangen door de al bestaande try/catch rond de leeslus (zie
  // toelichting daar) - dezelfde AbortSignal blijft voor de volledige
  // aanroep actief (zie toelichting bij fetchOpenAiMetTimeout hierboven).
  if (!hoofdchatUitkomst.ok) {
    console.error(`[subsidie-kompas] hoofdchat_${hoofdchatUitkomst.soort}`);

    if (hoofdchatUitkomst.soort === 'timeout') {
      return json({ error: 'De assistent deed er te lang over om te antwoorden. Probeer het opnieuw.' }, 504);
    }

    return json({ error: 'De assistent is tijdelijk niet bereikbaar. Probeer het over een moment opnieuw.' }, 502);
  }

  const antwoord = hoofdchatUitkomst.response;

  if (!antwoord.ok) {
    return json({ error: 'De assistent kon geen antwoord geven. Probeer het opnieuw.' }, 502);
  }

  // Antwoord in één keer.
  if (!wilStream) {
    const data = await antwoord.json();

    if (data.status === 'failed') {
      return json({ error: 'De assistent kon geen antwoord geven. Probeer het opnieuw.' }, 502);
    }

    // STAP 4B, fix 2: een 'incomplete' response (bijv. door
    // incomplete_details.reason === 'max_output_tokens', ook na de verhoging
    // hierboven nog denkbaar bij een zeer lang document) mag nooit stilzwijgend
    // als een volledig, afgerond antwoord aan het lid worden getoond - dat zou
    // een document midden in een zin kunnen afbreken zonder dat iemand dat
    // merkt. Kleinste veilige route (geen automatische vervolgaanroep, geen
    // hertoegevoegde tekst: dat risico op dubbele/overlappende tekst wordt
    // hiermee bewust vermeden): de afgekapte tekst wordt niet getoond, het lid
    // krijgt in plaats daarvan een eerlijke, duidelijke melding.
    if (data.status === 'incomplete') {
      return json({
        answer:
          'Dit antwoord kon niet volledig worden gegenereerd binnen de beschikbare ruimte. Vraag om een korter onderdeel (bijvoorbeeld eerst het projectdoel en de doelgroep, of alleen de begroting) zodat ik dit volledig kan uitwerken.',
        sources: [],
        veldVoorstellen: {},
      });
    }

    const { tekst, bronnen } = leesResponsesUitvoer(data);

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

    // Verstevigen Projectplan-runtime, punten 2/3 (2026-09-30): zelfde
    // voorzichtige aanpak als de voorstellenlogica hierboven (geïsoleerd,
    // mag het antwoord nooit blokkeren), maar uitsluitend voor modus
    // 'projectplan' en losgekoppeld van magOrganisatiegeheugen/ontbrekend -
    // dit dossier is ook voor Free (binnen de lopende sessie) en voor een
    // volledig ingevuld organisatieprofiel nog steeds nuttig, want het gaat
    // over het project/gesprek, niet over het organisatieprofiel.
    let projectDossier: Record<string, string> | null = dossierBestaand;

    if (modus === 'projectplan' && bevatMogelijkNieuweInfo) {
      try {
        const { dossier, usage: dossierUsage, mislukt: dossierMislukt } = await projectdossierUitGesprek(
          apiKey,
          MODEL,
          berichten,
          dossierBestaand,
          orgProfile,
          project,
        );

        if (!dossierMislukt) {
          projectDossier = dossier;
          leerTokensIn += dossierUsage?.prompt_tokens ?? 0;
          leerTokensUit += dossierUsage?.completion_tokens ?? 0;
        }
      } catch (_) {
        // dossierupdate mag het antwoord zelf nooit blokkeren
      }
    }

    if (profileId) {
      // STAP 3: de Responses API noemt de tokenvelden anders dan Chat
      // Completions (input_tokens/output_tokens i.p.v. prompt_tokens/
      // completion_tokens) - alleen dit stukje boekhouding is aangepast,
      // model blijft hier bewust MODEL (niet CHAT_MODEL): legVerbruikVast
      // registreert per profiel, niet per los model, en verandert verder niets
      // aan de bestaande verbruiksregistratie/tabelstructuur.
      await legVerbruikVast(admin, {
        profile_id: profileId,
        gesprek_id: body.conversationId ?? null,
        model: CHAT_MODEL,
        tokens_in: (data.usage?.input_tokens ?? 0) + leerTokensIn || null,
        tokens_uit: (data.usage?.output_tokens ?? 0) + leerTokensUit || null,
      });
    }

    return json({ answer: tekst, sources: bronnen, veldVoorstellen, projectDossier });
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
      let bronnen: { title: string; url: string }[] = [];
      let usage: any = null;
      // STAP 5: 'response.completed', 'response.incomplete' en
      // 'response.failed' zijn drie afzonderlijke SSE-event-types in de
      // Responses API (elk met een eigen 'type'-waarde, niet één
      // 'response.completed' met een wisselende status erin - actuele
      // OpenAI-documentatie, geraadpleegd 2026-09-14). De vorige versie van
      // deze streaminglus herkende alleen 'response.completed' en controleerde
      // daar 'response.status === incomplete' binnenin - dat tak-punt werd in
      // de praktijk dus nooit bereikt bij een echt afgekapt antwoord, en zonder
      // deze fix zou een incomplete stream-response stilzwijgend als volledig
      // antwoord zijn getoond zodra streaming daadwerkelijk in gebruik komt.
      // Dit herstelt exact de STAP 4B-garantie ("nooit stilzwijgend afkappen")
      // voor het streaming-pad.
      let afgerond = false;
      let serverFout: string | null = null;

      const stuur = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      // STAP 3: de Responses API stuurt SSE-events met een eigen 'type'-veld
      // in de JSON-payload zelf (bijv. response.output_text.delta,
      // response.completed) i.p.v. Chat Completions' choices[].delta.content.
      // Het onderliggende 'data: {...}'-regelformaat blijft identiek, dus de
      // buffer-/regelsplitsing hierboven/hieronder is ongewijzigd; alleen wat
      // er met elk geparset fragment gebeurt, is aangepast. Het protocol dat
      // de Edge Function zelf naar de frontend stuurt ({delta}/{done,answer,
      // sources}) blijft exact hetzelfde - chat.js/KompasToolPage.jsx zien
      // hier dus niets van.
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

              if (deel.type === 'response.output_text.delta' && typeof deel.delta === 'string') {
                volledig += deel.delta;
                stuur({ delta: deel.delta });
              } else if (deel.type === 'response.incomplete') {
                // STAP 4B, fix 2, nu ook correct in het streaming-pad: een
                // afgekapt antwoord wordt nooit als eindresultaat getoond,
                // ook al zijn er al delta-fragmenten naar de client gestuurd.
                // 'afgerond' blijft bewust false: het niet-streamende pad
                // hierboven doet bij status 'incomplete' ook geen
                // voorstellenlogica en geen verbruiksregistratie (vroegtijdige
                // return, vóór die stappen) - dit houdt hetzelfde gedrag aan.
                volledig =
                  'Dit antwoord kon niet volledig worden gegenereerd binnen de beschikbare ruimte. Vraag om een korter onderdeel (bijvoorbeeld eerst het projectdoel en de doelgroep, of alleen de begroting) zodat ik dit volledig kan uitwerken.';
                bronnen = [];
              } else if (deel.type === 'response.failed') {
                // Voorheen onbehandeld: viel stilzwijgend door tot het einde
                // van de stream, waarna een leeg of onvolledig antwoord alsnog
                // als 'done' werd verzonden. Nu hetzelfde nette gedrag als het
                // niet-streamende pad bij data.status === 'failed'.
                serverFout = 'De assistent kon geen antwoord geven. Probeer het opnieuw.';
              } else if (deel.type === 'response.completed') {
                const gelezen = leesResponsesUitvoer(deel.response);

                // Veiligheidsnet: normaal is volledig al via de delta-events
                // hierboven opgebouwd; alleen als dat om wat voor reden dan
                // ook leeg bleef, gebruiken we de tekst uit het complete
                // response-object.
                if (!volledig && gelezen.tekst) volledig = gelezen.tekst;

                bronnen = gelezen.bronnen;
                afgerond = true;

                if (deel.response?.usage) usage = deel.response.usage;
              }
            } catch (_) {
              // onvolledig fragment; volgende ronde
            }
          }
        }

        if (serverFout) {
          stuur({ error: serverFout });
        } else {
          // Fase 6, punt 1 (vervolg), nu ook in het streaming-pad: dezelfde
          // voorstellenlogica als het niet-streamende pad hierboven, woordelijk
          // ongewijzigd - alleen hier uitgevoerd ná afloop van de stream, zodat
          // de tokens/kosten hiervan hetzelfde blijven meetellen in
          // legVerbruikVast() als voorheen. Wordt bewust overgeslagen als de
          // response niet normaal is afgerond (incomplete/failed/verbinding
          // weggevallen) - exact zoals het niet-streamende pad hierboven ook
          // vóór deze stap al terugkeert bij 'incomplete'.
          let veldVoorstellen: Record<string, string> = {};
          let leerTokensIn = 0;
          let leerTokensUit = 0;
          // Verstevigen Projectplan-runtime, punten 2/3 (2026-09-30): zelfde
          // dossierlogica als het niet-streamende pad hierboven - zie de
          // toelichting daar. dossierBestaand is de gesaniteerde invoerwaarde
          // (buiten deze stream-closure berekend); blijft ongewijzigd
          // teruggegeven wanneer de extractie hieronder niet draait of faalt.
          let projectDossier: Record<string, string> | null = dossierBestaand;

          if (afgerond) {
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

                const { voorstel, usage: leerUsage, mislukt } = await voorstelUitTekst(
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

                  leerTokensIn = leerUsage?.prompt_tokens ?? 0;
                  leerTokensUit = leerUsage?.completion_tokens ?? 0;
                }
              } catch (_) {
                // voorstellen ophalen mag het antwoord zelf nooit blokkeren
              }
            }

            if (modus === 'projectplan' && bevatMogelijkNieuweInfo) {
              try {
                const {
                  dossier,
                  usage: dossierUsage,
                  mislukt: dossierMislukt,
                } = await projectdossierUitGesprek(apiKey, MODEL, berichten, dossierBestaand, orgProfile, project);

                if (!dossierMislukt) {
                  projectDossier = dossier;
                  leerTokensIn += dossierUsage?.prompt_tokens ?? 0;
                  leerTokensUit += dossierUsage?.completion_tokens ?? 0;
                }
              } catch (_) {
                // dossierupdate mag het antwoord zelf nooit blokkeren
              }
            }
          }

          stuur({ done: true, answer: volledig, sources: bronnen, veldVoorstellen, projectDossier });

          // Zelfde voorwaarde als het niet-streamende pad hierboven: dat pad
          // registreert verbruik alleen op de volledige-succespad (nooit bij
          // 'incomplete' of 'failed', die keren daarvoor al terug) - hier dus
          // ook alleen bij 'afgerond' (echte response.completed).
          if (profileId && afgerond) {
            await legVerbruikVast(admin, {
              profile_id: profileId,
              gesprek_id: body.conversationId ?? null,
              model: CHAT_MODEL,
              tokens_in: (usage?.input_tokens ?? 0) + leerTokensIn || null,
              tokens_uit: (usage?.output_tokens ?? 0) + leerTokensUit || null,
            });
          }
        }
      } catch (fout: any) {
        // RC1 stap 7 (7D - C2): technische identificatie loggen (nooit
        // berichtinhoud) - dit is ook het pad waarlangs een timeout die
        // tijdens het uitlezen van de stream afgaat terechtkomt (de
        // AbortSignal van fetchOpenAiMetTimeout() blijft hier actief, zie
        // toelichting daar).
        console.error(`[subsidie-kompas] stream_afgebroken_${fout?.name || 'onbekend'}`);
        stuur({ error: 'De verbinding met de assistent viel weg.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
});
