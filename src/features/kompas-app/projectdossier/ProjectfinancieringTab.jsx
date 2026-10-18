// Tab "Projectfinanciering / Dekkingsplan": het dekkingsplan van één project, met de startknop van Subsidiekompas en,
// op dezelfde pagina, de Acties & deadlines van dat project. Bovenaan de dekking van de begroting
// (zelfde rekenmodule als Dashboard en projectdossier), daaronder de regels uit
// subsidie_kompas_program_funding. Bronnen buiten het abonnement blijven gemaskeerd; de eigen
// velden van het lid (bedragen, status, eigen deadline, herinnering, notitie) altijd zichtbaar.
// Toevoegen van regels gebeurt vanuit Deadlines (Fase 3); hier wijzig of verwijder je alleen.
import React, { useEffect, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import BespreekLink from '../financiering/BespreekLink.jsx'; // FASE5
import { DeadlineWeergave, HerinneringKnop, KLEUR, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { Blok, HelpKnop, Leeg, Melding } from '../../../shared/ui/werkplek.jsx';
import { ActieplanVoorProject } from '../financiering/ActieplanBlok.jsx';
import VoorstelWerkruimte from '../financiering/VoorstelWerkruimte.jsx';
import { bronVoorRegel, datumTekst } from '../financiering/bronStatus.js';
import { leesBronControles } from '../../../data/services/voorstelGenereren.js';
import FinancierFormulier from '../financiering/FinancierFormulier.jsx';
import {
  STATUSSEN,
  STATUS_LABEL,
  bedragVoorInvoer,
  formatEuro,
  leesBedragInvoer,
} from '../financiering/dekkingsplan.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const INVOER =
  "box-sizing: border-box; width: 100%; min-height: 38px; padding: 7px 10px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2C4A5E;";

const CSS_TAB = `
.fwk-pf-kop, .fwk-pf-rij { display: grid; gap: 12px 14px; align-items: start; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.5fr) minmax(0, 1.45fr); }
.fwk-pf-kop { padding: 0 18px 8px; }
.fwk-pf-label { display: none; }
.fwk-pf-notitie { grid-column: 1 / 5; }
.fwk-pf-acties { grid-column: 5 / 7; justify-self: end; align-self: center; display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px 14px; }
.fwk-pf-rij input:focus-visible, .fwk-pf-rij select:focus-visible, .fwk-pf-rij textarea:focus-visible, .fwk-pf-rij button:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 1px; }
@media (max-width: 899px) {
  .fwk-pf-kop { display: none; }
  .fwk-pf-rij { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .fwk-pf-bron, .fwk-pf-deadline, .fwk-pf-notitie, .fwk-pf-acties { grid-column: 1 / -1; }
  .fwk-pf-acties { justify-self: stretch; }
  .fwk-pf-label { display: block; margin-bottom: 4px; }
}
`;

function Legenda({ dekking }) {
  const items = [
    ['Totale begroting', dekking.heeftBegroting ? formatEuro(dekking.begroting) : '—', '#C5D2CB'],
    ['Toegekend', formatEuro(dekking.toegekend), KLEUR.toegekend],
    ['Aangevraagd', formatEuro(dekking.aangevraagd), KLEUR.aangevraagd],
    ['Gepland', formatEuro(dekking.gepland), '#C9D9E8'],
    ['Eigen bijdrage', formatEuro(dekking.overige), KLEUR.overige],
    ['Nog te financieren', dekking.heeftBegroting ? formatEuro(dekking.nogNodig) : '—', '#E1EAE4'],
  ];

  return (
    <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px 16px; margin-top: 14px;')}>
      {items.map(([naam, waarde, kleur]) => (
        <div key={naam} data-testid="pf-kpi" style={css('min-width: 0;')}>
          <div style={css(`display: flex; align-items: center; gap: 6px; ${TEKST} font-size: 12.5px; font-weight: 700; color: #7B8985;`)}>
            <span aria-hidden="true" style={css(`display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${kleur}; border: 1px solid #CFDDD5;`)} />
            {naam}
          </div>
          <div style={css("font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; white-space: nowrap;")}>{waarde}</div>
        </div>
      ))}
    </div>
  );
}

function Regel({ regel, bron = null, onWijzig, onVerwijder }) {
  const [aangevraagd, setAangevraagd] = useState(bedragVoorInvoer(regel.requested));
  const [toegekend, setToegekend] = useState(bedragVoorInvoer(regel.awarded));
  const [notitie, setNotitie] = useState(regel.notitie || '');
  const [fout, setFout] = useState('');
  const [bevestig, setBevestig] = useState(false);

  // Na een herlaad (of een wijziging elders) de velden gelijktrekken met de bron.
  useEffect(() => setAangevraagd(bedragVoorInvoer(regel.requested)), [regel.requested]);
  useEffect(() => setToegekend(bedragVoorInvoer(regel.awarded)), [regel.awarded]);
  useEffect(() => setNotitie(regel.notitie || ''), [regel.notitie]);

  const bewaar = async (wijziging) => {
    setFout('');

    const res = await onWijzig(regel.id, wijziging);

    if (!res || !res.ok) {
      setFout('Opslaan is niet gelukt. Probeer het opnieuw.');
    }
  };

  const bewaarBedrag = (veld, tekst, huidig) => {
    const gelezen = leesBedragInvoer(tekst);

    if (!gelezen.ok) {
      setFout('Vul een bedrag in, bijvoorbeeld 12.500.');

      return;
    }

    if (gelezen.waarde !== huidig) {
      bewaar({ [veld]: gelezen.waarde });
    } else {
      setFout('');
    }
  };

  const naam = regel.naam;
  const heeftBron = regel.bronStatus === 'zichtbaar';
  const toegekendHint = regel.status === 'awarded' && regel.awarded == null && regel.requested != null ? 'Leeg: het aangevraagde bedrag telt als toegekend.' : '';

  return (
    <article
      data-testid="pf-regel"
      data-regel-id={regel.id}
      data-bron-status={regel.bronStatus}
      style={css('box-sizing: border-box; padding: 12px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF;')}
    >
      <div className="fwk-pf-rij">
        <div className="fwk-pf-bron" style={css('min-width: 0;')}>
          <div
            data-testid="pf-regel-naam"
            style={css(
              `${TEKST} font-size: 15px; font-weight: 800; overflow-wrap: break-word; color: ${heeftBron ? '#2C4A5E' : '#7B8985'}; ${heeftBron ? '' : 'font-style: italic;'}`,
            )}
          >
            {naam}
          </div>
          {heeftBron && (
            <div style={css(`${TEKST} font-size: 13px; color: #7B8985; overflow-wrap: anywhere;`)}>
              {regel.bronType === 'financier' ? 'Cofinancier of andere financiering' : regel.bronType === 'fonds' ? 'Fonds' : 'Regeling'}
              {regel.funder && regel.bronType !== 'fonds' && regel.bronType !== 'financier' ? ` · ${regel.funder}` : ''}
              {regel.website && (
                <>
                  {' · '}
                  <a href={regel.website} target="_blank" rel="noopener noreferrer" style={css('color: #4E9A6C; font-weight: 700;')}>
                    Website
                  </a>
                </>
              )}
            </div>
          )}
          {/* De bronstatus is los van de financieringsstatus hierboven: gecontroleerd betekent alleen dat de bron is gecontroleerd, niet dat er is toegekend. */}
          {bron && (
            <div data-testid="pf-regel-bron" data-bron-status={bron.status} title={bron.uitleg} style={css(`${TEKST} margin-top: 6px; font-size: 12.5px; font-weight: 700; color: ${{ gecontroleerd: '#2F7A4D', onzeker: '#8A5A16', mislukt: '#A3382B' }[bron.status] || '#5D6B67'};`)}>
              Bron: {bron.label}
              {bron.gecontroleerdOp && bron.status === 'gecontroleerd' ? ` op ${datumTekst(bron.gecontroleerdOp)}` : ''}
              {bron.verouderd ? ' (gegevens veranderd of controle te oud)' : ''}
            </div>
          )}
        </div>

        <div>
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Aangevraagd</span>
            <input
              aria-label={`Aangevraagd bedrag, ${naam}`}
              inputMode="decimal"
              value={aangevraagd}
              placeholder="€"
              onChange={(e) => setAangevraagd(e.target.value)}
              onBlur={() => bewaarBedrag('requested', aangevraagd, regel.requested)}
              style={css(INVOER)}
            />
          </label>
        </div>

        <div>
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Toegekend</span>
            <input
              aria-label={`Toegekend bedrag, ${naam}`}
              inputMode="decimal"
              value={toegekend}
              placeholder="€"
              onChange={(e) => setToegekend(e.target.value)}
              onBlur={() => bewaarBedrag('awarded', toegekend, regel.awarded)}
              style={css(INVOER)}
            />
          </label>
          {toegekendHint && <div style={css(`${TEKST} margin-top: 4px; font-size: 12px; color: #7B8985;`)}>{toegekendHint}</div>}
        </div>

        <div>
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Status</span>
            <select
              aria-label={`Status, ${naam}`}
              value={regel.status}
              onChange={(e) => bewaar({ status: e.target.value })}
              style={css(INVOER)}
            >
              {STATUSSEN.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="fwk-pf-deadline">
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Deadline</span>
            <input
              type="date"
              aria-label={`Eigen deadline, ${naam}`}
              value={regel.eigenDeadline || ''}
              onChange={(e) => bewaar({ eigenDeadline: e.target.value || null })}
              style={css(INVOER)}
            />
          </label>
          <div data-testid="pf-regel-deadline" style={css(`${TEKST} margin-top: 4px; font-size: 12.5px; color: #4B5C58;`)}>
            <DeadlineWeergave regel={regel} nu={new Date()} />
          </div>
        </div>

        <div>
          <span className="fwk-pf-label" style={css(LABEL)}>Herinnering</span>
          <HerinneringKnop aan={regel.reminder} naam={naam} onWissel={() => bewaar({ reminder: !regel.reminder })} />
        </div>

        <div className="fwk-pf-notitie">
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Notitie</span>
            <textarea
              aria-label={`Notitie, ${naam}`}
              rows={1}
              maxLength={4000}
              value={notitie}
              placeholder="Notitie (bijvoorbeeld contactpersoon of voorwaarden)"
              onChange={(e) => setNotitie(e.target.value)}
              onBlur={() => {
                if ((notitie || '') !== (regel.notitie || '')) bewaar({ notitie });
              }}
              style={css(`${INVOER} resize: vertical; line-height: 1.5;`)}
            />
          </label>
        </div>

        <div className="fwk-pf-acties">
          {/* FASE5 */}
          <BespreekLink projectId={regel.projectId} fundingId={regel.id} naam={naam} stijl="min-height: 36px;" />
          {bevestig ? (
            <span style={css('display: inline-flex; gap: 8px; flex-wrap: wrap;')}>
              <button
                type="button"
                onClick={() => onVerwijder(regel.id)}
                style={css("cursor: pointer; min-height: 40px; padding: 0 14px; border: 1px solid #E3B8B1; border-radius: 999px; background: #F9ECEA; color: #9E3B2C; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
              >
                Ja, verwijderen
              </button>
              <button
                type="button"
                onClick={() => setBevestig(false)}
                style={css("cursor: pointer; min-height: 40px; padding: 0 14px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
              >
                Annuleren
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Verwijderen uit dekkingsplan, ${naam}`}
              onClick={() => setBevestig(true)}
              style={css("cursor: pointer; min-height: 40px; padding: 0 6px; border: none; background: none; color: #9E3B2C; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700;")}
            >
              Verwijderen
            </button>
          )}
        </div>
      </div>
      {fout && (
        <div role="alert" data-testid="pf-regel-fout" style={css(`${TEKST} margin-top: 8px; font-size: 13px; font-weight: 700; color: #9E3B2C;`)}>
          {fout}
        </div>
      )}
    </article>
  );
}

export default function ProjectfinancieringTab({ project, financiering, dekking, toonActieplan = true }) {
  const { status, fout, regels, wijzig, verwijder, laad } = financiering;
  const [actieVersie, setActieVersie] = useState(0);
  const [bronRijen, setBronRijen] = useState([]);

  // De bronstatus per regel komt uit de tabel die de SERVER bijhoudt: ze blijft dus staan na verversen en na opslaan.
  const aantalRegels = regels.length;

  useEffect(() => {
    let actief = true;

    if (project && project.id && status === 'klaar') {
      leesBronControles(project.id).then((res) => {
        if (actief) setBronRijen(res.rijen);
      });
    }

    return () => {
      actief = false;
    };
  }, [project && project.id, status, aantalRegels, actieVersie]);

  return (
    <div data-testid="tab-projectfinanciering" style={css('display: flex; flex-direction: column; gap: 18px;')}>
      <style>{CSS_TAB}</style>

      {status === 'geen-database' && <Melding toon="waarschuwing">Dit project is nog niet opgeslagen in uw account. Sla het project op om een dekkingsplan op te bouwen.</Melding>}
      {status === 'fout' && (
        <Melding toon="waarschuwing" testid="pf-fout" rol="alert">
          {fout === 'niet-beschikbaar'
            ? 'Projectfinanciering is nog niet beschikbaar in uw omgeving. Uw projectgegevens zijn niet aangetast.'
            : 'Het dekkingsplan kon niet worden geladen. Ververs de pagina of probeer het later opnieuw.'}
        </Melding>
      )}

      <VoorstelWerkruimte
        project={project}
        opgeslagen={status !== 'geen-database' && Boolean(project && project.id)}
        onOpgeslagen={() => {
          laad();
          setActieVersie((v) => v + 1);
        }}
      />

      <Blok
        testid="pf-regels"
        titel="Regelingen in het dekkingsplan"
        aantal={status === 'klaar' ? regels.length : null}
        actie={
          <a href="#/kompas/deadlines" className="fwk-wp-link" data-testid="pf-zoek-regelingen">
            Regelingen zoeken
          </a>
        }
        kaal
      >
        {status === 'klaar' && project && project.id && (
          <div style={css('margin-bottom: 12px;')}>
            <FinancierFormulier projectId={project.id} onKlaar={laad} />
          </div>
        )}

        {status === 'laden' && <Leeg>Dekkingsplan wordt geladen…</Leeg>}

        {status === 'klaar' && regels.length === 0 && (
          <div data-testid="pf-leeg" style={css(`${TEKST} padding: 16px 18px; border: 1px dashed #CFDDD5; border-radius: 12px; color: #687974;`)}>
            Nog geen financiering in het dekkingsplan.{' '}
            <a href="#/kompas/deadlines" className="fwk-wp-link">
              Regelingen zoeken
            </a>
          </div>
        )}

        {regels.length > 0 && (
          <>
            <div className="fwk-pf-kop" aria-hidden="true">
              {['Financier, fonds of regeling', 'Aangevraagd', 'Toegekend', 'Status', 'Deadline', 'Herinnering'].map((k) => (
                <span key={k} style={css(LABEL)}>
                  {k}
                </span>
              ))}
            </div>
            <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
              {regels.map((r) => (
                <Regel key={r.id} regel={r} bron={bronVoorRegel(r, bronRijen)} onWijzig={wijzig} onVerwijder={verwijder} />
              ))}
            </div>
          </>
        )}
      </Blok>

      <Blok
        testid="pf-dekking"
        titel="Dekking van de begroting"
        actie={
          <HelpKnop label="Hoe telt dit?">
            <p>Toegekend telt het toegekende bedrag (is dat leeg, dan het aangevraagde bedrag). Aangevraagd telt regels met status Aangevraagd.</p>
            <p>Gepland telt het bedrag van regels met status Interessant of In voorbereiding. Eigen bijdrage staat bij de projectgegevens.</p>
          </HelpKnop>
        }
      >
        {dekking.heeftBegroting ? (
          <>
            <Voortgangsbalk dekking={dekking} projectNaam={project.naam || 'dit project'} hoogte={10} />
            <div data-testid="pf-samenvatting" style={css(`${TEKST} margin-top: 8px; font-weight: 700; color: ${dekking.volledigGedekt ? '#2F6D47' : '#2C4A5E'};`)}>
              {dekking.volledigGedekt ? 'Volledig gedekt' : `Nog te financieren: ${formatEuro(dekking.nogNodig)}`}
            </div>
          </>
        ) : (
          <Leeg>
            Nog geen begroting.{' '}
            <a href={`#/kompas/projecten/${project.id}?bewerk=1`} className="fwk-wp-link">
              Begroting invullen
            </a>
          </Leeg>
        )}
        <Legenda dekking={dekking} />
        {dekking.heeftBegroting && (
          <div data-testid="pf-nog-te-plannen" style={css(`${TEKST} margin-top: 10px; font-size: 13px; color: #4B5C58;`)}>
            Waarvan nog niet gepland: <strong>{formatEuro(dekking.nogTePlannen)}</strong>
          </div>
        )}
      </Blok>

      {toonActieplan && status === 'klaar' && project && project.id && (
        <section id="pf-acties" data-testid="pf-acties" style={css('box-sizing: border-box; padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}>
          <ActieplanVoorProject key={actieVersie} project={project} regels={regels} />
        </section>
      )}
    </div>
  );
}
