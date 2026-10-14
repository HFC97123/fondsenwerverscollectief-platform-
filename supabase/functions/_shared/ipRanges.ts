// IP- en hostnamevalidatie voor de veilige bronophaler (Fase B1). Zuivere functies, geen netwerk, geen Deno-API's.
//
// Uitgangspunten
//   * Echte parsing, geen substringcontroles: IPv4 en IPv6 worden naar bytes geparseerd en per bereik vergeleken.
//   * Fail-closed: alles wat niet eenduidig als openbaar adres te herkennen is, is verboden.
//   * IPv6 wordt als ALLOWLIST behandeld: alleen globaal unicast 2000::/3 (minus de gedocumenteerde speciale blokken) is openbaar.
//     Daarmee vallen ::, ::1, ::ffff:0:0/96 (IPv4-mapped), 64:ff9b::/96 (NAT64), fc00::/7, fe80::/10, fec0::/10 en ff00::/8 vanzelf af.
//   * IP-literals zijn als hostnaam in zijn geheel verboden (ook openbare): een bron die we verifiëren heeft een gewone domeinnaam
//     met een certificaat. Dat sluit ook alle vreemde schrijfwijzen (decimaal, hex, octaal, verkort) uit, ongeacht of de runtime ze
//     zelf al naar de dotted-vorm omzet.

export type IpOordeel = { openbaar: true } | { openbaar: false; reden: string };

// ---------------------------------------------------------------------------------------------------------------------------
// IPv4

// Alleen de strikte vorm a.b.c.d met decimale octetten 0..255, zonder voorloopnullen (die zijn in sommige parsers octaal).
export function parseIPv4Strikt(s: string): number[] | null {
  if (typeof s !== 'string' || s.length < 7 || s.length > 15) return null;

  const delen = s.split('.');
  if (delen.length !== 4) return null;

  const uit: number[] = [];

  for (const d of delen) {
    if (!/^(0|[1-9]\d{0,2})$/.test(d)) return null;

    const n = Number(d);
    if (n > 255) return null;

    uit.push(n);
  }

  return uit;
}

function v4Zit(o: number[], basis: number[], prefix: number): boolean {
  let rest = prefix;

  for (let i = 0; i < 4 && rest > 0; i++) {
    const bits = Math.min(8, rest);
    const mask = (0xff << (8 - bits)) & 0xff;

    if ((o[i] & mask) !== (basis[i] & mask)) return false;

    rest -= bits;
  }

  return true;
}

// [basis, prefix, naam]
const V4_VERBODEN: Array<[number[], number, string]> = [
  [[0, 0, 0, 0], 8, 'dit-netwerk-0/8'],
  [[10, 0, 0, 0], 8, 'prive-10/8'],
  [[100, 64, 0, 0], 10, 'carrier-grade-nat-100.64/10'],
  [[127, 0, 0, 0], 8, 'loopback-127/8'],
  [[169, 254, 0, 0], 16, 'link-local-169.254/16 (o.a. metadata-endpoints)'],
  [[172, 16, 0, 0], 12, 'prive-172.16/12'],
  [[192, 0, 0, 0], 24, 'ietf-protocol-192.0.0/24'],
  [[192, 0, 2, 0], 24, 'documentatie-192.0.2/24'],
  [[192, 88, 99, 0], 24, '6to4-relay-192.88.99/24'],
  [[192, 168, 0, 0], 16, 'prive-192.168/16'],
  [[198, 18, 0, 0], 15, 'benchmark-198.18/15'],
  [[198, 51, 100, 0], 24, 'documentatie-198.51.100/24'],
  [[203, 0, 113, 0], 24, 'documentatie-203.0.113/24'],
  [[224, 0, 0, 0], 4, 'multicast-224/4'],
  [[240, 0, 0, 0], 4, 'gereserveerd-240/4 (incl. 255.255.255.255)'],
];

export function beoordeelIPv4(o: number[]): IpOordeel {
  for (const [basis, prefix, naam] of V4_VERBODEN) {
    if (v4Zit(o, basis, prefix)) return { openbaar: false, reden: naam };
  }

  return { openbaar: true };
}

// ---------------------------------------------------------------------------------------------------------------------------
// IPv6

// -> 16 bytes of null. Zonder zone-id (%), zonder prefixlengte (/), zonder haakjes.
export function parseIPv6(s: string): number[] | null {
  if (typeof s !== 'string' || s.length < 2 || s.length > 45) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(s)) return null;
  if (s.includes(':::')) return null;

  const dubbel = s.split('::');
  if (dubbel.length > 2) return null;

  const naarGroepen = (deel: string): number[] | null => {
    if (deel === '') return [];

    const groepen = deel.split(':');
    const uit: number[] = [];

    for (let i = 0; i < groepen.length; i++) {
      const g = groepen[i];

      if (g.includes('.')) {
        // IPv4 in de staart is alleen toegestaan als laatste groep
        if (i !== groepen.length - 1) return null;

        const v4 = parseIPv4Strikt(g);
        if (!v4) return null;

        uit.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;

        uit.push(parseInt(g, 16));
      }
    }

    return uit;
  };

  const kop = naarGroepen(dubbel[0]);
  if (!kop) return null;

  let groepen: number[];

  if (dubbel.length === 2) {
    const staart = naarGroepen(dubbel[1]);
    if (!staart) return null;

    const gat = 8 - kop.length - staart.length;
    if (gat < 1) return null;

    groepen = [...kop, ...new Array(gat).fill(0), ...staart];
  } else {
    groepen = kop;
  }

  if (groepen.length !== 8) return null;

  const bytes: number[] = [];

  for (const g of groepen) bytes.push((g >> 8) & 0xff, g & 0xff);

  return bytes;
}

function v6Prefix(b: number[], basis: number[], prefix: number): boolean {
  let rest = prefix;

  for (let i = 0; i < 16 && rest > 0; i++) {
    const bits = Math.min(8, rest);
    const mask = (0xff << (8 - bits)) & 0xff;

    if ((b[i] & mask) !== (basis[i] & mask)) return false;

    rest -= bits;
  }

  return true;
}

const v6 = (...groepen: number[]): number[] => {
  const uit: number[] = [];

  for (const g of groepen) uit.push((g >> 8) & 0xff, g & 0xff);

  while (uit.length < 16) uit.push(0);

  return uit;
};

// Speciale blokken BINNEN 2000::/3 die niet openbaar zijn.
const V6_VERBODEN_IN_GLOBAAL: Array<[number[], number, string]> = [
  [v6(0x2001, 0x0000), 23, 'ietf-protocol-2001::/23 (o.a. Teredo, benchmarking, ORCHID)'],
  [v6(0x2001, 0x0db8), 32, 'documentatie-2001:db8::/32'],
  [v6(0x2002), 16, '6to4-2002::/16 (bevat een ingebed IPv4-adres)'],
  [v6(0x3fff), 20, 'documentatie-3fff::/20'],
];

export function beoordeelIPv6(b: number[]): IpOordeel {
  // IPv4-mapped (::ffff:a.b.c.d) altijd verbieden, ook als het ingebedde adres openbaar lijkt: een resolver hoort dit niet te geven.
  const gemapt = b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff;
  if (gemapt) return { openbaar: false, reden: 'ipv4-mapped-::ffff:0:0/96' };

  if (b.every((x) => x === 0)) return { openbaar: false, reden: 'ongespecificeerd-::' };
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return { openbaar: false, reden: 'loopback-::1' };

  // Allowlist: alleen globaal unicast 2000::/3
  if ((b[0] & 0xe0) !== 0x20) {
    if ((b[0] & 0xfe) === 0xfc) return { openbaar: false, reden: 'unique-local-fc00::/7 (incl. fd00::/8)' };
    if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return { openbaar: false, reden: 'link-local-fe80::/10' };
    if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return { openbaar: false, reden: 'site-local-fec0::/10' };
    if (b[0] === 0xff) return { openbaar: false, reden: 'multicast-ff00::/8' };

    return { openbaar: false, reden: 'buiten-globaal-unicast-2000::/3' };
  }

  for (const [basis, prefix, naam] of V6_VERBODEN_IN_GLOBAAL) {
    if (v6Prefix(b, basis, prefix)) return { openbaar: false, reden: naam };
  }

  return { openbaar: true };
}

// Beoordeel een IP-tekst zoals een resolver die teruggeeft. Onleesbaar = verboden.
export function beoordeelIp(ip: string): IpOordeel {
  if (typeof ip !== 'string') return { openbaar: false, reden: 'geen-tekst' };

  const t = ip.trim();
  const v4 = parseIPv4Strikt(t);

  if (v4) return beoordeelIPv4(v4);

  const b6 = parseIPv6(t);

  if (b6) return beoordeelIPv6(b6);

  return { openbaar: false, reden: 'onleesbaar-ip-adres' };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Hostnamen

const VERBODEN_SUFFIXEN = [
  'localhost', 'local', 'internal', 'intranet', 'lan', 'home', 'corp', 'localdomain', 'home.arpa', 'arpa',
  'svc', 'cluster.local', 'test', 'example', 'invalid', 'onion',
];

// Namen van bekende metadata-diensten (naast .internal en de link-local adressen)
const METADATA_HOSTS = ['metadata', 'metadata.google.internal', 'metadata.goog', 'instance-data', 'metadata.tencentyun.com'];

export type HostOordeel = { toegestaan: true; host: string } | { toegestaan: false; reden: string };

// Beoordeelt de hostnaam zoals die uit de URL-parser komt (kleine letters, punycode). Een afsluitende punt wordt genormaliseerd.
export function beoordeelHostnaam(hostRuw: string): HostOordeel {
  if (typeof hostRuw !== 'string' || hostRuw === '') return { toegestaan: false, reden: 'lege-hostnaam' };

  if (hostRuw.startsWith('[') || hostRuw.includes(':')) return { toegestaan: false, reden: 'ip-literal-ipv6' };

  let host = hostRuw.toLowerCase();

  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host === '' || host.endsWith('.') || host.includes('..')) return { toegestaan: false, reden: 'ongeldige-hostnaam' };
  if (host.length > 253) return { toegestaan: false, reden: 'hostnaam-te-lang' };

  const labels = host.split('.');

  for (const l of labels) {
    if (l.length < 1 || l.length > 63 || !/^[a-z0-9-]+$/.test(l) || l.startsWith('-') || l.endsWith('-')) {
      return { toegestaan: false, reden: 'ongeldig-label' };
    }
  }

  if (labels.length < 2) return { toegestaan: false, reden: 'enkel-label-hostnaam (intern)' };

  const laatste = labels[labels.length - 1];

  // Numerieke of hex-achtige laatste label = een IP-schrijfwijze (decimaal, hex 0x.., octaal, verkort), nooit een domeinnaam.
  if (/^[0-9]+$/.test(laatste) || /^0x[0-9a-f]*$/.test(laatste)) return { toegestaan: false, reden: 'ip-literal-ipv4-schrijfwijze' };

  if (parseIPv4Strikt(host)) return { toegestaan: false, reden: 'ip-literal-ipv4' };

  // De TLD moet alfabetisch zijn of punycode (xn--)
  if (!/^[a-z]{2,63}$/.test(laatste) && !/^xn--[a-z0-9-]+$/.test(laatste)) return { toegestaan: false, reden: 'ongeldige-tld' };

  for (const s of VERBODEN_SUFFIXEN) {
    if (host === s || host.endsWith('.' + s)) return { toegestaan: false, reden: `gereserveerd-of-intern-domein-.${s}` };
  }

  if (METADATA_HOSTS.includes(host)) return { toegestaan: false, reden: 'metadata-endpoint' };

  return { toegestaan: true, host };
}
