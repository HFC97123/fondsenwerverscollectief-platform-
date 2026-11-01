// Het account van het ingelogde lid op de Collectief-pagina: ingeklapt een smalle balk (ingelogd als, foto, naam, soort en organisatie);
// uitgeklapt het hele profiel (foto wijzigen, over mij, gegevens, zichtbaarheid).
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import ProfielAvatar from '../../shared/ui/ProfielAvatar.jsx';
import { haalOnboarding } from '../../data/services/onboarding.js';
import { SOORT_LID } from '../../data/services/ledenlijst.js';
import { LedenGegevens, LedenProfielBio, LedenProfielFoto, ZichtbaarheidSchakelaar } from './LedenProfiel.jsx';

const knopKlein = css(
  "cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1.5px solid #E1EAE4; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-weight: 700; color: #4E9A6C; font-size: 13.5px;",
);

export default function AccountKaart({ profile, profileFullName, profileInitials, isApproved, vernieuwProfiel, logout }) {
  const [open, setOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const userId = profile && profile.id;
  const magBewerken = Boolean(isApproved && profile);

  // Opnieuw laden bij in- en uitklappen: een gewijzigde organisatie of functie staat dan ook in de balk.
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
  }, [userId, open]);

  const soort = profile && profile.role === 'admin' ? 'Eigenaar van het Collectief' : SOORT_LID[profile && profile.member_type] || 'Lid van het Collectief';
  const regel = [soort, onboarding && onboarding.functie, onboarding && onboarding.organisatie].filter(Boolean).join(' · ');

  return (
    <div data-testid="account-kaart" style={css('background: #FFFFFF; border-radius: 22px; padding: clamp(14px, 2.5vw, 22px) clamp(16px, 3vw, 28px);')}>
      <div style={css('display: flex; align-items: center; gap: 16px; flex-wrap: wrap;')}>
        <ProfielAvatar pad={profile && profile.avatar_path} initialen={profileInitials} grootte={56} alt={profileFullName} />
        <div style={css('flex: 1 1 220px; min-width: 0;')}>
          <div style={css('font-size: 12px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em;')}>Ingelogd als</div>
          <div style={css("font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #2C4A5E; line-height: 1.25;")}>{profileFullName}</div>
          <div style={css('font-size: 14px; color: #4B5C58; margin-top: 1px;')} data-testid="account-regel">{regel}</div>
        </div>
        <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
          <div role="button" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="account-uitklap" style={knopKlein}>
            {open ? 'Inklappen ▴' : 'Mijn profiel ▾'}
          </div>
          <div role="button" onClick={logout} data-testid="account-uitloggen" style={knopKlein}>
            Uitloggen
          </div>
        </div>
      </div>

      {open && (
        <div
          data-testid="account-uitgeklapt"
          style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 40px; align-items: start; margin-top: 26px; padding-top: 26px; border-top: 1px solid #EEF2EF;')}
        >
          <div style={css('text-align: center;')}>
            <LedenProfielFoto userId={profile && profile.id} fotoPad={profile && profile.avatar_path} initialen={profileInitials} naam={profileFullName} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />
            <div style={css('margin-top: 14px; display: flex; justify-content: center;')}>
              <ZichtbaarheidSchakelaar profile={profile} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />
            </div>
          </div>

          <div>
            <div style={css('font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;')}>Over mij</div>
            <LedenProfielBio bio={profile && profile.bio} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />
            <LedenGegevens profile={profile} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />

            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 20px;')}>
              <div style={css('background: #F7F9F8; border-radius: 16px; padding: 22px;')}>
                <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15px; margin-bottom: 14px;')}>Mijn opgeslagen artikelen</div>
                <div style={css('font-size: 14px; color: #7B8985; line-height: 1.5;')}>Er is momenteel nog geen content beschikbaar.</div>
              </div>
              <div style={css('background: #F7F9F8; border-radius: 16px; padding: 22px;')}>
                <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15px; margin-bottom: 14px;')}>Mijn activiteiten</div>
                <div style={css('font-size: 14px; color: #7B8985; line-height: 1.5;')}>Er is momenteel nog geen activiteit.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
