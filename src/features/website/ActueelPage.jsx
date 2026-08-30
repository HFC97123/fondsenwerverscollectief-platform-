// Actueel: overzicht van alle nieuwsartikelen.
// Opmaak letterlijk uit het goedgekeurde ontwerp (data-screen-label="Actueel").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function ActueelPage() {
  const app = useApp();
  const { isActueel, allNewsItems, actueelEyebrow, actueelTitle, actueelIntro } = app;

  if (!isActueel) return null;

  return (
    <div data-screen-label="Actueel">
      <div
        style={css(
          'max-width: 980px; margin: 0 auto; padding: clamp(36px, 6vw, 60px) clamp(16px, 4vw, 32px) clamp(32px, 5vw, 56px); text-align: center;',
        )}
      >
        <div
          style={css(
            'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;',
          )}
        >
          {actueelEyebrow || 'Actueel'}
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;",
          )}
        >
          {actueelTitle || 'Nieuws uit subsidieland'}
        </div>
        <div style={css('font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;')}>
          {actueelIntro ||
            'Actuele ontwikkelingen, regelgeving en verdiepende artikelen uit de wereld van fondsen en subsidies.'}
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 28px;')}>
          {(allNewsItems || []).map((item, i) => (
            <div
              key={item.id || i}
              onClick={item.open}
              style={css(
                'cursor: pointer; background: #FFFFFF; border-radius: 18px; padding: clamp(20px, 3vw, 28px); display: flex; flex-direction: column; gap: 12px;',
              )}
            >
              <div style={css('font-size: 13px; font-weight: 700; color: #4E9A6C;')}>
                {item.tag} · {item.date}
              </div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; color: #2C4A5E; line-height: 1.35;")}>
                {item.title}
              </div>
              <div style={css('font-size: 14.5px; line-height: 1.55; color: #4B5C58; flex-grow: 1;')}>{item.excerpt}</div>
              <div style={css('font-weight: 700; color: #2C4A5E; font-size: 14px;')}>Lees meer →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
