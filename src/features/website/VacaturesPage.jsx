// Vacatures en oproepen. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Vacatures").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const veld = css(
  "padding: 12px 16px; border-radius: 12px; border: 1.5px solid #DCEDE3; font-size: 14.5px; font-family: 'Mulish', sans-serif; outline: none; background: #FFFFFF;",
);

const sectieKop = css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; margin-bottom: 20px;");

function Labels({ tags }) {
  return (
    <div style={css('display: flex; flex-wrap: wrap; gap: 6px;')}>
      {(tags || []).map((tag) => (
        <div
          key={tag}
          style={css('font-size: 11.5px; font-weight: 700; color: #2C4A5E; background: #EAF1F6; padding: 3px 10px; border-radius: 999px;')}
        >
          {tag}
        </div>
      ))}
    </div>
  );
}

export default function VacaturesPage() {
  const app = useApp();
  const {
    isVacatures,
    isLoggedIn,
    hideContact,
    goNetwerk,
    vacForm,
    onVacTitle,
    onVacOrg,
    onVacLocation,
    onVacTag,
    submitVacancy,
    vacPosted,
    memberVacancies,
    hasMemberVacancies,
    vacancies,
  } = app;

  if (!isVacatures) return null;

  return (
    <div data-screen-label="Vacatures">
      <div
        style={css(
          'max-width: 980px; margin: 0 auto; padding: clamp(36px, 6vw, 60px) clamp(16px, 4vw, 32px) clamp(26px, 4vw, 40px); text-align: center;',
        )}
      >
        <div
          style={css(
            'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; margin-bottom: 26px;',
          )}
        >
          Vacatures &amp; oproepen
        </div>
        <div
          style={css(
            "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.2; margin-bottom: 20px;",
          )}
        >
          Werk in fondsenwerving
        </div>
        <div style={css('font-size: 18px; line-height: 1.6; color: #4B5C58; max-width: 640px; margin: 0 auto;')}>
          Alle actuele functies voor relatiemanagers, fondsenwervers en development-functies bij ngo's en goede doelen
          op één plek. Leden van het Collectief plaatsen hier zelf ook vacatures en oproepen voor de sector.
        </div>
      </div>

      {/* PLAATS ZELF */}
      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 40px;')}>
        {isLoggedIn && (
          <div style={css('background: #EAF4EE; border-radius: 24px; padding: clamp(24px, 4vw, 40px) clamp(20px, 4vw, 44px);')}>
            <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 6px;')}>
              <div style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>
                Plaats zelf een vacature of oproep
              </div>
              <div style={css('font-size: 13px; color: #4B5C58;')}>Zichtbaar voor alle leden van het Collectief</div>
            </div>

            <div style={css('font-size: 14.5px; color: #4B5C58; margin-bottom: 24px;')}>
              Zoekt uw organisatie een fondsenwerver, of doet u een oproep aan vakgenoten? Vul de gegevens in.
            </div>

            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(256px, 1fr)); gap: 14px; margin-bottom: 16px;')}>
              <input type="text" placeholder="Functie of oproep" value={(vacForm && vacForm.title) || ''} onChange={onVacTitle} style={veld} />
              <input type="text" placeholder="Organisatie" value={(vacForm && vacForm.org) || ''} onChange={onVacOrg} style={veld} />
              <input type="text" placeholder="Locatie" value={(vacForm && vacForm.location) || ''} onChange={onVacLocation} style={veld} />
              <input
                type="text"
                placeholder="Thema of trefwoord (bijv. natuur, jeugd)"
                value={(vacForm && vacForm.tag) || ''}
                onChange={onVacTag}
                style={veld}
              />
            </div>

            <div style={css('display: flex; align-items: center; gap: 14px; flex-wrap: wrap;')}>
              <div
                onClick={submitVacancy}
                style={css(
                  'cursor: pointer; padding: 13px 28px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15px;',
                )}
              >
                Plaatsen
              </div>
              {vacPosted && <div style={css('font-size: 14px; color: #4E9A6C; font-weight: 700;')}>Geplaatst, te zien in de lijst hieronder.</div>}
            </div>
          </div>
        )}

        {hideContact && (
          <div
            style={css(
              'background: #EAF4EE; border-radius: 24px; padding: clamp(24px, 4vw, 40px) clamp(20px, 4vw, 44px); display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;',
            )}
          >
            <div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; margin-bottom: 6px;")}>
                Zelf een vacature of oproep plaatsen?
              </div>
              <div style={css('font-size: 14.5px; color: #4B5C58; max-width: 560px;')}>
                Alleen leden van het Collectief kunnen vacatures en oproepen plaatsen. Log in of registreer u om uw
                vacature te delen met de sector.
              </div>
            </div>
            <div
              onClick={goNetwerk}
              style={css(
                'cursor: pointer; padding: 13px 28px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 15px; white-space: nowrap;',
              )}
            >
              Log in bij het Collectief →
            </div>
          </div>
        )}
      </div>

      {/* LEDEN-VACATURES */}
      {hasMemberVacancies && (
        <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 40px;')}>
          <div style={sectieKop}>Geplaatst door leden</div>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 16px;')}>
            {(memberVacancies || []).map((v, i) => (
              <div
                key={i}
                style={css(
                  'background: #FFFFFF; border: 1.5px solid #DCEDE3; border-radius: 14px; padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;',
                )}
              >
                <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px;')}>
                  <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15.5px;')}>{v.title}</div>
                  <div
                    style={css(
                      'font-size: 11.5px; color: #4E9A6C; background: #EAF4EE; padding: 3px 10px; border-radius: 999px; font-weight: 700; white-space: nowrap;',
                    )}
                  >
                    Lid
                  </div>
                </div>
                <div style={css('font-size: 13.5px; color: #4B5C58;')}>
                  {v.org} · {v.location}
                </div>
                <Labels tags={v.tags} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALLE VACATURES */}
      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div style={sectieKop}>Actuele vacatures uit de sector</div>
        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 16px;')}>
          {(vacancies || []).map((v, i) => (
            <a
              key={i}
              href={v.url}
              target="_blank"
              rel="noopener"
              style={css(
                'background: #FFFFFF; border: 1.5px solid #E1EAE4; border-radius: 14px; padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;',
              )}
            >
              <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px;')}>
                <div style={css('font-weight: 700; color: #2C4A5E; font-size: 15.5px;')}>{v.title}</div>
                <div
                  style={css(
                    'font-size: 12px; color: #FFFFFF; background: #4E9A6C; padding: 3px 10px; border-radius: 999px; font-weight: 700; white-space: nowrap;',
                  )}
                >
                  {v.type}
                </div>
              </div>
              <div style={css('font-size: 13.5px; color: #4B5C58;')}>
                {v.org} · {v.location}
              </div>
              <Labels tags={v.tags} />
            </a>
          ))}
        </div>
        <div style={css('font-size: 12.5px; color: #8FA09B; margin-top: 18px;')}>
          Vacatures kunnen inmiddels zijn vervuld, controleer de actuele status via de link.
        </div>
      </div>
    </div>
  );
}
