import pg from 'pg';
let client;
async function db() { if (!client) { client = new pg.Client({ host: '/var/tmp', port: 5544, user: 'postgres', database: 't' }); await client.connect(); } return client; }
export function createClient(url, key) {
  globalThis.__supabaseKeyUsed = key;
  return {
    async rpc(name, args) {
      globalThis.__rpcCalls.push(name);
      if (globalThis.__rpcFail && globalThis.__rpcFail(name)) return { data: null, error: { code: 'XX000' } };
      const c = await db();
      const keys = Object.keys(args);
      const params = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
      const vals = keys.map((k) => (args[k] !== null && typeof args[k] === 'object') ? JSON.stringify(args[k]) : args[k]);
      try {
        const r = await c.query(`select public.${name}(${params}) as r`, vals);
        return { data: r.rows[0].r, error: null };
      } catch (e) { return { data: null, error: { code: e.code || 'ERR', message: e.message } }; }
    },
  };
}
