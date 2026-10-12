// Projecten: overzicht van alle projecten (klikbare kaarten) en het lichte aanmaakformulier (NieuwProjectFormulier).
// Een bestaand project bewerkt u in het projectdossier (tab Overzicht); documenten beheert u daar in de tab Documenten.
// Cofinanciers, eerdere toekenningen en regelingen staan in Projectfinanciering
// (subsidie_kompas_program_funding), niet in dit formulier.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { PROJECT_EMPTY, useKompas } from './KompasStore.jsx';
import NieuwProjectFormulier from './NieuwProjectFormulier.jsx';
import { haalClassificatiesOp } from '../../data/services/classificaties.js';
import { Button, EmptyState, Notice, Panel, PanelHeader, Toggle, selectStijl } from '../../shared/ui/index.js';
import { isEchtId } from '../../data/services/projecten.js';
import { CSS_KLIKKAART } from './klikKaart.js';
import KaartMenu, { CSS_KAARTMENU } from './KaartMenu.jsx';
import BespreekProjectKnop from './BespreekProjectKnop.jsx';
import { useHeeftWerkruimte } from './werkruimteRechten.js';
import { useDekkingsplannen } from './financiering/useProjectFinanciering.js';
import { projectFinancieringHref } from './financiering/deeplinks.js';
import { STATUS_LABEL, bedragenVoorOpslaan, dekkingVanProject, formatDatum, formatEuro, komendeDeadlines, periodeTekst, teFinancieren } from './financiering/dekkingsplan.js';

export default function ProjectenPage() {
  const app = useApp();
  const store = useKompas();
  const paid = useHeeftWerkruimte();

  const [form, setForm] = useState(null);
  const [melding, setMelding] = useState('');
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  // Doelgroep gebruikt dezelfde centrale classificatielijst als het
  // organisatieprofiel (zie data/services/classificaties.js) in plaats van
  // vrije tekst, zodat er maar één plek is waar doelgroepen worden beheerd.
  const [doelgroepen, setDoelgroepen] = useState([]);
  const [themas, setThemas] = useState([]);
  const [regios, setRegios] = useState([]);

  useEffect(() => {
    let actief = true;

    haalClassificatiesOp().then((lijst) => {
      if (actief) {
        setDoelgroepen(lijst.doelgroepen || []);
        setThemas(lijst.themas || []);
        setRegios(lijst.regios || []);
      }
    });

    return () => {
      actief = false;
    };
  }, []);

  // Dekkingsplannen: dezelfde bron (kompas_dekkingsplan) als het projectdossier en het Dashboard.
  const projectIds = useMemo(() => (paid ? (store.projects || []).filter((p) => !p.gearchiveerd).map((p) => p.id) : []), [paid, store.projects]);
  const financiering = useDekkingsplannen(projectIds);

  const komende = useMemo(() => komendeDeadlines(store.projects, financiering.perProject, new Date(), 3), [store.projects, financiering.perProject]);

  // Oude deep link: #/kompas/projecten?bewerk=<id> -> het bewerkformulier staat in het projectdossier.
  useEffect(() => {
    const m = /[?&]bewerk=([^&]+)/.exec(window.location.hash || '');

    if (paid && m && m[1] !== '1') {
      window.location.replace(`#/kompas/projecten/${decodeURIComponent(m[1])}?bewerk=1`);
    }
  }, [paid]);

  if (!paid) {
    return (
      <Panel>
        <PanelHeader title="Projecten"
          intro="Met Pro en Premium legt u per project de looptijd en begroting vast, en volgt u de financiering: toegekend, aangevraagd en cofinanciers."
        />
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Panel>
    );
  }

  const setVeld = (key, val) => {
    setForm((cur) => ({ ...cur, [key]: val }));
    setMelding('');
  };

  const opslaan = () => {
    if (!String(form.naam || '').trim()) {
      setFout('Vul in ieder geval de naam van het project in.');

      return;
    }

    if (form.periodeVan && form.periodeTot && /^\d{4}-\d{2}-\d{2}$/.test(form.periodeVan) && /^\d{4}-\d{2}-\d{2}$/.test(form.periodeTot) && form.periodeTot < form.periodeVan) {
      setFout('De einddatum van de looptijd ligt voor de startdatum.');

      return;
    }

    // Bedragen strikt omzetten (geen raden); het te financieren bedrag wordt bij het opslaan afgeleid.
    const bedragen = bedragenVoorOpslaan(form);

    if (!bedragen.ok) {
      setFout(bedragen.fout);

      return;
    }

    const { nieuw, ...zonderVlag } = form;
    const teBewaren = { ...zonderVlag, begroting: bedragen.begroting, eigenBijdrage: bedragen.eigenBijdrage, gevraagd: bedragen.begroting === '' ? '' : teFinancieren(bedragen.begroting, bedragen.eigenBijdrage) };
    const bewaar = store.saveProject(teBewaren);

    setFout('');
    setBezig(true);

    // Lukt het bewaren in de database niet, dan zeggen we dat ook; het formulier blijft dan open.
    Promise.resolve(bewaar).then((id) => {
      setBezig(false);

      if (id === null) {
        setMelding('');
        setFout('Het project kon niet in de database worden opgeslagen. Probeer het opnieuw.');

        return;
      }

      setForm(null);

      if (nieuw && isEchtId(id)) {
        // Na het aanmaken direct naar het projectdossier.
        window.location.hash = `#/kompas/projecten/${id}`;

        return;
      }

      setMelding('Project opgeslagen.');
    });
  };

  return (
    <Panel>
      <PanelHeader title="Projecten"
        intro="Werft u per project of programma? Leg hier per project de looptijd en begroting vast; de financiering (toegekend, aangevraagd, cofinanciers) volgt u in het projectdossier. Subsidie Kompas gebruikt dit naast uw organisatieprofiel bij fondsselecties en aanvragen."
      />

      <style>{`${CSS_KLIKKAART}${CSS_KAARTMENU}`}</style>

      {komende.length > 0 && !(form && form.nieuw) && (
        <div style={css('margin-bottom: 16px; padding: 14px 18px; border: 1px solid #D6E3E9; border-radius: 20px; background: #EAF1F6;')}>
          <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 12px;')}>
            <span style={css('font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
              Komende deadlines uit uw projecten
            </span>
            <span style={css('display: flex; align-items: center; gap: 14px; flex-wrap: wrap;')}>
              <select
                value={String(store.reminderDays)}
                onChange={(e) => store.patch({ reminderDays: Number(e.target.value) })}
                aria-label="Wanneer wilt u een herinnering"
                style={selectStijl}
              >
                {[7, 14, 21, 30].map((d) => (
                  <option key={d} value={String(d)}>
                    {d} dagen voor de deadline
                  </option>
                ))}
              </select>
              <Toggle
                on={store.reminderMail}
                onChange={() => store.patch({ reminderMail: !store.reminderMail })}
                label={store.reminderMail ? 'E-mail aan' : 'E-mail uit'}
                ariaLabel="Herinnering per e-mail"
              />
            </span>
          </div>

          <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
            {komende.map((k) => (
              <div key={k.sleutel} data-testid="projecten-komende-deadline" style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 12px 16px; border-radius: 14px; background: #FFFFFF;')}>
                <span style={css('flex: 1 1 220px; min-width: 0;')}>
                  <a href={projectFinancieringHref(k.projectId)} style={css('display: block; font-size: 14px; font-weight: 700; color: #2C4A5E; text-decoration: none;')}>{k.naam}</a>
                  <span style={css('display: block; margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>
                    {`${k.projectNaam} · ${STATUS_LABEL[k.status] || k.status} · ${
                      k.reminder === false ? 'geen herinnering' : `herinnering ${store.reminderDays} dagen ervoor`
                    }`}
                  </span>
                </span>
                <span style={css('flex-shrink: 0; text-align: right;')}>
                  <span style={css(`display: block; font-size: 14px; font-weight: 800; color: ${k.dagen <= 14 ? '#9E3B2C' : '#2C4A5E'};`)}>
                    {k.dagen} dagen
                  </span>
                  <span style={css('display: block; margin-top: 2px; font-size: 12.5px; color: #7B8985;')}>
                    {formatDatum(k.datum)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {store.projects.length > 0 && !(form && form.nieuw) && (
        <div style={css('margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px;')}>
          {store.projects.map((p) => {
            const bits = [p.programma, periodeTekst(p.periodeVan, p.periodeTot), p.regio].filter(Boolean);
            const regelsVanProject = financiering.perProject[p.id];
            const dek = Array.isArray(regelsVanProject) ? dekkingVanProject(p, regelsVanProject) : null;
            // Financiering uitsluitend uit de financieringsregels (zelfde berekening als Dashboard en projectdossier).
            const finTekst = p.gearchiveerd
              ? ''
              : !isEchtId(p.id)
                ? 'Sla het project op om de financiering te volgen'
                : financiering.status === 'laden' && !dek
                  ? 'Financiering wordt geladen…'
                  : !dek
                    ? 'De financiering kon niet worden geladen'
                    : !dek.heeftBegroting
                      ? 'Totale projectbegroting nog niet ingevuld'
                      : `Toegekend ${formatEuro(dek.toegekend)}  ·  Aangevraagd ${formatEuro(dek.aangevraagd)}  ·  Eigen bijdrage ${formatEuro(dek.overige)}  ·  ${
                          dek.volledigGedekt ? 'Volledig gedekt' : `Nog te financieren ${formatEuro(dek.nogNodig)}`
                        }`;
            const docTekst = `${(p.docs || []).length} ${(p.docs || []).length === 1 ? 'document' : 'documenten'}`;

            const echt = isEchtId(p.id);
            const projectNaam = p.naam || 'Naamloos project';
            const menuActies = [
              ...(echt ? [{ id: 'bewerken', label: 'Bewerken', onSelect: () => { window.location.hash = `#/kompas/projecten/${p.id}?bewerk=1`; } }] : []),
              { id: 'archiveren', label: p.gearchiveerd ? 'Terugzetten' : 'Archiveren', onSelect: () => store.archiveProject(p.id, !p.gearchiveerd) },
              {
                id: 'verwijderen',
                label: 'Verwijderen',
                gevaar: true,
                bevestig: { vraag: `Project "${projectNaam}" definitief verwijderen? Ook de documenten van dit project worden verwijderd.`, knop: 'Definitief verwijderen' },
                onSelect: () => store.deleteProject(p.id),
              },
            ];

            // Primaire navigatie = de kaart zelf (titel is de link, zie klikKaart.js). Eén aanvullende actie zichtbaar
            // (Bespreek met Subsidie Kompas); Bewerken, Archiveren en Verwijderen zitten in het ⋯-menu.
            return (
              <article
                key={p.id}
                className={`fwk-kk${echt ? ' fwk-kk-klikbaar' : ''}`}
                data-testid="project-kaart"
                data-project-id={p.id}
                style={css('--kk-r: 16px; box-sizing: border-box; padding: 14px 8px 8px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8; display: flex; flex-direction: column; gap: 2px;')}
              >
                <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;')}>
                  <div style={css('min-width: 0; flex: 1 1 auto; padding-top: 2px;')}>
                    <div style={css('margin-bottom: 5px; font-size: 15.5px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;')}>
                      {echt ? (
                        <a className="fwk-kk-link" data-testid="project-kaart-link" href={`#/kompas/projecten/${p.id}`}>
                          {projectNaam}
                        </a>
                      ) : (
                        projectNaam
                      )}
                      {p.gearchiveerd && <span style={css('margin-left: 8px; font-size: 12px; font-weight: 700; color: #7B8985;')}>(gearchiveerd)</span>}
                    </div>
                    <div style={css('font-size: 13.5px; color: #687974;')}>
                      {bits.length ? bits.join('  ·  ') : 'Nog geen looptijd of programma ingevuld'}
                    </div>
                    <div data-testid="projecten-kaart-financiering" style={css('margin-top: 6px; font-size: 13px; color: #7B8985;')}>
                      {[finTekst, docTekst].filter(Boolean).join('  ·  ')}
                    </div>
                  </div>
                  <div className="fwk-kk-boven" style={css('flex: none;')}>
                    <KaartMenu label={`Meer acties voor ${projectNaam}`} testid="project-kaart-menu" acties={menuActies} />
                  </div>
                </div>
                {echt && !p.gearchiveerd && (
                  <BespreekProjectKnop
                    naam={projectNaam}
                    onClick={() => {
                      store.zetChatVerzoek({ type: 'project', projectId: p.id });
                      app.goKompas();
                    }}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      {!store.projects.length && !form && (
        <div style={css('margin-bottom: 16px;')}>
          <EmptyState title="Nog geen projecten vastgelegd" text="Voeg uw eerste project toe om er per aanvraag mee te werken." />
        </div>
      )}

      {!form && (
        <Button onClick={() => { setForm({ ...PROJECT_EMPTY, id: `p${Date.now()}`, nieuw: true }); setMelding(''); setFout(''); }}>
          + Nieuw project
        </Button>
      )}

      <Notice>{melding}</Notice>

      {form && form.nieuw && (
        <NieuwProjectFormulier
          form={form}
          setVeld={setVeld}
          doelgroepen={doelgroepen}
          themas={themas}
          regios={regios}
          fout={fout}
          bezig={bezig}
          onOpslaan={opslaan}
          onAnnuleer={() => { setForm(null); setFout(''); }}
        />
      )}

    </Panel>
  );
}
