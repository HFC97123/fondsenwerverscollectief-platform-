// Gedeelde, rustige bouwstenen voor de financieringsweergave (Dashboard en projectdossier):
// statuschip en CSS-voortgangsbalk. Geen externe UI- of chartbibliotheek.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { STATUS_LABEL, formatEuro } from './dekkingsplan.js';

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
  const beschrijving = `Financiering van ${projectNaam}: toegekend ${formatEuro(dekking.toegekend)}, aangevraagd ${formatEuro(dekking.aangevraagd)}, overige dekking ${formatEuro(dekking.overige)}, nog te financieren ${formatEuro(dekking.nogNodig)}.`;

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
