// FASE5 — "Bespreek met Subsidiekompas": één gedeelde link voor Projectfinanciering, Mijn deadlines en Dashboard.
// Alleen navigatie (geen schrijfactie): opent het laatste gesprek van dit project of een nieuw gesprek met dit project,
// met de fundingregel als focus. De chat valideert gesprek, project en focus server-side.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { useKompas } from '../KompasStore.jsx';
import { bespreekHref } from './deeplinks.js';

const STIJL = "display: inline-flex; align-items: center; min-height: 44px; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #2C4A5E; text-decoration: none;";

export default function BespreekLink({ projectId, fundingId, naam = '', stijl = '', label = 'Bespreek met Subsidiekompas' }) {
  const store = useKompas();

  return (
    <a
      data-testid="bespreek-link"
      href={bespreekHref({ projectId, fundingId, gesprekken: store.conversations })}
      aria-label={naam ? `${label}: ${naam}` : label}
      style={css(`${STIJL} ${stijl}`)}
    >
      {label} →
    </a>
  );
}
