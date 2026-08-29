// Aantal fondsen en regelingen in de database.
// Eén query per tabel, één keer per sessie, gedeeld door de hele site.
import { useEffect, useState } from 'react';
import { query, supabase } from '../client.js';

export const FUNDS_TABLES = ['funders', 'subsidieregelingen'];

// Achtereenvolgens geprobeerd; bestaat de kolom niet, dan de volgende variant.
const ACTIVE_FILTERS = [
  (q) => q.eq('is_active', true),
  (q) => q.eq('active', true),
  (q) => q.eq('published', true),
  (q) => q.in('status', ['Gepubliceerd', 'gepubliceerd', 'Actief', 'actief', 'Open', 'open']),
  (q) => q,
];

async function countTable(table) {
  for (const filter of ACTIVE_FILTERS) {
    const res = await filter(supabase.from(table).select('id', { count: 'exact', head: true }));

    if (!res.error) {
      return res.count || 0;
    }

    const msg = String(res.error.message || '');

    if (msg.indexOf('column') === -1 && msg.indexOf('does not exist') === -1) {
      throw res.error;
    }
  }

  return 0;
}

export async function fetchFundingCount() {
  const res = await query(async () => {
    let totaal = 0;

    for (const table of FUNDS_TABLES) {
      totaal += await countTable(table);
    }

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
