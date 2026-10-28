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
import { ActieplanNu } from './ActieplanNu.jsx';
import { StukkenVoorFondsenwerving } from './StukkenVoorFondsenwerving.jsx';
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
  "box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #D5E0D9; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2E3A38;";
const KNOP = "cursor: pointer; min-height: 40px; padding: 0 16px; border: 1px solid #D5E0D9; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;";
const KNOP_PRIMAIR = "cursor: pointer; min-height: 40px; padding: 0 18px; border: none; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;";
const KNOP_TEKST = "cursor: pointer; min-height: 36px; padding: 0 6px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700;";

const PRIORITEIT_STIJL = {
  high: 'background: #FDF6F5; color: #9E3B2C;',
  normal: 'background: #EAF4EE; color: #2F6D47;',
  low: 'background: #EEF1F0; color: #687974;',
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
      style={css(`display: inline-block; padding: 1px 8px; border-radius: 999px; border: 1px solid ${soort === SOORT.TAAK ? '#D5E0D9' : '#E1D5F0'}; background: ${soort === SOORT.TAAK ? '#F7F9F8' : '#F4EFFA'}; color: ${soort === SOORT.TAAK ? '#4B5C58' : '#5B3F8A'}; font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800;`)}
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

// Korte actie zonder de fondsnaam (die staat al vooraan in de regel): "Kansrijkheid en indiendatum of vergaderdatum toetsen met Fonds X"
// wordt "Kansrijkheid en indiendatum toetsen". Staat de fondsnaam niet in de titel, dan blijft de titel zoals hij is.
export function korteActie(titel, fonds) {
  let t = String(titel || '').trim();
  const f = String(fonds || '').trim();

  if (f) {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const zonder = t.replace(new RegExp(`\\s*(met|bij|voor|van|aan)?\\s*${esc}`, 'i'), ' ').replace(/\s+/g, ' ').trim();

    if (zonder && zonder !== t) t = zonder;
  }

  // Staat er een (iets andere) naam in de titel, dan valt die er bij de vaste voorstellen ook uit.
  t = t.replace(/^(contact opnemen) met .+? (over .+)$/i, '$1 $2').replace(/^(.+ toetsen) met .+$/i, '$1');

  t = t
    // Beide vaste voorstellen zijn dezelfde actie en heten daarom hetzelfde.
    // Alleen de weergave: de opgeslagen titel blijft gelijk, zodat het herkennen van dubbele voorstellen blijft werken.
    .replace(/^kansrijkheid en indiendatum( (en\/)?of vergaderdatum)? toetsen$/i, 'Kansrijkheid en indiendatum en/of vergaderdatum toetsen')
    .replace(/^contact opnemen over passendheid, aanvraag en behandeltermijn$/i, 'Kansrijkheid en indiendatum en/of vergaderdatum toetsen');

  return t.charAt(0).toUpperCase() + t.slice(1);
}

// "1 nov · over 6 dagen" (kort, voor de rechterkant van een regel).
function korteDatum(item, nu) {
  const iso = item.datumSoort === DATUM_SOORT.STREEF ? item.streefdatum : item.datumSoort === DATUM_SOORT.EXTERN ? item.externeDeadline : null;

  if (!iso) return '';

  const kort = formatDatum(iso).replace(/\s\d{4}$/, '');
  const d = item.status === 'done' ? null : dagenTot(iso, nu);

  return d == null ? kort : `${kort} · ${dagenTekst(d)}`;
}

// Een notitie die bij meerdere taken in dezelfde groep hetzelfde is, staat één keer boven de groep in plaats van bij elke taak.
function gedeeldeNotities(items) {
  const tel = new Map();

  items.forEach((i) => {
    const n = i.soort === SOORT.TAAK && i.taak.notitie ? i.taak.notitie.trim() : '';

    if (n) tel.set(n, (tel.get(n) || 0) + 1);
  });

  return new Set(Array.from(tel.entries()).filter(([, aantal]) => aantal > 1).map(([n]) => n));
}

function GedeeldeNotitie({ notities, items }) {
  if (!notities.size) return null;

  return Array.from(notities).map((n) => (
    <div key={n} data-testid="ap-gedeelde-notitie" style={css(`${TEKST} font-size: 13px; padding: 8px 12px; border-radius: 10px; background: #F6F8F7; color: #4B5C58;`)}>
      <b style={css('color: #2C4A5E;')}>Bij {items.filter((i) => i.soort === SOORT.TAAK && (i.taak.notitie || '').trim() === n).length} acties:</b> {n}
    </div>
  ));
}

// Alleen 'hoog' valt op (een rode stip); normaal en laag tonen niets.
function PrioStip({ prioriteit }) {
  if (prioriteit !== 'high') return null;

  return <span data-testid="ap-prio-hoog" title="Hoge prioriteit" aria-label="Hoge prioriteit" style={css('display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 999px; background: #D9776A; vertical-align: 2px; flex-shrink: 0;')} />;
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

function Taak({ item, financiers, regelNaam, nu, onWijzig, onVerwijder, projectNaam = '', verbergNotitie = false }) {
  const taak = item.taak;
  const [menu, setMenu] = useState(false);
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

  const fonds = regelNaam || taak.financier || '';
  const actie = korteActie(taak.titel, fonds);
  const datum = korteDatum(item, nu);
  const notitie = taak.notitie && !verbergNotitie ? taak.notitie : '';
  const MENU_KNOP = `${KNOP_TEKST} display: block; width: 100%; text-align: left; padding: 6px 14px; color: #2C4A5E;`;

  return (
    <article
      data-testid="ap-taak"
      data-actie-id={taak.id}
      data-status={taak.status}
      className="fwk-ap-rij"
      style={css(`position: relative; box-sizing: border-box; padding: 10px 14px; border-bottom: 1px solid #EEF2EF; background: #FFFFFF; ${klaar ? 'opacity: 0.6;' : ''}`)}
    >
      <style>{'.fwk-ap-datum-o { display: none; } @media (max-width: 600px) { .fwk-ap-datum-r { display: none; } .fwk-ap-datum-o { display: block; } }'}</style>
      <div style={css('display: flex; gap: 12px; align-items: center;')}>
        <input
          type="checkbox"
          data-testid="ap-klaar"
          checked={klaar}
          aria-label={`${klaar ? 'Weer openen' : 'Markeer als klaar'}: ${taak.titel}`}
          onChange={() => zet({ status: klaar ? 'todo' : 'done' })}
          style={css('width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; accent-color: #4E9A6C;')}
        />
        <div style={css('flex: 1; min-width: 0;')}>
          <div data-testid="ap-taak-titel" title={taak.titel} style={css(`${TEKST} font-size: 14.5px; color: #2C4A5E; overflow-wrap: anywhere; ${klaar ? 'text-decoration: line-through;' : ''}`)}>
            <PrioStip prioriteit={taak.prioriteit} />
            {fonds ? (
              <>
                <b>{fonds}</b>
                <span style={css('color: #4B5C58;')}> · {actie}</span>
              </>
            ) : (
              <b>{actie}</b>
            )}
            {taak.status === 'doing' && (
              <span data-testid="ap-status-bezig" style={css('margin-left: 8px; padding: 1px 8px; border-radius: 999px; background: #EAF2F8; color: #2C4A5E; font-size: 12px; font-weight: 800;')}>
                Bezig
              </span>
            )}
          </div>
          {datum && (
            <div className="fwk-ap-datum-o" style={css(`${TEKST} font-size: 12.5px; color: #687974;`)}>
              {datum}
            </div>
          )}
          {(projectNaam || notitie || item.externeDeadlineGewijzigd) && (
            <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985; margin-top: 1px; overflow-wrap: anywhere;`)}>
              {[projectNaam, notitie].filter(Boolean).join(' · ')}
              {item.externeDeadlineGewijzigd && (
                <span data-testid="ap-deadline-gewijzigd" style={css('color: #8A5A16;')}>
                  {projectNaam || notitie ? ' · ' : ''}Deadline van het fonds gewijzigd naar {formatDatum(item.externeDeadlineGewijzigd.naar)}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="fwk-ap-datum-r" style={css(`${TEKST} font-size: 13px; color: #687974; white-space: nowrap; flex-shrink: 0;`)}>{datum}</span>
        <button
          type="button"
          data-testid="ap-menu"
          aria-label={`Meer bij ${taak.titel}`}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          style={css(`${KNOP_TEKST} min-height: 32px; padding: 0 8px; color: #4B5C58; font-size: 18px; line-height: 1;`)}
        >
          ⋯
        </button>
      </div>
      {menu && (
        <div role="menu" data-testid="ap-menu-lijst" style={css('position: absolute; right: 10px; top: 42px; z-index: 5; min-width: 200px; padding: 6px 0; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF; box-shadow: 0 10px 24px rgba(44,74,94,0.12);')}>
          {taak.bron === 'chat' && (
            <div data-testid="ap-bron-chat" style={css(`${TEKST} font-size: 12px; padding: 4px 14px 6px; color: #7B8985;`)}>
              Voorgesteld door Subsidie Kompas{item.aangepastDoorLid ? ', door u aangepast' : ''}
            </div>
          )}
          {!klaar && (
            <button type="button" role="menuitem" data-testid="ap-zet-bezig" onClick={() => { setMenu(false); zet({ status: taak.status === 'doing' ? 'todo' : 'doing' }); }} style={css(MENU_KNOP)}>
              {taak.status === 'doing' ? 'Terug naar te doen' : 'Ik ben hiermee bezig'}
            </button>
          )}
          <button type="button" role="menuitem" data-testid="ap-bewerk" onClick={() => { setMenu(false); setBewerk(true); }} style={css(MENU_KNOP)}>
            Bewerken
          </button>
          {bevestig ? (
            <span style={css('display: flex; gap: 4px; padding: 0 8px;')}>
              <button type="button" data-testid="ap-verwijder-ja" onClick={() => onVerwijder(taak.id)} style={css(`${KNOP_TEKST} color: #9E3B2C;`)}>
                Ja, verwijderen
              </button>
              <button type="button" onClick={() => setBevestig(false)} style={css(`${KNOP_TEKST} color: #4B5C58;`)}>
                Annuleren
              </button>
            </span>
          ) : (
            <button type="button" role="menuitem" data-testid="ap-verwijder" aria-label={`Verwijderen: ${taak.titel}`} onClick={() => setBevestig(true)} style={css(`${MENU_KNOP} color: #9E3B2C;`)}>
              Verwijderen
            </button>
          )}
        </div>
      )}
      {fout && (
        <div role="alert" data-testid="ap-taak-fout" style={css(`${TEKST} font-size: 13px; font-weight: 700; color: #9E3B2C; padding-left: 30px;`)}>
          {fout}
        </div>
      )}
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
        <div data-testid="ap-leeg" style={css(`${TEKST} padding: 16px 18px; border: 1px dashed #D5E0D9; border-radius: 14px; color: #7B8985;`)}>
          Nog geen eigen taken bij dit project. Voeg een actie toe, bijvoorbeeld “vooroverleg plannen met Fonds A”, of maak een afgeleide actie tot taak.
        </div>
      )}


      {ACTIE_GROEPEN.map((g) =>
        groepen[g].length ? (
          <div key={g} data-testid={`ap-groep-${g}`} style={css('display: flex; flex-direction: column; gap: 8px;')}>
            <h3 style={css(`${LABEL} margin: 6px 0 0; color: ${g === 'te-laat' ? '#9E3B2C' : '#2C4A5E'};`)}>
              {ACTIE_GROEP_LABEL[g]} <span style={css('color: #7B8985;')}>({groepen[g].length})</span>
            </h3>
            <GedeeldeNotitie notities={gedeeldeNotities(groepen[g])} items={groepen[g]} />
            <div style={css('border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; overflow: visible;')}>
            {groepen[g].map((i) =>
              i.soort === SOORT.TAAK ? (
                <Taak key={i.sleutel} item={i} financiers={financiers} regelNaam={naamVanRegel(i.taak.fundingId)} nu={nu} onWijzig={plan.wijzig} onVerwijder={plan.verwijder} verbergNotitie={gedeeldeNotities(groepen[g]).has((i.taak.notitie || '').trim())} />
              ) : (
                <div key={i.sleutel} data-testid="ap-afgeleid-actie" data-soort="afgeleid" style={css('display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 10px 14px 10px 44px; border-bottom: 1px solid #EEF2EF; background: #FBFCFB;')}>
                  <div style={css('min-width: 0; flex: 1 1 240px;')}>
                    <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}><PrioStip prioriteit={i.prioriteit} />{i.titel}</div>
                    <div style={css(`${TEKST} font-size: 13px; color: #687974; overflow-wrap: anywhere;`)}>{[i.regelNaam, i.reden].filter(Boolean).join(' · ')}</div>
                  </div>
                  <SoortLabel soort={SOORT.AFGELEID} />
                  {beschikbaar && (
                    <button type="button" data-testid="ap-maak-taak" onClick={() => maakTaak(i)} style={css(`${KNOP_TEKST} color: #4E9A6C;`)}>
                      + Op mijn lijst
                    </button>
                  )}
                </div>
              ),
            )}
            </div>
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

const FILTER_STIJL = "box-sizing: border-box; min-height: 40px; padding: 6px 12px; border: 1px solid #D5E0D9; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700; color: #2C4A5E;";

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

  const maakTaak = async (a, extra = {}) => {
    const taakInvoer = afgeleidNaarTaak(a.afgeleid);

    return plan.voegToe({ ...taakInvoer, financier: taakInvoer.fundingId ? '' : taakInvoer.financier, bron: 'user', ...extra });
  };
  const inBeeld = useMemo(() => (kiesProject ? actief.filter((p) => p.id === kiesProject) : actief), [actief, kiesProject]);

  const voegToe = async (w) => {
    const regel = regelsVan(kiesProject).find((r) => r.bronStatus === 'zichtbaar' && r.naam && w.financier && r.naam.trim().toLowerCase() === w.financier.trim().toLowerCase());

    return plan.voegToe({ projectId: kiesProject, ...w, financier: regel ? '' : w.financier, fundingId: regel ? regel.id : null, bron: 'user' });
  };

  return (
    <div data-testid="actieplan-overzicht" style={css('display: flex; flex-direction: column; gap: 14px; min-width: 0;')}>
      {actief.length === 0 && (
        <div data-testid="ap-geen-projecten" style={css(`${TEKST} padding: 26px 24px; border: 1px dashed #D5E0D9; border-radius: 16px; background: #FFFFFF;`)}>
          U heeft nog geen actief project. Maak er een aan bij <a href="#/kompas/projecten" style={css('color: #4E9A6C; font-weight: 800;')}>Projecten</a>; het actieplan van uw projecten staat dan hier.
        </div>
      )}
      {actief.length > 0 && status === 'laden' && <div style={css(`${TEKST} color: #7B8985;`)}>Uw actieplannen worden geladen…</div>}
      {actief.length > 0 && status !== 'laden' && (
        <>
          <ActieplanNu items={zichtbaar} projecten={inBeeld} nu={nu} plan={plan} beschikbaar={beschikbaar} maakTaak={maakTaak} naamVanProject={naamVanProject} fondsVan={fondsVan} />
          <StukkenVoorFondsenwerving
            projecten={inBeeld}
            regelsPerProject={perProject}
            aantalFondsen={new Set(inBeeld.flatMap((p) => (perProject[p.id] || []).filter((r) => r.bronStatus === 'zichtbaar' && r.naam).map((r) => r.naam))).size}
            nu={nu}
          />
          <div style={css(`${LABEL} margin-top: 8px;`)}>Alle acties</div>
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
            <span style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>
              <PrioStip prioriteit="high" />= hoge prioriteit
            </span>
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
            <div data-testid="ap-leeg" style={css(`${TEKST} padding: 16px 18px; border: 1px dashed #D5E0D9; border-radius: 14px; color: #7B8985;`)}>
              Geen acties voor deze keuze.
            </div>
          )}

          {ACTIE_GROEPEN.map((g) =>
            groepen[g].length ? (
              <div key={g} data-testid={`ap-groep-${g}`} style={css('display: flex; flex-direction: column; gap: 8px;')}>
                <h3 style={css(`${LABEL} margin: 6px 0 0; color: ${g === 'te-laat' ? '#9E3B2C' : '#2C4A5E'};`)}>
                  {ACTIE_GROEP_LABEL[g]} <span style={css('color: #7B8985;')}>({groepen[g].length})</span>
                </h3>
                <GedeeldeNotitie notities={gedeeldeNotities(groepen[g])} items={groepen[g]} />
                <div style={css('border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF;')}>
                {groepen[g].map((i) =>
                  i.soort === SOORT.TAAK ? (
                    <Taak
                      key={i.sleutel}
                      item={i}
                      verbergNotitie={gedeeldeNotities(groepen[g]).has((i.taak.notitie || '').trim())}
                      projectNaam={kiesProject || actief.length === 1 ? '' : naamVanProject(i.projectId)}
                      financiers={financiersVan(i.projectId)}
                      regelNaam={naamVanRegel(i.projectId, i.taak.fundingId)}
                      nu={nu}
                      onWijzig={plan.wijzig}
                      onVerwijder={plan.verwijder}
                    />
                  ) : (
                    <div key={i.sleutel} data-testid="ap-afgeleid-actie" data-soort="afgeleid" style={css('display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 10px 14px 10px 44px; border-bottom: 1px solid #EEF2EF; background: #FBFCFB;')}>
                      <div style={css('min-width: 0; flex: 1 1 240px;')}>
                        <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}><PrioStip prioriteit={i.prioriteit} />{i.titel}</div>
                        <div style={css(`${TEKST} font-size: 13px; color: #687974; overflow-wrap: anywhere;`)}>{[kiesProject ? '' : naamVanProject(i.projectId), i.regelNaam, i.reden].filter(Boolean).join(' · ')}</div>
                      </div>
                      <SoortLabel soort={SOORT.AFGELEID} />
                      {beschikbaar && (
                        <button type="button" data-testid="ap-maak-taak" onClick={() => maakTaak(i)} style={css(`${KNOP_TEKST} color: #4E9A6C;`)}>
                          + Op mijn lijst
                        </button>
                      )}
                    </div>
                  ),
                )}
                </div>
              </div>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
