import React from 'react';
import { css } from '../../shared/lib/css.js';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import { useApp } from './WebsiteProvider.jsx';

export default function HomePage() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>

  {(isHome) ? (<>
  <div data-screen-label="Home">

    
    <div style={css(`max-width: 980px; margin: 0 auto; padding: clamp(32px, 6vw, 72px) 32px clamp(32px, 6vw, 72px); text-align: center; position: relative; overflow: hidden;`)}>

      {(heroAnimationOn) ? (<>
        <div style={css(`position: absolute; inset: 0; pointer-events: none; z-index: 0;`)} aria-hidden="true">
          <svg style={css(`position: absolute; top: 16%; left: 3%; width: 96px; height: 96px; opacity: 0.4; animation: fw-float-a 11s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="22" stroke="#9FB8C4" strokeWidth="1.6"></circle>
            <path d="M32 15c1 4-1 8-1 12M32 49c1-4-1-8-1-12" stroke="#9FB8C4" strokeWidth="1.2" strokeLinecap="round"></path>
            <path d="M32 20 L38 32 L32 44 L26 32 Z" stroke="#A8D5BA" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <circle cx="32" cy="32" r="2" fill="#A8D5BA"></circle>
            <path d="M14 44c-3 3-3 6-1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none"></path>
          </svg>
          <svg style={css(`position: absolute; top: 3%; right: 5%; width: 82px; height: 82px; opacity: 0.35; animation: fw-float-b 12.5s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <path d="M16 12h26l8 8v32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <path d="M42 12v8h8" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <path d="M18 28h13M18 34h20M18 40h20" stroke="#C3D9E6" strokeWidth="1" strokeLinecap="round"></path>
            <path d="M30 26c4-5 12-9 17-6 1.6 1 1.3 3-.4 4.4-6 5-13 9-19 11.6-1.4.6-2.4-.5-1.8-1.8 1.8-4 3-6.4 4.2-8.2Z" stroke="#A8D5BA" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" fill="none"></path>
            <path d="M26 44l2-6" stroke="#A8D5BA" strokeWidth="1.5" strokeLinecap="round"></path>
          </svg>
          <svg style={css(`position: absolute; bottom: 9%; left: 2%; width: 76px; height: 76px; opacity: 0.32; animation: fw-float-c 10s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <path d="M32 4v5M20 8l2.5 4.3M44 8l-2.5 4.3M12 18l4.3 2.5M52 18l-4.3 2.5" stroke="#F2E1A8" strokeWidth="1.4" strokeLinecap="round"></path>
            <path d="M32 12c-9 1-15 8-13 16 1.3 5.2 6 7 8 11 1 2 1 4 1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
            <path d="M32 12c9 1 15 8 13 16-1.3 5.2-6 7-8 11-1 2-1 4-1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
            <path d="M27 50c3 2 7 2 10 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
            <path d="M28 55c2.4 1.3 5.6 1.3 8 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
          </svg>
          <svg style={css(`position: absolute; bottom: 11%; right: 8%; width: 92px; height: 92px; opacity: 0.36; animation: fw-float-d 12s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="31" stroke="#B9D6C9" strokeWidth="1.6"></circle>
            <circle cx="32" cy="32" r="27" stroke="#B9D6C9" strokeWidth="1"></circle>
            <path d="M38 16c-5-1-10 1-12 5 -1 2-2 5-6 7 l7 3 c-2 2-2 4 1 5 c-2 2-1 4 2 5 c-2 2-1 4 3 6 l0 4 c0 2 3 3 6 3 l9 0 c0-4-2-7-2-10 c5-2 8-8 8-14 c0-9-5-15-16-15Z" stroke="#9FB8C4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"></path>
            <circle cx="31" cy="25" r="1.2" fill="#9FB8C4"></circle>
            <path d="M18 22c3-3 7-4 10-3" stroke="#A8D5BA" strokeWidth="1.3" strokeLinecap="round" fill="none"></path>
            <text x="45" y="46" fontFamily="'Newsreader', serif" fontSize="13" fill="#9FB8C4" textAnchor="middle">€</text>
            <path d="M53 49c3 3 3 6 1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none"></path>
          </svg>
        </div>
      </>) : null}

      <div style={css(`position: relative; z-index: 1;`)}>
      <div style={css(`display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 28px;`)}>Het kennisplatform voor fondsenwerving & subsidies<br /></div>
      <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(32px, 6.5vw, 52px); line-height: 1.15; font-weight: 600; color: #2C4A5E; margin-bottom: 22px; text-wrap: balance;`)}>
        Alles wat u nodig heeft voor fondsenwerving, slim gebundeld op één plek
      </div>
      <div style={css(`font-size: 19px; line-height: 1.6; color: #4B5C58; max-width: 660px; margin: 0 auto 44px;`)}>Het Fondsenwervers Collectief brengt vakkennis, ervaring en slimme tools samen, zodat u uw werk succesvoller kunt doen en meer impact maakt.</div>

      <div style={css(`font-size: 14px; font-weight: 700; color: #2C4A5E; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px;`)}>Ik ben...</div>
      <div style={css(`display: flex; flex-wrap: wrap; gap: 14px; justify-content: center;`)}>
        <a href="#blok-fellow" style={css(`width: 180px; text-align: center; padding: 14px 26px; background: #FFFFFF; border: 1.5px solid #A8D5BA; border-radius: 16px; font-weight: 700; color: #2C4A5E; font-size: 15.5px; box-shadow: 0 2px 0 rgba(44,74,94,0.04); box-sizing: border-box;`)}>Fondsenwerver</a>
        <a href="#blok-org" style={css(`width: 180px; text-align: center; padding: 14px 26px; background: #FFFFFF; border: 1.5px solid #A9C9DE; border-radius: 16px; font-weight: 700; color: #2C4A5E; font-size: 15.5px; box-shadow: 0 2px 0 rgba(44,74,94,0.04); box-sizing: border-box;`)}>Organisatie</a>
        <div onClick={goOrient} style={css(`width: 180px; text-align: center; padding: 14px 26px; background: #FFFFFF; border: 1.5px solid #E1EAE4; border-radius: 16px; font-weight: 700; color: #2C4A5E; font-size: 15.5px; box-shadow: 0 2px 0 rgba(44,74,94,0.04); cursor: pointer; box-sizing: border-box;`)}>Oriënterend</div>
      </div>
      </div>
    </div>

    
    <div id="kompas-ai" style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`background: #EAF4EE; border-radius: 28px; padding: clamp(29px, 4vw, 64px); display: grid; grid-template-columns: 1.1fr 1fr; gap: 56px; align-items: start; box-shadow: 0 1px 3px rgba(44,74,94,0.06);`)}>
        <div>
          <div style={css(`display: inline-flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-size: 13px; font-weight: 700; margin-bottom: 18px;`)}>
            <img src="/uploads/kompas-logo.png" alt="Subsidie Kompas logo" style={css(`width: 26px; height: 26px; border-radius: 50%; display: block;`)} />
            Subsidie Kompas
          </div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(22px, 4.3vw, 34px); font-weight: 600; color: #2C4A5E; line-height: 1.25; margin-bottom: 18px;`)}>
            Uw gids bij fondsenwerving
          </div>
          <div style={css(`font-size: 16.5px; line-height: 1.65; color: #2C4A5E; margin-bottom: 28px;`)}>
            Stel uw vraag, en Subsidie Kompas denkt met u mee over projectfinanciering.
          </div>

          <div style={css(`display: flex; flex-direction: column; gap: 16px; margin-bottom: 34px;`)}>
            <div style={css(`display: flex; gap: 12px; align-items: flex-start;`)}>
              <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
              <div style={css(`font-size: 15.5px; line-height: 1.5; color: #2C4A5E;`)}><strong>Zoekt gericht naar passende fondsen en subsidies</strong></div>
            </div>
            <div style={css(`display: flex; gap: 12px; align-items: flex-start;`)}>
              <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
              <div style={css(`font-size: 15.5px; line-height: 1.5; color: #2C4A5E;`)}><strong>Brengt financiering, voorwaarden en deadlines helder in beeld</strong></div>
            </div>
            <div style={css(`display: flex; gap: 12px; align-items: flex-start;`)}>
              <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
              <div style={css(`font-size: 15.5px; line-height: 1.5; color: #2C4A5E;`)}><strong>Adviseert over kansrijkheid en fondsenwervende strategie</strong></div>
            </div>
            <div style={css(`display: flex; gap: 12px; align-items: flex-start;`)}>
              <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
              <div style={css(`font-size: 15.5px; line-height: 1.5; color: #2C4A5E;`)}><strong>Ondersteunt bij een sterke aanvraag: positionering, projectplan en begroting</strong></div>
            </div>
          </div>

          <a href="#/subsidie-kompas" style={css(`display: inline-block; padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px;`)}>Probeer Subsidie Kompas →</a>
        </div>

        <div style={css(`background: #FFFFFF; border-radius: 22px; padding: 22px; display: flex; flex-direction: column; gap: 14px;`)}>
          <div style={css(`display: flex; align-items: center; gap: 10px; padding: 0 4px;`)}>
            <img src="/uploads/kompas-logo.png" alt="Subsidie Kompas logo" style={css(`width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: block;`)} />
            <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 14.5px;`)}>Subsidie Kompas</div>
            <div style={css(`width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-left: 2px;`)}></div>
            <div style={css(`font-size: 12.5px; color: #4B5C58;`)}>online</div>
          </div>

          <div style={css(`align-self: flex-end; max-width: 82%; background: #2C4A5E; color: #FFFFFF; padding: 12px 16px; border-radius: 16px 16px 4px 16px; font-size: 14.5px; line-height: 1.5;`)}>
            Ik zoek financiering voor een hedendaagse fotografie tentoonstelling in Utrecht. Budget ±€40.000.
          </div>

          <div style={css(`align-self: flex-start; max-width: 92%; background: #FFFFFF; padding: 14px 16px; border-radius: 16px 16px 16px 4px; box-shadow: 0 1px 2px rgba(44,74,94,0.06);`)}>
            <div style={css(`font-size: 14.5px; line-height: 1.55; color: #2E3A38; margin-bottom: 12px;`)}>Goed idee. Ik vond 3 passende regelingen voor een fotografietentoonstelling in Utrecht:</div>
            <div style={css(`display: flex; flex-direction: column; gap: 8px;`)}>
              <div style={css(`display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #EAF4EE; border-radius: 10px; padding: 9px 12px;`)}>
                <div style={css(`font-size: 13.5px; font-weight: 700; color: #2C4A5E;`)}>Landelijk cultuurfonds: Fotografie, t/m €25.000</div>
                <div style={css(`font-size: 12px; color: #4E9A6C; font-weight: 700; white-space: nowrap;`)}>deadline 1 sep</div>
              </div>
              <div style={css(`display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #EAF4EE; border-radius: 10px; padding: 9px 12px;`)}>
                <div style={css(`font-size: 13.5px; font-weight: 700; color: #2C4A5E;`)}>Gemeentelijk cultuurfonds, t/m €10.000</div>
                <div style={css(`font-size: 12px; color: #4E9A6C; font-weight: 700; white-space: nowrap;`)}>doorlopend</div>
              </div>
              <div style={css(`display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #EAF4EE; border-radius: 10px; padding: 9px 12px;`)}>
                <div style={css(`font-size: 13.5px; font-weight: 700; color: #2C4A5E;`)}>Particulier cultuurfonds, t/m €5.000</div>
                <div style={css(`font-size: 12px; color: #4E9A6C; font-weight: 700; white-space: nowrap;`)}>15 okt</div>
              </div>
            </div>
          </div>

          <div style={css(`display: flex; align-items: center; gap: 10px; background: #FFFFFF; border-radius: 999px; padding: 12px 16px;`)}>
            <div style={css(`flex-grow: 1; font-size: 14px; color: #9BAAA6;`)}>Typ uw vraag...</div>
            <div style={css(`width: 30px; height: 30px; border-radius: 50%; background: #4E9A6C; flex-shrink: 0; display: flex; align-items: center; justify-content: center;`)}>
              <div style={css(`width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 9px solid #FFFFFF; margin-left: 2px;`)}></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    
    <div id="voor-wie" style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px); position: relative; overflow: hidden;`)}>

      {(heroAnimationOn) ? (<>
        <div style={css(`position: absolute; inset: 0; pointer-events: none; z-index: 0;`)} aria-hidden="true">
          <svg style={css(`position: absolute; top: 2%; right: 2%; width: 70px; height: 70px; opacity: 0.28; animation: fw-float-b 13s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <path d="M16 12h26l8 8v32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <path d="M42 12v8h8" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <path d="M18 28h13M18 34h20M18 40h20" stroke="#C3D9E6" strokeWidth="1" strokeLinecap="round"></path>
          </svg>
          <svg style={css(`position: absolute; bottom: 4%; left: 3%; width: 60px; height: 60px; opacity: 0.28; animation: fw-float-c 10.5s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="18" stroke="#9FB8C4" strokeWidth="1.6"></circle>
            <path d="M32 17c1 3-1 6-1 9M32 47c1-3-1-6-1-9" stroke="#9FB8C4" strokeWidth="1.1" strokeLinecap="round"></path>
            <path d="M32 22 L37 32 L32 42 L27 32 Z" stroke="#A8D5BA" strokeWidth="1.5" strokeLinejoin="round" fill="none"></path>
          </svg>
        </div>
      </>) : null}

      <div style={css(`position: relative; z-index: 1;`)}>
      <div style={css(`margin-bottom: 48px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(22px, 4.3vw, 34px); font-weight: 600; color: #2C4A5E; margin-bottom: 14px;`)}>Voor iedereen in het vak</div>
        <div style={css(`font-size: 17px; line-height: 1.6; color: #4B5C58; max-width: 620px;`)}>Waar u ook staat, of u nu dagelijks fondsen werft, financiering zoekt voor uw project of het vak wilt leren.</div>
      </div>

      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 28px;`)}>
        <div id="blok-fellow" style={css(`background: #FFFFFF; border-radius: 18px; border-top: 4px solid #4E9A6C; padding: 36px; display: flex; flex-direction: column; gap: 6px; scroll-margin-top: 100px;`)}>
          <div style={css(`display: flex; align-items: center; gap: 12px; margin-bottom: 14px;`)}>
            <div style={css(`width: 46px; height: 46px; border-radius: 14px; background: #EAF4EE; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`)}>
              <div style={css(`width: 18px; height: 18px; border-radius: 50%; background: #4E9A6C;`)}></div>
            </div>
            <div style={css(`display: inline-block; padding: 5px 14px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;`)}>Voor profs</div>
          </div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 12px;`)}>Fondsenwervers</div>
          <div style={css(`font-size: 15.5px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 18px;`)}>Professionaliseer uw werk, deel vakkennis met vakgenoten en gebruik Subsidie Kompas als betrouwbare hulp in uw dagelijkse praktijk.</div>
          <div onClick={goNetwerk} style={css(`cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;`)}>Ontdek het platform voor fondsenwervers →</div>
        </div>

        <div id="blok-org" style={css(`background: #FFFFFF; border-radius: 18px; border-top: 4px solid #A9C9DE; padding: 36px; display: flex; flex-direction: column; gap: 6px; scroll-margin-top: 100px;`)}>
          <div style={css(`display: flex; align-items: center; gap: 12px; margin-bottom: 14px;`)}>
            <div style={css(`width: 46px; height: 46px; border-radius: 14px; background: #EAF1F6; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`)}>
              <div style={css(`width: 18px; height: 18px; border-radius: 4px; background: #4E9A6C;`)}></div>
            </div>
            <div style={css(`display: inline-block; padding: 5px 14px; border-radius: 999px; background: #EAF1F6; color: #2C4A5E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;`)}>Zoekt financiering</div>
          </div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 12px;`)}>Organisaties</div>
          <div style={css(`font-size: 15.5px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 18px;`)}>Op zoek naar projectfinanciering voor uw organisatie? Ontdek hoe u het zelf kunt doen, met Subsidie Kompas als uw rechterhand.</div>
          <div onClick={goOrg} style={css(`cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;`)}>Bekijk hoe het werkt voor organisaties →</div>
        </div>

        <div id="blok-orient" style={css(`background: #FFFFFF; border-radius: 18px; border-top: 4px solid #A8D5BA; padding: 36px; display: flex; flex-direction: column; gap: 6px; scroll-margin-top: 100px;`)}>
          <div style={css(`display: flex; align-items: center; gap: 12px; margin-bottom: 14px;`)}>
            <div style={css(`width: 46px; height: 46px; border-radius: 14px; background: #F1EDE3; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`)}>
              <div style={css(`width: 0; height: 0; border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-left: 14px solid #4E9A6C; margin-left: 3px;`)}></div>
            </div>
            <div style={css(`display: inline-block; padding: 5px 14px; border-radius: 999px; background: #F1EDE3; color: #2C4A5E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;`)}>Oriënterend</div>
          </div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 12px;`)}>Aankomende fondsenwervers</div>
          <div style={css(`font-size: 15.5px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 18px;`)}>Leer stap voor stap hoe u fondsen werft en wat een succesvolle fondsenwerver kenmerkt, via video's, cursusmateriaal en praktijkcases.</div>
          <div onClick={goOrient} style={css(`cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;`)}>Begin met leren →</div>
        </div>
      </div>
      </div>
    </div>
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`background: #A8D5BA; border-radius: 28px; padding: clamp(25px, 4vw, 56px); display: grid; grid-template-columns: 1.2fr 1fr; gap: 48px; align-items: center;`)}>
        <div style={css(`display: flex; flex-direction: column; gap: 22px;`)}>
          <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(22px, 3.8vw, 30px); color: #2C4A5E; line-height: 1;`)}>"</div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 24px; line-height: 1.5; color: #2C4A5E; margin-top: -22px;`)}>Eindelijk een plek die vakkennis en een bruikbare tool combineert. Subsidie Kompas bespaart ons uren zoekwerk per aanvraag, en de video's gebruiken we om nieuwe collega's in te werken.</div>
          <div style={css(`display: flex; align-items: center; gap: 12px;`)}>
            <div style={css(`width: 44px; height: 44px; border-radius: 50%; background: #2C4A5E; color: #FFFFFF; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`)}>FC</div>
            <div>
              <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 14.5px;`)}>Lid van het Collectief</div>
              <div style={css(`font-size: 13.5px; color: #2C4A5E; opacity: 0.75;`)}>Fondsenwerver</div>
            </div>
          </div>
        </div>
        <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;`)}>
          <div style={css(`background: #DCEFE3; border-radius: 16px; padding: 24px;`)}>
            <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(22px, 4vw, 32px); font-weight: 700; color: #2C4A5E; margin-bottom: 8px;`)}><FundingDatabaseCount /></div>
            <div style={css(`font-size: 14px; color: #2C4A5E; line-height: 1.4;`)}>fondsen en regelingen in de database</div>
          </div>
          <div style={css(`background: #DCEFE3; border-radius: 16px; padding: 24px;`)}>
            <div style={css(`display: inline-flex; align-items: center; gap: 6px; background: rgba(78,154,108,0.12); color: #4E9A6C; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 5px 11px; border-radius: 999px; margin-bottom: 10px;`)}><span style={css(`width: 6px; height: 6px; border-radius: 50%; background: #4E9A6C;`)}></span>Binnenkort</div>
            <div style={css(`font-size: 14px; color: #2C4A5E; line-height: 1.4;`)}>fondsenwervers aangesloten</div>
          </div>
          <div style={css(`background: #DCEFE3; border-radius: 16px; padding: 24px;`)}>
            <div style={css(`display: inline-flex; align-items: center; gap: 6px; background: rgba(78,154,108,0.12); color: #4E9A6C; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 5px 11px; border-radius: 999px; margin-bottom: 10px;`)}><span style={css(`width: 6px; height: 6px; border-radius: 50%; background: #4E9A6C;`)}></span>Binnenkort</div>
            <div style={css(`font-size: 14px; color: #2C4A5E; line-height: 1.4;`)}>video's in de bibliotheek</div>
          </div>
          <div style={css(`background: #DCEFE3; border-radius: 16px; padding: 24px;`)}>
            <div style={css(`display: inline-flex; align-items: center; gap: 6px; background: rgba(78,154,108,0.12); color: #4E9A6C; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 5px 11px; border-radius: 999px; margin-bottom: 10px;`)}><span style={css(`width: 6px; height: 6px; border-radius: 50%; background: #4E9A6C;`)}></span>Binnenkort</div>
            <div style={css(`font-size: 14px; color: #2C4A5E; line-height: 1.4;`)}>waardering door leden</div>
          </div>
        </div>
      </div>
    </div>

    
    <div id="nieuws" style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 36px;`)}>
        <div>
          <div style={css(`font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;`)}>Actueel</div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(22px, 3.8vw, 30px); font-weight: 600; color: #2C4A5E; margin-bottom: 8px;`)}>Nieuws uit subsidieland</div>
          <div style={css(`font-size: 15.5px; color: #4B5C58;`)}>Actuele ontwikkelingen, regelgeving en verdiepende artikelen uit de wereld van fondsen en subsidies.</div>
        </div>
        <div onClick={goActueel} style={css(`cursor: pointer; font-weight: 700; color: #2C4A5E; font-size: 15px;`)}>Alle artikelen →</div>
      </div>

      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 28px;`)}>
        {((homeNews)||[]).map((item, $index) => (<React.Fragment key={$index}>
          <div onClick={item.open} style={css(`cursor: pointer; background: #FFFFFF; border-radius: 18px; padding: 28px; display: flex; flex-direction: column; gap: 12px;`)} className="fw-h0">
            <div style={css(`font-size: 13px; font-weight: 700; color: #4E9A6C;`)}>{item.tag} · {item.date}</div>
            <div style={css(`font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; color: #2C4A5E; line-height: 1.35;`)}>{item.title}</div>
            <div style={css(`font-size: 14.5px; line-height: 1.55; color: #4B5C58; flex-grow: 1;`)}>{item.excerpt}</div>
            <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 14px;`)}>Lees meer →</div>
          </div>
        </React.Fragment>))}
      </div>
    </div>

  </div>
  </>) : null}

  
  </>);
}
