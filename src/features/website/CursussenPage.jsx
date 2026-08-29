import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function CursussenPage() {
  const app = useApp();
  const { page, isHome, isFellow, isOrg, isOrient, isCursussen, isActueel, isArticle, article, openArticle, isNetwerk, isVacatures, isSubpage, goHome, goFellow, goOrg, goOrient, goCursussen, goActueel, goNetwerk, goVacatures, goContact, isContact, isLoggedIn, showAuthCta, isAuthLogin, isAuthRegister, showLogin, showRegister, regForm, onRegFirstName, onRegLastName, onRegEmail, onRegType, onRegMotivation, typeZzp, typeOrg, typeOrient, applicationSent, applicationOpen, submitApplication, contactForm, contactSent, contactFormOpen, onContactName, onContactEmail, onContactSubject, onContactMessage, sendContact, profileFullName, profileInitials, hideContact, chatOpen, toggleChat, clearChat, chatMessages, chatDraft, onChatDraftChange, onChatKeyDown, sendChatMessage, chatLoading, chatErrorMsg, chatScrollRef, micSupported, micButtonBg, toggleListening, isListening, isSpeaking, stopSpeaking, heroAnimationOn, profileName, emailDraft, onEmailChange, vacForm, memberVacancies, hasMemberVacancies, vacPosted, onVacTitle, onVacOrg, onVacLocation, onVacTag, submitVacancy, login, logout, requireLogin, resources, sessions, blogPosts, questions, members, vacancies, newsItems, allNewsItems, homeNews, testimonials, videos } = app;
  return (<>

  {(isCursussen) ? (<>
  <div data-screen-label="Cursussen">
    <div style={css(`max-width: 980px; margin: 0 auto; padding: 60px 32px 48px; text-align: center;`)}>
      <div style={css(`display: inline-block; padding: 7px 16px; border-radius: 999px; background: #F1EDE3; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;`)}>Cursussen & masterclasses</div>
      <div style={css(`font-family: 'Newsreader', serif; font-size: clamp(27px, 5.5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;`)}>Leer fondsenwerven, van basis tot verdieping</div>
      <div style={css(`font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;`)}>
        Van de eerste beginselen tot een verdiepende masterclass voor de gevorderde fondsenwerver. Onze cursussen zijn in ontwikkeling, laat u alvast informeren zodra ze starten.
      </div>
    </div>

    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px 40px;`)}>
      <div style={css(`background: #EAF4EE; border: 1px solid #DCEDE3; border-radius: 16px; padding: 18px 24px; display: flex; align-items: center; gap: 14px; justify-content: center; text-align: center;`)}>
        <div style={css(`font-size: 11.5px; font-weight: 700; color: #FFFFFF; background: #4E9A6C; padding: 4px 12px; border-radius: 999px; white-space: nowrap;`)}>{app.cursussenNoticeLabel}</div>
        <div style={css(`font-size: 15px; color: #2C4A5E; font-weight: 700;`)}>{app.cursussenNotice}</div>
      </div>
    </div>

    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;`)}>

        <div style={css(`background: #FFFFFF; border-radius: 24px; padding: 40px; display: flex; flex-direction: column;`)}>
          <div style={css(`display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;`)}>
            <div style={css(`font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em;`)}>Voor beginners</div>
            <div style={css(`font-size: 12px; font-weight: 700; color: #8A6D3B; background: #F1EDE3; padding: 4px 12px; border-radius: 999px;`)}>Binnenkort</div>
          </div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`)}>Basiscursus Fondsenwerving</div>
          <div style={css(`font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 22px;`)}>Leer stap voor stap alles wat u nodig heeft om zelfstandig fondsen te werven, van de eerste beginselen tot het verdiepen in strategie en relatiebeheer. Ideaal om iemand binnen uw organisatie volledig op te leiden.</div>
          <div style={css(`display: flex; flex-direction: column; gap: 12px; margin-bottom: 26px;`)}>
            <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}><div style={css(`width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-top: 7px; flex-shrink: 0;`)}></div><div style={css(`font-size: 14.5px; color: #2C4A5E;`)}>Het fondsenlandschap, soorten financiering en passende fondsen vinden</div></div>
            <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}><div style={css(`width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-top: 7px; flex-shrink: 0;`)}></div><div style={css(`font-size: 14.5px; color: #2C4A5E;`)}>Een projectplan, begroting en kansrijke aanvraag opstellen</div></div>
            <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}><div style={css(`width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-top: 7px; flex-shrink: 0;`)}></div><div style={css(`font-size: 14.5px; color: #2C4A5E;`)}>Strategie, meerjarige financiering en duurzame relaties met fondsen en donateurs</div></div>
          </div>
          <div style={css(`margin-top: auto; padding: 13px 26px; background: #EAF4EE; color: #4E9A6C; border-radius: 999px; font-weight: 700; font-size: 15px; text-align: center; align-self: flex-start;`)}>Nog niet beschikbaar</div>
        </div>

        <div style={css(`background: #FFFFFF; border-radius: 24px; padding: 40px; display: flex; flex-direction: column;`)}>
          <div style={css(`display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;`)}>
            <div style={css(`font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em;`)}>Voor gevorderden</div>
            <div style={css(`font-size: 12px; font-weight: 700; color: #8A6D3B; background: #F1EDE3; padding: 4px 12px; border-radius: 999px;`)}>Binnenkort</div>
          </div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`)}>Verdiepende Masterclass</div>
          <div style={css(`font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 22px;`)}>Masterclasses voor de ervaren fondsenwerver. Rond een actueel thema nodigen we een spreker uit en gaan we samen de diepte in. Elke masterclass staat op zichzelf, met een steeds wisselend onderwerp.</div>
          <div style={css(`display: flex; flex-direction: column; gap: 12px; margin-bottom: 26px;`)}>
            <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}><div style={css(`width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-top: 7px; flex-shrink: 0;`)}></div><div style={css(`font-size: 14.5px; color: #2C4A5E;`)}>Een actueel thema uit het vak, telkens anders</div></div>
            <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}><div style={css(`width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-top: 7px; flex-shrink: 0;`)}></div><div style={css(`font-size: 14.5px; color: #2C4A5E;`)}>Een gastspreker met ervaring uit de praktijk</div></div>
            <div style={css(`display: flex; gap: 11px; align-items: flex-start;`)}><div style={css(`width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-top: 7px; flex-shrink: 0;`)}></div><div style={css(`font-size: 14.5px; color: #2C4A5E;`)}>Verdieping en uitwisseling met vakgenoten</div></div>
          </div>
          <div style={css(`margin-top: auto; padding: 13px 26px; background: #EAF4EE; color: #4E9A6C; border-radius: 999px; font-weight: 700; font-size: 15px; text-align: center; align-self: flex-start;`)}>Nog niet beschikbaar</div>
        </div>

      </div>
    </div>

    {app.hasCourseModules ? (
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`margin-bottom: 28px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;`)}>Modules van de Basiscursus</div>
        <div style={css(`font-size: 15px; color: #4B5C58; margin-top: 6px;`)}>De opbouw van de cursus, module voor module.</div>
      </div>
      <div style={css(`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;`)}>
        {(app.courseModules||[]).map((m, $index) => (<React.Fragment key={$index}>
          <div style={css(`background: #FFFFFF; border-radius: 18px; padding: 26px; display: flex; flex-direction: column; gap: 12px;`)}>
            <div style={css(`display: flex; align-items: center; justify-content: space-between; gap: 12px;`)}>
              <div style={css(`font-size: 13px; font-weight: 700; color: #4E9A6C;`)}>Module {$index + 1}</div>
              {m.duration ? (<div style={css(`font-size: 11.5px; font-weight: 700; color: #2C4A5E; background: #EAF1F6; padding: 3px 9px; border-radius: 6px;`)}>{m.duration}</div>) : null}
            </div>
            <div style={css(`font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; color: #2C4A5E; line-height: 1.35;`)}>{m.title}</div>
            <div style={css(`font-size: 14.5px; line-height: 1.55; color: #4B5C58; flex-grow: 1;`)}>{m.description}</div>
            {m.videoUrl ? (<a href={m.videoUrl} target="_blank" rel="noopener noreferrer" style={css(`font-weight: 700; color: #2C4A5E; font-size: 14px;`)}>Bekijk de module →</a>) : null}
          </div>
        </React.Fragment>))}
      </div>
    </div>
    ) : null}

    {app.hasMasterclasses ? (
    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`margin-bottom: 28px;`)}>
        <div style={css(`font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;`)}>Komende masterclasses</div>
        <div style={css(`font-size: 15px; color: #4B5C58; margin-top: 6px;`)}>Verdieping rond een actueel thema, met een gastspreker uit de praktijk.</div>
      </div>
      <div style={css(`display: flex; flex-direction: column; gap: 14px;`)}>
        {(app.masterclasses||[]).map((mc, $index) => (<React.Fragment key={$index}>
          <div style={css(`background: #FFFFFF; border-radius: 16px; padding: 24px 26px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap;`)}>
            <div style={css(`flex-grow: 1; min-width: 220px;`)}>
              <div style={css(`font-size: 13px; font-weight: 700; color: #4E9A6C; margin-bottom: 6px;`)}>{[mc.theme, mc.date].filter(Boolean).join(' · ')}</div>
              <div style={css(`font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 6px;`)}>{mc.title}</div>
              <div style={css(`font-size: 14.5px; line-height: 1.55; color: #4B5C58;`)}>{mc.description}</div>
              <div style={css(`font-size: 13.5px; color: #4B5C58; margin-top: 8px;`)}>{[mc.speaker, mc.location, mc.price].filter(Boolean).join(' · ')}</div>
            </div>
            {mc.url ? (<a href={mc.url} target="_blank" rel="noopener noreferrer" style={css(`padding: 12px 24px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 14px; white-space: nowrap;`)}>Aanmelden</a>) : null}
          </div>
        </React.Fragment>))}
      </div>
    </div>
    ) : null}

    <div style={css(`max-width: 1180px; margin: 0 auto; padding: 0 32px clamp(34px, 6vw, 76px);`)}>
      <div style={css(`background: #2C4A5E; border-radius: 26px; padding: clamp(23px, 4vw, 52px); display: flex; align-items: center; justify-content: space-between; gap: 36px; flex-wrap: wrap;`)}>
        <div>
          <div style={css(`font-size: 13px; font-weight: 700; color: #A9C9DE; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;`)}>Blijf op de hoogte</div>
          <div style={css(`font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #FFFFFF; max-width: 520px; line-height: 1.4;`)}>Wilt u weten wanneer de cursussen starten? Laat het ons weten, dan houden we u op de hoogte.</div>
        </div>
        <div onClick={goOrient} style={css(`cursor: pointer; padding: 15px 30px; background: #A8D5BA; color: #2C4A5E; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;`)}>Bekijk eerst de video's →</div>
      </div>
    </div>
  </div>
  </>) : null}

  
  </>);
}
