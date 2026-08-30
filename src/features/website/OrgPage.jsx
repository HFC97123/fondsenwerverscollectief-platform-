// Voor organisaties. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Voor organisaties").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const STAPPEN = [
  {
    n: '01',
    titel: 'Vertel over uw project',
    tekst: 'Beschrijf in gewone taal uw organisatie, uw project en uw financieringsbehoefte.',
  },
  {
    n: '02',
    titel: 'Fondsenwervend advies',
    tekst:
      'Ontvang advies over de kansrijkheid van uw project en een strategie om uw financiering rond te krijgen.',
  },
  {
    n: '03',
    titel: 'Zelf aan de slag',
    tekst: 'Ga zelf aan de slag met uw fondsenwervende strategie, inclusief passende fondsen en een actieplan.',
  },
  {
    n: '04',
    titel: 'Aanvragen indienen',
    tekst:
      'Ontvang begeleiding bij een sterke aanvraag, waaronder projectplan, begroting en overige materialen.',
  },
];

function Vormen() {
  return (
    <div style={css('position: absolute; inset: 0; pointer-events: none; z-index: 0;')} aria-hidden="true">
      <svg
        style={css('position: absolute; top: 16%; left: 3%; width: 96px; height: 96px; opacity: 0.4; animation: fw-float-a 11s ease-in-out infinite;')}
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="32" cy="32" r="22" stroke="#9FB8C4" strokeWidth="1.6" />
        <path d="M32 15c1 4-1 8-1 12M32 49c1-4-1-8-1-12" stroke="#9FB8C4" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M32 20 L38 32 L32 44 L26 32 Z" stroke="#A8D5BA" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <circle cx="32" cy="32" r="2" fill="#A8D5BA" />
        <path d="M14 44c-3 3-3 6-1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>

      <svg
        style={css('position: absolute; bottom: 11%; right: 8%; width: 92px; height: 92px; opacity: 0.36; animation: fw-float-d 12s ease-in-out infinite;')}
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="32" cy="32" r="31" stroke="#B9D6C9" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="27" stroke="#B9D6C9" strokeWidth="1" />
        <path
          d="M38 16c-5-1-10 1-12 5 -1 2-2 5-6 7 l7 3 c-2 2-2 4 1 5 c-2 2-1 4 2 5 c-2 2-1 4 3 6 l0 4 c0 2 3 3 6 3 l9 0 c0-4-2-7-2-10 c5-2 8-8 8-14 c0-9-5-15-16-15Z"
          stroke="#9FB8C4"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="31" cy="25" r="1.2" fill="#9FB8C4" />
        <path d="M18 22c3-3 7-4 10-3" stroke="#A8D5BA" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <text x="45" y="46" fontFamily="'Newsreader', serif" fontSize="13" fill="#9FB8C4" textAnchor="middle">
          €
        </text>
        <path d="M53 49c3 3 3 6 1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

export default function OrgPage() {
  const app = useApp();
  const { isOrg, heroAnimationOn, goKompas, goOrient, goNetwerk } = app;

  if (!isOrg) return null;

  return (
    <div data-screen-label="Voor organisaties">
      <div
        style={css(
          'max-width: 980px; margin: 0 auto; padding: clamp(36px, 6vw, 60px) clamp(16px, 4vw, 32px); text-align: center; position: relative; overflow: hidden;',
        )}
      >
        {heroAnimationOn && <Vormen />}

        <div style={css('position: relative; z-index: 1;')}>
          <div
            style={css(
              'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF1F6; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;',
            )}
          >
            Voor organisaties
          </div>
          <div
            style={css(
              "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;",
            )}
          >
            Financiering vinden voor uw project
          </div>
          <div style={css('font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;')}>
            U bent een organisatie en wilt het zelf doen. Subsidie Kompas helpt u op weg, stap voor stap.
          </div>
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 72px;')}>
        <div
          style={css(
            "text-align: center; font-family: 'Newsreader', serif; font-size: clamp(22px, 3vw, 26px); font-weight: 600; color: #2C4A5E; margin-bottom: 40px;",
          )}
        >
          Zo werkt het
        </div>

        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 24px;')}>
          {STAPPEN.map((s) => (
            <div key={s.n} style={css('background: #FFFFFF; border-radius: 20px; padding: clamp(20px, 3vw, 28px);')}>
              <div
                style={css(
                  "font-family: 'Newsreader', serif; font-size: clamp(24px, 3.4vw, 30px); font-weight: 600; color: #A9C9DE; margin-bottom: 14px;",
                )}
              >
                {s.n}
              </div>
              <div style={css('font-weight: 700; font-size: 16.5px; color: #2C4A5E; margin-bottom: 8px;')}>{s.titel}</div>
              <div style={css('font-size: 14.5px; line-height: 1.6; color: #4B5C58;')}>{s.tekst}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 72px;')}>
        <div
          style={css(
            'background: #EAF1F6; border-radius: 24px; padding: clamp(24px, 4vw, 44px) clamp(20px, 4vw, 56px); display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap;',
          )}
        >
          <div
            style={css(
              "font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; max-width: 520px; line-height: 1.4;",
            )}
          >
            Zet Subsidie Kompas in als uw rechterhand: dé subsidieadviseur en fondsenwerver aan uw zijde.
          </div>
          <a
            href="#"
            onClick={goKompas}
            style={css(
              'padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;',
            )}
          >
            Probeer Subsidie Kompas →
          </a>
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 24px;')}>
          <div
            style={css(
              'background: #EAF4EE; border-radius: 24px; padding: clamp(22px, 3.5vw, 40px); display: flex; flex-direction: column;',
            )}
          >
            <div style={css("font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;")}>
              Iemand opleiden als fondsenwerver?
            </div>
            <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 24px;')}>
              Maak een mooie start met de videomodule en doe de cursus Basisfondsenwerving.
            </div>
            <div
              onClick={goOrient}
              style={css(
                'cursor: pointer; align-self: flex-start; padding: 13px 26px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15px;',
              )}
            >
              Naar Fondsenwerver worden →
            </div>
          </div>

          <div
            style={css(
              'background: #EAF1F6; border-radius: 24px; padding: clamp(22px, 3.5vw, 40px); display: flex; flex-direction: column;',
            )}
          >
            <div style={css("font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;")}>
              Liever persoonlijk contact?
            </div>
            <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 24px;')}>
              Verbind met een ervaren fondsenwerver uit het netwerk, of plaats een vacature binnen het Collectief.
            </div>
            <div
              onClick={goNetwerk}
              style={css(
                'cursor: pointer; align-self: flex-start; padding: 13px 26px; background: #2C4A5E; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15px;',
              )}
            >
              Registreer je voor het Collectief →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
