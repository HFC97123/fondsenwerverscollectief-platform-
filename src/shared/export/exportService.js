// src/shared/export/exportService.js
//
// De ene exportlaag voor Subsidie Kompas: "bestaande data -> bestaande
// exportlaag -> gekozen bestandsformaat". De aanroeper levert een
// `bouwModel()`-functie (zie exportModel.js) die de gegevens van PRECIES de
// huidige context ophaalt; deze service
//   1. controleert eerst de rechten (vers uit de database, niet alleen de UI),
//   2. bouwt het model,
//   3. genereert Word / PDF / Excel met de bestaande generatoren,
//   4. biedt het bestand aan als download.
// Er is geen aparte code per pagina meer: alle pagina's gebruiken <ExportMenu>
// (shared/ui/ExportMenu.jsx), dat uitsluitend deze service aanroept.
import { supabase } from '../../data/client.js';
import { haalProfiel, tierVan } from '../../data/services/profile.js';
import { haalBudgetUitTekst } from '../../data/services/chat.js';
import { bouwBestandsnaam, downloadBlob } from './exportBestand.js';

export const EXPORT_FORMATEN = {
  docx: { id: 'docx', label: 'Word (.docx)', kort: 'Word', extensie: 'docx' },
  xlsx: { id: 'xlsx', label: 'Excel (.xlsx)', kort: 'Excel', extensie: 'xlsx' },
  pdf: { id: 'pdf', label: 'PDF (.pdf)', kort: 'PDF', extensie: 'pdf' },
};

// Fout met een tekst die rechtstreeks aan het lid getoond mag worden.
export class ExportFout extends Error {
  constructor(bericht) {
    super(bericht);
    this.name = 'ExportFout';
  }
}

/**
 * Export is een Pro-/Premium-functie (Admin heeft altijd toegang) - dezelfde
 * regel als overal in de app (tierVan() in profile.js, gelijk aan
 * current_user_has_pro_access() in de database). Hier wordt het profiel VERS
 * uit de database gelezen (RLS: alleen het eigen profiel), zodat een
 * aangepaste browserstatus of een verlopen sessie nooit genoeg is. Zonder
 * backend-configuratie (lokale modus) beslist alleen de UI.
 */
export async function controleerExportRechten() {
  if (!supabase) {
    return { toegestaan: true };
  }

  let userId = null;

  try {
    const { data } = await supabase.auth.getUser();

    userId = data?.user?.id || null;
  } catch (e) {
    userId = null;
  }

  if (!userId) {
    return { toegestaan: false, reden: 'U bent niet meer ingelogd. Log opnieuw in om te exporteren.' };
  }

  const profiel = await haalProfiel(userId, { vers: true });

  if (!profiel) {
    return { toegestaan: false, reden: 'Uw abonnement kon niet worden gecontroleerd. Probeer het opnieuw.' };
  }

  const tier = tierVan(profiel);

  if (profiel.role === 'admin' || tier === 'pro' || tier === 'premium') {
    return { toegestaan: true };
  }

  return { toegestaan: false, reden: 'Exporteren is beschikbaar met een Pro- of Premium-abonnement.' };
}

// Begrotingsdocumenten houden hun bestaande Excel-route (tekst ->
// haalBudgetUitTekst (Edge Function, alleen Pro/Premium) -> berekenBudget ->
// generateExcelDocument). Dit is de code die eerder dubbel in
// KompasToolPage.exporteerAlsExcel en DocumentatiePage.downloadExcelDocument
// stond, 1-op-1 samengevoegd; berichten en gedrag zijn ongewijzigd.
async function begrotingExcel({ tekst, project, organisatieNaam }, onStatus) {
  onStatus?.('Begroting wordt geanalyseerd...');

  const { budget: ruwBudget, error: extractieFout } = await haalBudgetUitTekst({ tekst });

  if (extractieFout || !ruwBudget) {
    throw new ExportFout(extractieFout || 'De begroting kon niet worden geanalyseerd. Probeer het opnieuw.');
  }

  const { berekenBudget } = await import('../budget/berekenBudget.js');
  const { generateExcelDocument, bepaalExcelBestandsnaam } = await import('../budget/generateExcelDocument.js');
  const budget = berekenBudget(ruwBudget.expenseLines, project, ruwBudget.meta);
  const bruikbareRegels = budget.expenseLines.filter((r) => r.bedrag != null).length;

  if (bruikbareRegels === 0) {
    throw new ExportFout(
      'Er is geen enkele bruikbare kostenregel gevonden in deze begroting. Werk de begroting verder uit en probeer het daarna opnieuw.',
    );
  }

  const blob = await generateExcelDocument({ budget, project, organizationName: organisatieNaam });

  return {
    blob,
    bestandsnaam: bepaalExcelBestandsnaam({ project, organizationName: organisatieNaam }),
    extraMelding: budget.totals.isSluitend
      ? ''
      : ' Let op: deze begroting is nog niet sluitend - het verschil staat duidelijk op het tabblad Dekkingsplan.',
  };
}

/**
 * Voert één export uit.
 * @param {Object} opties
 * @param {'docx'|'xlsx'|'pdf'} opties.formaat
 * @param {() => Promise<Object>|Object} opties.bouwModel  Haalt de gegevens van de huidige context op en geeft een exportmodel (exportModel.js)
 * @param {(tekst: string) => void} [opties.onStatus]
 * @returns {Promise<{ bestandsnaam: string, melding: string }>}
 */
export async function voerExportUit({ formaat, bouwModel, onStatus }) {
  const fmt = EXPORT_FORMATEN[formaat];

  if (!fmt) {
    throw new ExportFout('Onbekend exportformaat.');
  }

  const rechten = await controleerExportRechten();

  if (!rechten.toegestaan) {
    throw new ExportFout(rechten.reden);
  }

  let model;

  try {
    model = await bouwModel();
  } catch (e) {
    model = null;
  }

  if (!model) {
    throw new ExportFout('De gegevens om te exporteren konden niet worden opgehaald. Probeer het opnieuw.');
  }

  try {
    let blob;
    let bestandsnaam = bouwBestandsnaam(model.bestandsDelen, fmt.extensie);
    let extraMelding = '';
    const kern = {
      title: model.titel,
      documentType: model.documentType || undefined,
      organizationName: model.organisatieNaam || null,
      content: { blocks: model.blocks },
      themeName: model.themeName,
    };

    if (formaat === 'docx') {
      // De bestaande Word-generator (Document Theme Engine), ongewijzigd.
      const { generateWordDocument } = await import('../document-theme/generateWordDocument.js');

      blob = await generateWordDocument(kern);
    } else if (formaat === 'pdf') {
      // Pas hier geladen: pdfmake zit niet in de hoofdbundel.
      const { generatePdfDocument } = await import('./generatePdfDocument.js');

      blob = await generatePdfDocument(kern);
    } else if (model.budgetBron) {
      const resultaat = await begrotingExcel(
        { tekst: model.budgetBron.tekst, project: model.budgetBron.project, organisatieNaam: model.organisatieNaam },
        onStatus,
      );

      ({ blob, bestandsnaam, extraMelding } = resultaat);
    } else {
      const { generateStructuredExcel } = await import('./generateStructuredExcel.js');

      blob = await generateStructuredExcel(model, { themeName: model.themeName });
    }

    downloadBlob(blob, bestandsnaam);

    return { bestandsnaam, melding: `${fmt.kort}-bestand wordt gedownload.${extraMelding}` };
  } catch (e) {
    if (e instanceof ExportFout) {
      throw e;
    }

    throw new ExportFout(`Het genereren van het ${fmt.kort}-bestand is niet gelukt. Probeer het opnieuw.`);
  }
}
