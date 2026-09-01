// Collectief. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Collectief"). Bevat hero, account/login/registratie,
// ledenlijst, praktijkgidsen, intervisie, blog, ervaringen, vraag & antwoord,
// leden & contact, vacatures en de Kompas-verwijzing.
//
// Alle bestaande functionaliteit uit WebsiteProvider blijft in gebruik:
// Supabase-auth, aanmeldingen, gepubliceerde inhoud, vragen en antwoorden.
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const sectie = css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 72px;');
const sectieKop = css("font-family: 'Newsreader', serif; font-size: clamp(23px, 3.2vw, 28px); font-weight: 600; color: #2C4A5E;");
const sectieSub = css('font-size: 15px; color: #4B5C58; margin-top: 6px;');
const invoer = css(
  "padding: 12px 16px; border-radius: 12px; border: 1.5px solid #E1EAE4; font-size: 14.5px; font-family: 'Mulish', sans-serif; outline: none;",
);
const veldGroot = css(
  "width: 100%; box-sizing: border-box; min-height: 46px; padding: 13px 15px; border: 1px solid #D5E0D9; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 15px; color: #2E3A38; outline: none;",
);
const tekstGroot = css(
  "width: 100%; box-sizing: border-box; padding: 13px 15px; border: 1px solid #D5E0D9; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 15px; line-height: 1.6; color: #2E3A38; resize: vertical; outline: none;",
);
const knopGroen = css(
  'cursor: pointer; box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 22px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-size: 14.5px; font-weight: 800;',
);
const knopBlauw = css(
  'cursor: pointer; box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 22px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 14.5px; font-weight: 800;',
);
const radioLabel = css('display: flex; gap: 10px; align-items: center; font-size: 14.5px; color: #2C4A5E; cursor: pointer;');
const radio = css('accent-color: #4E9A6C; width: 16px; height: 16px;');

const HERO_PUNTEN = [
  'Vakkennis en verdieping voor en door fondsenwervers',
  'Netwerk & intervisie: deel kennis en ervaring, leer van elkaars aanvragen, afwijzingen en toekenningen',
  'Praktijkgidsen en kant-en-klare templates om te downloaden',
  'Slimme tools, met Subsidie Kompas als vaste hulp in uw dagelijkse praktijk',
  'Relevante vacatures uit de sector',
];

function HeroVormen() {
  return (
    <div style={css('position: absolute; inset: 0; pointer-events: none; z-index: 0;')} aria-hidden="true">
      <svg
        style={css('position: absolute; top: 14%; left: 3%; width: 92px; height: 92px; opacity: 0.4; animation: fw-float-a 11s ease-in-out infinite;')}
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="32" cy="32" r="22" stroke="#9FB8C4" strokeWidth="1.6" />
        <path d="M32 15c1 4-1 8-1 12M32 49c1-4-1-8-1-12" stroke="#9FB8C4" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M32 20 L38 32 L32 44 L26 32 Z" stroke="#A8D5BA" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <circle cx="32" cy="32" r="2" fill="#A8D5BA" />
        <path d="M14 44c-3 3-3 6-1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>

      <svg
        style={css('position: absolute; top: 4%; right: 5%; width: 80px; height: 80px; opacity: 0.35; animation: fw-float-b 12.5s ease-in-out infinite;')}
        viewBox="0 0 64 64"
        fill="none"
      >
        <path d="M16 12h26l8 8v32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <path d="M42 12v8h8" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <path d="M18 28h13M18 34h20M18 40h20" stroke="#C3D9E6" strokeWidth="1" strokeLinecap="round" />
        <path
          d="M30 26c4-5 12-9 17-6 1.6 1 1.3 3-.4 4.4-6 5-13 9-19 11.6-1.4.6-2.4-.5-1.8-1.8 1.8-4 3-6.4 4.2-8.2Z"
          stroke="#A8D5BA"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M26 44l2-6" stroke="#A8D5BA" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <svg
        style={css('position: absolute; bottom: 8%; left: 2%; width: 72px; height: 72px; opacity: 0.32; animation: fw-float-c 10s ease-in-out infinite;')}
        viewBox="0 0 64 64"
        fill="none"
      >
        <path d="M32 4v5M20 8l2.5 4.3M44 8l-2.5 4.3M12 18l4.3 2.5M52 18l-4.3 2.5" stroke="#F2E1A8" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M32 12c-9 1-15 8-13 16 1.3 5.2 6 7 8 11 1 2 1 4 1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M32 12c9 1 15 8 13 16-1.3 5.2-6 7-8 11-1 2-1 4-1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M27 50c3 2 7 2 10 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M28 55c2.4 1.3 5.6 1.3 8 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>

      <svg
        style={css('position: absolute; bottom: 10%; right: 7%; width: 88px; height: 88px; opacity: 0.36; animation: fw-float-d 12s ease-in-out infinite;')}
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="32" cy="32" r="31" stroke="#B9D6C9" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="27" stroke="#B9D6C9" strokeWidth="1" />
        <path
          d="M38 16c-5-1-10 1-12 5 -1 2-2 5-6 7 l7 3 c-2 2-2 4 1 5 c-2 2-1 4 2 5 c-2 2-1 4 3 6 l0 4 c0 2 3 3 6 3 l9 0 c0-4-2-7-2-10 c5-2 8-8 8-14 c0-9-5-15-16-15Z"
          stroke="#9FB8C4"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="31" cy="25" r="1.2" fill="#9FB8C4" />
        <path d="M18 22c3-3 7-4 10-3" stroke="#A8D5BA" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <text x="45" y="46" fontFamily="'Newsreader', serif" fontSize="13" fill="#9FB8C4" textAnchor="middle">
          €
        </text>
        <path d="M53 49c3 3 3 6 1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

export default function NetwerkPage() {
  const app = useApp();

  if (!app.isNetwerk) return null;

  const {
    heroAnimationOn,
    showAuthCta,
    showLogin,
    showRegister,
    isLoggedIn,
    hideContact,
    profileInitials,
    profileFullName,
    logout,
    visHint,
    visChecked,
    visKey,
    visTrackBg,
    visKnobLeft,
    visLabel,
    visLabelColor,
    toggleMemberVisible,
    isAuthLogin,
    emailDraft,
    onEmailChange,
    login,
    forgotPassword,
    resetSent,
    isAuthRegister,
    applicationOpen,
    applicationSent,
    regForm,
    onRegFirstName,
    onRegLastName,
    onRegEmail,
    onRegPassword,
    typeZzp,
    typeOrg,
    typeOrient,
    onRegType,
    onRegMotivation,
    submitApplication,
    ledenlijst,
    ledenlijstCount,
    ledenlijstEmpty,
    ledenHidden,
    ledenQuery,
    onLedenQuery,
    resources,
    sessions,
    hasSessions,
    sessionDraftOpen,
    openSessionDraft,
    sessionFields,
    sessionNote,
    setSessionNote,
    proposeSession,
    sessionProposed,
    blogPosts,
    hasBlogPosts,
    noBlogPosts,
    requireLogin,
    experiences,
    hasExperiences,
    questions,
    hasQuestions,
    qDraftOpen,
    openQDraft,
    qDraftTitle,
    setQDraftTitle,
    qDraftBody,
    setQDraftBody,
    submitQuestion,
    members,
    vacancies,
    goVacatures,
    goKompas,
  } = app;

  const reg = regForm || {};

  return (
    <div data-screen-label="Collectief">
      {/* HERO */}
      <div
        style={css(
          'max-width: 980px; margin: 0 auto; padding: clamp(36px, 6vw, 60px) clamp(16px, 4vw, 32px) clamp(30px, 5vw, 48px); text-align: center; position: relative; overflow: hidden;',
        )}
      >
        {heroAnimationOn && <HeroVormen />}

        <div style={css('position: relative; z-index: 1;')}>
          <div
            style={css(
              'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;',
            )}
          >
            Het platform voor fondsenwervers
          </div>
          <div
            style={css(
              "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;",
            )}
          >
            Het Fondsenwervers Collectief
          </div>

          <div style={css('display: inline-flex; flex-direction: column; gap: 11px; text-align: left; margin: 4px auto 0;')}>
            {HERO_PUNTEN.map((punt) => (
              <div key={punt} style={css('display: flex; gap: 10px; align-items: flex-start;')}>
                <div style={css('width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;')} />
                <div style={css('font-size: 15.5px; line-height: 1.5; color: #4E9A6C; font-weight: 700;')}>{punt}</div>
              </div>
            ))}
          </div>

          <div style={css('font-size: 17px; line-height: 1.6; color: #2C4A5E; font-weight: 700; max-width: 640px; margin: 24px auto 0;')}>
            Alles op één plek in een besloten omgeving
          </div>

          {showAuthCta && (
            <div style={css('display: flex; gap: 14px; justify-content: center; margin-top: 30px;')}>
              <div
                onClick={showLogin}
                style={css(
                  'cursor: pointer; padding: 13px 30px; background: #FFFFFF; border: 1.5px solid #A8D5BA; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 15.5px;',
                )}
              >
                Inloggen
              </div>
              <div
                onClick={showRegister}
                style={css(
                  'cursor: pointer; padding: 13px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15.5px;',
                )}
              >
                Word lid
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LOGIN / ACCOUNT / PROFIEL */}
      <div id="account" style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 56px;')}>
        {isLoggedIn && (
          <div
            style={css(
              'background: #FFFFFF; border-radius: 24px; padding: clamp(22px, 3.5vw, 40px); display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 40px; align-items: start;',
            )}
          >
            <div style={css('text-align: center;')}>
              <div
                style={css(
                  "width: 120px; height: 120px; border-radius: 50%; background: repeating-linear-gradient(135deg, #A8D5BA, #A8D5BA 7px, #93C7AB 7px, #93C7AB 14px); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; color: #2C4A5E; font-family: 'Newsreader', serif; font-size: clamp(25px, 3.8vw, 34px); font-weight: 600;",
                )}
              >
                {profileInitials}
              </div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>{profileFullName}</div>
              <div style={css('font-size: 14px; color: #4B5C58; margin-top: 4px;')}>Lid van het Collectief</div>
              <div
                onClick={logout}
                style={css(
                  'cursor: pointer; margin-top: 18px; display: inline-block; padding: 9px 22px; border: 1.5px solid #E1EAE4; border-radius: 999px; font-weight: 700; color: #4E9A6C; font-size: 13.5px;',
                )}
              >
                Uitloggen
              </div>
            </div>

            <div>
              <div
                style={css(
                  'font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;',
                )}
              >
                Over mij
              </div>
              <div style={css('font-size: 15px; line-height: 1.65; color: #4B5C58; margin-bottom: 28px; max-width: 560px;')}>
                Fondsenwerver met hart voor maatschappelijke projecten. Vul hier een korte bio in zodat vakgenoten weten
                waar u aan werkt en waarover u graag kennis uitwisselt.
              </div>

              <div
                style={css(
                  'margin-bottom: 22px; padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;',
                )}
              >
                <div style={css('flex: 1 1 280px; min-width: 0;')}>
                  <div style={css('margin-bottom: 5px; font-weight: 700; color: #2C4A5E; font-size: 15px;')}>
                    Wilt u zichtbaar zijn voor andere leden?
                  </div>
                  <div style={css('font-size: 14px; line-height: 1.6; color: #4B5C58; text-wrap: pretty;')}>{visHint}</div>
                </div>

                <div
                  onClick={toggleMemberVisible}
                  onKeyDown={visKey}
                  role="switch"
                  tabIndex={0}
                  aria-checked={visChecked}
                  aria-label="Zichtbaar voor andere leden"
                  style={css('cursor: pointer; display: flex; align-items: center; gap: 12px; flex-shrink: 0; min-height: 44px;')}
                >
                  <span
                    style={css(
                      `position: relative; width: 52px; height: 30px; flex-shrink: 0; border-radius: 999px; background: ${visTrackBg}; transition: background 0.2s ease;`,
                    )}
                  >
                    <span
                      style={css(
                        `position: absolute; top: 3px; left: ${visKnobLeft}; width: 24px; height: 24px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 3px rgba(44,74,94,0.25); transition: left 0.2s ease;`,
                      )}
                    />
                  </span>
                  <span style={css(`font-size: 14px; font-weight: 800; color: ${visLabelColor}; white-space: nowrap;`)}>{visLabel}</span>
                </div>
              </div>

              <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 20px;')}>
                <div style={css('background: #F7F9F8; border-radius: 16px; padding: 22px;')}>
                  <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15px; margin-bottom: 14px;')}>Mijn opgeslagen artikelen</div>
                  <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                    <div style={css('font-size: 14px; color: #4B5C58; line-height: 1.4; padding-bottom: 10px; border-bottom: 1px solid #E8EEEB;')}>
                      Wat we leerden van vijf afgewezen aanvragen
                    </div>
                    <div style={css('font-size: 14px; color: #4B5C58; line-height: 1.4;')}>Major donors werven zonder groot netwerk</div>
                  </div>
                </div>
                <div style={css('background: #F7F9F8; border-radius: 16px; padding: 22px;')}>
                  <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15px; margin-bottom: 14px;')}>Mijn activiteiten</div>
                  <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                    <div style={css('font-size: 14px; color: #4B5C58; line-height: 1.4; padding-bottom: 10px; border-bottom: 1px solid #E8EEEB;')}>
                      Aangemeld voor intervisie op 18 jul
                    </div>
                    <div style={css('font-size: 14px; color: #4B5C58; line-height: 1.4;')}>1 vraag gesteld in Vraag &amp; antwoord</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAuthLogin && (
          <div
            style={css(
              'background: #FFFFFF; border-radius: 24px; padding: clamp(22px, 3.5vw, 40px); display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 40px; align-items: center;',
            )}
          >
            <div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;")}>
                Inloggen
              </div>
              <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58;')}>
                Log in om vragen te stellen, kennis te delen, uw profiel te beheren en toegang te krijgen tot alle
                ledencontent. Zonder account kunt u meelezen.
              </div>
            </div>

            <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
              <input type="email" placeholder="E-mailadres" value={emailDraft || ''} onChange={onEmailChange} style={invoer} />
              <input type="password" placeholder="Wachtwoord" style={invoer} />
              <div
                onClick={login}
                style={css(
                  'cursor: pointer; text-align: center; padding: 13px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15px;',
                )}
              >
                Inloggen
              </div>
              <div style={css('display: flex; justify-content: center;')}>
                <div
                  onClick={forgotPassword}
                  role="button"
                  style={css('cursor: pointer; padding: 2px 4px; color: #6B7B77; font-weight: 700; font-size: 12.5px;')}
                >
                  Wachtwoord vergeten?
                </div>
              </div>
              {resetSent && (
                <div
                  style={css(
                    'padding: 11px 14px; border-radius: 12px; background: #EAF4EE; color: #2F6D47; font-size: 13.5px; line-height: 1.5; text-align: center;',
                  )}
                >
                  We sturen u een e-mail met een link om een nieuw wachtwoord in te stellen.
                </div>
              )}
              <div style={css('text-align: center; font-size: 13.5px; color: #4B5C58;')}>
                Nog geen lid?{' '}
                <span onClick={showRegister} style={css('cursor: pointer; font-weight: 700; color: #2C4A5E;')}>
                  Word lid
                </span>
              </div>
            </div>
          </div>
        )}

        {isAuthRegister && (
          <div
            style={css(
              'background: #FFFFFF; border-radius: 24px; padding: clamp(22px, 3.5vw, 40px); display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 40px; align-items: start;',
            )}
          >
            <div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 12px;")}>
                Lidmaatschap aanvragen
              </div>
              <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 18px;')}>
                Het Collectief is een besloten omgeving voor en door fondsenwervers. Maak een account aan en u heeft
                direct toegang — geen wachttijd of aparte beoordeling.
              </div>
            </div>

            {applicationOpen && (
              <div style={css('display: flex; flex-direction: column; gap: 14px;')}>
                <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 12px;')}>
                  <input type="text" placeholder="Voornaam" value={reg.firstName || ''} onChange={onRegFirstName} style={invoer} />
                  <input type="text" placeholder="Achternaam" value={reg.lastName || ''} onChange={onRegLastName} style={invoer} />
                </div>
                <input type="email" placeholder="E-mailadres" value={reg.email || ''} onChange={onRegEmail} style={invoer} />
                <input
                  type="password"
                  placeholder="Kies een wachtwoord (minimaal 8 tekens)"
                  value={reg.password || ''}
                  onChange={onRegPassword}
                  style={invoer}
                />

                <div>
                  <div style={css('font-size: 13.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 9px;')}>
                    Wat omschrijft u het best?
                  </div>
                  <div style={css('display: flex; flex-direction: column; gap: 9px;')}>
                    <label style={radioLabel}>
                      <input type="radio" name="lidtype" value="zzp" checked={Boolean(typeZzp)} onChange={onRegType} style={radio} />{' '}
                      Zelfstandig fondsenwerver (zzp)
                    </label>
                    <label style={radioLabel}>
                      <input type="radio" name="lidtype" value="org" checked={Boolean(typeOrg)} onChange={onRegType} style={radio} />{' '}
                      Fondsenwerver binnen een organisatie
                    </label>
                    <label style={radioLabel}>
                      <input type="radio" name="lidtype" value="orient" checked={Boolean(typeOrient)} onChange={onRegType} style={radio} />{' '}
                      Oriënterend, ik wil fondsenwerver worden
                    </label>
                  </div>
                </div>

                <div>
                  <div style={css('font-size: 13.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 9px;')}>Uw motivatie</div>
                  <textarea
                    value={reg.motivation || ''}
                    onChange={onRegMotivation}
                    rows="4"
                    placeholder="Vertel iets over uzelf en waarom u lid wilt worden."
                    style={css(
                      "width: 100%; box-sizing: border-box; resize: vertical; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #E1EAE4; font-size: 14.5px; line-height: 1.5; font-family: 'Mulish', sans-serif; outline: none;",
                    )}
                  />
                </div>

                <div
                  onClick={submitApplication}
                  style={css(
                    'cursor: pointer; text-align: center; padding: 13px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15px;',
                  )}
                >
                  Aanvraag versturen
                </div>
                <div style={css('text-align: center; font-size: 13.5px; color: #4B5C58;')}>
                  Al lid?{' '}
                  <span onClick={showLogin} style={css('cursor: pointer; font-weight: 700; color: #2C4A5E;')}>
                    Inloggen
                  </span>
                </div>
              </div>
            )}

            {applicationSent && (
              <div style={css('background: #EAF4EE; border-radius: 18px; padding: 32px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px;')}>
                <div
                  style={css(
                    'width: 52px; height: 52px; border-radius: 50%; background: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #4E9A6C;',
                  )}
                >
                  ✓
                </div>
                <div style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>Welkom bij Het Fondsenwervers Collectief</div>
                <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58;')}>
                  Uw account is aangemaakt en direct actief. Controleer ook uw inbox voor de bevestigingsmail — en
                  voor een persoonlijk welkomstbericht met meer uitleg over het Collectief en Subsidie Kompas.
                </div>
                <div onClick={showLogin} style={css('cursor: pointer; margin-top: 6px; font-weight: 700; color: #2C4A5E; font-size: 14.5px;')}>
                  Al lid? Inloggen →
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LEDENLIJST */}
      {isLoggedIn && (
        <div style={sectie}>
          <div style={css('display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-bottom: 24px;')}>
            <div>
              <div style={sectieKop}>Leden van het Collectief</div>
              <div style={sectieSub}>{ledenlijstCount}</div>
            </div>
            <input
              value={ledenQuery || ''}
              onChange={onLedenQuery}
              placeholder="Zoek op naam, expertise of regio…"
              style={css(
                "flex: 1 1 260px; max-width: 360px; box-sizing: border-box; min-height: 46px; padding: 13px 16px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 15px; color: #2E3A38; outline: none;",
              )}
            />
          </div>

          {ledenHidden && (
            <div
              style={css(
                'margin-bottom: 18px; padding: 14px 18px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; font-size: 14.5px; line-height: 1.6; color: #4B5C58;',
              )}
            >
              U staat zelf niet in deze lijst. Zet de schuifknop in uw profiel op zichtbaar als u wilt dat vakgenoten u
              kunnen vinden.
            </div>
          )}

          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 18px;')}>
            {(ledenlijst || []).map((l, i) => (
              <div key={l.id || i} style={css('background: #FFFFFF; border-radius: 18px; padding: clamp(20px, 3vw, 24px); display: flex; flex-direction: column; gap: 12px;')}>
                <div style={css('display: flex; align-items: center; gap: 13px;')}>
                  <span
                    style={css(
                      `width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; background: ${l.avatarBg}; display: flex; align-items: center; justify-content: center; font-family: 'Newsreader', serif; font-size: 17px; font-weight: 600; color: #2C4A5E;`,
                    )}
                  >
                    {l.initials}
                  </span>
                  <span style={css('min-width: 0;')}>
                    <span style={css('display: block; font-size: 15px; font-weight: 800; color: #2C4A5E;')}>{l.naam}</span>
                    <span style={css('display: block; margin-top: 2px; font-size: 13px; color: #687974;')}>{l.rol}</span>
                  </span>
                </div>
                <div style={css('font-size: 14px; line-height: 1.6; color: #4B5C58; text-wrap: pretty;')}>{l.bio}</div>
                <div style={css('display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto;')}>
                  {(l.tags || []).map((t, j) => (
                    <span
                      key={j}
                      style={css('padding: 4px 11px; border-radius: 999px; background: #F2F6F4; color: #4B5C58; font-size: 11.5px; font-weight: 700;')}
                    >
                      {t.label || t}
                    </span>
                  ))}
                </div>
                {l.isSelf && <span style={css('font-size: 12.5px; font-weight: 800; color: #4E9A6C;')}>Dit bent u</span>}
              </div>
            ))}
          </div>

          {ledenlijstEmpty && (
            <div style={css('padding: 26px 22px; border: 1px dashed #D5E0D9; border-radius: 18px; font-size: 15px; line-height: 1.65; color: #7B8985;')}>
              Geen leden gevonden. Pas uw zoekopdracht aan.
            </div>
          )}
        </div>
      )}

      {/* PRAKTIJKGIDSEN & TEMPLATES */}
      {isLoggedIn && (
        <div style={sectie}>
          <div style={css('margin-bottom: 28px;')}>
            <div style={sectieKop}>Praktijkgidsen &amp; templates</div>
            <div style={sectieSub}>Kant-en-klare documenten om direct in uw aanvraag te gebruiken.</div>
          </div>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 24px;')}>
            {(resources || []).map((r, i) => (
              <div key={i} style={css('background: #FFFFFF; border-radius: 18px; padding: clamp(20px, 3vw, 26px); display: flex; flex-direction: column; gap: 12px;')}>
                <div style={css('display: flex; align-items: center; justify-content: space-between;')}>
                  <div style={css('font-size: 13px; font-weight: 700; color: #4E9A6C;')}>{r.type}</div>
                  <div style={css('font-size: 11.5px; font-weight: 700; color: #2C4A5E; background: #EAF1F6; padding: 3px 9px; border-radius: 6px;')}>
                    {r.format}
                  </div>
                </div>
                <div style={css("font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E; line-height: 1.35; flex-grow: 1;")}>
                  {r.title}
                </div>
                <div style={css('font-weight: 700; color: #2C4A5E; font-size: 14px;')}>Downloaden ↓</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INTERVISIE & BIJEENKOMSTEN */}
      {isLoggedIn && (
        <div style={sectie}>
          <div style={css('margin-bottom: 24px;')}>
            <div style={sectieKop}>Intervisie &amp; bijeenkomsten</div>
            <div style={sectieSub}>Leden stellen sessies voor; na goedkeuring komen ze op de agenda.</div>
          </div>

          {hasSessions && (
            <div style={css('display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;')}>
              {(sessions || []).map((s, i) => (
                <div key={i} style={css('background: #FFFFFF; border-radius: 16px; padding: 20px 26px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap;')}>
                  <div style={css('text-align: center; flex-shrink: 0; min-width: 56px;')}>
                    <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 700; color: #4E9A6C; line-height: 1;")}>{s.day}</div>
                    <div style={css('font-size: 12.5px; color: #4B5C58; text-transform: uppercase; letter-spacing: 0.04em;')}>{s.month}</div>
                  </div>
                  <div style={css('flex-grow: 1; min-width: 200px;')}>
                    <div style={css('font-weight: 700; font-size: 16px; color: #2C4A5E; margin-bottom: 4px;')}>{s.title}</div>
                    <div style={css('font-size: 13.5px; color: #4B5C58;')}>
                      {s.time} · {s.host}
                    </div>
                  </div>
                  <div style={css('display: flex; align-items: center; gap: 14px;')}>
                    <div style={css('font-size: 12px; font-weight: 700; color: #2C4A5E; background: #EAF4EE; padding: 5px 12px; border-radius: 999px; white-space: nowrap;')}>
                      {s.mode}
                    </div>
                    <div style={css('padding: 9px 18px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 13.5px; white-space: nowrap;')}>
                      Aanmelden
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={css('padding: clamp(20px, 3vw, 28px); border: 1px solid #E1EAE4; border-radius: 18px; background: #FFFFFF;')}>
            <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;')}>
              <div style={css('flex: 1 1 320px; min-width: 0; font-size: 15px; line-height: 1.65; color: #4B5C58;')}>
                Er zijn nog geen intervisie &amp; bijeenkomsten gepland. Wilt u er een op de agenda zetten?
              </div>
              <div onClick={openSessionDraft} role="button" style={{ ...knopGroen, flexShrink: 0 }}>
                Bijeenkomst voorstellen
              </div>
            </div>

            {sessionDraftOpen && (
              <div style={css('margin-top: 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 16px;')}>
                {(sessionFields || []).map((f, i) => (
                  <label key={i} style={css(`grid-column: ${f.span}; display: grid; gap: 7px; font-size: 14px; font-weight: 700; color: #2C4A5E;`)}>
                    {f.label}
                    <input value={f.value || ''} onChange={f.onChange} placeholder={f.placeholder} style={veldGroot} />
                  </label>
                ))}
                <label style={css('grid-column: 1 / -1; display: grid; gap: 7px; font-size: 14px; font-weight: 700; color: #2C4A5E;')}>
                  Toelichting
                  <textarea
                    value={sessionNote || ''}
                    onChange={setSessionNote}
                    rows="3"
                    placeholder="Waar wilt u het over hebben, en voor wie is deze sessie bedoeld?"
                    style={tekstGroot}
                  />
                </label>
                <div onClick={proposeSession} role="button" style={{ ...knopBlauw, gridColumn: '1 / -1', justifySelf: 'start' }}>
                  Voorstel versturen
                </div>
              </div>
            )}

            {sessionProposed && (
              <div style={css('margin-top: 18px; padding: 13px 16px; border-radius: 12px; background: #EAF4EE; color: #2F6D47; font-size: 14px; line-height: 1.6; font-weight: 700;')}>
                Uw voorstel is verstuurd. Zodra de beheerder het accepteert, staat de bijeenkomst op de agenda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLOG & KENNISDELING */}
      <div style={sectie}>
        <div style={css('display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 32px; gap: 16px; flex-wrap: wrap;')}>
          <div style={sectieKop}>Blog &amp; kennisdeling</div>
          <div
            onClick={requireLogin}
            style={css('cursor: pointer; padding: 11px 20px; background: #EAF4EE; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 14.5px;')}
          >
            Deel een inzicht
          </div>
        </div>

        {hasBlogPosts && (
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 24px;')}>
            {(blogPosts || []).map((post, i) => (
              <div
                key={post.id || i}
                onClick={post.open}
                style={css(
                  `cursor: ${post.cursor}; background: #FFFFFF; border-radius: 18px; padding: clamp(20px, 3vw, 26px); display: flex; flex-direction: column; gap: 12px;`,
                )}
              >
                <div style={css('font-size: 13px; font-weight: 700; color: #4E9A6C;')}>{post.tag}</div>
                <div style={css("font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E; line-height: 1.35;")}>
                  {post.title}
                </div>
                <div style={css('font-size: 14.5px; line-height: 1.55; color: #4B5C58; flex-grow: 1;')}>{post.excerpt}</div>
                <div style={css('font-size: 13px; color: #4B5C58; border-top: 1px solid #EEF2F0; padding-top: 12px;')}>
                  door <strong style={css('color: #2C4A5E;')}>{post.author}</strong> · {post.role}
                </div>
              </div>
            ))}
          </div>
        )}

        {noBlogPosts && (
          <div style={css('padding: clamp(22px, 3vw, 30px); border: 1px dashed #D5E0D9; border-radius: 18px; background: #FFFFFF; text-align: center;')}>
            <div style={css('margin-bottom: 6px; font-size: 12px; font-weight: 800; letter-spacing: 0.07em; color: #4E9A6C;')}>BINNENKORT</div>
            <div style={css('font-size: 15px; line-height: 1.65; color: #4B5C58;')}>
              Hier verschijnen binnenkort blogs en kennisdeling van leden.
            </div>
          </div>
        )}
      </div>

      {/* ERVARINGEN */}
      {hasExperiences && (
        <div style={sectie}>
          <div style={css("margin-bottom: 32px; font-family: 'Newsreader', serif; font-size: clamp(23px, 3.2vw, 28px); font-weight: 600; color: #2C4A5E;")}>
            Ervaringen van leden
          </div>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 18px;')}>
            {(experiences || []).map((e, i) => (
              <div key={i} style={css('background: #FFFFFF; border-radius: 18px; padding: 26px; display: flex; flex-direction: column; gap: 18px;')}>
                <div style={css("font-family: 'Newsreader', serif; font-size: 18px; font-style: italic; line-height: 1.55; color: #2C4A5E;")}>
                  {e.quote}
                </div>
                <div style={css('display: flex; align-items: center; gap: 12px; margin-top: auto;')}>
                  {e.hasPhoto && (
                    <div
                      role="img"
                      aria-label={e.name}
                      style={css(
                        `width: 44px; height: 44px; border-radius: 50%; background-image: ${e.photoStyle}; background-size: cover; background-position: center; flex-shrink: 0;`,
                      )}
                    />
                  )}
                  <div>
                    <div style={css('font-weight: 700; color: #2C4A5E; font-size: 14.5px;')}>{e.name}</div>
                    <div style={css('font-size: 13.5px; color: #4B5C58;')}>{e.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VRAAG & ANTWOORD */}
      <div style={sectie}>
        <div style={css('display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; gap: 16px; flex-wrap: wrap;')}>
          <div style={sectieKop}>Vraag &amp; antwoord</div>
          <div
            onClick={openQDraft}
            role="button"
            style={css(
              'cursor: pointer; box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 20px; background: #EAF4EE; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 14.5px;',
            )}
          >
            Stel een vraag
          </div>
        </div>
        <div style={css('margin-bottom: 24px; max-width: 620px; font-size: 15px; line-height: 1.65; color: #4B5C58;')}>
          Ieder lid kan een vraag stellen en antwoorden op de vragen van anderen.
        </div>

        {qDraftOpen && (
          <div style={css('margin-bottom: 20px; padding: 24px; border: 1px solid #E1EAE4; border-radius: 18px; background: #FFFFFF; display: grid; gap: 14px;')}>
            <label style={css('display: grid; gap: 7px; font-size: 14px; font-weight: 700; color: #2C4A5E;')}>
              Uw vraag
              <input value={qDraftTitle || ''} onChange={setQDraftTitle} placeholder="Waar loopt u tegenaan?" style={veldGroot} />
            </label>
            <label style={css('display: grid; gap: 7px; font-size: 14px; font-weight: 700; color: #2C4A5E;')}>
              Toelichting
              <textarea
                value={qDraftBody || ''}
                onChange={setQDraftBody}
                rows="3"
                placeholder="Geef context: welk fonds, welk project, wat heeft u al geprobeerd?"
                style={tekstGroot}
              />
            </label>
            <div onClick={submitQuestion} role="button" style={{ ...knopGroen, justifySelf: 'start' }}>
              Vraag plaatsen
            </div>
          </div>
        )}

        {hasQuestions && (
          <div style={css('display: flex; flex-direction: column; gap: 14px;')}>
            {(questions || []).map((q, i) => (
              <div key={q.id || i} style={css('background: #FFFFFF; border-radius: 16px; overflow: hidden;')}>
                <div
                  onClick={q.toggle}
                  role="button"
                  style={css('cursor: pointer; padding: 22px 26px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;')}
                >
                  <div>
                    <div style={css('font-weight: 700; font-size: 16px; color: #2C4A5E; margin-bottom: 6px;')}>{q.title}</div>
                    <div style={css('font-size: 13.5px; color: #4B5C58;')}>
                      gesteld door {q.author} · {q.role}
                    </div>
                  </div>
                  <div style={css('display: flex; align-items: center; gap: 8px; background: #EAF1F6; padding: 8px 14px; border-radius: 999px; white-space: nowrap;')}>
                    <div style={css('font-weight: 700; color: #2C4A5E; font-size: 14px;')}>{q.answers}</div>
                    <div style={css('font-size: 13px; color: #4B5C58;')}>antwoorden</div>
                  </div>
                </div>

                {q.isOpen && (
                  <div style={css('padding: 0 26px 24px; display: grid; gap: 16px;')}>
                    {q.hasBody && <div style={css('font-size: 15px; line-height: 1.7; color: #4B5C58;')}>{q.body}</div>}

                    {q.hasReplies && (
                      <div style={css('display: grid; gap: 10px;')}>
                        {(q.replies || []).map((r, j) => (
                          <div key={j} style={css('padding: 14px 16px; border-radius: 12px; background: #F7F9F8;')}>
                            <div style={css('margin-bottom: 4px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>{r.author}</div>
                            <div style={css('font-size: 14.5px; line-height: 1.6; color: #3D4B48;')}>{r.text}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={css('display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;')}>
                      <label style={css('flex: 1 1 260px; display: grid; gap: 7px; font-size: 13.5px; font-weight: 700; color: #2C4A5E;')}>
                        Uw antwoord
                        <textarea
                          value={q.replyValue || ''}
                          onChange={q.onReplyChange}
                          rows="2"
                          placeholder="Deel uw ervaring of advies"
                          style={css(
                            "width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #D5E0D9; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #2E3A38; resize: vertical; outline: none;",
                          )}
                        />
                      </label>
                      <div
                        onClick={q.submitReply}
                        role="button"
                        style={css(
                          'cursor: pointer; box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 20px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 14px; font-weight: 800;',
                        )}
                      >
                        Antwoord plaatsen
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEDEN & CONTACT */}
      <div style={sectie}>
        <div style={css("font-family: 'Newsreader', serif; font-size: clamp(23px, 3.2vw, 28px); font-weight: 600; color: #2C4A5E; margin-bottom: 32px;")}>
          Leden &amp; contact
        </div>
        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 20px;')}>
          {(members || []).map((member, i) => (
            <div key={i} style={css('background: #FFFFFF; border-radius: 18px; padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;')}>
              <div style={css('width: 56px; height: 56px; border-radius: 50%; background: repeating-linear-gradient(135deg, #A9C9DE, #A9C9DE 6px, #C6DDEA 6px, #C6DDEA 12px);')} />
              <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15px;')}>{member.name}</div>
              <div style={css('font-size: 13px; color: #4B5C58;')}>{member.role}</div>
              {isLoggedIn && <div style={css('font-size: 12.5px; color: #4E9A6C; font-weight: 700;')}>{member.email}</div>}
              {hideContact && (
                <div onClick={requireLogin} style={css('cursor: pointer; font-size: 12.5px; color: #8FA09B;')}>
                  Log in voor contact
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* VACATURES */}
      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div style={css('background: #A8D5BA; border-radius: 26px; padding: clamp(22px, 3.6vw, 48px);')}>
          <div style={css('display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; gap: 16px; flex-wrap: wrap;')}>
            <div style={css("font-family: 'Newsreader', serif; font-size: clamp(22px, 3vw, 26px); font-weight: 600; color: #2C4A5E;")}>
              Relevante vacatures
            </div>
            <div onClick={goVacatures} style={css('cursor: pointer; font-weight: 700; color: #2C4A5E; font-size: 14.5px;')}>
              Bekijk alle vacatures →
            </div>
          </div>
          <div style={css('font-size: 14.5px; color: #2C4A5E; opacity: 0.85; margin-bottom: 24px;')}>
            Actuele functies voor relatiemanagers, fondsenwervers en development-functies bij ngo's en goede doelen in
            Nederland. Controleer de status via de link, vacatures kunnen inmiddels zijn vervuld.
          </div>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 16px;')}>
            {(vacancies || []).map((v, i) => (
              <a
                key={i}
                href={v.url}
                target="_blank"
                rel="noopener"
                style={css('background: #FFFFFF; border-radius: 14px; padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;')}
              >
                <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px;')}>
                  <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15.5px;')}>{v.title}</div>
                  <div style={css('font-size: 12px; color: #FFFFFF; background: #4E9A6C; padding: 3px 10px; border-radius: 999px; font-weight: 700; white-space: nowrap;')}>
                    {v.type}
                  </div>
                </div>
                <div style={css('font-size: 13.5px; color: #4B5C58;')}>
                  {v.org} · {v.location}
                </div>
                <div style={css('display: flex; flex-wrap: wrap; gap: 6px;')}>
                  {(v.tags || []).map((tag, j) => (
                    <div key={j} style={css('font-size: 11.5px; font-weight: 700; color: #2C4A5E; background: #EAF1F6; padding: 3px 10px; border-radius: 999px;')}>
                      {tag}
                    </div>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* SUBSIDIE KOMPAS IN UW WERK */}
      <div style={css('max-width: 1180px; margin: -32px auto 0; padding: 0 32px 76px;')}>
        <div
          style={css(
            'background: #FFFFFF; border: 1.5px solid #E1EAE4; border-radius: 24px; padding: clamp(22px, 3.5vw, 36px) clamp(20px, 4vw, 44px); display: flex; align-items: center; gap: 30px; flex-wrap: wrap;',
          )}
        >
          <img
            src="/uploads/kompas-logo.png"
            alt="Subsidie Kompas logo"
            style={css('width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0; display: block;')}
          />
          <div style={css('flex-grow: 1; min-width: 240px;')}>
            <div style={css('font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;')}>
              Subsidie Kompas
            </div>
            <div style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; margin-bottom: 6px;")}>
              Uw vaste hulp bij elke aanvraag
            </div>
            <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58; max-width: 560px;')}>
              Sneller matchen, deadlines bewaken en aanvragen onderbouwen, naast uw eigen vakkennis.
            </div>
          </div>
          <a
            href="#"
            onClick={goKompas}
            style={css('padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;')}
          >
            Probeer Subsidie Kompas →
          </a>
        </div>
      </div>
    </div>
  );
}
