// Vervangt src/data/client.js in de tests: een programmeerbare nep-Supabase.
// Elke aanroep wordt onthouden. Alles behalve functions.invoke is een
// SCHRIJF-/LEESPAD dat in deze flow nooit gebruikt hoort te worden; die
// aanroepen worden apart geteld zodat de tests dat kunnen afdwingen.
export let supabase = null;
export const isConfigured = true;

export const log = { invoke: [], andere: [], profielLees: 0 };

export function __reset() {
  log.invoke.length = 0;
  log.andere.length = 0;
  log.profielLees = 0;
}

export function __zetSupabase(volgende) {
  supabase = volgende;
}

// Maakt een nep-client. `antwoord(naam, opties)` geeft { data, error } terug.
// `profielen` (optioneel): functie die het profiel teruggeeft voor een LEZING van
// public.profiles (select().eq().single()). Schrijven blijft een fout.
export function maakClient(antwoord, profielen) {
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
    from: (tabel) => {
      if (tabel === 'profiles' && typeof profielen === 'function') {
        const keten = {
          select: () => keten,
          eq: () => keten,
          single: async () => {
            log.profielLees += 1;
            return { data: profielen(), error: null };
          },
          update: () => { log.andere.push('profiles.update'); throw new Error('ONVERWACHTE schrijfactie op profiles'); },
          upsert: () => { log.andere.push('profiles.upsert'); throw new Error('ONVERWACHTE schrijfactie op profiles'); },
          insert: () => { log.andere.push('profiles.insert'); throw new Error('ONVERWACHTE schrijfactie op profiles'); },
          delete: () => { log.andere.push('profiles.delete'); throw new Error('ONVERWACHTE schrijfactie op profiles'); },
        };

        return keten;
      }

      return spion('from')(tabel);
    },
    rpc: spion('rpc'),
    auth: spion('auth'),
    storage: spion('storage'),
  };
}

export async function query(fn, fallback = null) {
  return { data: fallback, error: null, offline: true };
}
