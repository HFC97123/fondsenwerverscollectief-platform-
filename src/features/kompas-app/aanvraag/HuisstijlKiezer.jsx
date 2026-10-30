// De keuze van de huisstijl op de plek waar u een document maakt of downloadt (bij het schrijven van het projectplan en bij het samenvoegen).
//   - Pro: altijd de Subsidie Kompas-huisstijl (vast).
//   - Premium: Subsidie Kompas, geen huisstijl of de eigen huisstijl. De eigen huisstijl uploadt u hier ter plekke, of in het Organisatieprofiel: het is dezelfde huisstijl.
// De huisstijl wordt pas bij het downloaden op het document gezet, dus u kunt hem ook nog kiezen of uploaden nadat u een kopie definitief hebt gemaakt.
import React, { useEffect, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { haalHuisstijl } from '../../../data/services/huisstijl.js';
import HuisstijlPaneel from '../HuisstijlPaneel.jsx';

const KLEIN = "font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.5; color: #4B5C58;";
const KEUZES = ['standaard', 'geen', 'eigen'];

// De laatste keuze blijft in het geheugen van deze sessie; er wordt niets in de browser bewaard.
let onthoudenKeuze = null;

export function useHuisstijlKeuze(premium, laad = haalHuisstijl) {
  const [keuze, setKeuze] = useState(() => onthoudenKeuze || 'standaard');
  const [eigen, setEigen] = useState(null); // null = nog laden; false = geen eigen huisstijl; anders het object

  useEffect(() => {
    if (!premium) return undefined;

    let weg = false;

    Promise.resolve(laad()).then((h) => {
      if (weg) return;

      setEigen(h || false);

      // Heeft het lid een eigen huisstijl en nog nooit gekozen, dan is dat de vanzelfsprekende keuze.
      if (h && !onthoudenKeuze) setKeuze('eigen');
    });

    return () => {
      weg = true;
    };
  }, [premium, laad]);

  const zet = (k) => {
    onthoudenKeuze = KEUZES.includes(k) ? k : null;
    setKeuze(KEUZES.includes(k) ? k : 'standaard');
  };

  return { keuze, zet, eigen, setEigen, gebruikt: premium ? (keuze === 'eigen' && !eigen ? 'standaard' : keuze) : 'standaard' };
}

export default function HuisstijlKiezer({ premium, hs, organisatieNaam = '', laad = haalHuisstijl, testid = 'huisstijl-kiezer', bewaar, lees, uitDocument }) {
  const [open, setOpen] = useState(false);
  const [bericht, setBericht] = useState('');

  if (!premium) {
    return (
      <span data-testid={`${testid}-vast`} title="Bij Pro krijgen uw documenten de Subsidie Kompas-huisstijl. Met Premium kunt u ook zonder huisstijl of in uw eigen huisstijl." style={css(KLEIN)}>
        Huisstijl: Subsidie Kompas
      </span>
    );
  }

  const heeftEigen = Boolean(hs.eigen);
  const paneelProps = { premium: true, compact: true, organisatieNaam, laad, ...(bewaar ? { bewaar } : {}), ...(lees ? { lees } : {}), ...(uitDocument ? { uitDocument } : {}) };

  return (
    <div data-testid={`${testid}-blok`} style={css('display: grid; gap: 8px; min-width: 0;')}>
      <span style={css('display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;')}>
        <label style={css(`display: inline-flex; align-items: center; gap: 6px; ${KLEIN}`)}>
          Huisstijl
          <select
            data-testid={testid}
            aria-label="Huisstijl voor dit document"
            value={hs.keuze}
            onChange={(e) => {
              hs.zet(e.target.value);
              setBericht('');
            }}
            style={css("cursor: pointer; box-sizing: border-box; min-height: 34px; padding: 4px 10px; border: 1px solid #D5E0D9; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #2C4A5E;")}
          >
            <option value="standaard">Subsidie Kompas</option>
            <option value="geen">Geen huisstijl</option>
            <option value="eigen">{heeftEigen ? 'Mijn huisstijl' : 'Mijn huisstijl (nog niet ingesteld)'}</option>
          </select>
        </label>
        <Button variant="outline" size="s" onClick={() => setOpen((o) => !o)} testid={`${testid}-upload`} ariaLabel={heeftEigen ? 'Mijn huisstijl aanpassen' : 'Eigen huisstijl uploaden'}>
          {open ? 'Sluiten' : heeftEigen ? 'Mijn huisstijl aanpassen' : 'Eigen huisstijl uploaden'}
        </Button>
      </span>

      {hs.keuze === 'eigen' && !heeftEigen && !open && (
        <span data-testid={`${testid}-nog-niet`} style={css(KLEIN)}>
          Nog geen eigen huisstijl: Subsidie Kompas wordt gebruikt.
        </span>
      )}

      {bericht && (
        <span role="status" data-testid={`${testid}-bericht`} style={css(`${KLEIN} color: #2F6D47; font-weight: 700;`)}>
          {bericht}
        </span>
      )}

      {open && (
        <HuisstijlPaneel
          {...paneelProps}
          onBewaard={(h) => {
            hs.setEigen(h || false);
            hs.zet(h ? 'eigen' : 'standaard');
            setBericht(h ? 'Huisstijl bewaard en gekozen.' : 'Weer Subsidie Kompas.');
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
