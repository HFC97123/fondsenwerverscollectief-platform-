// SSRF-regels van de veilige bronophaler: IP-bereiken, hostnamen, URL-regels, DNS-antwoorden en redirects. Geen netwerk.
import { beoordeelIp, beoordeelHostnaam, parseIPv4Strikt, parseIPv6 } from '../../supabase/functions/_shared/ipRanges.ts';
import { safeFetchPublicPage } from '../../supabase/functions/_shared/safeFetch.ts';
import { check, gelijk, sectie, klaar, stand, omgeving, pagina, OPENBAAR, OPENBAAR2, OPENBAAR_V6 } from './hulp.mjs';

stand.naam = 'ssrf';

sectie('1. IP-bereiken (echte parsing, geen substringcontrole)');
{
  const openbaar = [
    '93.184.216.34', '8.8.8.8', '1.1.1.1', '11.0.0.1', '126.255.255.255', '128.0.0.1', '172.15.255.255', '172.32.0.1', '100.63.255.255',
    '100.128.0.1', '169.253.1.1', '169.255.0.1', '192.167.1.1', '192.169.0.1', '223.255.255.255', '2606:4700:4700::1111',
    '2001:4860:4860::8888', '2a00:1450:4001:81b::200e', '2620:fe::fe',
  ];
  const verboden = [
    '0.0.0.0', '0.1.2.3', '10.0.0.1', '10.255.255.255', '100.64.0.0', '100.100.100.200', '100.127.255.255', '127.0.0.1', '127.255.255.254',
    '169.254.0.1', '169.254.169.254', '172.16.0.1', '172.20.1.1', '172.31.255.255', '192.168.0.1', '192.168.255.255', '192.0.0.1', '192.0.2.5',
    '192.88.99.1', '198.18.0.1', '198.19.255.255', '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:8.8.8.8', '::ffff:10.0.0.1', '0:0:0:0:0:ffff:7f00:1', 'fe80::1', 'febf::1', 'fc00::1',
    'fd00::1', 'fdff::1', 'fd12:3456:789a::1', 'fd00:ec2::254', 'fec0::1', 'ff02::1', '64:ff9b::7f00:1', '2001::1', '2001:0:4136:e378:8000:63bf:3fff:fdd2',
    '2001:db8::1', '2002:7f00:1::1', '100::1', '3fff::1', '::127.0.0.1',
    // niet te lezen = verboden
    '999.1.1.1', '1.2.3', '01.2.3.4', '1.2.3.4.5', 'abc', '', '::g', ':::', '1:2:3:4:5:6:7:8:9', '1.2.3.4%eth0', 'fe80::1%eth0', '[::1]', '0x7f.0.0.1',
    '127.1', '2130706433', '017700000001', '1.2.3.256', ' ', '8.8.8.8/32', '2606:4700:4700::1111/64',
  ];

  for (const ip of openbaar) check(`openbaar: ${ip}`, beoordeelIp(ip).openbaar === true, JSON.stringify(beoordeelIp(ip)));
  for (const ip of verboden) check(`verboden: "${ip}"`, beoordeelIp(ip).openbaar === false);

  check('niet-tekst is verboden', beoordeelIp(null).openbaar === false && beoordeelIp(undefined).openbaar === false && beoordeelIp(2130706433).openbaar === false);
  gelijk('strikte IPv4-parser', [parseIPv4Strikt('1.2.3.4'), parseIPv4Strikt('01.2.3.4'), parseIPv4Strikt('1.2.3'), parseIPv4Strikt('256.1.1.1')], [[1, 2, 3, 4], null, null, null]);
  check('IPv6-parser: ::1 en ingebed IPv4', parseIPv6('::1')?.[15] === 1 && parseIPv6('::ffff:1.2.3.4')?.[12] === 1 && parseIPv6('1::2::3') === null);
}

sectie('2. Hostnamen');
{
  const goed = ['fonds.example.nl', 'FONDS.Example.NL', 'a.b.c.example.com', 'xn--bcher-kva.example.nl', 'fonds-a.nl', 'example.com', 'sub.example.org.'];
  const fout = [
    '', 'localhost', 'localhost.', 'LOCALHOST', 'foo.localhost', 'a.b.localhost', 'intranet', 'metadata', 'instance-data', 'server', 'printer.local',
    'host.internal', 'metadata.google.internal', 'metadata.goog', 'x.intranet', 'nas.lan', 'router.home', 'db.corp', 'a.localdomain', 'x.home.arpa',
    '4.3.2.1.in-addr.arpa', 'kube.svc', 'api.default.svc.cluster.local', 'fonds.test', 'fonds.example', 'fonds.invalid', 'abcdef.onion',
    '127.0.0.1', '10.1.2.3', '169.254.169.254', '0x7f.1', '2130706433', '017700000001', '1.2.3.4', '[::1]', '[::ffff:7f00:1]', '::1', 'a..b.nl', '.nl', '-a.nl',
    'a-.nl', 'a_b.nl', 'a b.nl', 'x.123', 'x.0x1f', 'x.' + 'a'.repeat(64) + '.nl', 'a'.repeat(260) + '.nl',
  ];

  for (const h of goed) check(`toegestaan: ${h}`, beoordeelHostnaam(h).toegestaan === true, JSON.stringify(beoordeelHostnaam(h)));
  for (const h of fout) check(`geweigerd: "${h.slice(0, 40)}"`, beoordeelHostnaam(h).toegestaan === false);
  gelijk('afsluitende punt wordt genormaliseerd', beoordeelHostnaam('Fonds.Example.NL.'), { toegestaan: true, host: 'fonds.example.nl' });
}

sectie('3. URL-regels (nooit DNS of fetch bij een afgekeurde URL)');
{
  const gevallen = [
    // [url, verwachte fout]
    ['https://localhost/', 'forbidden_host'], ['https://localhost./', 'forbidden_host'], ['https://LOCALHOST/', 'forbidden_host'],
    ['https://foo.localhost/', 'forbidden_host'], ['https://127.0.0.1/', 'forbidden_host'], ['https://127.1/', 'forbidden_host'],
    ['https://0x7f.0.0.1/', 'forbidden_host'], ['https://0x7f.1/', 'forbidden_host'], ['https://2130706433/', 'forbidden_host'],
    ['https://017700000001/', 'forbidden_host'], ['https://0177.0.0.1/', 'forbidden_host'], ['https://0/', 'forbidden_host'],
    ['https://[::1]/', 'forbidden_host'], ['https://[0:0:0:0:0:0:0:1]/', 'forbidden_host'], ['https://[::ffff:127.0.0.1]/', 'forbidden_host'],
    ['https://[::ffff:7f00:1]/', 'forbidden_host'], ['https://[fe80::1]/', 'forbidden_host'], ['https://[fd00::1]/', 'forbidden_host'],
    ['https://10.0.0.1/', 'forbidden_host'], ['https://172.16.0.1/', 'forbidden_host'], ['https://192.168.1.1/', 'forbidden_host'],
    ['https://169.254.169.254/latest/meta-data/', 'forbidden_host'], ['https://100.64.0.1/', 'forbidden_host'], ['https://8.8.8.8/', 'forbidden_host'],
    ['https://metadata.google.internal/computeMetadata/v1/', 'forbidden_host'], ['https://intranet/', 'forbidden_host'], ['https://printer.local/', 'forbidden_host'],
    ['https://%6c%6f%63%61%6c%68%6f%73%74/', 'forbidden_host'], ['https://%31%32%37%2e%30%2e%30%2e%31/', 'forbidden_host'],
    [String.fromCharCode(104, 116, 116, 112, 115, 58, 47, 47, 0xff4c, 0xff4f, 0xff43, 0xff41, 0xff4c, 0xff48, 0xff4f, 0xff53, 0xff54, 47), 'forbidden_host'],
    ['https://user:pass@fonds.example.nl/', 'invalid_url'], ['https://user@fonds.example.nl/', 'invalid_url'], ['https://:pw@fonds.example.nl/', 'invalid_url'],
    ['http://fonds.example.nl/', 'invalid_url'], ['javascript:alert(1)', 'invalid_url'], ['file:///etc/passwd', 'invalid_url'],
    ['data:text/html,<script>1</script>', 'invalid_url'], ['ftp://fonds.example.nl/', 'invalid_url'], ['gopher://fonds.example.nl/', 'invalid_url'],
    ['ws://fonds.example.nl/', 'invalid_url'], ['//fonds.example.nl/', 'invalid_url'], ['fonds.example.nl', 'invalid_url'], ['not a url', 'invalid_url'],
    ['', 'invalid_url'], ['   ', 'invalid_url'], ['https://', 'invalid_url'], ['https://fonds.example.nl:8443/', 'invalid_url'], ['https://fonds.example.nl:22/', 'invalid_url'],
    ['https://fonds.example.nl/\tx', 'invalid_url'], ['https://fonds.example.nl/\nx', 'invalid_url'], ['https://evil.nl\\@good.example.nl/', 'invalid_url'],
    ['https://fonds.example.nl/' + 'a'.repeat(2100), 'invalid_url'], [null, 'invalid_url'], [undefined, 'invalid_url'], [12345, 'invalid_url'], [{}, 'invalid_url'],
  ];

  for (const [url, verwacht] of gevallen) {
    const o = omgeving({ dns: { 'fonds.example.nl': [OPENBAAR] } });
    const r = await safeFetchPublicPage(url, { resolveHost: o.resolveHost, fetchImpl: o.fetchImpl, timeoutMs: 500 });

    check(`${String(url).slice(0, 60)} -> ${verwacht}`, r.ok === false && r.fout === verwacht, JSON.stringify(r.fout ?? 'ok'));
    check(`  geen DNS/fetch voor ${String(url).slice(0, 40)}`, o.calls.dns.length === 0 && o.calls.fetch.length === 0);
  }
}

sectie('4. DNS: alle adressen moeten openbaar zijn');
{
  const doe = async (dns, extra = {}) => {
    const o = omgeving({ dns, paginas: { 'https://fonds.example.nl/': pagina('<p>Hallo</p>') }, ...extra });
    const r = await safeFetchPublicPage('https://fonds.example.nl/', { resolveHost: o.resolveHost, fetchImpl: o.fetchImpl, timeoutMs: 500 });

    return { r, o };
  };

  let t = await doe({ 'fonds.example.nl': [OPENBAAR] });
  check('één openbaar adres: doorgaan', t.r.ok === true && t.o.calls.fetch.length === 1);
  check('de gecontroleerde adressen gaan mee naar fetchImpl (voor latere pinning)', JSON.stringify(t.o.calls.inits[0].gecontroleerdeIps) === JSON.stringify([OPENBAAR]));
  check('het resultaat zegt eerlijk dat er NIET gepind is', t.r.dnsGepind === false);
  check('redirect:manual, geen cookies, alleen GET, geen Authorization', t.o.calls.inits[0].redirect === 'manual' && t.o.calls.inits[0].credentials === 'omit' && t.o.calls.inits[0].method === 'GET' && !('authorization' in Object.fromEntries(Object.entries(t.o.calls.inits[0].headers).map(([k, v]) => [k.toLowerCase(), v]))));

  t = await doe({ 'fonds.example.nl': [OPENBAAR, OPENBAAR2, OPENBAAR_V6] });
  check('meerdere openbare adressen (v4 en v6): doorgaan', t.r.ok === true);

  for (const prive of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '192.168.1.5', '172.16.5.5', '100.64.1.1', '::1', 'fe80::1', 'fd00::5', '::ffff:10.0.0.1', '0.0.0.0']) {
    t = await doe({ 'fonds.example.nl': [OPENBAAR, prive] });
    check(`gemengd antwoord (openbaar + ${prive}): fail closed, geen fetch`, t.r.ok === false && t.r.fout === 'forbidden_ip' && t.o.calls.fetch.length === 0, JSON.stringify(t.r.fout));

    t = await doe({ 'fonds.example.nl': [prive, OPENBAAR] });
    check(`gemengd antwoord (volgorde omgekeerd, ${prive})`, t.r.ok === false && t.r.fout === 'forbidden_ip' && t.o.calls.fetch.length === 0);

    t = await doe({ 'fonds.example.nl': [prive] });
    check(`alleen ${prive}`, t.r.ok === false && t.r.fout === 'forbidden_ip' && t.o.calls.fetch.length === 0);
  }

  t = await doe({ 'fonds.example.nl': [] });
  check('leeg DNS-antwoord: dns_failed', t.r.ok === false && t.r.fout === 'dns_failed' && t.o.calls.fetch.length === 0);

  t = await doe({}, { dnsFout: { 'fonds.example.nl': true } });
  check('resolver gooit: dns_failed (geen crash)', t.r.ok === false && t.r.fout === 'dns_failed');

  t = await doe({ 'fonds.example.nl': ['geen-ip'] });
  check('onleesbaar adres: forbidden_ip', t.r.ok === false && t.r.fout === 'forbidden_ip');

  t = await doe({ 'fonds.example.nl': Array.from({ length: 40 }, (_, i) => `93.184.216.${i + 1}`) });
  check('absurd veel DNS-antwoorden: fail closed', t.r.ok === false);

  t = await doe({ 'fonds.example.nl': 'niet-een-lijst' });
  check('resolver geeft geen lijst: dns_failed', t.r.ok === false && t.r.fout === 'dns_failed');

  t = await doe({}, { dnsHang: true });
  check('resolver hangt: timeout (fail closed)', t.r.ok === false && t.r.fout === 'timeout');

  const o = omgeving({ dns: { 'xn--bcher-kva.example.nl': [OPENBAAR] }, paginas: { 'https://xn--bcher-kva.example.nl/': pagina('<p>ok</p>') } });
  const r = await safeFetchPublicPage('https://b' + String.fromCharCode(0xfc) + 'cher.example.nl/', { resolveHost: o.resolveHost, fetchImpl: o.fetchImpl, timeoutMs: 500 });
  check('IDN wordt als punycode geresolved', r.ok === true && o.calls.dns[0] === 'xn--bcher-kva.example.nl');

  const o2 = omgeving({ dns: { 'fonds.example.nl': [OPENBAAR] }, paginas: { 'https://fonds.example.nl./': pagina('<p>ok</p>') } });
  const r2 = await safeFetchPublicPage('https://FONDS.Example.NL./', { resolveHost: o2.resolveHost, fetchImpl: o2.fetchImpl, timeoutMs: 500 });
  check('hoofdletters en afsluitende punt: gewoon hostnaam voor DNS', r2.ok === true && o2.calls.dns[0] === 'fonds.example.nl');
}

sectie('5. Redirects: elke hop opnieuw gevalideerd');
{
  const basis = { 'fonds.example.nl': [OPENBAAR], 'tweede.example.nl': [OPENBAAR2], 'derde.example.nl': [OPENBAAR], 'vierde.example.nl': [OPENBAAR], 'vijfde.example.nl': [OPENBAAR], 'intern.example.nl': ['10.0.0.9'], 'gemengd.example.nl': [OPENBAAR, '127.0.0.1'] };
  const hop = (naar, status = 302) => ({ status, location: naar, body: null });
  const doe = async (paginas, opties = {}) => {
    const o = omgeving({ dns: basis, paginas });
    const r = await safeFetchPublicPage('https://fonds.example.nl/start', { resolveHost: o.resolveHost, fetchImpl: o.fetchImpl, timeoutMs: 800, ...opties });

    return { r, o };
  };

  let t = await doe({ 'https://fonds.example.nl/start': hop('https://tweede.example.nl/doel'), 'https://tweede.example.nl/doel': pagina('<p>Doelpagina</p>') });
  check('publiek -> publiek', t.r.ok === true && t.r.redirects === 1 && t.r.eindUrl === 'https://tweede.example.nl/doel' && t.r.bronUrl === 'https://fonds.example.nl/start');
  check('  DNS is voor de tweede hop opnieuw gedaan', JSON.stringify(t.o.calls.dns) === JSON.stringify(['fonds.example.nl', 'tweede.example.nl']));

  for (const status of [301, 302, 303, 307, 308]) {
    t = await doe({ 'https://fonds.example.nl/start': hop('https://tweede.example.nl/doel', status), 'https://tweede.example.nl/doel': pagina('<p>x</p>') });
    check(`redirectstatus ${status} wordt gevolgd`, t.r.ok === true && t.r.redirects === 1);
  }

  t = await doe({ 'https://fonds.example.nl/start': hop('/nieuw/pad?x=1#anker'), 'https://fonds.example.nl/nieuw/pad?x=1': pagina('<p>relatief</p>') });
  check('relatieve Location', t.r.ok === true && t.r.eindUrl === 'https://fonds.example.nl/nieuw/pad?x=1');

  t = await doe({ 'https://fonds.example.nl/start': hop('//tweede.example.nl/protocolrelatief'), 'https://tweede.example.nl/protocolrelatief': pagina('<p>x</p>') });
  check('protocol-relatieve Location wordt https en opnieuw gevalideerd', t.r.ok === true && t.o.calls.dns.includes('tweede.example.nl'));

  const doelen = [
    'https://localhost/', 'https://localhost./geheim', 'https://127.0.0.1/', 'https://127.1/', 'https://0x7f.1/', 'https://2130706433/', 'https://[::1]/',
    'https://[::ffff:127.0.0.1]/', 'https://169.254.169.254/latest/meta-data/', 'https://169.254.1.1/', 'https://10.0.0.1/', 'https://172.16.0.1/',
    'https://192.168.0.1/', 'https://100.64.0.1/', 'https://[fe80::1]/', 'https://[fd00::1]/', 'https://[fc00::1]/', 'https://[fd00:ec2::254]/',
    'https://metadata.google.internal/', 'https://intranet/', 'https://printer.local/',
    'https://user:pw@tweede.example.nl/', 'https://tweede.example.nl:8443/', 'http://tweede.example.nl/', 'ftp://tweede.example.nl/', 'file:///etc/passwd',
    'javascript:alert(1)', 'data:text/html,x',
    // hostnaam is openbaar, maar DNS wijst naar privé
    'https://intern.example.nl/', 'https://gemengd.example.nl/',
  ];

  for (const doel of doelen) {
    const fetchVoor = {};
    t = await doe({ 'https://fonds.example.nl/start': hop(doel), [doel]: pagina('<p>GEHEIM interne pagina</p>') });
    check(`publiek -> ${doel}: redirect_blocked`, t.r.ok === false && t.r.fout === 'redirect_blocked', JSON.stringify(t.r.fout ?? 'ok'));
    check(`  daarna geen tweede fetch (${doel})`, t.o.calls.fetch.length === 1, String(t.o.calls.fetch.length));
  }

  t = await doe({ 'https://fonds.example.nl/start': { status: 302, body: null } });
  check('redirect zonder Location: redirect_blocked', t.r.ok === false && t.r.fout === 'redirect_blocked');

  t = await doe({ 'https://fonds.example.nl/start': hop('https://tweede.example.nl/a'), 'https://tweede.example.nl/a': hop('https://fonds.example.nl/start') });
  check('redirectlus A -> B -> A: redirect_loop', t.r.ok === false && t.r.fout === 'redirect_loop', JSON.stringify(t.r.fout));

  t = await doe({ 'https://fonds.example.nl/start': hop('https://fonds.example.nl/start') });
  check('redirect naar zichzelf: redirect_loop', t.r.ok === false && t.r.fout === 'redirect_loop');

  const keten = {
    'https://fonds.example.nl/start': hop('https://tweede.example.nl/1'), 'https://tweede.example.nl/1': hop('https://derde.example.nl/2'),
    'https://derde.example.nl/2': hop('https://vierde.example.nl/3'), 'https://vierde.example.nl/3': hop('https://vijfde.example.nl/4'), 'https://vijfde.example.nl/4': pagina('<p>einde</p>'),
  };

  t = await doe(keten);
  check('4 redirects bij een maximum van 3: too_many_redirects', t.r.ok === false && t.r.fout === 'too_many_redirects' && t.o.calls.fetch.length === 4, `${t.r.fout} ${t.o.calls.fetch.length}`);

  t = await doe(keten, { maxRedirects: 4 });
  check('maximum 4: dezelfde keten slaagt', t.r.ok === true && t.r.redirects === 4);

  t = await doe({ ...keten, 'https://vierde.example.nl/3': pagina('<p>derde hop is de laatste</p>') });
  check('precies 3 redirects (standaardmaximum) is toegestaan', t.r.ok === true && t.r.redirects === 3);

  t = await doe({ 'https://fonds.example.nl/start': { status: 302, location: 'https://tweede.example.nl/doel', body: 'redirect', contentType: 'text/html' }, 'https://tweede.example.nl/doel': pagina('<p>x</p>') });
  check('redirect met body wordt zonder die body afgehandeld', t.r.ok === true);

  // Een runtime die de Location verbergt (opaque redirect) kan niet worden gevalideerd: fail closed
  const o = omgeving({ dns: basis });
  const opaque = async () => { const res = new Response(null, { status: 200 }); Object.defineProperty(res, 'type', { value: 'opaqueredirect' }); return res; };
  const r = await safeFetchPublicPage('https://fonds.example.nl/start', { resolveHost: o.resolveHost, fetchImpl: opaque, timeoutMs: 300 });
  check('opaqueredirect (Location onzichtbaar): redirect_blocked', r.ok === false && r.fout === 'redirect_blocked');
}

klaar('SSRF');
