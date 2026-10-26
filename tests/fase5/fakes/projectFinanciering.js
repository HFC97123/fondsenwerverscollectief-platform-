// Nep-fundingservice voor de kaarttests: houdt de regels in het geheugen bij.
export const staat = { regels: [], log: [] };
let teller = 0;

export function __reset() { staat.regels.length = 0; staat.log.length = 0; teller = 0; }

export async function voegRegelToe({ projectId, schemeId, funderId, requested, status }) {
  staat.log.push({ soort: 'regel', projectId, schemeId, funderId, requested, status });
  if (staat.regels.some((r) => (schemeId && r.scheme_id === schemeId) || (funderId && r.funder_id === funderId))) return { ok: false, reden: 'bestaat-al' };
  const id = `f-${++teller}`;
  staat.regels.push({ id, program_id: projectId, scheme_id: schemeId, funder_id: funderId, bron_naam: 'x', requested_amount: requested, status });
  return { ok: true, id };
}

export async function voegFinancierToe({ projectId, naam, bedrag = null, status = 'submitted', deadline = null, notitie = '' }) {
  staat.log.push({ soort: 'naam', projectId, naam, bedrag, status, deadline, notitie });
  const id = `f-${++teller}`;
  staat.regels.push({ id, program_id: projectId, scheme_id: null, funder_id: null, bron_naam: naam, financier_naam: naam, status, notes: notitie });
  return { ok: true, id };
}

export async function haalDekkingsplan() { return { error: null, regels: staat.regels.slice() }; }
export async function werkRegelBij() { return { ok: true }; }
export async function verwijderRegel() { return { ok: true }; }
