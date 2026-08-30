// Subsidie Kompas — de tool.
// Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Subsidie Kompas"). De panelen voor documentatie,
// projecten en organisatie zijn in het ontwerp inline op deze pagina; ze worden
// hier gerenderd door de bestaande componenten, die al gelijk zijn aan het
// ontwerp.
//
// Behouden functionaliteit: de Edge Function via askKompas(), de plan-gates uit
// useKompasApp (Free/Pro/Premium), en de gesprekken uit KompasStore.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import { askKompas, buildContext } from '../../data/services/chat.js';
import OrganisatieprofielPage from './OrganisatieprofielPage.jsx';
import ProjectenPage from './ProjectenPage.jsx';
import DocumentatiePage from './DocumentatiePage.jsx';

const STARTERS = [
  'Ik zoek financiering voor een nieuw project',
  'Welke fondsen passen bij mijn organisatie?',
  'Help mij een projectplan opzetten',
  'Hoe onderbouw ik mijn begroting?',
];

const pil = (actief) =>
  css(`
    cursor: pointer;
    box-sizing: border-box;
    min-height: 38px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    padding: 9px 20px;
    border-radius: 999px;
    border: 1px solid ${actief ? '#BFD4C6' : '#D6E3E9'};
    background: ${actief ? '#EAF4EE' : '#FFFFFF'};
    color: ${actief ? '#2F6D47' : '#2C4A5E'};
    font-size: 13.5px;
    font-weight: 800;
  `);

function DenkKompas() {
  return (
    <div style={css('align-self: flex-start; padding: 2px 0 2px 4px;')}>
      <svg viewBox="0 0 48 48" width="38" height="38" style={{ display: 'block' }} aria-label="Subsidie Kompas denkt na" role="img">
        <circle cx="24" cy="24" r="21" fill="none" stroke="#DCE7E1" strokeWidth="2" />
        <circle
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke="#4E9A6C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="34 98"
          style={{ transformBox: 'view-box', transformOrigin: '24px 24px', animation: 'sk-spin 1.5s linear infinite' }}
        />
        <g style={{ transformBox: 'view-box', transformOrigin: '24px 24px', animation: 'sk-needle 2.6s cubic-bezier(0.45, 0, 0.25, 1) infinite' }}>
          <polygon points="24,8 27.4,24 24,27 20.6,24" fill="#4E9A6C" />
          <polygon points="24,40 27.4,24 24,21 20.6,24" fill="#A9C9DE" />
        </g>
        <circle cx="24" cy="24" r="2.6" fill="#2C4A5E" />
      </svg>
    </div>
  );
}

export default function KompasToolPage() {
  const app = useApp();
  const store = useKompas();

  const tier = app.subscriptionTier || 'free';
  const hasPlanTools = tier === 'pro' || tier === 'premium';
  const isFreePlan = tier === 'free';
  const isProPlan = tier === 'pro';
  const isPremiumPlan = tier === 'premium';

  const planLabel = { free: 'Free', pro: 'Pro', premium: 'Premium' }[tier];

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paneel, setPaneel] = useState(null);
  const [accountMsg, setAccountMsg] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const scrollRef = useRef(null);
  const taRef = useRef(null);

  const gesprekken = store.conversations || [];
  const documenten = store.genDocs || [];
  const [actiefDoc, setActiefDoc] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const groeiMee = () => {
    const el = taRef.current;

    if (!el) return;

    el.style.height = '48px';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const verstuur = async (tekst) => {
    const vraag = (tekst != null ? tekst : draft).trim();

    if (!vraag || loading) return;

    const nieuw = messages.concat([{ role: 'user', content: vraag, fromUser: true }]);

    setMessages(nieuw);
    setDraft('');
    setError('');
    setLoading(true);

    if (taRef.current) taRef.current.style.height = '48px';

    const res = await askKompas({
      messages: nieuw,
      tier,
      permissions: {
        canUploadFiles: app.canUploadFiles,
        canUseKnowledgeBase: app.canUseKnowledgeBase,
        canUseFundDatabase: app.canUsePrivateDatabase,
        canUseOrganizationMemory: app.canUseOrganizationMemory,
      },
      context: buildContext ? buildContext(store) : null,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);

      return;
    }

    setMessages(nieuw.concat([{ role: 'assistant', content: res.answer, fromUser: false }]));
  };

  const togglePaneel = (naam) => () => setPaneel(paneel === naam ? null : naam);

  const nieuweChat = () => {
    setMessages([]);
    setDraft('');
    setError('');
  };

  const subnavLink = css('font-size: 14.5px; font-weight: 700; color: #2C4A5E; white-space: nowrap;');

  return (
    <div data-screen-label="Subsidie Kompas" style={css('min-height: 100vh; position: relative; z-index: 1;')}>
      {/* SUBNAVIGATIE */}
      <div style={css('position: relative; z-index: 1; border-bottom: 1px solid #E1EAE4; background: rgba(247,249,248,0.94);')}>
        <div
          style={css(
            'max-width: 1120px; margin: 0 auto; padding: 14px clamp(16px, 4vw, 24px); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;',
          )}
        >
          <div onClick={app.goHome} style={css('cursor: pointer; color: #2C4A5E; font-size: 15px; font-weight: 700;')}>
            ← Terug naar Het Fondsenwervers Collectief
          </div>

          <div style={css('display: flex; align-items: center; flex-wrap: wrap; gap: 8px 22px; margin-left: auto;')}>
            <a href="#/hoe-het-werkt" style={subnavLink}>
              Hoe het werkt
            </a>
            <a href="#/kompas/deadlines" style={subnavLink}>
              Deadlines
            </a>
            <a href="#/kompas/faq" style={subnavLink}>
              FAQ
            </a>
          </div>

          <div style={css('display: flex; align-items: center; gap: 12px;')}>
            <span style={css('padding: 5px 13px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-size: 12px; font-weight: 800;')}>
              {planLabel}
            </span>
            <span style={css('display: flex; align-items: center; gap: 10px;')}>
              <img
                src="/uploads/kompas-logo.png"
                alt="Subsidie Kompas"
                style={css('width: 30px; height: 30px; border-radius: 50%; object-fit: contain; display: block;')}
              />
              <span style={css("font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E;")}>Subsidie Kompas</span>
            </span>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div style={css('position: relative; z-index: 1; max-width: 850px; margin: 72px auto 0; padding: 0 clamp(16px, 4vw, 24px); text-align: center;')}>
        <img
          src="/uploads/kompas-logo.png"
          alt="Subsidie Kompas"
          style={css('width: 78px; height: 78px; border-radius: 50%; object-fit: contain; display: inline-block;')}
        />
        <div style={css("margin-top: 18px; font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #4E9A6C;")}>
          Subsidie Kompas
        </div>
        <div
          style={css(
            "margin: 12px 0 22px; font-family: 'Newsreader', serif; font-size: clamp(34px, 7vw, 56px); font-weight: 600; line-height: 1.08; color: #2C4A5E;",
          )}
        >
          Uw gids bij fondsenwerving
        </div>
        <div style={css('max-width: 710px; margin: 0 auto; font-size: 18px; line-height: 1.65; color: #4B5C58;')}>
          Subsidie Kompas helpt u aan projectfinanciering: passende fondsen, een concrete strategie en begeleiding bij
          de aanvraag.
        </div>
      </div>

      <div style={css('position: relative; z-index: 1; max-width: 1040px; margin: 54px auto 80px; padding: 0 clamp(16px, 4vw, 24px);')}>
        {/* PILLEN */}
        <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;')}>
          {hasPlanTools && (
            <>
              <div onClick={nieuweChat} role="button" style={pil(false)}>
                + Nieuwe chat
              </div>
              <div onClick={togglePaneel('historie')} role="button" style={pil(paneel === 'historie')}>
                Eerdere gesprekken ({gesprekken.length})
              </div>
              <div onClick={togglePaneel('org')} role="button" style={pil(paneel === 'org')}>
                Organisatie
              </div>
              <div onClick={togglePaneel('proj')} role="button" tabIndex={0} style={pil(paneel === 'proj')}>
                Projecten
              </div>
              <div onClick={togglePaneel('doc')} role="button" tabIndex={0} style={{ ...pil(paneel === 'doc'), gap: '8px' }}>
                Documentatie
                <span style={css('font-size: 12px; font-weight: 700; opacity: 0.7;')}>{documenten.length}</span>
              </div>
            </>
          )}
        </div>

        {/* EERDERE GESPREKKEN */}
        {paneel === 'historie' && (
          <div style={css('margin-bottom: 16px; padding: clamp(20px, 3vw, 28px); border: 1px solid #D6E3E9; border-radius: 24px; background: #FFFFFF;')}>
            <div style={css("margin-bottom: 18px; font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E;")}>
              Eerdere gesprekken
            </div>

            <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
              {gesprekken.map((h) => (
                <div
                  key={h.id}
                  style={css(
                    'display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; min-height: 44px; padding: 13px 16px; border: 1px solid #E1EAE4; border-radius: 14px;',
                  )}
                >
                  <span
                    onClick={() => setMessages(h.berichten || [])}
                    role="button"
                    tabIndex={0}
                    style={css('cursor: pointer; flex: 1 1 220px; min-width: 0; color: #2C4A5E; font-size: 14.5px; font-weight: 700;')}
                  >
                    {h.titel}
                  </span>
                  <span style={css('display: flex; align-items: center; gap: 16px;')}>
                    <span style={css('color: #7B8985; font-size: 13px;')}>{h.tijd}</span>
                    <span
                      onClick={() => store.deleteConversation(h.id)}
                      role="button"
                      tabIndex={0}
                      style={css('cursor: pointer; min-height: 44px; display: flex; align-items: center; color: #9E3B2C; font-size: 13px; font-weight: 700;')}
                    >
                      Verwijderen
                    </span>
                  </span>
                </div>
              ))}

              {gesprekken.length === 0 && (
                <div style={css('padding: 20px 16px; border: 1px dashed #D5E0D9; border-radius: 14px; font-size: 14.5px; line-height: 1.6; color: #7B8985;')}>
                  Nog geen bewaarde gesprekken. Zodra u een vraag stelt, bewaart Subsidie Kompas het gesprek hier zodat
                  u er later op terug kunt komen.
                </div>
              )}

              <div
                onClick={nieuweChat}
                role="button"
                tabIndex={0}
                style={css(
                  'cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center; padding: 12px 20px; border: 1px solid #D6E3E9; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-size: 13.5px; font-weight: 800;',
                )}
              >
                + Nieuw gesprek
              </div>
            </div>

            <div style={css('margin-top: 22px; padding-top: 20px; border-top: 1px solid #E1EAE4;')}>
              <div style={css('margin-bottom: 6px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>Gegevens verwijderen</div>
              <div style={css('margin-bottom: 16px; max-width: 620px; font-size: 14px; line-height: 1.65; color: #536460;')}>
                U bepaalt zelf wat Subsidie Kompas van u bewaart. Verwijderen kan niet worden teruggedraaid; wat u
                weghaalt gebruikt Subsidie Kompas niet meer in adviezen en aanvragen.
              </div>
              <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
                <div
                  onClick={() => {
                    store.clearConversations();
                    setAccountMsg('Alle gesprekken zijn verwijderd.');
                  }}
                  role="button"
                  style={css(
                    'cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center; padding: 12px 20px; border: 1px solid #E1D3D0; border-radius: 999px; background: #FFFFFF; color: #9E3B2C; font-size: 14px; font-weight: 700;',
                  )}
                >
                  Alle gesprekken verwijderen
                </div>
                <div
                  onClick={() => {
                    store.clearOrgProfile();
                    setAccountMsg('De informatie over uw organisatie is verwijderd.');
                  }}
                  role="button"
                  style={css(
                    'cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center; padding: 12px 20px; border: 1px solid #E1D3D0; border-radius: 999px; background: #FFFFFF; color: #9E3B2C; font-size: 14px; font-weight: 700;',
                  )}
                >
                  Informatie over mijn organisatie verwijderen
                </div>
              </div>

              {accountMsg && (
                <div
                  style={css(
                    'margin-top: 16px; padding: 13px 16px; border: 1px solid #BFD4C6; border-radius: 12px; background: #EAF4EE; font-size: 14.5px; font-weight: 700; color: #2F6D47;',
                  )}
                >
                  {accountMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANELEN: documentatie, projecten, organisatie */}
        {paneel === 'doc' && (
          <div style={css('margin-bottom: 16px;')}>
            <DocumentatiePage />
          </div>
        )}
        {paneel === 'proj' && (
          <div style={css('margin-bottom: 16px;')}>
            <ProjectenPage />
          </div>
        )}
        {paneel === 'org' && (
          <div style={css('margin-bottom: 16px;')}>
            <OrganisatieprofielPage />
          </div>
        )}

        {/* UPGRADE */}
        {upgradeOpen && (
          <div
            style={css(
              'position: fixed; inset: 0; z-index: 300; background: rgba(33,56,74,0.5); display: flex; align-items: center; justify-content: center; padding: 20px;',
            )}
          >
            <div style={css('max-width: 460px; width: 100%; padding: clamp(24px, 3vw, 34px); border-radius: 22px; background: #FFFFFF;')}>
              <div style={css("margin-bottom: 10px; font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E;")}>
                Automatisch uw organisatieprofiel laten opbouwen?
              </div>
              <div style={css('margin-bottom: 24px; font-size: 15px; line-height: 1.7; color: #4B5C58;')}>
                Met Pro en Premium analyseert Subsidie Kompas uw website en bouwt automatisch een organisatieprofiel op.
                Dit bespaart tijd en zorgt voor betere fondsselecties en nauwkeurigere AI-adviezen.
              </div>
              <div style={css('display: flex; gap: 12px; flex-wrap: wrap;')}>
                <a
                  href="#/hoe-het-werkt"
                  onClick={() => setUpgradeOpen(false)}
                  style={css(
                    'box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 22px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-size: 14.5px; font-weight: 800;',
                  )}
                >
                  Bekijk Pro
                </a>
                <div
                  onClick={() => setUpgradeOpen(false)}
                  role="button"
                  style={css(
                    'cursor: pointer; box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 22px; border-radius: 999px; border: 1px solid #E1EAE4; background: #FFFFFF; color: #2C4A5E; font-size: 14.5px; font-weight: 700;',
                  )}
                >
                  Misschien later
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHATVENSTER */}
        <div style={css('overflow: hidden; border-radius: 30px; background: #EAF1F6; box-shadow: 0 15px 45px rgba(44,74,94,0.08);')}>
          <div style={css('padding: 14px 22px; display: flex; align-items: center; gap: 11px; border-bottom: 1px solid #D6E3E9; background: #FFFFFF;')}>
            <img
              src="/uploads/kompas-logo.png"
              alt="Subsidie Kompas"
              style={css('width: 38px; height: 38px; border-radius: 50%; object-fit: contain; display: block;')}
            />
            <div>
              <div style={css('color: #2C4A5E; font-size: 15px; font-weight: 800;')}>Subsidie Kompas</div>
              <div style={css('margin-top: 2px; color: #6B7B77; font-size: 11.5px;')}>Adviseur voor subsidies en fondsenwerving</div>
            </div>
            <div style={css('margin-left: auto; display: flex; align-items: center; gap: 10px;')}>
              <span style={css('width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C;')} />
              <span style={css('color: #667873; font-size: 12px;')}>online</span>
              <div
                style={css(
                  'padding: 6px 10px; border: 1px solid #DCE5E1; border-radius: 999px; background: #F7F9F8; color: #6B7B77; font-size: 10.5px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;',
                )}
              >
                {planLabel}
              </div>
            </div>
          </div>

          {messages.length === 0 && (
            <div style={css('padding: clamp(20px, 3.4vw, 34px);')}>
              <div style={css('display: flex; justify-content: flex-start; margin-bottom: 28px;')}>
                <div
                  style={css(
                    'max-width: 72%; padding: 20px 22px; border-radius: 24px 24px 24px 5px; background: #FFFFFF; color: #2E3A38; box-shadow: 0 2px 10px rgba(44,74,94,0.035); font-size: 15px; line-height: 1.68;',
                  )}
                >
                  Goedendag, ik ben Subsidie Kompas. Waarmee kan ik u vandaag helpen?
                </div>
              </div>
              <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(max(240px, calc(50% - 7px)), 1fr)); gap: 14px;')}>
                {STARTERS.map((s) => (
                  <div
                    key={s}
                    onClick={() => verstuur(s)}
                    style={css(
                      'cursor: pointer; min-height: 78px; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border: 1px solid #D7E2DC; border-radius: 18px; background: #FFFFFF; color: #2C4A5E; font-size: 14.5px; font-weight: 700; line-height: 1.4;',
                    )}
                  >
                    <span>{s}</span>
                    <span>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div
              ref={scrollRef}
              style={css(
                'min-height: min(500px, 58vh); max-height: 660px; overflow-y: auto; padding: clamp(20px, 3vw, 30px) clamp(18px, 3.4vw, 34px) 24px; display: flex; flex-direction: column; gap: 18px;',
              )}
            >
              {messages.map((m, i) =>
                m.fromUser ? (
                  <div
                    key={i}
                    style={css(
                      'align-self: flex-end; max-width: 72%; padding: 17px 22px; border-radius: 24px 24px 5px 24px; background: #2C4A5E; color: #FFFFFF; font-size: 15px; line-height: 1.65; white-space: pre-wrap;',
                    )}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div
                    key={i}
                    style={css(
                      'align-self: flex-start; max-width: 78%; padding: 20px 22px; border-radius: 24px 24px 24px 5px; background: #FFFFFF; color: #2E3A38; box-shadow: 0 2px 10px rgba(44,74,94,0.035); font-size: 15px; line-height: 1.68; white-space: pre-wrap;',
                    )}
                  >
                    {m.content}
                  </div>
                ),
              )}

              {loading && <DenkKompas />}
            </div>
          )}

          {error && (
            <div style={css('margin: 0 clamp(14px, 3vw, 28px) 14px; padding: 12px 15px; border-radius: 12px; background: #FFF1EF; color: #A13B2F; font-size: 13px;')}>
              {error}
            </div>
          )}

          <div style={css('padding: 6px clamp(14px, 3vw, 28px) 30px;')}>
            {actiefDoc && (
              <div
                style={css(
                  'margin-bottom: 10px; display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px; border: 1px solid #D6E3E9; border-radius: 999px; background: #FFFFFF;',
                )}
              >
                <span style={css('font-size: 12.5px; font-weight: 700; color: #2C4A5E;')}>Werkt verder aan: {actiefDoc.naam}</span>
                <span
                  onClick={() => setActiefDoc(null)}
                  role="button"
                  tabIndex={0}
                  aria-label="Document losmaken"
                  style={css('cursor: pointer; color: #7B8985; font-size: 14px; font-weight: 700;')}
                >
                  ×
                </span>
              </div>
            )}

            <div style={css('display: flex; align-items: flex-end; gap: 10px; padding: 10px 10px 10px 20px; border-radius: 26px; background: #FFFFFF;')}>
              <textarea
                ref={taRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  groeiMee();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    verstuur();
                  }
                }}
                rows="1"
                placeholder="Typ uw vraag..."
                style={css(
                  "flex: 1; min-width: 0; height: 48px; min-height: 48px; max-height: 180px; overflow-y: auto; padding: 13px 0 10px; border: none; outline: none; resize: none; background: transparent; color: #2E3A38; font-family: 'Mulish', sans-serif; font-size: 15.5px; line-height: 1.5;",
                )}
              />
              <div
                onClick={() => verstuur()}
                role="button"
                aria-label="Verstuur vraag"
                style={css(
                  'width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; background: #4E9A6C; cursor: pointer;',
                )}
              >
                <span
                  style={css(
                    'width: 0; height: 0; margin-left: 3px; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid #FFFFFF;',
                  )}
                />
              </div>
            </div>

            {isFreePlan && (
              <div style={css('margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;')}>
                <span style={css('flex: 1 1 300px; min-width: 0; color: #687974; font-size: 12px; font-weight: 700; text-wrap: pretty;')}>
                  Pro levert uw projectplannen, begrotingen en aanvragen als afgeronde documenten in uw eigen huisstijl,
                  en onthoudt uw organisatie. Premium zoekt daarnaast in <FundingDatabaseCount /> fondsen die online
                  nauwelijks te vinden zijn.
                </span>
                <a
                  href="#/hoe-het-werkt"
                  style={css(
                    'flex-shrink: 0; padding: 8px 16px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 12px; font-weight: 800; white-space: nowrap;',
                  )}
                >
                  Ontdek Pro en Premium →
                </a>
              </div>
            )}

            {isProPlan && (
              <div style={css('margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;')}>
                <span style={css('color: #687974; font-size: 12px; font-weight: 700;')}>
                  Met Premium zoekt Subsidie Kompas naast internet ook in de exclusieve fondsendatabase met{' '}
                  <FundingDatabaseCount /> fondsen en regelingen.
                </span>
                <a
                  href="#/hoe-het-werkt"
                  style={css('padding: 8px 16px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 12px; font-weight: 800; white-space: nowrap;')}
                >
                  Upgrade naar Premium →
                </a>
              </div>
            )}

            {isPremiumPlan && (
              <div style={css('margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;')}>
                <span style={css('width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C;')} />
                <span style={css('color: #2F6D47; font-size: 12px; font-weight: 800;')}>Premium actief</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
