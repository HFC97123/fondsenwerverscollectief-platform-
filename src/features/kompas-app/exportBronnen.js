// src/features/kompas-app/exportBronnen.js
//
// Koppelt de pagina's aan de gedeelde exportlaag (shared/export/). Elke
// functie hieronder geeft een `bouwModel`-functie voor <ExportMenu>: die haalt
// de gegevens van PRECIES de gekozen context op en zet ze om naar het
// gemeenschappelijke exportmodel. Project, document en gesprek worden daarbij
// opnieuw uit de database gelezen op id (met user_id-filter + RLS, zie
// projecten.js / gesprekken.js), dus nooit alleen op wat de frontend stuurt.
// Het organisatieprofiel wordt vers gelezen voor de ingelogde gebruiker zelf.
// Wat hier NIET gebeurt: andere projecten, andere organisaties of andere
// gesprekken worden nooit opgehaald of meegenomen.
import { supabase } from '../../data/client.js';
import { haalProjectVoorExport, haalDocumentVoorExport, isEchtId } from '../../data/services/projecten.js';
import { haalOrganisatieprofielOp } from '../../data/services/organisatieprofiel.js';
import { haalGesprekVoorExport } from '../../data/services/gesprekken.js';
import { berekenDekking } from './KompasStore.jsx';
import {
  bouwDocumentModel,
  bouwProjectModel,
  bouwOrganisatieModel,
  bouwGesprekModel,
} from '../../shared/export/exportModel.js';

const orgNaamUitStore = (store) => store?.orgProfile?.name || null;

// Een project: met backend altijd vers uit de database op id; zonder backend
// (lokale modus) het project uit de eigen sessie.
async function projectVers(projectId, store) {
  if (!projectId) {
    return null;
  }

  if (supabase) {
    return haalProjectVoorExport(projectId);
  }

  return (store?.projects || []).find((p) => p.id === projectId) || null;
}

/** Een AI-resultaat in de chat (tekst staat op het scherm; geen id nodig). */
export function chatDocumentExport({ tekst, soort, store, project, alsBegroting }) {
  return () =>
    bouwDocumentModel({
      tekst,
      soort,
      organisatieNaam: orgNaamUitStore(store),
      projectNaam: project?.naam || null,
      project: project || null,
      alsBegroting,
    });
}

/** Een bewaard projectdocument (Documenten): tekst en project vers op id. */
export function opgeslagenDocumentExport({ doc, store }) {
  return async () => {
    let tekst = doc.tekst;
    let soort = doc.soort;
    let project = null;

    if (supabase) {
      const vers = await haalDocumentVoorExport(doc.projectId, doc.id);

      if (!vers) {
        return null;
      }

      tekst = vers.tekst;
      soort = vers.soort;
      project = await projectVers(doc.projectId, store);
    } else {
      project = await projectVers(doc.projectId, store);
    }

    return bouwDocumentModel({
      tekst,
      soort,
      organisatieNaam: orgNaamUitStore(store),
      projectNaam: project?.naam || doc.projectNaam || null,
      project,
    });
  };
}

/** Eén project met financiering, co-financiers en gekoppelde regelingen. */
export function projectExport({ projectId, store }) {
  return async () => {
    const project = await projectVers(projectId, store);

    if (!project) {
      return null;
    }

    return bouwProjectModel(project, { organisatieNaam: orgNaamUitStore(store), dekking: berekenDekking(project) });
  };
}

/** Het organisatieprofiel van de ingelogde gebruiker. */
export function organisatieExport({ velden, store }) {
  return async () => {
    let profiel = null;

    if (supabase) {
      const res = await haalOrganisatieprofielOp();

      profiel = res ? res.profiel : null;
    } else {
      profiel = store?.orgProfile || null;
    }

    if (!profiel || !Object.keys(profiel).length) {
      return null;
    }

    return bouwOrganisatieModel(profiel, velden);
  };
}

/** Eén gesprek met tijdstippen; alleen van de ingelogde gebruiker. */
export function gesprekExport({ gesprekId, store }) {
  return async () => {
    if (!supabase || !isEchtId(gesprekId)) {
      return null;
    }

    const gesprek = await haalGesprekVoorExport(gesprekId);

    if (!gesprek) {
      return null;
    }

    const project = gesprek.projectId ? await projectVers(gesprek.projectId, store) : null;

    return bouwGesprekModel({
      titel: gesprek.titel,
      berichten: gesprek.berichten,
      projectNaam: project?.naam || null,
      organisatieNaam: orgNaamUitStore(store),
    });
  };
}
