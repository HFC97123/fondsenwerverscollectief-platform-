import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function Chat() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>

  <div style={css(`position: fixed; bottom: 20px; right: 20px; z-index: 200; font-family: 'Mulish', sans-serif;`)}>

    {(chatOpen) ? (<>
      <div style={css(`width: 340px; max-width: calc(100vw - 40px); height: 480px; max-height: calc(100vh - 132px); background: #FFFFFF; border-radius: 20px; box-shadow: 0 14px 44px rgba(44,74,94,0.28); display: flex; flex-direction: column; overflow: hidden; position: absolute; bottom: 72px; right: 0;`)}>

        <div style={css(`background: #2C4A5E; padding: 14px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;`)}>
          <div style={css(`width: 34px; height: 34px; border-radius: 50%; background: #4E9A6C; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 700; font-size: 13.5px; flex-shrink: 0;`)}>C</div>
          <div style={css(`flex-grow: 1; min-width: 0;`)}>
            <div style={css(`color: #FFFFFF; font-weight: 700; font-size: 14px;`)}>Collie</div>
            <div style={css(`display: flex; align-items: center; gap: 6px;`)}>
              <div style={css(`width: 6px; height: 6px; border-radius: 50%; background: #A8D5BA; flex-shrink: 0;`)}></div>
              <div style={css(`color: #A9C9DE; font-size: 11.5px;`)}>Stel gerust je vraag</div>
            </div>
          </div>
          <div onClick={clearChat} title="Gesprek opnieuw starten" role="button" aria-label="Gesprek opnieuw starten" style={css(`cursor: pointer; color: #A9C9DE; font-size: 15px; padding: 4px 6px;`)}>↺</div>
          <div onClick={toggleChat} role="button" aria-label="Chat sluiten" style={css(`cursor: pointer; color: #FFFFFF; font-size: 20px; line-height: 1; padding: 2px 6px;`)}>×</div>
        </div>

        <div ref={chatScrollRef} style={css(`flex-grow: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 9px; background: #F7F9F8;`)}>
          {((chatMessages)||[]).map((m, $index) => (<React.Fragment key={$index}>
            {(m.fromBot) ? (<>
              <div style={css(`align-self: flex-start; max-width: 88%; background: #EAF4EE; color: #2E3A38; padding: 9px 13px; border-radius: 14px 14px 14px 3px; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap;`)}>{m.text}</div>
            </>) : null}
            {(m.fromUser) ? (<>
              <div style={css(`align-self: flex-end; max-width: 88%; background: #2C4A5E; color: #FFFFFF; padding: 9px 13px; border-radius: 14px 14px 3px 14px; font-size: 13.5px; line-height: 1.5;`)}>{m.text}</div>
            </>) : null}
          </React.Fragment>))}

          {(chatLoading) ? (<>
            <div style={css(`align-self: flex-start; background: #EAF4EE; padding: 9px 13px; border-radius: 14px 14px 14px 3px; display: flex; gap: 5px; align-items: center;`)}>
              <div style={css(`width: 6px; height: 6px; border-radius: 50%; background: #4E9A6C; opacity: 0.6;`)}></div>
              <div style={css(`width: 6px; height: 6px; border-radius: 50%; background: #4E9A6C; opacity: 0.8;`)}></div>
              <div style={css(`width: 6px; height: 6px; border-radius: 50%; background: #4E9A6C;`)}></div>
            </div>
          </>) : null}

          {(chatErrorMsg) ? (<>
            <div style={css(`align-self: flex-start; max-width: 88%; background: #FBEAEA; color: #8A3B3B; padding: 9px 13px; border-radius: 12px; font-size: 12.5px; line-height: 1.4;`)}>{chatErrorMsg}</div>
          </>) : null}

          {(isListening) ? (<>
            <div style={css(`align-self: center; font-size: 12px; color: #4E9A6C; font-weight: 700;`)}>Ik luister...</div>
          </>) : null}
          {(isSpeaking) ? (<>
            <div onClick={stopSpeaking} role="button" style={css(`align-self: center; cursor: pointer; font-size: 12px; color: #4E9A6C; font-weight: 700;`)}>Spreekt... (klik om te stoppen)</div>
          </>) : null}
        </div>

        <div style={css(`padding: 10px 12px; border-top: 1px solid #E1EAE4; display: flex; align-items: flex-end; gap: 8px; background: #FFFFFF;`)}>
          {(micSupported) ? (<>
            <div onClick={toggleListening} title="Spreek uw vraag in" role="button" aria-label="Spreek uw vraag in" style={css(`cursor: pointer; width: 34px; height: 34px; border-radius: 50%; background: ${micButtonBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="2" width="6" height="12" rx="3" fill="#2C4A5E"></rect>
                <path d="M5 11a7 7 0 0 0 14 0" stroke="#2C4A5E" strokeWidth="2" strokeLinecap="round"></path>
                <path d="M12 18v3" stroke="#2C4A5E" strokeWidth="2" strokeLinecap="round"></path>
                <path d="M9 21h6" stroke="#2C4A5E" strokeWidth="2" strokeLinecap="round"></path>
              </svg>
            </div>
          </>) : null}
          <textarea value={chatDraft} onChange={onChatDraftChange} onKeyDown={onChatKeyDown} placeholder="Typ je vraag..." rows="1" aria-label="Typ uw vraag voor de assistent" style={css(`flex-grow: 1; resize: none; border: 1.5px solid #E1EAE4; border-radius: 12px; outline: none; font-family: 'Mulish', sans-serif; font-size: 13.5px; line-height: 1.4; padding: 8px 10px; max-height: 90px; background: #F7F9F8; color: #2E3A38;`)}></textarea>
          <div onClick={sendChatMessage} role="button" aria-label="Verstuur bericht" style={css(`cursor: pointer; width: 34px; height: 34px; border-radius: 50%; background: #4E9A6C; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`)}>
            <div style={css(`width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 9px solid #FFFFFF; margin-left: 2px;`)}></div>
          </div>
        </div>

        <div style={css(`padding: 7px 14px 10px; font-size: 10px; line-height: 1.4; color: #8FA09B; text-align: center;`)}>
          Door deze chat te gebruiken ga je akkoord met verwerking van je bericht om je vraag te beantwoorden. Deel geen gevoelige persoonsgegevens. <a href="#" style={css(`color: #8FA09B; text-decoration: underline;`)}>Privacybeleid</a>
        </div>
      </div>
    </>) : null}

    <div onClick={toggleChat} role="button" aria-label="Open chat met de assistent" tabIndex="0" style={css(`width: 58px; height: 58px; border-radius: 50%; background: #4E9A6C; box-shadow: 0 6px 20px rgba(44,74,94,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; animation: fw-pulse 2.6s ease-in-out infinite;`)}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H9l-4 3.5v-3.5H5.5C4.67 15.5 4 14.83 4 14v-8.5Z" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round"></path>
        <circle cx="8.5" cy="9.5" r="1" fill="#FFFFFF"></circle>
        <circle cx="12" cy="9.5" r="1" fill="#FFFFFF"></circle>
        <circle cx="15.5" cy="9.5" r="1" fill="#FFFFFF"></circle>
      </svg>
    </div>
  </div>


  </>);
}
