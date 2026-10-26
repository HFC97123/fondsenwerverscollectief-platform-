// FASE5 — Keuzekaart "Welke fondsen wilt u toevoegen?" onder een Subsidie Kompas-antwoord (Pro/Premium).
//
// De chat blijft een gesprek in etappes: het antwoord noemt kort de passende fondsen, deze kaart laat het lid per fonds kiezen:
//   [Toevoegen]  zet het fonds direct in het dekkingsplan (status Interessant, geen bedrag) en markeert het als toegevoegd;
//   [Niet]       haalt het fonds uit beeld (niets opgeslagen; "Toon weer" zet het terug);
//   [Meer info]  vraagt in de chat verder naar precies dit fonds.
// Pas nadat er iets is toegevoegd volgt de volgende vraag: "Zal ik hier acties voor in het actieplan zetten?". Niets gebeurt vanzelf,
// behalve bij een expliciete opdracht in het bericht ("... en zet de kansrijke in mijn dekkingsplan", intentie scan_en_toevoegen).
// Toevoegen loopt altijd via de gedeelde fundingservice; een fonds zonder database-id (type 'online') gaat op naam het dekkingsplan in.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { stapPad } from '../advies/adviesLinks.js';
import { formatDatum } from '../financiering/dekkingsplan.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { ITEM_STATUS, beginStatussen, itemSleutel, kopTekst, maakActiesVoor, samenvattingTekst, telStatussen, voegItemsToe, zoekFundingId } from './fondsMatches.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.5; color: #4B5C58;";
const KNOP = "cursor: pointer; box-sizing: border-box; min-height: 30px; padding: 4px 12px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800;";
const KNOP_PRIMAIR = "cursor: pointer; box-sizing: border-box; min-height: 30px; padding: 4px 14px; border-radius: 999px; border: 1px solid #4E9A6C; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800;";
const LINK = "cursor: pointer; padding: 0; border: none; background: none; color: #4E9A6C; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; text-decoration: underline;";

const CSS_KAART = `
.fwk-fm button:focus-visible, .fwk-fm a:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-fm button:disabled { cursor: default; opacity: 0.6; }
`;

// Per bericht maar één keer automatisch toevoegen (een expliciete opdracht), ook als de kaart opnieuw wordt getekend.
const AUTO_GEDAAN = new Set();

const isToegevoegd = (s) => s === ITEM_STATUS.TOEGEVOEGD || s === ITEM_STATUS.STAAT_AL;

function StatusRegel({ status, projectId }) {
  if (isToegevoegd(status)) {
    return (
      <span data-testid="fm-status" data-status={status} style={css(`${TEKST} font-weight: 800; color: #3E7F59;`)}>
        <span aria-hidden="true">✓ </span>
        {status === ITEM_STATUS.TOEGEVOEGD ? 'Toegevoegd aan het dekkingsplan' : 'Staat al in het dekkingsplan'}
        {' · '}
        <a data-testid="fm-open-financiering" href={projectFinancieringHref(projectId)} style={css('color: #4E9A6C; text-decoration: underline;')}>
          Open dekkingsplan
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
  const [bevestigd, setBevestigd] = useState(intentie !== 'toevoegen');
  const [melding, setMelding] = useState('');
  // Actieplan-vraag: welke toegevoegde fondsen al een antwoord kregen (ja of nee), en de uitkomst van de laatste keer.
  const [actieGevraagd, setActieGevraagd] = useState({});
  const [actieBezig, setActieBezig] = useState(false);
  const [actieUitkomst, setActieUitkomst] = useState(null); // { ok, tekst }
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
      if (uit) setMelding(samenvattingTekst(uit));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tel = telStatussen(statussen);
  const bezig = tel.bezig > 0;
  const statusVan = (i) => statussen[itemSleutel(i)] || ITEM_STATUS.KLAAR;
  const zichtbaar = items.filter((i) => statusVan(i) !== ITEM_STATUS.NIET);
  const overgeslagen = items.filter((i) => statusVan(i) === ITEM_STATUS.NIET);
  const nogTeKiezen = items.filter((i) => statusVan(i) === ITEM_STATUS.KLAAR || statusVan(i) === ITEM_STATUS.MISLUKT);
  // Alleen fondsen die in DIT gesprek zijn toegevoegd krijgen de actieplan-vraag (wat er al stond, heeft zijn eigen route).
  const vraagActiesVoor = items.filter((i) => statusVan(i) === ITEM_STATUS.TOEGEVOEGD && !actieGevraagd[itemSleutel(i)]);

  const toevoegen = async (lijstItems) => {
    const uit = await voeg(lijstItems);

    if (uit) setMelding(samenvattingTekst(uit));
  };

  const niet = (item) => zetStatus(itemSleutel(item), ITEM_STATUS.NIET);

  const toonWeer = () => {
    overgeslagen.forEach((i) => zetStatus(itemSleutel(i), ITEM_STATUS.KLAAR));
  };

  const meerInfo = async (item) => {
    const fundingId = isToegevoegd(statusVan(item)) && item.type !== 'online' ? await zoekFundingId(item, projectId) : null;

    if (onBespreek) onBespreek({ item, fundingId });
  };

  const markeerGevraagd = (lijstItems) => setActieGevraagd((cur) => ({ ...cur, ...Object.fromEntries(lijstItems.map((i) => [itemSleutel(i), true])) }));

  const actiesJa = async () => {
    const doel = vraagActiesVoor;

    if (!doel.length || actieBezig) return;

    setActieBezig(true);

    try {
      const res = await maakActiesVoor({ items: doel, projectId });

      markeerGevraagd(doel);
      setActieUitkomst(
        res.ok
          ? { ok: true, tekst: res.aangemaakt === 1 ? '1 actie toegevoegd aan het actieplan' : res.aangemaakt > 1 ? `${res.aangemaakt} acties toegevoegd aan het actieplan` : 'Het actieplan is bijgewerkt' }
          : { ok: false, tekst: res.melding },
      );

      if (res.ok && onGewijzigd) onGewijzigd();
    } finally {
      setActieBezig(false);
    }
  };

  const actiesNee = () => {
    markeerGevraagd(vraagActiesVoor);
    setActieUitkomst(null);
  };

  if (intentie === 'toevoegen' && !bevestigd) {
    return (
      <div className="fwk-fm" data-testid="fm-bevestiging" style={css('box-sizing: border-box; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8;')}>
        <style>{CSS_KAART}</style>
        <div style={css(`${TEKST} color: #2C4A5E; font-weight: 800;`)}>
          {items.length === 1 ? '1 fonds uit de vorige lijst' : `${items.length} fondsen uit de vorige lijst`} toevoegen aan het dekkingsplan van {projectNaam || 'dit project'}?
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
              toevoegen(items);
            }}
          >
            Ja, voeg toe
          </button>
          <button
            type="button"
            data-testid="fm-bevestig-nee"
            style={css(KNOP)}
            onClick={() => {
              setBevestigd(true);
              setStatussen({});
            }}
          >
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
        <div style={css('min-width: 0;')}>
          <div data-testid="fm-kop" style={css("font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E;")}>
            {kopTekst(items.length)}
            {projectNaam ? <span style={css('font-weight: 600; color: #7B8985;')}> voor {projectNaam}</span> : null}
          </div>
          {nogTeKiezen.length > 0 && <div style={css(`${TEKST} color: #7B8985;`)}>Welke wilt u toevoegen aan het dekkingsplan?</div>}
        </div>
        {nogTeKiezen.length > 1 && (
          <button type="button" data-testid="fm-alles-toevoegen" disabled={bezig || bezigMetAntwoord} style={css(KNOP)} onClick={() => toevoegen(nogTeKiezen)}>
            Alles toevoegen
          </button>
        )}
      </div>

      <ul style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;')}>
        {zichtbaar.map((item) => {
          const sleutel = itemSleutel(item);
          const status = statusVan(item);
          const kanKiezen = status === ITEM_STATUS.KLAAR || status === ITEM_STATUS.MISLUKT;

          return (
            <li
              key={sleutel}
              data-testid="fm-item"
              data-status={status}
              data-type={item.type}
              style={css(`list-style: none; margin: 0; padding: 8px 12px; border: 1px solid ${isToegevoegd(status) ? '#CFE4D7' : '#E1EAE4'}; border-radius: 12px; background: ${isToegevoegd(status) ? '#F3F9F5' : '#FFFFFF'}; min-width: 0;`)}
            >
              <div style={css('display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;')}>
                <div style={css('min-width: 0; flex: 1 1 220px;')}>
                  <div data-testid="fm-naam" style={css("font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;")}>{item.naam}</div>
                  <div style={css(`${TEKST} color: #7B8985;`)}>
                    {item.funder ? `${item.funder} · ` : ''}
                    <span data-testid="fm-deadline">{item.deadline ? `deadline ${formatDatum(item.deadline)}` : 'doorlopend of deadline nog niet bekend'}</span>
                  </div>
                </div>
                <div style={css('display: flex; gap: 6px; flex-wrap: wrap; align-items: center;')}>
                  {kanKiezen && (
                    <>
                      <button type="button" data-testid="fm-toevoegen" disabled={bezig || bezigMetAntwoord} style={css(KNOP_PRIMAIR)} onClick={() => toevoegen([item])}>
                        Toevoegen
                      </button>
                      <button type="button" data-testid="fm-niet" disabled={bezig} style={css(KNOP)} onClick={() => niet(item)} aria-label={`${item.naam} niet toevoegen`}>
                        Niet
                      </button>
                    </>
                  )}
                  {status === ITEM_STATUS.BEZIG && (
                    <span data-testid="fm-bezig" style={css(TEKST)}>Bezig met toevoegen…</span>
                  )}
                  <button type="button" data-testid="fm-bespreek" disabled={bezigMetAntwoord} style={css(LINK)} onClick={() => meerInfo(item)}>
                    Meer info
                  </button>
                </div>
              </div>
              {(isToegevoegd(status) || status === ITEM_STATUS.MISLUKT) && (
                <div style={css('margin-top: 4px;')}>
                  <StatusRegel status={status} projectId={projectId} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {overgeslagen.length > 0 && (
        <div data-testid="fm-overgeslagen" style={css(`${TEKST} color: #7B8985;`)}>
          {overgeslagen.length === 1 ? '1 fonds niet toegevoegd' : `${overgeslagen.length} fondsen niet toegevoegd`}
          {' · '}
          <button type="button" data-testid="fm-toon-weer" style={css(LINK)} onClick={toonWeer}>
            Toon weer
          </button>
        </div>
      )}

      <div data-testid="fm-samenvatting" role="status" aria-live="polite" style={css(`${TEKST} font-weight: 700; color: #3E7F59; min-height: 0;`)}>
        {melding}
      </div>

      {vraagActiesVoor.length > 0 && !bezig && (
        <div data-testid="fm-actievraag" style={css('box-sizing: border-box; padding: 10px 12px; border: 1px solid #CFE4D7; border-radius: 12px; background: #FFFFFF; display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;')}>
          <span style={css(`${TEKST} color: #2C4A5E; font-weight: 700;`)}>
            Zal ik {vraagActiesVoor.length === 1 ? 'voor dit fonds' : `voor deze ${vraagActiesVoor.length} fondsen`} acties in het actieplan zetten?
          </span>
          <span style={css('display: flex; gap: 6px; flex-wrap: wrap;')}>
            <button type="button" data-testid="fm-acties-ja" disabled={actieBezig} style={css(KNOP_PRIMAIR)} onClick={actiesJa}>
              {actieBezig ? 'Bezig…' : 'Ja, zet in actieplan'}
            </button>
            <button type="button" data-testid="fm-acties-nee" disabled={actieBezig} style={css(KNOP)} onClick={actiesNee}>
              Nu niet
            </button>
          </span>
        </div>
      )}

      {actieUitkomst && (
        <div data-testid="fm-actie-uitkomst" role="status" style={css(`${TEKST} font-weight: 700; color: ${actieUitkomst.ok ? '#3E7F59' : '#9A4B3C'};`)}>
          {actieUitkomst.tekst}
          {' · '}
          <a data-testid="fm-open-actieplan" href={`#${stapPad('deadlines', projectId)}`} style={css('color: #4E9A6C; text-decoration: underline;')}>
            Open actieplan
          </a>
        </div>
      )}
    </div>
  );
}
