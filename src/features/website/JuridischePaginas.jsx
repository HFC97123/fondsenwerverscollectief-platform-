// Privacy en Voorwaarden. Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Privacy" en "Voorwaarden").
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const PRIVACY = {
  label: 'Privacy',
  titel: 'Hoe wij met uw gegevens omgaan',
  intro:
    'Het Fondsenwervers Collectief verwerkt gegevens van leden om het platform en Subsidie Kompas te kunnen aanbieden. Hieronder staat welke gegevens dat zijn, waarvoor wij ze gebruiken en welke rechten u heeft.',
  secties: [
    {
      kop: 'Welke gegevens wij verwerken',
      tekst:
        'Van leden bewaren wij naam, e-mailadres, organisatie en het type lidmaatschap. Gebruikt u Subsidie Kompas, dan bewaren wij daarnaast uw organisatieprofiel, uw projecten, de documenten die u uploadt en de gesprekken die u met de assistent voert.',
    },
    {
      kop: 'Waarvoor wij ze gebruiken',
      tekst:
        'Uw gegevens dienen om u toegang te geven tot het platform, om fondsselecties en adviezen op uw organisatie af te stemmen en om u te informeren over bijeenkomsten en deadlines. Wij verkopen geen gegevens en delen ze niet met derden voor commerciële doeleinden.',
    },
    {
      kop: 'Zichtbaarheid voor andere leden',
      tekst:
        'U bepaalt zelf of u zichtbaar bent voor andere leden. In uw profiel staat een schuifknop waarmee u dat aan- en uitzet. Uw contactgegevens deelt u altijd zelf; zij worden niet automatisch getoond.',
    },
    {
      kop: 'Bewaartermijn en verwijderen',
      tekst:
        'U kunt uw gesprekken en de informatie over uw organisatie op elk moment verwijderen via uw Subsidie Kompas-account. Zegt u uw lidmaatschap op, dan verwijderen wij uw profiel en uw inhoud, behalve wat wij wettelijk moeten bewaren voor de administratie.',
    },
    {
      kop: 'Verwerkers',
      tekst:
        'Wij werken met dienstverleners voor hosting, database en e-mail. Zij verwerken gegevens uitsluitend in onze opdracht en op basis van een verwerkersovereenkomst.',
    },
    {
      kop: 'Uw rechten',
      tekst:
        'U heeft recht op inzage, correctie en verwijdering van uw gegevens, en u kunt bezwaar maken tegen verwerking. Neem daarvoor contact met ons op via de contactpagina. U kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.',
    },
  ],
};

const VOORWAARDEN = {
  label: 'Voorwaarden',
  titel: 'Voorwaarden voor lidmaatschap en Subsidie Kompas',
  intro:
    'Deze voorwaarden gelden voor het lidmaatschap van Het Fondsenwervers Collectief en voor het gebruik van Subsidie Kompas.',
  secties: [
    {
      kop: 'Lidmaatschap',
      tekst:
        'Een lidmaatschap is persoonlijk en bedoeld voor fondsenwervers en organisaties die zich met fondsenwerving en subsidies bezighouden. Na het aanmaken van een account heeft u direct toegang tot de ledencontent.',
    },
    {
      kop: 'Abonnementen op Subsidie Kompas',
      tekst:
        'Subsidie Kompas kent drie vormen: Free, Pro en Premium. Een proefperiode gaat na afloop over in een betaald abonnement, tenzij u vóór het einde opzegt. Opzeggen kan per maand via uw account.',
    },
    {
      kop: 'De fondsendatabase',
      tekst:
        'De informatie in de fondsendatabase is met zorg samengesteld, maar voorwaarden, bedragen en deadlines veranderen. Controleer voor het indienen van een aanvraag altijd de actuele informatie bij de verstrekker zelf.',
    },
    {
      kop: 'Adviezen van de assistent',
      tekst:
        'Subsidie Kompas geeft advies op basis van beschikbare informatie en uw eigen gegevens. Die adviezen zijn een hulpmiddel, geen garantie op toekenning, en vervangen geen juridisch of fiscaal advies.',
    },
    {
      kop: 'Uw inhoud',
      tekst:
        'Wat u uploadt of invoert blijft van u. U geeft ons het recht die inhoud te gebruiken om u te kunnen adviseren. Wij gebruiken uw inhoud niet om modellen van derden te trainen.',
    },
    {
      kop: 'Gebruik van het platform',
      tekst:
        'Deel uw inloggegevens niet, plaats geen onrechtmatige of beledigende inhoud en gebruik gegevens van andere leden niet voor ongevraagde commerciële berichten. Bij misbruik kunnen wij toegang beëindigen.',
    },
  ],
};

function JuridischePagina({ data, label }) {
  return (
    <div data-screen-label={label}>
      <div
        style={css(
          'max-width: 1180px; margin: 0 auto; padding: clamp(34px, 5.5vw, 56px) clamp(16px, 4vw, 32px) clamp(48px, 7vw, 84px);',
        )}
      >
        <div style={css('margin-bottom: 30px;')}>
          <div
            style={css(
              'font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px;',
            )}
          >
            {data.label}
          </div>
          <div
            style={css(
              "font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.18; margin-bottom: 18px; max-width: 720px; text-wrap: balance;",
            )}
          >
            {data.titel}
          </div>
          <div style={css('font-size: 17px; line-height: 1.7; color: #4B5C58; max-width: 680px;')}>{data.intro}</div>
          <div style={css('margin-top: 14px; font-size: 13.5px; color: #7B8985;')}>Laatst bijgewerkt: augustus 2026</div>
        </div>

        <div style={css('display: flex; flex-direction: column; gap: 26px; max-width: 720px;')}>
          {data.secties.map((s) => (
            <div key={s.kop}>
              <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #2C4A5E;")}>
                {s.kop}
              </div>
              <div style={css('font-size: 15.5px; line-height: 1.75; color: #4B5C58; text-wrap: pretty;')}>{s.tekst}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  const { isPrivacy } = useApp();

  if (!isPrivacy) return null;

  return <JuridischePagina data={PRIVACY} label="Privacy" />;
}

export function VoorwaardenPage() {
  const { isVoorwaarden } = useApp();

  if (!isVoorwaarden) return null;

  return <JuridischePagina data={VOORWAARDEN} label="Voorwaarden" />;
}

// Beide pagina's in één ingang; elke pagina toont zichzelf op basis van de
// vlaggen uit WebsiteProvider.
export default function JuridischePaginas() {
  return (
    <>
      <PrivacyPage />
      <VoorwaardenPage />
    </>
  );
}
