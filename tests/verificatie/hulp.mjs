// Gedeelde testhulpen voor de verificatielaag (Fase B1). Geen extern netwerk: DNS en fetch zijn volledig nagebootst.
export const stand = { ok: 0, fout: 0, naam: '' };

export const check = (naam, waar, detail = '') => {
  if (waar) stand.ok += 1;
  else {
    stand.fout += 1;
    console.log(`  FAIL: ${stand.naam}: ${naam} ${detail}`);
  }
};

export const gelijk = (naam, kreeg, verwacht) => {
  const a = JSON.stringify(kreeg);
  const b = JSON.stringify(verwacht);

  check(naam, a === b, `\n    kreeg    ${a}\n    verwacht ${b}`);
};

export const sectie = (t) => console.log(`\n== ${t}`);
export const klaar = (naam) => {
  console.log(`\n${naam}: ${stand.ok} OK, ${stand.fout} FAIL`);
  process.exit(stand.fout ? 1 : 0);
};

export const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

const enc = new TextEncoder();

// Maakt een Response met een body die in stukken en met vertraging kan binnenkomen.
export function maakAntwoord(spec) {
  const status = spec.status ?? 200;
  const headers = new Headers(spec.headers ?? {});

  if (spec.contentType !== null && !headers.has('content-type') && spec.contentType !== undefined) headers.set('content-type', spec.contentType);
  if (spec.location) headers.set('location', spec.location);

  if (spec.body === null || spec.body === undefined) return new Response(null, { status, headers });

  if (spec.stuks) {
    // spec.stuks = [{ tekst|bytes, wacht }]
    const stuks = [...spec.stuks];
    const stroom = new ReadableStream({
      async pull(ctrl) {
        const s = stuks.shift();

        if (!s) return ctrl.close();
        if (s.wacht) await wacht(s.wacht);

        ctrl.enqueue(s.bytes ?? enc.encode(s.tekst ?? ''));
      },
    });

    return new Response(stroom, { status, headers });
  }

  return new Response(typeof spec.body === 'string' ? enc.encode(spec.body) : spec.body, { status, headers });
}

// Nagebootste wereld: dns = { host: [ip, ...] }, paginas = { url: spec | (url, init) => spec }.
export function omgeving({ dns = {}, paginas = {}, dnsHang = false, dnsFout = {} } = {}) {
  const calls = { dns: [], fetch: [], inits: [] };

  const resolveHost = async (host) => {
    calls.dns.push(host);

    if (dnsHang) return new Promise(() => {});
    if (dnsFout[host]) throw new Error('nagebootste resolverfout');

    return dns[host] ?? [];
  };

  const fetchImpl = async (url, init) => {
    calls.fetch.push(url);
    calls.inits.push(init);

    const spec = paginas[url];

    if (!spec) return new Response('niet gevonden', { status: 404, headers: { 'content-type': 'text/plain' } });
    if (typeof spec === 'function') return maakAntwoord(await spec(url, init));
    if (spec.hang) return new Promise(() => {});
    if (spec.wachtVoorHeaders) await wacht(spec.wachtVoorHeaders);

    return maakAntwoord(spec);
  };

  return { resolveHost, fetchImpl, calls };
}

export const OPENBAAR = '93.184.216.34';
export const OPENBAAR2 = '8.8.8.8';
export const OPENBAAR_V6 = '2606:4700:4700::1111';

export const html = (body, titel = 'Pagina') => `<!doctype html><html><head><title>${titel}</title></head><body>${body}</body></html>`;
export const pagina = (body, extra = {}) => ({ status: 200, contentType: 'text/html; charset=utf-8', body: html(body), ...extra });
