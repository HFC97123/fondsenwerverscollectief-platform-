// Aantal aangesloten fondsenwervers (leden) voor de teller op de homepage.
// Eén RPC-aanroep, één keer per sessie, gedeeld door de hele site (zelfde
// patroon als funding.js).
//
// public.profiles is niet leesbaar voor bezoekers (RLS). publieke_leden_telling()
// is een SECURITY DEFINER-functie die uitsluitend één getal teruggeeft
// (role = 'member' en status = 'approved'; geen rijen, geen profielgegevens)
// en waarvoor anon/authenticated wel EXECUTE-rechten hebben.
import { useEffect, useState } from 'react';
import { query } from '../client.js';

// Geeft het aantal terug, of null bij laden/fout/geen configuratie.
export async function fetchMemberCount() {
  const res = await query(async (sb) => {
    const { data, error } = await sb.rpc('publieke_leden_telling');

    if (error) {
      return { data: null, error };
    }

    const n = Number(data);

    return Number.isFinite(n) && n >= 0 ? { data: n } : { data: null, error: new Error('ongeldige telling') };
  }, null);

  return typeof res.data === 'number' ? res.data : null;
}

let cache = null;
let pending = null;
const listeners = new Set();

export function useMemberCount() {
  const [count, setCount] = useState(cache);

  useEffect(() => {
    if (cache !== null) {
      return undefined;
    }

    const onDone = (v) => setCount(v);

    listeners.add(onDone);

    if (!pending) {
      pending = fetchMemberCount().then((v) => {
        // Bij een fout niet cachen: een volgende pagina mag het opnieuw proberen.
        cache = v;
        pending = null;
        listeners.forEach((fn) => fn(v));

        return v;
      });
    }

    return () => {
      listeners.delete(onDone);
    };
  }, []);

  return {
    count,
    loading: count === null,
    // Tijdens laden en bij een fout een liggend ellipsteken, nooit een nep-0.
    label: typeof count === 'number' ? count.toLocaleString('nl-NL') : '…',
  };
}
