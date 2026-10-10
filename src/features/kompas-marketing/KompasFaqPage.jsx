// Veelgestelde vragen over Subsidie Kompas.
// Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Kompas veelgestelde vragen").
//
// De inhoud komt uit useFaqSections(): eerst de tabel kompas_faq in Supabase,
// anders de goedgekeurde tekst uit faqContent.jsx.
import React, { useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useFaqSections } from './useMarketingContent.js';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';

// Een blok is tekst, of een object met opsommingstekens.
function Blok({ blok }) {
  if (blok && Array.isArray(blok.bullets)) {
    return (
      <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
        {blok.bullets.map((b, i) => (
          <div key={i} style={css('display: flex; gap: 10px; align-items: flex-start;')}>
            <span style={css('flex-shrink: 0; color: #4E9A6C; font-size: 15px; line-height: 1.68;')}>•</span>
            <span style={css('font-size: 15px; line-height: 1.68; color: #4B5C58;')}>{b}</span>
          </div>
        ))}
      </div>
    );
  }

  return <div style={css('font-size: 15px; line-height: 1.68; color: #4B5C58;')}>{blok}</div>;
}

export default function KompasFaqPage() {
  const secties = useFaqSections() || [];
  const [open, setOpen] = useState(null);

  return (
    <div data-screen-label="Kompas veelgestelde vragen" style={css('min-height: 100vh; position: relative; z-index: 1;')}>
      <KompasSubnav actief="faq" />

      <div style={css('max-width: 900px; margin: 0 auto; padding: clamp(40px, 6vw, 66px) clamp(16px, 4vw, 24px) clamp(26px, 4vw, 40px);')}>
        <div
          style={css(
            'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 24px;',
          )}
        >
          Veelgestelde vragen
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(30px, 5vw, 46px); font-weight: 600; color: #2C4A5E; line-height: 1.15; margin-bottom: 20px;",
          )}
        >
          Voorwaarden en veelgestelde vragen
        </div>
        <div style={css('font-size: 18px; line-height: 1.65; color: #4B5C58;')}>
          Wat u van Subsidie Kompas kunt verwachten, en welke voorwaarden gelden bij gebruik en abonnement.
        </div>
      </div>

      <div style={css('max-width: 900px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px) clamp(48px, 7vw, 90px);')}>
        <div style={css('display: flex; flex-direction: column; gap: 40px;')}>
          {secties.map((g, gi) => (
            <div key={g.title || gi} style={css('display: flex; flex-direction: column; gap: 12px;')}>
              <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 4px;")}>
                {g.title}
              </div>

              {(g.items || []).map((f, fi) => {
                const id = `${gi}-${fi}`;
                const isOpen = open === id;

                return (
                  <div key={id} style={css('background: #FFFFFF; border: 1px solid #E1EAE4; border-radius: 16px; overflow: hidden;')}>
                    <div
                      onClick={() => setOpen(isOpen ? null : id)}
                      role="button"
                      style={css('cursor: pointer; min-height: 44px; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 18px;')}
                    >
                      <span style={css('font-size: 16px; font-weight: 700; color: #2C4A5E;')}>{f.q}</span>
                      <span style={css('flex-shrink: 0; color: #4E9A6C; font-size: 20px; font-weight: 700;')}>
                        {isOpen ? '−' : '+'}
                      </span>
                    </div>

                    {isOpen && (
                      <div style={css('padding: 0 22px 20px; display: flex; flex-direction: column; gap: 12px;')}>
                        {(f.blocks || (f.a ? [f.a] : [])).map((b, bi) => (
                          <Blok key={bi} blok={b} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
