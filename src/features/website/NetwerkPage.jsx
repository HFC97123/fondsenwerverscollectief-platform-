import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';
import Login from './Login.jsx';
import Register from './Register.jsx';
import Ledenlijst from './Ledenlijst.jsx';

export default function NetwerkPage() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>

  {(isNetwerk) ? (<>

  {app.isLoggedIn ? <Ledenlijst eigenNaam={app.memberName} /> : null}
  <div data-screen-label="Collectief">
    <div style={css(`max-width: 980px; margin: 0 auto; padding: 60px 32px 48px; text-align: center; position: relative; overflow: hidden;`)}>

      {(heroAnimationOn) ? (<>
        <div style={css(`position: absolute; inset: 0; pointer-events: none; z-index: 0;`)} aria-hidden="true">
          <svg style={css(`position: absolute; top: 14%; left: 3%; width: 92px; height: 92px; opacity: 0.4; animation: fw-float-a 11s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="22" stroke="#9FB8C4" strokeWidth="1.6"></circle>
            <path d="M32 15c1 4-1 8-1 12M32 49c1-4-1-8-1-12" stroke="#9FB8C4" strokeWidth="1.2" strokeLinecap="round"></path>
            <path d="M32 20 L38 32 L32 44 L26 32 Z" stroke="#A8D5BA" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <circle cx="32" cy="32" r="2" fill="#A8D5BA"></circle>
            <path d="M14 44c-3 3-3 6-1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none"></path>
          </svg>
          <svg style={css(`position: absolute; top: 4%; right: 5%; width: 80px; height: 80px; opacity: 0.35; animation: fw-float-b 12.5s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <path d="M16 12h26l8 8v32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <path d="M42 12v8h8" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none"></path>
            <path d="M18 28h13M18 34h20M18 40h20" stroke="#C3D9E6" strokeWidth="1" strokeLinecap="round"></path>
            <path d="M30 26c4-5 12-9 17-6 1.6 1 1.3 3-.4 4.4-6 5-13 9-19 11.6-1.4.6-2.4-.5-1.8-1.8 1.8-4 3-6.4 4.2-8.2Z" stroke="#A8D5BA" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" fill="none"></path>
            <path d="M26 44l2-6" stroke="#A8D5BA" strokeWidth="1.5" strokeLinecap="round"></path>
          </svg>
          <svg style={css(`position: absolute; bottom: 8%; left: 2%; width: 72px; height: 72px; opacity: 0.32; animation: fw-float-c 10s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
            <path d="M32 4v5M20 8l2.5 4.3M44 8l-2.5 4.3M12 18l4.3 2.5M52 18l-4.3 2.5" stroke="#F2E1A8" strokeWidth="1.4" strokeLinecap="round"></path>
            <path d="M32 12c-9 1-15 8-13 16 1.3 5.2 6 7 8 11 1 2 1 4 1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
            <path d="M32 12c9 1 15 8 13 16-1.3 5.2-6 7-8 11-1 2-1 4-1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
            <path d="M27 50c3 2 7 2 10 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
            <path d="M28 55c2.4 1.3 5.6 1.3 8 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none"></path>
          </svg>
          <svg style={css(`position: absolute; bottom: 10%; right: 7%; width: 88px; height: 88px; opacity: 0.36; animation: fw-float-d 12s ease-in-out infinite;`)} viewBox="0 0 64 64" fill="none">
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
      <div style={css(`display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;`)}>Het platform voor fondsenwervers</div>
      <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(27px, 5.5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;`)}>Het Fondsenwervers Collectief</div>
      <div style={css(`display: inline-flex; flex-direction: column; gap: 11px; text-align: left; margin: 4px auto 0;`)}>
        <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}>
          <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
          <div style={css(`font-size: 15.5px; line-height: 1.5; color: #4E9A6C; font-weight: 700;`)}>Vakkennis en verdieping voor en door fondsenwervers</div>
        </div>
        <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}>
          <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
          <div style={css(`font-size: 15.5px; line-height: 1.5; color: #4E9A6C; font-weight: 700;`)}>Netwerk & intervisie: deel kennis en ervaring, leer van elkaars aanvragen, afwijzingen en toekenningen</div>
        </div>
        <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}>
          <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
          <div style={css(`font-size: 15.5px; line-height: 1.5; color: #4E9A6C; font-weight: 700;`)}>Praktijkgidsen en kant-en-klare templates om te downloaden</div>
        </div>
        <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}>
          <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
          <div style={css(`font-size: 15.5px; line-height: 1.5; color: #4E9A6C; font-weight: 700;`)}>Slimme tools, met Subsidie Kompas-premium als vaste hulp in uw dagelijkse praktijk</div>
        </div>
        <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}>
          <div style={css(`width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;`)}></div>
          <div style={css(`font-size: 15.5px; line-height: 1.5; color: #4E9A6C; font-weight: 700;`)}>Relevante vacatures uit de sector</div>
        </div>
      </div>
      <div style={css(`font-size: 17px; line-height: 1.6; color: #2C4A5E; font-weight: 700; max-width: 640px; margin: 24px auto 0;`)}>Alles op één plek in een besloten omgeving</div>

      {(showAuthCta) ? (<>
        <div style={css(`display: flex; gap: 14px; justify-content: center; margin-top: 30px;`)}>
          <div onClick={showLogin} style={css(`cursor: pointer; padding: 13px 30px; background: #FFFFFF; border: 1.5px solid #A8D5BA; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 15.5px;`)}>Inloggen</div>
          <div onClick={showRegister} style={css(`cursor: pointer; padding: 13px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15.5px;`)}>Word lid</div>
        </div>
      </>) : null}
      </div>
    </div>

    
    <div id="account" style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px 56px;`)}>

      {(isLoggedIn) ? (<>
        <div style={css(`background: #FFFFFF; border-radius: 24px; padding: 40px; display: grid; grid-template-columns: 300px 1fr; gap: 40px; align-items: start;`)}>
          <div style={css(`text-align: center;`)}>
            <div style={css(`width: 120px; height: 120px; border-radius: 50%; background: repeating-linear-gradient(135deg, #A8D5BA, #A8D5BA 7px, #93C7AB 7px, #93C7AB 14px); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; color: #2C4A5E; font-family: 'Newsreader', serif; font-size: clamp(22px, 4.3vw, 34px); font-weight: 600;`)}>{profileInitials}</div>
            <div style={css(`font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;`)}>{profileFullName}</div>
            <div style={css(`font-size: 14px; color: #4B5C58; margin-top: 4px;`)}>Lid van het Collectief</div>
            <div onClick={logout} style={css(`cursor: pointer; margin-top: 18px; display: inline-block; padding: 9px 22px; border: 1.5px solid #E1EAE4; border-radius: 999px; font-weight: 700; color: #4E9A6C; font-size: 13.5px;`)}>Uitloggen</div>
          </div>
          <div>
            <div style={css(`font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;`)}>Over mij</div>
            <div style={css(`font-size: 15px; line-height: 1.65; color: #4B5C58; margin-bottom: 28px; max-width: 560px;`)}>Fondsenwerver met hart voor maatschappelijke projecten. Vul hier een korte bio in zodat vakgenoten weten waar u aan werkt en waarover u graag kennis uitwisselt.</div>
            <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;`)}>
              <div style={css(`background: #F7F9F8; border-radius: 16px; padding: 22px;`)}>
                <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 15px; margin-bottom: 14px;`)}>Mijn opgeslagen artikelen</div>
                <div style={css(`display: flex; flex-direction: column; gap: 10px;`)}>
                  <div style={css(`font-size: 14px; color: #4B5C58; line-height: 1.4; padding-bottom: 10px; border-bottom: 1px solid #E8EEEB;`)}>Wat we leerden van vijf afgewezen aanvragen</div>
                  <div style={css(`font-size: 14px; color: #4B5C58; line-height: 1.4;`)}>Major donors werven zonder groot netwerk</div>
                </div>
              </div>
              <div style={css(`background: #F7F9F8; border-radius: 16px; padding: 22px;`)}>
                <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 15px; margin-bottom: 14px;`)}>Mijn activiteiten</div>
                <div style={css(`display: flex; flex-direction: column; gap: 10px;`)}>
                  <div style={css(`font-size: 14px; color: #4B5C58; line-height: 1.4; padding-bottom: 10px; border-bottom: 1px solid #E8EEEB;`)}>Aangemeld voor intervisie op 18 jul</div>
                  <div style={css(`font-size: 14px; color: #4B5C58; line-height: 1.4;`)}>1 vraag gesteld in Vraag & antwoord</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>) : null}

      <Login />

      <Register />
    </div>

    
    {(isLoggedIn) ? (<>
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(32px, 6vw, 72px);`)}>
      <div style={css(`margin-bottom: 28px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;`)}>Praktijkgidsen & templates</div>
        <div style={css(`font-size: 15px; color: #4B5C58; margin-top: 6px;`)}>Kant-en-klare documenten om direct in uw aanvraag te gebruiken.</div>
      </div>
      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px;`)}>
        {((resources)||[]).map((r, $index) => (<React.Fragment key={$index}>
          <div style={css(`background: #FFFFFF; border-radius: 18px; padding: 26px; display: flex; flex-direction: column; gap: 12px;`)}>
            <div style={css(`display: flex; align-items: center; justify-content: space-between;`)}>
              <div style={css(`font-size: 13px; font-weight: 700; color: #4E9A6C;`)}>{r.type}</div>
              <div style={css(`font-size: 11.5px; font-weight: 700; color: #2C4A5E; background: #EAF1F6; padding: 3px 9px; border-radius: 6px;`)}>{r.format}</div>
            </div>
            <div style={css(`font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E; line-height: 1.35; flex-grow: 1;`)}>{r.title}</div>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" download style={css(`font-weight: 700; color: #2C4A5E; font-size: 14px;`)}>Downloaden ↓</a>
            ) : (
              <div style={css(`font-weight: 700; color: #8A9691; font-size: 14px;`)}>Binnenkort beschikbaar</div>
            )}
          </div>
        </React.Fragment>))}
      </div>
    </div>
    </>) : null}

    
    {(isLoggedIn) ? (<>
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(32px, 6vw, 72px);`)}>
      <div style={css(`margin-bottom: 28px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;`)}>Intervisie & bijeenkomsten</div>
        <div style={css(`font-size: 15px; color: #4B5C58; margin-top: 6px;`)}>Meld u aan voor de komende sessies met vakgenoten.</div>
      </div>
      <div style={css(`display: flex; flex-direction: column; gap: 14px;`)}>
        {((sessions)||[]).map((s, $index) => (<React.Fragment key={$index}>
          <div style={css(`background: #FFFFFF; border-radius: 16px; padding: 20px 26px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap;`)}>
            <div style={css(`text-align: center; flex-shrink: 0; min-width: 56px;`)}>
              <div style={css(`font-family: 'Newsreader', serif; font-size: 24px; font-weight: 700; color: #4E9A6C; line-height: 1;`)}>{s.day}</div>
              <div style={css(`font-size: 12.5px; color: #4B5C58; text-transform: uppercase; letter-spacing: 0.04em;`)}>{s.month}</div>
            </div>
            <div style={css(`flex-grow: 1; min-width: 200px;`)}>
              <div style={css(`font-weight: 700; font-size: 16px; color: #2C4A5E; margin-bottom: 4px;`)}>{s.title}</div>
              <div style={css(`font-size: 13.5px; color: #4B5C58;`)}>{s.time} · {s.host}</div>
            </div>
            <div style={css(`display: flex; align-items: center; gap: 14px;`)}>
              <div style={css(`font-size: 12px; font-weight: 700; color: #2C4A5E; background: #EAF4EE; padding: 5px 12px; border-radius: 999px; white-space: nowrap;`)}>{s.mode}</div>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={css(`padding: 9px 18px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 13.5px; white-space: nowrap;`)}>Aanmelden</a>
              ) : (
                <div style={css(`padding: 9px 18px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 13.5px; white-space: nowrap;`)}>Aanmelden</div>
              )}
            </div>
          </div>
        </React.Fragment>))}
      </div>
    </div>
    </>) : null}

    
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(32px, 6vw, 72px);`)}>
      <div style={css(`display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 32px; gap: 16px; flex-wrap: wrap;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;`)}>Blog & kennisdeling</div>
        <div onClick={requireLogin} style={css(`cursor: pointer; padding: 11px 20px; background: #EAF4EE; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 14.5px;`)}>Deel een inzicht</div>
      </div>
      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px;`)}>
        {((blogPosts)||[]).map((post, $index) => (<React.Fragment key={$index}>
          <div style={css(`background: #FFFFFF; border-radius: 18px; padding: 26px; display: flex; flex-direction: column; gap: 12px;`)}>
            <div style={css(`font-size: 13px; font-weight: 700; color: #4E9A6C;`)}>{post.tag}</div>
            <div style={css(`font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E; line-height: 1.35;`)}>{post.title}</div>
            <div style={css(`font-size: 14.5px; line-height: 1.55; color: #4B5C58; flex-grow: 1;`)}>{post.excerpt}</div>
            <div style={css(`font-size: 13px; color: #4B5C58; border-top: 1px solid #EEF2F0; padding-top: 12px;`)}>door <strong style={css(`color: #2C4A5E;`)}>{post.author}</strong> · {post.role}</div>
          </div>
        </React.Fragment>))}
      </div>
    </div>

    
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(32px, 6vw, 72px);`)}>
      <div style={css(`display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 32px; gap: 16px; flex-wrap: wrap;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;`)}>Vraag & antwoord</div>
        <div onClick={requireLogin} style={css(`cursor: pointer; padding: 11px 20px; background: #EAF4EE; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 14.5px;`)}>Stel een vraag</div>
      </div>
      <div style={css(`display: flex; flex-direction: column; gap: 14px;`)}>
        {((questions)||[]).map((q, $index) => (<React.Fragment key={$index}>
          <div style={css(`background: #FFFFFF; border-radius: 16px; padding: 22px 26px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;`)}>
            <div>
              <div style={css(`font-weight: 700; font-size: 16px; color: #2C4A5E; margin-bottom: 6px;`)}>{q.title}</div>
              <div style={css(`font-size: 13.5px; color: #4B5C58;`)}>gesteld door {q.author} · {q.role}</div>
            </div>
            <div style={css(`display: flex; align-items: center; gap: 8px; background: #EAF1F6; padding: 8px 14px; border-radius: 999px; white-space: nowrap;`)}>
              <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 14px;`)}>{q.answers}</div>
              <div style={css(`font-size: 13px; color: #4B5C58;`)}>antwoorden</div>
            </div>
          </div>
        </React.Fragment>))}
      </div>
    </div>

    
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(32px, 6vw, 72px);`)}>
      <div style={css(`font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E; margin-bottom: 32px;`)}>Leden & contact</div>
      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;`)}>
        {((members)||[]).map((member, $index) => (<React.Fragment key={$index}>
          <div style={css(`background: #FFFFFF; border-radius: 18px; padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;`)}>
            <div style={css(`width: 56px; height: 56px; border-radius: 50%; background: repeating-linear-gradient(135deg, #A9C9DE, #A9C9DE 6px, #C6DDEA 6px, #C6DDEA 12px);`)}></div>
            <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 15px;`)}>{member.name}</div>
            <div style={css(`font-size: 13px; color: #4B5C58;`)}>{member.role}</div>
            {(isLoggedIn) ? (<>
              <div style={css(`font-size: 12.5px; color: #4E9A6C; font-weight: 700;`)}>{member.email}</div>
            </>) : null}
            {(hideContact) ? (<>
              <div onClick={requireLogin} style={css(`cursor: pointer; font-size: 12.5px; color: #8FA09B;`)}>Log in voor contact</div>
            </>) : null}
          </div>
        </React.Fragment>))}
      </div>
    </div>

    
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`background: #A8D5BA; border-radius: 26px; padding: clamp(22px, 4vw, 48px);`)}>
        <div style={css(`display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; gap: 16px; flex-wrap: wrap;`)}>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E;`)}>Relevante vacatures</div>
          <div onClick={goVacatures} style={css(`cursor: pointer; font-weight: 700; color: #2C4A5E; font-size: 14.5px;`)}>Bekijk alle vacatures →</div>
        </div>
        <div style={css(`font-size: 14.5px; color: #2C4A5E; opacity: 0.85; margin-bottom: 24px;`)}>Actuele functies voor relatiemanagers, fondsenwervers en development-functies bij ngo's en goede doelen in Nederland. Controleer de status via de link, vacatures kunnen inmiddels zijn vervuld.</div>
        <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;`)}>
          {((vacancies)||[]).map((v, $index) => (<React.Fragment key={$index}>
            <a href={v.url} target="_blank" rel="noopener" style={css(`background: #FFFFFF; border-radius: 14px; padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;`)}>
              <div style={css(`display: flex; align-items: center; justify-content: space-between; gap: 12px;`)}>
                <div style={css(`font-weight: 700; color: #2C4A5E; font-size: 15.5px;`)}>{v.title}</div>
                <div style={css(`font-size: 12px; color: #FFFFFF; background: #4E9A6C; padding: 3px 10px; border-radius: 999px; font-weight: 700; white-space: nowrap;`)}>{v.type}</div>
              </div>
              <div style={css(`font-size: 13.5px; color: #4B5C58;`)}>{v.org} · {v.location}</div>
              <div style={css(`display: flex; flex-wrap: wrap; gap: 6px;`)}>
                {((v.tags)||[]).map((tag, $index) => (<React.Fragment key={$index}>
                  <div style={css(`font-size: 11.5px; font-weight: 700; color: #2C4A5E; background: #EAF1F6; padding: 3px 10px; border-radius: 999px;`)}>{tag}</div>
                </React.Fragment>))}
              </div>
            </a>
          </React.Fragment>))}
        </div>
      </div>
    </div>
    
    <div style={css(`max-width: 1180px; margin: -32px auto 0; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`background: #FFFFFF; border: 1.5px solid #E1EAE4; border-radius: 24px; padding: 36px clamp(20px, 4vw, 44px); display: flex; align-items: center; gap: 30px; flex-wrap: wrap;`)}>
        <img src="/uploads/kompas-logo.png" alt="Subsidie Kompas logo" style={css(`width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0; display: block;`)} />
        <div style={css(`flex-grow: 1; min-width: 240px;`)}>
          <div style={css(`font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;`)}>Subsidie Kompas</div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; margin-bottom: 6px;`)}>Uw vaste hulp bij elke aanvraag</div>
          <div style={css(`font-size: 15px; line-height: 1.6; color: #4B5C58; max-width: 560px;`)}>Sneller matchen, deadlines bewaken en aanvragen onderbouwen, naast uw eigen vakkennis.</div>
        </div>
        <a href="#/subsidie-kompas" style={css(`padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;`)}>Probeer Subsidie Kompas →</a>
      </div>
    </div>
  </div>
  </>) : null}

  
  </>);
}
