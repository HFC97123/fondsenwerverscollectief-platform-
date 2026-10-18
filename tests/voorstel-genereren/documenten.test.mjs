// Documenttekst: PDF-stukjes worden op POSITIE aan elkaar gezet (geen letter-voor-letter gespatieerde tekst), en oude gespatieerde tekst wordt hersteld.
import { herstelGespatieerdeTekst, documentUittreksel } from '../../supabase/functions/_shared/voorstelGenereren.ts';
import { pdfItemsNaarTekst } from '../../src/data/services/pdfTekst.js';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

// Letter voor letter, 6 punten breed per letter, regel op y=700.
const letters = (woord, x0, y = 700) => [...woord].map((c, i) => ({ str: c, transform: [10, 0, 0, 10, x0 + i * 6, y], width: 6, height: 10 }));

sectie('1. PDF-stukjes op positie');
{
  const t = pdfItemsNaarTekst([...letters('Stichting', 50), ...letters('Zonnige', 50 + 9 * 6 + 5), ...letters('Jeugd', 50, 680)]);

  check('letters direct achter elkaar vormen een woord', t.startsWith('Stichting Zonnige'), JSON.stringify(t));
  check('een andere hoogte is een nieuwe regel', t.split('\n').length === 2 && t.split('\n')[1] === 'Jeugd', JSON.stringify(t));
  check('geen spaties tussen de letters', !/S t i/.test(t));
  check('hele woorden met een tussenruimte krijgen een spatie', pdfItemsNaarTekst([{ str: 'Back', transform: [10, 0, 0, 10, 0, 5], width: 24, height: 10 }, { str: 'to', transform: [10, 0, 0, 10, 30, 5], width: 12, height: 10 }]) === 'Back to');
  check('leeg of onbekend: lege tekst, geen fout', pdfItemsNaarTekst(null) === '' && pdfItemsNaarTekst([{ str: '' }]) === '');
}

sectie('2. Herstel van oude gespatieerde tekst');
{
  check('losse letters worden samengevoegd, dubbele spatie blijft woordscheiding', herstelGespatieerdeTekst('S t i c h t i n g  Z o n n i g e').replace(/ +/g, ' ') === 'Stichting Zonnige');
  check('gewone tekst blijft ongemoeid', herstelGespatieerdeTekst('Wij helpen kinderen naar school, in 2026 a b c.') === 'Wij helpen kinderen naar school, in 2026 a b c.');
  check('het uittreksel gebruikt het herstel', documentUittreksel([{ naam: 'plan.pdf', tekst: 'B a c k  t o  s c h o o l  h e l p t  k i n d e r e n  i n  d e  C a r i b e n  m e t  s c h o o l s p u l l e n  e n  u n i f o r m e n' }]).tekst.includes('Back to school helpt kinderen'));
}

console.log(`\ndocumenten: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
