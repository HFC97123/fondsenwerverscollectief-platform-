// Ledenlijst op de Collectief-pagina: alleen voor ingelogde, goedgekeurde leden, en alleen leden die
// zelf "Zichtbaar in de ledenlijst" aanzetten. E-mailadres alleen als dat lid het zelf zichtbaar maakt.
// Data via de RPC ledenlijst() (data/services/ledenlijst.js).
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import ProfielAvatar from '../../shared/ui/ProfielAvatar.jsx';
import { SOORT_LID, haalLedenlijst, veiligeWebsite, websiteLabel } from '../../data/services/ledenlijst.js';

const sectie = css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 72px;');
const sectieKop = css("font-family: 'Newsreader', serif; font-size: clamp(23px, 3.2vw, 28px); font-weight: 600; color: #2C4A5E;");
const sectieSub = css('font-size: 15px; color: #4B5C58; margin-top: 6px;');
const link = css('color: #4E9A6C; font-weight: 700; font-size: 14px; overflow-wrap: anywhere;');

const initialenVan = (naam) =>
  String(naam || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

function LidKaart({ lid }) {
  const [open, setOpen] = useState(false);
  const bio = (lid.bio || '').trim();
  const lang = bio.length > 220;
  const site = veiligeWebsite(lid.website);
  const rol = lid.rol === 'admin' ? 'Eigenaar van het Collectief' : SOORT_LID[lid.member_type] || '';
  const werk = [lid.functie, lid.organisatie].filter(Boolean).join(' · ');

  return (
    <div data-testid="lid-kaart" style={css('background: #FFFFFF; border-radius: 18px; padding: 22px; display: flex; flex-direction: column; gap: 12px;')}>
      <div style={css('display: flex; gap: 14px; align-items: center;')}>
        <ProfielAvatar pad={lid.avatar_path} initialen={initialenVan(lid.naam)} grootte={58} alt={lid.naam} />
        <div style={css('min-width: 0;')}>
          <div style={css("font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; color: #2C4A5E; line-height: 1.25;")}>{lid.naam}</div>
          {werk && <div style={css('font-size: 14px; color: #4B5C58; margin-top: 2px;')}>{werk}</div>}
          {rol && <div style={css('font-size: 12.5px; color: #7B8985; margin-top: 2px;')}>{rol}</div>}
        </div>
      </div>

      {bio && (
        <div style={css('font-size: 14.5px; line-height: 1.6; color: #4B5C58; white-space: pre-line; overflow-wrap: anywhere;')}>
          {open || !lang ? bio : `${bio.slice(0, 220).trimEnd()}…`}
          {lang && (
            <span onClick={() => setOpen(!open)} style={css('cursor: pointer; color: #4E9A6C; font-weight: 700; margin-left: 6px;')}>
              {open ? 'Minder' : 'Lees meer'}
            </span>
          )}
        </div>
      )}

      {(site || lid.email) && (
        <div style={css('display: flex; flex-direction: column; gap: 4px; margin-top: auto; padding-top: 6px; border-top: 1px solid #EEF2EF;')}>
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" style={link}>
              {websiteLabel(site)}
            </a>
          )}
          {lid.email && (
            <a href={`mailto:${lid.email}`} style={link}>
              {lid.email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function LedenLijst({ profiel, vernieuwSleutel }) {
  const [leden, setLeden] = useState(null);
  const [fout, setFout] = useState('');

  useEffect(() => {
    let actief = true;

    haalLedenlijst().then((r) => {
      if (!actief) return;
      setLeden(r.leden);
      setFout(r.fout || '');
    });

    return () => {
      actief = false;
    };
  }, [vernieuwSleutel]);

  const zelfZichtbaar = Boolean(profiel && profiel.profiel_zichtbaar);

  return (
    <div style={sectie} data-testid="ledenlijst">
      <div style={css('margin-bottom: 28px;')}>
        <div style={sectieKop}>Leden</div>
        <div style={sectieSub}>
          Vakgenoten in het Collectief. Alleen leden die dat zelf kiezen, staan hier.
          {!zelfZichtbaar && ' Wilt u er zelf ook bij? Zet in uw profiel hierboven "Zichtbaar in de ledenlijst" aan.'}
        </div>
      </div>

      {leden === null && !fout && <div style={css('font-size: 14.5px; color: #7B8985;')}>Leden laden…</div>}
      {fout && <div style={css('font-size: 14.5px; color: #B3412F;')}>{fout}</div>}
      {leden && leden.length === 0 && !fout && (
        <div style={css('background: #FFFFFF; border-radius: 18px; padding: 22px; font-size: 14.5px; color: #7B8985;')}>
          Er staan nog geen leden in de lijst.
        </div>
      )}
      {leden && leden.length > 0 && (
        <div style={css('display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;')}>
          {leden.map((lid) => (
            <LidKaart key={lid.id} lid={lid} />
          ))}
        </div>
      )}
    </div>
  );
}
