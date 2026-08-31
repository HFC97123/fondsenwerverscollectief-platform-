// Leestoegang tot classification_audit_log, alleen voor beheerders
// (afgedwongen door admin_list_audit_log in de database). Dit is bewust een
// simpel activiteitenoverzicht — geen review-wachtrij, geen bulk-workflow.
import { query } from '../client.js';

export async function fetchAuditLog({ tabel = null, page = 0, pageSize = 30 } = {}) {
  const res = await query(
    (sb) => sb.rpc('admin_list_audit_log', { p_tabel: tabel, p_limit: pageSize, p_offset: page * pageSize }),
    [],
  );

  const rows = res.data || [];
  const total = rows.length ? Number(rows[0].total_count) || rows.length : 0;

  return { rows, total, error: res.error };
}
