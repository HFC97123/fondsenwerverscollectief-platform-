// "Bewerken"-knop rechtsboven op een profielkaart: verschijnt bij de muis erover (of bij toetsenbordfocus; op een aanraakscherm altijd).
// Leidt naar Mijn Subsidie Kompas › Account, waar het profiel gewijzigd wordt.
import React from 'react';
import { css } from '../../shared/lib/css.js';

export const BEWERK_STIJL = `
.fwk-bewerk-kaart { position: relative; }
.fwk-bewerk-kaart .fwk-bewerk-knop { opacity: 0; transition: opacity 0.15s ease; }
.fwk-bewerk-kaart:hover .fwk-bewerk-knop, .fwk-bewerk-kaart:focus-within .fwk-bewerk-knop { opacity: 1; }
@media (hover: none) { .fwk-bewerk-kaart .fwk-bewerk-knop { opacity: 1; } }
`;

export default function BewerkKnop() {
  return (
    <>
      <style>{BEWERK_STIJL}</style>
      <a
        href="#/kompas/account"
        className="fwk-bewerk-knop"
        data-testid="profiel-bewerken"
        style={css("position: absolute; top: 14px; right: 14px; z-index: 2; display: inline-flex; align-items: center; gap: 6px; padding: 7px 15px; border: 1.5px solid #E1EAE4; border-radius: 999px; background: #FFFFFF; color: #4E9A6C; font-family: 'Mulish', sans-serif; font-weight: 700; font-size: 13.5px; text-decoration: none;")}
      >
        Bewerken
      </a>
    </>
  );
}
