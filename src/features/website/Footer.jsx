// Footer. Opmaak letterlijk uit het goedgekeurde ontwerp (FOOTER-blok in
// Het Fondsenwervers Collectief.dc.html).
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const kolomKop = css(
  'font-size: 12px; font-weight: 700; color: #7FA6BC; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 18px;',
);

const kolomLink = css('cursor: pointer; color: #CFE0EB; font-size: 14.5px;');

const onderLink = css('color: #7C97A6;');

export default function Footer() {
  const app = useApp();
  const { isCollectief, goActueel, goKompas, goNetwerk, goContact, goFellow, goOrg, goOrient, goPrivacy, goVoorwaarden } =
    app;

  if (isCollectief === false) return null;

  return (
    <div style={css('background: #21384A; background-image: linear-gradient(180deg, #21384A 0%, #1B2F3E 100%); border-top: 3px solid #4E9A6C;')}>
      <div
        style={css(
          'max-width: 1180px; margin: 0 auto; padding: clamp(40px, 6vw, 68px) clamp(16px, 4vw, 32px) 44px; display: grid; grid-template-columns: repeat(auto-fit, minmax(215px, 1fr)); gap: 48px;',
        )}
      >
        <div>
          <div style={css('display: flex; align-items: center; gap: 12px; margin-bottom: 16px;')}>
            <img
              src="/uploads/collectief-logo-white.png"
              alt="Het Fondsenwervers Collectief logo"
              style={css('width: 46px; height: 46px; object-fit: contain; flex-shrink: 0;')}
            />
            <div style={css("font-family: 'Newsreader', serif; font-weight: 600; font-size: 19px; color: #FFFFFF; line-height: 1.25;")}>
              Het Fondsenwervers
              <br />
              Collectief
            </div>
          </div>
          <div style={css('font-size: 14.5px; line-height: 1.65; color: #A9C9DE; max-width: 270px;')}>
            Het kennisplatform voor fondsenwerving en subsidies, voor en door fondsenwervers.
          </div>
        </div>

        <div>
          <div style={kolomKop}>Platform</div>
          <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
            <div onClick={goActueel} style={kolomLink}>
              Actueel
            </div>
            <a href="#" onClick={goKompas} style={css('color: #CFE0EB; font-size: 14.5px;')}>
              Subsidie Kompas
            </a>
            <div onClick={goNetwerk} style={kolomLink}>
              Collectief
            </div>
            <div onClick={goContact} style={kolomLink}>
              Contact
            </div>
          </div>
        </div>

        <div>
          <div style={kolomKop}>Voor wie</div>
          <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
            <div onClick={goFellow} style={kolomLink}>
              Fondsenwervers
            </div>
            <div onClick={goOrg} style={kolomLink}>
              Organisaties
            </div>
            <div onClick={goOrient} style={kolomLink}>
              Fondsenwerver worden
            </div>
          </div>
        </div>

        <div>
          <div style={kolomKop}>Blijf op de hoogte</div>
          <div style={css('font-size: 14px; color: #A9C9DE; margin-bottom: 16px; line-height: 1.6;')}>
            Maandelijks het laatste nieuws over fondsen en subsidies in uw inbox.
          </div>
          <div
            style={css(
              'display: flex; gap: 8px; background: rgba(255,255,255,0.06); padding: 6px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);',
            )}
          >
            <input
              type="email"
              placeholder="uw@email.nl"
              style={css(
                "flex-grow: 1; min-width: 0; padding: 10px 14px; border-radius: 9px; border: none; font-size: 14px; background: transparent; color: #FFFFFF; font-family: 'Mulish', sans-serif;",
              )}
            />
            <a
              href="#"
              style={css(
                'padding: 10px 20px; background: #A8D5BA; color: #21384A; border-radius: 9px; font-weight: 700; font-size: 14px; white-space: nowrap;',
              )}
            >
              Aanmelden
            </a>
          </div>
        </div>
      </div>

      <div
        style={css(
          'border-top: 1px solid rgba(255,255,255,0.09); max-width: 1180px; margin: 0 auto; padding: 24px clamp(16px, 4vw, 32px); display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #7C97A6; flex-wrap: wrap; gap: 12px;',
        )}
      >
        <div>© 2026 Het Fondsenwervers Collectief</div>
        <div style={css('display: flex; gap: 24px;')}>
          <a href="#" onClick={goPrivacy} style={onderLink}>
            Privacy
          </a>
          <a href="#" onClick={goVoorwaarden} style={onderLink}>
            Voorwaarden
          </a>
          <a href="#" onClick={goContact} style={onderLink}>
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
