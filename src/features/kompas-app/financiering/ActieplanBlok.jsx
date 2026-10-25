// Acties & deadlines per project (Pro/Premium): opgeslagen taken (actie, financier, streefdatum, status, prioriteit, notitie)
// en de acties die uit het dekkingsplan zijn afgeleid (acties.js, niet opgeslagen) in ÉÉN overzicht, herkenbaar als 'taak' of
// 'afgeleid' (actiesEnDeadlines.js). Een fondsdeadline zonder opgeslagen taak blijft zichtbaar; een taak aan een regel erft de
// deadline van het fonds tenzij het lid een eigen streefdatum kiest.
// Eén blok voor twee plekken: onder het project (Projectfinanciering) en op de pagina Deadlines (tab Actieplan).
// Geen bedragen: het dekkingsplan blijft de enige bron voor geld.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { HelpKnop } from '../../../shared/ui/werkplek.jsx';
import { isEchtId } from '../../../data/services/projecten.js';
import { useDekkingsplannen } from './useProjectFinanciering.js';
import { useActieplan } from './useActieplan.js';
import { bouwActiesEnDeadlines, groepeerActiesEnDeadlines, telOpen, SOORT, DATUM_SOORT } from './actiesEnDeadlines.js';
import { dagenTot, dagenTekst, formatDatum } from './dekkingsplan.js';
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
  valideerActie,
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

const SOORT_LABEL = { taak: 'Opgeslagen taak', afgeleid: 'Afgeleid uit dekkingsplan' };

// Het onderscheid taak/afgeleid is intern; de gebruiker ziet er geen label meer van (data-soort blijft op de regel staan).
// eslint-disable-next-line no-unused-vars
function SoortLabel({ soort }) {
  return null;
  // eslint-disable-next-line no-unreachable
  return (
    <span
      data-testid="ap-soort"
      data-soort={soort}
      style={css(`display: inline-block; padding: 1px 8px; border-radius: 999px; border: 1px solid ${soort === SOORT.TAAK ? '#CFDDD5' : '#E1D5F0'}; background: ${soort === SOORT.TAAK ? '#F7F9F8' : '#F4EFFA'}; color: ${soort === SOORT.TAAK ? '#4B5C58' : '#5B3F8A'}; font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800;`)}
    >
      {SOORT_LABEL[soort]}
    </span>
  );
}

// "Streefdatum 20 nov 2026 (over 6 dagen) · Fondsdeadline 1 dec 2026" of, zonder eigen datum, "Deadline van het fonds 1 dec 2026 (over 48 dagen)".
function datumRegels(item, nu) {
  const rest = (iso) => {
    if (item.status === 'done') return '';

    const d = dagenTot(iso, nu);

    return d == null ? '' : ` (${dagenTekst(d)})`;
  };
  const delen = [];

  if (item.datumSoort === DATUM_SOORT.STREEF) {
    delen.push(`Streefdatum ${formatDatum(item.streefdatum)}${rest(item.streefdatum)}`);

    if (item.externeDeadline && item.externeDeadline !== item.streefdatum) delen.push(`Fondsdeadline ${formatDatum(item.externeDeadline)}`);
  } else if (item.datumSoort === DATUM_SOORT.EXTERN) {
    delen.push(`${item.soort === SOORT.TAAK ? 'Deadline van het fonds' : 'Deadline'} ${formatDatum(item.externeDeadline)}${rest(item.externeDeadline)}`);
  }

  return delen;
}

function Chip({ prioriteit }) {
  return (
    <span data-testid="ap-prioriteit-chip" style={css(`display: inline-block; padding: 2px 9px; border-radius: 999px; font-family: 'Mulish', sans-serif; font-size: 12px; font-weight: 800; ${PRIORITEIT_STIJL[prioriteit] || PRIORITEIT_STIJL.normal}`)}>
      {ACTIE_PRIORITEIT_LABEL[prioriteit] || ACTIE_PRIORITEIT_LABEL.normal}
    </span>
  );
}

// Formulier voor een nieuwe taak of het bewerken van een bestaande.
function ActieFormulier({ initieel, financiers, financierVast = null, volgtFonds = false, onOpslaan, onAnnuleer, bezigTekst = 'Opslaan' }) {
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
        <span style={css(LABEL)}>{volgtFonds ? 'Eigen streefdatum (optioneel)' : 'Deadline (optioneel)'}</span>
        <input data-testid="ap-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={css(INVOER)} />
        {volgtFonds && <span style={css(`${TEKST} display: block; margin-top: 4px; font-size: 12px; color: #7B8985;`)}>Leeg laten = deze taak volgt de deadline van het fonds.</span>}
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

function Taak({ item, financiers, regelNaam, nu, onWijzig, onVerwijder, projectNaam = '' }) {
  const taak = item.taak;
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
        volgtFonds={Boolean(taak.fundingId)}
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

  const datums = datumRegels(item, nu);

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
            {[projectNaam, regelNaam || taak.financier, ...datums].filter(Boolean).join(' · ') || 'Geen financier of deadline'}
            {taak.bron === 'chat' && <span data-testid="ap-bron-chat"> · voorgesteld door Subsidie Kompas{item.aangepastDoorLid ? ', door u aangepast' : ''}</span>}
          </div>
          {item.externeDeadlineGewijzigd && (
            <div data-testid="ap-deadline-gewijzigd" style={css(`${TEKST} font-size: 12.5px; margin-top: 4px; color: #8A5A16;`)}>
              De deadline van het fonds is gewijzigd: was {formatDatum(item.externeDeadlineGewijzigd.van)}, nu {formatDatum(item.externeDeadlineGewijzigd.naar)}.
              {item.datumSoort === DATUM_SOORT.STREEF ? ' Uw streefdatum is niet aangepast.' : ' Deze taak volgt de nieuwe deadline.'}
            </div>
          )}
          {taak.notitie && <div style={css(`${TEKST} font-size: 13px; margin-top: 6px; white-space: pre-wrap; overflow-wrap: anywhere;`)}>{taak.notitie}</div>}
        </div>
        <div style={css('display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;')}>
          <SoortLabel soort={SOORT.TAAK} />
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
  const items = useMemo(() => bouwActiesEnDeadlines({ project, regels, taken, nu }), [project, regels, taken, nu]);
  const groepen = useMemo(() => groepeerActiesEnDeadlines(items, nu), [items, nu]);
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

    const taakInvoer = afgeleidNaarTaak(a.afgeleid);
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
            Acties &amp; deadlines <span data-testid="ap-teller" style={css('color: #7B8985;')}>({telOpen(items)} open)</span>
          </h2>
        )}
        <span style={css('display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;')}>
          {beschikbaar && !open && (
            <button type="button" data-testid="ap-toevoegen-open" onClick={() => setOpen(true)} style={css(KNOP)}>
              + Actie toevoegen
            </button>
          )}
          {koptekst && (
            <HelpKnop>
              <p>Opgeslagen taken en acties die uit uw dekkingsplan volgen staan hier samen. Afgeleide acties worden berekend en wijzigen vanzelf mee; maak er een taak van om ze bij te houden.</p>
              <p>Een taak bij een financier volgt de deadline van het fonds, tenzij u een eigen streefdatum kiest.</p>
            </HelpKnop>
          )}
        </span>
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
          Nog geen eigen taken bij dit project. Voeg een actie toe, bijvoorbeeld “vooroverleg plannen met Fonds A”, of maak een afgeleide actie tot taak.
        </div>
      )}


      {ACTIE_GROEPEN.map((g) =>
        groepen[g].length ? (
          <div key={g} data-testid={`ap-groep-${g}`} style={css('display: flex; flex-direction: column; gap: 8px;')}>
            <h3 style={css(`${LABEL} margin: 6px 0 0; color: ${g === 'te-laat' ? '#9E3B2C' : '#2C4A5E'};`)}>
              {ACTIE_GROEP_LABEL[g]} <span style={css('color: #7B8985;')}>({groepen[g].length})</span>
            </h3>
            {groepen[g].map((i) =>
              i.soort === SOORT.TAAK ? (
                <Taak key={i.sleutel} item={i} financiers={financiers} regelNaam={naamVanRegel(i.taak.fundingId)} nu={nu} onWijzig={plan.wijzig} onVerwijder={plan.verwijder} />
              ) : (
                <div key={i.sleutel} data-testid="ap-afgeleid-actie" data-soort="afgeleid" style={css('display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 10px 14px; border: 1px solid #E8E0F2; border-radius: 12px; background: #FBF9FD;')}>
                  <div style={css('min-width: 0; flex: 1 1 240px;')}>
                    <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}>{i.titel}</div>
                    <div style={css(`${TEKST} font-size: 13px; color: #6D7C77; overflow-wrap: anywhere;`)}>{[i.regelNaam, i.reden].filter(Boolean).join(' · ')}</div>
                  </div>
                  <SoortLabel soort={SOORT.AFGELEID} />
                  <Chip prioriteit={i.prioriteit} />
                  {beschikbaar && (
                    <button type="button" data-testid="ap-maak-taak" onClick={() => maakTaak(i)} style={css(KNOP)}>
                      Maak er een taak van
                    </button>
                  )}
                </div>
              ),
            )}
          </div>
        ) : null,
      )}

      {meldingFout && (
        <div role="alert" data-testid="ap-afgeleid-fout" style={css(`${TEKST} font-size: 13px; font-weight: 700; color: #9E3B2C;`)}>
          {meldingFout}
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

const FILTER_STIJL = "box-sizing: border-box; min-height: 40px; padding: 6px 12px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700; color: #2C4A5E;";

const fondsVan = (i) => i.regelNaam || (i.taak && i.taak.financier) || '';

// Pagina Deadlines, tab Actieplan: alle acties van alle actieve projecten en fondsen door elkaar, op datum. Met een filter op project en op fonds
// kiest het lid één project of één fonds apart.
export function ActieplanOverzicht({ projecten, startProject = '' }) {
  const actief = useMemo(() => (projecten || []).filter((p) => p && !p.gearchiveerd && isEchtId(p.id)), [projecten]);
  const ids = useMemo(() => actief.map((p) => p.id), [actief]);
  const { status, perProject } = useDekkingsplannen(ids);
  const plan = useActieplan(ids);
  const nu = useMemo(() => new Date(), []);
  const [kiesProject, setKiesProject] = useState(startProject || '');
  const [kiesFonds, setKiesFonds] = useState('');
  const [open, setOpen] = useState(false);

  // Het project uit de link (of uit de projectkeuze bovenaan Subsidieadvies) bepaalt het filter; een onbekend project doet niets.
  useEffect(() => {
    if (startProject && actief.some((p) => p.id === startProject)) {
      setKiesProject(startProject);
      setKiesFonds('');
    }
  }, [startProject, actief]);
  const naamVanProject = (id) => {
    const p = actief.find((x) => x.id === id);

    return (p && p.naam) || 'Naamloos project';
  };

  const alle = useMemo(
    () =>
      actief
        .flatMap((p) => bouwActiesEnDeadlines({ project: p, regels: perProject[p.id] || [], taken: plan.actieVoor(p.id), nu }))
        .sort((a, b) => String(a.datum || '9999-12-31').localeCompare(String(b.datum || '9999-12-31')) || String(a.titel).localeCompare(String(b.titel), 'nl')),
    [actief, perProject, plan, nu],
  );
  const opProject = useMemo(() => (kiesProject ? alle.filter((i) => i.projectId === kiesProject) : alle), [alle, kiesProject]);
  const fondsen = useMemo(() => Array.from(new Set(opProject.map(fondsVan).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'nl')), [opProject]);
  const zichtbaar = useMemo(() => (kiesFonds ? opProject.filter((i) => fondsVan(i) === kiesFonds) : opProject), [opProject, kiesFonds]);
  const groepen = useMemo(() => groepeerActiesEnDeadlines(zichtbaar, nu), [zichtbaar, nu]);
  const beschikbaar = plan.status === 'klaar';
  const regelsVan = (projectId) => perProject[projectId] || [];
  const financiersVan = (projectId) => Array.from(new Set(regelsVan(projectId).filter((r) => r.bronStatus === 'zichtbaar').map((r) => r.naam).filter(Boolean)));
  const naamVanRegel = (projectId, fundingId) => {
    const r = fundingId ? regelsVan(projectId).find((x) => x.id === fundingId) : null;

    return r && r.naam ? r.naam : null;
  };

  const maakTaak = async (a) => {
    const taakInvoer = afgeleidNaarTaak(a.afgeleid);

    await plan.voegToe({ ...taakInvoer, financier: taakInvoer.fundingId ? '' : taakInvoer.financier, bron: 'user' });
  };

  const voegToe = async (w) => {
    const regel = regelsVan(kiesProject).find((r) => r.bronStatus === 'zichtbaar' && r.naam && w.financier && r.naam.trim().toLowerCase() === w.financier.trim().toLowerCase());

    return plan.voegToe({ projectId: kiesProject, ...w, financier: regel ? '' : w.financier, fundingId: regel ? regel.id : null, bron: 'user' });
  };

  return (
    <div data-testid="actieplan-overzicht" style={css('display: flex; flex-direction: column; gap: 14px; min-width: 0;')}>
      {actief.length === 0 && (
        <div data-testid="ap-geen-projecten" style={css(`${TEKST} padding: 26px 24px; border: 1px dashed #CFDDD5; border-radius: 16px; background: #FFFFFF;`)}>
          U heeft nog geen actief project. Maak er een aan bij <a href="#/kompas/projecten" style={css('color: #4E9A6C; font-weight: 800;')}>Projecten</a>; het actieplan van uw projecten staat dan hier.
        </div>
      )}
      {actief.length > 0 && status === 'laden' && <div style={css(`${TEKST} color: #7B8985;`)}>Uw actieplannen worden geladen…</div>}
      {actief.length > 0 && status !== 'laden' && (
        <>
          <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>
            <select data-testid="ap-filter-project" aria-label="Project" value={kiesProject} onChange={(e) => { setKiesProject(e.target.value); setKiesFonds(''); }} style={css(FILTER_STIJL)}>
              <option value="">Alle projecten</option>
              {actief.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam || 'Naamloos project'}
                </option>
              ))}
            </select>
            <select data-testid="ap-filter-fonds" aria-label="Fonds" value={kiesFonds} onChange={(e) => setKiesFonds(e.target.value)} style={css(FILTER_STIJL)}>
              <option value="">Alle fondsen</option>
              {fondsen.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <span data-testid="ap-teller" style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>{telOpen(zichtbaar)} open</span>
            {beschikbaar && kiesProject && !open && (
              <button type="button" data-testid="ap-toevoegen-open" onClick={() => setOpen(true)} style={css(`${KNOP} margin-left: auto;`)}>
                + Actie toevoegen
              </button>
            )}
          </div>

          {beschikbaar && kiesProject && open && (
            <ActieFormulier
              financiers={financiersVan(kiesProject)}
              onAnnuleer={() => setOpen(false)}
              onOpslaan={async (w) => {
                const res = await voegToe(w);

                if (res.ok) setOpen(false);

                return res;
              }}
            />
          )}

          {zichtbaar.length === 0 && (
            <div data-testid="ap-leeg" style={css(`${TEKST} padding: 16px 18px; border: 1px dashed #CFDDD5; border-radius: 14px; color: #7B8985;`)}>
              Geen acties voor deze keuze.
            </div>
          )}

          {ACTIE_GROEPEN.map((g) =>
            groepen[g].length ? (
              <div key={g} data-testid={`ap-groep-${g}`} style={css('display: flex; flex-direction: column; gap: 8px;')}>
                <h3 style={css(`${LABEL} margin: 6px 0 0; color: ${g === 'te-laat' ? '#9E3B2C' : '#2C4A5E'};`)}>
                  {ACTIE_GROEP_LABEL[g]} <span style={css('color: #7B8985;')}>({groepen[g].length})</span>
                </h3>
                {groepen[g].map((i) =>
                  i.soort === SOORT.TAAK ? (
                    <Taak
                      key={i.sleutel}
                      item={i}
                      projectNaam={kiesProject ? '' : naamVanProject(i.projectId)}
                      financiers={financiersVan(i.projectId)}
                      regelNaam={naamVanRegel(i.projectId, i.taak.fundingId)}
                      nu={nu}
                      onWijzig={plan.wijzig}
                      onVerwijder={plan.verwijder}
                    />
                  ) : (
                    <div key={i.sleutel} data-testid="ap-afgeleid-actie" data-soort="afgeleid" style={css('display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 10px 14px; border: 1px dashed #CFDDD5; border-radius: 12px; background: #FFFFFF;')}>
                      <div style={css('min-width: 0; flex: 1 1 240px;')}>
                        <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}>{i.titel}</div>
                        <div style={css(`${TEKST} font-size: 13px; color: #6D7C77; overflow-wrap: anywhere;`)}>{[kiesProject ? '' : naamVanProject(i.projectId), i.regelNaam, i.reden].filter(Boolean).join(' · ')}</div>
                      </div>
                      <SoortLabel soort={SOORT.AFGELEID} />
                      <Chip prioriteit={i.prioriteit} />
                      {beschikbaar && (
                        <button type="button" data-testid="ap-maak-taak" onClick={() => maakTaak(i)} style={css(KNOP)}>
                          Maak er een taak van
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
