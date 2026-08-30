// Fondsenwerver worden. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Fondsenwerver worden").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function OrientPage() {
  const app = useApp();
  const { isOrient, videos, goCursussen } = app;

  if (!isOrient) return null;

  return (
    <div data-screen-label="Fondsenwerver worden">
      <div
        style={css(
          'max-width: 980px; margin: 0 auto; padding: clamp(36px, 6vw, 60px) clamp(16px, 4vw, 32px) clamp(32px, 5vw, 56px); text-align: center;',
        )}
      >
        <div
          style={css(
            'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #F1EDE3; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;',
          )}
        >
          Fondsenwerver worden
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;",
          )}
        >
          Ontdek het vak van fondsenwerver
        </div>
        <div style={css('font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;')}>
          Nieuwsgierig hoe fondsenwerving werkt? Bekijk korte video's van ervaren vakgenoten en ontdek of het vak bij u
          past.
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 60px;')}>
        <div style={css('display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 32px;')}>
          <div style={css("font-family: 'Newsreader', serif; font-size: clamp(22px, 3vw, 26px); font-weight: 600; color: #2C4A5E;")}>
            Uitgelichte video's
          </div>
          <a href="#" style={css('font-weight: 700; color: #2C4A5E; font-size: 15px;')}>
            Volledig archief →
          </a>
        </div>

        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 24px;')}>
          {(videos || []).map((v, i) => (
            <div key={v.title || i} style={css('background: #FFFFFF; border-radius: 18px; overflow: hidden;')}>
              <div
                style={css(
                  'width: 100%; aspect-ratio: 16/9; background: repeating-linear-gradient(135deg, #A9C9DE, #A9C9DE 10px, #C6DDEA 10px, #C6DDEA 20px); display: flex; align-items: center; justify-content: center; position: relative;',
                )}
              >
                <div
                  style={css(
                    'width: 46px; height: 46px; border-radius: 50%; background: rgba(255,255,255,0.85); display: flex; align-items: center; justify-content: center;',
                  )}
                >
                  <div
                    style={css(
                      'width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 13px solid #2C4A5E; margin-left: 3px;',
                    )}
                  />
                </div>
                <div
                  style={css(
                    'position: absolute; top: 10px; left: 10px; background: #F1EDE3; color: #8A6D3B; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px;',
                  )}
                >
                  Binnenkort
                </div>
                <div
                  style={css(
                    'position: absolute; bottom: 10px; right: 10px; background: rgba(44,74,94,0.85); color: #FFFFFF; font-size: 12px; padding: 3px 8px; border-radius: 6px;',
                  )}
                >
                  {v.duration}
                </div>
              </div>
              <div style={css('padding: 18px;')}>
                <div style={css('font-size: 12.5px; font-weight: 700; color: #4E9A6C; margin-bottom: 6px;')}>{v.level}</div>
                <div style={css('font-weight: 700; font-size: 15.5px; color: #2C4A5E; line-height: 1.4;')}>{v.title}</div>
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
              Klaar voor de volgende stap?
            </div>
            <div
              style={css(
                "font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #FFFFFF; max-width: 520px; line-height: 1.4;",
              )}
            >
              Volg de Basiscursus Fondsenwerving of een verdiepende masterclass.
            </div>
          </div>
          <div
            onClick={goCursussen}
            style={css(
              'cursor: pointer; padding: 15px 30px; background: #A8D5BA; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;',
            )}
          >
            Bekijk cursussen →
          </div>
        </div>
      </div>
    </div>
  );
}
