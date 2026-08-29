import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function ActueelPage() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>

  {(isActueel) ? (<>
  <div data-screen-label="Actueel">
    <div style={css(`max-width: 980px; margin: 0 auto; padding: 60px 32px 56px; text-align: center;`)}>
      <div style={css(`display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;`)}>{app.actueelEyebrow}</div>
      <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(27px, 5.5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;`)}>{app.actueelTitle}</div>
      <div style={css(`font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;`)}>
        {app.actueelIntro}
      </div>
    </div>

    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 28px;`)}>
        {((allNewsItems)||[]).map((item, $index) => (<React.Fragment key={$index}>
          <div onClick={item.open} style={css(`cursor: pointer; background: #FFFFFF; border-radius: 18px; padding: 28px; display: flex; flex-direction: column; gap: 12px;`)} className="fw-h1">
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
