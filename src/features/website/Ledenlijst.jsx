// Ledenlijst van het Collectief. Leden bepalen zelf of zij zichtbaar zijn.
import React, { useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useKompas } from '../kompas-app/KompasStore.jsx';
import { Toggle, inputStyle } from './legacyUi.jsx';

const AVATAR_KLEUREN = ['#A8D5BA', '#A9C9DE', '#D9E7C9', '#CFE0EB', '#E4DDF0', '#F0E3C9'];

// Voorbeeldleden tot de ledentabel in Supabase gekoppeld is.
const LEDEN = [
  { naam: 'Sanne de Vries', rol: 'Fondsenwerver · Stichting Buurtkracht', bio: 'Werkt aan wijkinitiatieven en zoekt vooral bij vermogensfondsen en gemeenten.', tags: ['Sociale cohesie', 'Utrecht'] },
  { naam: 'Joost Verhoeven', rol: 'Zelfstandig fondsenwerver', bio: 'Begeleidt culturele organisaties bij meerjarige aanvragen en dekkingsplannen.', tags: ['Cultuur', 'Meerjarig'] },
  { naam: 'Fatima el Amrani', rol: 'Coördinator · Jeugdwerk Oost', bio: 'Zoekt financiering voor jongerenprogramma’s en talentontwikkeling.', tags: ['Jeugd', 'Amsterdam'] },
  { naam: 'Pieter Hoogland', rol: 'Directeur · Zorgcoöperatie Noord', bio: 'Combineert zorgsubsidies met particuliere fondsen voor ouderenprojecten.', tags: ['Zorg en welzijn', 'Groningen'] },
  { naam: 'Rianne Bakker', rol: 'Fondsenwerver · Natuurpunt Gelderland', bio: 'Ervaring met provinciale regelingen en Europese cofinanciering.', tags: ['Natuur', 'Gelderland'] },
  { naam: 'Ahmed Yildiz', rol: 'Programmamanager · Stichting Meedoen', bio: 'Werkt aan armoedebestrijding en schuldhulp, veel gemeentelijke trajecten.', tags: ['Armoede en inclusie', 'Rotterdam'] },
];

export default function Ledenlijst({ eigenNaam }) {
  const store = useKompas();
  const [query, setQuery] = useState('');

  const gefilterd = useMemo(() => {
    const eigen = store.memberVisible
      ? [{
          naam: eigenNaam || 'Uw profiel',
          rol: 'Lid van het Collectief',
          bio: 'Fondsenwerver met hart voor maatschappelijke projecten.',
          tags: ['Fondsenwerving'],
          isSelf: true,
        }]
      : [];

    const q = query.trim().toLowerCase();

    return eigen
      .concat(LEDEN)
      .filter((l) => !q || `${l.naam} ${l.rol} ${l.bio} ${l.tags.join(' ')}`.toLowerCase().indexOf(q) !== -1);
  }, [query, store.memberVisible, eigenNaam]);

  return (
    <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 72px;')}>
      <div style={css('display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-bottom: 24px;')}>
        <div>
          <div style={css("font-family: 'Newsreader', serif; font-size: clamp(23px, 3.2vw, 28px); font-weight: 600; color: #2C4A5E;")}>
            Leden van het Collectief
          </div>
          <div style={css('font-size: 15px; color: #4B5C58; margin-top: 6px;')}>
            {`${gefilterd.length} ${gefilterd.length === 1 ? 'lid' : 'leden'} zichtbaar${
              query.trim() ? ' voor deze zoekopdracht' : '. Leden bepalen zelf of zij in deze lijst staan.'
            }`}
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op naam, expertise of regio…"
          style={{ ...inputStyle, flex: '1 1 260px', maxWidth: '360px' }}
        />
      </div>

      <div style={css('margin-bottom: 18px; padding: 16px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;')}>
        <div style={css('flex: 1 1 280px; min-width: 0;')}>
          <div style={css('margin-bottom: 5px; font-size: 15px; font-weight: 700; color: #2C4A5E;')}>
            Wilt u zichtbaar zijn voor andere leden?
          </div>
          <div style={css('font-size: 14px; line-height: 1.6; color: #4B5C58; text-wrap: pretty;')}>
            {store.memberVisible
              ? 'Uw naam, functie en organisatie zijn zichtbaar voor andere leden van het Collectief. Uw contactgegevens deelt u zelf.'
              : 'U staat niet in de ledenlijst. Andere leden kunnen u niet vinden of benaderen.'}
          </div>
        </div>
        <Toggle
          on={store.memberVisible}
          onChange={() => store.patch({ memberVisible: !store.memberVisible })}
          label={store.memberVisible ? 'Wel zichtbaar' : 'Niet zichtbaar'}
          ariaLabel="Zichtbaar voor andere leden"
        />
      </div>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 18px;')}>
        {gefilterd.map((l, i) => (
          <div key={l.naam} style={css('background: #FFFFFF; border-radius: 18px; padding: clamp(20px, 3vw, 24px); display: flex; flex-direction: column; gap: 12px;')}>
            <div style={css('display: flex; align-items: center; gap: 13px;')}>
              <span style={css(`
                width: 46px;
                height: 46px;
                flex-shrink: 0;
                border-radius: 50%;
                background: ${AVATAR_KLEUREN[i % AVATAR_KLEUREN.length]};
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Newsreader', serif;
                font-size: 17px;
                font-weight: 600;
                color: #2C4A5E;
              `)}
              >
                {l.naam.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span style={css('min-width: 0;')}>
                <span style={css('display: block; font-size: 15px; font-weight: 800; color: #2C4A5E;')}>{l.naam}</span>
                <span style={css('display: block; margin-top: 2px; font-size: 13px; color: #687974;')}>{l.rol}</span>
              </span>
            </div>

            <div style={css('font-size: 14px; line-height: 1.6; color: #4B5C58; text-wrap: pretty;')}>{l.bio}</div>

            <div style={css('display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto;')}>
              {l.tags.map((t) => (
                <span key={t} style={css('padding: 4px 11px; border-radius: 999px; background: #F2F6F4; color: #4B5C58; font-size: 11.5px; font-weight: 700;')}>
                  {t}
                </span>
              ))}
            </div>

            {l.isSelf && <span style={css('font-size: 12.5px; font-weight: 800; color: #4E9A6C;')}>Dit bent u</span>}
          </div>
        ))}
      </div>

      {!gefilterd.length && (
        <div style={css('padding: 26px 22px; border: 1px dashed #D5E0D9; border-radius: 18px; font-size: 15px; line-height: 1.65; color: #7B8985;')}>
          Geen leden gevonden. Pas uw zoekopdracht aan.
        </div>
      )}
    </div>
  );
}
