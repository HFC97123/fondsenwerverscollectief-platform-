// React-haak voor de opgeslagen taken van het actieplan (één of meer projecten). Alle gegevens komen uit de database;
// er is hier geen eigen opslag en geen localStorage. Een mislukte wijziging laat de staat ongemoeid en haalt opnieuw op.
import { useCallback, useEffect, useRef, useState } from 'react';
import { haalActies, verwijderActie, voegActieToe, werkActieBij } from '../../../data/services/projectActies.js';
import { isEchtId } from '../../../data/services/projecten.js';
import { pasActieWijzigingToe } from './actieplan.js';

// -> { status: 'laden' | 'klaar' | 'niet-beschikbaar' | 'fout', actieVoor(projectId), voegToe, wijzig, verwijder, laad }
export function useActieplan(projectIds) {
  const sleutel = (projectIds || []).filter(isEchtId).join(',');
  const [staat, setStaat] = useState({ status: 'laden', acties: [] });
  const actief = useRef(true);

  const laad = useCallback(() => {
    const ids = sleutel ? sleutel.split(',') : [];

    if (!ids.length) {
      setStaat({ status: 'klaar', acties: [] });

      return Promise.resolve();
    }

    return haalActies(ids).then((res) => {
      if (!actief.current) {
        return;
      }

      if (res.error === 'niet-beschikbaar') {
        setStaat({ status: 'niet-beschikbaar', acties: [] });
      } else if (res.error) {
        setStaat({ status: 'fout', acties: [] });
      } else {
        setStaat({ status: 'klaar', acties: res.acties });
      }
    });
  }, [sleutel]);

  useEffect(() => {
    actief.current = true;
    setStaat((cur) => ({ ...cur, status: 'laden' }));
    laad();

    return () => {
      actief.current = false;
    };
  }, [laad]);

  const voegToe = useCallback(async (invoer) => {
    const res = await voegActieToe(invoer);

    if (res.ok && actief.current) {
      setStaat((cur) => ({ ...cur, acties: cur.acties.concat([res.actie]) }));
    }

    return res;
  }, []);

  const wijzig = useCallback(
    async (id, wijziging) => {
      const res = await werkActieBij(id, wijziging);

      if (!actief.current) {
        return res;
      }

      if (res.ok) {
        setStaat((cur) => ({ ...cur, acties: cur.acties.map((a) => (a.id === id ? pasActieWijzigingToe(a, wijziging) : a)) }));
      } else {
        await laad();
      }

      return res;
    },
    [laad],
  );

  const verwijder = useCallback(
    async (id) => {
      const res = await verwijderActie(id);

      if (!actief.current) {
        return res;
      }

      if (res.ok) {
        setStaat((cur) => ({ ...cur, acties: cur.acties.filter((a) => a.id !== id) }));
      } else {
        await laad();
      }

      return res;
    },
    [laad],
  );

  const actieVoor = useCallback((projectId) => staat.acties.filter((a) => a.projectId === projectId), [staat.acties]);

  return { status: staat.status, actieVoor, voegToe, wijzig, verwijder, laad };
}
