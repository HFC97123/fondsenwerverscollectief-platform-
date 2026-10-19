// Is de aanvraag-assistent er voor dit lid, en hoeveel ruimte is er deze maand? De server beslist: de functie antwoordt 404 zolang ze uit staat en 403
// zonder Pro of Premium. In die gevallen blijft de app precies zoals ze was (geen tabbladen, geen knoppen).
import { useCallback, useEffect, useRef, useState } from 'react';
import { haalAssistentStatus } from '../../../data/services/aanvraagAssistent.js';

export function useAanvraagAssistent(actief) {
  const [status, setStatus] = useState(null);
  const [klaar, setKlaar] = useState(false);
  const levend = useRef(true);

  const ververs = useCallback(async () => {
    const r = await haalAssistentStatus();

    if (!levend.current) return;

    // Een mislukte verversing laat de eerder bekende stand staan; alleen de eerste keer bepaalt of de functie er is.
    if (r.ok) setStatus(r.antwoord);

    setKlaar(true);
  }, []);

  useEffect(() => {
    levend.current = true;

    if (actief) ververs();
    else setKlaar(true);

    return () => {
      levend.current = false;
    };
  }, [actief, ververs]);

  return { beschikbaar: Boolean(status && status.ok), status, klaar, ververs };
}
