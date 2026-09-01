// Homepage. De opmaak is letterlijk overgenomen uit het goedgekeurde ontwerp
// (data-screen-label="Home" in Het Fondsenwervers Collectief.dc.html).
// Wijzig hier geen maat, kleur of afstand zonder het ontwerp mee te wijzigen.
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';

const zwevendeVorm = (positie, animatie) =>
  css(`position: absolute; ${positie} opacity: ${animatie.opacity}; animation: ${animatie.naam} ${animatie.duur} ease-in-out infinite;`);

// De vier zwevende illustraties in de hero.
function HeroVormen() {
  return (
    <div style={css('position: absolute; inset: 0; pointer-events: none; z-index: 0;')} aria-hidden="true">
      <svg
        style={zwevendeVorm('top: 16%; left: 3%; width: 96px; height: 96px;', { opacity: 0.4, naam: 'fw-float-a', duur: '11s' })}
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="32" cy="32" r="22" stroke="#9FB8C4" strokeWidth="1.6" />
        <path d="M32 15c1 4-1 8-1 12M32 49c1-4-1-8-1-12" stroke="#9FB8C4" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M32 20 L38 32 L32 44 L26 32 Z" stroke="#A8D5BA" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <circle cx="32" cy="32" r="2" fill="#A8D5BA" />
        <path d="M14 44c-3 3-3 6-1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>

      <svg
        style={zwevendeVorm('top: 3%; right: 5%; width: 82px; height: 82px;', { opacity: 0.35, naam: 'fw-float-b', duur: '12.5s' })}
        viewBox="0 0 64 64"
        fill="none"
      >
        <path
          d="M16 12h26l8 8v32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z"
          stroke="#C3D9E6"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M42 12v8h8" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <path d="M18 28h13M18 34h20M18 40h20" stroke="#C3D9E6" strokeWidth="1" strokeLinecap="round" />
        <path
          d="M30 26c4-5 12-9 17-6 1.6 1 1.3 3-.4 4.4-6 5-13 9-19 11.6-1.4.6-2.4-.5-1.8-1.8 1.8-4 3-6.4 4.2-8.2Z"
          stroke="#A8D5BA"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M26 44l2-6" stroke="#A8D5BA" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <svg
        style={zwevendeVorm('bottom: 9%; left: 2%; width: 76px; height: 76px;', { opacity: 0.32, naam: 'fw-float-c', duur: '10s' })}
        viewBox="0 0 64 64"
        fill="none"
      >
        <path d="M32 4v5M20 8l2.5 4.3M44 8l-2.5 4.3M12 18l4.3 2.5M52 18l-4.3 2.5" stroke="#F2E1A8" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M32 12c-9 1-15 8-13 16 1.3 5.2 6 7 8 11 1 2 1 4 1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M32 12c9 1 15 8 13 16-1.3 5.2-6 7-8 11-1 2-1 4-1 6" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M27 50c3 2 7 2 10 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M28 55c2.4 1.3 5.6 1.3 8 0" stroke="#A8D5BA" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>

      <svg
        style={zwevendeVorm('bottom: 11%; right: 8%; width: 92px; height: 92px;', { opacity: 0.36, naam: 'fw-float-d', duur: '12s' })}
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="32" cy="32" r="31" stroke="#B9D6C9" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="27" stroke="#B9D6C9" strokeWidth="1" />
        <path
          d="M38 16c-5-1-10 1-12 5 -1 2-2 5-6 7 l7 3 c-2 2-2 4 1 5 c-2 2-1 4 2 5 c-2 2-1 4 3 6 l0 4 c0 2 3 3 6 3 l9 0 c0-4-2-7-2-10 c5-2 8-8 8-14 c0-9-5-15-16-15Z"
          stroke="#9FB8C4"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="31" cy="25" r="1.2" fill="#9FB8C4" />
        <path d="M18 22c3-3 7-4 10-3" stroke="#A8D5BA" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <text x="45" y="46" fontFamily="'Newsreader', serif" fontSize="13" fill="#9FB8C4" textAnchor="middle">
          €
        </text>
        <path d="M53 49c3 3 3 6 1 8" stroke="#A8D5BA" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

// De twee kleinere illustraties bij de doelgroepblokken.
function DoelgroepVormen() {
  return (
    <div style={css('position: absolute; inset: 0; pointer-events: none; z-index: 0;')} aria-hidden="true">
      <svg
        style={zwevendeVorm('top: 2%; right: 2%; width: 70px; height: 70px;', { opacity: 0.28, naam: 'fw-float-b', duur: '13s' })}
        viewBox="0 0 64 64"
        fill="none"
      >
        <path
          d="M16 12h26l8 8v32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z"
          stroke="#C3D9E6"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M42 12v8h8" stroke="#C3D9E6" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <path d="M18 28h13M18 34h20M18 40h20" stroke="#C3D9E6" strokeWidth="1" strokeLinecap="round" />
      </svg>

      <svg
        style={zwevendeVorm('bottom: 4%; left: 3%; width: 60px; height: 60px;', { opacity: 0.28, naam: 'fw-float-c', duur: '10.5s' })}
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="32" cy="32" r="18" stroke="#9FB8C4" strokeWidth="1.6" />
        <path d="M32 17c1 3-1 6-1 9M32 47c1-3-1-6-1-9" stroke="#9FB8C4" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M32 22 L37 32 L32 42 L27 32 Z" stroke="#A8D5BA" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

const KOMPAS_BULLETS = [
  'Zoekt gericht naar passende fondsen en subsidies',
  'Brengt financiering, voorwaarden en deadlines helder in beeld',
  'Adviseert over kansrijkheid en fondsenwervende strategie',
  'Ondersteunt bij een sterke aanvraag: positionering, projectplan en begroting',
];

const VOORBEELD_REGELINGEN = [
  { naam: 'Landelijk cultuurfonds: Fotografie, t/m €25.000', deadline: 'deadline 1 sep' },
  { naam: 'Gemeentelijk cultuurfonds, t/m €10.000', deadline: 'doorlopend' },
  { naam: 'Particulier cultuurfonds, t/m €5.000', deadline: '15 okt' },
];

const ikBenKnop = (randkleur) =>
  css(`
    width: 180px;
    text-align: center;
    padding: 14px 26px;
    background: #FFFFFF;
    border: 1.5px solid ${randkleur};
    border-radius: 16px;
    font-weight: 700;
    color: #2C4A5E;
    font-size: 15.5px;
    box-shadow: 0 2px 0 rgba(44,74,94,0.04);
    box-sizing: border-box;
  `);

export default function HomePage() {
  const app = useApp();
  const { isHome, heroAnimationOn, goOrient, goKompas, goNetwerk, goOrg, goActueel, homeNews } = app;

  if (!isHome) return null;

  return (
    <div data-screen-label="Home">
      {/* HERO */}
      <div
        style={css(
          'max-width: 980px; margin: 0 auto; padding: clamp(40px, 7vw, 72px) clamp(16px, 4vw, 32px); text-align: center; position: relative; overflow: hidden;',
        )}
      >
        {heroAnimationOn && <HeroVormen />}

        <div style={css('position: relative; z-index: 1;')}>
          <div
            style={css(
              'display: inline-block; padding: 7px 16px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 28px;',
            )}
          >
            Het kennisplatform voor fondsenwerving &amp; subsidies
            <br />
          </div>

          <div
            style={css(
              "font-family: 'Newsreader', serif; font-size: clamp(32px, 6.4vw, 52px); line-height: 1.15; font-weight: 600; color: #2C4A5E; margin-bottom: 22px; text-wrap: balance;",
            )}
          >
            Alles wat u nodig heeft voor fondsenwerving, slim gebundeld op&nbsp;één&nbsp;plek
          </div>

          <div style={css('font-size: 19px; line-height: 1.6; color: #4B5C58; max-width: 660px; margin: 0 auto 24px;')}>
            Het Fondsenwervers Collectief brengt vakkennis, ervaring en slimme tools samen, zodat u uw werk
            succesvoller kunt doen en meer impact maakt.
          </div>

          <div
            style={css(
              'font-size: 14px; font-weight: 700; color: #2C4A5E; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px;',
            )}
          >
            Ik ben...
          </div>

          <div style={css('display: flex; flex-wrap: wrap; gap: 14px; justify-content: center;')}>
            <a href="#blok-fellow" style={ikBenKnop('#A8D5BA')}>
              Fondsenwerver
            </a>
            <a href="#blok-org" style={ikBenKnop('#A9C9DE')}>
              Organisatie
            </a>
            <div onClick={goOrient} style={{ ...ikBenKnop('#E1EAE4'), cursor: 'pointer' }}>
              Oriënterend
            </div>
          </div>
        </div>
      </div>

      {/* KOMPAS AI SHOWCASE */}
      <div id="kompas-ai" style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div
          style={css(
            'background: #EAF4EE; border-radius: 28px; padding: clamp(24px, 4vw, 64px); display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 56px; align-items: start; box-shadow: 0 1px 3px rgba(44,74,94,0.06);',
          )}
        >
          <div>
            <div
              style={css(
                'display: inline-flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-size: 13px; font-weight: 700; margin-bottom: 18px;',
              )}
            >
              <img
                src="/uploads/kompas-logo.png"
                alt="Subsidie Kompas logo"
                style={css('width: 26px; height: 26px; border-radius: 50%; display: block;')}
              />
              Subsidie Kompas
            </div>

            <div
              style={css(
                "font-family: 'Newsreader', serif; font-size: clamp(25px, 3.8vw, 34px); font-weight: 600; color: #2C4A5E; line-height: 1.25; margin-bottom: 18px;",
              )}
            >
              Uw gids bij fondsenwerving
            </div>

            <div style={css('font-size: 16.5px; line-height: 1.65; color: #2C4A5E; margin-bottom: 28px;')}>
              Stel uw vraag, en Subsidie Kompas denkt met u mee over projectfinanciering.
            </div>

            <div style={css('display: flex; flex-direction: column; gap: 16px; margin-bottom: 34px;')}>
              {KOMPAS_BULLETS.map((tekst) => (
                <div key={tekst} style={css('display: flex; gap: 12px; align-items: flex-start;')}>
                  <div style={css('width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C; margin-top: 8px; flex-shrink: 0;')} />
                  <div style={css('font-size: 15.5px; line-height: 1.5; color: #2C4A5E;')}>
                    <strong>{tekst}</strong>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="#"
              onClick={goKompas}
              style={css(
                'display: inline-block; padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px;',
              )}
            >
              Probeer Subsidie Kompas →
            </a>
          </div>

          <div style={css('background: #FFFFFF; border-radius: 22px; padding: 22px; display: flex; flex-direction: column; gap: 14px;')}>
            <div style={css('display: flex; align-items: center; gap: 10px; padding: 0 4px;')}>
              <img
                src="/uploads/kompas-logo.png"
                alt="Subsidie Kompas logo"
                style={css('width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: block;')}
              />
              <div style={css('font-weight: 700; color: #2C4A5E; font-size: 14.5px;')}>Subsidie Kompas</div>
              <div style={css('width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-left: 2px;')} />
              <div style={css('font-size: 12.5px; color: #4B5C58;')}>online</div>
            </div>

            <div
              style={css(
                'align-self: flex-end; max-width: 82%; background: #2C4A5E; color: #FFFFFF; padding: 12px 16px; border-radius: 16px 16px 4px 16px; font-size: 14.5px; line-height: 1.5;',
              )}
            >
              Ik zoek financiering voor een hedendaagse fotografie tentoonstelling in Utrecht. Budget ±€40.000.
            </div>

            <div
              style={css(
                'align-self: flex-start; max-width: 92%; background: #FFFFFF; padding: 14px 16px; border-radius: 16px 16px 16px 4px; box-shadow: 0 1px 2px rgba(44,74,94,0.06);',
              )}
            >
              <div style={css('font-size: 14.5px; line-height: 1.55; color: #2E3A38; margin-bottom: 12px;')}>
                Goed idee. Ik vond 3 passende regelingen voor een fotografietentoonstelling in Utrecht:
              </div>
              <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
                {VOORBEELD_REGELINGEN.map((r) => (
                  <div
                    key={r.naam}
                    style={css(
                      'display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #EAF4EE; border-radius: 10px; padding: 9px 12px;',
                    )}
                  >
                    <div style={css('font-size: 13.5px; font-weight: 700; color: #2C4A5E;')}>{r.naam}</div>
                    <div style={css('font-size: 12px; color: #4E9A6C; font-weight: 700; white-space: nowrap;')}>{r.deadline}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={css('display: flex; align-items: center; gap: 10px; background: #FFFFFF; border-radius: 999px; padding: 12px 16px;')}>
              <div style={css('flex-grow: 1; font-size: 14px; color: #9BAAA6;')}>Typ uw vraag...</div>
              <div
                style={css(
                  'width: 30px; height: 30px; border-radius: 50%; background: #4E9A6C; flex-shrink: 0; display: flex; align-items: center; justify-content: center;',
                )}
              >
                <div
                  style={css(
                    'width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 9px solid #FFFFFF; margin-left: 2px;',
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DOELGROEP BLOKKEN */}
      <div
        id="voor-wie"
        style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px; position: relative; overflow: hidden;')}
      >
        {heroAnimationOn && <DoelgroepVormen />}

        <div style={css('position: relative; z-index: 1;')}>
          <div style={css('margin-bottom: 48px;')}>
            <div
              style={css(
                "font-family: 'Newsreader', serif; font-size: clamp(25px, 3.8vw, 34px); font-weight: 600; color: #2C4A5E; margin-bottom: 14px;",
              )}
            >
              Voor iedereen in het vak
            </div>
            <div style={css('font-size: 17px; line-height: 1.6; color: #4B5C58; max-width: 620px;')}>
              Waar u ook staat, of u nu dagelijks fondsen werft, financiering zoekt voor uw project of het vak wilt
              leren.
            </div>
          </div>

          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 28px;')}>
            <div
              id="blok-fellow"
              style={css(
                'background: #FFFFFF; border-radius: 18px; border-top: 4px solid #4E9A6C; padding: clamp(22px, 3.5vw, 36px); display: flex; flex-direction: column; gap: 6px; scroll-margin-top: 100px;',
              )}
            >
              <div style={css('display: flex; align-items: center; gap: 12px; margin-bottom: 14px;')}>
                <div
                  style={css(
                    'width: 46px; height: 46px; border-radius: 14px; background: #EAF4EE; display: flex; align-items: center; justify-content: center; flex-shrink: 0;',
                  )}
                >
                  <div style={css('width: 18px; height: 18px; border-radius: 50%; background: #4E9A6C;')} />
                </div>
                <div
                  style={css(
                    'display: inline-block; padding: 5px 14px; border-radius: 999px; background: #EAF4EE; color: #2C4A5E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;',
                  )}
                >
                  Voor profs
                </div>
              </div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 12px;")}>
                Fondsenwervers
              </div>
              <div style={css('font-size: 15.5px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 18px;')}>
                Professionaliseer uw werk, deel vakkennis met vakgenoten en gebruik Subsidie Kompas als betrouwbare
                hulp in uw dagelijkse praktijk.
              </div>
              <div onClick={goNetwerk} style={css('cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;')}>
                Ontdek het platform voor fondsenwervers →
              </div>
            </div>

            <div
              id="blok-org"
              style={css(
                'background: #FFFFFF; border-radius: 18px; border-top: 4px solid #A9C9DE; padding: clamp(22px, 3.5vw, 36px); display: flex; flex-direction: column; gap: 6px; scroll-margin-top: 100px;',
              )}
            >
              <div style={css('display: flex; align-items: center; gap: 12px; margin-bottom: 14px;')}>
                <div
                  style={css(
                    'width: 46px; height: 46px; border-radius: 14px; background: #EAF1F6; display: flex; align-items: center; justify-content: center; flex-shrink: 0;',
                  )}
                >
                  <div style={css('width: 18px; height: 18px; border-radius: 4px; background: #4E9A6C;')} />
                </div>
                <div
                  style={css(
                    'display: inline-block; padding: 5px 14px; border-radius: 999px; background: #EAF1F6; color: #2C4A5E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;',
                  )}
                >
                  Zoekt financiering
                </div>
              </div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 12px;")}>
                Organisaties
              </div>
              <div style={css('font-size: 15.5px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 18px;')}>
                Op zoek naar projectfinanciering voor uw organisatie? Ontdek hoe u het zelf kunt doen, met Subsidie
                Kompas als uw rechterhand.
              </div>
              <div onClick={goOrg} style={css('cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;')}>
                Bekijk hoe het werkt voor organisaties →
              </div>
            </div>

            <div
              id="blok-orient"
              style={css(
                'background: #FFFFFF; border-radius: 18px; border-top: 4px solid #A8D5BA; padding: clamp(22px, 3.5vw, 36px); display: flex; flex-direction: column; gap: 6px; scroll-margin-top: 100px;',
              )}
            >
              <div style={css('display: flex; align-items: center; gap: 12px; margin-bottom: 14px;')}>
                <div
                  style={css(
                    'width: 46px; height: 46px; border-radius: 14px; background: #F1EDE3; display: flex; align-items: center; justify-content: center; flex-shrink: 0;',
                  )}
                >
                  <div
                    style={css(
                      'width: 0; height: 0; border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-left: 14px solid #4E9A6C; margin-left: 3px;',
                    )}
                  />
                </div>
                <div
                  style={css(
                    'display: inline-block; padding: 5px 14px; border-radius: 999px; background: #F1EDE3; color: #2C4A5E; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;',
                  )}
                >
                  Oriënterend
                </div>
              </div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E; margin-bottom: 12px;")}>
                Aankomende fondsenwervers
              </div>
              <div style={css('font-size: 15.5px; line-height: 1.6; color: #4B5C58; flex-grow: 1; margin-bottom: 18px;')}>
                Leer stap voor stap hoe u fondsen werft en wat een succesvolle fondsenwerver kenmerkt, via video's,
                cursusmateriaal en praktijkcases.
              </div>
              <div onClick={goOrient} style={css('cursor: pointer; font-weight: 700; color: #4E9A6C; font-size: 15px;')}>
                Begin met leren →
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CIJFERS */}
      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div style={css('background: #A8D5BA; border-radius: 28px; padding: clamp(24px, 4vw, 56px);')}>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 16px;')}>
            <div style={css('background: #DCEFE3; border-radius: 16px; padding: 24px;')}>
              <div style={css("font-family: 'Newsreader', serif; font-size: 32px; font-weight: 700; color: #2C4A5E; margin-bottom: 8px;")}>
                <FundingDatabaseCount />
              </div>
              <div style={css('font-size: 14px; color: #2C4A5E; line-height: 1.4;')}>fondsen en regelingen in de database</div>
            </div>

            {['fondsenwervers aangesloten', "video's in de bibliotheek", 'waardering door leden'].map((label) => (
              <div key={label} style={css('background: #DCEFE3; border-radius: 16px; padding: 24px;')}>
                <div
                  style={css(
                    'display: inline-flex; align-items: center; gap: 6px; background: rgba(78,154,108,0.12); color: #4E9A6C; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 5px 11px; border-radius: 999px; margin-bottom: 10px;',
                  )}
                >
                  <span style={css('width: 6px; height: 6px; border-radius: 50%; background: #4E9A6C;')} />
                  Binnenkort
                </div>
                <div style={css('font-size: 14px; color: #2C4A5E; line-height: 1.4;')}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NIEUWS */}
      <div id="nieuws" style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 76px;')}>
        <div style={css('display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 36px;')}>
          <div>
            <div
              style={css(
                'font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;',
              )}
            >
              Actueel
            </div>
            <div
              style={css(
                "font-family: 'Newsreader', serif; font-size: clamp(24px, 3.4vw, 30px); font-weight: 600; color: #2C4A5E; margin-bottom: 8px;",
              )}
            >
              Nieuws uit subsidieland
            </div>
            <div style={css('font-size: 15.5px; color: #4B5C58;')}>
              Actuele ontwikkelingen, regelgeving en verdiepende artikelen uit de wereld van fondsen en subsidies.
            </div>
          </div>
          <div onClick={goActueel} style={css('cursor: pointer; font-weight: 700; color: #2C4A5E; font-size: 15px;')}>
            Alle artikelen →
          </div>
        </div>

        <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(272px, 1fr)); gap: 28px;')}>
          {(homeNews || []).map((item, i) => (
            <div
              key={item.id || i}
              onClick={item.open}
              style={css(
                'cursor: pointer; background: #FFFFFF; border-radius: 18px; padding: clamp(20px, 3vw, 28px); display: flex; flex-direction: column; gap: 12px;',
              )}
            >
              <div style={css('font-size: 13px; font-weight: 700; color: #4E9A6C;')}>
                {item.tag} · {item.date}
              </div>
              <div style={css("font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; color: #2C4A5E; line-height: 1.35;")}>
                {item.title}
              </div>
              <div style={css('font-size: 14.5px; line-height: 1.55; color: #4B5C58; flex-grow: 1;')}>{item.excerpt}</div>
              <div style={css('font-weight: 700; color: #2C4A5E; font-size: 14px;')}>Lees meer →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
