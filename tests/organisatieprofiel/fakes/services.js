export const gedrag = { velden: { mission: 'Wij brengen jongeren samen via muziek.', kvk: '12345678', name: 'Stichting Ander' } };
export const aanroepen = [];
export async function extractOrganisatieVelden(arg) { aanroepen.push(arg); return { velden: gedrag.velden, error: null }; }
export async function analyseerWebsite() { return { velden: {}, paginas: [], error: null }; }
export async function extraheerTekst(file) { return file.__tekst || ''; }
let n = 0;
export async function haalOrganisatieDocumentenOp() { return []; }
export async function uploadOrganisatieDocument() { n += 1; return { id: `d${n}`, pad: `p${n}` }; }
export async function verwijderOrganisatieDocument() { return true; }
export const bronLabel = (t) => (t === 'document' ? 'uit een document' : t ? 'handmatig' : '');
