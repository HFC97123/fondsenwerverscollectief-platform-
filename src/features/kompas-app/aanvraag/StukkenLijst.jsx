// De checklist met stukken die een fonds vraagt (ANBI-status, statuten, jaarrekening, jaarverslag en wat het fonds extra vraagt).
// Een stuk dat al in de documentatie staat (projectdocumentatie of organisatieprofiel) wordt automatisch herkend. Wij bewaren geen bestanden hier: alleen de lijst, wat klaar is en welk bestand het lid koppelde.
// bewerken = true: de lijst zelf aanpassen (stukken weghalen en toevoegen); anders: afvinken, koppelen en 'niet van toepassing'.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Chip } from '../../../shared/ui/werkplek.jsx';
import { MAX_STUKKEN, nieuwStuk, stukStatus, telStukken } from './aanvraagModel.js';

const BRON_LABEL = { formulier: 'Uit uw formulier', website: 'Staat op de website van het fonds', standaard: 'Standaard', lid: 'Door u toegevoegd' };
const BRON_TOON = { formulier: 'blauw', website: 'blauw', standaard: 'grijs', lid: 'grijs' };
const STATUS = { klaar: ['groen', 'Klaar'], 'te-oud': ['oranje', 'Controleer'], nodig: ['grijs', 'Nog nodig'], nvt: ['grijs', 'Niet van toepassing'] };

export default function StukkenLijst({ stukken, docs = [], bewerken = false, uit = false, onWijzig, nu }) {
  const [nieuw, setNieuw] = useState('');
  const lijst = Array.isArray(stukken) ? stukken : [];
  const tel = telStukken(lijst, docs, nu);

  const zet = (id, patch) => onWijzig(lijst.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const weg = (id) => onWijzig(lijst.filter((s) => s.id !== id));
  const voegToe = () => {
    if (!nieuw.trim() || lijst.length >= MAX_STUKKEN) return;

    onWijzig([...lijst, nieuwStuk(lijst, nieuw)]);
    setNieuw('');
  };

  return (
    <div data-testid="aa-stukken">
      {!bewerken && (
        <div className="fwk-aa-klein" style={css('margin: 0 0 10px; font-weight: 800;')} data-testid="aa-stukken-telling">
          {tel.totaal === 0 ? 'Er zijn geen stukken nodig.' : `${tel.klaar} van ${tel.totaal} klaar`}
        </div>
      )}

      {lijst.length === 0 && <p className="fwk-aa-klein" style={css('margin: 0 0 10px;')}>De lijst is leeg. Voeg hieronder een stuk toe als het fonds er een vraagt.</p>}

      <ul className="fwk-wp-rijen">
        {lijst.map((s) => {
          const st = stukStatus(s, docs, nu);
          const [toon, label] = STATUS[st.status];
          const naam = s.tekst;

          return (
            <li key={s.id} className="fwk-wp-rij" style={css('grid-template-columns: minmax(0, 1fr); gap: 6px;')} data-testid="aa-stuk" data-status={st.status}>
              <div className="fwk-wp-rij-titel" style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center;')}>
                <span>{naam}</span>
                {bewerken ? <Chip toon={BRON_TOON[s.bron] || 'grijs'}>{BRON_LABEL[s.bron] || BRON_LABEL.lid}</Chip> : <Chip toon={toon}>{label}</Chip>}
                {!bewerken && s.bron !== 'standaard' && s.bron !== 'lid' && <Chip toon={BRON_TOON[s.bron]}>{BRON_LABEL[s.bron]}</Chip>}
              </div>

              {!bewerken && st.document && (
                <div className="fwk-wp-rij-sub">
                  In uw {st.document.bron === 'organisatie' ? 'organisatieprofiel' : 'projectdocumentatie'}: {st.document.naam}
                </div>
              )}
              {!bewerken && !st.document && st.status === 'klaar' && <div className="fwk-wp-rij-sub">U heeft dit stuk zelf als klaar gemarkeerd.</div>}
              {!bewerken && st.status === 'te-oud' && <div className="fwk-wp-rij-sub">{st.reden}</div>}
              {!bewerken && st.status === 'nodig' && s.maxLeeftijdMaanden && <div className="fwk-wp-rij-sub">Niet ouder dan {s.maxLeeftijdMaanden} maanden. Voeg het toe bij uw projectdocumentatie of organisatieprofiel, of vink het zelf af.</div>}

              <div style={css('display: flex; gap: 12px; flex-wrap: wrap; align-items: center;')}>
                {bewerken ? (
                  <button type="button" className="fwk-wp-link" disabled={uit} onClick={() => weg(s.id)} aria-label={`Haal weg: ${naam}`}>
                    Weghalen
                  </button>
                ) : (
                  <>
                    {st.status !== 'nvt' && !st.document && (
                      <label style={css('display: inline-flex; gap: 6px; align-items: center; font-size: 14px; cursor: pointer;')}>
                        <input type="checkbox" checked={Boolean(s.klaar)} disabled={uit} onChange={(e) => zet(s.id, { klaar: e.target.checked })} aria-label={`Ik heb dit klaar: ${naam}`} />
                        Ik heb dit klaar
                      </label>
                    )}
                    {st.status !== 'nvt' && docs.length > 0 && !(st.document && !s.documentNaam) && (
                      <select className="fwk-aa-veld" style={css('width: auto; min-height: 34px; font-size: 14px;')} disabled={uit} value={s.documentNaam || ''} aria-label={`Koppel een bestand aan ${naam}`} onChange={(e) => zet(s.id, { documentNaam: e.target.value })}>
                        <option value="">Koppel een bestand…</option>
                        {docs.map((d, i) => (
                          <option key={`${d.naam}-${i}`} value={d.naam}>
                            {d.naam}
                          </option>
                        ))}
                      </select>
                    )}
                    {st.status === 'nvt' ? (
                      <button type="button" className="fwk-wp-link" disabled={uit} onClick={() => zet(s.id, { nietVanToepassing: false })} aria-label={`Toch nodig: ${naam}`}>
                        Toch nodig
                      </button>
                    ) : (
                      <button type="button" className="fwk-wp-link" disabled={uit} onClick={() => zet(s.id, { nietVanToepassing: true })} aria-label={`Niet van toepassing: ${naam}`}>
                        Niet van toepassing
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {lijst.length < MAX_STUKKEN && (
        <div style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px;')}>
          <input className="fwk-aa-veld" style={css('flex: 1 1 200px; width: auto; min-height: 38px;')} aria-label="Eigen stuk toevoegen" maxLength={200} value={nieuw} disabled={uit} placeholder="Bijvoorbeeld: aanbevelingsbrief" onChange={(e) => setNieuw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), voegToe())} />
          <Button size="s" variant="outline" onClick={voegToe} disabled={uit || !nieuw.trim()}>
            + Stuk toevoegen
          </Button>
        </div>
      )}
    </div>
  );
}
