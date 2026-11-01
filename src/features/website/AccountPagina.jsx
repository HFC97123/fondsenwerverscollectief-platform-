// Account van het Collectief (/collectief/account): hier wijzigt een lid het eigen profiel: foto, over mij, gegevens en zichtbaarheid.
// Dit hoort bij het Collectief; Mijn Subsidie Kompas heeft zijn eigen Account-pagina in de Subsidie Kompas-omgeving.
import React, { useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';
import { LedenGegevens, LedenProfielBio, LedenProfielFoto, ZichtbaarheidSchakelaar } from './LedenProfiel.jsx';
import { naar } from '../../app/routes.js';
import { TIER_LABEL, openBeheerportaal } from '../../data/services/billing.js';
import { useAuthModal } from '../../app/providers/AuthModalProvider.jsx';

const knop = css(
  "cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border: 1.5px solid #E1EAE4; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-weight: 700; color: #4E9A6C; font-size: 14px;",
);

export default function AccountPagina() {
  const app = useApp();
  const authModal = useAuthModal();
  const [fout, setFout] = useState('');

  if (!app.isAccount) return null;

  const { isLoggedIn, profile, profileFullName, profileInitials, isApproved, vernieuwProfiel, logout } = app;
  const magBewerken = Boolean(isApproved && profile);
  const tier = app.subscriptionTier || 'free';
  const abonnementNaam = app.isAdmin ? 'Admin' : TIER_LABEL[tier] || 'Free';

  const beheerAbonnement = async () => {
    setFout('');
    const res = await openBeheerportaal();

    if (res && res.error) setFout(res.error);
  };

  return (
    <div data-testid="collectief-account" style={css('max-width: 1180px; margin: 0 auto; padding: clamp(28px, 5vw, 56px) clamp(16px, 4vw, 32px) 64px;')}>
      <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 26px;')}>
        <div>
          <div style={css('font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em;')}>Het Fondsenwervers Collectief</div>
          <h1 style={css("font-family: 'Newsreader', serif; font-size: clamp(28px, 4vw, 38px); font-weight: 600; color: #2C4A5E; margin: 4px 0 0;")}>Account</h1>
        </div>
        <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
          <div role="button" onClick={() => naar('/netwerk')} data-testid="account-terug" style={knop}>← Terug naar het Collectief</div>
          {isLoggedIn && <div role="button" onClick={logout} data-testid="account-uitloggen" style={knop}>Uitloggen</div>}
        </div>
      </div>

      {!isLoggedIn || !profile ? (
        <div data-testid="account-inloggen" style={css('background: #FFFFFF; border-radius: 22px; padding: 28px; font-size: 16px; color: #4B5C58; line-height: 1.6;')}>
          Log in om uw account van het Collectief te bekijken en te wijzigen.
          <div style={{ marginTop: 16 }}>
            <div role="button" onClick={() => authModal.openLogin()} style={knop}>Inloggen</div>
          </div>
        </div>
      ) : (
        <div style={css('background: #FFFFFF; border-radius: 22px; padding: clamp(20px, 3vw, 32px); display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 40px; align-items: start;')}>
          <div style={css('text-align: center;')}>
            <LedenProfielFoto userId={profile.id} fotoPad={profile.avatar_path} initialen={profileInitials} naam={profileFullName} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />
            <div style={css('margin-top: 14px; display: flex; justify-content: center;')}>
              <ZichtbaarheidSchakelaar profile={profile} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />
            </div>
          </div>
          <div>
            <div style={css('font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;')}>Over mij</div>
            <LedenProfielBio bio={profile.bio} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />
            <LedenGegevens profile={profile} magBewerken={magBewerken} onGewijzigd={vernieuwProfiel} />
          </div>
        </div>
      )}

      {isLoggedIn && profile && (
        <div data-testid="account-abonnement" style={css('margin-top: 20px; background: #FFFFFF; border-radius: 22px; padding: clamp(18px, 3vw, 28px); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;')}>
          <div>
            <div style={css('font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em;')}>Abonnement</div>
            <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-top: 2px;")}>{abonnementNaam}</div>
          </div>
          {!app.isAdmin && (
            tier === 'free' ? (
              <div role="button" onClick={() => naar('/hoe-het-werkt')} data-testid="account-abonnement-bekijken" style={knop}>Bekijk de abonnementen</div>
            ) : (
              <div role="button" onClick={beheerAbonnement} data-testid="account-abonnement-beheren" style={knop}>Abonnement beheren</div>
            )
          )}
          {fout && <div role="alert" style={css('flex-basis: 100%; font-size: 13.5px; color: #B3412F;')}>{fout}</div>}
        </div>
      )}
    </div>
  );
}
