// Voorstelbinding en replay-bescherming voor het opslaan van een voorstel (ONTWERP + zuivere functies; Fase A).
//
// STATUS: voorbereiding. Niets importeert dit bestand, er is geen HMAC-geheim aangemaakt en er is geen route die het gebruikt. Het wordt
// pas in Fase C gekoppeld; het geheim (VOORSTEL_TOKEN_SECRET) maken is een live-stap die een afzonderlijk akkoord vraagt.
//
// MODEL (kort; volledige uitleg: docs/ontwerp-voorstel-token-en-idempotentie.md in het rapport van Fase A)
//   1. De server genereert een voorstel (regels + acties + verificatiemetadata) en berekent `voorstelHash` over de CANONIEKE vorm.
//   2. De server geeft een token uit: HMAC-SHA256 over { v, jti, uid, pid, h, iat, exp }. jti = unieke id van dit voorstel.
//   3. Bij opslaan stuurt de client: token + het ongewijzigde voorstel + zijn keuzes (welke regels, eigen bedrag/titel/notitie/streefdatum).
//      De keuzes zitten NIET in de hash: de gebruiker mag aanpassen zonder het token ongeldig te maken. Het voorstel zit er WEL in.
//   4. De server controleert: handtekening, niet verlopen, zelfde gebruiker, zelfde project, hash(voorstel) == h. Daarna behandelt hij de
//      inhoud van het voorstel als authentiek servergegeven, maar valideert hij de keuzes en de actuele stand opnieuw (entitlement,
//      bijdragegrenzen, gat, dubbelen). Niets uit de clientpayload wordt vertrouwd als fondsnaam, deadline, grens, status of claim.
//   5. EENMALIG GEBRUIK: jti wordt in een opslagtabel geclaimd (unieke sleutel). Zie `opslagSleutel` voor de deterministische sleutels van
//      regels en taken, waardoor een retry/dubbelklik dezelfde rijen raakt in plaats van nieuwe te maken.

export const TOKEN_VERSIE = 1;
export const MAX_GELDIGHEID_SECONDEN = 3600;
export const STANDAARD_GELDIGHEID_SECONDEN = 1800;

export interface TokenClaims {
  v: number;
  jti: string; // unieke id van dit voorstel (uuid)
  uid: string; // gebruiker
  pid: string; // project
  h: string; // sha256 (hex) van het canonieke voorstel
  iat: number; // seconden
  exp: number; // seconden
}

export type TokenFout =
  | 'ongeldig-formaat'
  | 'ongeldige-handtekening'
  | 'onbekende-versie'
  | 'nog-niet-geldig'
  | 'verlopen'
  | 'andere-gebruiker'
  | 'ander-project'
  | 'ander-voorstel';

const enc = new TextEncoder();

// Canonieke JSON: sleutels alfabetisch (recursief), arrays in volgorde, `undefined` wordt weggelaten, geen NaN/Infinity.
// Hetzelfde voorstel levert dus altijd dezelfde bytes, ongeacht de volgorde waarin de sleutels zijn opgebouwd.
export function canoniekeJson(waarde: unknown): string {
  if (waarde === null) return 'null';

  switch (typeof waarde) {
    case 'string':
      return JSON.stringify(waarde);
    case 'boolean':
      return waarde ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(waarde)) throw new Error('niet-eindig getal in voorstel');
      return JSON.stringify(waarde);
    case 'object': {
      if (Array.isArray(waarde)) return '[' + waarde.map((x) => (x === undefined ? 'null' : canoniekeJson(x))).join(',') + ']';

      const obj = waarde as Record<string, unknown>;
      const delen = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canoniekeJson(obj[k]));

      return '{' + delen.join(',') + '}';
    }
    default:
      throw new Error('niet-serialiseerbare waarde in voorstel');
  }
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function voorstelHash(voorstel: unknown): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(canoniekeJson(voorstel))));
}

function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);

  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deb64u(tekst: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(tekst)) return null;

  try {
    const s = atob(tekst.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (tekst.length % 4)) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sleutel(geheim: string): Promise<CryptoKey> {
  if (typeof geheim !== 'string' || geheim.length < 32) throw new Error('geheim te kort');

  return crypto.subtle.importKey('raw', enc.encode(geheim), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function maakToken(
  inv: { jti: string; uid: string; pid: string; hash: string; nu: number; geldigheidSeconden?: number },
  geheim: string,
): Promise<string> {
  const duur = Math.min(Math.max(1, inv.geldigheidSeconden ?? STANDAARD_GELDIGHEID_SECONDEN), MAX_GELDIGHEID_SECONDEN);
  const claims: TokenClaims = { v: TOKEN_VERSIE, jti: inv.jti, uid: inv.uid, pid: inv.pid, h: inv.hash, iat: inv.nu, exp: inv.nu + duur };
  const payload = b64u(enc.encode(canoniekeJson(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await sleutel(geheim), enc.encode(payload)));

  return payload + '.' + b64u(sig);
}

export async function controleerToken(
  token: unknown,
  geheim: string,
  verwacht: { uid: string; pid: string; hash: string; nu: number },
): Promise<{ ok: true; claims: TokenClaims } | { ok: false; reden: TokenFout }> {
  const nee = (reden: TokenFout) => ({ ok: false as const, reden });

  if (typeof token !== 'string' || token.length > 2000) return nee('ongeldig-formaat');

  const delen = token.split('.');
  if (delen.length !== 2) return nee('ongeldig-formaat');

  const sig = deb64u(delen[1]);
  const payloadBytes = deb64u(delen[0]);
  if (!sig || !payloadBytes) return nee('ongeldig-formaat');

  // Eerst de handtekening (constante tijd via WebCrypto), daarna pas de inhoud lezen.
  const geldig = await crypto.subtle.verify('HMAC', await sleutel(geheim), sig, enc.encode(delen[0]));
  if (!geldig) return nee('ongeldige-handtekening');

  let claims: TokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return nee('ongeldig-formaat');
  }

  if (!claims || claims.v !== TOKEN_VERSIE) return nee('onbekende-versie');
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') return nee('ongeldig-formaat');
  if (claims.iat > verwacht.nu + 60) return nee('nog-niet-geldig');
  if (verwacht.nu >= claims.exp) return nee('verlopen');
  if (claims.uid !== verwacht.uid) return nee('andere-gebruiker');
  if (claims.pid !== verwacht.pid) return nee('ander-project');
  if (claims.h !== verwacht.hash) return nee('ander-voorstel');

  return { ok: true, claims };
}

// Deterministische sleutel voor een regel of taak van dit voorstel. Dezelfde invoer geeft dezelfde sleutel; een retry, dubbelklik of
// herhaald verzoek raakt dus dezelfde rij (unieke index op (program_id, voorstel_sleutel) voor taken) in plaats van een nieuwe.
// Het resultaat past binnen de databasegrens van 200 tekens.
export function opslagSleutel(jti: string, ...onderdelen: Array<string | number>): string {
  const schoon = onderdelen.map((o) => String(o).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').slice(0, 40));

  return [jti.toLowerCase().replace(/[^a-f0-9-]/g, '').slice(0, 36), ...schoon].join(':').slice(0, 200);
}
