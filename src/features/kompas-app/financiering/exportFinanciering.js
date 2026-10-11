// Financiering voor exports (Word/PDF/Excel) en de begrotingsexport. Dezelfde bron en dezelfde
// berekening als Dashboard, Projecten en Projectfinanciering: de regels komen uit
// kompas_dekkingsplan() (subsidie_kompas_program_funding) en de totalen uit dekkingVanProject().
// Er is hier geen eigen rekenlogica en geen tweede bron (het oude vrije-tekstveld cofinanciers telt niet).
import { haalDekkingsplan } from '../../../data/services/projectFinanciering.js';
import { isEchtId } from '../../../data/services/projecten.js';
import { dekkingVanProject, regelUitRpc } from './dekkingsplan.js';

// -> { regels: regelUitRpc[], dekking, beschikbaar }  (beschikbaar=false: geen sessie of niet geladen)
export async function haalFinancieringVoorExport(project) {
  let regels = [];
  let beschikbaar = false;

  if (project && isEchtId(project.id)) {
    const res = await haalDekkingsplan(project.id);

    if (!res.error) {
      regels = (res.regels || []).map(regelUitRpc);
      beschikbaar = true;
    }
  }

  return { regels, dekking: dekkingVanProject(project || {}, regels), beschikbaar };
}

// De financiering die meetelt in de dekking (status Toegekend of Aangevraagd) in de vorm die de
// begrotings-Excel verwacht: { naam, bedrag, status }. Toegekend telt het toegekende bedrag (terugval: het
// aangevraagde), Aangevraagd het aangevraagde bedrag; dit zijn dezelfde regels als berekenDekking(), zodat
// de zichtbare rijen optellen tot het totaal. Regels in andere statussen tellen niet mee en staan er niet in.
export function cofinanciersVoorBegroting(regels, statusLabel) {
  return (regels || [])
    .filter((r) => r && (r.status === 'awarded' || r.status === 'submitted'))
    .map((r) => ({
      naam: r.naam,
      bedrag: r.status === 'awarded' ? (r.awarded != null ? r.awarded : r.requested) : r.requested,
      status: (statusLabel && statusLabel[r.status]) || '',
    }))
    .filter((r) => r.bedrag != null);
}
