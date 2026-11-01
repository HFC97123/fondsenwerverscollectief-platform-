// De eigenaar van het Collectief, breed en altijd zichtbaar op de Collectief-pagina: ook voor bezoekers zonder account.
// Data via de RPC collectief_eigenaar() (data/services/ledenlijst.js). Geen e-mailadres.
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import ProfielAvatar from '../../shared/ui/ProfielAvatar.jsx';
import { haalEigenaar, veiligeWebsite, websiteLabel } from '../../data/services/ledenlijst.js';

const KORT = 420;

const initialenVan = (naam) =>
  String(naam || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export default function EigenaarKaart({ vernieuwSleutel = '' }) {
  const [eigenaar, setEigenaar] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let actief = true;

    haalEigenaar().then((r) => {
      if (actief) setEigenaar(r.eigenaar);
    });

    return () => {
      actief = false;
    };
  }, [vernieuwSleutel]);

  if (!eigenaar) return null;

  const bio = (eigenaar.bio || '').trim();
  const lang = bio.length > KORT;
  const site = veiligeWebsite(eigenaar.website);
  const werk = [eigenaar.functie, eigenaar.organisatie].filter(Boolean).join(' · ');

  return (
    <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 48px;')} data-testid="eigenaar-kaart">
      <div
        style={css(
          'display: flex; flex-wrap: wrap; gap: clamp(22px, 4vw, 44px); align-items: center; padding: clamp(26px, 4vw, 44px); border-radius: 28px; background: linear-gradient(135deg, #EAF4EE 0%, #F7FAF8 60%, #FFFFFF 100%); border: 1px solid #DCEBE1;',
        )}
      >
        <div style={css('display: flex; flex-direction: column; align-items: center; gap: 14px; flex: 0 0 auto; margin: 0 auto;')}>
          <ProfielAvatar pad={eigenaar.avatar_path} initialen={initialenVan(eigenaar.naam)} grootte={168} alt={eigenaar.naam} />
          <span style={css('display: inline-block; padding: 6px 14px; border-radius: 999px; background: #FFFFFF; color: #2F6D47; font-size: 12.5px; font-weight: 800; letter-spacing: 0.03em; border: 1px solid #BFD4C6;')}>
            Eigenaar van het Collectief
          </span>
        </div>

        <div style={css('flex: 1 1 340px; min-width: 0;')}>
          <div style={css("font-family: 'Newsreader', serif; font-size: clamp(26px, 3.6vw, 34px); font-weight: 600; color: #2C4A5E; line-height: 1.2;")}>{eigenaar.naam}</div>
          {werk && <div style={css('font-size: 15.5px; color: #4B5C58; margin-top: 4px;')}>{werk}</div>}

          {bio && (
            <div style={css('font-size: 16px; line-height: 1.7; color: #3D4B48; margin-top: 16px; white-space: pre-line; overflow-wrap: anywhere;')}>
              {open || !lang ? bio : `${bio.slice(0, KORT).trimEnd()}…`}
              {lang && (
                <span
                  onClick={() => setOpen(!open)}
                  role="button"
                  data-testid="eigenaar-meer"
                  style={css('cursor: pointer; color: #4E9A6C; font-weight: 700; margin-left: 8px;')}
                >
                  {open ? 'Minder' : 'Lees meer'}
                </span>
              )}
            </div>
          )}

          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" style={css('display: inline-block; margin-top: 18px; color: #4E9A6C; font-weight: 700; font-size: 15px; overflow-wrap: anywhere;')}>
              {websiteLabel(site)}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
