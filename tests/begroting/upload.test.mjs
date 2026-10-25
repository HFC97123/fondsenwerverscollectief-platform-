// Upload van een begroting: een hoofdregel naast zijn subregels telt niet dubbel.
//   node tests/begroting/run-upload.mjs   (vanuit de repo-root)
import { valideerUpload } from '../../supabase/functions/_shared/begrotingUpload.ts';
import { check, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'begroting-upload-dubbel';

const R = (omschrijving, bedrag, sec = '', extra = {}) => ({ sectie: sec, kopje: 'uitvoering', omschrijving, aantal: null, eenheid: '', tarief: null, bedrag, schatting: false, toelichting: '', ...extra });
const som = (res) => res.regels.reduce((n, r) => n + (r.aantal !== null && r.tarief !== null ? r.aantal * r.tarief : r.bedrag ?? 0), 0);

sectie('1. Hoofdregel met subregels eronder: alleen de subregels tellen');
let res = valideerUpload({ regels: [R('Personeel', 30000, 'Uitvoering'), R('Projectleider', 20000, 'Personeel'), R('Vrijwilligerscoördinator', 10000, 'Personeel'), R('Laptops', 1500, 'Materialen')], totalen: [{ soort: 'totaal', sectie: '', bedrag: 31500 }] });
check('de hoofdregel Personeel valt weg, totaal 31.500', res.regels.length === 3 && !res.regels.some((r) => r.omschrijving === 'Personeel') && som(res) === 31500, JSON.stringify(res.regels.map((r) => r.omschrijving)));
check('er komt een melding dat Personeel een optelling is', res.controle.waarschuwingen.some((w) => /Personeel.*optelling/.test(w)));
check('en het totaal klopt dus met het bestand (geen "totaal klopt niet"-melding)', !res.controle.waarschuwingen.some((w) => /Het totaal in het bestand/.test(w)));

sectie('2. Hoofdregel onder dezelfde kop als de subregels');
res = valideerUpload({ regels: [R('Uitvoering totaal', 30000, 'Uitvoering'), R('Projectleider', 20000, 'Uitvoering'), R('Coördinator', 10000, 'Uitvoering')], totalen: [] });
check('de som van twee regels onder dezelfde kop gelijk aan een derde: die derde is de tussentelling', res.regels.length === 2 && som(res) === 30000);

sectie('3. Gewone begroting blijft ongemoeid');
res = valideerUpload({ regels: [R('Zaalhuur', 1000, 'Uitvoering'), R('Flyers', 500, 'Communicatie'), R('Website', 1500, 'Communicatie'), R('Boekhouder', 2000, 'Organisatie')], totalen: [] });
check('vier losse regels blijven vier regels', res.regels.length === 4 && som(res) === 5000 && res.controle.waarschuwingen.length === 0);
res = valideerUpload({ regels: [R('Sportmaterialen', 500, 'Activa'), R('Bal', 200, 'Activa'), R('Hesjes', 300, 'Activa')], totalen: [] });
check('staat een kopregel met precies de som van de regels eronder, dan is dat een optelling (en gemeld)', res.regels.length === 2 && res.controle.waarschuwingen.length === 1);
res = valideerUpload({ regels: [R('Trainers', 5000, 'Uitvoering', { aantal: 10, tarief: 500 }), R('Zaal', 2000, 'Uitvoering'), R('Reis', 3000, 'Uitvoering')], totalen: [] });
check('een regel met aantal x tarief wordt nooit als optelling weggehaald', res.regels.length === 3 && som(res) === 10000);
sectie('4. Geen hoofdregels of kopjes: alle losse regels tellen gewoon op');
res = valideerUpload({ regels: [R('Laptop', 500), R('Beamer', 200), R('Scherm', 300), R('Trainer', 1000), R('Flyers', 400)], totalen: [{ soort: 'totaal', sectie: '', bedrag: 2400 }] });
check('vijf losse regels zonder kop blijven vijf, ook al is 500 gelijk aan 200 + 300; totaal 2.400 en geen enkele melding', res.regels.length === 5 && som(res) === 2400 && res.controle.waarschuwingen.length === 0, JSON.stringify(res.controle.waarschuwingen));
klaar('begroting-upload-dubbel');
