// Dashboardtellers voor de beheerconsole. Eén RPC, bewust ruimer dan de
// huidige dashboardkaarten tonen, zodat dit later niet opnieuw hoeft.
// Alleen leesbaar voor beheerders (afgedwongen in de database, niet hier).
import { query } from '../client.js';

export async function fetchAdminDashboardCounts() {
  const res = await query((sb) => sb.rpc('admin_dashboard_counts'), null);
  const row = Array.isArray(res.data) ? res.data[0] : res.data;

  return { data: row || null, error: res.error };
}
