import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function Register() {
  const {
    isAuthRegister,
    showLogin,
    regForm,
    onRegFirstName,
    onRegLastName,
    onRegEmail,
    onRegPassword,
    onRegType,
    onRegMotivation,
    typeZzp,
    typeOrg,
    typeOrient,
    applicationSent,
    applicationOpen,
    applicationLoading,
    applicationError,
    submitApplication,
  } = useApp();

  if (!isAuthRegister) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitApplication();
  };

  const inputStyle = css(`
    padding: 12px 16px;
    border-radius: 12px;
    border: 1.5px solid #E1EAE4;
    font-size: 14.5px;
    font-family: 'Mulish', sans-serif;
    outline: none;
  `);

  return (
    <div
      style={css(`
        background: #FFFFFF;
        border-radius: 24px;
        padding: 40px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 40px;
        align-items: start;
      `)}
    >
      <div>
        <div
          style={css(`
            font-family: 'Newsreader', serif;
            font-size: 24px;
            font-weight: 600;
            color: #2C4A5E;
            margin-bottom: 12px;
          `)}
        >
          Lidmaatschap aanvragen
        </div>

        <div
          style={css(`
            font-size: 15px;
            line-height: 1.6;
            color: #4B5C58;
            margin-bottom: 18px;
          `)}
        >
          Het Collectief is een besloten omgeving voor en door fondsenwervers.
          Bij elke aanmelding kijken we of er een goede match is. Na uw
          aanvraag hoort u binnen vijf werkdagen of we samen verder gaan.
        </div>

        <div style={css(`display: flex; flex-direction: column; gap: 10px;`)}>
          {[
            'Subsidie Kompas premium als vaste hulp bij elke aanvraag',
            'Exclusieve artikelen en verdieping uit het vak',
            'Een eigen profiel binnen het collectief',
          ].map((benefit) => (
            <div
              key={benefit}
              style={css(`display: flex; gap: 11px; align-items: flex-start;`)}
            >
              <div
                style={css(`
                  width: 7px;
                  height: 7px;
                  border-radius: 50%;
                  background: #4E9A6C;
                  margin-top: 7px;
                  flex-shrink: 0;
                `)}
              />
              <div style={css(`font-size: 14.5px; color: #2C4A5E;`)}>
                {benefit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {applicationOpen ? (
        <form
          onSubmit={handleSubmit}
          style={css(`display: flex; flex-direction: column; gap: 14px;`)}
        >
          <div
            style={css(`
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 12px;
            `)}
          >
            <input
              type="text"
              autoComplete="given-name"
              placeholder="Voornaam"
              value={regForm.firstName}
              onChange={onRegFirstName}
              disabled={applicationLoading}
              style={inputStyle}
            />
            <input
              type="text"
              autoComplete="family-name"
              placeholder="Achternaam"
              value={regForm.lastName}
              onChange={onRegLastName}
              disabled={applicationLoading}
              style={inputStyle}
            />
          </div>

          <input
            type="email"
            autoComplete="email"
            placeholder="E-mailadres"
            value={regForm.email}
            onChange={onRegEmail}
            disabled={applicationLoading}
            style={inputStyle}
          />

          <input
            type="password"
            autoComplete="new-password"
            placeholder="Kies een wachtwoord (minimaal 8 tekens)"
            value={regForm.password}
            onChange={onRegPassword}
            disabled={applicationLoading}
            style={inputStyle}
          />

          <div>
            <div
              style={css(`
                font-size: 13.5px;
                font-weight: 700;
                color: #2C4A5E;
                margin-bottom: 9px;
              `)}
            >
              Wat omschrijft u het best?
            </div>

            <div style={css(`display: flex; flex-direction: column; gap: 9px;`)}>
              <label style={css(`display: flex; gap: 10px; align-items: center; font-size: 14.5px; color: #2C4A5E; cursor: pointer;`)}>
                <input type="radio" name="lidtype" value="zzp" checked={typeZzp} onChange={onRegType} disabled={applicationLoading} style={css(`accent-color: #4E9A6C; width: 16px; height: 16px;`)} />
                Zelfstandig fondsenwerver (zzp)
              </label>
              <label style={css(`display: flex; gap: 10px; align-items: center; font-size: 14.5px; color: #2C4A5E; cursor: pointer;`)}>
                <input type="radio" name="lidtype" value="org" checked={typeOrg} onChange={onRegType} disabled={applicationLoading} style={css(`accent-color: #4E9A6C; width: 16px; height: 16px;`)} />
                Fondsenwerver binnen een organisatie
              </label>
              <label style={css(`display: flex; gap: 10px; align-items: center; font-size: 14.5px; color: #2C4A5E; cursor: pointer;`)}>
                <input type="radio" name="lidtype" value="orient" checked={typeOrient} onChange={onRegType} disabled={applicationLoading} style={css(`accent-color: #4E9A6C; width: 16px; height: 16px;`)} />
                Oriënterend, ik wil fondsenwerver worden
              </label>
            </div>
          </div>

          <div>
            <div
              style={css(`
                font-size: 13.5px;
                font-weight: 700;
                color: #2C4A5E;
                margin-bottom: 9px;
              `)}
            >
              Uw motivatie
            </div>
            <textarea
              value={regForm.motivation}
              onChange={onRegMotivation}
              disabled={applicationLoading}
              rows="4"
              placeholder="Vertel iets over uzelf en waarom u lid wilt worden."
              style={css(`
                width: 100%;
                box-sizing: border-box;
                resize: vertical;
                padding: 12px 16px;
                border-radius: 12px;
                border: 1.5px solid #E1EAE4;
                font-size: 14.5px;
                line-height: 1.5;
                font-family: 'Mulish', sans-serif;
                outline: none;
              `)}
            />
          </div>

          {applicationError ? (
            <div
              role="alert"
              style={css(`
                padding: 11px 14px;
                border-radius: 12px;
                background: #FFF2F0;
                color: #9B3A32;
                font-size: 13.5px;
                line-height: 1.5;
              `)}
            >
              {applicationError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={applicationLoading}
            style={css(`
              cursor: ${applicationLoading ? 'default' : 'pointer'};
              width: 100%;
              border: 0;
              text-align: center;
              padding: 13px;
              background: #4E9A6C;
              color: #FFFFFF;
              border-radius: 999px;
              font-family: 'Mulish', sans-serif;
              font-weight: 700;
              font-size: 15px;
              opacity: ${applicationLoading ? '0.7' : '1'};
            `)}
          >
            {applicationLoading ? 'Aanvraag versturen…' : 'Aanvraag versturen'}
          </button>

          <div style={css(`text-align: center; font-size: 13.5px; color: #4B5C58;`)}>
            Al lid?{' '}
            <span
              onClick={applicationLoading ? undefined : showLogin}
              style={css(`cursor: ${applicationLoading ? 'default' : 'pointer'}; font-weight: 700; color: #2C4A5E;`)}
            >
              Inloggen
            </span>
          </div>
        </form>
      ) : null}

      {applicationSent ? (
        <div
          style={css(`
            background: #EAF4EE;
            border-radius: 18px;
            padding: 32px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          `)}
        >
          <div
            style={css(`
              width: 52px;
              height: 52px;
              border-radius: 50%;
              background: #FFFFFF;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              color: #4E9A6C;
            `)}
          >
            ✓
          </div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;`)}>
            Aanvraag ontvangen
          </div>
          <div style={css(`font-size: 15px; line-height: 1.6; color: #4B5C58;`)}>
            Dank voor uw aanmelding. Controleer ook uw inbox voor de
            bevestigingsmail van Supabase. Na bevestiging beoordelen we uw
            aanvraag en ontvangt u binnen vijf werkdagen bericht.
          </div>
          <div onClick={showLogin} style={css(`cursor: pointer; margin-top: 6px; font-weight: 700; color: #2C4A5E; font-size: 14.5px;`)}>
            Al lid? Inloggen →
          </div>
        </div>
      ) : null}
    </div>
  );
}
