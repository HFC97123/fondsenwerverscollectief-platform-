// Actieplan per project (Pro/Premium): opgeslagen taken (actie, financier, deadline, status, prioriteit, notitie) en,
// daaronder, de aanbevolen vervolgstappen die uit het dekkingsplan zijn afgeleid (acties.js, niet opgeslagen).
// Eén blok voor twee plekken: onder het project (Projectfinanciering) en op de pagina Deadlines (tab Actieplan).
// Geen bedragen: het dekkingsplan blijft de enige bron voor geld.
import React, { useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { isEchtId } from '../../../data/services/projecten.js';
import { useDekkingsplannen } from './useProjectFinanciering.js';
import { useActieplan } from './useActieplan.js';
import { leidActiesAf } from './acties.js';
import { projectFinancieringHref } from './deeplinks.js';
import {
  ACTIE_GROEPEN,
  ACTIE_GROEP_LABEL,
  ACTIE_PRIORITEITEN,
  ACTIE_PRIORITEIT_LABEL,
  ACTIE_STATUSSEN,
  ACTIE_STATUS_LABEL,
  MAX_FINANCIER,
  MAX_NOTITIE,
  MAX_TITEL,
  afgeleidNaarTaak,
  deadlineTekst,
  groepeerTaken,
  telOpenTaken,
  valideerActie,
  verbergAlOpgeslagen,
} from './actieplan.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const INVOER =
  "box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2E3A38;";
const KNOP = "cursor: pointer; min-height: 40px; padding: 0 16px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;";
const KNOP_PRIMAIR = "cursor: pointer; min-height: 40px; padding: 0 18px; border: none; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;";
const KNOP_TEKST = "cursor: pointer; min-height: 36px; padding: 0 6px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700;";

const PRIORITEIT_STIJL = {
  high: 'background: #FBE9E5; color: #9E3B2C;',
  normal: 'background: #EAF3EE; color: #2F6D47;',
  low: 'background: #EEF1F0; color: #5D6B67;',
};

function Chip({ prioriteit }) {
  return (
    <span data-testid="ap-prioriteit-chip" style={css(`display: inline-block; padding: 2px 9px; border-radius: 999px; font-family: 'Mulish', sans-serif; font-size: 12px; font-weight: 800; ${PRIORITEIT_STIJL[prioriteit] || PRIORITEIT_STIJL.normal}`)}>
      {ACTIE_PRIORITEIT_LABEL[prioriteit] || ACTIE_PRIORITEIT_LABEL.normal}
    </span>
  );
}

// Formulier voor een nieuwe taak of het bewerken van een bestaande.
function ActieFormulier({ initieel, financiers, financierVast = null, onOpslaan, onAnnuleer, bezigTekst = 'Opslaan' }) {
  const [titel, setTitel] = useState(initieel?.titel || '');
  const [financier, setFinancier] = useState(initieel?.financier || '');
  const [deadline, setDeadline] = useState(initieel?.deadline || '');
  const [prioriteit, setPrioriteit] = useState(initieel?.prioriteit || 'normal');
  const [notitie, setNotitie] = useState(initieel?.notitie || '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  const bewaar = async (e) => {
    e.preventDefault();

    const geldig = valideerActie({ titel, financier: financierVast ? '' : financier, deadline, prioriteit, notitie });

    if (!geldig.ok) {
      setFout(geldig.fout);

      return;
    }

    setBezig(true);
    setFout('');

    const res = await onOpslaan(geldig.waarde);

    setBezig(false);

    if (res && res.ok === false) {
      setFout(res.reden === 'niet-beschikbaar' ? 'Het actieplan is nog niet beschikbaar in uw omgeving.' : 'Opslaan is niet gelukt. Probeer het opnieuw.');
    }
  };

  return (
    <form
      data-testid="ap-form"
      onSubmit={bewaar}
      style={css('box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px 14px; padding: 16px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8;')}
    >
      <label style={css('grid-column: 1 / -1; min-width: 0;')}>
        <span style={css(LABEL)}>Actie</span>
        <input data-testid="ap-titel" value={titel} maxLength={MAX_TITEL} onChange={(e) => setTitel(e.target.value)} placeholder="Bijvoorbeeld: vooroverleg plannen" style={css(INVOER)} />
      </label>
      <label style={css('min-width: 0;')}>
        <span style={css(LABEL)}>Financier (optioneel)</span>
        <input data-testid="ap-financier" list="ap-financiers" value={financierVast || financier} disabled={Boolean(financierVast)} maxLength={MAX_FINANCIER} onChange={(e) => setFinancier(e.target.value)} style={css(INVOER)} />
        <datalist id="ap-financiers">
          {(financiers || []).map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>
      <label style={css('min-width: 0;')}>
        <span style={css(LABEL)}>Deadline (optioneel)</span>
        <input data-testid="ap-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={css(INVOER)} />
      </label>
      <label style={css('min-width: 0;')}>
        <span style={css(LABEL)}>Prioriteit</span>
        <select data-testid="ap-prioriteit" value={prioriteit} onChange={(e) => setPrioriteit(e.target.value)} style={css(INVOER)}>
          {ACTIE_PRIORITEITEN.map((p) => (
            <option key={p} value={p}>
              {ACTIE_PRIORITEIT_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label style={css('grid-column: 1 / -1; min-width: 0;')}>
        <span style={css(LABEL)}>Notitie (optioneel)</span>
        <textarea data-testid="ap-notitie" rows={2} maxLength={MAX_NOTITIE} value={notitie} onChange={(e) => setNotitie(e.target.value)} style={css(`${INVOER} resize: vertical; line-height: 1.5;`)} />
      </label>
      <div style={css('grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>
        <button type="submit" disabled={bezig} data-testid="ap-opslaan" style={css(KNOP_PRIMAIR)}>
          {bezig ? 'Opslaan…' : bezigTekst}
        </button>
        <button type="button" data-testid="ap-annuleer" onClick={onAnnuleer} style={css(`${KNOP_TEKST} color: #4B5C58;`)}>
          Annuleren
        </button>
        {fout && (
          <span role="alert" data-testid="ap-fout" style={css(`${TEKST} font-size: 13px; font-weight: 700; color: #9E3B2C;`)}>
            {fout}
          </span>
        )}
      </div>
    </form>
  );
}

function Taak({ taak, financiers, regelNaam, nu, onWijzig, onVerwijder }) {
  const [bewerk, setBewerk] = useState(false);
  const [bevestig, setBevestig] = useState(false);
  const [fout, setFout] = useState('');
  const klaar = taak.status === 'done';

  const zet = async (wijziging) => {
    setFout('');

    const res = await onWijzig(taak.id, wijziging);

    if (!res || !res.ok) {
      setFout('Opslaan is niet gelukt. Probeer het opnieuw.');
    }
  };

  if (bewerk) {
    return (
      <ActieFormulier
        initieel={taak}
        financiers={financiers}
        financierVast={regelNaam}
        onAnnuleer={() => setBewerk(false)}
        onOpslaan={async (w) => {
          const res = await onWijzig(taak.id, w);

          if (res && res.ok) {
            setBewerk(false);
          }

          return res;
        }}
      />
    );
  }

  const dl = deadlineTekst(taak, nu);

  return (
    <article
      data-testid="ap-taak"
      data-actie-id={taak.id}
      data-status={taak.status}
      style={css(`box-sizing: border-box; padding: 12px 16px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; ${klaar ? 'opacity: 0.72;' : ''}`)}
    >
      <div style={css('display: flex; gap: 12px; align-items: flex-start;')}>
        <input
          type="checkbox"
          data-testid="ap-klaar"
          checked={klaar}
          aria-label={`${klaar ? 'Weer openen' : 'Markeer als klaar'}: ${taak.titel}`}
          onChange={() => zet({ status: klaar ? 'todo' : 'done' })}
          style={css('width: 20px; height: 20px; margin-top: 2px; flex-shrink: 0; cursor: pointer; accent-color: #4E9A6C;')}
        />
        <div style={css('flex: 1; min-width: 0;')}>
          <div data-testid="ap-taak-titel" style={css(`${TEKST} font-size: 15px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere; ${klaar ? 'text-decoration: line-through;' : ''}`)}>
            {taak.titel}
          </div>
          <div style={css(`${TEKST} font-size: 13px; color: #6D7C77; margin-top: 2px; overflow-wrap: anywhere;`)}>
            {[regelNaam || taak.financier, dl].filter(Boolean).join(' · ') || 'Geen financier of deadline'}
            {taak.bron === 'chat' && <span data-testid="ap-bron-chat"> · voorgesteld door Subsidie Kompas</span>}
          </div>
          {taak.notitie && <div style={css(`${TEKST} font-size: 13px; margin-top: 6px; white-space: pre-wrap; overflow-wrap: anywhere;`)}>{taak.notitie}</div>}
        </div>
        <div style={css('display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;')}>
          <Chip prioriteit={taak.prioriteit} />
          <select data-testid="ap-status" aria-label={`Status van ${taak.titel}`} value={taak.status} onChange={(e) => zet({ status: e.target.value })} style={css(`${INVOER} width: auto; min-height: 32px; padding: 4px 8px; font-size: 13px;`)}>
            {ACTIE_STATUSSEN.map((s) => (
              <option key={s} value={s}>
                {ACTIE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={css('display: flex; gap: 12px; margin-top: 6px; padding-left: 32px; flex-wrap: wrap; align-items: center;')}>
        <button type="button" data-testid="ap-bewerk" onClick={() => setBewerk(true)} style={css(`${KNOP_TEKST} color: #2C4A5E;`)}>
          Bewerken
        </button>
        {bevestig ? (
          <span style={css('display: inline-flex; gap: 8px; align-items: center;')}>
            <button type="button" data-testid="ap-verwijder-ja" onClick={() => onVerwijder(taak.id)} style={css(`${KNOP_TEKST} color: #9E3B2C;`)}>
              Ja, verwijderen
            </button>
            <button type="button" onClick={() => setBevestig(false)} style={css(`${KNOP_TEKST} color: #4B5C58;`)}>
              Annuleren
            </button>
          </span>
        ) : (
          <button type="button" data-testid="ap-verwijder" aria-label={`Verwijderen: ${taak.titel}`} onClick={() => setBevestig(true)} style={css(`${KNOP_TEKST} color: #9E3B2C;`)}>
            Verwijderen
          </button>
        )}
        {fout && (
          <span role="alert" data-testid="ap-taak-fout" style={css(`${TEKST} font-size: 13px; font-weight: 700; color: #9E3B2C;`)}>
            {fout}
          </span>
        )}
      </div>
    </article>
  );
}

// Het actieplan van één project. `regels` = de regels uit het dekkingsplan (voor de financiernamen en de afgeleide acties).
export function ActieplanBlok({ project, regels, plan, nu, koptekst = true }) {
  const [open, setOpen] = useState(false);
  const [meldingFout, setMeldingFout] = useState('');
  const taken = useMemo(() => plan.actieVoor(project.id), [plan, project.id]);
  const financiers = useMemo(() => Array.from(new Set((regels || []).filter((r) => r.bronStatus === 'zichtbaar').map((r) => r.naam).filter(Boolean))), [regels]);
  const afgeleid = useMemo(() => verbergAlOpgeslagen(leidActiesAf({ projecten: [project], regelsPerProject: { [project.id]: regels || [] }, nu }), taken), [project, regels, nu, taken]);
  const groepen = useMemo(() => groepeerTaken(taken, nu), [taken, nu]);
  const beschikbaar = plan.status === 'klaar';
  // Een taak die aan een regel van het dekkingsplan hangt toont de LIVE naam van die regel (al gemaskeerd naar het abonnement);
  // de naam wordt dan niet bij de taak gekopieerd, zodat er na een downgrade geen fondsnaam blijft hangen.
  const naamVanRegel = (fundingId) => {
    const r = fundingId ? (regels || []).find((x) => x.id === fundingId) : null;

    return r && r.naam ? r.naam : null;
  };
  const regelVoorNaam = (naam) => (regels || []).find((r) => r.bronStatus === 'zichtbaar' && r.naam && naam && r.naam.trim().toLowerCase() === naam.trim().toLowerCase()) || null;

  const voegToe = async (w) => {
    const regel = regelVoorNaam(w.financier);

    return plan.voegToe({ projectId: project.id, ...w, financier: regel ? '' : w.financier, fundingId: regel ? regel.id : null, bron: 'user' });
  };

  const maakTaak = async (a) => {
    setMeldingFout('');

    const taakInvoer = afgeleidNaarTaak(a);
    const res = await plan.voegToe({ ...taakInvoer, financier: taakInvoer.fundingId ? '' : taakInvoer.financier, bron: 'user' });

    if (!res.ok) {
      setMeldingFout(res.reden === 'niet-beschikbaar' ? 'Het actieplan is nog niet beschikbaar in uw omgeving.' : 'Er een taak van maken is niet gelukt. Probeer het opnieuw.');
    }
  };

  return (
    <section data-testid="actieplan" data-project-id={project.id} style={css('display: flex; flex-direction: column; gap: 12px; min-width: 0;')}>
      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;')}>
        {koptekst && (
          <h2 style={css(`${LABEL} margin: 0;`)}>
            Actieplan <span data-testid="ap-teller" style={css('color: #7B8985;')}>({telOpenTaken(taken)} open)</span>
          </h2>
        )}
        {beschikbaar && !open && (
          <button type="button" data-testid="ap-toevoegen-open" onClick={() => setOpen(true)} style={css(KNOP)}>
            + Actie toevoegen
          </button>
        )}
      </div>

      {plan.status === 'laden' && <div style={css(`${TEKST} color: #7B8985;`)}>Actieplan wordt geladen…</div>}
      {plan.status === 'niet-beschikbaar' && (
        <div role="status" data-testid="ap-niet-beschikbaar" style={css(`${TEKST} padding: 12px 16px; border: 1px solid #EEDCC0; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
          Eigen taken bijhouden is nog niet beschikbaar in uw omgeving. De aanbevolen vervolgstappen hieronder werken wel.
        </div>
      )}
      {plan.status === 'fout' && (
        <div role="alert" data-testid="ap-laadfout" style={css(`${TEKST} padding: 12px 16px; border: 1px solid #EEDCC0; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
          Het actieplan kon niet worden geladen. Ververs de pagina of probeer het later opnieuw.
        </div>
      )}

      {beschikbaar && open && (
        <ActieFormulier
          financiers={financiers}
          onAnnuleer={() => setOpen(false)}
          onOpslaan={async (w) => {
            const res = await voegToe(w);

            if (res.ok) {
              setOpen(false);
            }

            return res;
          }}
        />
      )}

      {beschikbaar && taken.length === 0 && !open && (
        <div data-testid="ap-leeg" style={css(`${TEKST} padding: 16px 18px; border: 1px dashed #CFDDD5; border-radius: 14px; color: #7B8985;`)}>
          Nog geen eigen taken bij dit project. Voeg een actie toe, bijvoorbeeld “vooroverleg plannen met Fonds A”, of maak hieronder een aanbevolen stap tot taak.
        </div>
      )}

      {ACTIE_GROEPEN.map((g) =>
        groepen[g].length ? (
          <div key={g} data-testid={`ap-groep-${g}`} style={css('display: flex; flex-direction: column; gap: 8px;')}>
            <h3 style={css(`${LABEL} margin: 6px 0 0; color: ${g === 'te-laat' ? '#9E3B2C' : '#2C4A5E'};`)}>
              {ACTIE_GROEP_LABEL[g]} <span style={css('color: #7B8985;')}>({groepen[g].length})</span>
            </h3>
            {groepen[g].map((t) => (
              <Taak key={t.id} taak={t} financiers={financiers} regelNaam={naamVanRegel(t.fundingId)} nu={nu} onWijzig={plan.wijzig} onVerwijder={plan.verwijder} />
            ))}
          </div>
        ) : null,
      )}

      {afgeleid.length > 0 && (
        <div data-testid="ap-afgeleid" style={css('display: flex; flex-direction: column; gap: 8px; margin-top: 6px;')}>
          <h3 style={css(`${LABEL} margin: 6px 0 0; color: #2C4A5E;`)}>Aanbevolen op basis van uw dekkingsplan</h3>
          <div style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>Dit wordt berekend uit de stand van uw dekkingsplan en wijzigt vanzelf mee. Maak er een taak van om het bij te houden.</div>
          {afgeleid.slice(0, 8).map((a) => (
            <div key={a.id} data-testid="ap-afgeleid-actie" style={css('display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 10px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #F7F9F8;')}>
              <div style={css('min-width: 0; flex: 1 1 240px;')}>
                <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}>{a.tekst}</div>
                <div style={css(`${TEKST} font-size: 13px; color: #6D7C77; overflow-wrap: anywhere;`)}>{[a.regelNaam, a.reden].filter(Boolean).join(' · ')}</div>
              </div>
              <Chip prioriteit={a.prioriteit === 'hoog' ? 'high' : 'normal'} />
              {beschikbaar && (
                <button type="button" data-testid="ap-maak-taak" onClick={() => maakTaak(a)} style={css(KNOP)}>
                  Maak er een taak van
                </button>
              )}
            </div>
          ))}
          {meldingFout && (
            <div role="alert" data-testid="ap-afgeleid-fout" style={css(`${TEKST} font-size: 13px; font-weight: 700; color: #9E3B2C;`)}>
              {meldingFout}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Onder het project (tab Projectfinanciering): de regels zijn daar al geladen.
export function ActieplanVoorProject({ project, regels }) {
  const plan = useActieplan([project.id]);
  const nu = useMemo(() => new Date(), []);

  return <ActieplanBlok project={project} regels={regels} plan={plan} nu={nu} koptekst />;
}

// Pagina Deadlines, tab Actieplan: alle actieve projecten onder elkaar.
export function ActieplanOverzicht({ projecten }) {
  const actief = useMemo(() => (projecten || []).filter((p) => p && !p.gearchiveerd && isEchtId(p.id)), [projecten]);
  const ids = useMemo(() => actief.map((p) => p.id), [actief]);
  const { status, perProject } = useDekkingsplannen(ids);
  const plan = useActieplan(ids);
  const nu = useMemo(() => new Date(), []);

  return (
    <div data-testid="actieplan-overzicht" style={css('display: flex; flex-direction: column; gap: 26px; min-width: 0;')}>
      {actief.length === 0 && (
        <div data-testid="ap-geen-projecten" style={css(`${TEKST} padding: 26px 24px; border: 1px dashed #CFDDD5; border-radius: 16px; background: #FFFFFF;`)}>
          U heeft nog geen actief project. Maak er een aan bij <a href="#/kompas/projecten" style={css('color: #4E9A6C; font-weight: 800;')}>Projecten</a>; het actieplan van uw projecten staat dan hier.
        </div>
      )}
      {actief.length > 0 && status === 'laden' && <div style={css(`${TEKST} color: #7B8985;`)}>Uw actieplannen worden geladen…</div>}
      {actief.length > 0 && status !== 'laden' &&
        actief.map((p) => (
          <div key={p.id} data-testid="ap-project" style={css('box-sizing: border-box; padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 20px; background: #FFFFFF;')}>
            <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;')}>
              <h2 data-testid="ap-project-naam" style={css("margin: 0; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>{p.naam || 'Naamloos project'}</h2>
              <a href={projectFinancieringHref(p.id)} style={css("font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #4E9A6C; text-decoration: none;")}>
                Open projectfinanciering
              </a>
            </div>
            <ActieplanBlok project={p} regels={perProject[p.id] || []} plan={plan} nu={nu} koptekst={false} />
          </div>
        ))}
    </div>
  );
}
