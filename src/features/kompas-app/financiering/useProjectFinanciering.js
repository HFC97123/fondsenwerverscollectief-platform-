// React-haken voor de projectfinanciering. Alle gegevens komen rechtstreeks uit de database
// (kompas_dekkingsplan); er is hier geen eigen opslag en geen localStorage. Dashboard en
// projectdossier lezen dezelfde bron en rekenen met dezelfde module (dekkingsplan.js).
import { useCallback, useEffect, useRef, useState } from 'react';
import { haalDekkingsplan, verwijderRegel, voegRegelToe, werkRegelBij } from '../../../data/services/projectFinanciering.js';
import { isEchtId } from '../../../data/services/projecten.js';
import { pasWijzigingToe, patchVoorDatabase, regelUitRpc } from './dekkingsplan.js';

const sorteer = (regels) =>
  regels.slice().sort((a, b) => {
    const da = a.deadline || '9999-12-31';
    const db = b.deadline || '9999-12-31';

    return da.localeCompare(db) || String(a.gemaakt || '').localeCompare(String(b.gemaakt || ''));
  });

// Meerdere projecten tegelijk (Dashboard). -> { status: 'laden'|'klaar'|'fout', fout, perProject: { [id]: regels[] } }
export function useDekkingsplannen(projectIds) {
  const sleutel = (projectIds || []).filter(isEchtId).join(',');
  const [staat, setStaat] = useState({ status: 'laden', fout: null, perProject: {} });

  useEffect(() => {
    let actief = true;
    const ids = sleutel ? sleutel.split(',') : [];

    if (!ids.length) {
      setStaat({ status: 'klaar', fout: null, perProject: {} });

      return undefined;
    }

    setStaat((cur) => ({ ...cur, status: 'laden' }));

    Promise.all(ids.map((id) => haalDekkingsplan(id).then((res) => ({ id, res })))).then((uit) => {
      if (!actief) {
        return;
      }

      const perProject = {};
      let fout = null;

      uit.forEach(({ id, res }) => {
        if (res.error) {
          fout = fout || res.error;
          perProject[id] = [];
        } else {
          perProject[id] = sorteer((res.regels || []).map(regelUitRpc));
        }
      });

      setStaat({ status: fout ? 'fout' : 'klaar', fout, perProject });
    });

    return () => {
      actief = false;
    };
  }, [sleutel]);

  return staat;
}

// Eén project, met wijzigen en verwijderen (projectdossier).
export function useProjectFinanciering(projectId) {
  const [staat, setStaat] = useState({ status: isEchtId(projectId) ? 'laden' : 'geen-database', fout: null, regels: [] });
  const actiefRef = useRef(true);

  const laad = useCallback(() => {
    if (!isEchtId(projectId)) {
      setStaat({ status: 'geen-database', fout: null, regels: [] });

      return Promise.resolve();
    }

    return haalDekkingsplan(projectId).then((res) => {
      if (!actiefRef.current) {
        return;
      }

      if (res.error) {
        setStaat({ status: 'fout', fout: res.error, regels: [] });
      } else {
        setStaat({ status: 'klaar', fout: null, regels: sorteer((res.regels || []).map(regelUitRpc)) });
      }
    });
  }, [projectId]);

  useEffect(() => {
    actiefRef.current = true;
    setStaat({ status: isEchtId(projectId) ? 'laden' : 'geen-database', fout: null, regels: [] });
    laad();

    return () => {
      actiefRef.current = false;
    };
  }, [projectId, laad]);

  // wijziging: { requested, awarded, status, eigenDeadline, reminder, notitie } (alleen wat verandert)
  const wijzig = useCallback(
    async (regelId, wijziging) => {
      const patch = patchVoorDatabase(wijziging);

      if (!Object.keys(patch).length) {
        return { ok: false };
      }

      const res = await werkRegelBij(regelId, patch);

      if (!actiefRef.current) {
        return res;
      }

      if (res.ok) {
        setStaat((cur) => ({ ...cur, regels: sorteer(cur.regels.map((r) => (r.id === regelId ? pasWijzigingToe(r, wijziging) : r))) }));

        // Een eigen deadline wissen of wijzigen: de effectieve deadline komt dan live van de bron
        // (regeling, ronde of fonds). Opnieuw ophalen voorkomt dat een oude brondatum blijft hangen.
        if (Object.prototype.hasOwnProperty.call(wijziging, 'eigenDeadline')) {
          await laad();
        }
      } else {
        await laad();
      }

      return res;
    },
    [laad],
  );

  const verwijder = useCallback(
    async (regelId) => {
      const res = await verwijderRegel(regelId);

      if (!actiefRef.current) {
        return res;
      }

      if (res.ok) {
        setStaat((cur) => ({ ...cur, regels: cur.regels.filter((r) => r.id !== regelId) }));
      } else {
        await laad();
      }

      return res;
    },
    [laad],
  );

  return { ...staat, laad, wijzig, verwijder, voegToe: voegRegelToe };
}
