import * as M from '../../src/features/kompas-app/begroting/begrotingModel.js';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'begroting-model';

const r = (categorie, basis) => M.nieuweRegel(categorie, basis);

sectie('1. Bedrag per regel: nooit raden');
{
  gelijk('aantal x tarief', M.regelBedrag(r('uitvoering', { aantal: '10', tarief: '45' })), { ok: true, bedrag: 450, bron: 'berekend' });
  gelijk('Nederlandse notatie: 1.250 is twaalfhonderdvijftig', M.regelBedrag(r('uitvoering', { bedrag: '1.250' })).bedrag, 1250);
  gelijk('met centen: 12,50', M.regelBedrag(r('uitvoering', { aantal: '2', tarief: '12,50' })).bedrag, 25);
  gelijk('aantal x tarief gaat voor een los bedrag', M.regelBedrag(r('uitvoering', { aantal: '2', tarief: '10', bedrag: '999' })).bedrag, 20);
  gelijk('alleen een aantal: geen bedrag, niet 0', M.regelBedrag(r('uitvoering', { aantal: '5' })), { ok: true, bedrag: null, bron: 'onbekend' });
  gelijk('leeg: geen bedrag', M.regelBedrag(r('uitvoering')).bedrag, null);
  gelijk('onzin is ongeldig', M.regelBedrag(r('uitvoering', { bedrag: '12abc' })).ok, false);
  gelijk('negatief is ongeldig', M.regelBedrag(r('uitvoering', { bedrag: '-5' })).ok, false);
}

sectie('2. Totalen');
{
  const t = M.berekenBegroting([
    r('uitvoering', { omschrijving: 'Projectleider', aantal: '100', tarief: '50' }),
    r('activa', { omschrijving: 'Materiaal', bedrag: '2.000' }),
    r('activa', { omschrijving: 'Voedselpakketten', aantal: '40', tarief: '25' }),
    r('organisatie', { omschrijving: 'Gratis zaal', bedrag: '1.200', soort: 'natura' }),
    r('eigen:Overig project', { omschrijving: 'Nog onbekend' }),
  ]);

  gelijk('totaal kosten in geld', t.totaalGeld, 8000);
  gelijk('in natura telt niet mee in het totaal', t.totaalNatura, 1200);
  gelijk('subtotaal per kopje', t.perCategorie.map((c) => `${c.id}:${c.subtotaal}`).join(','), 'uitvoering:5000,activa:3000,organisatie:0,eigen:Overig project:0');
  gelijk('regel zonder bedrag wordt gemeld, niet meegeteld', t.zonderBedrag.map((x) => x.omschrijving), ['Nog onbekend']);
  check('volgorde van de kopjes is die van de lijst, niet van invoer', t.perCategorie[0].id === 'uitvoering' && t.perCategorie[1].id === 'activa');
  gelijk('een helemaal lege regel telt niet als "zonder bedrag"', M.berekenBegroting([r('')]).zonderBedrag.length, 0);
  gelijk('lege begroting', M.berekenBegroting([]).totaalGeld, 0);
  gelijk('rare invoer breekt niets', M.berekenBegroting(null).perCategorie.length, 0);
}

sectie('3. Opslaan en teruglezen');
{
  const o = M.regelsVoorOpslag([
    r('uitvoering', { omschrijving: '  Projectleider ', aantal: '100', tarief: '50', bedrag: '77' }),
    r('uitvoering'),
    r('uitvoering', { omschrijving: 'Materiaal', bedrag: '2.000,5' }),
  ]);

  check('geldige regels: ok, lege regel valt weg', o.ok && o.regels.length === 2);
  gelijk('getallen, niet tekst; los bedrag vervalt als aantal x tarief er is', [o.regels[0].aantal, o.regels[0].tarief, o.regels[0].bedrag, o.regels[0].omschrijving], [100, 50, null, 'Projectleider']);
  gelijk('los bedrag met centen', o.regels[1].bedrag, 2000.5);
  const terug = M.leesBudgetRegels(M.budgetKolom(o.regels));
  gelijk('teruglezen geeft dezelfde bedragen', M.berekenBegroting(terug).totaalGeld, 7000.5);
  gelijk('opgeslagen vorm houdt getallen', M.leesOpgeslagenRegels(M.budgetKolom(o.regels)).map((x) => typeof x.tarief), ['number', 'object']);
  check('ongeldig bedrag blokkeert opslaan met een duidelijke melding', M.regelsVoorOpslag([r('uitvoering', { omschrijving: 'X', bedrag: 'abc' })]).fout.includes('Controleer de bedragen bij "X"'));
  check('regel met bedrag maar zonder omschrijving blokkeert', !M.regelsVoorOpslag([r('uitvoering', { bedrag: '10' })]).ok);
  gelijk('onbekend kopje wordt: geen kopje', M.leesBudgetRegels([{ categorie: 'bestaatniet', omschrijving: 'x' }])[0].categorie, '');
  gelijk('een eigen kopje blijft bewaard bij opslaan en teruglezen', M.leesBudgetRegels(M.budgetKolom(M.regelsVoorOpslag([r('eigen:Locatie en huisvesting', { omschrijving: 'Zaal', bedrag: '100' })]).regels))[0].categorie, 'eigen:Locatie en huisvesting');
  gelijk('kapotte kolom geeft een lege lijst', [M.leesBudgetRegels(null), M.leesBudgetRegels('x'), M.leesBudgetRegels({ regels: 5 })].map((x) => x.length), [0, 0, 0]);
  gelijk('te lange omschrijving wordt afgekapt', M.leesBudgetRegels([{ omschrijving: 'a'.repeat(500) }])[0].omschrijving.length, 200);
  gelijk('bron onbekend wordt handmatig', M.leesBudgetRegels([{ omschrijving: 'x', bron: 'raar' }])[0].bron, 'handmatig');
}

sectie('4. Kopjes en suggesties');
{
  const ids = M.CATEGORIEEN.map((c) => c.id);

  gelijk('geen dubbele kopjes', new Set(ids).size, ids.length);
  gelijk('de vaste kopjes: de drie van Aisya en communicatie apart (Overig is een eigen kopje)', ids, ['uitvoering', 'activa', 'communicatie', 'organisatie']);
  check('elk kopje heeft een toelichting in een paar bullets', M.CATEGORIEEN.every((c) => Array.isArray(c.toelichting) && c.toelichting.length >= 1 && c.toelichting.every((t) => t.length > 10)));
  check('toelichting Organisatiekosten noemt fondsenwerving en het advies van 6% tot 12,5%', /fondsenwerving/.test(M.CATEGORIEEN[3].toelichting.join(' ')) && /6% en 12,5%/.test(M.CATEGORIEEN[3].toelichting.join(' ')));
  check('toelichting Projectuitvoering gaat over mankracht en het trainen daarvan; Activa over uitrusting en materialen', /mankracht/.test(M.CATEGORIEEN[0].toelichting.join(' ')) && /trainen/.test(M.CATEGORIEEN[0].toelichting.join(' ')) && /uitrusting/.test(M.CATEGORIEEN[1].toelichting.join(' ')) && /materialen/.test(M.CATEGORIEEN[1].toelichting.join(' ')));
  check('de toelichting noemt geen voorbeelden als cursusmateriaal of voedselpakketten', !/cursus|voedsel/i.test(M.CATEGORIEEN.map((c) => c.toelichting.join(' ')).join(' ')));
  const alle = M.CATEGORIEEN.flatMap((c) => c.suggesties.map(([n]) => n));
  check('personeel en vrijwilligers horen bij Projectuitvoering, voedselpakketten bij Activa, communicatie apart en huisvesting en fondsenwerving bij Organisatiekosten', M.CATEGORIEEN[0].suggesties.some(([n]) => n === 'Projectleider') && M.CATEGORIEEN[0].suggesties.some(([n]) => /Vrijwilliger/.test(n)) && M.CATEGORIEEN[1].suggesties.some(([n]) => n === 'Voedselpakketten') && M.CATEGORIEEN[2].suggesties.some(([n]) => /Communicatie/.test(n)) && M.CATEGORIEEN[3].suggesties.some(([n]) => /Zaalhuur/.test(n)) && M.CATEGORIEEN[3].suggesties.some(([n]) => /Fondsenwerving/.test(n)));
  gelijk('geen dubbele suggesties', new Set(alle).size, alle.length);
  check('suggesties bevatten nooit een bedrag', M.CATEGORIEEN.every((c) => c.suggesties.every((s) => s.length === 2 && !/\d|€/.test(s.join(' ')))));
}

sectie('5. Excel-invoer');
{
  const l = M.expenseLinesVoorExcel([
    r('uitvoering', { omschrijving: 'Projectleider', aantal: '10', tarief: '45' }),
    r('uitvoering', { omschrijving: 'Materiaal', bedrag: '2.000' }),
    r('organisatie', { omschrijving: 'Gratis zaal', bedrag: '500', soort: 'natura' }),
    r('uitvoering', { omschrijving: '' , bedrag: '5' }),
  ]);

  gelijk('natura en regels zonder omschrijving staan er niet in', l.length, 2);
  gelijk('aantal x tarief wordt aantal en tarief', [l[0].quantity, l[0].unitPrice, l[0].statedAmount], [10, 45, null]);
  gelijk('vast bedrag wordt vermeld bedrag', [l[1].quantity, l[1].unitPrice, l[1].statedAmount], [null, null, 2000]);
}

sectie('6. Volgorde: de gebruiker bepaalt wat bovenaan staat');
{
  const a = r('uitvoering', { id: 'a', omschrijving: 'A' });
  const b = r('uitvoering', { id: 'b', omschrijving: 'B' });
  const c = r('activa', { id: 'c', omschrijving: 'C' });
  const d = r('organisatie', { id: 'd', omschrijving: 'D' });
  const ids = (l) => l.map((x) => x.id).join('');
  const lijst = [a, b, c, d];

  gelijk('kopjes staan in de volgorde van hun eerste regel, lege erachter', M.kopjeVolgorde(lijst, ['eigen:Overig', 'activa', 'onzin']), ['uitvoering', 'activa', 'organisatie', 'eigen:Overig']);
  gelijk('regel vóór een andere regel in hetzelfde kopje', ids(M.verplaatsRegel(lijst, 'b', 'uitvoering', 'a')), 'bacd');
  gelijk('regel naar een ander kopje, vóór een regel daar: de regel krijgt dat kopje', M.verplaatsRegel(lijst, 'a', 'activa', 'c').map((x) => `${x.id}:${x.categorie}`).join(','), 'b:uitvoering,a:activa,c:activa,d:organisatie');
  gelijk('regel onderaan een kopje', ids(M.verplaatsRegel(lijst, 'a', 'activa')), 'bcad');
  gelijk('regel naar een kopje zonder regels: aan het eind, en dat kopje staat dan ook onderaan', M.kopjeVolgorde(M.verplaatsRegel(lijst, 'a', 'communicatie')).join(','), 'uitvoering,activa,organisatie,communicatie');
  gelijk('onbekende regel of kopje verandert niets', [M.verplaatsRegel(lijst, 'x', 'activa') === lijst, M.verplaatsRegel(lijst, 'a', 'bestaatniet') === lijst], [true, true]);
  gelijk('niets kwijt, niets dubbel', [...M.verplaatsRegel(lijst, 'a', 'organisatie', 'd')].map((x) => x.id).sort().join(''), 'abcd');
  gelijk('een regel een plek omhoog en omlaag, binnen het kopje', [ids(M.schuifRegel(lijst, 'b', 'omhoog')), ids(M.schuifRegel(lijst, 'a', 'omlaag'))], ['bacd', 'bacd']);
  gelijk('bovenaan omhoog en onderaan omlaag blijft staan', [ids(M.schuifRegel(lijst, 'a', 'omhoog')), ids(M.schuifRegel(lijst, 'b', 'omlaag'))], ['abcd', 'abcd']);
  gelijk('een heel kopje naar boven', ids(M.verplaatsKopje(lijst, 'organisatie', 'uitvoering')), 'dabc');
  gelijk('een heel kopje naar het eind', ids(M.verplaatsKopje(lijst, 'uitvoering', null)), 'cdab');
  gelijk('kopje een plek omhoog en omlaag', [ids(M.schuifKopje(lijst, 'activa', 'omhoog')), ids(M.schuifKopje(lijst, 'activa', 'omlaag'))], ['cabd', 'abdc']);
  gelijk('eerste kopje omhoog en laatste omlaag blijft staan', [ids(M.schuifKopje(lijst, 'uitvoering', 'omhoog')), ids(M.schuifKopje(lijst, 'organisatie', 'omlaag'))], ['abcd', 'abcd']);
  gelijk('de totalen volgen de nieuwe volgorde van de kopjes', M.berekenBegroting(M.verplaatsKopje([{ ...a, bedrag: '10' }, { ...c, bedrag: '5' }], 'activa', 'uitvoering')).perCategorie.map((x) => x.id), ['activa', 'uitvoering']);
  gelijk('de volgorde blijft bewaard bij opslaan en teruglezen', M.leesBudgetRegels(M.budgetKolom(M.regelsVoorOpslag(M.verplaatsKopje([{ ...a, bedrag: '10' }, { ...c, bedrag: '5' }], 'activa', 'uitvoering')).regels)).map((x) => x.id), ['c', 'a']);
  gelijk('de Excel krijgt de regels in de nieuwe volgorde', M.expenseLinesVoorExcel(M.verplaatsKopje([{ ...a, bedrag: '10' }, { ...c, bedrag: '5' }], 'activa', 'uitvoering')).map((x) => x.description), ['C', 'A']);
}

sectie('7. Kopjes zijn optioneel: weghalen, zonder kopje, eigen kopje');
{
  const a = r('uitvoering', { id: 'a', omschrijving: 'A' });
  const c = r('activa', { id: 'c', omschrijving: 'C' });
  const lijst = [a, c];

  gelijk('een eigen kopje: naam wordt netjes', M.eigenKopjeSleutel('  Locatie   en huisvesting '), 'eigen:Locatie en huisvesting');
  gelijk('lege naam geeft niets', [M.eigenKopjeSleutel(''), M.eigenKopjeSleutel('   '), M.eigenKopjeSleutel(null)], [null, null, null]);
  gelijk('een naam als een vast kopje geeft dat vaste kopje, ook met andere hoofdletters', M.eigenKopjeSleutel('projectUITVOERING'), 'uitvoering');
  gelijk('naam wordt afgekapt op 60 tekens en blijft geldig', M.isKopjeSleutel(M.eigenKopjeSleutel('x'.repeat(100))), true);
  gelijk('label van een eigen kopje en van geen kopje', [M.categorieLabel('eigen:Locatie'), M.categorieLabel('')], ['Locatie', 'Overig']);
  gelijk('kopje weghalen: de regels blijven staan, zonder kopje, op dezelfde plek', M.verwijderKopje(lijst, 'uitvoering').map((x) => `${x.id}:${x.categorie}`).join(','), 'a:,c:activa');
  gelijk('kopje weghalen verandert de bedragen niet', M.berekenBegroting(M.verwijderKopje([{ ...a, bedrag: '10' }, { ...c, bedrag: '5' }], 'uitvoering')).totaalGeld, 15);
  gelijk('regels zonder kopje hebben een eigen groep in de volgorde', M.kopjeVolgorde(M.verwijderKopje(lijst, 'uitvoering')), ['', 'activa']);
  gelijk('regel naar geen kopje slepen kan', M.verplaatsRegel(lijst, 'c', '').map((x) => `${x.id}:${x.categorie}`).join(','), 'a:uitvoering,c:');
  gelijk('regel zonder kopje en eigen kopje worden bewaard en teruggelezen', M.leesBudgetRegels(M.budgetKolom(M.regelsVoorOpslag([{ ...a, categorie: '', bedrag: '10' }, { ...c, categorie: 'eigen:Locatie', bedrag: '5' }]).regels)).map((x) => x.categorie), ['', 'eigen:Locatie']);
  gelijk('Excel krijgt de naam van het eigen kopje', M.expenseLinesVoorExcel([{ ...c, categorie: 'eigen:Locatie', bedrag: '5' }])[0].category, 'locatie');
  gelijk('kopjedefinitie van een eigen kopje heeft suggesties maar geen uitleg; geen kopje heeft geen suggesties', [M.kopjeDef('eigen:X').suggesties.length > 0, M.kopjeDef('eigen:X').toelichting.length, M.kopjeDef('').suggesties.length], [true, 0, 0]);
  gelijk('namen voor elementen zijn veilig', [M.kopjeSlug(''), M.kopjeSlug('eigen:Locatie en huisvesting!'), M.kopjeSlug('activa')], ['zonder', 'eigen-locatie-en-huisvesting', 'activa']);
  gelijk('een nieuwe regel zonder kopje', M.nieuweRegel('').categorie, '');
}

sectie('8. Herkomst van een bedrag (pop-up bij het bedrag)');
{
  const up = r('uitvoering', { aantal: '100', eenheid: 'uur', tarief: '50', bron: 'upload', bronNaam: 'begroting.xlsx' });
  const h = M.regelHerkomst(up);

  gelijk('upload met aantal x tarief: rijen Herkomst en Berekening', h.rijen.map((x) => x.label), ['Herkomst', 'Berekening']);
  gelijk('de herkomst noemt het bestand', h.rijen[0].waarde, 'Geüpload bestand: begroting.xlsx');
  gelijk('de berekening laat zien hoe het bedrag ontstaat', h.rijen[1].waarde, '100 uur × € 50 = € 5.000');
  gelijk('vast bedrag uit de chat', M.regelHerkomst(r('activa', { bedrag: '1250', bron: 'ai' })).rijen.map((x) => x.waarde), ['Voorstel uit de chat met Subsidie Kompas', 'Vast bedrag: € 1.250']);
  gelijk('schatting krijgt een rij Status en markeert de pop-up', [M.regelHerkomst(r('activa', { bedrag: '900', bron: 'ai', schatting: true })).rijen.map((x) => x.label), M.regelHerkomst(r('activa', { bedrag: '900', bron: 'ai', schatting: true })).schatting], [['Herkomst', 'Berekening', 'Status'], true]);
  gelijk('natura en toelichting staan er ook bij, toelichting laatst', M.regelHerkomst(r('activa', { bedrag: '300', bron: 'upload', soort: 'natura', toelichting: 'Let op: x' })).rijen.map((x) => x.label), ['Herkomst', 'Berekening', 'Soort', 'Toelichting']);
  gelijk('zelf getypt zonder bijzonderheden: geen pop-up', M.regelHerkomst(r('activa', { bedrag: '100' })), { heeft: false, rijen: [] });
  gelijk('zelf getypt met een toelichting: wel, met Zelf ingevoerd', M.regelHerkomst(r('activa', { bedrag: '100', toelichting: 'offerte' })).rijen.map((x) => x.waarde), ['Zelf ingevoerd', 'Vast bedrag: € 100', 'offerte']);
  gelijk('upload zonder bestandsnaam', M.regelHerkomst(r('activa', { bedrag: '5', bron: 'upload' })).rijen[0].waarde, 'Geüpload bestand');
  gelijk('rare invoer geeft geen fout', [M.regelHerkomst(null).heeft, M.regelHerkomst(undefined).heeft, M.regelHerkomst('x').heeft], [false, false, false]);
  gelijk('bestandsnaam wordt bewaard en teruggelezen, ook via opslag', M.leesBudgetRegels(M.budgetKolom(M.regelsVoorOpslag([{ ...up, omschrijving: 'Projectleider', bedrag: '' }]).regels))[0].bronNaam, 'begroting.xlsx');
  gelijk('een zelf getypte regel houdt geen bestandsnaam, ook niet als die er per ongeluk staat', M.leesOpgeslagenRegels([{ omschrijving: 'x', bron: 'handmatig', bronNaam: 'a.xlsx' }])[0].bronNaam, '');
  gelijk('bestandsnaam wordt afgekapt op 120 tekens', M.leesOpgeslagenRegels([{ omschrijving: 'x', bron: 'upload', bronNaam: 'a'.repeat(300) }])[0].bronNaam.length, 120);
  gelijk('voorstelNaarRegels zet bron en bestandsnaam (alleen bij upload)', [M.voorstelNaarRegels([{ omschrijving: 'x', bedrag: 5 }], 'upload', 'b.docx').map((x) => [x.bron, x.bronNaam])[0], M.voorstelNaarRegels([{ omschrijving: 'x', bedrag: 5 }], 'ai', 'b.docx').map((x) => [x.bron, x.bronNaam])[0]], [['upload', 'b.docx'], ['ai', '']]);
}

klaar('begroting-model');
