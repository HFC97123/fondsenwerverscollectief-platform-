// Privacy en Voorwaarden. Opzetten, nog niet juridisch nagekeken.
import React from 'react';
import { css } from '../../shared/lib/css.js';

const PRIVACY = {
  eyebrow: 'Privacy',
  kop: 'Hoe wij met uw gegevens omgaan',
  intro:
    'Het Fondsenwervers Collectief verwerkt gegevens van leden om het platform en Subsidie Kompas te kunnen aanbieden. Hieronder staat welke gegevens dat zijn, waarvoor wij ze gebruiken en welke rechten u heeft.',
  secties: [
    {
      h: 'Welke gegevens wij verwerken',
      p: 'Van leden bewaren wij naam, e-mailadres, organisatie en het type lidmaatschap. Gebruikt u Subsidie Kompas, dan bewaren wij daarnaast uw organisatieprofiel, uw projecten, de documenten die u uploadt en de gesprekken die u met de assistent voert.',
    },
    {
      h: 'Waarvoor wij ze gebruiken',
      p: 'Uw gegevens dienen om u toegang te geven tot het platform, om fondsselecties en adviezen op uw organisatie af te stemmen en om u te informeren over bijeenkomsten en deadlines. Wij verkopen geen gegevens en delen ze niet met derden voor commerciële doeleinden.',
    },
    {
      h: 'Zichtbaarheid voor andere leden',
      p: 'U bepaalt zelf of u zichtbaar bent voor andere leden. In uw profiel staat een schuifknop waarmee u dat aan- en uitzet. Uw contactgegevens deelt u altijd zelf; zij worden niet automatisch getoond.',
    },
    {
      h: 'Bewaartermijn en verwijderen',
      p: 'U kunt uw gesprekken en de informatie over uw organisatie op elk moment verwijderen via uw Subsidie Kompas-account. Zegt u uw lidmaatschap op, dan verwijderen wij uw profiel en uw inhoud, behalve wat wij wettelijk moeten bewaren voor de administratie.',
    },
    {
      h: 'Verwerkers',
      p: 'Wij werken met dienstverleners voor hosting, database en e-mail. Zij verwerken gegevens uitsluitend in onze opdracht en op basis van een verwerkersovereenkomst.',
    },
    {
      h: 'Uw rechten',
      p: 'U heeft recht op inzage, correctie en verwijdering van uw gegevens, en u kunt bezwaar maken tegen verwerking. Neem daarvoor contact met ons op via de contactpagina. U kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.',
    },
  ],
};

const VOORWAARDEN = {
  eyebrow: 'Voorwaarden',
  kop: 'Voorwaarden voor lidmaatschap en Subsidie Kompas',
  intro:
    'Deze voorwaarden gelden voor het lidmaatschap van Het Fondsenwervers Collectief en voor het gebruik van Subsidie Kompas.',
  secties: [
    {
      h: 'Lidmaatschap',
      p: 'Een lidmaatschap is persoonlijk en bedoeld voor fondsenwervers en organisaties die zich met fondsenwerving en subsidies bezighouden. Aanmeldingen worden beoordeeld voordat u toegang krijgt tot de ledencontent.',
    },
    {
      h: 'Abonnementen op Subsidie Kompas',
      p: 'Subsidie Kompas kent drie vormen: Free, Pro en Premium. Een proefperiode gaat na afloop over in een betaald abonnement, tenzij u vóór het einde opzegt. Opzeggen kan per maand via uw account.',
    },
    {
      h: 'De fondsendatabase',
      p: 'De informatie in de fondsendatabase is met zorg samengesteld, maar voorwaarden, bedragen en deadlines veranderen. Controleer voor het indienen van een aanvraag altijd de actuele informatie bij de verstrekker zelf.',
    },
    {
      h: 'Adviezen van de assistent',
      p: 'Subsidie Kompas geeft advies op basis van beschikbare informatie en uw eigen gegevens. Die adviezen zijn een hulpmiddel, geen garantie op toekenning, en vervangen geen juridisch of fiscaal advies.',
    },
    {
      h: 'Uw inhoud',
      p: 'Wat u uploadt of invoert blijft van u. U geeft ons het recht die inhoud te gebruiken om u te kunnen adviseren. Wij gebruiken uw inhoud niet om modellen van derden te trainen.',
    },
    {
      h: 'Gebruik van het platform',
      p: 'Deel uw inloggegevens niet, plaats geen onrechtmatige of beledigende inhoud en gebruik gegevens van andere leden niet voor ongevraagde commerciële berichten. Bij misbruik kunnen wij toegang beëindigen.',
    },
  ],
};

function JuridischePagina({ data }) {
  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <div style={css('max-width: 1180px; margin: 0 auto; padding: clamp(34px, 5.5vw, 56px) clamp(16px, 4vw, 32px) clamp(48px, 7vw, 84px);')}>
        <div style={css('margin-bottom: 30px;')}>
          <div style={css('font-size: 13px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px;')}>
            {data.eyebrow}
          </div>
          <h1 style={css("margin: 0 0 18px; font-family: 'Newsreader', serif; font-size: clamp(29px, 5vw, 44px); font-weight: 600; color: #2C4A5E; line-height: 1.18; max-width: 720px; text-wrap: balance;")}>
            {data.kop}
          </h1>
          <p style={css('margin: 0; font-size: 17px; line-height: 1.7; color: #4B5C58; max-width: 680px;')}>{data.intro}</p>
          <div style={css('margin-top: 14px; font-size: 13.5px; color: #7B8985;')}>Laatst bijgewerkt: augustus 2026</div>
        </div>

        <div style={css('display: flex; flex-direction: column; gap: 26px; max-width: 720px;')}>
          {data.secties.map((s) => (
            <div key={s.h}>
              <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #2C4A5E;")}>
                {s.h}
              </div>
              <div style={css('font-size: 15.5px; line-height: 1.75; color: #4B5C58; text-wrap: pretty;')}>{s.p}</div>
            </div>
          ))}
        </div>

        <div style={css('margin-top: 40px;')}>
          <a href="#/" style={css('font-size: 14.5px; font-weight: 800; color: #4E9A6C;')}>
            ← Terug naar Het Fondsenwervers Collectief
          </a>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return <JuridischePagina data={PRIVACY} />;
}

export function VoorwaardenPage() {
  return <JuridischePagina data={VOORWAARDEN} />;
}

// Beide juridische pagina's in één ingang; elke pagina toont zichzelf op basis
// van de vlaggen uit WebsiteProvider.
export default function JuridischePaginas() {
  return (
    <>
      <PrivacyPage />
      <VoorwaardenPage />
    </>
  );
}
