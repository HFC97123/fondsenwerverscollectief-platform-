// Interne gebruiks- en kostenmeter van Subsidie Kompas. UITSLUITEND METEN.
//
// Geen gebruikerslimieten, geen blokkering, geen afremming, geen melding aan het lid en geen paywall op basis hiervan. Het doel is
// na 1 à 2 maanden te kunnen zien wat een Pro-gebruiker, een Premium-gebruiker en een power user werkelijk kosten, zodat daarna een
// eerlijk fair-use-beleid gekozen kan worden. De observatiebudgetten (Pro € 7, Premium € 14 per gebruiker per maand) staan in
// tierConfig.ts en zijn alleen een vergelijkingsgetal in rapportages.
//
// PRIVACY: er wordt nooit inhoud vastgelegd. Geen prompts, geen gesprekken, geen projectdocumenten, geen zoekopdrachten, geen URL's.
// Alleen tellers, duur, model en een geschatte prijs. `bouwGebruikRij` laat uitsluitend de hieronder genoemde velden door.
//
// Mislukt het vastleggen (bijvoorbeeld omdat de tabel nog niet bestaat), dan merkt het lid daar niets van: nooit een fout teruggeven,
// nooit een antwoord vertragen of blokkeren. De functies hieronder gooien niet.

export const ACTIE_TYPES = [
  'chat',
  'fonds_scan_database', // criteria afleiden en databasematching rond een fondsvraag
  'fonds_scan_web', // online oriëntatie / verkenner
  'fonds_beoordeling', // AI-beoordeling met bewijs van de beste kandidaten (Pro en Premium)
  'proposal_preview',
  'source_verification',
  'document_generation',
  'project_advice',
  'document_analyse',
  'website_analyse',
  'aanvraag_eisen', // aanvraag-assistent: eisenlijst uit website en tekst van het lid
  'aanvraag_beoordeling', // aanvraag-assistent: aanvraag beoordelen tegen de eisen
  'aanvraag_plan', // aanvraag-assistent: projectplan schrijven uit projectgegevens en documentatie
  'aanvraag_begroting', // aanvraag-assistent: het chatantwoord over de begroting omzetten in begrotingsregels
  'aanvraag_begroting_upload', // aanvraag-assistent: een geüpload begrotingsbestand omzetten in begrotingsregels
  'aanvraag_vragen', // aanvraag-assistent: het formulier van een fonds omzetten in vragen en stukken
  'aanvraag_antwoorden', // aanvraag-assistent: antwoorden schrijven op de vragen van het formulier
  'trefwoorden_koppelen', // projectgegevens: disciplines, doelgroepen en werkgebieden voorstellen uit de omschrijving en eigen woorden
] as const;

export type ActieType = (typeof ACTIE_TYPES)[number];
export type GebruikTier = 'free' | 'pro' | 'premium' | 'admin';

const TIERS: readonly GebruikTier[] = ['free', 'pro', 'premium', 'admin'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const GEBRUIK_TABEL = 'kompas_gebruik_log';
// Een database die niet antwoordt mag het antwoord aan het lid nooit ophouden: na deze tijd geven we het vastleggen op (de meting is dan mislukt).
export const GEBRUIK_MAX_WACHT_MS = 1500;

// ---------------------------------------------------------------------------------------------------------------------------
// Prijzen: ÉÉN plek. Bij een prijswijziging van de leverancier alleen hier aanpassen.
// Bron: OpenAI API-prijzen zoals gepubliceerd (per 1 miljoen tokens, Standard-tier) en de webzoektool; gecontroleerd op 15-10-2026.
// De webzoektool kost per aanroep; de gelezen zoekinhoud wordt als invoertokens tegen modelprijs gerekend en zit al in input_tokens.
export const PRIJZEN = {
  gecontroleerdOp: '2026-10-15',
  // Ruwe omrekening dollar -> euro voor de schatting. Periodiek bijstellen; een schatting is geen boekhouding.
  usdNaarEur: 0.92,
  modellen: {
    'gpt-5.5': { inUsd: 5, gecachedInUsd: 0.5, uitUsd: 30 },
    'gpt-4o': { inUsd: 2.5, gecachedInUsd: 1.25, uitUsd: 10 },
  } as Record<string, { inUsd: number; gecachedInUsd: number; uitUsd: number }>,
  webZoekenUsdPer1000Aanroepen: 10,
} as const;

function prijsVoorModel(model: unknown) {
  const m = typeof model === 'string' ? model.trim().toLowerCase() : '';
  // Langste sleutel eerst, zodat "gpt-5.5-2026-xx" op "gpt-5.5" valt en niet op een kortere sleutel.
  const sleutel = Object.keys(PRIJZEN.modellen)
    .sort((a, b) => b.length - a.length)
    .find((k) => m === k || m.startsWith(`${k}-`));

  return sleutel ? PRIJZEN.modellen[sleutel] : null;
}

const heel = (x: unknown, max = 2_000_000_000): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.min(Math.round(x), max) : 0);

// Geschatte kosten in euro, op 4 decimalen. null = het model is niet in de prijslijst (dan liever geen getal dan een verzonnen getal).
export function schatKosten(inv: { model?: unknown; inputTokens?: unknown; outputTokens?: unknown; gecachedeInputTokens?: unknown; webZoekAanroepen?: unknown }): number | null {
  const web = heel(inv.webZoekAanroepen) * (PRIJZEN.webZoekenUsdPer1000Aanroepen / 1000);
  const input = heel(inv.inputTokens);
  const output = heel(inv.outputTokens);
  const prijs = prijsVoorModel(inv.model);

  if (!prijs) return input === 0 && output === 0 ? Math.round(web * PRIJZEN.usdNaarEur * 10_000) / 10_000 : null;

  const gecacht = Math.min(heel(inv.gecachedeInputTokens), input);
  const usd = ((input - gecacht) * prijs.inUsd + gecacht * prijs.gecachedInUsd + output * prijs.uitUsd) / 1_000_000 + web;

  return Math.round(usd * PRIJZEN.usdNaarEur * 10_000) / 10_000;
}

// Leest het usage-object van zowel Chat Completions (prompt_tokens/completion_tokens) als de Responses API (input_tokens/output_tokens).
export function tokensUitUsage(usage: unknown): { input: number; output: number; gecachte: number } {
  const u = (typeof usage === 'object' && usage !== null ? usage : {}) as Record<string, any>;

  return {
    input: heel(u.input_tokens ?? u.prompt_tokens),
    output: heel(u.output_tokens ?? u.completion_tokens),
    gecachte: heel(u.input_tokens_details?.cached_tokens ?? u.prompt_tokens_details?.cached_tokens),
  };
}

export interface GebruikInvoer {
  userId: unknown;
  tier: unknown;
  actie: unknown;
  projectId?: unknown;
  model?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  gecachedeInputTokens?: unknown;
  webZoekAanroepen?: unknown;
  externePaginas?: unknown;
  verificatiePaginas?: unknown;
  cacheHits?: unknown;
  duurMs?: unknown;
  succes?: unknown;
  kostenEur?: unknown; // alleen als de aanroeper het exacter weet; anders wordt het geschat
}

export interface GebruikRij {
  user_id: string;
  tier: GebruikTier;
  action_type: ActieType;
  project_id: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  web_search_calls: number;
  external_page_fetches: number;
  verification_pages: number;
  cache_hits: number;
  duration_ms: number;
  estimated_cost_eur: number | null;
  success: boolean;
}

// Maakt van een invoer precies één toegestane tabelrij, of null als gebruiker, tier of actie ongeldig zijn.
// Alleen deze velden kunnen ooit in de tabel komen: een extra veld in de invoer (bijvoorbeeld een prompt) valt hier gewoon af.
export function bouwGebruikRij(inv: GebruikInvoer): GebruikRij | null {
  const userId = typeof inv?.userId === 'string' && UUID.test(inv.userId) ? inv.userId.toLowerCase() : null;
  const tier = TIERS.find((t) => t === inv?.tier);
  const actie = ACTIE_TYPES.find((a) => a === inv?.actie);

  if (!userId || !tier || !actie) return null;

  const model = typeof inv.model === 'string' && inv.model.trim() ? inv.model.trim().slice(0, 60) : null;
  const webZoek = heel(inv.webZoekAanroepen, 10_000);
  const kostenGegeven = typeof inv.kostenEur === 'number' && Number.isFinite(inv.kostenEur) && inv.kostenEur >= 0 ? Math.round(inv.kostenEur * 10_000) / 10_000 : null;

  return {
    user_id: userId,
    tier,
    action_type: actie,
    project_id: typeof inv.projectId === 'string' && UUID.test(inv.projectId) ? inv.projectId.toLowerCase() : null,
    model,
    input_tokens: heel(inv.inputTokens),
    output_tokens: heel(inv.outputTokens),
    web_search_calls: webZoek,
    external_page_fetches: heel(inv.externePaginas, 10_000),
    verification_pages: heel(inv.verificatiePaginas, 10_000),
    cache_hits: heel(inv.cacheHits, 10_000),
    duration_ms: heel(inv.duurMs, 3_600_000),
    estimated_cost_eur:
      kostenGegeven ?? schatKosten({ model, inputTokens: inv.inputTokens, outputTokens: inv.outputTokens, gecachedeInputTokens: inv.gecachedeInputTokens, webZoekAanroepen: webZoek }),
    success: inv.succes !== false,
  };
}

// Schrijft één rij. `admin` is de service_role-client. Gooit nooit; geeft aan of het gelukt is (alleen voor tests en logregels).
export async function legGebruik(admin: any, inv: GebruikInvoer): Promise<boolean> {
  try {
    const rij = bouwGebruikRij(inv);

    if (!rij || !admin || typeof admin.from !== 'function') return false;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const verlopen = new Promise<{ error: { code: string } }>((klaar) => {
      timer = setTimeout(() => klaar({ error: { code: 'timeout' } }), GEBRUIK_MAX_WACHT_MS);
    });
    const uitkomst = await Promise.race([Promise.resolve(admin.from(GEBRUIK_TABEL).insert(rij)), verlopen]);

    clearTimeout(timer);

    const error = (uitkomst as any)?.error;

    if (error) {
      console.error('[subsidie-kompas] gebruik_vastleggen_mislukt'); // vaste tekst: geen inhoud, geen foutdetails met gegevens

      return false;
    }

    return true;
  } catch (_) {
    console.error('[subsidie-kompas] gebruik_vastleggen_fout');

    return false;
  }
}
