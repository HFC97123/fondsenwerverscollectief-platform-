// Nep-Supabase voor de browsertest van de homepage-statistiektegel. Hergebruikt de
// nagebootste client van de beheertabellen, maar levert de RPC's uit window.__RPC:
//   publieke_ledenwaardering  -> fixture of 'fout'
//   publieke_leden_telling    -> getal
//   publieke_fondsen_telling  -> { funders_totaal, regelingen_totaal }
// Elke aanroep wordt in window.__RPCLOG bijgehouden (controle op dubbele calls).
import { supabase as basis } from '../../beheer-tabellen/fakeclient.js';

export const isConfigured = true;

const maak = (data, error) => {
  const p = Promise.resolve({ data, error });

  p.single = () => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error });

  return p;
};

export const supabase = {
  ...basis,
  rpc: (naam, args) => {
    (window.__RPCLOG = window.__RPCLOG || []).push({ naam, args });
    const f = (window.__RPC || {})[naam];

    if (f === 'fout') {
      return maak(null, new Error('rpc-fout'));
    }

    return maak(f === undefined ? null : f, null);
  },
};

export async function query(fn, fb = null) {
  try {
    const res = await fn(supabase);

    return res && res.error ? { data: fb, error: res.error } : res;
  } catch (e) {
    return { data: fb, error: e };
  }
}
