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
  // Alleen Premium: de online oriëntatie loopt door tot het dekkingsdoel (140% van het financieringsgat) gedekt is. Ook als de database al
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
  // (aandeel van de projectbegroting) en of er een "net niet"-lijst bij hoort. De bovengrens van de som (Pro 120%, Premium 140%) staat in `maxFactorLijst`.
  maxKandidaten: number;
  dekkingsdoelLijst: number;
  maxFactorLijst: number; // bovengrens van de som van de geschatte bijdragen, als aandeel van de projectbegroting
  netNietLijst: boolean;
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
  maxRegelsInMix: number;
  onlineOrientatie: OnlineOrientatieConfig | null;
  onlineAanvullen: OnlineAanvullenConfig | null;
  // Welke ontbrekende velden de verificatiemotor mag aanvullen: 'geen', 'indien-nodig' (alleen voor een betrouwbare beoordeling) of
  // 'alle-ontbrekende' (elk ontbrekend kernveld, nooit een hele site voor één veld).
  aanvullenVelden: 'geen' | 'indien-nodig' | 'alle-ontbrekende';
  // Alleen Pro: na het voorstel melden hoeveel passende fondsen alleen in Premium zichtbaar zijn (uitsluitend een AANTAL, nooit een naam of
  // detail van zo'n fonds). Pas getoond als het aantal groter dan nul is en klopt met wat de engine voor dit project vond.
  premiumHint: boolean;
  // Null = geen AI-beoordeling (Free).
  beoordeling: BeoordelingConfig | null;
  // Intern observatiebudget per gebruiker per maand in euro. UITSLUITEND meten: nooit blokkeren, afremmen, melden of een paywall.
  maandBudgetObservatieEur: number | null;
}

const PRO: TierConfig = {
  tier: 'pro',
  dekkingsplan: true,
  toegestaneAccessTiers: ['free', 'pro'],
  dekkingsdoel: 1.2,
  maxAandeelPerFonds: 0.5,
  minScore: 50,
  maxRegelsInMix: 6,
  onlineOrientatie: { maxKandidaten: 2, maxZoekopdrachten: 2, timeoutMs: 40_000 },
  onlineAanvullen: null,
  aanvullenVelden: 'indien-nodig',
  premiumHint: true,
  beoordeling: { maxKandidaten: 25, dekkingsdoelLijst: 1.0, maxFactorLijst: 1.2, netNietLijst: false },
  maandBudgetObservatieEur: 7,
};

const PREMIUM: TierConfig = {
  tier: 'premium',
  dekkingsplan: true,
  toegestaneAccessTiers: ['free', 'pro', 'premium'],
  dekkingsdoel: 1.4,
  maxAandeelPerFonds: 0.5,
  minScore: 50,
  maxRegelsInMix: 6,
  onlineOrientatie: { maxKandidaten: 6, maxZoekopdrachten: 6, timeoutMs: 60_000, minTonen: 3, totaalMax: 10 },
  onlineAanvullen: { maxKandidaten: 5 },
  aanvullenVelden: 'alle-ontbrekende',
  premiumHint: false,
  beoordeling: { maxKandidaten: 40, dekkingsdoelLijst: 1.4, maxFactorLijst: 1.4, netNietLijst: true },
  maandBudgetObservatieEur: 14,
};

const FREE: TierConfig = {
  tier: 'free',
  dekkingsplan: false,
  toegestaneAccessTiers: ['free'],
  dekkingsdoel: 1,
  maxAandeelPerFonds: 0.5,
  minScore: 50,
  maxRegelsInMix: 0,
  onlineOrientatie: null,
  onlineAanvullen: null,
  aanvullenVelden: 'geen',
  premiumHint: false,
  beoordeling: null,
  maandBudgetObservatieEur: null,
};

const CONFIGS: Readonly<Record<Tier, TierConfig>> = Object.freeze({ free: Object.freeze(FREE), pro: Object.freeze(PRO), premium: Object.freeze(PREMIUM) });

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
