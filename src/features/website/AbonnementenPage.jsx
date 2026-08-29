import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: 'per maand',
    trial: null,
    tagline: 'Ontdek welke subsidiemogelijkheden er zijn.',
    highlight: false,
    features: [
      'AI-chat met Subsidie Kompas',
      'Actuele websearch naar fondsen en subsidieregelingen',
      'Fondsenscans',
      'Matchchecks',
      'Projectplanadvies',
      'Subsidiebeoordelingen',
      'SMART-doelen opstellen',
      'Begrotingen beoordelen',
      'Feedback op subsidieaanvragen',
      'Fondsenwervende strategieën in tekst',
    ],
    limitations: [
      'Geen documentgeneratie',
      'Geen exports',
      'Geen chatgeschiedenis',
      'Geen kennisbank',
      'Geen organisatiegeheugen',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€12',
    period: 'per maand',
    trial: '7 dagen gratis proberen',
    tagline: 'Professionele documenten in uw eigen huisstijl.',
    highlight: true,
    features: [
      'Alles uit Free',
      'Gesprekken opslaan en hervatten',
      'Word-documenten genereren',
      'PDF-documenten genereren',
      'Excel-export',
      'Professionele subsidieadviezen',
      'Projectplannen en fondsenscans',
      'Bestanden uploaden',
      'Eigen logo en organisatienaam',
      'Eigen Word-template',
      'Eigen kleuren en basis-huisstijl',
      'Persoonlijke schrijfvoorkeuren',
    ],
    limitations: [],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '€39',
    period: 'per maand',
    trial: '24 uur gratis proberen',
    tagline: 'Uw eigen AI-fondsenwerver die uw organisatie kent.',
    highlight: false,
    premium: true,
    features: [
      'Alles uit Pro',
      'Uitgebreide exclusieve fondsendatabase',
      'Adviezen op basis van internet én de uitgebreide fondsendatabase',
      'Eigen kennisbank',
      'Organisatieprofiel',
      'Organisatiegeheugen',
      'Eigen tone of voice',
      'Eigen Word-, Excel- en PowerPoint-templates',
      'Uitgebreid huisstijlcentrum',
      'AI gebruikt eerdere aanvragen en documenten als context',
      'Geavanceerde fondsselecties en analyses',
      'Meerjarige fondsenstrategieën en Excel-planningen',
    ],
    limitations: [],
  },
];

export default function AbonnementenPage() {
  const app = useApp();

  if (!app.isAbonnementen) {
    return null;
  }

  const getButtonText = (plan) => {
    if (app.subscriptionTier === plan.id) {
      return 'Huidig abonnement';
    }

    if (plan.id === 'free') {
      return app.isLoggedIn ? 'Free gebruiken' : 'Gratis beginnen';
    }

    if (plan.id === 'pro') {
      return 'Start 7 dagen gratis';
    }

    return 'Probeer Premium 24 uur';
  };

  const handlePlanClick = (plan) => {
    if (app.subscriptionTier === plan.id) {
      return;
    }

    if (!app.isLoggedIn) {
      app.showRegister();

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth',
      });

      return;
    }

    if (plan.id === 'free') {
      window.alert('U gebruikt momenteel het gratis abonnement.');
      return;
    }

    /*
      Hier koppelen we later Stripe aan.

      Pro:
      startCheckout('pro')

      Premium:
      startCheckout('premium')
    */
    window.alert(
      plan.id === 'pro'
        ? 'De 7-daagse Pro-proefperiode wordt binnenkort geactiveerd.'
        : 'De 24-uurs Premium-proefperiode wordt binnenkort geactiveerd.',
    );
  };

  return (
    <main
      style={css(`
        min-height: 100vh;
        padding: clamp(32px, 6vw, 72px) 24px clamp(50px, 6vw, 110px);
        background:
          radial-gradient(
            circle at 50% 0%,
            rgba(169, 201, 222, 0.20),
            transparent 34%
          ),
          #F7F9F8;
      `)}
    >
      <style>{`
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .plan-card {
          transition:
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .plan-card:hover {
          transform: translateY(-4px);
        }

        .plan-button {
          transition:
            transform 160ms ease,
            opacity 160ms ease;
        }

        .plan-button:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .premium-explanation {
          grid-template-columns:
            minmax(0, 0.9fr)
            minmax(0, 1.1fr);
        }

        @media (max-width: 940px) {
          .plans-grid {
            grid-template-columns: 1fr;
            max-width: 650px;
            margin-left: auto;
            margin-right: auto;
          }
        }

        @media (max-width: 760px) {
          .premium-explanation {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 620px) {
          .subscriptions-page {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .subscription-header-title {
            font-size: clamp(26px, 5.3vw, 42px) !important;
          }
        }
      `}</style>

      <div
        className="subscriptions-page"
        style={css(`
          max-width: 1180px;
          margin: 0 auto;
        `)}
      >
        {/* TERUG */}
        <button
          type="button"
          onClick={app.goHome}
          style={css(`
            margin-bottom: 42px;
            padding: 0;
            border: none;
            background: transparent;
            color: #2C4A5E;
            font-family: inherit;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
          `)}
        >
          ← Terug naar Het Fondsenwervers Collectief
        </button>

        {/* HEADER */}
        <section
          style={css(`
            max-width: 810px;
            margin: 0 auto 54px;
            text-align: center;
          `)}
        >
          <div
            style={css(`
              margin-bottom: 14px;
              color: #4E9A6C;
              font-size: 13px;
              font-weight: 900;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            `)}
          >
            Subsidie Kompas
          </div>

          <h1
            className="subscription-header-title"
            style={css(`
              margin: 0;
              font-family: 'Newsreader', serif;
              font-size: clamp(44px, 6vw, 68px);
              font-weight: 600;
              line-height: 1.05;
              color: #2C4A5E;
            `)}
          >
            Kies het abonnement dat bij u past
          </h1>

          <p
            style={css(`
              max-width: 700px;
              margin: 22px auto 0;
              color: #5F716C;
              font-size: 17px;
              line-height: 1.7;
            `)}
          >
            Start gratis, genereer met Pro professionele documenten of maak
            van Subsidie Kompas met Premium uw persoonlijke AI-fondsenwerver.
          </p>

          {app.isLoggedIn ? (
            <div
              style={css(`
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin-top: 22px;
                padding: 8px 13px;
                border: 1px solid #DCE5E1;
                border-radius: 999px;
                background: rgba(255,255,255,0.82);
                color: #60736D;
                font-size: 12px;
                font-weight: 800;
              `)}
            >
              Huidig abonnement:

              <span
                style={css(`
                  color: #2C4A5E;
                  text-transform: capitalize;
                `)}
              >
                {app.subscriptionTier}
              </span>
            </div>
          ) : null}
        </section>

        {/* ABONNEMENTEN */}
        <section className="plans-grid">
          {PLANS.map((plan) => {
            const isCurrent =
              app.isLoggedIn &&
              app.subscriptionTier === plan.id;

            return (
              <article
                key={plan.id}
                className="plan-card"
                style={css(`
                  position: relative;
                  min-height: 100%;
                  padding: 30px;
                  display: flex;
                  flex-direction: column;

                  border: ${
                    plan.highlight
                      ? '2px solid #4E9A6C'
                      : plan.premium
                        ? '2px solid #2C4A5E'
                        : '1px solid #DCE5E1'
                  };

                  border-radius: 26px;
                  background: #FFFFFF;

                  box-shadow: ${
                    plan.highlight
                      ? '0 20px 50px rgba(78,154,108,0.14)'
                      : '0 14px 38px rgba(44,74,94,0.07)'
                  };
                `)}
              >
                {plan.highlight ? (
                  <div
                    style={css(`
                      position: absolute;
                      top: -14px;
                      left: 50%;
                      transform: translateX(-50%);
                      padding: 7px 14px;
                      border-radius: 999px;
                      background: #4E9A6C;
                      color: #FFFFFF;
                      font-size: 11px;
                      font-weight: 900;
                      letter-spacing: 0.08em;
                      text-transform: uppercase;
                      white-space: nowrap;
                    `)}
                  >
                    Meest gekozen
                  </div>
                ) : null}

                {plan.premium ? (
                  <div
                    style={css(`
                      display: inline-flex;
                      align-self: flex-start;
                      margin-bottom: 14px;
                      padding: 6px 10px;
                      border-radius: 999px;
                      background: #EAF1F6;
                      color: #2C4A5E;
                      font-size: 11px;
                      font-weight: 900;
                      letter-spacing: 0.05em;
                      text-transform: uppercase;
                    `)}
                  >
                    AI-fondsenwerver
                  </div>
                ) : null}

                <div
                  style={css(`
                    color: ${
                      plan.premium
                        ? '#2C4A5E'
                        : '#4E9A6C'
                    };
                    font-size: 15px;
                    font-weight: 900;
                  `)}
                >
                  {plan.name}
                </div>

                <div
                  style={css(`
                    margin-top: 12px;
                    display: flex;
                    align-items: baseline;
                    gap: 7px;
                  `)}
                >
                  <span
                    style={css(`
                      font-family: 'Newsreader', serif;
                      color: #2C4A5E;
                      font-size: clamp(30px, 6vw, 48px);
                      font-weight: 600;
                      line-height: 1;
                    `)}
                  >
                    {plan.price}
                  </span>

                  <span
                    style={css(`
                      color: #7B8985;
                      font-size: 12px;
                    `)}
                  >
                    {plan.period}
                  </span>
                </div>

                {plan.trial ? (
                  <div
                    style={css(`
                      margin-top: 12px;
                      color: #4E9A6C;
                      font-size: 13px;
                      font-weight: 900;
                    `)}
                  >
                    {plan.trial}
                  </div>
                ) : (
                  <div
                    style={css(`
                      margin-top: 12px;
                      color: #84908D;
                      font-size: 13px;
                      font-weight: 700;
                    `)}
                  >
                    Gratis, zonder proefperiode
                  </div>
                )}

                <p
                  style={css(`
                    min-height: 58px;
                    margin: 22px 0;
                    color: #5F716C;
                    font-size: 14px;
                    line-height: 1.6;
                  `)}
                >
                  {plan.tagline}
                </p>

                <button
                  className="plan-button"
                  type="button"
                  disabled={isCurrent}
                  onClick={() =>
                    handlePlanClick(plan)
                  }
                  style={css(`
                    width: 100%;
                    min-height: 48px;
                    padding: 12px 18px;
                    border: none;
                    border-radius: 14px;

                    background: ${
                      isCurrent
                        ? '#DDE5E1'
                        : plan.premium
                          ? '#2C4A5E'
                          : plan.highlight
                            ? '#4E9A6C'
                            : '#EAF1F6'
                    };

                    color: ${
                      isCurrent || plan.id === 'free'
                        ? '#53635F'
                        : '#FFFFFF'
                    };

                    font-family: inherit;
                    font-size: 13px;
                    font-weight: 900;

                    cursor: ${
                      isCurrent
                        ? 'default'
                        : 'pointer'
                    };

                    opacity: ${
                      isCurrent
                        ? '0.82'
                        : '1'
                    };
                  `)}
                >
                  {getButtonText(plan)}
                </button>

                <div
                  style={css(`
                    margin: 27px 0 15px;
                    color: #2C4A5E;
                    font-size: 12px;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                  `)}
                >
                  Inbegrepen
                </div>

                <div
                  style={css(`
                    display: flex;
                    flex-direction: column;
                    gap: 11px;
                  `)}
                >
                  {plan.features.map(
                    (feature) => (
                      <Feature
                        key={feature}
                        text={feature}
                        included
                      />
                    ),
                  )}

                  {plan.limitations.map(
                    (feature) => (
                      <Feature
                        key={feature}
                        text={feature}
                        included={false}
                      />
                    ),
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* PREMIUM DATABASE UITLEG */}
        <section
          className="premium-explanation"
          style={css(`
            margin-top: 70px;
            padding: clamp(28px, 5vw, 52px);
            display: grid;
            gap: 42px;
            align-items: center;
            border-radius: 30px;
            background: #2C4A5E;
            color: #FFFFFF;
          `)}
        >
          <div>
            <div
              style={css(`
                margin-bottom: 10px;
                color: #A9C9DE;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: 0.1em;
                text-transform: uppercase;
              `)}
            >
              Premium
            </div>

            <h2
              style={css(`
                margin: 0;
                font-family: 'Newsreader', serif;
                font-size: clamp(32px, 4vw, 46px);
                font-weight: 600;
                line-height: 1.08;
              `)}
            >
              Meer dan alleen een internetzoekopdracht
            </h2>
          </div>

          <div
            style={css(`
              color: rgba(255,255,255,0.86);
              font-size: 15px;
              line-height: 1.75;
            `)}
          >
            Subsidie Kompas Premium combineert actuele online informatie
            met een uitgebreide exclusieve fondsendatabase. De database
            bevat fondsen, stichtingen, gemeenten, serviceclubs en
            religieuze instellingen.
            <br />
            <br />
            Hierdoor kan Subsidie Kompas financieringsmogelijkheden
            signaleren en vergelijken op basis van meer dan alleen
            openbare internetinformatie.
            <br />
            <br />
            In combinatie met uw eigen kennisbank, organisatieprofiel,
            tone of voice en eerdere documenten ontstaat een
            AI-fondsenwerver die uw organisatie en context steeds beter
            kent.
          </div>
        </section>

        <div
          style={css(`
            max-width: 760px;
            margin: 34px auto 0;
            color: #7B8985;
            font-size: 11.5px;
            line-height: 1.6;
            text-align: center;
          `)}
        >
          Abonnementen kunnen later worden gewijzigd of opgezegd.
        </div>
      </div>
    </main>
  );
}

function Feature({
  text,
  included,
}) {
  return (
    <div
      style={css(`
        display: flex;
        align-items: flex-start;
        gap: 10px;
        color: ${
          included
            ? '#435651'
            : '#9AA5A1'
        };
        font-size: 13px;
        line-height: 1.5;
      `)}
    >
      <span
        style={css(`
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;

          background: ${
            included
              ? '#EAF4EE'
              : '#F0F2F1'
          };

          color: ${
            included
              ? '#4E9A6C'
              : '#9DA6A3'
          };

          font-size: 11px;
          font-weight: 900;
        `)}
      >
        {included ? '✓' : '–'}
      </span>

      <span>{text}</span>
    </div>
  );
}
