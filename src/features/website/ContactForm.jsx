import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function ContactForm() {
  const app = useApp();

  const {
    isContact,
    goNetwerk,
    contactForm,
    contactSent,
    contactFormOpen,
    onContactName,
    onContactEmail,
    onContactSubject,
    onContactMessage,
    sendContact,
  } = app;

  const handleSubmit = (event) => {
    event.preventDefault();
    sendContact();
  };

  return (
    <>
      {isContact ? (
        <div data-screen-label="Contact">
          <div
            style={css(
              `max-width: 1180px; margin: 0 auto; padding: 56px 32px 24px;`
            )}
          >
            <div
              style={css(
                `font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px;`
              )}
            >
              Contact
            </div>

            <div
              style={css(
                `font-family: 'Newsreader', serif; font-size: clamp(25px, 5vw, 40px); font-weight: 600; color: #2C4A5E; line-height: 1.2; max-width: 720px;`
              )}
            >
              Neem contact op met het Collectief
            </div>

            <div
              style={css(
                `font-size: 17px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin-top: 16px;`
              )}
            >
              Heeft u een vraag over fondsenwerving, subsidies, lidmaatschap of
              samenwerking? Laat een bericht achter, dan nemen we binnen enkele
              werkdagen contact met u op.
            </div>
          </div>

          <div
            style={css(
              `max-width: 1180px; margin: 0 auto; padding: 8px 32px clamp(32px, 6vw, 72px); display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; align-items: stretch;`
            )}
          >
            <div
              style={css(
                `background: #FFFFFF; border: 1px solid #E1EAE4; border-radius: 24px; padding: 40px; box-shadow: 0 12px 40px rgba(44,74,94,0.06);`
              )}
            >
              {contactSent ? (
                <div
                  style={css(
                    `display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px 8px;`
                  )}
                >
                  <div
                    style={css(
                      `width: 64px; height: 64px; border-radius: 50%; background: #EAF4EE; display: flex; align-items: center; justify-content: center; font-size: clamp(22px, 3.8vw, 30px); color: #4E9A6C; margin-bottom: 20px;`
                    )}
                  >
                    ✓
                  </div>

                  <div
                    style={css(
                      `font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`
                    )}
                  >
                    Bedankt voor uw bericht
                  </div>

                  <div
                    style={css(
                      `font-size: 15.5px; line-height: 1.6; color: #4B5C58; max-width: 380px;`
                    )}
                  >
                    We hebben uw bericht ontvangen en nemen binnen enkele
                    werkdagen contact met u op via het opgegeven e-mailadres.
                  </div>
                </div>
              ) : null}

              {contactFormOpen ? (
                <form onSubmit={handleSubmit}>
                  <div
                    style={css(
                      `display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-bottom: 18px;`
                    )}
                  >
                    <div>
                      <label
                        htmlFor="contact-name"
                        style={css(
                          `display: block; font-size: 13.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 7px;`
                        )}
                      >
                        Naam
                      </label>

                      <input
                        id="contact-name"
                        type="text"
                        name="name"
                        value={contactForm.name}
                        onChange={onContactName}
                        placeholder="Uw naam"
                        autoComplete="name"
                        required
                        style={css(
                          `width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid #D6E2DB; font-size: 15px; font-family: 'Mulish', sans-serif; color: #2E3A38; background: #FBFDFC;`
                        )}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contact-email"
                        style={css(
                          `display: block; font-size: 13.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 7px;`
                        )}
                      >
                        E-mailadres
                      </label>

                      <input
                        id="contact-email"
                        type="email"
                        name="email"
                        value={contactForm.email}
                        onChange={onContactEmail}
                        placeholder="uw@email.nl"
                        autoComplete="email"
                        required
                        style={css(
                          `width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid #D6E2DB; font-size: 15px; font-family: 'Mulish', sans-serif; color: #2E3A38; background: #FBFDFC;`
                        )}
                      />
                    </div>
                  </div>

                  <div style={css(`margin-bottom: 18px;`)}>
                    <label
                      htmlFor="contact-subject"
                      style={css(
                        `display: block; font-size: 13.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 7px;`
                      )}
                    >
                      Onderwerp
                    </label>

                    <input
                      id="contact-subject"
                      type="text"
                      name="subject"
                      value={contactForm.subject}
                      onChange={onContactSubject}
                      placeholder="Waar gaat uw vraag over?"
                      required
                      style={css(
                        `width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid #D6E2DB; font-size: 15px; font-family: 'Mulish', sans-serif; color: #2E3A38; background: #FBFDFC;`
                      )}
                    />
                  </div>

                  <div style={css(`margin-bottom: 22px;`)}>
                    <label
                      htmlFor="contact-message"
                      style={css(
                        `display: block; font-size: 13.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 7px;`
                      )}
                    >
                      Bericht
                    </label>

                    <textarea
                      id="contact-message"
                      name="message"
                      value={contactForm.message}
                      onChange={onContactMessage}
                      placeholder="Uw bericht"
                      rows={6}
                      required
                      style={css(
                        `width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid #D6E2DB; font-size: 15px; font-family: 'Mulish', sans-serif; color: #2E3A38; background: #FBFDFC; resize: vertical; line-height: 1.5;`
                      )}
                    />
                  </div>

                  <button
                    type="submit"
                    style={css(
                      `cursor: pointer; display: inline-block; padding: 14px 32px; background: #4E9A6C; color: #FFFFFF; border: none; border-radius: 999px; font-weight: 700; font-size: 15.5px; font-family: 'Mulish', sans-serif;`
                    )}
                  >
                    Bericht versturen
                  </button>
                </form>
              ) : null}
            </div>

            <div
              style={css(
                `display: flex; flex-direction: column; gap: 24px;`
              )}
            >
              <div
                style={css(
                  `background: #EAF4EE; border-radius: 24px; padding: 32px; flex: 1;`
                )}
              >
                <div
                  style={css(
                    `font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`
                  )}
                >
                  Snel een antwoord?
                </div>

                <div
                  style={css(
                    `font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 18px;`
                  )}
                >
                  Voor veel vragen over fondsen, subsidies en de werking van het
                  platform helpt Subsidie Kompas u direct verder.
                </div>

                <a
                  href="#/subsidie-kompas"
                  style={css(
                    `display: inline-block; padding: 12px 24px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 14.5px;`
                  )}
                >
                  Open Subsidie Kompas →
                </a>
              </div>

              <div
                style={css(
                  `background: #EAF1F6; border-radius: 24px; padding: 32px; flex: 1;`
                )}
              >
                <div
                  style={css(
                    `font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 10px;`
                  )}
                >
                  Benieuwd naar het Collectief?
                </div>

                <div
                  style={css(
                    `font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 18px;`
                  )}
                >
                  Ontdek wat het Collectief u biedt: netwerk, intervisie,
                  kennisdeling en vacatures.
                </div>

                <button
                  type="button"
                  onClick={goNetwerk}
                  style={css(
                    `cursor: pointer; display: inline-block; padding: 12px 24px; background: #2C4A5E; color: #FFFFFF; border: none; border-radius: 999px; font-weight: 700; font-size: 14.5px; font-family: 'Mulish', sans-serif;`
                  )}
                >
                  Naar het Collectief →
                </button>
              </div>
            </div>

            <div
              style={css(
                `grid-column: 1 / -1; background: #FFFFFF; border: 1px solid #E1EAE4; border-radius: 24px; padding: 32px clamp(18px, 4vw, 40px); box-shadow: 0 12px 40px rgba(44,74,94,0.06);`
              )}
            >
              <div
                style={css(
                  `font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; margin-bottom: 22px;`
                )}
              >
                Gegevens
              </div>

              <div
                style={css(
                  `display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 28px 40px;`
                )}
              >
                <div>
                  <div
                    style={css(
                      `font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;`
                    )}
                  >
                    Postadres
                  </div>

                  <div
                    style={css(
                      `font-size: 15px; line-height: 1.6; color: #4B5C58;`
                    )}
                  >
                    Sophialaan 34H, 1075BS Amsterdam
                  </div>
                </div>

                <div>
                  <div
                    style={css(
                      `font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;`
                    )}
                  >
                    E-mail
                  </div>

                  <div
                    style={css(
                      `font-size: 15px; line-height: 1.6; color: #4B5C58;`
                    )}
                  >
                    <a
                      href="mailto:info@fondsenwerverscollectief.nl"
                      style={css(`color: #4B5C58;`)}
                    >
                      info@fondsenwerverscollectief.nl
                    </a>
                  </div>
                </div>

                <div>
                  <div
                    style={css(
                      `font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;`
                    )}
                  >
                    KvK-nummer
                  </div>

                  <div
                    style={css(
                      `font-size: 15px; line-height: 1.6; color: #4B5C58;`
                    )}
                  >
                    95841784
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
