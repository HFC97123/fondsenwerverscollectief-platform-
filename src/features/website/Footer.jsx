import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';
import Newsletter from './Newsletter.jsx';

export default function Footer() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>

  <div style={css(`background: #21384A; background-image: linear-gradient(180deg, #21384A 0%, #1B2F3E 100%); border-top: 3px solid #4E9A6C;`)}>
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: clamp(31px, 6vw, 68px) 32px 44px; display: grid; grid-template-columns: 1.5fr 1fr 1fr 1.3fr; gap: 48px;`)}>
      <div>
        <div style={css(`display: flex; align-items: center; gap: 12px; margin-bottom: 16px;`)}>
          <img src="/uploads/collectief-logo-white.png" alt="Het Fondsenwervers Collectief logo" style={css(`width: 46px; height: 46px; object-fit: contain; flex-shrink: 0;`)} />
          <div style={css(`font-family: 'Newsreader', serif; font-weight: 600; font-size: 19px; color: #FFFFFF; line-height: 1.25;`)}>Het Fondsenwervers<br />Collectief</div>
        </div>
        <div style={css(`font-size: 14.5px; line-height: 1.65; color: #A9C9DE; max-width: 270px;`)}>Het kennisplatform voor fondsenwerving en subsidies, voor en door fondsenwervers.</div>
      </div>
      <div>
        <div style={css(`font-size: 12px; font-weight: 700; color: #7FA6BC; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 18px;`)}>Platform</div>
        <div style={css(`display: flex; flex-direction: column; gap: 12px;`)}>
          <div onClick={goActueel} style={css(`cursor: pointer; color: #CFE0EB; font-size: 14.5px; transition: color 0.15s;`)} className="fw-h2">Actueel</div>
          <a href="#/subsidie-kompas" style={css(`color: #CFE0EB; font-size: 14.5px;`)} className="fw-h3">Subsidie Kompas</a>
          <div onClick={goNetwerk} style={css(`cursor: pointer; color: #CFE0EB; font-size: 14.5px;`)} className="fw-h4">Collectief</div>
          <div onClick={goContact} style={css(`cursor: pointer; color: #CFE0EB; font-size: 14.5px;`)} className="fw-h5">Contact</div>
        </div>
      </div>
      <div>
        <div style={css(`font-size: 12px; font-weight: 700; color: #7FA6BC; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 18px;`)}>Voor wie</div>
        <div style={css(`display: flex; flex-direction: column; gap: 12px;`)}>
          <div onClick={goFellow} style={css(`cursor: pointer; color: #CFE0EB; font-size: 14.5px;`)} className="fw-h6">Fondsenwervers</div>
          <div onClick={goOrg} style={css(`cursor: pointer; color: #CFE0EB; font-size: 14.5px;`)} className="fw-h7">Organisaties</div>
          <div onClick={goOrient} style={css(`cursor: pointer; color: #CFE0EB; font-size: 14.5px;`)} className="fw-h8">Fondsenwerver worden</div>
        </div>
      </div>
      <Newsletter />
    </div>
    <div style={css(`border-top: 1px solid rgba(255,255,255,0.09); max-width: 1180px; margin: 0 auto; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #7C97A6; flex-wrap: wrap; gap: 12px;`)}>
      <div>© 2026 Het Fondsenwervers Collectief</div>
      <div style={css(`display: flex; gap: 24px;`)}>
        <a href="#/privacy" style={css(`color: #7C97A6;`)} className="fw-h9">Privacy</a>
        <a href="#/voorwaarden" style={css(`color: #7C97A6;`)} className="fw-h10">Voorwaarden</a>
        <a href="#" onClick={goContact} style={css(`color: #7C97A6;`)} className="fw-h11">Contact</a>
      </div>
    </div>
  </div>

  
  </>);
}
