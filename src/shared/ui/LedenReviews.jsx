// Waardering door leden op de homepage: maximaal vijf kaarten uit
// public.member_reviews (via publieke_ledenreviews(), zie
// data/services/ledenReviews.js). Zonder goedgekeurde, publieke waarderingen
// (of zonder verbinding) rendert dit niets, dus nooit een lege of verzonnen
// sectie. Een lid dat alleen een rating gaf, krijgt een kaart zonder tekst.
import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { useLedenReviews } from '../../data/services/ledenReviews.js';

// Smalle schermen: één kaart per rij over de volle breedte. Daarboven hebben
// alle kaarten dezelfde breedte en staan ze gecentreerd (5 naast elkaar op
// desktop, 3 + 2 op tablet), zodat een laatste kaart nooit uitrekt.
function useSmalScherm(maxBreedte = 560) {
  const lees = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(`(max-width: ${maxBreedte}px)`).matches;
  const [smal, setSmal] = useState(lees);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mq = window.matchMedia(`(max-width: ${maxBreedte}px)`);
    const onChange = () => setSmal(mq.matches);

    onChange();
    mq.addEventListener('change', onChange);

    return () => mq.removeEventListener('change', onChange);
  }, [maxBreedte]);

  return smal;
}

const formatRating = (n) => n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Sterren({ rating }) {
  // Hele sterren op basis van de afgeronde rating; de exacte waarde staat ernaast.
  const gevuld = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span aria-hidden="true" style={css('display: inline-flex; gap: 2px; font-size: 18px; line-height: 1;')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= gevuld ? '#4E9A6C' : '#D6E3E9' }}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function LedenReviews() {
  const { reviews } = useLedenReviews();
  const smal = useSmalScherm();

  if (!reviews.length) {
    return null;
  }

  return (
    <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
      <div style={css('margin-bottom: 36px;')}>
        <div
          style={css(
            'font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;',
          )}
        >
          Waardering
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(24px, 3.4vw, 30px); font-weight: 600; color: #2C4A5E; margin-bottom: 8px;",
          )}
        >
          Wat leden van het Collectief vinden
        </div>
      </div>

      <ul
        style={css(
          'list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;',
        )}
      >
        {reviews.map((r, i) => (
          <li
            key={i}
            style={css(
              `flex: ${smal ? '1 1 100%' : '0 1 200px'}; min-width: 0; max-width: 100%; box-sizing: border-box; background: #FFFFFF; border-radius: 18px; padding: clamp(20px, 3vw, 28px); display: flex; flex-direction: column; gap: 12px;`,
            )}
          >
            <div
              style={css('display: flex; align-items: center; gap: 10px;')}
              role="img"
              aria-label={`Waardering ${formatRating(r.rating)} van 5`}
            >
              <Sterren rating={r.rating} />
              <span style={css('font-size: 14px; font-weight: 700; color: #2C4A5E; font-variant-numeric: tabular-nums;')}>
                {formatRating(r.rating)}
              </span>
            </div>

            {r.tekst && (
              <div
                style={css(
                  "font-family: 'Newsreader', serif; font-size: 17px; font-weight: 500; color: #2C4A5E; line-height: 1.45; overflow-wrap: anywhere; flex-grow: 1;",
                )}
              >
                {'“'}
                {r.tekst}
                {'”'}
              </div>
            )}

            <div style={css('font-size: 13.5px; line-height: 1.4; color: #4B5C58; margin-top: auto; overflow-wrap: anywhere;')}>
              <span style={css('font-weight: 700; color: #2C4A5E;')}>{r.naam || 'Lid van het Collectief'}</span>
              {r.functie && <span> · {r.functie}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
