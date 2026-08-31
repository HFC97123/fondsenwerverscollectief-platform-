// Gedeelde stijlconstanten van de beheerconsole.
// Overgenomen 1-op-1 (zelfde waarden) uit AdminPage.jsx, zodat er nog maar
// één bron is. Geen nieuwe kleuren, fonts of knopstijlen: alleen hergebruik.
// AdminPage.jsx importeert deze constanten nu ook, in plaats van ze lokaal
// te herdefiniëren.
import { css } from '../../../shared/lib/css.js';

export const panelCss = `
  padding: clamp(18px, 2.5vw, 24px);
  border: 1px solid #E1EAE4;
  border-radius: 18px;
  background: #FFFFFF;
`;

export const panelStyle = css(panelCss);

export const cardGridInner = `
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
`;

export const cardGridStyle = css(cardGridInner);

export const sectionTitleStyle = css(`
  margin: 0 0 8px;
  font-family: 'Newsreader', serif;
  font-size: clamp(26px, 3.4vw, 34px);
  color: #2C4A5E;
`);

export const sectionIntroStyle = css(`
  margin: 0;
  color: #536460;
  font-size: 16px;
  line-height: 1.7;
`);

export const inputStyle = css(`
  width: 100%;
  box-sizing: border-box;
  padding: 13px 14px;
  border: 1px solid #D5E0D9;
  border-radius: 12px;
  background: #FFFFFF;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: #2E3A38;
`);

export const textareaStyle = css(`
  width: 100%;
  box-sizing: border-box;
  padding: 13px 14px;
  border: 1px solid #D5E0D9;
  border-radius: 12px;
  background: #FFFFFF;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: #2E3A38;
  line-height: 1.6;
  resize: vertical;
`);

export const subsectionTitleStyle = css(`
  margin: 0;
  font-family: 'Newsreader', serif;
  font-size: 24px;
  color: #2C4A5E;
`);

export const primaryButtonStyle = css(`
  margin-top: 24px;
  padding: 12px 20px;
  border: none;
  border-radius: 999px;
  background: #4E9A6C;
  color: #FFFFFF;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
`);

export const primaryButtonNoMarginCss = `
  padding: 12px 20px;
  border: none;
  border-radius: 999px;
  background: #4E9A6C;
  color: #FFFFFF;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;

export const primaryButtonNoMarginStyle = css(primaryButtonNoMarginCss);

export const secondaryButtonStyle = css(`
  padding: 11px 18px;
  border: 1px solid #BFD4C6;
  border-radius: 999px;
  background: #FFFFFF;
  color: #2F6D47;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`);

export const uploadButtonStyle = css(`
  display: inline-block;
  padding: 10px 16px;
  border: 1px dashed #BFD4C6;
  border-radius: 999px;
  background: #F7FAF8;
  color: #2F6D47;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`);

export const dangerButtonStyle = css(`
  padding: 11px 18px;
  border: 1px solid #D7A49D;
  border-radius: 999px;
  background: #FFFFFF;
  color: #A13B2F;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`);

export const smallButtonStyle = css(`
  padding: 7px 12px;
  border: 1px solid #BFD4C6;
  border-radius: 999px;
  background: #FFFFFF;
  color: #2F6D47;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`);

export const smallDangerStyle = css(`
  padding: 7px 12px;
  border: 1px solid #E1D3D0;
  border-radius: 999px;
  background: #FFFFFF;
  color: #A13B2F;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`);

export const plainButtonStyle = css(`
  padding: 11px 16px;
  border: none;
  background: transparent;
  color: #536460;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`);

// ---- Nieuw, maar met dezelfde tokens: alleen nodig voor AdminDataTable ----
// (kleuren/fonts/radius identiek aan hierboven; geen nieuw ontwerp.)

export const filterPillStyle = (active) =>
  css(`
    padding: 8px 14px;
    border: 1px solid ${active ? '#4E9A6C' : '#D5E0D9'};
    border-radius: 999px;
    background: ${active ? '#EAF4EE' : '#FFFFFF'};
    color: ${active ? '#2F6D47' : '#536460'};
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  `);

export const searchInputStyle = css(`
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  padding: 13px 15px;
  border: 1px solid #D5E0D9;
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px;
  outline: none;
`);

export const tableWrapStyle = css(`
  overflow-x: auto;
  border: 1px solid #E1EAE4;
  border-radius: 18px;
  background: #FFFFFF;
`);

export const tableStyle = css(`
  width: 100%;
  border-collapse: collapse;
  font-family: inherit;
`);

export const thStyle = css(`
  padding: 12px 14px;
  text-align: left;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #687973;
  background: #F7F9F8;
  border-bottom: 1px solid #E1EAE4;
`);

export const thSortableStyle = css(`
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
`);

export const tdStyle = css(`
  padding: 12px 14px;
  border-bottom: 1px solid #EEF2F0;
  font-size: 13.5px;
  color: #2E3A38;
  vertical-align: top;
`);

export const emptyStateStyle = css(`
  margin-top: 8px;
  padding: 26px;
  border-radius: 16px;
  background: #F1F5F3;
  color: #536460;
`);

export const bulkBarStyle = css(`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 12px 16px;
  border: 1px solid #BFD4C6;
  border-radius: 14px;
  background: #EAF4EE;
`);

export const paginationStyle = css(`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 16px;
`);

export const badgeStyle = (tone) => {
  const tonen = {
    groen: 'background: #EAF4EE; color: #2F6D47;',
    blauw: 'background: #EAF1F6; color: #2C4A5E;',
    geel: 'background: #FFF4D6; color: #8A6514;',
    grijs: 'background: #F1F5F3; color: #536460;',
    rood: 'background: #FFF1EF; color: #A13B2F;',
  };

  return css(`
    display: inline-flex;
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    white-space: nowrap;
    ${tonen[tone] || tonen.grijs}
  `);
};
