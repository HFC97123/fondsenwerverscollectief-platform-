// Testdubbel voor data/client.js in de Node-tests: een in-memory Supabase met storage + RPC.
// De test zet globalThis.__SB (state + log + faalschakelaars) voor elke case.
const sb = () => globalThis.__SB;

export const supabase = {
  storage: {
    from: (bucket) => ({
      upload: async (pad, file, opties) => {
        sb().log.push({ op: 'upload', bucket, pad, opties });
        if (sb().faal === 'upload') return { data: null, error: new Error('upload mislukt') };
        sb().objecten.add(pad);
        return { data: { path: pad }, error: null };
      },
      remove: async (paden) => {
        sb().log.push({ op: 'remove', bucket, paden });
        if (sb().faal === 'remove') throw new Error('remove mislukt');
        paden.forEach((p) => sb().objecten.delete(p));
        return { data: paden, error: null };
      },
      createSignedUrl: async (pad, sec) => {
        sb().log.push({ op: 'signed', bucket, pad, sec });
        if (!sb().objecten.has(pad)) return { data: null, error: new Error('niet gevonden') };
        return { data: { signedUrl: `https://x.supabase.co/sign/${pad}?t=${sb().log.length}` }, error: null };
      },
    }),
  },
  rpc: async (naam, args) => {
    sb().log.push({ op: 'rpc', naam, args });
    if (sb().faal === 'rpc') return { data: null, error: new Error('rpc mislukt') };
    return { data: null, error: null };
  },
};
export async function query(fn, fb = null) { try { return await fn(supabase); } catch (e) { return { data: fb, error: e }; } }
