// Server-owned voorstelmetadata (versie 2) voor Subsidie Kompas.
//
// STATUS: voorbereiding (Fase A). Nog door niets geïmporteerd: de Edge Function `subsidie-kompas` is ongewijzigd en dit bestand
// wordt pas in een latere fase gekoppeld. Het bevat geen netwerkcode en geen geheimen: alleen zuivere functies.
//
// Wie mag dit gebruiken: UITSLUITEND de server (Edge Function met service_role). De client bouwt nooit metadata: de database weigert
// elke schrijfpoging van `authenticated` op de kolom `funding.voorstel`, en de schemacontrole `kompas_voorstel_geldig()` weigert
// onbekende sleutels en onsamenhangende statussen. `controleerMetadata` hieronder is een spiegel van die SQL-functie; de pariteit
// wordt getest met één gedeeld fixturebestand (supabase/tests/voorstel-metadata/fixtures.json) aan beide kanten.
//
// "geverifieerd" is hier een uitkomst, geen invoer: `bepaalVerificatieStatus` leidt de samenvattende status af uit de status per
// veld. Er is geen parameter waarmee een aanroeper de samenvattende status kan opgeven.

export const METADATA_VERSIE = 2;

export const HERKOMST = ['regeling', 'fonds', 'online'] as const;
export const VERIFICATIE_STATUS = ['geverifieerd', 'gedeeltelijk', 'onzeker', 'conflict', 'niet_gecontroleerd'] as const;
export const VELD_STATUS = ['confirmed', 'uncertain', 'conflict', 'not_checked'] as const;
export const VELDEN = ['fondsnaam', 'deadline', 'bedrag_min', 'bedrag_max', 'voorwaarden', 'cofinanciering', 'doelgroep', 'aanvragertype', 'geografie'] as const;

export type Herkomst = (typeof HERKOMST)[number];
export type VerificatieStatus = (typeof VERIFICATIE_STATUS)[number];
export type VeldStatus = (typeof VELD_STATUS)[number];
export type VeldNaam = (typeof VELDEN)[number];

export interface VeldBewijs {
  status: VeldStatus;
  waarde?: string; // de ONLINE waarde (max 200)
  fragment?: string; // citaat uit de pagina (max 300)
  fragment_sha256?: string; // vingerafdruk van het citaat
  db_waarde?: string; // alleen bij conflict: momentopname van de databasewaarde op het controlemoment (auditbewijs, geen tweede waarheid)
}

export interface Verificatie {
  status: VerificatieStatus;
  gecontroleerd_op?: string;
  bron_url?: string;
  eind_url?: string;
  pagina_sha256?: string;
  velden?: Partial<Record<VeldNaam, VeldBewijs>>;
}

export interface VoorstelMetadata {
  versie: 2;
  server_generated: true;
  herkomst: Herkomst;
  voorgesteld_op: string;
  voorgesteld_bedrag?: number | null;
  verificatie?: Verificatie;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const TIJDSTIP = /^\d{4}-\d{2}-\d{2}(T[0-9:.]+(Z|[+-]\d{2}:\d{2}))?$/;
const URL_HTTPS = /^https:\/\/\S{4,}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_BYTES = 8000;

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function bytes(x: unknown): number {
  return new TextEncoder().encode(JSON.stringify(x)).length;
}

// Spiegel van public.kompas_voorstel_geldig(jsonb). Geeft een reden terug bij afkeuring (alleen voor tests en logging).
export function controleerMetadata(v: unknown): { geldig: boolean; reden?: string } {
  const nee = (reden: string) => ({ geldig: false, reden });

  if (v === null || v === undefined) return { geldig: true };
  if (!isObject(v)) return nee('geen-object');
  if (bytes(v) > MAX_BYTES) return nee('te-groot');

  for (const k of Object.keys(v)) {
    if (!['versie', 'server_generated', 'herkomst', 'voorgesteld_op', 'voorgesteld_bedrag', 'verificatie'].includes(k)) return nee('onbekende-sleutel:' + k);
  }

  if (v.versie !== 2 || v.server_generated !== true) return nee('geen-server-versie-2');
  if (!(HERKOMST as readonly string[]).includes(String(v.herkomst ?? ''))) return nee('herkomst');
  if (typeof v.voorgesteld_op !== 'string' || !DATUM.test(v.voorgesteld_op)) return nee('voorgesteld_op');

  if ('voorgesteld_bedrag' in v && v.voorgesteld_bedrag !== null) {
    const b = v.voorgesteld_bedrag;
    if (typeof b !== 'number' || !Number.isFinite(b) || b < 0 || b >= 1e12) return nee('voorgesteld_bedrag');
  }

  const ver = v.verificatie;

  if (ver === undefined || ver === null) return v.herkomst === 'online' ? nee('online-zonder-verificatie') : { geldig: true };
  if (!isObject(ver)) return nee('verificatie-geen-object');

  for (const k of Object.keys(ver)) {
    if (!['status', 'gecontroleerd_op', 'bron_url', 'eind_url', 'pagina_sha256', 'velden'].includes(k)) return nee('onbekende-verificatiesleutel:' + k);
  }

  const st = ver.status;
  if (typeof st !== 'string' || !(VERIFICATIE_STATUS as readonly string[]).includes(st)) return nee('verificatiestatus');

  if ('gecontroleerd_op' in ver && (typeof ver.gecontroleerd_op !== 'string' || !TIJDSTIP.test(ver.gecontroleerd_op))) return nee('gecontroleerd_op');
  for (const k of ['bron_url', 'eind_url'] as const) {
    if (k in ver && (typeof ver[k] !== 'string' || !URL_HTTPS.test(ver[k] as string) || (ver[k] as string).length > 2000)) return nee(k);
  }
  if ('pagina_sha256' in ver && (typeof ver.pagina_sha256 !== 'string' || !SHA256.test(ver.pagina_sha256))) return nee('pagina_sha256');

  const vel = ver.velden === undefined ? {} : ver.velden;
  if (!isObject(vel)) return nee('velden');

  let nConflict = 0;
  let nOnzeker = 0;
  let nBevestigd = 0;

  for (const [naam, veldRaw] of Object.entries(vel)) {
    if (!(VELDEN as readonly string[]).includes(naam)) return nee('onbekend-veld:' + naam);
    if (!isObject(veldRaw)) return nee('veld-geen-object');

    for (const k of Object.keys(veldRaw)) {
      if (!['status', 'waarde', 'fragment', 'fragment_sha256', 'db_waarde'].includes(k)) return nee('onbekende-veldsleutel:' + k);
    }

    const vs = veldRaw.status;
    if (typeof vs !== 'string' || !(VELD_STATUS as readonly string[]).includes(vs)) return nee('veldstatus');

    if ('waarde' in veldRaw && (typeof veldRaw.waarde !== 'string' || [...veldRaw.waarde].length > 200)) return nee('waarde');
    if ('fragment' in veldRaw && (typeof veldRaw.fragment !== 'string' || [...veldRaw.fragment].length > 300)) return nee('fragment');
    if ('fragment_sha256' in veldRaw && (typeof veldRaw.fragment_sha256 !== 'string' || !SHA256.test(veldRaw.fragment_sha256))) return nee('fragment_sha256');
    if ('db_waarde' in veldRaw && (typeof veldRaw.db_waarde !== 'string' || [...veldRaw.db_waarde].length > 200)) return nee('db_waarde');

    if (vs === 'conflict' && (!('db_waarde' in veldRaw) || !('waarde' in veldRaw) || (!('fragment' in veldRaw) && !('fragment_sha256' in veldRaw)))) return nee('conflict-zonder-bewijs');
    if (vs !== 'conflict' && 'db_waarde' in veldRaw) return nee('db_waarde-zonder-conflict');

    if (vs === 'conflict') nConflict++;
    if (vs === 'uncertain') nOnzeker++;
    if (vs === 'confirmed') nBevestigd++;
  }

  const velden = vel as Record<string, Record<string, unknown>>;

  if (nConflict > 0 && st !== 'conflict') return nee('conflict-veld-maar-andere-status');
  if (st === 'conflict' && nConflict === 0) return nee('conflict-status-zonder-veld');

  if (['geverifieerd', 'gedeeltelijk', 'conflict'].includes(st) && (!('bron_url' in ver) || !('gecontroleerd_op' in ver) || !('pagina_sha256' in ver))) return nee('bewijs-ontbreekt');
  if (st === 'niet_gecontroleerd' && nBevestigd > 0) return nee('niet-gecontroleerd-met-bevestigd-veld');
  if (st === 'gedeeltelijk' && velden.fondsnaam?.status !== 'confirmed') return nee('gedeeltelijk-zonder-fondsnaam');

  if (st === 'geverifieerd') {
    const fragment = velden.deadline?.fragment;
    if (velden.fondsnaam?.status !== 'confirmed' || velden.deadline?.status !== 'confirmed' || typeof fragment !== 'string' || fragment.trim() === '' || nOnzeker > 0) {
      return nee('geverifieerd-voorwaarden');
    }
  }

  if (v.herkomst === 'online' && st !== 'niet_gecontroleerd' && !('bron_url' in ver)) return nee('online-zonder-bron');

  return { geldig: true };
}

// Leidt de samenvattende status af uit de status per veld. De server geeft dus nooit zelf "geverifieerd" op: het is de uitkomst van de
// regels hieronder, en alleen mogelijk wanneer de pagina is opgehaald (bewijs aanwezig), de fondsnaam in de pagina staat en de
// deadline met een letterlijk citaat is bevestigd.
export function bepaalVerificatieStatus(
  velden: Partial<Record<VeldNaam, VeldBewijs>> | undefined,
  bewijs: { bron_url?: string; gecontroleerd_op?: string; pagina_sha256?: string },
): VerificatieStatus {
  const lijst = Object.values(velden ?? {});

  if (lijst.some((v) => v?.status === 'conflict')) return 'conflict';

  const heeftBewijs = Boolean(bewijs.bron_url && bewijs.gecontroleerd_op && bewijs.pagina_sha256);
  const bevestigd = lijst.filter((v) => v?.status === 'confirmed').length;

  if (!heeftBewijs || bevestigd === 0) return lijst.some((v) => v?.status === 'uncertain') ? 'onzeker' : 'niet_gecontroleerd';

  const naam = velden?.fondsnaam?.status === 'confirmed';
  const dl = velden?.deadline;
  const deadlineBewezen = dl?.status === 'confirmed' && typeof dl.fragment === 'string' && dl.fragment.trim() !== '';
  const nOnzeker = lijst.filter((v) => v?.status === 'uncertain').length;

  if (naam && deadlineBewezen && nOnzeker === 0) return 'geverifieerd';
  if (naam) return 'gedeeltelijk';

  return 'onzeker';
}

export interface MetadataInvoer {
  herkomst: Herkomst;
  vandaag: string; // YYYY-MM-DD, door de server bepaald
  voorgesteldBedrag?: number | null;
  verificatie?: {
    gecontroleerd_op?: string;
    bron_url?: string;
    eind_url?: string;
    pagina_sha256?: string;
    velden?: Partial<Record<VeldNaam, VeldBewijs>>;
  } | null;
}

// Bouwt de metadata van een voorgestelde regel. Geeft null terug wanneer het resultaat het schema niet haalt (de server schrijft dan
// de regel zonder verificatieclaim of laat de regel weg; nooit een gok). De samenvattende status wordt hier afgeleid.
export function bouwMetadata(inv: MetadataInvoer): VoorstelMetadata | null {
  const meta: VoorstelMetadata = {
    versie: 2,
    server_generated: true,
    herkomst: inv.herkomst,
    voorgesteld_op: inv.vandaag,
    voorgesteld_bedrag: inv.voorgesteldBedrag ?? null,
  };

  if (inv.verificatie) {
    // Alleen de bewijsvelden worden overgenomen, één voor één. Een eventueel meegegeven `status` (of andere sleutel) wordt genegeerd:
    // de samenvattende status komt uitsluitend uit bepaalVerificatieStatus().
    const { velden, gecontroleerd_op, bron_url, eind_url, pagina_sha256 } = inv.verificatie;
    const bewijs = {
      ...(gecontroleerd_op !== undefined ? { gecontroleerd_op } : {}),
      ...(bron_url !== undefined ? { bron_url } : {}),
      ...(eind_url !== undefined ? { eind_url } : {}),
      ...(pagina_sha256 !== undefined ? { pagina_sha256 } : {}),
    };
    meta.verificatie = { status: bepaalVerificatieStatus(velden, bewijs), ...bewijs, ...(velden ? { velden } : {}) };
  } else if (inv.herkomst === 'online') {
    // Online zonder enig bewijs: expliciet niet gecontroleerd (de server kon of mocht de bron niet ophalen).
    meta.verificatie = { status: 'niet_gecontroleerd' };
  }

  return controleerMetadata(meta).geldig ? meta : null;
}
