// Abonneren: bevestigingsstap voor Pro of Premium (route /kompas/abonneren).
//
// Eén herbruikbare component voor beide abonnementen: <AbonnerenBevestiging>
// neemt een intentiecode (PRO of PREMIUM) en laat uit één configuratie
// (data/abonnementen.js) zien wat er gebeurt. Er is geen dubbele logica per
// abonnement.
//
// Spelregels (zie ook data/services/koopintentie.js):
//  - De intentie bepaalt alleen WELK abonnement is gekozen. Nooit of iemand
//    een proefperiode krijgt, betaald heeft of toegang heeft: dat bepaalt
//    later de server. Deze pagina beslist daar dus niets over.
//  - Inloggen of een account aanmaken start NOOIT een proefperiode, Stripe of
//    abonnement. Een anonieme bezoeker kiest hier alleen, logt in of maakt een
//    account aan via de centrale Collectief-overlay en komt hier terug.
//  - Deze pagina roept NOOIT start_trial aan. "Doorgaan naar betalen" roept
//    uitsluitend de Edge Function create-checkout-session aan (alleen plan +
//    akkoord) en stuurt de browser naar de teruggegeven Stripe Checkout-url.
//    De terugkeer uit Stripe geeft nooit toegang: die komt uitsluitend via de
//    geverifieerde Stripe-webhook. Deze pagina schrijft nooit tier, toegang of
//    proefgegevens.
//  - Of er een gratis proefperiode beschikbaar is, komt later van de server
//    (prop `aanbod`). Zonder serverinformatie tonen we de standaardtekst; de
//    frontend leidt dit nooit zelf af uit het profiel.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';
import { Button, Notice } from '../../shared/ui/index.js';
import { useApp } from '../kompas-app/useKompasApp.js';
import { ABONNEMENTEN } from '../../data/abonnementen.js';
import { leesCheckoutResultaat, startCheckout, wisCheckoutResultaat } from '../../data/services/billing.js';
import {
  INTENTIES,
  bewaarIntentie,
  heeftIntentParam,
  intentieUitHash,
  leesIntentie,
  neemTeAanbiedenIntentie,
  wisIntentie,
} from '../../data/services/koopintentie.js';

const KAART = css(`
  box-sizing: border-box;
  background: #FFFFFF;
  border: 1.5px solid #4E9A6C;
  border-radius: 20px;
  padding: clamp(22px, 3vw, 34px);
`);

const KOP = css("margin: 0 0 12px; font-family: 'Newsreader', serif; font-size: clamp(28px, 4.4vw, 40px); font-weight: 600; color: #2C4A5E; line-height: 1.15;");
const TEKST = css('margin: 0 0 18px; font-size: 16.5px; line-height: 1.65; color: #4B5C58;');
const PRIJSBLOK = css('margin: 0 0 22px; padding: 18px 20px; border-radius: 14px; background: #EEF6F1; border: 1px solid #CFE5D8;');
const PRIJS_GROOT = css("font-family: 'Newsreader', serif; font-size: clamp(26px, 4vw, 34px); font-weight: 600; color: #2C4A5E; line-height: 1.2;");
const PRIJS_KLEIN = css('margin-top: 4px; font-size: 17px; font-weight: 700; color: #3D4B48;');
const LIJST = css('margin: 0 0 24px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px;');
const RIJ = css('display: flex; gap: 10px; align-items: flex-start; font-size: 15.5px; line-height: 1.55; color: #3D4B48;');
const VINKJE = css('flex-shrink: 0; width: 16px; color: #4E9A6C; font-weight: 800;');
const KNOPPEN = css('display: flex; gap: 12px; flex-wrap: wrap; align-items: center;');
const AKKOORD = css('display: flex; gap: 12px; align-items: flex-start; margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #3D4B48; cursor: pointer;');
const LINK = css('color: #2C4A5E; font-weight: 700; text-decoration: underline;');

function Punten({ items }) {
  return (
    <ul style={LIJST}>
      {items.map((t) => (
        <li key={t} style={RIJ}>
          <span style={VINKJE} aria-hidden="true">✓</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// De herbruikbare bevestigingsflow. `intentie` is een code uit INTENTIES.
// `aanbod` (optioneel, later van de server): { trialBeschikbaar: boolean }.
export function AbonnerenBevestiging({ intentie, aanbod }) {
  const app = useApp();
  const [akkoord, setAkkoord] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  // Slot tegen dubbelklikken: werkt direct, ook vóórdat de volgende render er is.
  const bezigSlot = useRef(false);

  const { tier } = INTENTIES[intentie];
  const info = ABONNEMENTEN[tier];
  const profiel = app.profile || null;
  // Alleen een expliciet "false" van de server toont de variant zonder trial.
  const metTrial = !(aanbod && aanbod.trialBeschikbaar === false);

  // Logt de bezoeker in en is het profiel geladen, dan is dit de bevestigingsstap
  // zelf: markeer de intentie als aangeboden, zodat een latere inlog niet
  // opnieuw naar deze pagina wordt gestuurd. Dit start niets.
  useEffect(() => {
    if (app.isLoggedIn && profiel) {
      neemTeAanbiedenIntentie();
    }
  }, [app.isLoggedIn, profiel && profiel.id]);

  // Terug via de browserknop vanaf Stripe kan deze pagina uit de cache komen
  // met een nog vergrendelde knop: geef de knop dan weer vrij.
  useEffect(() => {
    const bijTerugkeer = (e) => {
      if (e && e.persisted) {
        bezigSlot.current = false;
        setBezig(false);
      }
    };

    window.addEventListener('pageshow', bijTerugkeer);

    return () => window.removeEventListener('pageshow', bijTerugkeer);
  }, []);

  const naarAbonnementen = () => {
    wisIntentie();
    app.goAbonnementen();
  };

  // Start Stripe Checkout. Alleen plan + akkoord gaan naar de server; die
  // bepaalt trial, prijs en rechten. Bij succes navigeert startCheckout zelf
  // naar de gevalideerde Checkout-url en blijft de knop vergrendeld.
  const startBetalen = async () => {
    if (!akkoord || bezigSlot.current || !app.isLoggedIn || !profiel) {
      return;
    }

    bezigSlot.current = true;
    setBezig(true);
    setFout('');

    let res = null;

    try {
      res = await startCheckout(intentie, { voorwaardenAkkoord: akkoord });
    } catch (e) {
      res = null;
    }

    if (res && res.url && !res.error) {
      return;
    }

    bezigSlot.current = false;
    setBezig(false);
    setFout((res && res.error) || 'Het openen van de betaalpagina is niet gelukt. Er is niets in rekening gebracht. Probeer het zo opnieuw.');

    // Sessie verlopen: terug naar de centrale Collectief-login; de keuze blijft bewaard.
    if (res && res.code === 'niet_ingelogd') {
      bewaarIntentie(intentie);
      app.openAuth(`Log opnieuw in om verder te gaan met ${info.naam}.`);
    }
  };

  const voorwaardenLinks = (
    <>
      <a href="#/voorwaarden" target="_blank" rel="noopener noreferrer" style={LINK}>Algemene Voorwaarden</a>
      {' en de '}
      <a href="#/privacy" target="_blank" rel="noopener noreferrer" style={LINK}>Privacyverklaring</a>
    </>
  );

  const prijsblok = metTrial ? (
    <div style={PRIJSBLOK}>
      <div style={PRIJS_GROOT}>{info.proefDuur} gratis</div>
      <div style={PRIJS_KLEIN}>daarna {info.prijsTekst}</div>
    </div>
  ) : (
    <div style={PRIJSBLOK}>
      <div style={PRIJS_GROOT}>{info.prijsTekst}</div>
      <div style={PRIJS_KLEIN}>Uw gratis proefperiode is al gebruikt.</div>
    </div>
  );

  const kop = metTrial ? (
    <>
      <h1 style={KOP}>{info.naam}</h1>
      <p style={TEKST}>{info.proefDuur} gratis, daarna {info.prijsTekst}.</p>
    </>
  ) : (
    <>
      <h1 style={KOP}>{info.naam} — {info.prijsTekst}</h1>
      <p style={TEKST}>Uw gratis proefperiode is al gebruikt.</p>
    </>
  );

  const punten = metTrial ? (
    <Punten
      items={[
        `${info.proefDuur} gratis. Een betaalmethode is vereist om te starten.`,
        `Daarna ${info.prijsTekst}, automatisch maandelijks verlengd totdat u opzegt.`,
        'Opzeggen tijdens de proefperiode voorkomt de eerste betaling. U houdt toegang tot het einde van de proefperiode; daarna valt uw account terug op Free.',
        'Elk account heeft één gratis proefperiode.',
      ]}
    />
  ) : (
    <Punten
      items={[
        `${info.prijsTekst}. Een betaalmethode is vereist om te starten.`,
        'Automatisch maandelijks verlengd totdat u opzegt.',
        'Opzeggen kan altijd. U houdt toegang tot het einde van de betaalde periode; daarna valt uw account terug op Free.',
      ]}
    />
  );

  const akkoordTekst = metTrial
    ? <>Ik ga akkoord met de {voorwaardenLinks} en begrijp dat mijn gratis proefperiode daarna automatisch overgaat in een betaald abonnement totdat ik opzeg.</>
    : <>Ik ga akkoord met de {voorwaardenLinks} en begrijp dat mijn abonnement maandelijks automatisch wordt verlengd totdat ik opzeg.</>;

  const samenvatting = (
    <>
      {kop}
      {prijsblok}
      {punten}
    </>
  );

  // 1. Niet ingelogd: eerst een Collectief-account, daarna terug naar deze stap.
  if (!app.isLoggedIn) {
    const reden = `Log in of maak een account aan om verder te gaan met ${info.naam}.`;

    return (
      <div style={KAART}>
        {samenvatting}
        <p style={TEKST}>
          Hiervoor heeft u een account bij Het Fondsenwervers Collectief nodig, hetzelfde account dat u voor alle
          onderdelen gebruikt. Inloggen of een account aanmaken start nog niets: daarna komt u hier terug en
          bevestigt u zelf. Subsidie Kompas Free blijft zonder account bruikbaar.
        </p>
        <div style={KNOPPEN}>
          <Button onClick={() => app.openRegister(reden)}>Account aanmaken</Button>
          <Button variant="outline" onClick={() => app.openAuth(reden)}>Inloggen</Button>
        </div>
      </div>
    );
  }

  // 2. Ingelogd, maar het profiel kon niet worden geladen: niets aanbieden.
  if (app.profielProbleem) {
    return (
      <div style={KAART}>
        <h1 style={KOP}>Abonneren nu niet beschikbaar</h1>
        <Notice tone="fout">
          Uw account is niet volledig ingericht: uw profielgegevens konden niet worden geladen. U kunt nu niet
          abonneren. Probeer het later opnieuw of neem contact met ons op.
        </Notice>
      </div>
    );
  }

  // 3. Profiel wordt nog geladen.
  if (!profiel) {
    return (
      <div style={KAART}>
        <p style={{ ...TEKST, margin: 0 }}>Een moment…</p>
      </div>
    );
  }

  // 4. De bevestigingsstap: pas na het vinkje start "Doorgaan naar betalen"
  // Stripe Checkout (de server beslist daar over trial, prijs en rechten).
  return (
    <div style={KAART}>
      {samenvatting}
      <label style={AKKOORD}>
        <input
          type="checkbox"
          checked={akkoord}
          disabled={bezig}
          onChange={(e) => setAkkoord(e.target.checked)}
          style={css('flex-shrink: 0; width: 20px; height: 20px; margin: 2px 0 0; accent-color: #4E9A6C;')}
        />
        <span>{akkoordTekst}</span>
      </label>
      <div style={KNOPPEN}>
        <Button onClick={startBetalen} disabled={!akkoord || bezig}>
          {bezig ? 'Bezig met doorsturen…' : 'Doorgaan naar betalen'}
        </Button>
        <Button variant="outline" onClick={naarAbonnementen} disabled={bezig}>Niet nu</Button>
      </div>
      {bezig && (
        <div role="status">
          <Notice tone="info">U wordt doorgestuurd naar de beveiligde betaalpagina van Stripe. Er is nog niets in rekening gebracht.</Notice>
        </div>
      )}
      {fout && (
        <div role="alert">
          <Notice tone="fout">{fout}</Notice>
        </div>
      )}
    </div>
  );
}

// De pagina: bepaalt de intentie (URL eerst, anders de bewaarde keuze) en
// toont de bevestigingsflow.
export default function AbonnerenPage() {
  const app = useApp();
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  const fromHash = intentieUitHash(hash);
  const ongeldig = heeftIntentParam(hash) && !fromHash;
  const intentie = ongeldig ? null : fromHash || leesIntentie();
  // Terugkeer uit Stripe zonder af te rekenen (?checkout=cancelled): alleen een
  // melding. Dit geeft en wijzigt nooit rechten.
  const [stripeGeannuleerd] = useState(() => leesCheckoutResultaat() === 'cancelled');

  useEffect(() => {
    if (stripeGeannuleerd) {
      wisCheckoutResultaat();
    }
  }, []);

  // Een keuze uit de URL meteen onthouden, zodat ze een registratie met
  // e-mailbevestiging overleeft (nieuwe paginalading, ander tabblad).
  useEffect(() => {
    if (fromHash && leesIntentie() !== fromHash) {
      bewaarIntentie(fromHash);
    }
  }, [fromHash]);

  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <KompasSubnav actief="werkt" />
      <div style={css('max-width: 760px; margin: 0 auto; padding: clamp(32px, 5vw, 60px) clamp(16px, 4vw, 24px) 80px;')}>
        {stripeGeannuleerd && (
          <div style={css('margin-bottom: 18px;')} role="status">
            <Notice tone="info">
              De betaling is niet afgerond. Er is niets in rekening gebracht en er is niets geactiveerd.
            </Notice>
          </div>
        )}
        {intentie ? (
          <AbonnerenBevestiging key={intentie} intentie={intentie} />
        ) : (
          <div style={KAART}>
            <h1 style={KOP}>{ongeldig ? 'Deze keuze is niet geldig' : 'Geen keuze gevonden'}</h1>
            <p style={TEKST}>Kies eerst Pro of Premium om verder te gaan.</p>
            <div style={KNOPPEN}>
              <Button onClick={app.goAbonnementen}>Bekijk de abonnementen</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
