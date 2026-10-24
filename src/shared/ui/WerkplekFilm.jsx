// Korte film van de werkplek van Subsidie Kompas, gedeeld door Hoe het werkt en de voorpagina.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../lib/css.js';

const VIDEO_BRON = '/uploads/subsidie-kompas-video.mp4';
const VIDEO_POSTER = '/uploads/subsidie-kompas-video-poster.jpg';

// Korte film van de werkplek: stil, in een lus, met een eigen pauzeknop. Bij "minder beweging" in het systeem start hij niet vanzelf.
export default function WerkplekFilm() {
  const ref = useRef(null);
  const [speelt, setSpeelt] = useState(false);

  useEffect(() => {
    const v = ref.current;
    const minderBeweging = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!v || minderBeweging) {
      return undefined;
    }

    const p = v.play();

    if (p && p.catch) {
      p.catch(() => setSpeelt(false));
    }

    return undefined;
  }, []);

  const wissel = () => {
    const v = ref.current;

    if (!v) {
      return;
    }

    if (v.paused) {
      const p = v.play();

      if (p && p.catch) {
        p.catch(() => {});
      }
    } else {
      v.pause();
    }
  };

  return (
    <div style={css('position: relative; border-radius: 18px; overflow: hidden; background: #F7F9F8; border: 1px solid #E4EBE7; box-shadow: 0 18px 44px rgba(44, 74, 94, 0.16); aspect-ratio: 16 / 9;')}>
      <video
        ref={ref}
        src={VIDEO_BRON}
        poster={VIDEO_POSTER}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Korte film van de werkplek van Subsidie Kompas: fondsen vinden, dekkingsplan, deadlines en aanvraag toetsen"
        onPlay={() => setSpeelt(true)}
        onPause={() => setSpeelt(false)}
        style={css('display: block; width: 100%; height: 100%; object-fit: cover;')}
      />
      <button
        type="button"
        onClick={wissel}
        aria-label={speelt ? 'Film pauzeren' : 'Film afspelen'}
        style={css(
          "cursor: pointer; position: absolute; right: 12px; bottom: 12px; min-width: 44px; min-height: 44px; padding: 0 16px; border: none; border-radius: 999px; background: rgba(44, 74, 94, 0.88); color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 700;",
        )}
      >
        {speelt ? 'Pauze' : 'Afspelen'}
      </button>
    </div>
  );
}
