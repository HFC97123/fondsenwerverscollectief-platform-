// Compositiehook voor de rechter contextkolom. ALLEEN LEZEN:
//   - gebruikt de bestaande store (projecten, organisatieprofiel) en de bestaande funding-hook
//     (kompas_dekkingsplan); er is geen nieuwe bron, geen eigen opslag en geen localStorage;
//   - ontvangt uitsluitend het gevalideerde project-id van het gesprek (geen projectobject);
//   - stuurt niets naar askKompas: dit is weergave, geen modelcontext.
// Een fout in de funding-bron geeft status 'fout' voor dat blok; de chat blijft ongemoeid.
import { useMemo } from 'react';
import { useKompas } from '../KompasStore.jsx';
import { useProjectFinanciering } from '../financiering/useProjectFinanciering.js';
import { projectVoorWeergave } from './actiefProject.js';
import { bouwContextPanel } from './contextPanelData.js';

export function useProjectContextPanel({ projectId, actief = true }) {
  const store = useKompas();
  const project = useMemo(() => projectVoorWeergave({ gekoppeldProjectId: projectId, projecten: store.projects }), [projectId, store.projects]);
  // Altijd aanroepen (hooks); zonder project of zonder recht doet dit niets.
  const financiering = useProjectFinanciering(actief && project ? project.id : null);
  const regels = financiering.status === 'klaar' ? financiering.regels : null;

  return useMemo(
    () =>
      bouwContextPanel({
        project,
        regels,
        fundingStatus: financiering.status,
        orgProfile: store.orgProfile,
        nu: new Date(),
      }),
    [project, regels, financiering.status, store.orgProfile],
  );
}
