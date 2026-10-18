// Beleefd en veilig ophalen van openbare pagina's en PDF's voor het bandbreedte-onderzoek.
// Draait op de computer van de beheerder (niet in de Edge Function). Alleen LEZEN: GET, geen cookies, geen formulieren.
//
// Regels: alleen http(s) op poort 80/443, geen inloggegevens in de URL, geen interne of gereserveerde adressen (ook niet na een
// redirect), robots.txt wordt gerespecteerd, minimaal PER_HOST_WACHT_MS tussen twee verzoeken aan dezelfde host, harde grens op
// grootte en tijd, en alles wordt in een map gecachet zodat een tweede run geen extra verzoeken doet.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { htmlNaarTekst, linksUitHtml, pdfNaarTekst, titelUitHtml } from './tekst.mjs';

export const STANDAARD_UA = 'Mozilla/5.0 (compatible; SubsidieKompas-onderzoek/1.0)';
const MAX_REDIRECTS = 4;

export function isPrivaatIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('::ffff:')) return isPrivaatIp(l.slice(7));
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff');
  }
  return true;
}

export function valideerUrl(ruw) {
  let u;
  try {
    u = new URL(String(ruw).trim());
  } catch {
    return { ok: false, fout: 'ongeldige_url' };
  }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, fout: 'schema' };
  if (u.username || u.password) return { ok: false, fout: 'inloggegevens' };
  if (u.port && !['80', '443'].includes(u.port)) return { ok: false, fout: 'poort' };
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || net.isIP(h.replace(/^\[|\]$/g, ''))) return { ok: false, fout: 'host' };
  u.hash = '';
  return { ok: true, url: u };
}

// Jammer genoeg is er geen publieke-suffix-lijst ingebouwd; deze korte lijst dekt de gangbare tweelaagse eindes.
const TWEE_LAGEN = new Set(['co.uk', 'org.uk', 'com.au', 'org.au', 'co.za', 'org.za', 'com.br', 'co.ke', 'co.nz', 'com.gh', 'org.gh', 'co.in']);
export function basisDomein(host) {
  const d = String(host).toLowerCase().replace(/^www\./, '').split('.');
  if (d.length <= 2) return d.join('.');
  const laatste2 = d.slice(-2).join('.');
  return TWEE_LAGEN.has(laatste2) ? d.slice(-3).join('.') : laatste2;
}

function parseRobots(tekst, ua) {
  const groepen = [];
  let huidig = null;
  for (const rij of String(tekst).split(/\r?\n/)) {
    const r = rij.replace(/#.*/, '').trim();
    if (!r) continue;
    const i = r.indexOf(':');
    if (i < 0) continue;
    const k = r.slice(0, i).trim().toLowerCase();
    const v = r.slice(i + 1).trim();
    if (k === 'user-agent') {
      if (!huidig || huidig.regels.length) {
        huidig = { agents: [], regels: [] };
        groepen.push(huidig);
      }
      huidig.agents.push(v.toLowerCase());
    } else if ((k === 'disallow' || k === 'allow') && huidig) huidig.regels.push({ allow: k === 'allow', pad: v });
  }
  const mijn = ua.toLowerCase();
  const eigen = groepen.filter((g) => g.agents.some((a) => a !== '*' && mijn.includes(a)));
  const gekozen = eigen.length ? eigen : groepen.filter((g) => g.agents.includes('*'));
  return gekozen.flatMap((g) => g.regels);
}

function robotsStaatToe(regels, pad) {
  let beste = null;
  for (const r of regels) {
    if (!r.pad) continue;
    const re = new RegExp('^' + r.pad.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(pad) && (!beste || r.pad.length > beste.pad.length || (r.pad.length === beste.pad.length && r.allow))) beste = r;
  }
  return !beste || beste.allow;
}

const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

export function maakOphaler({
  fetchImpl = globalThis.fetch,
  resolveHost = async (h) => (await lookup(h, { all: true })).map((x) => x.address),
  cacheMap = null,
  userAgent = STANDAARD_UA,
  perHostWachtMs = 1200,
  timeoutMs = 20000,
  maxHtmlBytes = 3_000_000,
  maxPdfBytes = 30_000_000,
  respecteerRobots = true,
} = {}) {
  const laatsteTijd = new Map(); // host -> tijdstip van het volgende toegestane verzoek
  const robotsCache = new Map();
  const statistiek = { verzoeken: 0, cacheHits: 0, geweigerd: 0 };

  async function wacht(host) {
    const nu = Date.now();
    const vrij = Math.max(nu, laatsteTijd.get(host) ?? 0);
    laatsteTijd.set(host, vrij + perHostWachtMs);
    if (vrij > nu) await slaap(vrij - nu);
  }

  async function controleerHost(host) {
    const ips = await resolveHost(host);
    if (!ips.length || ips.some(isPrivaatIp)) throw Object.assign(new Error('privaat_adres'), { code: 'privaat_adres' });
  }

  async function rauw(url, accept) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      let huidig = url;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const v = valideerUrl(huidig);
        if (!v.ok) throw Object.assign(new Error(v.fout), { code: v.fout });
        await controleerHost(v.url.hostname);
        await wacht(v.url.hostname);
        statistiek.verzoeken++;
        const res = await fetchImpl(v.url.toString(), { method: 'GET', redirect: 'manual', credentials: 'omit', signal: ctl.signal, headers: { 'user-agent': userAgent, accept } });
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get('location');
          if (!loc) throw Object.assign(new Error('redirect_zonder_doel'), { code: 'redirect' });
          huidig = new URL(loc, v.url).toString();
          continue;
        }
        return { res, eindUrl: v.url.toString(), eindHuidig: huidig };
      }
      throw Object.assign(new Error('te_veel_redirects'), { code: 'redirects' });
    } finally {
      clearTimeout(timer);
    }
  }

  async function leesBody(res, max) {
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > max) throw Object.assign(new Error('te_groot'), { code: 'te_groot' });
    if (!res.body) {
      const b = Buffer.from(await res.arrayBuffer());
      if (b.length > max) throw Object.assign(new Error('te_groot'), { code: 'te_groot' });
      return b;
    }
    const delen = [];
    let n = 0;
    for await (const d of res.body) {
      n += d.length;
      if (n > max) throw Object.assign(new Error('te_groot'), { code: 'te_groot' });
      delen.push(Buffer.from(d));
    }
    return Buffer.concat(delen);
  }

  async function robotsOk(u) {
    if (!respecteerRobots) return true;
    const origin = u.origin;
    if (!robotsCache.has(origin)) {
      let regels = [];
      try {
        const { res } = await rauw(`${origin}/robots.txt`, 'text/plain');
        if (res.status === 200) regels = parseRobots((await leesBody(res, 300_000)).toString('utf8'), userAgent);
      } catch {
        regels = [];
      }
      robotsCache.set(origin, regels);
    }
    return robotsStaatToe(robotsCache.get(origin), u.pathname + u.search);
  }

  async function cacheLees(sleutel) {
    if (!cacheMap) return null;
    try {
      return JSON.parse(await fs.readFile(path.join(cacheMap, sleutel + '.json'), 'utf8'));
    } catch {
      return null;
    }
  }
  async function cacheSchrijf(sleutel, obj) {
    if (!cacheMap) return;
    await fs.mkdir(cacheMap, { recursive: true });
    await fs.writeFile(path.join(cacheMap, sleutel + '.json'), JSON.stringify(obj));
  }

  // Resultaat: { ok:true, url, eindUrl, soort:'html'|'pdf', titel, tekst, links, afgekapt } of { ok:false, url, fout }
  async function haal(urlRuw) {
    const v = valideerUrl(urlRuw);
    if (!v.ok) return { ok: false, url: String(urlRuw), fout: v.fout };
    const url = v.url.toString();
    const sleutel = createHash('sha256').update(url).digest('hex').slice(0, 40);
    const gecachet = await cacheLees(sleutel);
    if (gecachet) {
      statistiek.cacheHits++;
      return gecachet;
    }
    try {
      if (!(await robotsOk(v.url))) {
        statistiek.geweigerd++;
        return { ok: false, url, fout: 'robots_weigert' };
      }
      const { res, eindUrl } = await rauw(url, 'text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8');
      if (res.status < 200 || res.status >= 300) return { ok: false, url, fout: `http_${res.status}` };
      const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      const isPdf = ct === 'application/pdf' || /\.pdf($|\?)/i.test(eindUrl);
      let uit;
      if (isPdf) {
        const bytes = await leesBody(res, maxPdfBytes);
        const { tekst, afgekapt } = await pdfNaarTekst(bytes);
        uit = { ok: true, url, eindUrl, soort: 'pdf', titel: '', tekst, links: [], afgekapt };
      } else if (['text/html', 'application/xhtml+xml', 'text/plain', ''].includes(ct)) {
        const html = (await leesBody(res, maxHtmlBytes)).toString('utf8');
        uit = ct === 'text/plain' ? { ok: true, url, eindUrl, soort: 'html', titel: '', tekst: html, links: [], afgekapt: false } : { ok: true, url, eindUrl, soort: 'html', titel: titelUitHtml(html), tekst: htmlNaarTekst(html), links: linksUitHtml(html, eindUrl), afgekapt: false };
      } else return { ok: false, url, fout: 'type_niet_ondersteund' };
      if (!uit.tekst || uit.tekst.length < 40) return { ok: false, url, fout: 'geen_tekst' };
      await cacheSchrijf(sleutel, uit);
      return uit;
    } catch (e) {
      return { ok: false, url, fout: e?.name === 'AbortError' ? 'timeout' : e?.code || 'ophalen_mislukt' };
    }
  }

  return { haal, statistiek };
}
