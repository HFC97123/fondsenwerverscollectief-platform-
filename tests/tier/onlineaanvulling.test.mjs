// Beslisregels "database eerst, online alleen aanvullend" (zuivere functies).
//   node tests/tier/onlineaanvulling.test.mjs
import { onlineNodigInChat, onlineNodigInVoorstel, chatOnlineProfiel, FREE_MAX_FONDSEN } from '../../supabase/functions/_shared/onlineAanvulling.ts';

let ok = 0;
let fout = 0;
const check = (naam, waar, detail = '') => { if (waar) ok += 1; else { fout += 1; console.log('  FAIL:', naam, detail); } };

// Chat
check('Free: 3 of meer uit de database -> geen online', onlineNodigInChat({ tier: 'free', isAdmin: false, aantalGetoond: 3 }) === false);
check('Free: 2 uit de database -> online aanvullen', onlineNodigInChat({ tier: 'free', isAdmin: false, aantalGetoond: 2 }) === true);
check('Free: niets uit de database -> online aanvullen', onlineNodigInChat({ tier: 'free', isAdmin: false, aantalGetoond: 0 }) === true);
check('Pro: de korte lijst dekt de behoefte -> geen online', onlineNodigInChat({ tier: 'pro', isAdmin: false, aantalGetoond: 5, proUitkomst: 'voldoende', proRegels: 4 }) === false);
check('Pro: tekort -> online aanvullen', onlineNodigInChat({ tier: 'pro', isAdmin: false, aantalGetoond: 5, proUitkomst: 'tekort', proRegels: 4 }) === true);
check('Pro: geen geschikte fondsen -> online aanvullen', onlineNodigInChat({ tier: 'pro', isAdmin: false, aantalGetoond: 0, proUitkomst: 'geen-geschikt', proRegels: 0 }) === true);
check('Pro zonder bekende behoefte: 3 sterke matches -> geen online', onlineNodigInChat({ tier: 'pro', isAdmin: false, aantalGetoond: 3, proUitkomst: 'zonder-begroting', proRegels: 3 }) === false);
check('Pro zonder bekende behoefte: 2 sterke matches -> online aanvullen', onlineNodigInChat({ tier: 'pro', isAdmin: false, aantalGetoond: 2, proUitkomst: 'zonder-begroting', proRegels: 2 }) === true);
check('Pro: uitkomst niet vast te stellen -> liever aanvullen dan een te korte lijst', onlineNodigInChat({ tier: 'pro', isAdmin: false, aantalGetoond: 5, proUitkomst: null }) === true);
check('Premium: altijd een online ronde na de database', onlineNodigInChat({ tier: 'premium', isAdmin: false, aantalGetoond: 9, proUitkomst: 'voldoende', proRegels: 6 }) === true);
check('Beheer: altijd online', onlineNodigInChat({ tier: 'free', isAdmin: true, aantalGetoond: 9 }) === true);

// Voorstel
const cfg = { heeftOnlineConfig: true, zonderBedrag: false, restNodig: 0, aantalRegels: 4 };

check('Voorstel Pro: database dekt het doel -> geen online', onlineNodigInVoorstel({ ...cfg }) === false);
check('Voorstel Pro: nog dekking nodig -> online aanvullen', onlineNodigInVoorstel({ ...cfg, restNodig: 12000 }) === true);
check('Voorstel Premium (minTonen 3): altijd online, ook bij gedekt doel', onlineNodigInVoorstel({ ...cfg, minTonen: 3 }) === true);
check('Voorstel zonder online-configuratie (Free): nooit online', onlineNodigInVoorstel({ ...cfg, heeftOnlineConfig: false, restNodig: 99999 }) === false);
check('Voorstel zonder bedrag: 3 of meer regels -> geen online, minder -> wel', onlineNodigInVoorstel({ ...cfg, zonderBedrag: true, aantalRegels: 3 }) === false && onlineNodigInVoorstel({ ...cfg, zonderBedrag: true, aantalRegels: 2 }) === true);

// Online ruimte in de chat
const pro = chatOnlineProfiel('pro', false, { maxKandidaten: 2, maxZoekopdrachten: 2, timeoutMs: 40000 });

check('Pro: korte online ruimte uit de tierconfig (2 kandidaten, 2 zoekopdrachten, 40 s)', pro && pro.maxKandidaten === 2 && pro.maxZoekopdrachten === 2 && pro.timeoutMs === 40000);
check('Pro: terugval als de tierconfig geen online ruimte heeft: ook 2', chatOnlineProfiel('pro', false, null)?.maxKandidaten === 2);
check('Free: alleen om tot 3 te komen (1 nodig -> 1, 2 nodig -> 2, nooit meer dan 3)', chatOnlineProfiel('free', false, null, 1)?.maxKandidaten === 1 && chatOnlineProfiel('free', false, null, 2)?.maxKandidaten === 2 && chatOnlineProfiel('free', false, null, 9)?.maxKandidaten === FREE_MAX_FONDSEN);
check('Premium en beheer: geen beperkend profiel (de bestaande chat-ruimte)', chatOnlineProfiel('premium', false, null) === undefined && chatOnlineProfiel('free', true, null) === undefined);

console.log(`onlineaanvulling: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
