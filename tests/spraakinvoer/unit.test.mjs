import { readFileSync } from 'node:fs';
import { voegDictaatToe, lees, spraakFoutTekst, SPRAAK_FOUTEN, spraakOndersteund, spraakConstructor, SPRAAK_TAAL } from '../../src/features/kompas-app/chat/spraakInvoer.js';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

console.log('== voegDictaatToe');
gelijk('leeg + dictaat', voegDictaatToe('', 'hallo wereld'), 'hallo wereld');
gelijk('bestaande tekst + dictaat: één spatie', voegDictaatToe('Welke fondsen', 'passen bij mij'), 'Welke fondsen passen bij mij');
gelijk('bestaande tekst eindigt op spatie: geen dubbele', voegDictaatToe('Welke fondsen ', 'passen bij mij'), 'Welke fondsen passen bij mij');
gelijk('leeg dictaat verandert niets', voegDictaatToe('Tekst', '   '), 'Tekst');
gelijk('undefined veilig', [voegDictaatToe(undefined, undefined), voegDictaatToe(null, 'a')], ['', 'a']);
gelijk('meerdere spaties en regeleinden in dictaat worden één spatie', voegDictaatToe('a', ' b \n  c '), 'a b c');
gelijk('nieuwe regels in bestaande tekst blijven staan', voegDictaatToe('Regel 1\n', 'regel 2'), 'Regel 1\nregel 2');

console.log('== lees (resultaten)');
const res = [{ isFinal: true, 0: { transcript: 'ik zoek een fonds' } }, { isFinal: true, 0: { transcript: 'voor ouderen' } }, { isFinal: false, 0: { transcript: 'in Utrec' } }];
res.length = 3;
gelijk('definitief en tussentijds gescheiden', lees(res), { definitief: 'ik zoek een fonds voor ouderen ', tussentijds: 'in Utrec ' });
gelijk('leeg of undefined', [lees([]), lees(undefined)], [{ definitief: '', tussentijds: '' }, { definitief: '', tussentijds: '' }]);
gelijk('live tekst = basis + definitief + tussentijds', voegDictaatToe('Hoi', 'ik zoek een fonds voor ouderen in Utrec '), 'Hoi ik zoek een fonds voor ouderen in Utrec');

console.log('== fouten');
check('alle foutcodes geven Nederlandse tekst zonder codes', Object.keys(SPRAAK_FOUTEN).every((k) => !SPRAAK_FOUTEN[k].includes(k) && /[a-z]/.test(SPRAAK_FOUTEN[k])));
check('geblokkeerde microfoon noemt toestemming', /toestemming|toegestaan/.test(spraakFoutTekst('not-allowed')));
check('onbekende fout: nette terugval', /Typ uw vraag/.test(spraakFoutTekst('iets-raars')) && /Typ uw vraag/.test(spraakFoutTekst(undefined)));

console.log('== ondersteuning');
check('zonder window (Node): niet ondersteund, geen fout', spraakOndersteund() === false && spraakConstructor() === null);
globalThis.window = { webkitSpeechRecognition: function X() {} };
check('webkitSpeechRecognition wordt herkend', spraakOndersteund() === true);
delete globalThis.window;
gelijk('taal is Nederlands', SPRAAK_TAAL, 'nl-NL');

console.log('== grenzen');
const bron = readFileSync('src/features/kompas-app/chat/spraakInvoer.js', 'utf8').replace(/\/\/.*$/gm, '');
check('geen netwerk, database of opslag in de module', !/fetch\(|supabase|XMLHttpRequest|localStorage|sessionStorage/.test(bron));
const chat = readFileSync('src/features/kompas-app/KompasToolPage.jsx', 'utf8');
check('microfoonknop alleen als de browser het ondersteunt', /spraak\.ondersteund && \(\s*<button/.test(chat));
check('dictaat wordt niet automatisch verstuurd (geen verstuur() in de spraakmodule of zetDraft)', !/verstuur/.test(bron) && !/zetDraft: \(t\) => \{[^}]*verstuur/.test(chat));

console.log(`\n${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
