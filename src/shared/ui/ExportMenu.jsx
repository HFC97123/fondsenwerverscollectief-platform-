// Eén compacte exportknop met uitklapmenu: Exporteren ▾ -> Word / Excel / PDF.
// Vervangt de losse "Exporteren naar Word"-/"Download Word"-knoppen en wordt
// overal gebruikt waar een lid gegevens bekijkt of bewaart (chat, documenten,
// projecten, organisatieprofiel, gesprekken). Het component bevat geen
// exportlogica zelf: het roept uitsluitend voerExportUit() aan
// (shared/export/exportService.js) met een `bouwModel`-functie van de pagina.
//
// Het menu wordt via een portal bovenop de pagina getekend (position: fixed,
// naast de knop) zodat het nooit wordt afgesneden door een scrollcontainer of
// zijpaneel (zoals het chatvenster of het contextpaneel), en klapt omhoog als
// er onder de knop geen ruimte is.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { css } from '../lib/css.js';
import { color, font } from '../tokens.js';
import { EXPORT_FORMATEN, voerExportUit } from '../export/exportService.js';

const STANDAARD_FORMATEN = ['docx', 'xlsx', 'pdf'];
const RAND = 8;
const Z_INDEX = 3000;

const KNOP_KLEIN = `
  min-height: 30px; padding: 4px 12px; font-size: 12.5px;
  border: 1px solid ${color.lijnBlauw}; background: ${color.achtergrond};
`;
const KNOP_NORMAAL = `
  min-height: 44px; padding: 8px 18px; font-size: 14px;
  border: 1px solid ${color.lijnBlauw}; background: ${color.wit};
`;

// Plaatst een paneel van breedte x hoogte onder (of boven) de knop, binnen het scherm.
function bepaalPositie(knop, breedte, hoogte, rechts) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rechts ? knop.right - breedte : knop.left;

  left = Math.max(RAND, Math.min(left, vw - breedte - RAND));

  let top = knop.bottom + 6;

  if (top + hoogte > vh - RAND && knop.top - 6 - hoogte >= RAND) {
    top = knop.top - 6 - hoogte;
  }

  return { top: Math.max(RAND, top), left };
}

/**
 * @param {Object} props
 * @param {() => Promise<Object>|Object} props.bouwModel   Bouwt het exportmodel voor DEZE context (zie exportModel.js)
 * @param {boolean} [props.toegestaan=true]   Pro/Premium/Admin volgens de bestaande UI-check van de pagina; bij false wordt niets getoond. De service controleert de rechten bovendien zelf opnieuw.
 * @param {string[]} [props.formaten]         Subset van ['docx','xlsx','pdf']
 * @param {'klein'|'normaal'} [props.maat]
 * @param {'links'|'rechts'} [props.uitlijnen]  Aan welke kant van de knop het menu uitlijnt
 * @param {(tekst: string, soort: 'ok'|'fout'|'status') => void} [props.onMelding]  Zonder dit toont het menu zelf een korte melding
 * @param {string} [props.ariaLabel]
 */
export default function ExportMenu({
  bouwModel,
  toegestaan = true,
  formaten = STANDAARD_FORMATEN,
  maat = 'klein',
  onMelding,
  ariaLabel = 'Exporteren',
  uitlijnen = 'links',
}) {
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [eigenMelding, setEigenMelding] = useState(null);
  const [positie, setPositie] = useState(null);
  const [meldingPositie, setMeldingPositie] = useState(null);
  const knopRef = useRef(null);
  const menuRef = useRef(null);
  const meldingRef = useRef(null);
  const bezigRef = useRef(false);
  const rechts = uitlijnen === 'rechts';
  const alleFormaten = formaten.map((f) => EXPORT_FORMATEN[f]).filter(Boolean);

  const meld = useCallback(
    (tekst, soort) => {
      if (onMelding) {
        onMelding(tekst, soort);
      } else {
        setEigenMelding({ tekst, soort });
      }
    },
    [onMelding],
  );

  // Menu meten en naast de knop plaatsen (voor het eerst getekend).
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !knopRef.current) {
      return;
    }

    const m = menuRef.current.getBoundingClientRect();

    setPositie(bepaalPositie(knopRef.current.getBoundingClientRect(), m.width, m.height, rechts));
  }, [open, rechts]);

  useLayoutEffect(() => {
    if (!eigenMelding || !meldingRef.current || !knopRef.current) {
      return;
    }

    const m = meldingRef.current.getBoundingClientRect();

    setMeldingPositie(bepaalPositie(knopRef.current.getBoundingClientRect(), m.width, m.height, rechts));
  }, [eigenMelding, rechts]);

  // Klik buiten het menu of Escape sluit het.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Scrollen of een ander schermformaat: het menu blijft naast de knop staan.
    const herplaats = () => {
      if (menuRef.current && knopRef.current) {
        const m = menuRef.current.getBoundingClientRect();

        setPositie(bepaalPositie(knopRef.current.getBoundingClientRect(), m.width, m.height, rechts));
      }
    };
    const buiten = (e) => {
      if (
        (menuRef.current && menuRef.current.contains(e.target)) ||
        (knopRef.current && knopRef.current.contains(e.target))
      ) {
        return;
      }

      setOpen(false);
    };
    const toets = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', buiten);
    document.addEventListener('touchstart', buiten);
    document.addEventListener('keydown', toets);
    window.addEventListener('resize', herplaats);
    window.addEventListener('scroll', herplaats, true);

    return () => {
      document.removeEventListener('mousedown', buiten);
      document.removeEventListener('touchstart', buiten);
      document.removeEventListener('keydown', toets);
      window.removeEventListener('resize', herplaats);
      window.removeEventListener('scroll', herplaats, true);
    };
  }, [open, rechts]);

  // Een tijdelijke eigen melding verdwijnt vanzelf.
  useEffect(() => {
    if (!eigenMelding) {
      return undefined;
    }

    const t = setTimeout(() => {
      setEigenMelding(null);
      setMeldingPositie(null);
    }, 6000);

    return () => clearTimeout(t);
  }, [eigenMelding]);

  if (!toegestaan || !alleFormaten.length) {
    return null;
  }

  const kies = async (formaat) => {
    setOpen(false);
    setPositie(null);

    // Voorkomt dubbele exports bij dubbelklikken.
    if (bezigRef.current) {
      return;
    }

    bezigRef.current = true;
    setBezig(true);
    setEigenMelding(null);
    setMeldingPositie(null);

    try {
      const { melding } = await voerExportUit({ formaat, bouwModel, onStatus: (t) => meld(t, 'status') });

      meld(melding, 'ok');
    } catch (e) {
      meld(e && e.message ? e.message : 'Het exporteren is niet gelukt. Probeer het opnieuw.', 'fout');
    } finally {
      bezigRef.current = false;
      setBezig(false);
    }
  };

  const knopStijl = css(`
    cursor: ${bezig ? 'default' : 'pointer'};
    opacity: ${bezig ? 0.6 : 1};
    box-sizing: border-box;
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 999px;
    color: ${color.donkerblauw};
    font-family: ${font.tekst}; font-weight: 700; white-space: nowrap;
    ${maat === 'klein' ? KNOP_KLEIN : KNOP_NORMAAL}
  `);

  const paneel = (pos) => `
    position: fixed; z-index: ${Z_INDEX};
    top: ${pos ? pos.top : 0}px; left: ${pos ? pos.left : 0}px;
    visibility: ${pos ? 'visible' : 'hidden'};
  `;

  return (
    <span style={css('display: inline-flex;')}>
      <button
        ref={knopRef}
        type="button"
        onClick={() => {
          if (!bezig) {
            setPositie(null);
            setOpen((o) => !o);
          }
        }}
        disabled={bezig}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={knopStijl}
      >
        {bezig ? 'Bezig…' : 'Exporteren'}
        <span aria-hidden="true" style={css('font-size: 0.85em; line-height: 1;')}>
          ▾
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={css(`
              ${paneel(positie)}
              box-sizing: border-box; min-width: 170px; padding: 6px;
              background: ${color.wit}; border: 1px solid ${color.lijnBlauw}; border-radius: 14px;
              box-shadow: 0 8px 24px rgba(44, 74, 94, 0.14);
            `)}
          >
            {alleFormaten.map((f) => (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                onClick={() => kies(f.id)}
                className="fwk-export-item"
                style={css(`
                  cursor: pointer; display: flex; width: 100%; align-items: center; box-sizing: border-box;
                  min-height: 40px; padding: 8px 12px; border: none; border-radius: 10px; background: none; text-align: left;
                  font-family: ${font.tekst}; font-size: 14px; font-weight: 700; color: ${color.donkerblauw};
                `)}
              >
                {f.label}
              </button>
            ))}
            <style>{'.fwk-export-item:hover,.fwk-export-item:focus-visible{background:#EAF1F6 !important;outline:none}'}</style>
          </div>,
          document.body,
        )}

      {eigenMelding &&
        createPortal(
          <span
            ref={meldingRef}
            role="status"
            style={css(`
              ${paneel(meldingPositie)}
              width: max-content; max-width: min(260px, 80vw); box-sizing: border-box;
              padding: 8px 12px; border-radius: 12px; background: ${color.wit};
              border: 1px solid ${eigenMelding.soort === 'fout' ? color.foutLijn : color.lijnGroen};
              box-shadow: 0 6px 18px rgba(44, 74, 94, 0.12);
              font-family: ${font.tekst}; font-size: 12.5px; line-height: 1.4; white-space: normal;
              color: ${eigenMelding.soort === 'fout' ? color.fout : color.succes};
            `)}
          >
            {eigenMelding.tekst}
          </span>,
          document.body,
        )}
    </span>
  );
}
