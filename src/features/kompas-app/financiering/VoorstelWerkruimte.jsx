// "Maak dekkingsplan en actieplan met Subsidiekompas": de startknop, de voortgang, het voorstel dat het lid kan bekijken en aanpassen, en het opslaan.
// De server maakt het voorstel (Pro: database + korte online oriëntatie, 110%; Premium: ruimere oriëntatie, gericht aanvullen, 120%); deze component
// toont en past aan. Er wordt NIETS opgeslagen vóór de klik "Opslaan in dit project". De logica staat in voorstelWerk.js (zuiver, getest).
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { vraagVoorstelPreview } from '../../../data/services/voorstelPreview.js';
import { vraagVoorstelAanvullen, vraagVoorstelGenereren } from '../../../data/services/voorstelGenereren.js';
import { voegFinancierToe, voegRegelToe } from '../../../data/services/projectFinanciering.js';
import { voegActieToe } from '../../../data/services/projectActies.js';
import FinancieringsRegel from './FinancieringsRegel.jsx';
import VoorstelStart from './VoorstelStart.jsx';
import { VoorstelRegelDetail } from './VoorstelPreview.jsx';
import { bouwPreviewModel } from './voorstelPreviewModel.js';
import { formatDatum, formatEuro, leesBedragInvoer } from './dekkingsplan.js';
import { STAP, beginBedragen, beginSelectie, berekenSelectieTotaal, bouwOpslagPlan, bufferUitleg, dekkingTekst, draaiVoorstelFlow, maakWerkModel, voerOpslagUit } from './voorstelWerk.js';
import { VOORSTEL_STAPPEN } from './voorstelFlow.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const KAART = 'box-sizing: border-box; padding: 20px 22px; border: 1px solid #CFE4D7; border-radius: 20px; background: #FFFFFF; display: flex; flex-direction: column; gap: 14px;';
const KNOP_PRIMAIR = "min-height: 44px; padding: 0 20px; border: none; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;";
const KNOP_STIL = "min-height: 44px; padding: 0 18px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;";
const INVOER = "box-sizing: border-box; width: 150px; max-width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2C4A5E; text-align: right;";

const STAPPEN_ACTIEF = { [STAP.ONDERZOEKEN]: 2, [STAP.AANVULLEN]: 2, [STAP.CONTROLEREN]: 3 };
const STAP_TEKST = {
  [STAP.ONDERZOEKEN]: 'Subsidiekompas doorzoekt de database en zoekt kort online. Dit kan een halve minuut duren.',
  [STAP.AANVULLEN]: 'Subsidiekompas zoekt gericht verder naar wat er nog ontbreekt (Premium).',
  [STAP.CONTROLEREN]: 'De bronnen van de gekozen financiers worden gecontroleerd.',
};
const REDEN_OPSLAAN = { 'niet-toegestaan': 'niet toegestaan met uw abonnement', ongeldig: 'ongeldige gegevens', 'geen-sessie': 'u bent niet ingelogd', 'niet-beschikbaar': 'nog niet beschikbaar in uw omgeving', fout: 'onbekende fout' };

const STANDAARD_DIENSTEN = {
  genereer: vraagVoorstelGenereren,
  aanvullen: vraagVoorstelAanvullen,
  preview: vraagVoorstelPreview,
  voegRegelToe,
  voegFinancierToe,
  voegActieToe,
};

function Voortgang({ stap }) {
  const actief = STAPPEN_ACTIEF[stap] ?? 2;

  return (
    <section data-testid="voorstel-voortgang" data-stap={stap} aria-live="polite" style={css(KAART)}>
      <h2 style={css(`${LABEL} margin: 0;`)}>Subsidiekompas is aan het werk</h2>
      <ol style={css(`${TEKST} margin: 0; padding-left: 20px;`)}>
        {VOORSTEL_STAPPEN.slice(0, 4).map((s, i) => (
          <li key={s} data-status={i < actief ? 'klaar' : i === actief ? 'bezig' : 'wacht'} style={css(`font-weight: ${i === actief ? '800' : '500'}; color: ${i < actief ? '#2F7A4D' : i === actief ? '#2C4A5E' : '#7B8985'};`)}>
            {i < actief ? '✓ ' : ''}
            {s}
          </li>
        ))}
      </ol>
      <div style={css(`${TEKST} font-size: 13px;`)}>{STAP_TEKST[stap] || STAP_TEKST[STAP.ONDERZOEKEN]}</div>
    </section>
  );
}

function Samenvatting({ uit, onSluiten }) {
  const regels = [];

  if (uit.regelsToegevoegd) regels.push(`${uit.regelsToegevoegd} ${uit.regelsToegevoegd === 1 ? 'financier' : 'financiers'} toegevoegd aan het dekkingsplan (status Interessant)`);
  if (uit.suggestiesToegevoegd) regels.push(`${uit.suggestiesToegevoegd} online gevonden ${uit.suggestiesToegevoegd === 1 ? 'financier' : 'financiers'} op uw lijst gezet, zonder bedrag`);
  if (uit.actiesToegevoegd) regels.push(`${uit.actiesToegevoegd} ${uit.actiesToegevoegd === 1 ? 'taak' : 'taken'} aangemaakt in het actieplan`);

  const problemen = [
    ...uit.regelsBestondAl.map((n) => `${n} stond al in uw dekkingsplan en is niet opnieuw toegevoegd.`),
    ...uit.regelsMislukt.map((m) => `${m.naam} kon niet worden toegevoegd (${REDEN_OPSLAAN[m.reden] || REDEN_OPSLAAN.fout}).`),
    ...uit.suggestiesMislukt.map((m) => `${m.naam} kon niet worden toegevoegd (${m.reden === 'bestaat-al' ? 'staat al in dit project' : REDEN_OPSLAAN[m.reden] || REDEN_OPSLAAN.fout}).`),
    ...(uit.actiesMislukt ? [`${uit.actiesMislukt} ${uit.actiesMislukt === 1 ? 'taak kon' : 'taken konden'} niet worden aangemaakt.`] : []),
  ];

  return (
    <section data-testid="voorstel-opgeslagen" style={css(KAART)}>
      <h2 style={css(`${LABEL} margin: 0;`)}>Opgeslagen</h2>
      {regels.length > 0 ? (
        <ul style={css(`${TEKST} margin: 0; padding-left: 20px;`)}>
          {regels.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <div style={css(TEKST)}>Er is niets nieuws opgeslagen.</div>
      )}
      {problemen.length > 0 && (
        <ul role="alert" data-testid="voorstel-opslaan-problemen" style={css(`${TEKST} margin: 0; padding-left: 20px; color: #8A5A16;`)}>
          {problemen.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div>
        <button type="button" data-testid="voorstel-sluiten" onClick={onSluiten} style={css(KNOP_STIL)}>
          Sluiten
        </button>
      </div>
    </section>
  );
}

export default function VoorstelWerkruimte({ project, onOpgeslagen, beschikbaar, opgeslagen = true, diensten = STANDAARD_DIENSTEN }) {
  const [fase, setFase] = useState('idle'); // idle | bezig | klaar | fout | opslaan | opgeslagen
  const [stap, setStap] = useState(STAP.ONDERZOEKEN);
  const [melding, setMelding] = useState('');
  const [model, setModel] = useState(null);
  const [selectie, setSelectie] = useState(null);
  const [bedragen, setBedragen] = useState({});
  const [uitkomst, setUitkomst] = useState(null);
  const bezigRef = useRef(false);
  const projectId = project && project.id;

  const start = useCallback(async () => {
    if (bezigRef.current || !projectId) return;

    bezigRef.current = true;
    setFase('bezig');
    setMelding('');
    setStap(STAP.ONDERZOEKEN);

    try {
      const res = await draaiVoorstelFlow({ projectId, diensten, onStap: setStap });

      if (!res.ok) {
        setMelding(res.melding);
        setFase('fout');

        return;
      }

      const m = maakWerkModel(res);

      if (!m || !m.regels.length) {
        // Gedekt, of niets sterks gevonden: geen leeg voorstel tonen maar de uitleg van de server.
        setModel(m);
        setMelding((res.genereer && res.genereer.melding) || (res.genereer && res.genereer.uitkomst === 'geen-gat' ? 'De begroting van dit project is al volledig gedekt; er is niets voor te stellen.' : 'Er zijn geen sterke, passende financiers gevonden.'));
        setFase(m && m.suggesties.length ? 'klaar' : 'fout');

        if (m && m.suggesties.length) {
          setSelectie(beginSelectie(m));
          setBedragen(beginBedragen(m));
        }

        return;
      }

      setModel(m);
      setSelectie(beginSelectie(m));
      setBedragen(beginBedragen(m));
      setFase('klaar');
    } catch (e) {
      setMelding('Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen. Probeer het later opnieuw.');
      setFase('fout');
    } finally {
      bezigRef.current = false;
    }
  }, [projectId, diensten]);

  const sluit = useCallback(() => {
    setFase('idle');
    setModel(null);
    setSelectie(null);
    setUitkomst(null);
    setMelding('');
  }, []);

  const totaal = useMemo(() => (model && selectie ? berekenSelectieTotaal(model, selectie, bedragen) : null), [model, selectie, bedragen]);
  const weergave = useMemo(() => (model ? bouwPreviewModel(model.weergave) : null), [model]);
  const detailVan = useMemo(() => new Map(((weergave && weergave.ok && weergave.regels) || []).map((r) => [r.sleutel, r])), [weergave]);

  const wissel = (soort, sleutel) =>
    setSelectie((cur) => {
      const volgende = new Set(cur[soort]);

      if (volgende.has(sleutel)) volgende.delete(sleutel);
      else volgende.add(sleutel);

      return { ...cur, [soort]: volgende };
    });

  const opslaan = async () => {
    if (bezigRef.current || !model || !selectie) return;

    const plan = bouwOpslagPlan(model, selectie, bedragen);

    if (plan.ongeldig.length) return;

    bezigRef.current = true;
    setFase('opslaan');

    try {
      const uit = await voerOpslagUit({ projectId, plan, diensten });

      setUitkomst(uit);
      setFase('opgeslagen');

      if (typeof onOpgeslagen === 'function') onOpgeslagen(uit);
    } finally {
      bezigRef.current = false;
    }
  };

  const nietsGekozen = selectie ? selectie.regels.size === 0 && selectie.suggesties.size === 0 : true;
  const heeftFout = totaal ? Object.values(totaal.fouten).includes('ongeldig') : false;

  return (
    <div data-testid="voorstel-werkruimte" data-fase={fase} style={css('display: flex; flex-direction: column; gap: 18px;')}>
      <VoorstelStart project={project} beschikbaar={beschikbaar} opgeslagen={opgeslagen} bezig={fase === 'bezig' || fase === 'opslaan'} onStart={start} />

      {fase === 'bezig' && <Voortgang stap={stap} />}

      {fase === 'fout' && (
        <section role="alert" data-testid="voorstel-fout" style={css(`${TEKST} padding: 14px 18px; border: 1px solid #EEDCC0; border-radius: 16px; background: #FBF1E3; color: #8A5A16;`)}>
          {melding || 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen.'}
        </section>
      )}

      {fase === 'opgeslagen' && uitkomst && <Samenvatting uit={uitkomst} onSluiten={sluit} />}

      {(fase === 'klaar' || fase === 'opslaan') && model && selectie && totaal && (
        <section data-testid="voorstel-resultaat" data-gecontroleerd={model.gecontroleerd ? 'ja' : 'nee'} style={css(KAART)}>
          <div>
            <h2 style={css(`${LABEL} margin: 0 0 4px;`)}>Voorstel van Subsidiekompas</h2>
            <div data-testid="voorstel-niet-opgeslagen" style={css(`${TEKST} font-weight: 700; color: #2C4A5E;`)}>
              Er is nog niets opgeslagen. Vink af wat u niet wilt, pas bedragen aan en klik daarna op Opslaan.
            </div>
          </div>

          {!model.gecontroleerd && (
            <div data-testid="voorstel-niet-gecontroleerd" style={css(`${TEKST} font-size: 13px; padding: 10px 14px; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
              De bronnen konden nu niet automatisch worden gecontroleerd. Controleer deadline en voorwaarden zelf bij de financier.
            </div>
          )}

          {model.melding && (
            <div data-testid="voorstel-melding" style={css(`${TEKST} font-size: 13.5px; padding: 10px 14px; border-radius: 12px; background: #EEF4F8; color: #2C4A5E;`)}>
              {model.melding}
            </div>
          )}

          {model.regels.length > 0 && (
            <div data-testid="voorstel-totalen" aria-live="polite" style={css(`${TEKST} display: flex; flex-direction: column; gap: 2px;`)}>
              <div>
                Voorgesteld: <strong data-testid="voorstel-som">{formatEuro(totaal.voorgesteld)}</strong> · Nog te financieren: {formatEuro(model.gat)}
              </div>
              <div data-testid="voorstel-dekking" style={css('font-size: 13px; color: #2C4A5E; font-weight: 700;')}>{dekkingTekst(totaal, model)}</div>
              {bufferUitleg(model) && <div style={css('font-size: 12.5px; color: #7B8985;')}>{bufferUitleg(model)}</div>}
              {totaal.bovenDoel && (
                <div role="status" data-testid="voorstel-boven-doel" style={css('font-size: 13px; color: #8A5A16;')}>
                  U zit boven de buffer van {Math.round(model.dekkingsdoel * 100)}% ({formatEuro(model.doelBedrag)}). Dat kan, maar dan overschat u wat financiers waarschijnlijk toekennen.
                </div>
              )}
            </div>
          )}

          <div data-testid="voorstel-regels" style={css('display: flex; flex-direction: column; gap: 10px;')}>
            {model.regels.map((r) => {
              const d = detailVan.get(r.sleutel);
              const gekozen = selectie.regels.has(r.sleutel);
              const fout = totaal.fouten[r.sleutel];
              const b = leesBedragInvoer(bedragen[r.sleutel]);

              return (
                <div key={r.sleutel} data-testid="voorstel-rij" data-sleutel={r.sleutel} data-gekozen={gekozen ? 'ja' : 'nee'} style={css('display: flex; flex-direction: column; gap: 6px;')}>
                  <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;')}>
                    <label style={css(`${TEKST} display: inline-flex; align-items: center; gap: 8px; min-height: 40px; font-weight: 700; color: #2C4A5E;`)}>
                      <input type="checkbox" data-testid="voorstel-kies" checked={gekozen} disabled={!r.selecteerbaar} onChange={() => wissel('regels', r.sleutel)} style={css('width: 18px; height: 18px;')} />
                      {r.reserve ? 'Reserve (telt niet mee, nu geen bedrag)' : r.selecteerbaar ? 'Opnemen in dekkingsplan' : 'Staat al in uw dekkingsplan'}
                    </label>
                    <label style={css(`${TEKST} display: inline-flex; align-items: center; gap: 8px;`)}>
                      Bedrag (€)
                      <input
                        type="text"
                        inputMode="decimal"
                        data-testid="voorstel-bedrag"
                        aria-label={`Bedrag voor ${r.naam}`}
                        aria-invalid={fout === 'ongeldig' ? 'true' : undefined}
                        value={bedragen[r.sleutel] ?? ''}
                        disabled={!gekozen}
                        onChange={(e) => setBedragen((cur) => ({ ...cur, [r.sleutel]: e.target.value }))}
                        style={css(INVOER)}
                      />
                    </label>
                  </div>
                  {fout === 'ongeldig' && (
                    <div role="alert" style={css(`${TEKST} font-size: 12.5px; color: #9E3B2C;`)}>
                      Vul een bedrag in als getal, bijvoorbeeld 12.500.
                    </div>
                  )}
                  {(fout === 'onder-minimum' || fout === 'boven-maximum') && (
                    <div data-testid="voorstel-grens-waarschuwing" style={css(`${TEKST} font-size: 12.5px; color: #8A5A16;`)}>
                      Dit bedrag valt buiten de bijdragegrenzen van de financier ({r.grenzen.min != null ? formatEuro(r.grenzen.min) : '?'} – {r.grenzen.max != null ? formatEuro(r.grenzen.max) : '?'}).
                    </div>
                  )}
                  {d ? (
                    <FinancieringsRegel
                      testId="voorstel-regel"
                      titel={d.naam}
                      bedrag={b.ok && b.waarde != null ? formatEuro(b.waarde) : null}
                      bedragLeeg="Geen bedrag"
                      status={d.kop.status}
                      samenvatting={d.kop.samenvatting}
                    >
                      <VoorstelRegelDetail r={d} />
                    </FinancieringsRegel>
                  ) : (
                    <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E;`)}>{r.naam}</div>
                  )}
                </div>
              );
            })}
          </div>

          {model.acties.length > 0 && (
            <details data-testid="voorstel-acties" style={css('border: 1px solid #E1EAE4; border-radius: 14px; padding: 10px 14px;')}>
              <summary style={css(`${TEKST} font-weight: 800; color: #2C4A5E; cursor: pointer;`)}>
                Voorgestelde taken ({[...selectie.acties].filter((s) => model.acties.some((a) => a.sleutel === s && (!a.regelSleutel || selectie.regels.has(a.regelSleutel)))).length})
              </summary>
              <ul style={css('list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px;')}>
                {model.acties.map((a) => {
                  const regelGekozen = !a.regelSleutel || selectie.regels.has(a.regelSleutel);

                  return (
                    <li key={a.sleutel} data-testid="voorstel-actie" style={css(`${TEKST} font-size: 13.5px; opacity: ${regelGekozen ? '1' : '0.5'};`)}>
                      <label style={css('display: inline-flex; align-items: flex-start; gap: 8px;')}>
                        <input type="checkbox" checked={regelGekozen && selectie.acties.has(a.sleutel)} disabled={!regelGekozen} onChange={() => wissel('acties', a.sleutel)} style={css('width: 18px; height: 18px; margin-top: 2px;')} />
                        <span>
                          {a.datum ? <strong>{formatDatum(a.datum)} · </strong> : null}
                          {a.titel}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          {model.suggesties.length > 0 && (
            <section data-testid="voorstel-online" style={css('border: 1px dashed #CFDDD5; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;')}>
              <div>
                <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E;`)}>Online gevonden: nog niet gecontroleerd</div>
                <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>
                  Deze financiers staan niet in onze database. Ze tellen niet mee in de dekking hierboven{model.onlineIndicatief > 0 ? ` (samen ongeveer ${formatEuro(model.onlineIndicatief)}, een schatting)` : ''}. U kunt ze op uw lijst zetten (Interessant, zonder bedrag) en zelf controleren.
                </div>
              </div>
              {model.suggesties.map((s) => (
                <label key={s.sleutel} data-testid="voorstel-suggestie" style={css(`${TEKST} display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px;`)}>
                  <input type="checkbox" checked={selectie.suggesties.has(s.sleutel)} onChange={() => wissel('suggesties', s.sleutel)} style={css('width: 18px; height: 18px; margin-top: 2px;')} />
                  <span style={css('min-width: 0; overflow-wrap: anywhere;')}>
                    <strong>{s.gever}</strong>
                    {s.naam && s.naam !== s.gever ? ` – ${s.naam}` : ''}
                    {s.indicatiefBedrag != null ? ` · indicatie ongeveer ${formatEuro(s.indicatiefBedrag)} (schatting)` : ''}
                    {s.deadline ? ` · deadline volgens de bron ${formatDatum(s.deadline)}` : ''}
                    {s.url && (
                      <>
                        {' · '}
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={css('color: #4E9A6C; font-weight: 800;')}>
                          bron
                        </a>
                      </>
                    )}
                  </span>
                </label>
              ))}
            </section>
          )}

          {model.premiumHint > 0 && (
            <aside data-testid="voorstel-premium-hint" style={css(`${TEKST} padding: 12px 16px; border: 1px solid #CFE4D7; border-radius: 14px; background: #F3F9F5; color: #2C4A5E;`)}>
              <strong>
                Er {model.premiumHint === 1 ? 'is nog 1 fonds' : `zijn nog ${model.premiumHint} fondsen`}
              </strong>{' '}
              die bij dit project {model.premiumHint === 1 ? 'past' : 'passen'} en alleen met Premium te zien {model.premiumHint === 1 ? 'is' : 'zijn'}. Dat zijn minder bekende fondsen die lastig te vinden zijn.{' '}
              <a href="#/kompas/abonneren?intent=PREMIUM" data-testid="voorstel-premium-link" style={css('color: #4E9A6C; font-weight: 800;')}>
                Bekijk Premium
              </a>
            </aside>
          )}

          <div style={css('display: flex; flex-wrap: wrap; gap: 10px;')}>
            <button type="button" data-testid="voorstel-opslaan" disabled={fase === 'opslaan' || nietsGekozen || heeftFout} onClick={opslaan} style={css(`${KNOP_PRIMAIR}${fase === 'opslaan' || nietsGekozen || heeftFout ? ' opacity: 0.55; cursor: not-allowed;' : ''}`)}>
              {fase === 'opslaan' ? 'Bezig met opslaan…' : 'Opslaan in dit project'}
            </button>
            <button type="button" data-testid="voorstel-verwerp" disabled={fase === 'opslaan'} onClick={sluit} style={css(KNOP_STIL)}>
              Sluiten zonder opslaan
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
