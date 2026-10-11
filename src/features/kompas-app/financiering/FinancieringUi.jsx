// Gedeelde, rustige bouwstenen voor de financieringsweergave (Dashboard en projectdossier):
// statuschip en CSS-voortgangsbalk. Geen externe UI- of chartbibliotheek.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { STATUS_LABEL, deadlineWeergave, formatEuro } from './dekkingsplan.js';

export const KLEUR = { toegekend: '#4E9A6C', aangevraagd: '#7FB3D5', overige: '#A8D5BA', nogNodig: '#E9EFEB' };

export const STATUS_CHIP = {
  interesting: { bg: '#EAF1F6', color: '#2C4A5E', border: '#CFDFEA' },
  preparing: { bg: '#FBF1E3', color: '#8A5A16', border: '#EEDCC0' },
  submitted: { bg: '#EAF4EE', color: '#2F6D47', border: '#CFE4D7' },
  awarded: { bg: '#EAF4EE', color: '#2F6D47', border: '#CFE4D7' },
  rejected: { bg: '#F9ECEA', color: '#9E3B2C', border: '#EDD3CE' },
};

export function StatusChip({ status }) {
  const s = STATUS_CHIP[status] || STATUS_CHIP.interesting;

  return (
    <span
      data-status={status}
      style={css(
        `display: inline-flex; padding: 3px 10px; border: 1px solid ${s.border}; border-radius: 999px; background: ${s.bg}; color: ${s.color}; font-family: 'Mulish', sans-serif; font-size: 12px; font-weight: 800; white-space: nowrap;`,
      )}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function Voortgangsbalk({ dekking, projectNaam, hoogte = 10 }) {
  const s = dekking.segmenten;
  const beschrijving = `Financiering van ${projectNaam}: toegekend ${formatEuro(dekking.toegekend)}, aangevraagd ${formatEuro(dekking.aangevraagd)}, eigen bijdrage ${formatEuro(dekking.overige)}, nog te financieren ${formatEuro(dekking.nogNodig)}.`;

  return (
    <div
      role="img"
      aria-label={beschrijving}
      data-testid="voortgangsbalk"
      style={css(`display: flex; height: ${hoogte}px; border-radius: 999px; overflow: hidden; background: ${KLEUR.nogNodig};`)}
    >
      <span data-seg="toegekend" style={css(`width: ${s.toegekend}%; background: ${KLEUR.toegekend};`)} />
      <span data-seg="aangevraagd" style={css(`width: ${s.aangevraagd}%; background: ${KLEUR.aangevraagd};`)} />
      <span data-seg="overige" style={css(`width: ${s.overige}%; background: ${KLEUR.overige};`)} />
    </div>
  );
}

// Effectieve deadline van een regel, één weergave voor Projectfinanciering en Mijn deadlines:
// de geldende datum, bij een afwijkende eigen datum beide ("Uw datum / Regeling"), of "Geen deadline bekend".
// compact = alleen de datum met de resterende dagen (voor de kop van een rij).
export function DeadlineWeergave({ regel, nu, compact = false }) {
  const w = deadlineWeergave(regel, nu);
  const grijs = css('color: #7B8985;');

  if (w.vergelijking) {
    return (
      <>
        <div>Uw datum: {w.vergelijking.eigen}</div>
        <div style={grijs}>{w.vergelijking.bronLabel}: {w.vergelijking.systeem}</div>
      </>
    );
  }

  if (!w.heeftDeadline) {
    return <span style={grijs}>Geen deadline bekend</span>;
  }

  if (compact) {
    return (
      <>
        <div>{w.datumTekst}</div>
        <div style={css('font-size: 12.5px; font-weight: 700; color: #7B8985;')}>{w.dagenTekst}</div>
      </>
    );
  }

  return (
    <>
      {w.datumTekst}
      <span style={grijs}> ({w.dagenTekst})</span>
      {w.herkomst && <div style={grijs}>{w.herkomst}</div>}
    </>
  );
}

function Bel({ aan }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      {!aan && <path d="M3 3l18 18" />}
    </svg>
  );
}

// Herinnering aan/uit: alleen de vlag reminder_enabled op de regel. Er wordt (nog) niets verstuurd:
// geen e-mail, geen push, geen geplande taak.
export function HerinneringKnop({ aan, onWissel, naam, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(aan)}
      aria-label={`Herinnering, ${naam}`}
      data-testid="herinnering-knop"
      data-aan={aan ? 'ja' : 'nee'}
      disabled={disabled}
      onClick={onWissel}
      style={css(
        `cursor: ${disabled ? 'default' : 'pointer'}; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid ${aan ? '#BFD4C6' : '#E1EAE4'}; border-radius: 999px; background: ${aan ? '#EAF4EE' : '#FFFFFF'}; color: ${aan ? '#2F6D47' : '#687974'}; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800; white-space: nowrap;`,
      )}
    >
      <Bel aan={Boolean(aan)} />
      {aan ? 'Herinnering aan' : 'Herinnering uit'}
    </button>
  );
}
