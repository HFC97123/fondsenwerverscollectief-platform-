// Zet een inline CSS-string om naar een React-style-object.
// Hiermee blijven de declaraties uit het goedgekeurde ontwerp letterlijk staan.
export function css(str) {
  const out = {};

  String(str)
    .split(';')
    .forEach((part) => {
      const i = part.indexOf(':');

      if (i < 0) {
        return;
      }

      let prop = part.slice(0, i).trim();
      const val = part.slice(i + 1).trim();

      if (!prop) {
        return;
      }

      if (prop.startsWith('--')) {
        out[prop] = val;

        return;
      }

      prop = prop.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      out[prop] = val;
    });

  return out;
}

// Voegt CSS-strings samen en laat lege waarden vallen.
// cx('padding: 4px', actief && 'color: red')
export function cx(...delen) {
  return delen.filter(Boolean).join('; ');
}
