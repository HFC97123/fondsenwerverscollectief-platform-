// De begroting en het dekkingsplan als Excel, in de huisstijl van het lid. Eén plek, voor het tabblad Begroting, de lijst van Projectdocumentatie en de definitieve versies.
// Dezelfde berekening als het scherm: begrotingsregels -> berekenBudget -> generateExcelDocument; de dekking komt uit de financieringsregels van het project.
import { downloadBlob } from '../../../shared/export/exportBestand.js';
import { haalExportThema } from '../../../shared/export/exportService.js';
import { dekkingVanProject } from '../financiering/dekkingsplan.js';
import { haalFinancieringVoorExport } from '../financiering/exportFinanciering.js';
import { berekenBegroting, expenseLinesVoorExcel, leesBudgetRegels } from './begrotingModel.js';

// project: het project (zoals in de winkel, met budgetRegels); finRegels: de financieringsregels (regelUitRpc-vorm) of null (dan alleen de begroting).
// regels: de schermregels, als het scherm nog niet-opgeslagen regels heeft; anders komen ze uit project.budgetRegels.
export async function maakBegrotingExcel({ project, finRegels = null, regels = null, organisatieNaam = null, theme = null }) {
  const [{ berekenBudget }, { generateExcelDocument, bepaalExcelBestandsnaam }] = await Promise.all([import('../../../shared/budget/berekenBudget.js'), import('../../../shared/budget/generateExcelDocument.js')]);
  const rijen = regels || leesBudgetRegels(project && project.budgetRegels);
  const totaal = berekenBegroting(rijen).totaalGeld;
  const p = { ...(project || {}), begroting: totaal > 0 ? Math.round(totaal) : project ? project.begroting : 0 };
  const fin = Array.isArray(finRegels) ? { regels: finRegels, dekking: dekkingVanProject(p, finRegels), metPlanning: true } : undefined;
  const budget = berekenBudget(expenseLinesVoorExcel(rijen), p, {}, fin);
  const blob = await generateExcelDocument({ budget, project: p, organizationName: organisatieNaam, ...(theme ? { theme } : {}) });

  return { blob, bestandsnaam: bepaalExcelBestandsnaam({ project: p, organizationName: organisatieNaam }) };
}

// Het huidige concept: financiering vers uit de database, huisstijl van het lid (Premium: eigen, anders Subsidie Kompas).
export async function downloadBegrotingConcept({ project, regels = null, organisatieNaam = null }) {
  const fin = await haalFinancieringVoorExport(project);
  const theme = await haalExportThema();
  const { blob, bestandsnaam } = await maakBegrotingExcel({ project, finRegels: fin.beschikbaar ? fin.regels : null, regels, organisatieNaam, theme });

  downloadBlob(blob, bestandsnaam);

  return bestandsnaam;
}

// Een definitieve versie: alles komt uit de vaste kopie; alleen de huisstijl is die van nu.
export async function downloadBegrotingDefinitief({ inhoud, organisatieNaam = null }) {
  const theme = await haalExportThema();
  const { blob, bestandsnaam } = await maakBegrotingExcel({ project: inhoud.project, finRegels: Array.isArray(inhoud.finRegels) ? inhoud.finRegels : null, organisatieNaam, theme });

  downloadBlob(blob, bestandsnaam);

  return bestandsnaam;
}
