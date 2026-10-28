// Projectinformatie: de uitgebreide inhoudelijke laag bij één project, beheerd op de pagina Documenten.
// Toont alleen de velden die nu een bestaande opslag hebben (zie projectinformatie.js en README.md) en schrijft ze
// terug naar dezelfde projectkolommen als waar de chat en de documentgeneratie uit lezen. Geen eigen opslag.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button, Field, veldStijl } from '../../../shared/ui/index.js';
import DossierUitDocument from './DossierUitDocument.jsx';
import {
  BRON_LABELS,
  heeftProjectInfo,
  PI_GROEPEN,
  paneelProjectbreed,
  paneelVelden,
  programmaSuggesties,
  schrijfPaneel,
  voortgang,
} from './projectinformatie.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;";
const HULP = 'display: block; margin-top: 4px; font-size: 12.5px; line-height: 1.5; font-weight: 600; color: #7B8985;';

function beginwaarden(project) {
  const w = {};

  paneelVelden(project).forEach((v) => {
    w[v.key] = v.waarde;
  });
  paneelProjectbreed(project).forEach((v) => {
    w[v.key] = v.waarde;
  });

  return w;
}

function Formulier({ project, projecten, store }) {
  const velden = useMemo(() => paneelVelden(project), [project]);
  const breed = useMemo(() => paneelProjectbreed(project), [project]);
  const [waarden, setWaarden] = useState(() => beginwaarden(project));
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState('');
  const [fout, setFout] = useState('');
  // Onderdelen die het lid uit een document overnam: bij opslaan krijgen ze de herkomst "uit een document" (tot het lid de tekst zelf aanpast).
  const [uitDocument, setUitDocument] = useState({});

  // Nieuwe waarden van buiten (bijvoorbeeld na opslaan of een wijziging via de chat) zonder het formulier te wissen
  // als er niets is aangepast.
  const basis = useMemo(() => beginwaarden(project), [project]);
  const gewijzigd = Object.keys(basis).some((k) => (waarden[k] ?? '') !== (basis[k] ?? ''));

  useEffect(() => {
    if (!gewijzigd) {
      setWaarden(basis);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basis]);

  const pi = voortgang({ ...project, ...schrijfPaneel(project, waarden) });
  const suggesties = useMemo(() => programmaSuggesties(projecten), [projecten]);

  const zet = (key, w) => {
    setWaarden((cur) => ({ ...cur, [key]: w }));
    setUitDocument((cur) => (cur[key] ? { ...cur, [key]: false } : cur));
    setMelding('');
    setFout('');
  };

  const neemOver = (key, w) => {
    setWaarden((cur) => ({ ...cur, [key]: w }));
    setUitDocument((cur) => ({ ...cur, [key]: true }));
    setMelding('');
    setFout('');
  };

  const opslaan = () => {
    setBezig(true);
    setFout('');

    const nieuw = schrijfPaneel(project, waarden);
    const bronnen = { ...(project.bronnen || {}) };

    Object.keys(uitDocument).forEach((k) => {
      if (!uitDocument[k]) return;

      const v = velden.find((x) => x.key === k);

      if (v) bronnen[v.project || v.key] = 'upload';
    });

    Promise.resolve(store.saveProject({ ...nieuw, bronnen })).then((id) => {
      setBezig(false);

      if (id === null) {
        setFout('De projectdocumentatie kon niet in de database worden opgeslagen. Probeer het opnieuw.');

        return;
      }

      setUitDocument({});
      setMelding('Projectdossier opgeslagen.');
    });
  };

  const veld = (v, lijstId) => (
    <Field key={v.key} span="1 / -1">
      {v.label}
      {v.rij > 2 ? (
        <textarea
          data-testid={`pi-${v.key}`}
          value={waarden[v.key] || ''}
          onChange={(ev) => zet(v.key, ev.target.value)}
          placeholder={v.hint}
          rows={v.rij}
          style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical' }}
        />
      ) : (
        <input data-testid={`pi-${v.key}`} list={lijstId} value={waarden[v.key] || ''} onChange={(ev) => zet(v.key, ev.target.value)} placeholder={v.hint} style={veldStijl} autoComplete="off" />
      )}
      {v.bron && (
        <span data-testid={`pi-bron-${v.key}`} style={css(HULP)}>
          Herkomst: {BRON_LABELS[v.bron] || v.bron}
        </span>
      )}
    </Field>
  );

  return (
    <form
      data-testid="projectinformatie-formulier"
      onSubmit={(ev) => {
        ev.preventDefault();
        opslaan();
      }}
    >
      <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 14px 22px; flex-wrap: wrap; margin-bottom: 18px;')}>
        <div style={css('flex: 1 1 300px; min-width: 0;')}>
          <h2 style={css(`${LABEL} margin: 0 0 6px;`)}>Projectdossier</h2>
          <span data-testid="pi-voortgang" style={css('display: block; margin-bottom: 8px; font-size: 13px; font-weight: 800; color: #2C4A5E;')}>
            {pi.ingevuld} van {pi.totaal} onderdelen ingevuld
          </span>
          <p style={css(`${TEKST} margin: 0; max-width: 560px; font-size: 13.5px;`)}>
            Kenmerken en bedragen (doelgroep, werkgebied, begroting) past u aan{' '}
            <a href={`#/kompas/projecten/${encodeURIComponent(project.id)}`} style={css('font-weight: 800; color: #4E9A6C; text-decoration: none;')}>
              bij het project
            </a>
            .
          </p>
        </div>
        {heeftProjectInfo(project) && <DossierUitDocument waarden={waarden} onNeem={neemOver} />}
      </div>

      {PI_GROEPEN.map((g) => {
        const groepVelden = velden.filter((v) => v.groep === g.id);

        if (!groepVelden.length) {
          return null;
        }

        return (
          <fieldset key={g.id} data-testid={`pi-groep-${g.id}`} style={css('border: none; margin: 0 0 18px; padding: 0; min-width: 0;')}>
            <legend style={css(`${LABEL} padding: 0; margin-bottom: 10px;`)}>{g.label}</legend>
            <div style={css('display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px;')}>{groepVelden.map((v) => veld(v))}</div>
          </fieldset>
        );
      })}

      <fieldset data-testid="pi-groep-instellingen" style={css('border: none; margin: 0 0 18px; padding: 0; min-width: 0;')}>
        <legend style={css(`${LABEL} padding: 0; margin-bottom: 10px;`)}>Instellingen voor dit project</legend>
        <div style={css('display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px;')}>
          {breed.map((v) => veld(v, v.suggesties ? 'pi-programma-opties' : undefined))}
          <datalist id="pi-programma-opties">
            {suggesties.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </fieldset>

      {fout && (
        <div role="alert" data-testid="pi-fout" style={css('margin-bottom: 14px; padding: 14px 18px; border: 1px solid #EDD3CE; border-radius: 14px; background: #FDF6F5; font-size: 14.5px; font-weight: 700; color: #9E3B2C;')}>
          {fout}
        </div>
      )}

      <div style={css('display: flex; gap: 12px; align-items: center; flex-wrap: wrap;')}>
        <Button type="submit" disabled={bezig || !gewijzigd}>
          {bezig ? 'Bezig met opslaan…' : 'Projectdossier opslaan'}
        </Button>
        <span role="status" data-testid="pi-melding" style={css('font-size: 14px; font-weight: 700; color: #4E9A6C;')}>
          {melding}
        </span>
      </div>
    </form>
  );
}

export default function ProjectinformatiePaneel({ projecten, projectId, onKies, store }) {
  const project = projecten.find((p) => p.id === projectId) || null;

  return (
    <section data-testid="projectinformatie" style={css('box-sizing: border-box; margin-bottom: 28px; padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 20px; background: #FFFFFF; min-width: 0;')}>
      <Field>
        Project
        <select data-testid="pi-project" value={project ? project.id : ''} onChange={(ev) => onKies(ev.target.value)} style={veldStijl} aria-label="Project">
          {projecten.map((p) => (
            <option key={p.id} value={p.id}>
              {p.naam || 'Naamloos project'}
            </option>
          ))}
        </select>
      </Field>
      <div style={css('height: 16px;')} />
      {project && <Formulier key={project.id} project={project} projecten={projecten} store={store} />}
    </section>
  );
}
