import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function FellowPage() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>
{(isFellow) ? (<>
  <div data-screen-label="Voor fondsenwervers">
    <div style={css(`max-width: 980px; margin: 0 auto; padding: 60px 32px 60px; text-align: center;`)}>
      <div style={css(`display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;`)}>Voor fondsenwervers</div>
      <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(27px, 5.5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;`)}>Professionalisering en verdieping voor fondsenwervers</div>
      <div style={css(`font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;`)}>Professionaliseer uw werk, deel vakkennis uit en breid uw netwerk uit. Gebruik Subsidie Kompas als betrouwbaar hulpmiddel in uw dagelijkse praktijk.</div>
    </div>

    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(32px, 6vw, 72px); display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;`)}>
      <div style={css(`background: #FFFFFF; border-radius: 20px; padding: 32px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`)}>Vakkennis & verdieping</div>
        <div style={css(`font-size: 15.5px; line-height: 1.6; color: #4B5C58; margin-bottom: 14px;`)}>Nieuws, verdiepende artikelen en actuele regelgeving, voor en door fondsenwervers.</div>
        <div onClick={goActueel} style={css(`cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;`)}>Naar de actueel-pagina →</div>
      </div>
      <div style={css(`background: #FFFFFF; border-radius: 20px; padding: 32px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`)}>Collectief</div>
        <div style={css(`font-size: 15.5px; line-height: 1.6; color: #4B5C58; margin-bottom: 14px;`)}>Netwerk, intervisie, praktijkgidsen en kant-en-klare templates. Leer van elkaars aanvragen, afwijzingen en toekenningen.</div>
        <div onClick={goNetwerk} style={css(`cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;`)}>Naar het Collectief →</div>
      </div>
      <div style={css(`background: #FFFFFF; border-radius: 20px; padding: 32px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`)}>Subsidie Kompas in uw werk</div>
        <div style={css(`font-size: 15.5px; line-height: 1.6; color: #4B5C58; margin-bottom: 14px;`)}>Gebruik Subsidie Kompas om sneller te matchen, deadlines te bewaken en aanvragen te onderbouwen, naast uw eigen vakkennis.</div>
        <a href="#/subsidie-kompas" style={css(`font-weight: 700; color: #4E9A6C; font-size: 15px;`)}>Probeer Subsidie Kompas →</a>
      </div>
    </div>

  </div>
  </>) : null}

  
  </>);
}
