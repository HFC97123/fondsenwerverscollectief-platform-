// Hoe het werkt: de verkooppagina van Subsidie Kompas. Kort: wat het systeem doet in vier stappen, daaronder de abonnementen.
import React, { useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from '../kompas-app/useKompasApp.js';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import WerkplekFilm from '../../shared/ui/WerkplekFilm.jsx';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';
import { abonnerenHash, bewaarIntentie, bewaarLooptijd, intentieVoorTier } from '../../data/services/koopintentie.js';
import { ABONNEMENTEN, STANDAARD_LOOPTIJD, prijsInfo } from '../../data/abonnementen.js';
import LooptijdSchakelaar from './LooptijdSchakelaar.jsx';
import KompasAchtergrond from './KompasAchtergrond.jsx';
import { naar } from '../../app/routes.js';

// Zelfde adres als contact.email in de websiteconfiguratie (data/collections.js).
const CONTACT_EMAIL = 'info@fondsenwerverscollectief.nl';
const ENTERPRISE_MAIL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Subsidie Kompas Enterprise')}`;

// De vier stappen. Elke stap heeft een klein voorbeeld (alleen weergave, geen echte gegevens).
const STAPPEN = [
  {
    n: '1',
    titel: 'Vind de fondsen die echt passen',
    tekst: 'Vertel over uw project en zie welke fondsen en regelingen passen, met bedrag, voorwaarden en deadline.',
    voorbeeld: 'fondsen',
  },
  {
    n: '2',
    titel: 'Begroting en dekkingsplan',
    tekst: 'Een slimme combinatie van fondsen met realistische bedragen, zodat uw project niet half blijft.',
    voorbeeld: 'dekking',
  },
  {
    n: '3',
    titel: 'Houd elke deadline in beeld',
    tekst: 'Een actieplan met herinneringen, zodat u uw tijd aan schrijven besteedt en niet aan bijhouden.',
    voorbeeld: 'deadlines',
  },
  {
    n: '4',
    titel: 'Dien sterker in',
    tekst: 'Een projectplan op maat van het fonds en een controle aan de hand van de criteria van het fonds, vóórdat u indient.',
    voorbeeld: 'criteria',
  },
];

// Abonnementen. De prijzen van Pro en Premium komen uit data/abonnementen.js (één bron); hier staan alleen teksten.
const PLANNEN = [
  {
    tier: 'free',
    naam: 'Free',
    prijs: '€0',
    proefperiode: 'Gratis, zonder account',
    omschrijving: 'Ontdek welke fondsen bij uw project passen.',
    features: ['Chat met Subsidie Kompas en krijg advies', 'Vind passende fondsen voor uw project', 'Mis geen deadlines meer met het actuele deadlineoverzicht'],
  },
  {
    tier: 'pro',
    naam: 'Pro',
    proefperiode: '7 dagen gratis proberen',
    omschrijving: 'Van fondsen vinden tot indienen, in één werkplek.',
    ctaTekst: 'Start 7 dagen gratis',
    features: ABONNEMENTEN.pro.kenmerken,
  },
  {
    tier: 'premium',
    naam: 'Premium',
    proefperiode: '24 uur gratis proberen',
    omschrijving: 'Alles uit Pro, plus fondsen die elders moeilijk te vinden zijn.',
    ctaTekst: 'Probeer Premium 24 uur',
    uitgelicht: true,
    features: ABONNEMENTEN.premium.kenmerken,
  },
  {
    tier: 'enterprise',
    naam: 'Enterprise',
    prijsTekst: 'Op aanvraag',
    omschrijving: 'Impact maken met uw hele team.',
    ctaTekst: 'Neem contact op',
    features: ['Meerdere teamleden en accounts', 'Ruimer gebruik voor projecten, plannen en beoordelingen', 'Op maat ingericht voor uw organisatie'],
  },
];

function Voorbeeld({ soort }) {
  const kader = 'background: #F7F9F8; border: 1px solid #E4EBE7; border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 9px; font-size: 13px; color: #3D4B48;';

  if (soort === 'fondsen') {
    return (
      <div style={css(kader)} aria-hidden="true">
        {[
          ['Landelijk cultuurfonds: Fotografie', 'tot € 25.000', 'Open'],
          ['Gemeentelijk cultuurfonds', 'tot € 10.000', 'Doorlopend'],
          ['Particulier cultuurfonds', 'tot € 5.000', 'Open'],
        ].map(([naam, bedrag, status]) => (
          <div key={naam} style={css('display: flex; align-items: center; justify-content: space-between; gap: 10px;')}>
            <span style={css('font-weight: 700; color: #2C4A5E; min-width: 0;')}>{naam}</span>
            <span style={css('display: flex; align-items: center; gap: 8px; flex-shrink: 0;')}>
              <span style={css('color: #687974;')}>{bedrag}</span>
              <span style={css('padding: 2px 9px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-size: 11px; font-weight: 800;')}>{status}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (soort === 'dekking') {
    return (
      <div style={css(kader)} aria-hidden="true">
        <div style={css('display: flex; justify-content: space-between; font-weight: 700; color: #2C4A5E;')}>
          <span>Dekking van de begroting</span>
          <span>€ 40.000</span>
        </div>
        <div style={css('display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: #E4EBE7;')}>
          <div style={css('width: 35%; background: #4E9A6C;')} />
          <div style={css('width: 50%; background: #A9C9DE;')} />
        </div>
        <div style={css('display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: #4B5C58;')}>
          <span>€ 14.000 toegekend</span>
          <span>€ 20.000 in aanvraag</span>
          <span>€ 6.000 nog te dekken</span>
        </div>
      </div>
    );
  }

  if (soort === 'deadlines') {
    return (
      <div style={css(kader)} aria-hidden="true">
        {[
          ['Landelijk cultuurfonds: Fotografie', '25 dagen'],
          ['Gemeentelijk cultuurfonds', '58 dagen'],
        ].map(([naam, dagen]) => (
          <div key={naam} style={css('display: flex; align-items: center; justify-content: space-between; gap: 10px;')}>
            <span style={css('font-weight: 700; color: #2C4A5E; min-width: 0;')}>{naam}</span>
            <span style={css('display: flex; align-items: center; gap: 8px; flex-shrink: 0; color: #687974;')}>
              {dagen}
              <span style={css('width: 30px; height: 17px; border-radius: 999px; background: #4E9A6C; position: relative; display: inline-block;')}>
                <span style={css('position: absolute; right: 2px; top: 2px; width: 13px; height: 13px; border-radius: 50%; background: #FFFFFF;')} />
              </span>
            </span>
          </div>
        ))}
        <div style={css('font-size: 12px; color: #687974;')}>Herinnering per e-mail vóór de deadline</div>
      </div>
    );
  }

  return (
    <div style={css(kader)} aria-hidden="true">
      {[
        ['✓', '#4E9A6C', 'Heldere doelstelling en doelgroep'],
        ['✓', '#4E9A6C', 'Begroting sluit en is onderbouwd'],
        ['!', '#C98A2B', 'Maak de impact meetbaar met concrete indicatoren'],
      ].map(([teken, kleur, tekst]) => (
        <div key={tekst} style={css('display: flex; gap: 9px; align-items: flex-start;')}>
          <span style={css(`flex-shrink: 0; width: 17px; height: 17px; border-radius: 50%; background: ${kleur}; color: #FFFFFF; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center;`)}>
            {teken}
          </span>
          <span>{tekst}</span>
        </div>
      ))}
    </div>
  );
}

export default function HoeHetWerktPage() {
  const app = useApp();
  // Alleen wie is ingelogd heeft een huidig abonnement; een bezoeker zonder account ziet bij Free de knop Gratis starten.
  const ingelogd = Boolean(app.isLoggedIn);
  const tier = ingelogd ? app.subscriptionTier || 'free' : null;
  // Looptijd voor de prijsweergave: de pagina begint altijd op maandelijks. Alleen weergave.
  const [looptijd, setLooptijd] = useState(STANDAARD_LOOPTIJD);
  const kiesLooptijd = (code) => {
    setLooptijd(code);
    bewaarLooptijd(code);
  };

  // Kiezen van Pro of Premium start NOOIT iets. Het onthoudt alleen de keuze
  // (intentie PRO of PREMIUM, uitsluitend UX) en brengt de bezoeker naar
  // /kompas/abonneren, waar uitleg staat en - eventueel na inloggen of een
  // account aanmaken - pas na een expliciete bevestiging verder wordt gegaan.
  const kiesPlan = (plan) => {
    const code = intentieVoorTier(plan.tier);

    if (!code) {
      return;
    }

    bewaarIntentie(code, looptijd);
    naar(abonnerenHash(code, looptijd));
  };

  const naarAbonnementen = () => {
    const el = typeof document !== 'undefined' ? document.getElementById('abonnementen') : null;

    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <KompasSubnav actief="werkt" toonPlan />

      {/* HERO */}
      <div style={css('max-width: 1180px; margin: 0 auto; padding: clamp(40px, 6vw, 72px) clamp(16px, 4vw, 24px) clamp(34px, 4.6vw, 56px); display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: clamp(28px, 4vw, 56px); align-items: center;')}>
        <div>
        <div style={css('display: inline-flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-size: 13px; font-weight: 700; margin-bottom: 20px;')}>
          <img src="/uploads/kompas-logo.png" alt="" style={css('width: 26px; height: 26px; border-radius: 50%; object-fit: contain; display: block;')} />
          Subsidie Kompas
        </div>

        <h1 style={css("margin: 0 0 18px; font-family: 'Newsreader', serif; font-size: clamp(32px, 5.4vw, 52px); font-weight: 600; color: #2C4A5E; line-height: 1.12; max-width: 640px; text-wrap: balance;")}>
          Sneller werken, scherper aanvragen, meer impact maken.
        </h1>

        <p style={css('margin: 0 0 28px; font-size: 17.5px; line-height: 1.65; color: #4B5C58; max-width: 620px;')}>
          Subsidie Kompas is uw werkplek voor fondsenwerving: passende fondsen vinden, een dekkingsplan opstellen, deadlines bewaken en uw aanvraag schrijven en toetsen.
        </p>

        <div style={css('display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 34px;')}>
          <a href="#/subsidie-kompas" style={css('display: inline-block; padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px;')}>
            Ontdek Subsidie Kompas →
          </a>
          <button
            type="button"
            onClick={naarAbonnementen}
            style={css("cursor: pointer; padding: 14px 28px; border: 1px solid #C9D8D0; background: #FFFFFF; color: #2C4A5E; border-radius: 999px; font-family: 'Mulish', sans-serif; font-weight: 700; font-size: 16px;")}
          >
            Bekijk de abonnementen
          </button>
        </div>

        <div style={css('display: flex; flex-wrap: wrap; gap: 12px 34px;')}>
          <div>
            <div style={css("font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E; line-height: 1.1;")}>
              <FundingDatabaseCount />
            </div>
            <div style={css('margin-top: 3px; font-size: 13px; font-weight: 700; color: #687974;')}>fondsen en regelingen</div>
          </div>
          <div>
            <div style={css("font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E; line-height: 1.1;")}>Dagelijks</div>
            <div style={css('margin-top: 3px; font-size: 13px; font-weight: 700; color: #687974;')}>actuele deadlines</div>
          </div>
        </div>
        </div>

        <WerkplekFilm />
      </div>

      {/* VIER STAPPEN */}
      <div style={css('position: relative; overflow: hidden; background: #FFFFFF; border-top: 1px solid #E9EFEB; border-bottom: 1px solid #E9EFEB; padding: clamp(40px, 5.6vw, 76px) 0;')}>
        <KompasAchtergrond />
        <div style={css('position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px);')}>
          <div style={css('margin-bottom: clamp(24px, 3vw, 38px); max-width: 720px;')}>
            <div style={css('margin-bottom: 12px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.12em; color: #4E9A6C;')}>ZO WERKT HET</div>
            <div style={css("font-family: 'Newsreader', serif; font-size: clamp(26px, 4vw, 36px); font-weight: 600; color: #2C4A5E; line-height: 1.18; text-wrap: balance;")}>
              Subsidie Kompas: uw subsidieadviseur en fondsenwervingsexpert
            </div>
          </div>

          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 18px;')}>
            {STAPPEN.map((s) => (
              <div key={s.n} style={css('background: #FFFFFF; border: 1px solid #E4EBE7; border-radius: 20px; padding: clamp(20px, 2.4vw, 26px); display: flex; flex-direction: column; gap: 14px;')}>
                <div style={css('display: flex; align-items: center; gap: 12px;')}>
                  <span style={css("width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; background: #EAF1F6; display: flex; align-items: center; justify-content: center; font-family: 'Newsreader', serif; font-size: 17px; font-weight: 600; color: #2C4A5E;")}>
                    {s.n}
                  </span>
                  <span style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; line-height: 1.25;")}>{s.titel}</span>
                </div>
                <div style={css('font-size: 15.5px; line-height: 1.65; color: #4B5C58;')}>{s.tekst}</div>
                <Voorbeeld soort={s.voorbeeld} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ABONNEMENTEN */}
      <div id="abonnementen" style={css('max-width: 1180px; margin: 0 auto; padding: clamp(44px, 6vw, 80px) clamp(16px, 4vw, 24px) 0; text-align: center; scroll-margin-top: 16px;')}>
        <div style={css("font-family: 'Newsreader', serif; font-size: clamp(28px, 4.4vw, 40px); font-weight: 600; color: #2C4A5E; line-height: 1.15; margin: 0 auto;")}>
          Subsidie Kompas als uw rechterhand
        </div>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: clamp(22px, 3vw, 30px) clamp(16px, 4vw, 24px) 0; text-align: center;')}>
        <LooptijdSchakelaar waarde={looptijd} onChange={kiesLooptijd} />
      </div>

      <div
        style={css(
          'max-width: 1180px; margin: 0 auto; padding: clamp(28px, 3.6vw, 40px) clamp(16px, 4vw, 24px) clamp(44px, 6vw, 80px); display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 18px; align-items: stretch;',
        )}
      >
        {PLANNEN.map((plan) => {
          const huidig = tier === plan.tier;
          const enterprise = plan.tier === 'enterprise';
          const prijs = plan.tier === 'free' || enterprise ? null : prijsInfo(plan.tier, looptijd);
          const vooruit = Boolean(prijs && prijs.vooruit);
          const ctaTekst = !plan.ctaTekst || !prijs ? plan.ctaTekst : prijs.vooruit ? `Kies ${plan.naam}` : plan.ctaTekst;

          return (
            <div
              key={plan.tier}
              style={css(`
                position: relative;
                background: #FFFFFF;
                border: ${plan.uitgelicht ? '1.5px solid #4E9A6C' : '1px solid #E4EBE7'};
                border-radius: 20px;
                padding: clamp(22px, 2.6vw, 28px);
                display: flex;
                flex-direction: column;
                text-align: left;
              `)}
            >
              {plan.uitgelicht && (
                <div
                  style={css(
                    'position: absolute; top: -14px; left: 50%; transform: translateX(-50%); padding: 6px 16px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; white-space: nowrap;',
                  )}
                >
                  MEEST UITGEBREID
                </div>
              )}

              <div style={css('font-size: 15px; font-weight: 800; color: #4E9A6C; margin-bottom: 10px;')}>{plan.naam}</div>
              <div style={css('display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; min-height: 48px;')}>
                <span style={css(`font-family: 'Newsreader', serif; font-size: ${enterprise ? '30px' : '46px'}; font-weight: 600; color: #2C4A5E; line-height: 1;`)}>
                  {enterprise ? plan.prijsTekst : prijs ? prijs.perMaand : plan.prijs}
                </span>
                {!enterprise && <span style={css('font-size: 14px; color: #6B7B77;')}>per maand</span>}
              </div>
              <div style={css('min-height: 42px; font-size: 13.5px; line-height: 1.5; color: #4B5C58; margin-bottom: 6px;')} data-testid={`prijsregel-${plan.tier}`}>
                {vooruit && prijs.besparingPercentage > 0 ? `Bespaar ${prijs.besparingPercentage}%` : null}
              </div>
              <div style={css('min-height: 22px; font-size: 14px; font-weight: 800; color: #4E9A6C; margin-bottom: 12px;')}>
                {huidig || enterprise ? '' : plan.proefperiode}
              </div>
              <div style={css('min-height: 48px; font-size: 15px; line-height: 1.6; color: #4B5C58; margin-bottom: 22px;')}>{plan.omschrijving}</div>

              {huidig ? (
                <div
                  style={css(
                    'box-sizing: border-box; min-height: 56px; margin-bottom: 24px; padding: 16px 20px; border-radius: 14px; background: #EEF3F6; color: #2C4A5E; font-size: 15px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center;',
                  )}
                >
                  Huidig abonnement
                </div>
              ) : plan.tier === 'free' ? (
                <a
                  href="#/subsidie-kompas"
                  style={css(
                    "box-sizing: border-box; min-height: 56px; margin-bottom: 24px; padding: 16px 20px; border: 1.5px solid #2C4A5E; border-radius: 14px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 15px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center;",
                  )}
                >
                  Gratis starten
                </a>
              ) : enterprise ? (
                <a
                  href={ENTERPRISE_MAIL}
                  style={css(
                    "box-sizing: border-box; min-height: 56px; margin-bottom: 24px; padding: 16px 20px; border: 1.5px solid #2C4A5E; border-radius: 14px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 15px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center;",
                  )}
                >
                  {plan.ctaTekst}
                </a>
              ) : ctaTekst ? (
                <button
                  type="button"
                  onClick={() => kiesPlan(plan)}
                  style={css(`
                    cursor: pointer;
                    box-sizing: border-box;
                    min-height: 56px;
                    margin-bottom: 24px;
                    padding: 16px 20px;
                    border: none;
                    border-radius: 14px;
                    background: ${plan.tier === 'premium' ? '#2C4A5E' : '#4E9A6C'};
                    color: #FFFFFF;
                    font-family: 'Mulish', sans-serif;
                    font-size: 15px;
                    font-weight: 800;
                    text-align: center;
                  `)}
                >
                  {ctaTekst}
                </button>
              ) : (
                <div style={css('box-sizing: border-box; min-height: 56px; margin-bottom: 24px;')} aria-hidden="true" />
              )}

              <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                {plan.features.map((f) => (
                  <div key={f} style={css('display: flex; gap: 10px; align-items: flex-start;')}>
                    <span style={css('flex-shrink: 0; width: 15px; color: #4E9A6C; font-size: 13px; font-weight: 700; line-height: 1.6;')}>✓</span>
                    <span style={css('font-size: 14px; line-height: 1.6; color: #3D4B48;')}>
                      {f === 'fondsendatabase' ? (
                        <>
                          Toegang tot de volledige Premium-database met <FundingDatabaseCount /> fondsen en regelingen, waaronder fondsen die elders moeilijk te vinden zijn
                        </>
                      ) : (
                        f
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={css('background: #2C4A5E; padding: clamp(32px, 4.6vw, 56px) 0;')}>
        <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px); display: flex; align-items: center; justify-content: space-between; gap: 22px; flex-wrap: wrap;')}>
          <div style={css("flex: 1 1 320px; min-width: 0; font-family: 'Newsreader', serif; font-size: clamp(22px, 3vw, 30px); font-weight: 600; color: #FFFFFF; line-height: 1.25; text-wrap: balance;")}>
            Begin vandaag met meer vertrouwen in uw werk en meer impact.
          </div>

          <div style={css('display: flex; gap: 12px; flex-wrap: wrap;')}>
            <a href="#/subsidie-kompas" style={css('padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;')}>
              Gratis starten
            </a>
            <a href="#/kompas/faq" style={css('padding: 15px 28px; border: 1px solid rgba(255,255,255,0.4); color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;')}>
              Veelgestelde vragen
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
