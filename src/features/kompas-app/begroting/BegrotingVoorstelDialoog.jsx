// Vanuit de chat: het antwoord over de begroting omzetten in begrotingsregels en die in Documenten › Begroting zetten.
// Stap 1: uitleg en bevestiging (het telt als één beoordeling van de maandruimte, dus er gaat niets per ongeluk). Stap 2: voorbeeld van de regels, met
// schattingen herkenbaar. Stap 3: opslaan in dezelfde opslag als de begrotingstab (project.budgetRegels en het totaal als projectbegroting).
// Er wordt niets automatisch bewaard: het lid kiest zelf toevoegen of vervangen.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { color } from '../../../shared/tokens.js';
import { Button } from '../../../shared/ui/index.js';
import { maakBegrotingVoorstel } from '../../../data/services/aanvraagAssistent.js';
import { valideerEnBereidOp } from '../projectOpslaan.js';
import { formatEuro } from '../financiering/dekkingsplan.js';
import { berekenBegroting, categorieLabel, kopjeVolgorde, leesBudgetRegels, regelBedrag, regelsVoorOpslag, samenvoegVoorstel, voorstelNaarRegels } from './begrotingModel.js';

const euro = (n) => `€ ${Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const KAART = css(`position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(44,74,94,0.35);`);
const PANEEL = css(`box-sizing: border-box; width: 100%; max-width: 640px; max-height: 88vh; overflow: auto; padding: 22px 24px; border-radius: 18px; background: ${color.wit}; box-shadow: 0 18px 48px rgba(44,74,94,0.25); font-family: 'Mulish', sans-serif; color: ${color.tekst};`);

export default function BegrotingVoorstelDialoog({ project, tekst, store, onSluit }) {
  const [fase, setFase] = useState('start'); // start | bezig | voorbeeld | opgeslagen
  const [regels, setRegels] = useState([]); // schermregels van het voorstel
  const [fout, setFout] = useState('');
  const [resterend, setResterend] = useState(null);
  const [sluit, setSluit] = useState(null); // de controle van de server: sluit de begroting met het dekkingsplan? { toevoegen, vervangen }
  const [modus, setModus] = useState('toevoegen');
  const [bezigOpslaan, setBezigOpslaan] = useState(false);
  const [totaalNa, setTotaalNa] = useState(0); // de projectbegroting na het opslaan
  const bestaand = Array.isArray(project && project.budgetRegels) ? project.budgetRegels : [];

  const maak = async () => {
    setFase('bezig');
    setFout('');

    const res = await maakBegrotingVoorstel({ projectId: project.id, tekst });

    if (!res.ok) {
      setFout(res.melding);
      setFase('start');

      return;
    }

    setRegels(leesBudgetRegels(voorstelNaarRegels(res.antwoord.regels)));
    setResterend(typeof res.antwoord.resterend === 'number' ? res.antwoord.resterend : null);
    setSluit(res.antwoord.sluit && res.antwoord.sluit.toevoegen ? res.antwoord.sluit : null);
    setFase('voorbeeld');
  };

  const opslaan = async () => {
    if (bezigOpslaan) return;

    setBezigOpslaan(true);
    setFout('');

    const samen = leesBudgetRegels(samenvoegVoorstel(bestaand, regelsVoorOpslag(regels).regels, modus));
    const klaar = regelsVoorOpslag(samen);

    if (!klaar.ok) {
      setFout(klaar.fout);
      setBezigOpslaan(false);

      return;
    }

    const totaal = berekenBegroting(samen).totaalGeld;
    const check = valideerEnBereidOp({ ...project, budgetRegels: klaar.regels, begroting: totaal > 0 ? Math.round(totaal) : project.begroting });

    if (!check.ok) {
      setFout(check.fout);
      setBezigOpslaan(false);

      return;
    }

    const id = await Promise.resolve(store.saveProject(check.project));

    setBezigOpslaan(false);

    if (id === null) {
      setFout('Opslaan lukte niet. Probeer het opnieuw.');

      return;
    }

    setTotaalNa(totaal > 0 ? Math.round(totaal) : project.begroting || 0);
    setFase('opgeslagen');
  };

  const totalen = berekenBegroting(regels);
  const volgorde = kopjeVolgorde(regels);

  return (
    <div style={KAART} role="dialog" aria-modal="true" aria-label="Begroting uit het gesprek" data-testid="bv-dialoog">
      <div style={PANEEL}>
        <h3 style={css(`margin: 0 0 10px; font-family: 'Newsreader', serif; font-size: 22px; color: ${color.donkerblauw};`)}>Zet in mijn begroting</h3>

        {fase === 'start' && (
          <>
            <p style={css('margin: 0 0 10px; font-size: 15px; line-height: 1.6;')} data-testid="bv-uitleg">
              Dit zet de kostenposten uit dit antwoord om in begrotingsregels, bij het project {project.naam ? <b>{project.naam}</b> : 'hierboven'}. U ziet ze eerst als voorbeeld; er wordt nog niets opgeslagen. Het telt als één beoordeling van uw maandruimte.
            </p>
            <p style={css('margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: #52606A;')}>Bedragen die het gesprek een schatting noemde, krijgen het label schatting. Ontbreekt een bedrag, dan blijft het leeg.</p>
            {fout && (
              <div role="alert" data-testid="bv-fout" style={css('margin: 0 0 12px; color: #B3261E; font-size: 14px;')}>
                {fout}
              </div>
            )}
            <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
              <Button variant="dark" onClick={maak} ariaLabel="Maak het voorbeeld van de begroting">
                Maak het voorbeeld
              </Button>
              <Button variant="outline" onClick={onSluit}>
                Annuleer
              </Button>
            </div>
          </>
        )}

        {fase === 'bezig' && (
          <p style={css('margin: 0; font-size: 15px;')} data-testid="bv-bezig">
            Even geduld, de regels worden klaargezet…
          </p>
        )}

        {fase === 'voorbeeld' && (
          <>
            <div data-testid="bv-voorbeeld">
              {volgorde.map((k) => {
                const rijen = regels.filter((r) => r.categorie === k);

                return (
                  <div key={k || 'zonder'} style={css('margin: 0 0 10px;')}>
                    {k !== '' && <div style={css(`font-weight: 800; color: ${color.donkerblauw}; margin: 8px 0 4px;`)}>{categorieLabel(k)}</div>}
                    {rijen.map((r) => {
                      const b = regelBedrag(r);

                      return (
                        <div key={r.id} data-testid="bv-regel" style={css('display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid #EEF2F0; font-size: 14.5px;')}>
                          <span>
                            {r.omschrijving}
                            {r.schatting ? (
                              <span data-testid="bv-schatting" style={css('margin-left: 8px; font-size: 12px; font-weight: 800; color: #8A5A00;')}>
                                schatting
                              </span>
                            ) : null}
                          </span>
                          <b style={css('white-space: nowrap;')}>{b.bedrag == null ? 'bedrag volgt' : euro(b.bedrag)}</b>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={css('margin-top: 10px; font-weight: 800;')} data-testid="bv-totaal">
                Totaal {euro(totalen.totaalGeld)}
                {totalen.aantalSchattingen > 0 ? <span style={css('font-weight: 600; font-size: 13.5px;')}>, waarvan {euro(totalen.totaalSchatting)} nog een schatting</span> : null}
              </div>
              {totalen.zonderBedrag.length > 0 && (
                <div style={css('margin-top: 6px; font-size: 13.5px; color: #52606A;')} data-testid="bv-zonder">
                  Nog geen bedrag bij: {totalen.zonderBedrag.map((r) => r.omschrijving).join(', ')}.
                </div>
              )}
            </div>

            {sluit && (() => {
              const s = modus === 'vervangen' && sluit.vervangen ? sluit.vervangen : sluit.toevoegen;

              return (
                <div data-testid="bv-sluit" data-uitkomst={s.uitkomst} style={css('margin-top: 10px; font-size: 13.5px; line-height: 1.5;')}>
                  <b>{s.uitkomst === 'sluitend' ? 'Begroting en dekkingsplan sluiten.' : 'Begroting en dekkingsplan:'}</b> {s.tekst}
                </div>
              );
            })()}

            {bestaand.length > 0 && (
              <fieldset style={css('border: 0; margin: 14px 0 0; padding: 0; font-size: 14.5px;')}>
                <legend style={css('font-weight: 800; padding: 0; margin-bottom: 4px;')}>Er staat al een begroting bij dit project</legend>
                <label style={css('display: block; margin: 2px 0;')}>
                  <input type="radio" name="bv-modus" checked={modus === 'toevoegen'} onChange={() => setModus('toevoegen')} data-testid="bv-toevoegen" /> Toevoegen aan wat er staat
                </label>
                <label style={css('display: block; margin: 2px 0;')}>
                  <input type="radio" name="bv-modus" checked={modus === 'vervangen'} onChange={() => setModus('vervangen')} data-testid="bv-vervangen" /> Vervangen door dit voorstel
                </label>
              </fieldset>
            )}

            {resterend !== null && (
              <div style={css('margin-top: 10px; font-size: 13px; color: #52606A;')} data-testid="bv-resterend">
                Nog {resterend} {resterend === 1 ? 'beoordeling' : 'beoordelingen'} over deze maand.
              </div>
            )}
            {fout && (
              <div role="alert" data-testid="bv-fout" style={css('margin: 10px 0 0; color: #B3261E; font-size: 14px;')}>
                {fout}
              </div>
            )}
            <div style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px;')}>
              <Button variant="dark" onClick={opslaan} disabled={bezigOpslaan || regels.length === 0} ariaLabel="Zet de regels in mijn begroting">
                {bezigOpslaan ? 'Opslaan…' : 'Zet in mijn begroting'}
              </Button>
              <Button variant="outline" onClick={onSluit}>
                Annuleer
              </Button>
            </div>
          </>
        )}

        {fase === 'opgeslagen' && (
          <>
            <p style={css('margin: 0 0 14px; font-size: 15px; line-height: 1.6;')} data-testid="bv-klaar">
              Staat in uw begroting. De projectbegroting is nu {formatEuro(totaalNa)}.{' '}
              {totalen.aantalSchattingen > 0 ? 'Loop de regels met een schatting nog even na.' : ''}
            </p>
            <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
              <a className="fwk-wp-link" data-testid="bv-naar-begroting" href={`#/kompas/documentatie?project=${encodeURIComponent(project.id)}&tab=begroting`} onClick={onSluit} style={css('font-weight: 800;')}>
                Naar de begroting →
              </a>
              <Button variant="outline" onClick={onSluit}>
                Sluiten
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
