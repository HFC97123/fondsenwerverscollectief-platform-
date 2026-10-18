import { readFileSync } from 'node:fs';
import { tierConfigVoor, tierMagRecord, alleTierConfigs } from '../../supabase/functions/_shared/tierConfig.ts';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'tierconfig';

sectie('1. Welke tier krijgt welke configuratie (fail closed)');
{
  gelijk('pro', tierConfigVoor('pro').tier, 'pro');
  gelijk('premium', tierConfigVoor('premium').tier, 'premium');
  gelijk('free', tierConfigVoor('free').tier, 'free');

  for (const x of [undefined, null, '', 'PRO', 'Premium', 'admin', 0, {}, [], 'enterprise']) {
    check(`onbekende waarde ${JSON.stringify(x)} valt op free`, tierConfigVoor(x).tier === 'free');
  }

  check('admin krijgt de Premium-regels', tierConfigVoor('free', true).tier === 'premium');
  check('isAdmin moet precies true zijn', tierConfigVoor('free', 'true').tier === 'free' && tierConfigVoor('pro', 1).tier === 'pro');
  check('configuraties zijn bevroren (geen runtime-wijziging)', (() => { try { 'use strict'; tierConfigVoor('pro').dekkingsdoel = 5; } catch { /* streng */ } return tierConfigVoor('pro').dekkingsdoel === 1.2; })());
}

sectie('2. Productregels: Pro ziet geen Premium-records, Premium ziet alles');
{
  const pro = tierConfigVoor('pro');
  const premium = tierConfigVoor('premium');
  const free = tierConfigVoor('free');

  check('Pro: free en pro ja', tierMagRecord(pro, 'free') && tierMagRecord(pro, 'pro'));
  check('Pro: premium NEE', !tierMagRecord(pro, 'premium'));
  check('Premium: alle drie', ['free', 'pro', 'premium'].every((t) => tierMagRecord(premium, t)));
  check('Free: alleen free en geen dekkingsplan', tierMagRecord(free, 'free') && !tierMagRecord(free, 'pro') && !tierMagRecord(free, 'premium') && free.dekkingsplan === false);

  for (const config of alleTierConfigs()) {
    for (const x of [undefined, null, '', 'Premium', 'PRO', 'gold', 1, {}, ['premium']]) {
      check(`${config.tier}: onbekende access_tier ${JSON.stringify(x)} is nooit toegestaan`, !tierMagRecord(config, x));
    }
  }

  // Spiegel van de databasefunctie subsidie_zichtbaar_voor_tier voor beoordeelde records.
  const sql = (access, tier) => access === 'free' || (access === 'pro' && (tier === 'pro' || tier === 'premium')) || (access === 'premium' && tier === 'premium');

  for (const tier of ['free', 'pro', 'premium']) {
    for (const access of ['free', 'pro', 'premium']) {
      check(`pariteit met subsidie_zichtbaar_voor_tier: ${tier} x ${access}`, tierMagRecord(tierConfigVoor(tier), access) === sql(access, tier));
    }
  }
}

sectie('3. Pro en Premium verschillen alleen in pool, dekkingsdoel en online ruimte, niet in kwaliteit');
{
  const pro = tierConfigVoor('pro');
  const premium = tierConfigVoor('premium');

  check('dekkingsdoel: Pro 120%, Premium 140%', pro.dekkingsdoel === 1.2 && premium.dekkingsdoel === 1.4);
  check('zelfde minimumscore en zelfde maximaal aandeel per fonds; Pro 6 regels, Premium 10 en rangschikking op bijdrage alleen bij Premium', pro.minScore === premium.minScore && pro.maxAandeelPerFonds === premium.maxAandeelPerFonds && pro.maxRegelsInMix === 6 && premium.maxRegelsInMix === 10 && pro.rangschikOpBijdrage === false && premium.rangschikOpBijdrage === true && tierConfigVoor('free').rangschikOpBijdrage === false);
  check('mixgrootte past binnen het voorstelcontract (MAX_REGELS 12, plus één reserve)', pro.maxRegelsInMix + 1 <= 12 && premium.maxRegelsInMix + 1 <= 12);
  check('observatiebudget: Pro 7, Premium 14, Free geen', pro.maandBudgetObservatieEur === 7 && premium.maandBudgetObservatieEur === 14 && tierConfigVoor('free').maandBudgetObservatieEur === null);
  check('Premium online aanvullen: cap 5 per ronde; Pro heeft dit niet', premium.onlineAanvullen?.maxKandidaten === 5 && pro.onlineAanvullen === null);
  check('Premium online: doorzoeken tot 120% gedekt is: minstens 3 tonen, oriëntatie 6, totaal maximum 10 (boven 6 als er te weinig fondsen zijn)', premium.onlineOrientatie.minTonen === 3 && premium.onlineOrientatie.maxKandidaten === 6 && premium.onlineOrientatie.totaalMax === 10);
  check('Pro heeft geen doorzoeken (vast kort lijstje: geen minTonen/totaalMax)', pro.onlineOrientatie.minTonen === undefined && pro.onlineOrientatie.totaalMax === undefined);
  check('Premium-hint: alleen Pro', pro.premiumHint === true && premium.premiumHint === false && tierConfigVoor('free').premiumHint === false && tierConfigVoor('pro', true).premiumHint === false);
  check('Pro online oriëntatie is kleiner dan die van Premium', pro.onlineOrientatie.maxKandidaten < premium.onlineOrientatie.maxKandidaten && pro.onlineOrientatie.timeoutMs < premium.onlineOrientatie.timeoutMs);
  check('Premium vult alle ontbrekende kernvelden aan, Pro alleen indien nodig', premium.aanvullenVelden === 'alle-ontbrekende' && pro.aanvullenVelden === 'indien-nodig');
}

sectie('4. Statisch: één bron, geen hardcoded tierlijsten of beveiliging in de configuratie');
{
  const bron = readFileSync('supabase/functions/_shared/tierConfig.ts', 'utf8');

  check('geen netwerk, geen database, geen omgeving', !/\bfetch\(|Deno\.|process\.env|createClient|\.from\(|\.rpc\(/.test(bron));
  check('leest geen tier uit een request', !/Request|req\.|body\./.test(bron.replace(/\/\/.*$/gm, '')));
}

klaar('tierconfig');
