// Maandprijzen Pro €40 en Premium €75 (excl. btw) en de prijsladder per looptijd staan overal gelijk: weergave (één configuratie), FAQ, plannenoverzicht en de serverkant van de checkout.
import { readFileSync } from 'node:fs';
import { ABONNEMENTEN, prijsInfo, LOOPTIJDEN } from '../../src/data/abonnementen.js';
import { check, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'prijzen';

const lees = (p) => readFileSync(p, 'utf8');
const hoeHet = lees('src/features/kompas-marketing/HoeHetWerktPage.jsx');
const faq = lees('src/features/kompas-marketing/faqContent.jsx');
const checkout = lees('supabase/functions/create-checkout-session/index.ts');

sectie('1. Weergave');
{
  check('abonnementen.js: Pro €40, Premium €75 per maand', ABONNEMENTEN.pro.prijsTekst === '€40 per maand' && ABONNEMENTEN.premium.prijsTekst === '€75 per maand');
  check('proefperioden ongewijzigd (7 dagen / 24 uur)', ABONNEMENTEN.pro.proefDuur === '7 dagen' && ABONNEMENTEN.premium.proefDuur === '24 uur');
  check('plannenoverzicht: €0 vast, Pro en Premium uit de prijsconfiguratie (geen eigen bedragen in de pagina)', /prijs: '€0'/.test(hoeHet) && !/prijs: '€\d+'(?!.*€0)/.test(hoeHet.replace(/prijs: '€0'/, '')) && /prijsInfo\(plan\.tier, looptijd\)/.test(hoeHet));
  check('FAQ: prijzen uit de configuratie, vraag over de Premium-prijs en over vooruitbetalen', faq.includes('prijsInfo') && faq.includes('Pro (${MAAND_PRO} per maand)') && faq.includes('Premium (${MAAND_PREMIUM} per maand)') && faq.includes('Kan ik korting krijgen door vooruit te betalen?'));
  check('de maandprijzen in de FAQ-bron zijn €40 en €75', prijsInfo('pro', 'MAAND').perMaand === '€40' && prijsInfo('premium', 'MAAND').perMaand === '€75');
  check('geen vaste oude bedragen (€35 / €70) meer als maandprijs in FAQ en plannenoverzicht', !/per maand\)?'?[^\n]*€(35|70)\b/.test(faq) && !/prijs: '€(35|70)'/.test(hoeHet));
}

sectie('2. Geen oude prijzen meer in de code');
{
  const bestanden = ['src/data/abonnementen.js', 'src/features/kompas-marketing/HoeHetWerktPage.jsx', 'src/features/kompas-marketing/faqContent.jsx', 'src/features/kompas-marketing/AbonnerenPage.jsx', 'src/features/website/JuridischePaginas.jsx', 'src/features/kompas-app/AccountPage.jsx', 'supabase/functions/create-checkout-session/index.ts', 'supabase/functions/stripe-webhook/index.ts'];

  for (const b of bestanden) {
    const t = lees(b);

    check(`${b}: geen €12 of €39 meer`, !/€ ?(12|39)(?![\d.,])/.test(t) && !/\bEUR (12|39)\b/.test(t) && !/bedragCent: (1200|3900)\b/.test(t));
  }
}

sectie('3. Serverkant van de checkout');
{
  check('checkout verwacht 4000 en 7500 cent (de maandprijs)', /PRO: \{[^}]*bedragCent: 4000/.test(checkout) && /PREMIUM: \{[^}]*bedragCent: 7500/.test(checkout));
  check('checkout weigert vooruitbetalen (fail closed) zolang de server dat niet kent', /looptijd_niet_beschikbaar/.test(checkout) && /invoer\.looptijd !== 'MAAND'/.test(checkout));
  check('de looptijd bepaalt in de checkout geen bedrag (alleen MAAND wordt afgerekend)', !/KWARTAAL.*bedragCent|bedragCent.*KWARTAAL/.test(checkout));
  check('checkout vergelijkt het Stripe-bedrag nog steeds met die verwachting (verkeerde prijs = geen checkout)', /price\.unit_amount !== planConfig\.bedragCent/.test(checkout));
  check('de client kan nog steeds geen bedrag of price-id sturen', /bedragCent/.test(checkout) && !/body\.(bedrag|price|amount)/i.test(checkout));
  check('weergave en server zijn gelijk (€40 = 4000, €75 = 7500)', ABONNEMENTEN.pro.prijsTekst.startsWith('€40') && ABONNEMENTEN.premium.prijsTekst.startsWith('€75'));
  check('alle vier de looptijden hebben een prijs voor beide tiers', LOOPTIJDEN.every((l) => prijsInfo('pro', l) && prijsInfo('premium', l)));
}

klaar('prijzen');
