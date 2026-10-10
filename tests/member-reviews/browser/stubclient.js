// Testdubbel voor data/client.js: query() geeft de fixture uit window.__REVIEWS terug.
export const supabase = {};
export async function query(fn, fallback = null) {
  const f = window.__REVIEWS;
  if (f === 'fout') return { data: fallback, error: new Error('x'), offline: false };
  const sb = { rpc: async (naam, args) => { window.__RPC = { naam, args }; return { data: f, error: null }; } };
  try { const res = await fn(sb); return res && res.error ? { data: fallback, error: res.error } : { data: res && 'data' in res ? res.data : res, error: null }; } catch (e) { return { data: fallback, error: e }; }
}
