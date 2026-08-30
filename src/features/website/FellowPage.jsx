// Voor fondsenwervers. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Voor fondsenwervers").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const kaart = css('background: #FFFFFF; border-radius: 20px; padding: 32px;');
const kaartKop = css("font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;");
const kaartTekst = css('font-size: 15.5px; line-height: 1.6; color: #4B5C58; margin-bottom: 14px;');
const kaartLink = css('cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;');

export default function FellowPage() {
  const app = useApp();
  const { isFellow, goActueel, goNetwerk, goKompas } = app;

  if (!isFellow) return null;

  return (
    <div data-screen-label="Voor fondsenwervers">
      <div style={css('max-width: 980px; margin: 0 auto; padding: clamp(36px, 6vw, 60px) clamp(16px, 4vw, 32px); text-align: center;')}>
        <div
          style={css(
            'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;',
          )}
        >
          Voor fondsenwervers
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;",
          )}
        >
          Professionalisering en verdieping voor fondsenwervers
        </div>
        <div style={css('font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;')}>
          Professionaliseer uw werk, deel vakkennis uit en breid uw netwerk uit. Gebruik Subsidie Kompas als
          betrouwbaar hulpmiddel in uw dagelijkse praktijk.
        </div>
      </div>

      <div
        style={css(
          'max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 72px; display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 24px;',
        )}
      >
        <div style={kaart}>
          <div style={kaartKop}>Vakkennis &amp; verdieping</div>
          <div style={kaartTekst}>
            Nieuws, verdiepende artikelen en actuele regelgeving, voor en door fondsenwervers.
          </div>
          <div onClick={goActueel} style={kaartLink}>
            Naar de actueel-pagina →
          </div>
        </div>

        <div style={kaart}>
          <div style={kaartKop}>Collectief</div>
          <div style={kaartTekst}>
            Netwerk, intervisie, praktijkgidsen en kant-en-klare templates. Leer van elkaars aanvragen, afwijzingen en
            toekenningen.
          </div>
          <div onClick={goNetwerk} style={kaartLink}>
            Naar het Collectief →
          </div>
        </div>

        <div style={kaart}>
          <div style={kaartKop}>Subsidie Kompas in uw werk</div>
          <div style={kaartTekst}>
            Gebruik Subsidie Kompas om sneller te matchen, deadlines te bewaken en aanvragen te onderbouwen, naast uw
            eigen vakkennis.
          </div>
          <a href="#" onClick={goKompas} style={css('font-weight: 700; color: #4E9A6C; font-size: 15px;')}>
            Probeer Subsidie Kompas →
          </a>
        </div>
      </div>
    </div>
  );
}
