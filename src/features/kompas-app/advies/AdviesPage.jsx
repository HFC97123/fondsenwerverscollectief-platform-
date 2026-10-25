// Subsidieadvies › Overzicht en Fondsen (/kompas/advies en /kompas/advies/fondsen).
// Geen eigen opslag en geen eigen rekenregels: alles komt uit dezelfde bronnen als het Dashboard en het projectdossier
// (useProjectFinanciering, dekkingVanProject, voortgang van Projectinformatie). Begroting, Deadlines en Indienen zijn de
// bestaande pagina's; zie adviesLinks.js voor de koppeling.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Blok, Leeg, Melding, PaginaKop, WerkPagina } from '../../../shared/ui/werkplek.jsx';
import { Button } from '../../../shared/ui/index.js';
import { haalThemaAantallen } from '../../../data/services/projectFinanciering.js';
import { useApp } from '../useKompasApp.js';
import { useKompas } from '../KompasStore.jsx';
import { useHeeftWerkruimte } from '../werkruimteRechten.js';
import { useProjectFinanciering } from '../financiering/useProjectFinanciering.js';
import { KLEUR, StatusChip, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { dagenTekst, dagenTot, dekkingVanProject, eerstvolgendeDeadline, formatDatum, formatEuro, isKomendeDeadline, periodeTekst } from '../financiering/dekkingsplan.js';
import { useActieplan } from '../financiering/useActieplan.js';
import { bouwActiesEnDeadlines } from '../financiering/actiesEnDeadlines.js';
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

// Groene voortgangsbalk met percentage (het projectdossier voor de aanvraag).
function GroeneBalk({ ingevuld, totaal, label }) {
  const pct = totaal > 0 ? Math.round((ingevuld / totaal) * 100) : 0;

  return (
    <div data-testid="advies-dossierbalk" style={css('margin: 8px 0 4px;')}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={css('height: 12px; border-radius: 999px; background: #E9EFEB; overflow: hidden;')}
      >
        <span style={css(`display: block; height: 100%; width: ${pct}%; border-radius: 999px; background: ${KLEUR.toegekend}; transition: width .3s ease;`)} />
      </div>
      <div style={css(`${TEKST} font-size: 13px; margin-top: 6px;`)}>
        {ingevuld} van {totaal} onderdelen ingevuld · {pct}%
      </div>
    </div>
  );
}

// Een korte, aanmoedigende zin bij de stand van het projectdossier.
function dossierZin(ingevuld, totaal) {
  if (totaal <= 0 || ingevuld >= totaal) {
    return 'Uw projectdossier is compleet. Daarmee kunt u een sterk projectplan en een beoordeling per fonds laten maken.';
  }

  if (ingevuld === 0) {
    return 'Begin met het projectdossier: hoe completer het is, hoe sterker uw aanvraag en hoe beter het projectplan op maat.';
  }

  return ingevuld / totaal >= 0.5 ? 'U bent al ver. Vul de laatste onderdelen aan voor een sterke aanvraag.' : 'Een goed begin. Elk onderdeel dat u invult maakt uw aanvraag sterker.';
}

// De belangrijkste regel om nu op te handelen: de eerstvolgende komende deadline van een regel die nog niet is
// ingediend; zonder deadline de regel met het hoogste bedrag.
export function belangrijksteRegel(regels, nu) {
  const open = (regels || []).filter((r) => r && (r.status === 'interesting' || r.status === 'preparing'));
  const komend = open.filter((r) => isKomendeDeadline(r, nu)).sort((a, b) => String(a.deadline).slice(0, 10).localeCompare(String(b.deadline).slice(0, 10)) || String(a.naam).localeCompare(String(b.naam), 'nl'));

  if (komend[0]) {
    return komend[0];
  }

  return open.slice().sort((a, b) => (b.requested || 0) - (a.requested || 0) || String(a.naam).localeCompare(String(b.naam), 'nl'))[0] || null;
}

const VOORBEELD_CHIP = 'display: inline-flex; padding: 3px 10px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-family: \'Mulish\', sans-serif; font-size: 12px; font-weight: 800; white-space: nowrap;';

// Zolang er nog geen fondsmatching is gedaan: een voorbeeld van wat de matching oplevert, in de taal van dit project.
function VoorbeeldFondsen({ project }) {
  const discipline = Array.isArray(project.discipline) ? project.discipline[0] : project.discipline;
  const regio = String(project.regio || '').trim();
  const rijen = [
    [discipline ? `Landelijk fonds: ${discipline}` : 'Landelijk cultuurfonds: Fotografie', 'tot € 25.000', 'Open'],
    [regio ? `Gemeentelijk fonds ${regio}` : 'Gemeentelijk cultuurfonds', 'tot € 10.000', 'Doorlopend'],
    ['Particulier fonds', 'tot € 5.000', 'Open'],
  ];

  return (
    <div data-testid="advies-fondsen-voorbeeld">
      <div style={css(`${TEKST} margin-bottom: 8px;`)}>Vertel over uw project en zie welke fondsen en regelingen passen, met bedrag, voorwaarden en deadline.</div>
      <div style={css("font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9AA6A2; margin-bottom: 4px;")}>Voorbeeld</div>
      {rijen.map(([naam, bedrag, chip]) => (
        <div key={naam} style={css(`${TEKST} display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; opacity: 0.85;`)}>
          <b style={css('color: #2C4A5E; min-width: 0; overflow-wrap: anywhere;')}>{naam}</b>
          <span style={css('display: inline-flex; align-items: center; gap: 10px; white-space: nowrap;')}>
            {bedrag}
            <span style={css(VOORBEELD_CHIP)}>{chip}</span>
          </span>
        </div>
      ))}
      <div style={css(`${TEKST} margin-top: 8px;`)}>Dit is een voorbeeld. Start de fondsmatching om te zien wat echt bij {project.naam || 'dit project'} past.</div>
    </div>
  );
}

// Na de fondsmatching: bovenaan het fonds waar nu actie op nodig is, daaronder hoeveel er verder in het plan staat.
function BelangrijksteFonds({ regels, nu }) {
  const top = belangrijksteRegel(regels, nu);
  const dagen = top ? dagenTot(top.deadline, nu) : null;
  const andere = regels.length - (top ? 1 : 0);

  return (
    <div data-testid="advies-fondsen-top">
      {top && (
        <div data-testid="advies-fondsen-eerste" style={css('padding: 4px 0 10px; border-bottom: 1px solid #E1EAE4; margin-bottom: 8px;')}>
          <div style={css("font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #4E9A6C;")}>Nu aan de beurt</div>
          <div style={css(`${TEKST} display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 2px;`)}>
            <b style={css('color: #2C4A5E; font-size: 15.5px; min-width: 0; overflow-wrap: anywhere;')}>{top.naam}</b>
            <span style={css('display: inline-flex; align-items: center; gap: 10px; white-space: nowrap;')}>
              {top.requested != null && <span>{formatEuro(top.requested)}</span>}
              <StatusChip status={top.status} />
            </span>
          </div>
          <div style={css(`${TEKST} font-size: 13.5px;`)}>
            {dagen != null && dagen >= 0 ? `Aanvraag indienen vóór ${formatDatum(top.deadline)} (${dagenTekst(dagen)}).` : 'Toets passendheid, kansrijkheid en indiendatum of vergaderdatum met de financier.'}
          </div>
        </div>
      )}
      <Rij rechts={regels.length}>Passende fondsen en regelingen in uw plan</Rij>
      {andere > 0 && top && <Rij>Plus {andere} {andere === 1 ? 'ander fonds' : 'andere fondsen'}, te zien bij de fondsmatching.</Rij>}
    </div>
  );
}

const THEMA_PIL = "display: inline-flex; align-items: center; gap: 6px; margin: 4px 6px 0 0; padding: 5px 12px; border-radius: 999px; border: 1.5px solid #D3DFE4; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; text-decoration: none;";

// Onder de fondsen in het plan: de drie thema's van het project met de meeste fondsen in de database. Een klik gaat naar de fondsmatching.
function OokOpThema({ project }) {
  const [thema, setThema] = useState([]);

  useEffect(() => {
    let actief = true;

    haalThemaAantallen(project.id).then((r) => {
      if (actief) setThema(r.slice(0, 3));
    });

    return () => {
      actief = false;
    };
  }, [project.id]);

  if (!thema.length) {
    return null;
  }

  return (
    <div data-testid="advies-fondsen-thema" style={css('margin-top: 10px; padding-top: 10px; border-top: 1px solid #E1EAE4;')}>
      <div style={css("font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #7B8985;")}>Ook mogelijk passend, op thema</div>
      <div>
        {thema.map((t) => (
          <a key={t.thema} data-testid="advies-thema-pil" href={stapHref('fondsen', project.id)} style={css(THEMA_PIL)}>
            {t.thema} <b style={css('color: #4E9A6C; font-weight: 800;')}>{t.aantal} {t.aantal === 1 ? 'fonds' : 'fondsen'}</b>
          </a>
        ))}
      </div>
    </div>
  );
}

function Overzicht({ project, paid }) {
  const financiering = useProjectFinanciering(project && paid ? project.id : null);
  const regels = financiering.status === 'klaar' ? financiering.regels : [];
  const dekking = useMemo(() => dekkingVanProject(project, regels), [project, regels]);
  const volgende = useMemo(() => eerstvolgendeDeadline(regels, new Date()), [regels]);
  const nu = useMemo(() => new Date(), []);
  // Het actieplan van dit project: dezelfde afleiding als op de actieplanpagina en het dashboard (opgeslagen acties en afgeleide acties).
  const plan = useActieplan(project && paid ? [project.id] : []);
  const acties = useMemo(
    () => (financiering.status === 'klaar' && plan.status === 'klaar' ? bouwActiesEnDeadlines({ project, regels, taken: plan.actieVoor(project.id), nu }).filter((i) => i.status !== 'done') : []),
    [financiering.status, plan, project, regels, nu],
  );
  const pi = voortgang(project);
  const gedektPct = dekking.heeftBegroting && dekking.begroting > 0 ? Math.min(100, Math.round(((dekking.toegekend + dekking.aangevraagd + dekking.overige) / dekking.begroting) * 100)) : 0;
  const begrotingRegels = Array.isArray(project.budgetRegels) ? project.budgetRegels.length : 0;

  return (
    <div className="fwk-av-raster" data-testid="advies-overzicht">
      <Kaart nr="1" titel="Vind de fondsen die echt passen" uitleg="Fondsmatching op uw projectgegevens: discipline, doelgroep, werkgebied en bedrag." href={stapHref('fondsen', project.id)} linkTekst={financiering.status === 'klaar' && regels.length === 0 ? 'Start de fondsmatching' : 'Naar de fondsmatching'} testid="advies-kaart-fondsen">
        {financiering.status !== 'klaar' ? <Rij>Fondsen worden geladen…</Rij> : regels.length > 0 ? <BelangrijksteFonds regels={regels} nu={nu} /> : <VoorbeeldFondsen project={project} />}
        {financiering.status === 'klaar' && paid && <OokOpThema project={project} />}
      </Kaart>

      <Kaart nr="2" titel="Begroting en dekkingsplan" uitleg="Uw begroting per subcategorie, met de financiers die hem dekken." href={stapHref('begroting', project.id)} linkTekst="Naar begroting en dekkingsplan" testid="advies-kaart-begroting">
        <Rij rechts={dekking.heeftBegroting ? formatEuro(dekking.begroting) : '—'}>Begroting</Rij>
        {dekking.heeftBegroting && (
          <>
            <Rij rechts={`${gedektPct}%`}>Gedekt</Rij>
            <div style={css('margin: 8px 0;')}>
              <Voortgangsbalk dekking={dekking} projectNaam={project.naam || 'dit project'} />
            </div>
            <div style={css(`${TEKST} font-size: 13px;`)}>
              <span style={css(`color: ${KLEUR.toegekend};`)}>●</span> {formatEuro(dekking.toegekend)} toegekend ·{' '}
              {dekking.overige > 0 && (
                <>
                  <span data-testid="advies-eigen-bijdrage"><span style={css(`color: ${KLEUR.overige};`)}>●</span> {formatEuro(dekking.overige)} eigen bijdrage</span> ·{' '}
                </>
              )}
              <span style={css(`color: ${KLEUR.aangevraagd};`)}>●</span> {formatEuro(dekking.aangevraagd)} aangevraagd · {dekking.volledigGedekt ? 'volledig gedekt' : `${formatEuro(dekking.nogNodig)} nog te dekken`}
            </div>
          </>
        )}
        <Rij>{begrotingRegels ? `${begrotingRegels} begrotingsregels` : 'Nog geen begrotingsregels'}</Rij>
      </Kaart>

      <Kaart nr="3" titel="Houd uw actieplan bij" uitleg="Een actieplan met herinneringen, zodat u uw tijd aan schrijven besteedt." href={stapHref('deadlines', project.id)} linkTekst="Naar het actieplan" testid="advies-kaart-deadlines">
        {acties.length > 0 ? (
          <div data-testid="advies-acties">
            <Rij rechts={acties.some((a) => a.dagen != null && a.dagen < 0) ? `${acties.filter((a) => a.dagen != null && a.dagen < 0).length} te laat` : null}>
              {acties.length} {acties.length === 1 ? 'actie' : 'acties'} open
            </Rij>
            {acties.slice(0, 3).map((a) => (
              <div key={a.sleutel} data-testid="advies-actie">
                <Rij rechts={a.datum ? (a.dagen != null && a.dagen < 0 ? 'te laat' : dagenTekst(a.dagen)) : 'zonder datum'}>{a.titel}</Rij>
              </div>
            ))}
            {acties.length > 3 && <Rij>en {acties.length - 3} {acties.length - 3 === 1 ? 'andere actie' : 'andere acties'}</Rij>}
          </div>
        ) : (
          <>
            <Rij rechts={volgende ? dagenTekst(volgende.dagen) : null}>{volgende ? `Eerstvolgende: ${volgende.naam}` : 'Geen komende deadline'}</Rij>
            {volgende && <Rij>{formatDatum(volgende.datum)}</Rij>}
          </>
        )}
      </Kaart>

      <Kaart nr="4" titel="Dien sterker in" uitleg="Het projectdossier, een projectplan op maat en een beoordeling vóór u indient." href={stapHref('indienen', project.id)} linkTekst="Naar indienen" testid="advies-kaart-indienen">
        <Rij>Projectdossier voor de aanvraag</Rij>
        <GroeneBalk ingevuld={pi.ingevuld} totaal={pi.totaal} label="Projectdossier ingevuld" />
        <Rij>{dossierZin(pi.ingevuld, pi.totaal)}</Rij>
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
