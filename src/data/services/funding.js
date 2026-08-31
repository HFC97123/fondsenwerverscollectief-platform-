// Aantal fondsen en regelingen in de database.
// Eén RPC-aanroep, één keer per sessie, gedeeld door de hele site.
//
// funders/subsidieregelingen hebben bewust geen directe SELECT-rechten voor
// anon/authenticated (RLS + ontbrekende grants; de content zelf loopt via
// de aparte, tier-bewuste views/RPC's). Een telling per tabel rechtstreeks
// bevragen (zoals hier eerder gebeurde) levert daardoor altijd een
// 'permission denied'-fout op en de teller blijft voor iedereen op '…'
// staan. publieke_fondsen_telling() is een SECURITY DEFINER-functie in de
// database die uitsluitend de twee totalen teruggeeft (geen rijen, geen
// premium-inhoud) en waarvoor anon/authenticated wel EXECUTE-rechten hebben.
import { useEffect, useState } from 'react';
import { query, supabase } from '../client.js';

export async function fetchFundingCount() {
  const res = await query(async (sb) => {
    const { data, error } = await sb.rpc('publieke_fondsen_telling').single();

    if (error) {
      return { data: null, error };
    }

    const totaal = Number(data?.funders_totaal || 0) + Number(data?.regelingen_totaal || 0);

    return { data: totaal };
  }, null);

  return res.data && res.data > 0 ? res.data : null;
}

let cache = null;
let pending = null;
const listeners = new Set();

export function useFundingCount() {
  const [count, setCount] = useState(cache);

  useEffect(() => {
    if (cache !== null) {
      return undefined;
    }

    const onDone = (v) => setCount(v);

    listeners.add(onDone);

    if (!pending) {
      pending = fetchFundingCount().then((v) => {
        cache = v;
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
    // Tijdens laden en bij een fout een liggend ellipsteken, nooit een 0.
    label: typeof count === 'number' && count > 0 ? count.toLocaleString('nl-NL') : '…',
  };
}
