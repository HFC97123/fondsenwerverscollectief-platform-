// Artikeldetail. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Artikel").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function ArticlePage() {
  const app = useApp();
  const { isArticle, article, goActueel } = app;

  if (!isArticle || !article) return null;

  const terug = (
    <div onClick={goActueel} style={css('cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 14.5px;')}>
      ← Terug naar Actueel
    </div>
  );

  return (
    <div data-screen-label="Artikel">
      <div style={css('max-width: 760px; margin: 0 auto; padding: clamp(30px, 5vw, 48px) clamp(16px, 4vw, 32px) 20px;')}>
        <div style={css('margin-bottom: 26px;')}>{terug}</div>

        <div
          style={css(
            'font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px;',
          )}
        >
          {article.tag} · {article.date}
        </div>

        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(26px, 4.4vw, 38px); font-weight: 600; color: #2C4A5E; line-height: 1.22;",
          )}
        >
          {article.title}
        </div>

        {article.author && (
          <div style={css('margin-top: 16px; font-size: 14.5px; color: #4B5C58;')}>
            door <strong style={css('color: #2C4A5E;')}>{article.author}</strong>
          </div>
        )}
      </div>

      <div style={css('max-width: 760px; margin: 0 auto; padding: 8px clamp(16px, 4vw, 32px) 40px;')}>
        {(article.blocks || []).map((block, i) =>
          block.isHeading ? (
            <div
              key={i}
              style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; margin: 34px 0 12px;")}
            >
              {block.text}
            </div>
          ) : (
            <div key={i} style={css('font-size: 16.5px; line-height: 1.75; color: #3E4E4A; margin-bottom: 16px;')}>
              {block.text}
            </div>
          ),
        )}

        {article.source && (
          <div
            style={css(
              'font-size: 13.5px; font-style: italic; color: #8FA09B; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E1EAE4;',
            )}
          >
            Bron: {article.source}
          </div>
        )}

        <div style={css('margin-top: 30px;')}>{terug}</div>
      </div>
    </div>
  );
}
