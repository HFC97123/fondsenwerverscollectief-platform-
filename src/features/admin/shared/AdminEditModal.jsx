// Gedeelde bewerk-modal voor de admin (Funders, Subsidieregelingen, en
// eventuele latere bewerkschermen). Vervangt het eerdere patroon van een
// bewerkpaneel dat onderaan de tabel/pagina verscheen — bij een lange lijst
// moest je daarvoor helemaal naar beneden scrollen. Nu opent "Bewerken"
// altijd een modal die meteen in beeld is, ongeacht scrollpositie of
// paginagrootte.
//
// - Desktop: 88vw gekapt op 1200px (grofweg 70-90% van de beschikbare
//   breedte op een normaal beeldscherm, zonder absurd breed te worden op
//   een ultrawide monitor).
// - Header (titel + sluiten) en footer (Opslaan/Annuleren) staan vast;
//   alleen de inhoud daartussen scrollt - "Opslaan" is dus altijd
//   bereikbaar, ook bij een lang formulier.
// - Klein scherm: 88vw/92vh van een telefoon is vrijwel het hele scherm,
//   dus dit wordt vanzelf bijna fullscreen zonder een aparte breakpoint.
// - Sluiten via de ×-knop, Annuleren, Escape, of een klik buiten de modal
//   lopen allemaal via dezelfde requestClose(), die bij niet-opgeslagen
//   wijzigingen (dirty) eerst om bevestiging vraagt - hetzelfde
//   window.confirm-patroon dat elders in de admin al gebruikt wordt (zie
//   bijv. het verwijderen van een aanvraagronde), dus geen nieuw
//   dialoogpatroon.
import React, { useEffect } from 'react';
import { css } from '../../../shared/lib/css.js';
import { plainButtonStyle, secondaryButtonStyle } from './adminStyles.js';

export default function AdminEditModal({
  title,
  onClose,
  onSave,
  saving,
  dirty,
  children,
  saveLabel = 'Opslaan',
  savingLabel = 'Opslaan…',
}) {
  const requestClose = () => {
    // eslint-disable-next-line no-alert
    if (dirty && !window.confirm('Je hebt nog niet-opgeslagen wijzigingen. Toch sluiten?')) {
      return;
    }

    onClose();
  };

  useEffect(() => {
    const sluitBijEscape = (e) => {
      if (e.key === 'Escape') {
        requestClose();
      }
    };

    document.addEventListener('keydown', sluitBijEscape);

    return () => document.removeEventListener('keydown', sluitBijEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={requestClose}
      style={css(`
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(44,74,94,0.45);
        display: flex; align-items: center; justify-content: center;
        padding: clamp(0px, 2vw, 32px);
      `)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={css(`
          display: flex;
          flex-direction: column;
          width: min(88vw, 1200px);
          height: min(92vh, 100%);
          max-height: min(92vh, 100%);
          background: #FFFFFF;
          border-radius: 18px;
          box-shadow: 0 24px 60px rgba(44,74,94,0.28);
          overflow: hidden;
        `)}
      >
        <div
          style={css('flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 24px; border-bottom: 1px solid #E1EAE4;')}
        >
          <div style={css("font-family: 'Newsreader', serif; font-size: 22px; color: #2C4A5E;")}>{title}</div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Sluiten"
            style={css('cursor: pointer; border: none; background: none; font-size: 22px; color: #82918B; line-height: 1; padding: 4px;')}
          >
            ×
          </button>
        </div>

        <div style={css('flex: 1 1 auto; overflow-y: auto; padding: clamp(18px, 2.5vw, 24px);')}>{children}</div>

        <div
          style={css('flex-shrink: 0; display: flex; gap: 12px; flex-wrap: wrap; padding: 16px 24px; border-top: 1px solid #E1EAE4; background: #F7FAF8;')}
        >
          <button type="button" disabled={saving} onClick={onSave} style={secondaryButtonStyle}>
            {saving ? savingLabel : saveLabel}
          </button>
          <button type="button" disabled={saving} onClick={requestClose} style={plainButtonStyle}>
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}
