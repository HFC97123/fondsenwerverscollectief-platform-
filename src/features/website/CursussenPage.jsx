// Cursussen en masterclasses. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Cursussen").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const CURSUSSEN = [
  {
    doelgroep: 'Voor beginners',
    titel: 'Basiscursus Fondsenwerving',
    tekst:
      'Leer stap voor stap alles wat u nodig heeft om zelfstandig fondsen te werven, van de eerste beginselen tot het verdiepen in strategie en relatiebeheer. Ideaal om iemand binnen uw organisatie volledig op te leiden.',
    punten: [
      'Het fondsenlandschap, soorten financiering en passende fondsen vinden',
      'Een projectplan, begroting en kansrijke aanvraag opstellen',
      'Strategie, meerjarige financiering en duurzame relaties met fondsen en donateurs',
    ],
  },
  {
    doelgroep: 'Voor gevorderden',
    titel: 'Verdiepende Masterclass',
    tekst:
      'Masterclasses voor de ervaren fondsenwerver. Rond een actueel thema nodigen we een spreker uit en gaan we samen de diepte in. Elke masterclass staat op zichzelf, met een steeds wisselend onderwerp.',
    punten: [
      'Een actueel thema uit het vak, telkens anders',
      'Een gastspreker met ervaring uit de praktijk',
      'Verdieping en uitwisseling met vakgenoten',
    ],
  },
];

export default function CursussenPage() {
  const app = useApp();
  const { isCursussen, goOrient, cursussenNotice, cursussenNoticeLabel } = app;

  if (!isCursussen) return null;

  return (
    <div data-screen-label="Cursussen">
      <div
        style={css(
          'max-width: 980px; margin: 0 auto; padding: clamp(36px, 6vw, 60px) clamp(16px, 4vw, 32px) clamp(30px, 5vw, 48px); text-align: center;',
        )}
      >
        <div
          style={css(
            'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #F1EDE3; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;',
          )}
        >
          Cursussen &amp; masterclasses
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;",
          )}
        >
          Leer fondsenwerven, van basis tot verdieping
        </div>
        <div style={css('font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;')}>
          Van de eerste beginselen tot een verdiepende masterclass voor de gevorderde fondsenwerver. Onze cursussen
          zijn in ontwikkeling, laat u alvast informeren zodra ze starten.
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 40px;')}>
        <div
          style={css(
            'background: #EAF4EE; border: 1px solid #DCEDE3; border-radius: 16px; padding: 18px 24px; display: flex; align-items: center; gap: 14px; justify-content: center; text-align: center;',
          )}
        >
          <div
            style={css(
              'font-size: 11.5px; font-weight: 700; color: #FFFFFF; background: #4E9A6C; padding: 4px 12px; border-radius: 999px; white-space: nowrap;',
            )}
          >
            {cursussenNoticeLabel || 'In ontwikkeling'}
          </div>
          <div style={css('font-size: 15px; color: #2C4A5E; font-weight: 700;')}>
            {cursussenNotice ||
              'Dit is een voorbeeldpagina. De Basiscursus Fondsenwerving en de verdiepende masterclass zijn nog in ontwikkeling en komen binnenkort beschikbaar.'}
          </div>
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 24px;')}>
          {CURSUSSEN.map((c) => (
            <div
              key={c.titel}
              style={css(
                'background: #FFFFFF; border-radius: 24px; padding: clamp(22px, 3.5vw, 40px); display: flex; flex-direction: column;',
              )}
            >
              <div style={css('display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;')}>
                <div
                  style={css(
                    'font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em;',
                  )}
                >
                  {c.doelgroep}
                </div>
                <div
                  style={css(
                    'font-size: 12px; font-weight: 700; color: #8A6D3B; background: #F1EDE3; padding: 4px 12px; border-radius: 999px;',
                  )}
                >
                  Binnenkort
                </div>
              </div>

              <div
                style={css(
                  "font-family: 'Newsreader', serif; font-size: clamp(22px, 3vw, 26px); font-weight: 600; color: #2C4A5E; margin-bottom: 10px;",
                )}
              >
                {c.titel}
              </div>

              <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 22px;')}>{c.tekst}</div>

              <div style={css('display: flex; flex-direction: column; gap: 12px; margin-bottom: 26px;')}>
                {c.punten.map((p) => (
                  <div key={p} style={css('display: flex; gap: 10px; align-items: flex-start;')}>
                    <div style={css('width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-top: 7px; flex-shrink: 0;')} />
                    <div style={css('font-size: 14.5px; color: #2C4A5E;')}>{p}</div>
                  </div>
                ))}
              </div>

              <div
                style={css(
                  'margin-top: auto; padding: 13px 26px; background: #EAF4EE; color: #4E9A6C; border-radius: 999px; font-weight: 700; font-size: 15px; text-align: center; align-self: flex-start;',
                )}
              >
                Nog niet beschikbaar
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div
          style={css(
            'background: #2C4A5E; border-radius: 26px; padding: clamp(24px, 4vw, 52px); display: flex; align-items: center; justify-content: space-between; gap: 36px; flex-wrap: wrap;',
          )}
        >
          <div>
            <div
              style={css(
                'font-size: 13px; font-weight: 700; color: #A9C9DE; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;',
              )}
            >
              Blijf op de hoogte
            </div>
            <div
              style={css(
                "font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #FFFFFF; max-width: 520px; line-height: 1.4;",
              )}
            >
              Wilt u weten wanneer de cursussen starten? Laat het ons weten, dan houden we u op de hoogte.
            </div>
          </div>
          <div
            onClick={goOrient}
            style={css(
              'cursor: pointer; padding: 15px 30px; background: #A8D5BA; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;',
            )}
          >
            Bekijk eerst de video's →
          </div>
        </div>
      </div>
    </div>
  );
}
