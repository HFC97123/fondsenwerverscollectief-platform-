// Documenten › Projectplan: een ontbrekend onderdeel van de voortgangsmeter meteen invullen, op de plek zelf.
// Elk onderdeel wijst naar het bestaande veld en schrijft via dezelfde opslagfuncties als het projectformulier,
// het projectinformatiepaneel en het organisatieprofiel. Er komt dus geen tweede opslag bij: wat u hier invult,
// staat daarna ook op die andere plekken.
import React, { useEffect, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button, ClassificatieSelect, veldStijl } from '../../../shared/ui/index.js';
import { haalClassificatiesOp } from '../../../data/services/classificaties.js';
import { bewaarOrganisatieVelden } from '../../../data/services/organisatieprofiel.js';
import { schrijfPaneel } from '../projectinformatie/projectinformatie.js';
import { valideerEnBereidOp } from '../projectOpslaan.js';

// id van het meteronderdeel -> waar en hoe het wordt ingevuld.
//   project: veld op het project (tekst, getal of lijst)
//   info:    veld in de projectdocumentatie (zelfde sleutel als in projectinformatie.js)
//   org:     veld in het organisatieprofiel
export const INVULVELDEN = {
  aanleiding: { soort: 'info', veld: 'aanleiding', type: 'tekst', rijen: 4 },
  doelgroep: { soort: 'project', veld: 'doelgroep', type: 'lijst' },
  werkgebied: { soort: 'project', veld: 'regio', type: 'regel', hint: 'Bijvoorbeeld: Amsterdam, Landelijk of Utrecht en Flevoland' },
  doelstelling: { soort: 'project', veld: 'doelstellingen', type: 'tekst', rijen: 3 },
  activiteiten: { soort: 'project', veld: 'activiteiten', type: 'tekst', rijen: 3 },
  resultaat: { soort: 'project', veld: 'impact', type: 'tekst', rijen: 3 },
  planning: { soort: 'project', veld: 'planning', type: 'tekst', rijen: 3 },
  organisatie: { soort: 'org', veld: 'name', type: 'regel' },
  missie: { soort: 'org', veld: 'mission', type: 'tekst', rijen: 3 },
  begroting: { soort: 'project', veld: 'begroting', type: 'bedrag', hint: 'Bedrag in euro, bijvoorbeeld 25000' },
  borging: { soort: 'info', veld: 'borging', type: 'tekst', rijen: 3 },
};

const alsLijst = (w) => (Array.isArray(w) ? w : w ? [w] : []);

export function kanInvullen(onderdeelId) {
  return Object.prototype.hasOwnProperty.call(INVULVELDEN, onderdeelId);
}

export default function MeterInvullen({ onderdeel, project, store, onOpgeslagen, onAnnuleer }) {
  const def = INVULVELDEN[onderdeel.id];
  const [waarde, setWaarde] = useState(def.type === 'lijst' ? [] : '');
  const [doelgroepen, setDoelgroepen] = useState([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  useEffect(() => {
    if (def.type !== 'lijst') return undefined;

    let actief = true;

    haalClassificatiesOp().then((lijst) => {
      if (actief) setDoelgroepen(lijst.doelgroepen || []);
    });

    return () => {
      actief = false;
    };
  }, [def.type]);

  const leeg = def.type === 'lijst' ? alsLijst(waarde).length === 0 : String(waarde).trim() === '';

  const mislukt = () => {
    setFout('Opslaan lukte niet. Probeer het opnieuw.');
    setBezig(false);
  };

  const opslaan = async () => {
    if (leeg || bezig) return;

    setBezig(true);
    setFout('');

    try {
      if (def.soort === 'org') {
        const tekst = String(waarde).trim();
        const res = await bewaarOrganisatieVelden({ [def.veld]: tekst }, 'handmatig');

        if (res.error) return mislukt();

        // Houdt het scherm van het organisatieprofiel gelijk; het bewaart dezelfde waarde nog eens, dat is onschadelijk.
        if (store && typeof store.setOrgField === 'function') store.setOrgField(def.veld, tekst);
      } else if (def.soort === 'info') {
        const id = await Promise.resolve(store.saveProject(schrijfPaneel(project, { [def.veld]: String(waarde).trim() })));

        if (id === null) return mislukt();
      } else {
        const nieuw = def.type === 'lijst' ? alsLijst(waarde) : def.type === 'bedrag' ? String(waarde).trim().replace(',', '.') : String(waarde).trim();
        const klaar = valideerEnBereidOp({ ...project, [def.veld]: nieuw });

        if (!klaar.ok) {
          setFout(klaar.fout);
          setBezig(false);

          return undefined;
        }

        const id = await Promise.resolve(store.saveProject(klaar.project));

        if (id === null) return mislukt();
      }
    } catch (e) {
      return mislukt();
    }

    setBezig(false);
    onOpgeslagen(onderdeel);

    return undefined;
  };

  const testid = `aa-invul-${onderdeel.id}`;

  return (
    <form
      data-testid={`${testid}-form`}
      onSubmit={(ev) => {
        ev.preventDefault();
        opslaan();
      }}
      style={css('margin: 8px 0 4px; padding: 12px; border: 1px solid #DDE7E2; border-radius: 12px; background: #F7FAF8;')}
    >
      <div className="fwk-aa-klein" style={css('margin-bottom: 6px;')}>{onderdeel.vraag}</div>

      {def.type === 'lijst' && (
        <ClassificatieSelect opties={doelgroepen} waarde={alsLijst(waarde)} onChange={(n) => setWaarde(n)} multi placeholder="Selecteer doelgroep(en)" ariaLabel={onderdeel.label} />
      )}

      {def.type === 'tekst' && (
        <textarea data-testid={testid} aria-label={onderdeel.label} value={waarde} onChange={(ev) => setWaarde(ev.target.value)} rows={def.rijen || 3} style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical' }} />
      )}

      {(def.type === 'regel' || def.type === 'bedrag') && (
        <input
          data-testid={testid}
          aria-label={onderdeel.label}
          inputMode={def.type === 'bedrag' ? 'decimal' : undefined}
          value={waarde}
          onChange={(ev) => setWaarde(ev.target.value)}
          placeholder={def.hint || ''}
          style={veldStijl}
          autoComplete="off"
        />
      )}

      {fout && (
        <div role="alert" data-testid={`${testid}-fout`} className="fwk-aa-klein" style={css('margin-top: 6px; color: #B3261E;')}>
          {fout}
        </div>
      )}

      <div style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;')}>
        <Button size="s" variant="dark" type="submit" disabled={leeg || bezig}>
          {bezig ? 'Opslaan…' : 'Opslaan'}
        </Button>
        <Button size="s" variant="outline" type="button" onClick={onAnnuleer}>
          Annuleer
        </Button>
      </div>
    </form>
  );
}
