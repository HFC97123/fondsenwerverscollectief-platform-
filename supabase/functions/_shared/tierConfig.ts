// ÉÉN centrale tierconfiguratie voor Subsidie Kompas (server). Alles wat per abonnement verschilt in de fondsenflow staat hier, op één plek:
// welke databaserecords meetellen, het dekkingsdoel, hoe groot een voorstel mag zijn, en (nog niet actief) de online ruimte en het interne
// kostenbudget.
//
// Wat dit bestand NIET is:
//   - Geen beveiliging van gegevens. Wie een record mag zien blijft beslist door de bestaande entitlementlaag (index.ts:
//     bepaalRechten / bepaalNiveau / applyEntitlementsAndSanitize) en door de databasefunctie subsidie_zichtbaar_voor_tier. De functie
//     `tierMagRecord` hieronder is een extra, onafhankelijke controle (defence in depth) op dezelfde regels; zij verruimt nooit iets.
//   - Geen weergave. Namen, prijzen en teksten voor de website komen uit src/data/abonnementen.js.
//   - Geen client-invoer. Een tier komt uitsluitend uit de server (effectieveTier(profiel) of admin), nooit uit een request.
//
// Productregels (Aisya, 15 oktober 2026):
//   Pro:     alleen records met access_tier free of pro. GEEN Premium-records, ook niet als 'alleen naam' (publiek niveau).
//   Premium: alle records (free, pro, premium).
//   Beide tiers gebruiken DEZELFDE matching- en rankinglogica; alleen de pool, het dekkingsdoel en de online ruimte verschillen.

export type Tier = 'free' | 'pro' | 'premium';
export type AccessTier = 'free' | 'pro' | 'premium';

export interface OnlineOrientatieConfig {
  // Startwaarden voor de online oriëntatie (hoeveel kandidaten het model in de eerste ronde mag noemen). Geen marketingbelofte.
  maxKandidaten: number;
  maxZoekopdrachten: number; // alleen af te dwingen als de API een harde grens kent; anders is dit een instructie aan het model
  timeoutMs: number;
  // Alleen Premium: de online oriëntatie loopt door tot het dekkingsdoel (160% van het financieringsgat) gedekt is. Ook als de database al
  // genoeg levert toont het voorstel minstens `minTonen` online kandidaten; zijn er te weinig fondsen, dan mag het aantal boven
  // `maxKandidaten` uitkomen, tot `totaalMax` in totaal (harde bovengrens voor de kosten). Zonder deze velden (Pro): vast kort aantal.
  minTonen?: number;
  totaalMax?: number;
}

export interface OnlineAanvullenConfig {
  // Gericht zoeken op het RESTERENDE gat (na de database en de eerste online ronde). maxKandidaten is een CAP per ronde, geen doel:
  // er wordt gestopt zodra de indicatieve bedragen het resterende gat dekken, en nooit boven `totaalMax` van de oriëntatie.
  maxKandidaten: number;
}

export interface BeoordelingConfig {
  // AI-beoordeling met bewijs (fondsBeoordeling.ts): hoeveel van de best gerangschikte kandidaten de AI leest, de buffer waarop de korte lijst stopt
  // (aandeel van de projectbegroting) en of er een "net niet"-lijst bij hoort. De bovengrens van de som (Pro 120%, Premium 160%, van de financieringsbehoefte) staat in `maxFactorLijst`.
  maxKandidaten: number;
  dekkingsdoelLijst: number;
  maxFactorLijst: number; // bovengrens van de som van de geschatte bijdragen, als aandeel van de projectbegroting
  netNietLijst: boolean;
}

// Aanvraag-assistent (aanvraag beoordelen en projectplan genereren). Alles wat per abonnement verschilt staat hier; de server beslist, de client toont alleen.
// Deze grenzen zijn HARD (anders dan het observatiebudget hierboven): is de maand op, dan weigert de server de aanroep met een duidelijke melding.
// Aantallen zijn startwaarden (Aisya, 19 oktober 2026) en worden na de eerste meting met de gebruiksmeter bijgesteld.
export interface AanvraagAssistentConfig {
  // Mag dit abonnement per fonds werken (criteria ophalen, een versie voor een fonds schrijven, de aanvraag laten beoordelen)? Pro: nee, alleen het projectplan
  // schrijven (Aisya, 28 oktober 2026). Premium: ja. De server weigert fondsacties zonder dit recht; de client toont dan alleen een verwijzing naar Premium.
  fondsbeoordeling: boolean;
  beoordelingenPerMaand: number;
  // Het algemene projectplan wordt één keer per project door de AI geschreven. Dit is het aantal VERSCHILLENDE projecten per rollend jaar waarvoor dat mag.
  projectplannen: number;
  // Eisenlijsten ophalen (website lezen en eisen halen) kost ook een modelaanroep; een ruime maandgrens voorkomt dat dit onbegrensd wordt herhaald.
  eisenOphalenPerMaand: number;
  // Bovengrenzen per aanroep, zodat de kosten van één beoordeling begrensd zijn.
  maxEisen: number;
  maxAanvraagTekens: number;
  maxRichtlijnTekens: number;
  // Uitbreidingen die nog NIET gebouwd zijn: blijven uit tot de onderdelen bestaan. De velden staan er al, zodat het verschil tussen Pro en Premium
  // later alleen een instelling is.
  rijkeEditor: boolean;
  aiPaneel: boolean;
  paneelActiesPerMaand: number;
  dekkingsoverzicht: boolean;
  commissieblik: boolean;
}

export interface TierConfig {
  tier: Tier;
  // Mag deze tier de dekkingsplan-flow gebruiken (het dashboard van Pro/Premium)? Free is een chatbot.
  dekkingsplan: boolean;
  // Welke access_tier-waarden van een databaserecord tellen mee in een dekkingsplan.
  toegestaneAccessTiers: readonly AccessTier[];
  // Doel voor de som van de REALISTISCHE bedragen, als factor van het resterende gat (1.10 = 110%). Een afwijzing is normaal.
  dekkingsdoel: number;
  // Hoeveel van het totale gat één financier realistisch kan dragen (zie dekkingsmix.ts). 0.5 = maximaal de helft.
  maxAandeelPerFonds: number;
  // Ondergrens voor de matchscore van een kandidaat in de mix. Startwaarde; kalibreren zodra de mix aan de engine hangt.
  minScore: number;
  // Maximaal aantal regels in de mix (excl. de ene reserve). Moet < MAX_REGELS van het voorstelcontract blijven.
  // Pro: 6 (kort en overzichtelijk). Premium: 9, zodat de begroting van een groot project sluitend gemaakt kan worden.
  maxRegelsInMix: number;
  // Aantal alternatieve financiers (reserves) naast de mix: tellen niet mee in de dekking, voor als een aanvraag wordt afgewezen. mix + alternatieven
  // moeten samen binnen MAX_REGELS van het voorstelcontract blijven.
  alternatieven: number;
  // Alleen Premium: de mix wordt gevuld met de financiers die het beste passen EN de hoogste bijdrage geven, zodat de begroting met zo weinig
  // mogelijk regels sluit en de overige geschikte financiers afvallen. Volgorde: scoreband van 10 punten (aflopend), daarna hoogste
  // bijdrage, dan naam. Pro blijft puur op score (zoals voorheen).
  rangschikOpBijdrage: boolean;
  onlineOrientatie: OnlineOrientatieConfig | null;
  onlineAanvullen: OnlineAanvullenConfig | null;
  // Welke ontbrekende velden de verificatiemotor mag aanvullen: 'geen', 'indien-nodig' (alleen voor een betrouwbare beoordeling) of
  // 'alle-ontbrekende' (elk ontbrekend kernveld, nooit een hele site voor één veld).
  aanvullenVelden: 'geen' | 'indien-nodig' | 'alle-ontbrekende';
  // Alleen Pro: na het voorstel melden hoeveel passende fondsen alleen in Premium zichtbaar zijn (uitsluitend een AANTAL, nooit een naam of
  // detail van zo'n fonds). Pas getoond als het aantal groter dan nul is en klopt met wat de engine voor dit project vond.
  premiumHint: boolean;
  // Alleen Premium: de mix bevat altijd minstens één van de algemene Premium-fondsen (zie algemeenPremium.ts), mits de engine er een passend vindt.
  algemeenPremium: boolean;
  // Null = geen AI-beoordeling (Free).
  beoordeling: BeoordelingConfig | null;
  // Intern observatiebudget per gebruiker per maand in euro. UITSLUITEND meten: nooit blokkeren, afremmen, melden of een paywall.
  maandBudgetObservatieEur: number | null;
  // Null = geen aanvraag-assistent (Free).
  aanvraagAssistent: AanvraagAssistentConfig | null;
}

const PRO: TierConfig = {
  tier: 'pro',
  dekkingsplan: true,
  toegestaneAccessTiers: ['free', 'pro'],
  dekkingsdoel: 1.2,
  maxAandeelPerFonds: 1 / 3,
  minScore: 50,
  maxRegelsInMix: 6,
  alternatieven: 3,
  rangschikOpBijdrage: false,
  onlineOrientatie: { maxKandidaten: 2, maxZoekopdrachten: 2, timeoutMs: 40_000 },
  onlineAanvullen: null,
  aanvullenVelden: 'indien-nodig',
  premiumHint: true,
  algemeenPremium: false,
  beoordeling: { maxKandidaten: 25, dekkingsdoelLijst: 1.2, maxFactorLijst: 1.2, netNietLijst: false },
  maandBudgetObservatieEur: 7,
  aanvraagAssistent: {
    fondsbeoordeling: false,
    beoordelingenPerMaand: 0,
    projectplannen: 1,
    eisenOphalenPerMaand: 0,
    maxEisen: 40,
    maxAanvraagTekens: 60_000,
    maxRichtlijnTekens: 40_000,
    rijkeEditor: false,
    aiPaneel: false,
    paneelActiesPerMaand: 0,
    dekkingsoverzicht: false,
    commissieblik: false,
  },
};

const PREMIUM: TierConfig = {
  tier: 'premium',
  dekkingsplan: true,
  toegestaneAccessTiers: ['free', 'pro', 'premium'],
  dekkingsdoel: 1.6,
  maxAandeelPerFonds: 1 / 3,
  minScore: 50,
  maxRegelsInMix: 9,
  alternatieven: 3,
  rangschikOpBijdrage: true,
  onlineOrientatie: { maxKandidaten: 6, maxZoekopdrachten: 6, timeoutMs: 60_000, minTonen: 3, totaalMax: 10 },
  onlineAanvullen: { maxKandidaten: 5 },
  aanvullenVelden: 'alle-ontbrekende',
  premiumHint: false,
  algemeenPremium: true,
  beoordeling: { maxKandidaten: 40, dekkingsdoelLijst: 1.6, maxFactorLijst: 1.6, netNietLijst: true },
  maandBudgetObservatieEur: 14,
  // Beoordelingen per maand = per project x aantal projecten: 10 per project, 3 projecten met een plan, dus 30 (Aisya, 21 oktober 2026). Elke aanvraag per fonds
  // krijgt de actuele begroting en het actuele dekkingsplan mee. Voor nu verder hetzelfde als Pro. De uitbreidingen (rijke editor, AI-paneel, dekkingsoverzicht, commissieblik) staan
  // uit tot ze gebouwd zijn.
  aanvraagAssistent: {
    fondsbeoordeling: true,
    beoordelingenPerMaand: 30,
    projectplannen: 3,
    eisenOphalenPerMaand: 40,
    maxEisen: 40,
    maxAanvraagTekens: 60_000,
    maxRichtlijnTekens: 40_000,
    rijkeEditor: false,
    aiPaneel: false,
    paneelActiesPerMaand: 0,
    dekkingsoverzicht: false,
    commissieblik: false,
  },
};

const FREE: TierConfig = {
  tier: 'free',
  dekkingsplan: false,
  toegestaneAccessTiers: ['free'],
  dekkingsdoel: 1,
  maxAandeelPerFonds: 0.5,
  minScore: 50,
  maxRegelsInMix: 0,
  alternatieven: 0,
  rangschikOpBijdrage: false,
  onlineOrientatie: null,
  onlineAanvullen: null,
  aanvullenVelden: 'geen',
  premiumHint: false,
  algemeenPremium: false,
  beoordeling: null,
  maandBudgetObservatieEur: null,
  aanvraagAssistent: null,
};

// Diep bevroren: ook de ingebedde blokken (beoordeling, online, aanvraagassistent) zijn tijdens runtime niet te wijzigen.
function diepBevroren<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o as Record<string, unknown>)) diepBevroren(v);
    Object.freeze(o);
  }

  return o;
}

const CONFIGS: Readonly<Record<Tier, TierConfig>> = Object.freeze({ free: diepBevroren(FREE), pro: diepBevroren(PRO), premium: diepBevroren(PREMIUM) });

// Onbekende of ontbrekende tierwaarden vallen op Free (fail closed). Admin krijgt de Premium-regels.
export function tierConfigVoor(tier: unknown, isAdmin = false): TierConfig {
  if (isAdmin === true) return CONFIGS.premium;

  return tier === 'pro' ? CONFIGS.pro : tier === 'premium' ? CONFIGS.premium : CONFIGS.free;
}

// Extra, onafhankelijke controle: mag een record met deze access_tier meetellen in een dekkingsplan van deze tier?
// Onbekende waarden: nee. Spiegelt subsidie_zichtbaar_voor_tier (free = iedereen, pro = Pro en Premium, premium = alleen Premium).
export function tierMagRecord(config: TierConfig, accessTier: unknown): boolean {
  return (accessTier === 'free' || accessTier === 'pro' || accessTier === 'premium') && config.toegestaneAccessTiers.includes(accessTier);
}

export function alleTierConfigs(): readonly TierConfig[] {
  return [CONFIGS.free, CONFIGS.pro, CONFIGS.premium];
}
