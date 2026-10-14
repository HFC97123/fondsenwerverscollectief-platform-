// Veilig ophalen van één openbare bronpagina voor de server-side verificatie (Fase B1).
//
// STATUS: voorbereiding. Niets importeert dit bestand; er is geen route, geen UI-koppeling en geen deploy. Alle netwerktoegang is
// INJECTEERBAAR (resolveHost, fetchImpl), zodat de beveiligingslogica volledig zonder netwerk te testen is. Welke DNS-aanpak in de
// Supabase-runtime werkt (Deno.resolveDns of DNS-over-HTTPS) staat bewust nog open en wordt in Fase B2 met een proef bepaald.
//
// BELANGRIJK, geen schijnveiligheid: deze module controleert de DNS-uitkomst VOOR het ophalen. Als `fetchImpl` daarna zelf opnieuw
// resolveert (zoals de standaard fetch doet), kan een aanvaller met een eigen DNS-server tussen controle en verbinding een ander adres
// teruggeven (DNS-rebinding / TOCTOU). Dat risico is hier NIET opgelost. Het resultaat vermeldt dit eerlijk in `dnsGepind: false`.
// De module is zo opgezet dat een gepinde verbinding (verbinden met het gecontroleerde IP met de originele hostnaam als SNI) later
// als `fetchImpl` kan worden ingehaakt: elke aanroep krijgt de gecontroleerde adressen mee in `init.gecontroleerdeIps`.
// Claim daarom nergens "SSRF-veilig" op basis van deze module alleen.
//
// Beleid (fail-closed, alles hieronder is een weigering tenzij uitdrukkelijk toegestaan)
//   schema        alleen https; geen credentials in de URL; alleen poort 443; geen IP-literals; geen interne/gereserveerde namen
//   DNS           resolve -> controleer ALLE adressen -> één niet-openbaar adres of een leeg antwoord = weigeren
//   redirects     handmatig (redirect:'manual'), maximaal 3; elke hop opnieuw: URL, schema, hostnaam, DNS, adressen
//   timeout       één harde klok voor het geheel (DNS, redirects, headers en body lezen)
//   grootte       body als stream met harde bytegrens; Content-Length vooraf als snelle weigering; de grens geldt voor de
//                 GEDECODEERDE stream (gzip-bommen tellen dus mee)
//   inhoud        alleen text/html, application/xhtml+xml en text/plain
//   cookies       geen (credentials:'omit'); geen Authorization; alleen GET
import { beoordeelHostnaam, beoordeelIp } from './ipRanges.ts';

export const STANDAARD_TIMEOUT_MS = 8000;
// 1 MiB: gangbare fonds- en regelingspagina's zijn 50-300 KB HTML; 1 MiB geeft ruimte aan zware CMS-pagina's en houdt de
// lineaire tekstverwerking (zie tests/verificatie perf) ruim binnen de CPU-limiet van een Edge-aanroep.
export const STANDAARD_MAX_BYTES = 1_048_576;
export const STANDAARD_MAX_REDIRECTS = 3;
const MAX_URL_LENGTE = 2000;
const MAX_DNS_ANTWOORDEN = 16;
const TOEGESTANE_TYPES = new Set(['text/html', 'application/xhtml+xml', 'text/plain']);
const REDIRECT_STATUSSEN = new Set([301, 302, 303, 307, 308]);

export type FetchFout =
  | 'invalid_url'
  | 'forbidden_host'
  | 'dns_failed'
  | 'forbidden_ip'
  | 'redirect_blocked'
  | 'redirect_loop'
  | 'too_many_redirects'
  | 'timeout'
  | 'response_too_large'
  | 'unsupported_content_type'
  | 'http_error'
  | 'empty_body'
  | 'fetch_failed';

export interface FetchInit {
  method: 'GET';
  redirect: 'manual';
  credentials: 'omit';
  cache: 'no-store';
  headers: Record<string, string>;
  signal: AbortSignal;
  // De adressen die voor deze hop zijn gecontroleerd. De standaard fetch negeert dit (NIET gepind); een gepinde implementatie
  // moet hiermee verbinden en mag niet opnieuw resolveren.
  gecontroleerdeIps: string[];
}

export type FetchFn = (url: string, init: FetchInit) => Promise<Response>;
export type ResolveFn = (hostnaam: string, signal: AbortSignal) => Promise<string[]>;

export interface SafeFetchOpties {
  resolveHost: ResolveFn;
  fetchImpl?: FetchFn;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
  nu?: () => number;
}

export interface SafeFetchOk {
  ok: true;
  bronUrl: string; // zoals opgegeven (genormaliseerd)
  eindUrl: string; // na de redirects; altijd https
  hostnaam: string;
  httpStatus: number;
  contentType: string; // alleen het mediatype, zonder parameters
  tekst: string; // gedecodeerde body
  bytes: number;
  redirects: number;
  duurMs: number;
  dnsGepind: false;
}

export interface SafeFetchFout {
  ok: false;
  fout: FetchFout;
  // Interne toelichting voor logs en tests. NOOIT aan een eindgebruiker tonen.
  detail: string;
  hostnaam: string | null;
  httpStatus: number | null;
  redirects: number;
  duurMs: number;
  dnsGepind: false;
}

export type SafeFetchResultaat = SafeFetchOk | SafeFetchFout;

class Stop extends Error {
  fout: FetchFout;
  detail: string;
  httpStatus: number | null;

  constructor(fout: FetchFout, detail: string, httpStatus: number | null = null) {
    super(fout);
    this.fout = fout;
    this.detail = detail;
    this.httpStatus = httpStatus;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// URL-validatie

export interface GeldigeUrl {
  url: URL;
  hostnaam: string;
}

// Valideert één URL (de oorspronkelijke of een redirectdoel). Gooit Stop; het type fout hangt van de context af (`alsRedirect`).
export function valideerBronUrl(ruw: unknown, basis: URL | null = null): GeldigeUrl {
  const alsRedirect = basis !== null;
  const fout = (soort: FetchFout, detail: string): never => {
    throw new Stop(alsRedirect ? 'redirect_blocked' : soort, detail);
  };

  if (typeof ruw !== 'string') return fout('invalid_url', 'geen-tekst');

  const tekst = ruw.trim();

  if (tekst === '' || tekst.length > MAX_URL_LENGTE) return fout('invalid_url', 'lege-of-te-lange-url');

  // Besturingstekens en spaties: de URL-parser verwijdert tabs en regeleinden stilzwijgend; wij weigeren ze.
  if (/[\u0000- \u007f-\u009f\\]/.test(tekst)) return fout('invalid_url', 'besturingsteken-spatie-of-backslash');

  let url: URL;

  try {
    url = basis ? new URL(tekst, basis) : new URL(tekst);
  } catch {
    return fout('invalid_url', 'onleesbare-url');
  }

  if (url.protocol !== 'https:') return fout('invalid_url', `schema-niet-toegestaan:${url.protocol}`);
  if (url.username !== '' || url.password !== '') return fout('invalid_url', 'credentials-in-url');
  if (url.port !== '' && url.port !== '443') return fout('invalid_url', `poort-niet-toegestaan:${url.port}`);

  const host = beoordeelHostnaam(url.hostname);

  if (!host.toegestaan) return fout('forbidden_host', host.reden);

  url.hash = '';

  return { url, hostnaam: host.host };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Timeout over alles

interface Klok {
  signal: AbortSignal;
  afgebroken: Promise<never>;
  stop: () => void;
}

function maakKlok(ms: number): Klok {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let afwijzen: (e: Error) => void = () => {};

  const afgebroken = new Promise<never>((_, reject) => {
    afwijzen = reject;
  });

  afgebroken.catch(() => {}); // nooit een unhandled rejection

  timer = setTimeout(() => {
    const fout = new Stop('timeout', `totale-tijdslimiet-${ms}ms-overschreden`);

    ctrl.abort(fout);
    afwijzen(fout);
  }, ms);

  return {
    signal: ctrl.signal,
    afgebroken,
    stop: () => {
      if (timer !== undefined) clearTimeout(timer);

      timer = undefined;
    },
  };
}

// Laat een belofte tegen de klok racen. Een implementatie die het AbortSignal negeert, hangt hierdoor toch niet.
function metKlok<T>(p: Promise<T>, klok: Klok): Promise<T> {
  p.catch(() => {});

  return Promise.race([p, klok.afgebroken]);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Body lezen als stream met harde bytegrens

async function leesBody(res: Response, maxBytes: number, klok: Klok): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);

  const reader = res.body.getReader();
  const stukken: Uint8Array[] = [];
  let totaal = 0;

  try {
    for (;;) {
      const { done, value } = await metKlok(reader.read(), klok);

      if (done) break;
      if (!value) continue;

      totaal += value.byteLength;

      if (totaal > maxBytes) {
        throw new Stop('response_too_large', `body-groter-dan-${maxBytes}-bytes`);
      }

      stukken.push(value);
    }
  } catch (e) {
    try {
      await Promise.race([reader.cancel(), new Promise((r) => setTimeout(r, 50))]);
    } catch {
      /* stream sluiten is best-effort */
    }

    throw e;
  }

  const uit = new Uint8Array(totaal);
  let pos = 0;

  for (const s of stukken) {
    uit.set(s, pos);
    pos += s.byteLength;
  }

  return uit;
}

function decodeer(bytes: Uint8Array, contentType: string): string {
  const m = /charset\s*=\s*"?([A-Za-z0-9_.:-]+)"?/i.exec(contentType);
  const label = m ? m[1].toLowerCase() : 'utf-8';

  try {
    return new TextDecoder(label, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// DNS

async function controleerDns(host: string, opties: SafeFetchOpties, klok: Klok, alsRedirect: boolean): Promise<string[]> {
  let antwoord: unknown;

  try {
    antwoord = await metKlok(opties.resolveHost(host, klok.signal), klok);
  } catch (e) {
    if (e instanceof Stop) throw e;

    throw new Stop(alsRedirect ? 'redirect_blocked' : 'dns_failed', 'resolver-fout');
  }

  if (!Array.isArray(antwoord) || antwoord.length === 0) throw new Stop(alsRedirect ? 'redirect_blocked' : 'dns_failed', 'leeg-dns-antwoord');
  if (antwoord.length > MAX_DNS_ANTWOORDEN) throw new Stop(alsRedirect ? 'redirect_blocked' : 'forbidden_ip', 'te-veel-dns-antwoorden');

  // Resolve hostname -> controleer ALLE gevonden adressen -> alleen doorgaan als alle adressen openbaar zijn.
  // Eén privaat of gereserveerd adres (ook tussen openbare) is genoeg om te weigeren.
  for (const ip of antwoord) {
    const oordeel = beoordeelIp(ip as string);

    if (!oordeel.openbaar) {
      throw new Stop(alsRedirect ? 'redirect_blocked' : 'forbidden_ip', `niet-openbaar-adres:${oordeel.reden}`);
    }
  }

  return (antwoord as string[]).map((x) => String(x).trim());
}

// ---------------------------------------------------------------------------------------------------------------------------
// Hoofdfunctie

export async function safeFetchPublicPage(bronUrl: string, opties: SafeFetchOpties): Promise<SafeFetchResultaat> {
  const nu = opties.nu ?? (() => Date.now());
  const start = nu();
  const maxBytes = opties.maxBytes ?? STANDAARD_MAX_BYTES;
  const maxRedirects = opties.maxRedirects ?? STANDAARD_MAX_REDIRECTS;
  const fetchImpl: FetchFn = opties.fetchImpl ?? ((url, init) => fetch(url, init));
  const klok = maakKlok(opties.timeoutMs ?? STANDAARD_TIMEOUT_MS);
  let hostnaam: string | null = null;
  let redirects = 0;
  let httpStatus: number | null = null;

  try {
    let huidig = valideerBronUrl(bronUrl);
    const eerste = huidig.url.toString();
    const bezocht = new Set<string>([eerste]);

    hostnaam = huidig.hostnaam;

    for (;;) {
      const ips = await controleerDns(huidig.hostnaam, opties, klok, redirects > 0);

      const res = await metKlok(
        fetchImpl(huidig.url.toString(), {
          method: 'GET',
          redirect: 'manual',
          credentials: 'omit',
          cache: 'no-store',
          headers: { Accept: 'text/html,text/plain;q=0.9', 'User-Agent': opties.userAgent ?? 'SubsidieKompas-Bronverificatie/1.0' },
          signal: klok.signal,
          gecontroleerdeIps: ips,
        }),
        klok,
      ).catch((e) => {
        if (e instanceof Stop) throw e;

        throw new Stop('fetch_failed', 'verbindingsfout');
      });

      httpStatus = res.status;

      // Een "opaque redirect" betekent dat de runtime de Location niet laat zien: dan kunnen we de hop niet valideren.
      if (res.type === 'opaqueredirect') {
        throw new Stop('redirect_blocked', 'opaque-redirect-niet-controleerbaar', res.status);
      }

      if (REDIRECT_STATUSSEN.has(res.status)) {
        try {
          await res.body?.cancel();
        } catch {
          /* niets */
        }

        const loc = res.headers.get('location');

        if (!loc) throw new Stop('redirect_blocked', 'redirect-zonder-location', res.status);

        redirects++;

        if (redirects > maxRedirects) throw new Stop('too_many_redirects', `meer-dan-${maxRedirects}-redirects`, res.status);

        const volgende = valideerBronUrl(loc, huidig.url); // protocol, hostnaam, credentials, poort: elke hop opnieuw

        const sleutel = volgende.url.toString();

        if (bezocht.has(sleutel)) throw new Stop('redirect_loop', 'redirect-lus', res.status);

        bezocht.add(sleutel);
        huidig = volgende;
        hostnaam = huidig.hostnaam;
        continue; // volgende hop: DNS en adressen worden bovenaan opnieuw gecontroleerd
      }

      if (res.status < 200 || res.status > 299) {
        try {
          await res.body?.cancel();
        } catch {
          /* niets */
        }

        throw new Stop('http_error', `http-status-${res.status}`, res.status);
      }

      const typeKop = res.headers.get('content-type') ?? '';
      const mediatype = typeKop.split(';')[0].trim().toLowerCase();

      if (!TOEGESTANE_TYPES.has(mediatype)) {
        try {
          await res.body?.cancel();
        } catch {
          /* niets */
        }

        throw new Stop('unsupported_content_type', `mediatype:${mediatype || 'ontbreekt'}`, res.status);
      }

      const lengteKop = Number(res.headers.get('content-length'));

      if (Number.isFinite(lengteKop) && lengteKop > maxBytes) {
        try {
          await res.body?.cancel();
        } catch {
          /* niets */
        }

        throw new Stop('response_too_large', `content-length-${lengteKop}`, res.status);
      }

      const bytes = await leesBody(res, maxBytes, klok);

      if (bytes.byteLength === 0) throw new Stop('empty_body', 'lege-body', res.status);

      return {
        ok: true,
        bronUrl: eerste,
        eindUrl: huidig.url.toString(),
        hostnaam: huidig.hostnaam,
        httpStatus: res.status,
        contentType: mediatype,
        tekst: decodeer(bytes, typeKop),
        bytes: bytes.byteLength,
        redirects,
        duurMs: nu() - start,
        dnsGepind: false,
      };
    }
  } catch (e) {
    const stop = e instanceof Stop ? e : klok.signal.aborted ? new Stop('timeout', 'afgebroken') : new Stop('fetch_failed', 'onverwachte-fout');

    return {
      ok: false,
      fout: stop.fout,
      detail: stop.detail,
      hostnaam,
      httpStatus: stop.httpStatus ?? httpStatus,
      redirects,
      duurMs: nu() - start,
      dnsGepind: false,
    };
  } finally {
    klok.stop();
  }
}
