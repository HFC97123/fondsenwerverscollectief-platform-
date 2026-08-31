// Schrijven van abonnement, rol en status van een gebruiker loopt uitsluitend
// via deze drie SECURITY DEFINER RPC's — nooit via een rechtstreekse
// supabase.from('profiles').update(...). Lezen van de ledenlijst blijft zoals
// het was (profiles heeft al een SELECT-policy voor beheerders); alleen de
// writes zijn hier samengebracht.
import { query } from '../client.js';

export async function setSubscription(userId, tier, active) {
  const res = await query((sb) =>
    sb.rpc('admin_set_subscription', { p_user_id: userId, p_tier: tier, p_active: active }),
  );

  return { error: res.error };
}

export async function setRole(userId, role) {
  const res = await query((sb) => sb.rpc('admin_set_role', { p_user_id: userId, p_role: role }));

  return { error: res.error };
}

export async function setStatus(userId, status) {
  const res = await query((sb) => sb.rpc('admin_set_status', { p_user_id: userId, p_status: status }));

  return { error: res.error };
}
