// Het account van het ingelogde lid op de Collectief-pagina: een smalle kaart (ingelogd als, foto, naam, soort en organisatie).
// Wijzigen gaat via de Bewerken-knop (bij de muis erover) naar de Account-pagina van het Collectief.
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import ProfielAvatar from '../../shared/ui/ProfielAvatar.jsx';
import { haalOnboarding } from '../../data/services/onboarding.js';
import { SOORT_LID } from '../../data/services/ledenlijst.js';
import BewerkKnop from './BewerkKnop.jsx';

const knopKlein = css(
  "cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1.5px solid #E1EAE4; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-weight: 700; color: #4E9A6C; font-size: 13.5px;",
);

export default function AccountKaart({ profile, profileFullName, profileInitials, logout }) {
  const [onboarding, setOnboarding] = useState(null);
  const userId = profile && profile.id;

  useEffect(() => {
    let actief = true;

    if (userId) {
      haalOnboarding(userId).then((data) => {
        if (actief) setOnboarding(data || {});
      });
    }

    return () => {
      actief = false;
    };
  }, [userId]);

  const soort = profile && profile.role === 'admin' ? 'Eigenaar van het Collectief' : SOORT_LID[profile && profile.member_type] || 'Lid van het Collectief';
  const regel = [soort, onboarding && onboarding.functie, onboarding && onboarding.organisatie].filter(Boolean).join(' · ');

  return (
    <div className="fwk-bewerk-kaart" data-testid="account-kaart" style={css('background: #FFFFFF; border-radius: 22px; padding: clamp(14px, 2.5vw, 22px) clamp(16px, 3vw, 28px);')}>
      <BewerkKnop />
      <div style={css('display: flex; align-items: center; gap: 16px; flex-wrap: wrap;')}>
        <ProfielAvatar pad={profile && profile.avatar_path} initialen={profileInitials} grootte={56} alt={profileFullName} />
        <div style={css('flex: 1 1 220px; min-width: 0; padding-right: 100px;')}>
          <div style={css('font-size: 12px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em;')}>Ingelogd als</div>
          <div style={css("font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #2C4A5E; line-height: 1.25;")}>{profileFullName}</div>
          <div style={css('font-size: 14px; color: #4B5C58; margin-top: 1px;')} data-testid="account-regel">{regel}</div>
        </div>
        <div role="button" onClick={logout} data-testid="account-uitloggen" style={knopKlein}>
          Uitloggen
        </div>
      </div>
    </div>
  );
}
