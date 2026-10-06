// Vervangt src/data/client.js in de tests: een programmeerbare nep-Supabase.
// Elke aanroep wordt onthouden. Alles behalve functions.invoke is een
// SCHRIJF-/LEESPAD dat in deze flow nooit gebruikt hoort te worden; die
// aanroepen worden apart geteld zodat de tests dat kunnen afdwingen.
export let supabase = null;
export const isConfigured = true;

export const log = { invoke: [], andere: [] };

export function __reset() {
  log.invoke.length = 0;
  log.andere.length = 0;
}

export function __zetSupabase(volgende) {
  supabase = volgende;
}

// Maakt een nep-client. `antwoord(naam, opties)` geeft { data, error } terug.
export function maakClient(antwoord) {
  const spion = (pad) => new Proxy(function () {}, {
    get: (_, p) => spion(`${pad}.${String(p)}`),
    apply: () => {
      log.andere.push(pad);
      throw new Error(`ONVERWACHTE Supabase-aanroep: ${pad}`);
    },
  });

  return {
    functions: {
      invoke: async (naam, opties) => {
        log.invoke.push({ naam, opties: JSON.parse(JSON.stringify(opties || {})) });
        return antwoord(naam, opties);
      },
    },
    from: spion('from'),
    rpc: spion('rpc'),
    auth: spion('auth'),
    storage: spion('storage'),
  };
}

export async function query(fn, fallback = null) {
  return { data: fallback, error: null, offline: true };
}
