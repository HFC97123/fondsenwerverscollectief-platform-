// Toevoegen aan projectfinanciering: de ENE use-case voor "voeg deze regeling of dit fonds toe aan een project".
// Gebruikt door de toevoegdialoog op Deadlines en de fondsenkaart in de chat. Daarnaast één pad voor een financier op naam
// (een fonds dat niet in onze database staat): voegOnlineToeAanProjectfinanciering, via voegFinancierToe.
//
// Wat hier bewust NIET gebeurt: namen, deadlines of bedragen van de bron kopiëren. Er gaat alleen een
// verwijzing (scheme_id óf funder_id) plus het optionele gevraagde bedrag en de startstatus de database in.
// De database blijft leidend voor eigenaarschap (RLS + samengestelde FK) en voor dubbele regels (unieke index);
// de controles hier zijn alleen voor een vriendelijke melding.
import { getDeadlineAccess } from '../../../data/services/deadlines.js';
import { isEchtId } from '../../../data/services/projecten.js';
import { haalDekkingsplan, voegFinancierToe, voegRegelToe } from '../../../data/services/projectFinanciering.js';
import { leesBedragInvoer } from './dekkingsplan.js';

export const STARTSTATUS = 'interesting';

// Alleen eigen, niet-gearchiveerde, opgeslagen projecten (store.projects bevat alleen projecten van het lid).
export function toevoegbareProjecten(projecten) {
  return (projecten || []).filter((p) => p && !p.gearchiveerd && isEchtId(p.id));
}

// Een rij van de Deadlines-pagina -> { type: 'regeling'|'fonds', id, naam, funder } of null.
// Alleen volledig zichtbare bronnen (de database heeft die voor dit abonnement al vrijgegeven); een
// vergrendelde rij en een rij zonder geldig database-id kunnen niet worden toegevoegd.
export function bronUitDeadlineRij(rij) {
  if (!rij || getDeadlineAccess(rij) !== 'free') {
    return null;
  }

  const fonds = rij.bronType === 'funder';
  const id = fonds ? rij.funderId : rij.id;

  if (!isEchtId(String(id || ''))) {
    return null;
  }

  return { type: fonds ? 'fonds' : 'regeling', id: String(id), naam: rij.naam || '', funder: fonds ? '' : rij.funder || '' };
}

// Staat deze bron al in het dekkingsplan van het project? true / false, of null als dat niet te zien is
// (geen verbinding): de database blokkeert een dubbele regel sowieso.
export async function staatAlInProjectfinanciering(projectId, bron) {
  if (!isEchtId(projectId) || !bron) {
    return null;
  }

  const res = await haalDekkingsplan(projectId);

  if (res.error || !Array.isArray(res.regels)) {
    return null;
  }

  return res.regels.some((r) => (bron.type === 'fonds' ? r.funder_id === bron.id : r.scheme_id === bron.id));
}

// -> { ok: true, id, projectId } | { ok: false, reden: 'geen-project' | 'geen-bron' | 'ongeldig-bedrag' | 'bestaat-al' | 'geen-sessie' | 'fout' }
export async function voegToeAanProjectfinanciering({ projectId, bron, bedragTekst = '', projecten }) {
  if (!toevoegbareProjecten(projecten).some((p) => p.id === projectId)) {
    return { ok: false, reden: 'geen-project' };
  }

  if (!bron || !isEchtId(String(bron.id || '')) || (bron.type !== 'regeling' && bron.type !== 'fonds')) {
    return { ok: false, reden: 'geen-bron' };
  }

  const bedrag = leesBedragInvoer(bedragTekst);

  if (!bedrag.ok) {
    return { ok: false, reden: 'ongeldig-bedrag' };
  }

  const res = await voegRegelToe({
    projectId,
    schemeId: bron.type === 'regeling' ? bron.id : null,
    funderId: bron.type === 'fonds' ? bron.id : null,
    requested: bedrag.waarde,
    status: STARTSTATUS,
  });

  return res.ok ? { ok: true, id: res.id, projectId } : { ok: false, reden: res.reden || 'fout' };
}

// Naam waaronder een fonds zonder database-id in het dekkingsplan komt: "Gever - Regeling", of alleen de naam.
export function naamVoorOnlineFinancier(bron) {
  const naam = String((bron && bron.naam) || '').trim();
  const gever = String((bron && bron.funder) || '').trim();

  return (gever && naam && gever !== naam ? `${gever} - ${naam}` : naam || gever).slice(0, 200);
}

const vergelijkNaam = (v) => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Een fonds dat niet in onze database staat (bijvoorbeeld uit het onderzoek van Subsidie Kompas) op naam toevoegen, met startstatus
// Interessant, zonder bedrag. De bronlink gaat mee als notitie. Staat er al een regel op naam met dezelfde naam, dan 'bestaat-al'.
// -> { ok: true, id, projectId } | { ok: false, reden: 'geen-project' | 'geen-bron' | 'bestaat-al' | 'geen-sessie' | 'fout' | ... }
export async function voegOnlineToeAanProjectfinanciering({ projectId, bron, projecten, voegToe = voegFinancierToe, haal = haalDekkingsplan }) {
  if (!toevoegbareProjecten(projecten).some((p) => p.id === projectId)) {
    return { ok: false, reden: 'geen-project' };
  }

  const naam = naamVoorOnlineFinancier(bron);

  if (!naam) {
    return { ok: false, reden: 'geen-bron' };
  }

  try {
    const huidig = await haal(projectId);
    const namen = [naam, String((bron && bron.naam) || '')].map(vergelijkNaam).filter(Boolean);

    if (!huidig.error && Array.isArray(huidig.regels) && huidig.regels.some((r) => r && !r.scheme_id && !r.funder_id && namen.includes(vergelijkNaam(r.bron_naam || r.financier_naam)))) {
      return { ok: false, reden: 'bestaat-al' };
    }
  } catch (e) {
    // Niet te controleren: gewoon toevoegen.
  }

  const url = String((bron && bron.url) || '');
  const res = await voegToe({
    projectId,
    naam,
    status: STARTSTATUS,
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(String((bron && bron.deadline) || '')) ? bron.deadline : null,
    notitie: /^https:\/\//i.test(url) ? `Bron: ${url}` : '',
  });

  return res && res.ok ? { ok: true, id: res.id, projectId } : { ok: false, reden: (res && res.reden) || 'fout' };
}
