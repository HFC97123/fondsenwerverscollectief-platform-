// Het zoekprofiel bekijken, aanpassen en bevestigen ("Zoek passende fondsen"). Eén component voor beide routes: Projectfinanciering (gevuld met
// projectgegevens en documenten) en de chat (gevuld met het gesprek en het actieve project). De toestand en de regels staan in zoekprofielModel.js;
// de server (voorstel-zoekprofiel) stelt het profiel op en toetst het bevestigde profiel opnieuw aan de databasecategorieën.
// Dit scherm bepaalt nooit welke fondsen passen: het toont, laat aanpassen en stuurt het bevestigde profiel door.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { ClassificatieSelect, veldStijl } from '../../../shared/ui/index.js';
import { formatEuro } from './dekkingsplan.js';
import {
  LIJST_VELDEN,
  ONTBREKEND_LABEL,
  bronOverzicht,
  controleerProfiel,
  financieringTekst,
  heeftWijzigingen,
  koppelOnzeker,
  negeerOnzeker,
  neemVoorstelOver,
  zetLijst,
  zetTrefwoorden,
  zetVeld,
} from './zoekprofielModel.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const KLEIN = "font-family: 'Mulish', sans-serif; font-size: 12.5px; line-height: 1.5; color: #6D7C77;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const VELD_LABEL = "font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #2C4A5E;";
const KAART = 'box-sizing: border-box; padding: 20px 22px; border: 1px solid #CFE4D7; border-radius: 20px; background: #FFFFFF; display: flex; flex-direction: column; gap: 16px;';
const KNOP_PRIMAIR = "min-height: 44px; padding: 0 22px; border: none; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;";
const KNOP_STIL = "min-height: 44px; padding: 0 18px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;";
const KNOP_KLEIN = "min-height: 32px; padding: 0 12px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; cursor: pointer;";

const BRON_KLEUR = { project: '#2F7A4D', gesprek: '#2C4A5E', ai: '#8A5A16', gebruiker: '#5D6B67' };

function Melding({ soort, testId, children }) {
  const stijl = soort === 'fout' ? 'background: #FBE9E7; color: #9E3B2C;' : soort === 'info' ? 'background: #EEF4F8; color: #2C4A5E;' : 'background: #FBF1E3; color: #8A5A16;';

  return (
    <div role={soort === 'fout' ? 'alert' : 'status'} data-testid={testId} style={css(`${TEKST} font-size: 13.5px; padding: 10px 14px; border-radius: 12px; ${stijl}`)}>
      {children}
    </div>
  );
}

function Veld({ id, label, hulp, fout, ontbreekt, children }) {
  return (
    <div data-testid={`zp-veld-${id}`} data-ontbreekt={ontbreekt ? 'ja' : 'nee'} style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0;')}>
      <div style={css(VELD_LABEL)}>
        {label}
        {ontbreekt && <span style={css(`${KLEIN} margin-left: 8px; font-weight: 800; color: #8A5A16;`)}>nog aan te vullen</span>}
      </div>
      {hulp && <div style={css(KLEIN)}>{hulp}</div>}
      {children}
      {fout && (
        <div role="alert" data-testid={`zp-fout-${id}`} style={css(`${KLEIN} color: #9E3B2C; font-weight: 700;`)}>
          {fout}
        </div>
      )}
    </div>
  );
}

function BronRegel({ sleutel, items }) {
  const delen = bronOverzicht(items);

  if (!delen.length) return null;

  return (
    <div data-testid={`zp-bron-${sleutel}`} style={css(`${KLEIN} display: flex; flex-wrap: wrap; gap: 4px 12px;`)}>
      {delen.map((d) => (
        <span key={d.bron} data-bron={d.bron} style={css(`color: ${BRON_KLEUR[d.bron]};`)}>
          {d.label}: {d.namen.join(', ')}
        </span>
      ))}
    </div>
  );
}

// state: de toestand uit zoekprofielModel; onChange(nieuweState). lijsten: { themas, doelgroepen, regios } (classificaties) of null.
export default function ZoekprofielBevestigen({
  state,
  onChange,
  lijsten = null,
  lijstenFout = false,
  bezig = false,
  fout = '',
  melding = '',
  hersteld = false,
  onBevestig,
  onAnnuleer,
  onOpnieuwOpstellen,
  onBeginOpnieuw,
  opnieuwBezig = false,
  bevestigTekst = 'Zoek passende fondsen',
}) {
  const controle = controleerProfiel(state, lijsten);
  const chat = state.route === 'chat';
  const ontbreekt = (k) => state.ontbrekend.includes(k);
  const opties = (bron) => (lijsten && Array.isArray(lijsten[bron]) ? lijsten[bron] : []);
  const kanBevestigen = controle.ok && !bezig;
  const alleLijstNamen = (bron) => opties(bron);

  return (
    <section data-testid="zoekprofiel" data-route={state.route} data-bezig={bezig ? 'ja' : 'nee'} style={css(KAART)}>
      <div>
        <h2 style={css(`${LABEL} margin: 0 0 4px;`)}>Zoekprofiel</h2>
        <div style={css(`${TEKST} font-weight: 700; color: #2C4A5E;`)}>
          {chat
            ? 'Dit heeft Subsidiekompas uit uw gesprek en uw project opgemaakt. Controleer en pas aan wat niet klopt; daarna zoekt Subsidiekompas passende fondsen.'
            : 'Dit heeft Subsidiekompas uit uw projectgegevens' + (state.bronnen.documenten > 0 ? ` en ${state.bronnen.documenten === 1 ? '1 geüpload document' : `${state.bronnen.documenten} geüploade documenten`}` : '') + ' opgemaakt. Controleer en pas aan wat niet klopt; daarna zoekt Subsidiekompas passende fondsen.'}
        </div>
        <div style={css(`${KLEIN} margin-top: 4px;`)}>Er wordt niets opgeslagen en niets gezocht voordat u op “{bevestigTekst}” klikt.</div>
      </div>

      {state.bronnen.ai === 'mislukt' && (
        <Melding soort="waarschuwing" testId="zp-ai-mislukt">
          Het aanvullen met AI lukte nu niet; dit profiel komt alleen uit uw projectgegevens. U kunt het zelf aanvullen of het later opnieuw laten opstellen.
        </Melding>
      )}

      {hersteld && (
        <Melding soort="info" testId="zp-hersteld">
          Uw eerdere wijzigingen aan dit zoekprofiel zijn teruggezet.{' '}
          {onBeginOpnieuw && (
            <button type="button" data-testid="zp-begin-opnieuw" onClick={onBeginOpnieuw} style={css(KNOP_KLEIN)}>
              Opnieuw beginnen vanuit het project
            </button>
          )}
        </Melding>
      )}

      {lijstenFout && (
        <Melding soort="waarschuwing" testId="zp-lijsten-fout">
          De lijsten met disciplines, doelgroepen en werkgebieden konden niet worden geladen. U kunt waarden weghalen, maar nieuwe waarden kiezen lukt pas als de lijsten er zijn. Ververs de pagina om het opnieuw te proberen.
        </Melding>
      )}

      {fout && (
        <Melding soort="fout" testId="zp-fout">
          {fout} Uw zoekprofiel is behouden; u kunt het opnieuw proberen.
        </Melding>
      )}

      {melding && (
        <Melding soort="waarschuwing" testId="zp-melding">
          {melding} Pas het zoekprofiel aan en zoek opnieuw; uw wijzigingen zijn behouden.
        </Melding>
      )}

      {controle.fouten.algemeen && (
        <Melding soort="waarschuwing" testId="zp-algemeen">
          {controle.fouten.algemeen}
        </Melding>
      )}

      <Veld id="omschrijving" label="Omschrijving van het project" ontbreekt={ontbreekt('omschrijving') && !state.omschrijving}>
        <textarea
          data-testid="zp-omschrijving"
          aria-label="Omschrijving van het project"
          value={state.omschrijving}
          rows={3}
          onChange={(e) => onChange(zetVeld(state, 'omschrijving', e.target.value))}
          style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical' }}
        />
      </Veld>

      <Veld id="trefwoorden" label="Trefwoorden" hulp="Korte woorden over doel en impact, gescheiden door komma’s. Ze helpen bij het vergelijken met de teksten van financiers.">
        <input
          data-testid="zp-trefwoorden"
          aria-label="Trefwoorden"
          defaultValue={state.trefwoorden.join(', ')}
          key={state.trefwoorden.join('|')}
          onBlur={(e) => onChange(zetTrefwoorden(state, e.target.value))}
          style={veldStijl}
        />
      </Veld>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px;')}>
        {LIJST_VELDEN.map((v) => {
          const gelijkNamen = state[v.sleutel].map((i) => i.naam);
          const manco = (v.sleutel === 'disciplines' && ontbreekt('disciplines') && !state.werkvelden.length && !gelijkNamen.length) || (v.sleutel === 'doelgroepen' && ontbreekt('doelgroepen') && !gelijkNamen.length) || (v.sleutel === 'werkgebieden' && ontbreekt('werkgebied') && !gelijkNamen.length && !state.locatie);

          return (
            <Veld key={v.sleutel} id={v.sleutel} label={v.label} hulp={v.hulp} fout={controle.fouten[v.sleutel]} ontbreekt={manco}>
              <ClassificatieSelect
                opties={alleLijstNamen(v.bron)}
                waarde={gelijkNamen}
                onChange={(nieuw) => onChange(zetLijst(state, v.sleutel, nieuw))}
                multi
                placeholder={v.placeholder}
                ariaLabel={v.label}
              />
              <BronRegel sleutel={v.sleutel} items={state[v.sleutel]} />
              {(state.voorstellen[v.sleutel] || []).length > 0 && (
                <div data-testid={`zp-voorstel-${v.sleutel}`} style={css(`${KLEIN} display: flex; flex-wrap: wrap; align-items: center; gap: 6px;`)}>
                  <span>Nieuw voorgesteld, niet automatisch toegevoegd:</span>
                  {state.voorstellen[v.sleutel].map((i) => (
                    <button key={i.naam} type="button" data-testid="zp-voorstel-neem-over" onClick={() => onChange(neemVoorstelOver(state, v.sleutel, i.naam))} style={css(KNOP_KLEIN)}>
                      + {i.naam}
                    </button>
                  ))}
                </div>
              )}
            </Veld>
          );
        })}
      </div>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px;')}>
        <Veld id="locatie" label="Locatie (in uw eigen woorden)" hulp="Bijvoorbeeld een wijk of plaats. Alleen de werkgebieden hierboven worden aan de lijst van Subsidiekompas gekoppeld.">
          <input data-testid="zp-locatie" aria-label="Locatie" value={state.locatie} onChange={(e) => onChange(zetVeld(state, 'locatie', e.target.value))} maxLength={80} style={veldStijl} />
        </Veld>
        <Veld id="periode" label="Looptijd" ontbreekt={ontbreekt('periode') && !state.periodeStart && !state.periodeEind} fout={controle.fouten.periode}>
          <div style={css('display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px;')}>
            <input data-testid="zp-start" type="date" aria-label="Startdatum" value={state.periodeStart} onChange={(e) => onChange(zetVeld(state, 'periodeStart', e.target.value))} style={veldStijl} />
            <input data-testid="zp-eind" type="date" aria-label="Einddatum" value={state.periodeEind} min={state.periodeStart || undefined} onChange={(e) => onChange(zetVeld(state, 'periodeEind', e.target.value))} style={veldStijl} />
          </div>
        </Veld>
      </div>

      <div data-testid="zp-financiering" data-bekend={state.financiering.bekend ? 'ja' : 'nee'} style={css(`${TEKST} font-size: 13.5px; padding: 12px 14px; border-radius: 12px; background: ${state.financiering.bekend ? '#F3F9F5' : '#FBF1E3'}; color: ${state.financiering.bekend ? '#2C4A5E' : '#8A5A16'};`)}>
        <strong>Financieringsbehoefte.</strong> {financieringTekst(state, formatEuro)}
      </div>

      {state.onzeker.length > 0 && (
        <div data-testid="zp-onzeker" style={css('border: 1px dashed #E5C99A; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; background: #FFFBF3;')}>
          <div style={css(`${TEKST} font-weight: 800; color: #8A5A16;`)}>Niet zeker gekoppeld</div>
          <div style={css(KLEIN)}>Deze termen staan bij uw project of gesprek, maar zijn geen categorie in de database. Ze tellen niet mee bij het zoeken, tenzij u ze koppelt aan een bestaande categorie.</div>
          {state.onzeker.map((o) => (
            <div key={o.term} data-testid="zp-onzeker-rij" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px;')}>
              <strong style={css(`${TEKST} color: #2C4A5E;`)}>{o.term}</strong>
              <span style={css(KLEIN)}>({o.soort})</span>
              <select
                aria-label={`Koppel ${o.term} aan een categorie`}
                data-testid="zp-onzeker-koppel"
                defaultValue=""
                onChange={(e) => {
                  const [sleutel, ...rest] = e.target.value.split('::');
                  const naam = rest.join('::');

                  if (sleutel && naam) onChange(koppelOnzeker(state, o.term, sleutel, naam));
                }}
                style={{ ...veldStijl, width: 'auto', minWidth: 190 }}
              >
                <option value="">Koppelen aan…</option>
                {(o.soort === 'doelgroep' ? [['doelgroepen', 'Doelgroep', opties('doelgroepen')]] : o.soort === 'werkgebied' ? [['werkgebieden', 'Werkgebied', opties('regios')]] : [['disciplines', 'Discipline', opties('themas')], ['werkvelden', 'Werkveld', opties('themas')]]).map(([sleutel, groep, namen]) => (
                  <optgroup key={sleutel} label={groep}>
                    {namen.map((n) => (
                      <option key={n} value={`${sleutel}::${n}`}>
                        {n}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button type="button" data-testid="zp-onzeker-negeer" onClick={() => onChange(negeerOnzeker(state, o.term))} style={css(KNOP_KLEIN)}>
                Negeren
              </button>
            </div>
          ))}
        </div>
      )}

      {state.vragen.length > 0 && (
        <div data-testid="zp-vragen" style={css(`${KLEIN}`)}>
          <strong style={css('color: #2C4A5E;')}>Aanvullen kan hierboven, u hoeft niets opnieuw te doorlopen:</strong>
          <ul style={css('margin: 4px 0 0; padding-left: 18px;')}>
            {state.vragen.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {controle.waarschuwingen.length > 0 && (
        <ul data-testid="zp-waarschuwingen" style={css(`${KLEIN} margin: 0; padding-left: 18px; color: #8A5A16;`)}>
          {controle.waarschuwingen.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px;')}>
        <button type="button" data-testid="zp-bevestig" disabled={!kanBevestigen} aria-disabled={!kanBevestigen} onClick={kanBevestigen ? onBevestig : undefined} style={css(`${KNOP_PRIMAIR}${kanBevestigen ? '' : ' opacity: 0.55; cursor: not-allowed;'}`)}>
          {bezig ? 'Bezig…' : bevestigTekst}
        </button>
        {onOpnieuwOpstellen && (
          <button type="button" data-testid="zp-opnieuw" disabled={bezig || opnieuwBezig} onClick={onOpnieuwOpstellen} style={css(KNOP_STIL)} title={heeftWijzigingen(state) ? 'Uw eigen wijzigingen blijven staan; nieuwe voorstellen komen er apart bij.' : undefined}>
            {opnieuwBezig ? 'Wordt opgesteld…' : 'Profiel opnieuw opstellen'}
          </button>
        )}
        {onAnnuleer && (
          <button type="button" data-testid="zp-annuleer" disabled={bezig} onClick={onAnnuleer} style={css(KNOP_STIL)}>
            Sluiten
          </button>
        )}
        {heeftWijzigingen(state) && (
          <span data-testid="zp-concept-bewaard" style={css(KLEIN)}>
            Uw wijzigingen worden op dit apparaat bewaard.
          </span>
        )}
      </div>
    </section>
  );
}
