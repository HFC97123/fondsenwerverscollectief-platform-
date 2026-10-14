// Gedrag van de veilige bronophaler: timeout over alles, bytegrens op de stream, content-type, statuscodes, decodering. Geen netwerk.
import { safeFetchPublicPage, STANDAARD_MAX_BYTES, STANDAARD_TIMEOUT_MS, STANDAARD_MAX_REDIRECTS } from '../../supabase/functions/_shared/safeFetch.ts';
import { check, gelijk, sectie, klaar, stand, omgeving, pagina, wacht, OPENBAAR } from './hulp.mjs';

stand.naam = 'fetch';

let onverwerkt = 0;
process.on('unhandledRejection', () => { onverwerkt += 1; });

const DNS = { 'fonds.example.nl': [OPENBAAR], 'tweede.example.nl': [OPENBAAR], 'derde.example.nl': [OPENBAAR] };
const U = 'https://fonds.example.nl/p';
const doe = async (paginas, opties = {}) => {
  const o = omgeving({ dns: DNS, paginas });
  const r = await safeFetchPublicPage(U, { resolveHost: o.resolveHost, fetchImpl: o.fetchImpl, timeoutMs: 400, ...opties });

  return { r, o };
};

sectie('1. Succes en decodering');
{
  const { r } = await doe({ [U]: pagina('<p>Dit is een pagina met é en €.</p>') });
  check('gewone pagina', r.ok === true && r.httpStatus === 200 && r.contentType === 'text/html' && r.redirects === 0 && r.tekst.includes('é en €'));
  check('bytes en duur worden vastgelegd', r.ok && r.bytes > 50 && r.duurMs >= 0);

  const t = await doe({ [U]: { status: 200, contentType: 'text/plain; charset=utf-8', body: 'Gewone tekst' } });
  check('text/plain wordt geaccepteerd', t.r.ok === true && t.r.contentType === 'text/plain');

  const x = await doe({ [U]: { status: 200, contentType: 'application/xhtml+xml', body: '<html><body>x</body></html>' } });
  check('application/xhtml+xml wordt geaccepteerd', x.r.ok === true);

  const l = await doe({ [U]: { status: 200, contentType: 'text/html; charset=iso-8859-1', body: new Uint8Array([0x63, 0x61, 0x66, 0xe9]) } });
  check('charset iso-8859-1 uit de header wordt gebruikt', l.r.ok === true && l.r.tekst === 'caf' + String.fromCharCode(0xe9));

  const u = await doe({ [U]: { status: 200, contentType: 'text/html; charset=onbekend-label', body: 'abc' } });
  check('onbekend charset: terugval op utf-8', u.r.ok === true && u.r.tekst === 'abc');

  const h = await doe({ [U]: { status: 200, contentType: 'TEXT/HTML; Charset=UTF-8', body: 'abc' } });
  check('mediatype is hoofdletterongevoelig', h.r.ok === true && h.r.contentType === 'text/html');
}

sectie('2. Content-type (alleen tekstbronnen)');
{
  const types = ['image/png', 'image/svg+xml', 'video/mp4', 'audio/mpeg', 'application/octet-stream', 'application/pdf', 'application/zip', 'application/x-msdownload',
    'application/json', 'application/javascript', 'text/css', 'text/javascript', 'application/xml', 'multipart/form-data', 'binary/octet-stream', 'font/woff2'];

  for (const ct of types) {
    const { r } = await doe({ [U]: { status: 200, contentType: ct, body: 'inhoud' } });
    check(`${ct}: unsupported_content_type`, r.ok === false && r.fout === 'unsupported_content_type', JSON.stringify(r.fout ?? 'ok'));
  }

  const z = await doe({ [U]: { status: 200, contentType: null, body: 'zonder content-type' } });
  check('geen Content-Type-header: unsupported_content_type (fail closed)', z.r.ok === false && z.r.fout === 'unsupported_content_type');
}

sectie('3. Statuscodes en lege body');
{
  for (const status of [400, 401, 403, 404, 410, 429, 500, 502, 503]) {
    const { r } = await doe({ [U]: { status, contentType: 'text/html', body: '<p>fout</p>' } });
    check(`HTTP ${status}: http_error met status`, r.ok === false && r.fout === 'http_error' && r.httpStatus === status);
  }

  const l = await doe({ [U]: { status: 200, contentType: 'text/html', body: '' } });
  check('lege body: empty_body', l.r.ok === false && l.r.fout === 'empty_body');

  const n = await doe({ [U]: { status: 200, contentType: 'text/html', body: null } });
  check('geen body: empty_body', n.r.ok === false && n.r.fout === 'empty_body');

  const o = omgeving({ dns: DNS, paginas: {} });
  const r = await safeFetchPublicPage(U, { resolveHost: o.resolveHost, fetchImpl: async () => { throw new TypeError('connectie geweigerd'); }, timeoutMs: 300 });
  check('fetch gooit: fetch_failed (geen crash, geen details naar buiten)', r.ok === false && r.fout === 'fetch_failed');
}

sectie('4. Bytegrens: stream, niet eerst alles laden');
{
  const max = 1000;
  let gelezen = 0;
  const stuk = new Uint8Array(400).fill(97);
  let verzonden = 0;
  const stroom = () => new ReadableStream({
    pull(c) {
      if (verzonden >= 50) return c.close();
      verzonden += 1;
      gelezen += stuk.length;
      c.enqueue(stuk);
    },
  });

  const o = omgeving({ dns: DNS });
  const r = await safeFetchPublicPage(U, {
    resolveHost: o.resolveHost, maxBytes: max, timeoutMs: 400,
    fetchImpl: async () => new Response(stroom(), { status: 200, headers: { 'content-type': 'text/html' } }),
  });

  check('te grote body zonder Content-Length: response_too_large', r.ok === false && r.fout === 'response_too_large');
  check('de stream wordt gestopt (veel minder dan de 20000 bytes gelezen)', gelezen <= max + 3 * 400, `gelezen ${gelezen}`);

  const cl = await doe({ [U]: { status: 200, contentType: 'text/html', body: 'x'.repeat(50), headers: { 'content-length': '999999999' } } }, { maxBytes: 1000 });
  check('Content-Length boven de grens: direct geweigerd', cl.r.ok === false && cl.r.fout === 'response_too_large');

  const liegt = await doe({ [U]: { status: 200, contentType: 'text/html', body: 'x'.repeat(5000), headers: { 'content-length': '10' } } }, { maxBytes: 1000 });
  check('Content-Length liegt (klein, body groot): stream-limiet vangt het', liegt.r.ok === false && liegt.r.fout === 'response_too_large');

  const precies = await doe({ [U]: { status: 200, contentType: 'text/plain', body: 'x'.repeat(1000) } }, { maxBytes: 1000 });
  check('precies op de grens is toegestaan', precies.r.ok === true && precies.r.bytes === 1000);

  const net = await doe({ [U]: { status: 200, contentType: 'text/plain', body: 'x'.repeat(1001) } }, { maxBytes: 1000 });
  check('één byte erboven wordt geweigerd', net.r.ok === false && net.r.fout === 'response_too_large');

  check('standaardwaarden: 1 MiB, 8 s, 3 redirects', STANDAARD_MAX_BYTES === 1048576 && STANDAARD_TIMEOUT_MS === 8000 && STANDAARD_MAX_REDIRECTS === 3);
}

sectie('5. Eén harde timeout voor alles');
{
  let t = await doe({ [U]: { hang: true } }, { timeoutMs: 150 });
  check('fetch hangt (negeert het signaal): timeout', t.r.ok === false && t.r.fout === 'timeout' && t.r.duurMs < 1000, `${t.r.fout} ${t.r.duurMs}`);

  t = await doe({ [U]: { wachtVoorHeaders: 600, status: 200, contentType: 'text/html', body: 'x' } }, { timeoutMs: 150 });
  check('headers komen te laat: timeout', t.r.ok === false && t.r.fout === 'timeout');

  t = await doe({ [U]: { status: 200, contentType: 'text/html', body: 'x', stuks: [{ tekst: 'a' }, { tekst: 'b', wacht: 80 }, { tekst: 'c', wacht: 80 }, { tekst: 'd', wacht: 80 }, { tekst: 'e', wacht: 80 }] } }, { timeoutMs: 200 });
  check('body druppelt langzaam binnen (elk stuk tijdig, totaal te laat): timeout', t.r.ok === false && t.r.fout === 'timeout' && t.r.duurMs < 1000, `${t.r.fout} ${t.r.duurMs}`);

  t = await doe({ [U]: { status: 200, contentType: 'text/html', body: 'x', stuks: [{ tekst: 'begin' }, { tekst: 'nooit', wacht: 5000 }] } }, { timeoutMs: 150 });
  check('body blijft hangen: timeout', t.r.ok === false && t.r.fout === 'timeout');

  t = await doe({ [U]: { status: 200, contentType: 'text/html', body: 'x', stuks: [{ tekst: 'a' }, { tekst: 'b', wacht: 30 }] } }, { timeoutMs: 500 });
  check('trage maar tijdige body slaagt', t.r.ok === true && t.r.tekst === 'ab');

  // De klok loopt door over redirects heen: drie hops die elk 90 ms duren passen niet in 200 ms.
  const hop = (naar) => ({ wachtVoorHeaders: 90, status: 302, location: naar, body: null });
  t = await doe({ [U]: hop('https://tweede.example.nl/'), 'https://tweede.example.nl/': hop('https://derde.example.nl/'), 'https://derde.example.nl/': { wachtVoorHeaders: 90, status: 200, contentType: 'text/html', body: 'klaar' } }, { timeoutMs: 200 });
  check('redirectketen kost in totaal te lang: timeout', t.r.ok === false && t.r.fout === 'timeout', JSON.stringify(t.r.fout));

  // Het AbortSignal gaat mee naar fetchImpl en wordt afgevuurd
  let signaal = null;
  const o = omgeving({ dns: DNS });
  await safeFetchPublicPage(U, { resolveHost: o.resolveHost, timeoutMs: 100, fetchImpl: (url, init) => { signaal = init.signal; return new Promise(() => {}); } });
  await wacht(30);
  check('het AbortSignal is afgevuurd bij de timeout', signaal !== null && signaal.aborted === true);

  // De timer wordt opgeruimd
  const klokTikken = await doe({ [U]: pagina('<p>snel</p>') }, { timeoutMs: 60_000 });
  check('geslaagde fetch laat geen timer achter (het proces kan stoppen)', klokTikken.r.ok === true);
}

sectie('6. Geen losse rejections');
{
  await wacht(100);
  check('geen unhandled rejections tijdens alle fetch-tests', onverwerkt === 0, String(onverwerkt));
}

klaar('FETCH');
