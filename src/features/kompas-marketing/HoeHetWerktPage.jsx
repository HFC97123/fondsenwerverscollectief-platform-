// Hoe het werkt: wat Subsidie Kompas doet, de vijf stappen, en waarom Premium.
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from '../kompas-app/useKompasApp.js';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import { useStappen } from './useMarketingContent.js';

const WAT_HET_DOET = [
  'Zoekt gericht naar passende fondsen en subsidies',
  'Zoekt met Premium ook in de exclusieve fondsendatabase',
  'Brengt financiering, voorwaarden en deadlines helder in beeld',
  'Adviseert over kansrijkheid en fondsenwervende strategie',
  'Ondersteunt bij een sterke aanvraag: positionering, projectplan en begroting',
  'Leert van praktijkcases: toegekende en afgewezen aanvragen uit het Collectief',
];

export const STAPPEN_STANDAARD = [
  {
    n: '01',
    titel: 'Vertellen',
    tekst:
      'Beschrijf in gewone taal uw organisatie, uw project en uw financieringsbehoefte. Subsidie Kompas stelt vervolgens de vragen die een ervaren fondsenwerver ook zou stellen: doelgroep, beoogd resultaat, looptijd, samenwerking en de dekking die u al heeft.',
  },
  {
    n: '02',
    titel: 'Onderzoeken',
    tag: 'PREMIUM',
    tekst:
      'Subsidie Kompas zoekt in actuele online bronnen en met Premium ook in de exclusieve fondsendatabase. Daarin zitten ook private fondsen en regelingen die online moeilijk vindbaar zijn of hun voorwaarden nergens volledig publiceren.',
  },
  {
    n: '03',
    titel: 'Adviseren',
    tekst:
      'U krijgt zicht op de kansrijkheid van uw project: welke fondsen passen bij uw thema, regio en omvang, welk bedrag realistisch is om te vragen en waar uw verhaal nog onderbouwing mist.',
  },
  {
    n: '04',
    titel: 'Plannen',
    tekst:
      'Een concreet actieplan: welke fondsen in welke volgorde, met voorwaarden, aan te vragen bedragen en deadlines. Doorlopende regelingen en aankomende openingsrondes staan er direct bij, zodat uw dekkingsplan sluit.',
  },
  {
    n: '05',
    titel: 'Aanvragen',
    tekst:
      'Begeleiding bij een sterke aanvraag: positionering, projectplan, begroting en dekkingsplan, per fonds toegespitst op de criteria en geschreven in de toon van uw organisatie. Wat u indient en wat wordt toegekend blijft bewaard voor de volgende aanvraag.',
  },
];

export default function HoeHetWerktPage() {
  const app = useApp();
  const STAPPEN = useStappen() || STAPPEN_STANDAARD;

  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <div style={css('max-width: 1180px; margin: 0 auto; padding: clamp(40px, 6vw, 66px) clamp(16px, 4vw, 24px) clamp(26px, 3.4vw, 38px);')}>
        <h1 style={css("margin: 0 0 18px; font-family: 'Newsreader', serif; font-size: clamp(30px, 5vw, 46px); font-weight: 600; color: #2C4A5E; line-height: 1.15; max-width: 820px; text-wrap: balance;")}>
          Uw subsidieadviseur en fondsenwerver in één
        </h1>

        <p style={css("margin: 0 0 20px; font-family: 'Newsreader', serif; font-size: clamp(19px, 2.3vw, 24px); font-weight: 500; line-height: 1.45; color: #4E9A6C; max-width: 660px;")}>
          Sneller werken, scherper aanvragen, meer impact maken.
        </p>

        <p style={css('margin: 0 0 30px; font-size: 18px; line-height: 1.65; color: #4B5C58; max-width: 660px;')}>
          Subsidie Kompas verkort de weg van eerste idee naar ingediende aanvraag.
        </p>

        <div style={css('display: flex; flex-wrap: wrap; gap: 12px 34px;')}>
          <div>
            <div style={css("font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E; line-height: 1.1;")}>
              <FundingDatabaseCount />
            </div>
            <div style={css('margin-top: 3px; font-size: 13px; font-weight: 700; color: #687974;')}>
              fondsen en regelingen
            </div>
          </div>
          <div>
            <div style={css("font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E; line-height: 1.1;")}>
              Dagelijks
            </div>
            <div style={css('margin-top: 3px; font-size: 13px; font-weight: 700; color: #687974;')}>
              actuele deadlines
            </div>
          </div>
        </div>
      </div>

      <div style={css('background: #2C4A5E; margin-top: clamp(28px, 4vw, 46px); padding: clamp(38px, 5.4vw, 74px) 0;')}>
        <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px); display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: clamp(28px, 4vw, 52px); align-items: center;')}>
          <div>
            <div style={css('display: inline-flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; border-radius: 999px; background: rgba(255,255,255,0.12); color: #FFFFFF; font-size: 13px; font-weight: 700; margin-bottom: 18px;')}>
              <img
                src="/uploads/kompas-logo.png"
                alt="Subsidie Kompas"
                style={css('width: 26px; height: 26px; border-radius: 50%; object-fit: contain; display: block;')}
              />
              Subsidie Kompas
            </div>

            <div style={css("margin-bottom: 26px; font-family: 'Newsreader', serif; font-size: clamp(26px, 3.4vw, 34px); font-weight: 600; color: #FFFFFF; line-height: 1.2;")}>
              Wat Subsidie Kompas voor u doet
            </div>

            <div style={css('display: flex; flex-direction: column; gap: 15px; margin-bottom: 32px;')}>
              {WAT_HET_DOET.map((t) => (
                <div key={t} style={css('display: flex; gap: 13px; align-items: flex-start;')}>
                  <div style={css('width: 7px; height: 7px; border-radius: 50%; background: #A8D5BA; margin-top: 8px; flex-shrink: 0;')} />
                  <div style={css('font-size: 15.5px; line-height: 1.5; color: #EAF1F5; font-weight: 600;')}>{t}</div>
                </div>
              ))}
            </div>

            <a
              href="#/subsidie-kompas"
              style={css('display: inline-block; padding: 15px 30px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px;')}
            >
              Probeer Subsidie Kompas →
            </a>
          </div>

          <div style={css('background: #F7F9F8; border-radius: 22px; padding: 22px; display: flex; flex-direction: column; gap: 12px;')}>
            <div style={css('display: flex; align-items: center; gap: 10px; padding: 0 4px;')}>
              <img
                src="/uploads/kompas-logo.png"
                alt="Subsidie Kompas"
                style={css('width: 32px; height: 32px; border-radius: 50%; object-fit: contain; flex-shrink: 0; display: block;')}
              />
              <div style={css('font-weight: 700; color: #2C4A5E; font-size: 14.5px;')}>Subsidie Kompas</div>
              <div style={css('width: 7px; height: 7px; border-radius: 50%; background: #4E9A6C; margin-left: 2px;')} />
              <div style={css('font-size: 12.5px; color: #4B5C58;')}>online</div>
            </div>
            <div style={css('align-self: flex-end; max-width: 88%; background: #2C4A5E; color: #FFFFFF; padding: 12px 16px; border-radius: 16px 16px 4px 16px; font-size: 14.5px; line-height: 1.5;')}>
              Theaterprogramma over de Tweede Wereldoorlog, 12 tot 16 jaar, Gelderland. Budget €80.000.
            </div>
            <div style={css('align-self: flex-start; max-width: 92%; background: #FFFFFF; border: 1px solid #E4EBE7; color: #2E3A38; padding: 12px 16px; border-radius: 16px 16px 16px 4px; font-size: 14.5px; line-height: 1.55;')}>
              Kansrijk: educatie én herinneringscultuur. Is de samenwerking met scholen al vastgelegd?
            </div>
          </div>
        </div>
      </div>

      <div style={css('background: #FFFFFF; border-top: 1px solid #E9EFEB; border-bottom: 1px solid #E9EFEB; padding: clamp(44px, 6vw, 84px) 0;')}>
        <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px);')}>
          <div style={css('margin-bottom: clamp(30px, 3.6vw, 46px); max-width: 680px;')}>
            <div style={css('margin-bottom: 14px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.12em; color: #4E9A6C;')}>
              ZO WERKT HET
            </div>
            <div style={css("font-family: 'Newsreader', serif; font-size: clamp(27px, 4.2vw, 38px); font-weight: 600; color: #2C4A5E; line-height: 1.15; text-wrap: balance;")}>
              Van eerste vraag naar ingediende aanvraag, in vijf stappen
            </div>
          </div>

          {STAPPEN.map((s, i) => {
            const laatste = i === STAPPEN.length - 1;

            return (
              <div key={s.n} style={css('display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: clamp(16px, 2.2vw, 30px); align-items: start;')}>
                <div style={css('display: flex; flex-direction: column; align-items: center; align-self: stretch;')}>
                  <div style={css("width: 52px; height: 52px; flex-shrink: 0; border-radius: 50%; background: #EAF1F6; display: flex; align-items: center; justify-content: center; font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E;")}>
                    {s.n}
                  </div>
                  {!laatste && <div style={css('flex: 1 1 auto; width: 1px; min-height: 40px; background: #DDE7E2;')} />}
                </div>

                <div style={css(`padding-bottom: ${laatste ? '0' : '34px'};`)}>
                  <div style={css('margin-bottom: 9px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;')}>
                    <span style={css("font-family: 'Newsreader', serif; font-size: clamp(22px, 2.5vw, 27px); font-weight: 600; color: #2C4A5E; line-height: 1.25;")}>
                      {s.titel}
                    </span>
                    {s.tag && (
                      <span style={css('padding: 4px 12px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-size: 11px; font-weight: 800; letter-spacing: 0.06em;')}>
                        {s.tag}
                      </span>
                    )}
                  </div>
                  <div style={css('font-size: 16.5px; line-height: 1.72; color: #4B5C58; max-width: 660px; text-wrap: pretty;')}>
                    {s.tekst}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={css('background: #EAF4EE; border-bottom: 1px solid #D5E6DB; padding: clamp(40px, 5.6vw, 78px) 0;')}>
        <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px); display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: clamp(28px, 4vw, 56px); align-items: center;')}>
          <div>
            <div style={css('font-size: 12.5px; font-weight: 800; color: #4E9A6C; letter-spacing: 0.09em; margin-bottom: 14px;')}>
              PREMIUM
            </div>
            <div style={css("font-family: 'Newsreader', serif; font-size: clamp(24px, 3.2vw, 32px); font-weight: 600; color: #2C4A5E; line-height: 1.18;")}>
              Meer kennis. Betere matches. Sterkere aanvragen.
            </div>
          </div>

          <div style={css('display: flex; flex-direction: column; gap: 20px;')}>
            <p style={css('margin: 0; font-size: 16px; line-height: 1.65; color: #4B5C58;')}>
              Premium doorzoekt naast actuele online informatie een exclusieve database met meer dan{' '}
              <FundingDatabaseCount /> fondsen en subsidieregelingen, waaronder private vermogensfondsen die online
              nauwelijks vindbaar zijn.
            </p>
            <p style={css('margin: 0; font-size: 16px; line-height: 1.65; color: #4B5C58;')}>
              Dat levert completere matches en financieringskansen die een zoekmachine mist.
            </p>
            <p style={css('margin: 0; font-size: 16px; line-height: 1.65; color: #4B5C58;')}>
              Uw organisatieprofiel, documenten en eerdere gesprekken komen daarbij: een AI-fondsenwerver die uw
              organisatie en schrijfstijl kent.
            </p>
          </div>
        </div>
      </div>

      <div style={css('background: #2C4A5E; padding: clamp(36px, 5vw, 66px) 0;')}>
        <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px); display: flex; align-items: center; justify-content: space-between; gap: 26px; flex-wrap: wrap;')}>
          <div style={css('flex: 1 1 320px; min-width: 0;')}>
            <div style={css("margin-bottom: 10px; font-family: 'Newsreader', serif; font-size: clamp(24px, 3.2vw, 32px); font-weight: 600; color: #FFFFFF; line-height: 1.2; text-wrap: balance;")}>
              Begin vandaag met uw eerstvolgende aanvraag
            </div>
            <div style={css('font-size: 16px; line-height: 1.6; color: #C9DAE4; max-width: 520px;')}>
              Gratis starten, Premium 24 uur uitproberen. Uw organisatieprofiel blijft bewaard.
            </div>
          </div>

          <div style={css('display: flex; gap: 12px; flex-wrap: wrap;')}>
            <button
              type="button"
              onClick={app.goAbonnementen}
              style={css("cursor: pointer; padding: 15px 30px; border: none; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-family: 'Mulish', sans-serif; font-weight: 700; font-size: 16px; white-space: nowrap;")}
            >
              Bekijk de abonnementen
            </button>
            <a
              href="#/deadlines"
              style={css('padding: 15px 28px; border: 1px solid rgba(255,255,255,0.4); color: #FFFFFF; border-radius: 999px; font-weight: 700; font-size: 16px; white-space: nowrap;')}
            >
              Bekijk actuele deadlines
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
