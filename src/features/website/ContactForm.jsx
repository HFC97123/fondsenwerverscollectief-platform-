// Contactpagina. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Contact").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const veld = css(
  "width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid #D6E2DB; font-size: 15px; font-family: 'Mulish', sans-serif; color: #2E3A38; background: #FBFDFC;",
);

const veldLabel = css('font-size: 13.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 7px;');

const GEGEVENS = [
  { kop: 'Postadres', waarde: 'Sophialaan 34H, 1075BS Amsterdam' },
  { kop: 'E-mail', email: 'info@fondsenwerverscollectief.nl' },
  { kop: 'KvK-nummer', waarde: '95841784' },
];

export default function ContactForm() {
  const app = useApp();
  const {
    isContact,
    contactForm,
    contactSent,
    contactFormOpen,
    onContactName,
    onContactEmail,
    onContactSubject,
    onContactMessage,
    sendContact,
    goKompas,
    goNetwerk,
  } = app;

  if (!isContact) return null;

  const form = contactForm || {};

  return (
    <div data-screen-label="Contact">
      <div style={css('max-width: 1180px; margin: 0 auto; padding: clamp(34px, 5.5vw, 56px) clamp(16px, 4vw, 32px) 24px;')}>
        <div
          style={css(
            'font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px;',
          )}
        >
          Contact
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(28px, 4.6vw, 40px); font-weight: 600; color: #2C4A5E; line-height: 1.2; max-width: 720px;",
          )}
        >
          Neem contact op met het Collectief
        </div>
        <div style={css('font-size: 17px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin-top: 16px;')}>
          Heeft u een vraag over fondsenwerving, subsidies, lidmaatschap of samenwerking? Laat een bericht achter, dan
          nemen we binnen enkele werkdagen contact met u op.
        </div>
      </div>

      <div
        style={css(
          'max-width: 1180px; margin: 0 auto; padding: 8px clamp(16px, 4vw, 32px) clamp(44px, 6vw, 72px); display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; align-items: stretch;',
        )}
      >
        {/* FORMULIER */}
        <div
          style={css(
            'background: #FFFFFF; border: 1px solid #E1EAE4; border-radius: 24px; padding: clamp(22px, 3.5vw, 40px); box-shadow: 0 12px 40px rgba(44,74,94,0.06);',
          )}
        >
          {contactSent && (
            <div style={css('display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px 8px;')}>
              <div
                style={css(
                  'width: 64px; height: 64px; border-radius: 50%; background: #EAF4EE; display: flex; align-items: center; justify-content: center; font-size: clamp(24px, 3.4vw, 30px); color: #4E9A6C; margin-bottom: 20px;',
                )}
              >
                ✓
              </div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;")}>
                Bedankt voor uw bericht
              </div>
              <div style={css('font-size: 15.5px; line-height: 1.6; color: #4B5C58; max-width: 380px;')}>
                We hebben uw bericht ontvangen en nemen binnen enkele werkdagen contact met u op via het opgegeven
                e-mailadres.
              </div>
            </div>
          )}

          {contactFormOpen && (
            <>
              <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 18px; margin-bottom: 18px;')}>
                <div>
                  <div style={veldLabel}>Naam</div>
                  <input value={form.name || ''} onChange={onContactName} placeholder="Uw naam" style={veld} />
                </div>
                <div>
                  <div style={veldLabel}>E-mailadres</div>
                  <input value={form.email || ''} onChange={onContactEmail} placeholder="uw@email.nl" style={veld} />
                </div>
              </div>

              <div style={css('margin-bottom: 18px;')}>
                <div style={veldLabel}>Onderwerp</div>
                <input value={form.subject || ''} onChange={onContactSubject} placeholder="Waar gaat uw vraag over?" style={veld} />
              </div>

              <div style={css('margin-bottom: 22px;')}>
                <div style={veldLabel}>Bericht</div>
                <textarea
                  value={form.message || ''}
                  onChange={onContactMessage}
                  placeholder="Uw bericht"
                  rows="6"
                  style={{ ...veld, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div
                onClick={sendContact}
                style={css(
                  'cursor: pointer; display: inline-block; padding: 14px 32px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15.5px;',
                )}
              >
                Bericht versturen
              </div>
            </>
          )}
        </div>

        {/* LOSSE VAKKEN */}
        <div style={css('display: flex; flex-direction: column; gap: 24px;')}>
          <div style={css('background: #EAF4EE; border-radius: 24px; padding: 32px; flex: 1;')}>
            <div style={css("font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;")}>
              Snel een antwoord?
            </div>
            <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 18px;')}>
              Voor veel vragen over fondsen, subsidies en de werking van het platform helpt Subsidie Kompas u direct
              verder.
            </div>
            <a
              href="#"
              onClick={goKompas}
              style={css(
                'display: inline-block; padding: 12px 24px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 14.5px;',
              )}
            >
              Open Subsidie Kompas →
            </a>
          </div>

          <div style={css('background: #EAF1F6; border-radius: 24px; padding: 32px; flex: 1;')}>
            <div style={css("font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;")}>
              Benieuwd naar het Collectief?
            </div>
            <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 18px;')}>
              Ontdek wat het Collectief u biedt: netwerk, intervisie, kennisdeling en vacatures.
            </div>
            <div
              onClick={goNetwerk}
              style={css(
                'cursor: pointer; display: inline-block; padding: 12px 24px; background: #2C4A5E; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 14.5px;',
              )}
            >
              Naar het Collectief →
            </div>
          </div>
        </div>

        {/* GEGEVENS */}
        <div
          style={css(
            'grid-column: 1 / -1; background: #FFFFFF; border: 1px solid #E1EAE4; border-radius: 24px; padding: clamp(22px, 3.5vw, 32px) clamp(20px, 4vw, 40px); box-shadow: 0 12px 40px rgba(44,74,94,0.06);',
          )}
        >
          <div style={css("font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 22px;")}>
            Gegevens
          </div>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 28px 40px;')}>
            {GEGEVENS.map((g) => (
              <div key={g.kop}>
                <div
                  style={css(
                    'font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;',
                  )}
                >
                  {g.kop}
                </div>
                <div style={css('font-size: 15px; line-height: 1.6; color: #4B5C58;')}>
                  {g.email ? (
                    <a href={`mailto:${g.email}`} style={css('color: #4B5C58;')}>
                      {g.email}
                    </a>
                  ) : (
                    g.waarde
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
