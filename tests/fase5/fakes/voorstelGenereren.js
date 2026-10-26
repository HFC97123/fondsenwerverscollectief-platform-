// Nep voor de server-opslag (alleen acties).
export const opslagLog = [];
export const gedrag = { antwoord: { ok: true, antwoord: { ok: true, actieplan: { status: 'klaar', aangemaakt: 4 } } } };
export async function vraagVoorstelOpslaan(arg) { opslagLog.push(JSON.parse(JSON.stringify(arg))); return gedrag.antwoord; }
