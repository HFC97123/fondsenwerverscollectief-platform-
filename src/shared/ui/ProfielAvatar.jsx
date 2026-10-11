// Ronde profielfoto van een lid, met nette fallback. Zonder foto, tijdens het
// laden of bij een kapotte afbeelding verschijnen de initialen (nooit een
// 'broken image'). object-fit: cover zorgt voor een consistente uitsnede.
import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { useProfielFotoUrl } from '../../data/services/profielFoto.js';

export default function ProfielAvatar({ pad, voorbeeldUrl = null, initialen = '', grootte = 120, alt = '' }) {
  const opgeslagen = useProfielFotoUrl(pad);
  const url = voorbeeldUrl || opgeslagen;
  const [kapot, setKapot] = useState(false);

  useEffect(() => {
    setKapot(false);
  }, [url]);

  const toonFoto = Boolean(url) && !kapot;

  return (
    <div
      data-avatar={toonFoto ? 'foto' : 'initialen'}
      style={css(
        `width: ${grootte}px; height: ${grootte}px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: repeating-linear-gradient(135deg, #A8D5BA, #A8D5BA 7px, #93C7AB 7px, #93C7AB 14px); display: flex; align-items: center; justify-content: center; color: #2C4A5E; font-family: 'Newsreader', serif; font-size: ${Math.round(grootte * 0.28)}px; font-weight: 600;`,
      )}
    >
      {toonFoto ? (
        <img
          src={url}
          alt={alt}
          onError={() => setKapot(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span aria-hidden={alt ? 'false' : 'true'} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
          {initialen}
        </span>
      )}
    </div>
  );
}
