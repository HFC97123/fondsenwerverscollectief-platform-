// FASE5 — Kaart "N kansrijke financiers" onder een Subsidiekompas-antwoord (Pro/Premium).
//
// De chat blijft een gesprek: dit is een compacte kaart onder het antwoord, geen CRM-scherm. De kaart toont wat de
// bestaande matching al koos (naam, gever, live deadline, waarom passend) en laat de gebruiker BEWUST kiezen:
//   [Toevoegen aan projectfinanciering] per financier, bij een projectscan ook selecteren en bulk toevoegen,
//   [Bespreek] om verder te praten over precies die financier.
// Er wordt niets vanzelf opgeslagen, behalve bij een expliciete opdracht in het bericht ("... en zet de kansrijke in
// mijn dekkingsplan", intentie scan_en_toevoegen). Toevoegen loopt altijd via de gedeelde fundingservice; dubbele
// regels worden door de database geweigerd en hier getoond als "Staat al in projectfinanciering".
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { formatDatum } from '../financiering/dekkingsplan.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { ITEM_STATUS, beginStatussen, itemSleutel, kopTekst, samenvattingTekst, telStatussen, voegItemsToe, zoekFundingId } from './fondsMatches.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.5; color: #4B5C58;";
const KNOP = "cursor: pointer; box-sizing: border-box; min-height: 30px; padding: 4px 12px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800;";
const KNOP_PRIMAIR = "cursor: pointer; box-sizing: border-box; min-height: 30px; padding: 4px 14px; border-radius: 999px; border: 1px solid #4E9A6C; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800;";

const CSS_KAART = `
.fwk-fm button:focus-visible, .fwk-fm a:focus-visible, .fwk-fm input:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-fm button:disabled { cursor: default; opacity: 0.6; }
`;

// Per bericht maar één keer automatisch toevoegen (een expliciete opdracht), ook als de kaart opnieuw wordt getekend.
const AUTO_GEDAAN = new Set();

function StatusRegel({ status, projectId }) {
  if (status === ITEM_STATUS.TOEGEVOEGD || status === ITEM_STATUS.STAAT_AL) {
    return (
      <span data-testid="fm-status" data-status={status} style={css(`${TEKST} font-weight: 800; color: #3E7F59;`)}>
        {status === ITEM_STATUS.TOEGEVOEGD ? 'Toegevoegd aan projectfinanciering' : 'Staat al in projectfinanciering'}
        {' · '}
        <a data-testid="fm-open-financiering" href={projectFinancieringHref(projectId)} style={css('color: #4E9A6C; text-decoration: underline;')}>
          Open projectfinanciering
        </a>
      </span>
    );
  }

  if (status === ITEM_STATUS.MISLUKT) {
    return (
      <span data-testid="fm-status" data-status={status} role="status" style={css(`${TEKST} font-weight: 700; color: #9A4B3C;`)}>
        Toevoegen is niet gelukt. Probeer het opnieuw.
      </span>
    );
  }

  return null;
}

export default function FondsMatchKaart({ lijst, berichtId, projectNaam, projecten, onGewijzigd, onBespreek, bezigMetAntwoord = false }) {
  const { projectId, items, intentie } = lijst;
  const [statussen, setStatussen] = useState(() => beginStatussen(items));
  const [gekozen, setGekozen] = useState({});
  const [bevestigd, setBevestigd] = useState(intentie !== 'toevoegen');
  const [meldingBulk, setMeldingBulk] = useState('');
  const statusRef = useRef(statussen);
  const bezigRef = useRef(false);

  statusRef.current = statussen;

  const zetStatus = useCallback((sleutel, status) => {
    setStatussen((cur) => {
      const nieuw = { ...cur, [sleutel]: status };

      statusRef.current = nieuw;

      return nieuw;
    });
  }, []);

  const voeg = useCallback(
    async (lijstItems) => {
      if (bezigRef.current) {
        return null;
      }

      bezigRef.current = true;

      try {
        const uit = await voegItemsToe({ items: lijstItems, projectId, projecten, huidig: statusRef.current, onStatus: zetStatus });

        if (uit.toegevoegd > 0 && onGewijzigd) {
          onGewijzigd();
        }

        return uit;
      } finally {
        bezigRef.current = false;
      }
    },
    [projectId, projecten, zetStatus, onGewijzigd],
  );

  // Expliciete opdracht: "Scan ... en zet de kansrijke in mijn dekkingsplan" -> direct toevoegen (één keer).
  useEffect(() => {
    if (intentie !== 'scan_en_toevoegen' || AUTO_GEDAAN.has(berichtId)) {
      return;
    }

    AUTO_GEDAAN.add(berichtId);
    voeg(items).then((uit) => {
      if (uit) setMeldingBulk(samenvattingTekst(uit));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tel = telStatussen(statussen);
  const bezig = tel.bezig > 0;
  const nogTeDoen = items.filter((i) => statussen[itemSleutel(i)] === ITEM_STATUS.KLAAR || statussen[itemSleutel(i)] === ITEM_STATUS.MISLUKT);
  const geselecteerd = nogTeDoen.filter((i) => gekozen[itemSleutel(i)]);
  const bulkMogelijk = intentie === 'scan' && nogTeDoen.length > 1;

  const eenToevoegen = async (item) => {
    const uit = await voeg([item]);

    if (uit) setMeldingBulk(samenvattingTekst(uit));
  };

  const bulkToevoegen = async (lijstItems) => {
    const uit = await voeg(lijstItems);

    if (uit) {
      setMeldingBulk(samenvattingTekst(uit));
      setGekozen({});
    }
  };

  const bespreek = async (item) => {
    const status = statussen[itemSleutel(item)];
    const fundingId = status === ITEM_STATUS.TOEGEVOEGD || status === ITEM_STATUS.STAAT_AL ? await zoekFundingId(item, projectId) : null;

    if (onBespreek) onBespreek({ item, fundingId });
  };

  if (intentie === 'toevoegen' && !bevestigd) {
    return (
      <div className="fwk-fm" data-testid="fm-bevestiging" style={css('box-sizing: border-box; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8;')}>
        <style>{CSS_KAART}</style>
        <div style={css(`${TEKST} color: #2C4A5E; font-weight: 800;`)}>
          {items.length === 1 ? '1 financier uit de vorige lijst' : `${items.length} financiers uit de vorige lijst`} toevoegen aan de projectfinanciering van {projectNaam || 'dit project'}?
        </div>
        <ul style={css(`${TEKST} margin: 6px 0 10px; padding-left: 18px;`)}>
          {items.map((i) => (
            <li key={itemSleutel(i)}>{i.naam}</li>
          ))}
        </ul>
        <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
          <button
            type="button"
            data-testid="fm-bevestig-ja"
            style={css(KNOP_PRIMAIR)}
            onClick={() => {
              setBevestigd(true);
              bulkToevoegen(items);
            }}
          >
            Ja, voeg toe
          </button>
          <button type="button" data-testid="fm-bevestig-nee" style={css(KNOP)} onClick={() => {
              setBevestigd(true);
              setStatussen({});
            }}>
            Nee
          </button>
        </div>
      </div>
    );
  }

  if (intentie === 'toevoegen' && Object.keys(statussen).length === 0) {
    return null;
  }

  return (
    <div className="fwk-fm" data-testid="fm-kaart" data-intentie={intentie} style={css('box-sizing: border-box; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8; display: flex; flex-direction: column; gap: 8px;')}>
      <style>{CSS_KAART}</style>
      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap;')}>
        <div data-testid="fm-kop" style={css("font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E;")}>
          {kopTekst(items.length)}
          {projectNaam ? <span style={css('font-weight: 600; color: #7B8985;')}> voor {projectNaam}</span> : null}
        </div>
        {bulkMogelijk && (
          <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
            {geselecteerd.length > 0 && (
              <button type="button" data-testid="fm-selectie-toevoegen" disabled={bezig || bezigMetAntwoord} style={css(KNOP)} onClick={() => bulkToevoegen(geselecteerd)}>
                Selectie toevoegen aan projectfinanciering ({geselecteerd.length})
              </button>
            )}
            <button type="button" data-testid="fm-alles-toevoegen" disabled={bezig || bezigMetAntwoord} style={css(KNOP_PRIMAIR)} onClick={() => bulkToevoegen(nogTeDoen)}>
              Alles toevoegen aan projectfinanciering
            </button>
          </div>
        )}
      </div>

      <ul style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px;')}>
        {items.map((item) => {
          const sleutel = itemSleutel(item);
          const status = statussen[sleutel] || ITEM_STATUS.KLAAR;
          const kanToevoegen = status === ITEM_STATUS.KLAAR || status === ITEM_STATUS.MISLUKT;

          return (
            <li key={sleutel} data-testid="fm-item" data-status={status} style={css('list-style: none; margin: 0; padding: 8px 12px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF; min-width: 0;')}>
              <div style={css('display: flex; gap: 10px; align-items: flex-start;')}>
                {bulkMogelijk && kanToevoegen && (
                  <input
                    type="checkbox"
                    data-testid="fm-kies"
                    aria-label={`${item.naam} selecteren`}
                    checked={!!gekozen[sleutel]}
                    onChange={(e) => setGekozen((cur) => ({ ...cur, [sleutel]: e.target.checked }))}
                    style={css('margin-top: 4px; accent-color: #4E9A6C;')}
                  />
                )}
                <div style={css('min-width: 0; flex: 1 1 auto;')}>
                  <div data-testid="fm-naam" style={css("font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;")}>{item.naam}</div>
                  <div style={css(`${TEKST} color: #7B8985;`)}>
                    {item.funder ? `${item.funder} · ` : ''}
                    <span data-testid="fm-deadline">{item.deadline ? `deadline ${formatDatum(item.deadline)}` : 'deadline doorlopend of niet bekend'}</span>
                  </div>
                  {item.waarom.length > 0 && (
                    <div data-testid="fm-waarom" style={css(TEKST)}>
                      Waarom passend: {item.waarom.join(' · ')}
                    </div>
                  )}
                  <div style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 6px;')}>
                    {kanToevoegen && (
                      <button type="button" data-testid="fm-toevoegen" disabled={bezig || bezigMetAntwoord} style={css(KNOP_PRIMAIR)} onClick={() => eenToevoegen(item)}>
                        Toevoegen aan projectfinanciering
                      </button>
                    )}
                    {status === ITEM_STATUS.BEZIG && (
                      <span data-testid="fm-bezig" style={css(TEKST)}>Bezig met toevoegen…</span>
                    )}
                    <button type="button" data-testid="fm-bespreek" style={css(KNOP)} onClick={() => bespreek(item)}>
                      Bespreek
                    </button>
                    <StatusRegel status={status} projectId={projectId} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div data-testid="fm-samenvatting" role="status" aria-live="polite" style={css(`${TEKST} font-weight: 700; color: #3E7F59; min-height: 0;`)}>
        {meldingBulk}
      </div>
    </div>
  );
}
