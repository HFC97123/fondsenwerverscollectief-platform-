// Subsidieadvies › Overzicht en Fondsen (/kompas/advies en /kompas/advies/fondsen).
// Geen eigen opslag en geen eigen rekenregels: alles komt uit dezelfde bronnen als het Dashboard en het projectdossier
// (useProjectFinanciering, dekkingVanProject, voortgang van Projectinformatie). Begroting, Deadlines en Indienen zijn de
// bestaande pagina's; zie adviesLinks.js voor de koppeling.
import React, { useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Blok, Leeg, Melding, PaginaKop, WerkPagina } from '../../../shared/ui/werkplek.jsx';
import { Button } from '../../../shared/ui/index.js';
import { useApp } from '../useKompasApp.js';
import { useKompas } from '../KompasStore.jsx';
import { useHeeftWerkruimte } from '../werkruimteRechten.js';
import { useProjectFinanciering } from '../financiering/useProjectFinanciering.js';
import { KLEUR, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { dagenTekst, dekkingVanProject, eerstvolgendeDeadline, formatDatum, formatEuro, periodeTekst } from '../financiering/dekkingsplan.js';
import ProjectfinancieringTab from '../projectdossier/ProjectfinancieringTab.jsx';
import ProjectBewerkFormulier from '../projectdossier/ProjectBewerkFormulier.jsx';
import { voortgang } from '../projectinformatie/projectinformatie.js';
import { adviesDeel, kiesProjectId, leesProjectParam, stapHref } from './adviesLinks.js';
import { useAdviesProjecten, useHash } from './AdviesSubnav.jsx';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;";

const KAART = 'box-sizing: border-box; padding: 24px 26px; border: 1px solid #E1EAE4; border-radius: 24px; background: #FFFFFF; min-width: 0; display: flex; flex-direction: column;';
const BLOK = 'background: #F6F8F7; border: 1px solid #E1EAE4; border-radius: 16px; padding: 12px 16px; margin-top: 14px;';

const CSS_OVERZICHT = `
.fwk-av-raster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
@media (max-width: 820px) { .fwk-av-raster { grid-template-columns: 1fr; } }
.fwk-av-kaartlink { color: #4E9A6C; font-weight: 800; text-decoration: none; font-size: 14px; }
.fwk-av-kaartlink:hover { text-decoration: underline; }
`;

function Kaart({ nr, titel, uitleg, href, linkTekst, testid, children }) {
  return (
    <section data-testid={testid} style={css(KAART)}>
      <div style={css('display: flex; align-items: center; gap: 12px;')}>
        <span aria-hidden="true" style={css("width: 38px; height: 38px; border-radius: 50%; background: #EAEFF3; display: inline-grid; place-items: center; font-family: 'Newsreader', serif; font-size: 18px; color: #2C4A5E; flex: none;")}>
          {nr}
        </span>
        <h2 style={css("margin: 0; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>{titel}</h2>
      </div>
      <p style={css(`${TEKST} margin: 10px 0 0;`)}>{uitleg}</p>
      <div style={css(`${BLOK} flex: 1 1 auto;`)}>{children}</div>
      <div style={css('margin-top: 14px; text-align: right;')}>
        <a className="fwk-av-kaartlink" href={href}>
          {linkTekst} →
        </a>
      </div>
    </section>
  );
}

const Rij = ({ children, rechts }) => (
  <div style={css(`${TEKST} display: flex; justify-content: space-between; gap: 12px; padding: 3px 0;`)}>
    <span>{children}</span>
    {rechts != null && <b style={css('color: #2C4A5E; white-space: nowrap;')}>{rechts}</b>}
  </div>
);

const lijst = (w) => (Array.isArray(w) ? w.join(', ') : w || '');

// De projectgegevens waarop de fondsmatching rekent. Zelfde formulier en dezelfde opslag als bij Mijn Subsidie Kompas › Projecten.
function Projectgegevens({ project, store }) {
  const [bewerk, setBewerk] = useState(false);
  const [melding, setMelding] = useState('');
  const velden = [
    ['Disciplines', lijst(project.discipline)],
    ['Doelgroep', lijst(project.doelgroep)],
    ['Werkgebied / locatie', project.regio],
    ['Looptijd', periodeTekst(project.periodeVan, project.periodeTot)],
    ['Totale begroting', project.begroting !== '' && project.begroting != null ? formatEuro(Number(project.begroting)) : ''],
  ];

  return (
    <div style={css('margin-bottom: 18px;')}>
      <Blok
        testid="advies-projectgegevens"
        titel="Projectgegevens"
        actie={
          <span style={css('display: inline-flex; gap: 16px;')}>
            {!bewerk && (
              <button type="button" data-testid="advies-bewerken" className="fwk-wp-link" onClick={() => { setMelding(''); setBewerk(true); }}>
                Aanpassen
              </button>
            )}
            <a className="fwk-wp-link" data-testid="advies-nieuw-project" href="#/kompas/projecten?nieuw=1">
              + Nieuw project
            </a>
          </span>
        }
      >
        {bewerk ? (
          <ProjectBewerkFormulier project={project} store={store} onAnnuleer={() => setBewerk(false)} onKlaar={(tekst) => { setBewerk(false); setMelding(tekst || ''); }} />
        ) : (
          <>
            {melding && <Melding testid="advies-melding">{melding}</Melding>}
            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px 22px;')}>
              {velden.map(([naam, waarde]) => (
                <div key={naam} style={css('min-width: 0;')}>
                  <div style={css("font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9AA6A2;")}>{naam}</div>
                  <div style={css(`${TEKST} font-size: 14px; color: ${waarde ? '#2E3A38' : '#9AA6A2'}; overflow-wrap: anywhere;`)}>{waarde || 'Nog niet ingevuld'}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Blok>
    </div>
  );
}

function Overzicht({ project, paid }) {
  const financiering = useProjectFinanciering(project && paid ? project.id : null);
  const regels = financiering.status === 'klaar' ? financiering.regels : [];
  const dekking = useMemo(() => dekkingVanProject(project, regels), [project, regels]);
  const volgende = useMemo(() => eerstvolgendeDeadline(regels, new Date()), [regels]);
  const pi = voortgang(project);
  const begrotingRegels = Array.isArray(project.budgetRegels) ? project.budgetRegels.length : 0;

  return (
    <div className="fwk-av-raster" data-testid="advies-overzicht">
      <Kaart nr="1" titel="Vind de fondsen die echt passen" uitleg="Fondsmatching op uw projectgegevens: discipline, doelgroep, werkgebied en bedrag." href={stapHref('fondsen', project.id)} linkTekst="Naar de fondsmatching" testid="advies-kaart-fondsen">
        <Rij rechts={financiering.status === 'klaar' ? regels.length : '…'}>Regelingen en financiers in het plan</Rij>
        <Rij>Eigen deadlines en herinneringen staan bij stap 3.</Rij>
      </Kaart>

      <Kaart nr="2" titel="Dek uw hele begroting" uitleg="Uw begroting per subcategorie, met de financiers die hem dekken." href={stapHref('begroting', project.id)} linkTekst="Naar de begroting" testid="advies-kaart-begroting">
        <Rij rechts={dekking.heeftBegroting ? formatEuro(dekking.begroting) : '—'}>Begroting</Rij>
        {dekking.heeftBegroting && (
          <>
            <div style={css('margin: 8px 0;')}>
              <Voortgangsbalk dekking={dekking} projectNaam={project.naam || 'dit project'} />
            </div>
            <div style={css(`${TEKST} font-size: 13px;`)}>
              <span style={css(`color: ${KLEUR.toegekend};`)}>●</span> {formatEuro(dekking.toegekend)} toegekend ·{' '}
              <span style={css(`color: ${KLEUR.aangevraagd};`)}>●</span> {formatEuro(dekking.aangevraagd)} aangevraagd · {dekking.volledigGedekt ? 'volledig gedekt' : `${formatEuro(dekking.nogNodig)} nog te dekken`}
            </div>
          </>
        )}
        <Rij>{begrotingRegels ? `${begrotingRegels} begrotingsregels` : 'Nog geen begrotingsregels'}</Rij>
      </Kaart>

      <Kaart nr="3" titel="Houd elke deadline in beeld" uitleg="Een actieplan met herinneringen, zodat u uw tijd aan schrijven besteedt." href={stapHref('deadlines', project.id)} linkTekst="Naar de deadlines" testid="advies-kaart-deadlines">
        <Rij rechts={volgende ? dagenTekst(volgende.dagen) : null}>{volgende ? `Eerstvolgende: ${volgende.naam}` : 'Geen komende deadline'}</Rij>
        {volgende && <Rij>{formatDatum(volgende.datum)}</Rij>}
      </Kaart>

      <Kaart nr="4" titel="Dien sterker in" uitleg="Het projectdossier, een projectplan op maat en een beoordeling vóór u indient." href={stapHref('indienen', project.id)} linkTekst="Naar indienen" testid="advies-kaart-indienen">
        <Rij rechts={`${pi.ingevuld} van ${pi.totaal}`}>Projectdossier ingevuld</Rij>
        <Rij>Daarna: projectplan en beoordeling per fonds.</Rij>
      </Kaart>
    </div>
  );
}

export default function AdviesPage({ param }) {
  const app = useApp();
  const store = useKompas();
  const paid = useHeeftWerkruimte();
  const hash = useHash();
  const projecten = useAdviesProjecten();
  const projectId = kiesProjectId(projecten, leesProjectParam(hash));
  const project = projecten.find((p) => p.id === projectId) || null;
  const fondsen = (param || adviesDeel(hash)) === 'fondsen';
  const financiering = useProjectFinanciering(fondsen && project && paid ? project.id : null);
  const regels = financiering.status === 'klaar' ? financiering.regels : [];
  const dekking = useMemo(() => dekkingVanProject(project || {}, regels), [project, regels]);

  if (!paid) {
    return (
      <WerkPagina testid="advies">
        <PaginaKop titel="Subsidieadvies" />
        <Melding toon="info">Subsidieadvies hoort bij Pro en Premium.</Melding>
        <div style={css('margin-top: 14px;')}>
          <Button variant="dark" onClick={app.goAbonnementen}>
            Bekijk de abonnementen
          </Button>
        </div>
      </WerkPagina>
    );
  }

  if (!project) {
    return (
      <WerkPagina testid="advies">
        <PaginaKop titel="Subsidieadvies" />
        {store.projectenKlaar ? (
          <Leeg>
            Nog geen project.{' '}
            <a href="#/kompas/projecten?nieuw=1" className="fwk-wp-link">
              Project aanmaken
            </a>
          </Leeg>
        ) : (
          <div style={css(`${TEKST} color: #7B8985;`)}>Projecten worden geladen…</div>
        )}
      </WerkPagina>
    );
  }

  return (
    <WerkPagina testid="advies">
      <style>{CSS_OVERZICHT}</style>
      <PaginaKop
        titel={fondsen ? 'Fondsmatching' : 'Overzicht'}
        meta={project.naam || 'Naamloos project'}
        help={fondsen ? <p>Vul de projectgegevens in waarop Subsidie Kompas matcht. Daaronder ziet u welke regelingen en financiers in het plan van dit project staan, en hoe ze de begroting dekken.</p> : <p>Subsidie Kompas helpt u in vier stappen: fondsen vinden, de begroting dekken, deadlines bewaken en sterk indienen.</p>}
      />
      {fondsen ? (
        <>
          <Projectgegevens project={project} store={store} />
          <ProjectfinancieringTab project={project} financiering={financiering} dekking={dekking} toonActieplan={false} />
        </>
      ) : (
        <Overzicht project={project} paid={paid} />
      )}
    </WerkPagina>
  );
}
