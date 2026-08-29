import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function ArticlePage() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>

  {(isArticle) ? (<>
  <div data-screen-label="Artikel">
    <div style={css(`max-width: 760px; margin: 0 auto; padding: 48px 32px 20px;`)}>
      <div onClick={goActueel} style={css(`cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 14.5px; margin-bottom: 26px;`)}>← Terug naar Actueel</div>
      <div style={css(`font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px;`)}>{article.tag} · {article.date}</div>
      <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(24px, 4.8vw, 38px); font-weight: 600; color: #2C4A5E; line-height: 1.22;`)}>{article.title}</div>
    </div>
    <div style={css(`max-width: 760px; margin: 0 auto; padding: 8px 32px 40px;`)}>
      {((article.blocks)||[]).map((block, $index) => (<React.Fragment key={$index}>
        {(block.isHeading) ? (<>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; margin: 34px 0 12px;`)}>{block.text}</div>
        </>) : null}
        {(block.isParagraph) ? (<>
          <div style={css(`font-size: 16.5px; line-height: 1.75; color: #3E4E4A; margin-bottom: 16px;`)}>{block.text}</div>
        </>) : null}
      </React.Fragment>))}
      <div style={css(`font-size: 13.5px; font-style: italic; color: #8FA09B; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E1EAE4;`)}>Bron: {article.source}</div>
      <div onClick={goActueel} style={css(`cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 14.5px; margin-top: 30px;`)}>← Terug naar Actueel</div>
    </div>
  </div>
  </>) : null}

  
  </>);
}
