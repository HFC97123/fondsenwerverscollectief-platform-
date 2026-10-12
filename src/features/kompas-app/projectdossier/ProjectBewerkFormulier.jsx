// Projectgegevens bewerken, in het projectdossier (tab Overzicht) op de plek waar de gegevens staan.
// Dit is het compacte formulier (NieuwProjectFormulier, modus 'bewerk'): precies dezelfde velden als bij een nieuw
// project. De uitgebreide inhoud (doelstellingen, activiteiten, impact, planning, ...) beheert u als Projectinformatie
// op de pagina Documenten; cofinanciers en financiering staan in de tab Projectfinanciering.
// Dit bestand regelt alleen de toestand en het opslaan; niet-getoonde projectvelden blijven ongemoeid (we werken op
// een kopie van het hele project, dus er gaat niets verloren).
import React, { useEffect, useState } from 'react';
import { haalClassificatiesOp } from '../../../data/services/classificaties.js';
import NieuwProjectFormulier from '../NieuwProjectFormulier.jsx';
import { valideerEnBereidOp } from '../projectOpslaan.js';

export default function ProjectBewerkFormulier({ project, store, onKlaar, onAnnuleer }) {
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(project)));
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  // Doelgroep en discipline gebruiken dezelfde centrale classificatielijsten als het organisatieprofiel.
  const [lijsten, setLijsten] = useState({ doelgroepen: [], themas: [], regios: [] });

  useEffect(() => {
    let actief = true;

    haalClassificatiesOp().then((lijst) => {
      if (actief) {
        setLijsten({ doelgroepen: lijst.doelgroepen || [], themas: lijst.themas || [], regios: lijst.regios || [] });
      }
    });

    return () => {
      actief = false;
    };
  }, []);

  const setVeld = (key, val) => {
    setForm((cur) => ({ ...cur, [key]: val }));
    setFout('');
  };

  const opslaan = () => {
    const klaar = valideerEnBereidOp(form);

    if (!klaar.ok) {
      setFout(klaar.fout);

      return;
    }

    setFout('');
    setBezig(true);

    // Lukt het bewaren in de database niet, dan zeggen we dat ook; het formulier blijft dan open.
    Promise.resolve(store.saveProject(klaar.project)).then((id) => {
      setBezig(false);

      if (id === null) {
        setFout('Het project kon niet in de database worden opgeslagen. Probeer het opnieuw.');

        return;
      }

      onKlaar('Projectgegevens opgeslagen.');
    });
  };

  return (
    <NieuwProjectFormulier
      modus="bewerk"
      form={form}
      setVeld={setVeld}
      doelgroepen={lijsten.doelgroepen}
      themas={lijsten.themas}
      regios={lijsten.regios}
      fout={fout}
      bezig={bezig}
      onOpslaan={opslaan}
      onAnnuleer={onAnnuleer}
    />
  );
}
