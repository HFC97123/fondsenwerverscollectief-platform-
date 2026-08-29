import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function Newsletter() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>
<div>
        <div style={css(`font-size: 12px; font-weight: 700; color: #7FA6BC; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 18px;`)}>Blijf op de hoogte</div>
        <div style={css(`font-size: 14px; color: #A9C9DE; margin-bottom: 16px; line-height: 1.6;`)}>Maandelijks het laatste nieuws over fondsen en subsidies in uw inbox.</div>
        <div style={css(`display: flex; gap: 8px; background: rgba(255,255,255,0.06); padding: 6px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);`)}>
          <input type="email" placeholder="uw@email.nl" style={css(`flex-grow: 1; min-width: 0; padding: 10px 14px; border-radius: 9px; border: none; font-size: 14px; background: transparent; color: #FFFFFF; font-family: 'Mulish', sans-serif;`)} />
          <a href="#" style={css(`padding: 10px 20px; background: #A8D5BA; color: #21384A; border-radius: 9px; font-weight: 700; font-size: 14px; white-space: nowrap;`)} className="fw-h12">Aanmelden</a>
        </div>
      </div>
  </>);
}
