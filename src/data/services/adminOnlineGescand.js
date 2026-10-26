// Beheer · werklijst "nieuw gescand door gebruik" (kompas_online_gescand). Alleen via de admin-RPC's (beheerder-only, SECURITY DEFINER).
import { query } from '../client.js';

export const GESCAND_STATUSSEN = [
  { value: 'nieuw', label: 'Nieuw' },
  { value: 'in_behandeling', label: 'In behandeling' },
  { value: 'opgenomen', label: 'Opgenomen' },
  { value: 'afgewezen', label: 'Afgewezen' },
  { value: 'dubbel', label: 'Dubbel' },
];

// -> { rijen, fout }
export async function haalOnlineGescand({ status = 'nieuw', zoek = '', limiet = 100 } = {}) {
  const res = await query((sb) => sb.rpc('admin_online_gescand_lijst', { p_status: status || null, p_zoek: zoek || null, p_limiet: limiet }), []);

  return { rijen: Array.isArray(res.data) ? res.data : [], fout: res.error ? 'De lijst kon niet worden geladen.' : '' };
}

// -> { telling: { nieuw: 3, ... }, fout }
export async function telOnlineGescand() {
  const res = await query((sb) => sb.rpc('admin_online_gescand_telling'), []);
  const telling = {};

  (Array.isArray(res.data) ? res.data : []).forEach((r) => {
    telling[r.review_status] = Number(r.aantal) || 0;
  });

  return { telling, fout: res.error ? 'De telling kon niet worden geladen.' : '' };
}

// -> { ok, fout }
export async function werkOnlineGescandBij({ id, status, notitie = null }) {
  const res = await query((sb) => sb.rpc('admin_online_gescand_bijwerken', { p_id: id, p_status: status, p_notitie: notitie }));

  return { ok: !res.error, fout: res.error ? 'Bijwerken is niet gelukt.' : '' };
}
