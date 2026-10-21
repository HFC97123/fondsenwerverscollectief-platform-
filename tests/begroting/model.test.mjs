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
    r('overig', { omschrijving: 'Nog onbekend' }),
  ]);

  gelijk('totaal kosten in geld', t.totaalGeld, 8000);
  gelijk('in natura telt niet mee in het totaal', t.totaalNatura, 1200);
  gelijk('subtotaal per kopje', t.perCategorie.map((c) => `${c.id}:${c.subtotaal}`).join(','), 'uitvoering:5000,activa:3000,organisatie:0,overig:0');
  gelijk('regel zonder bedrag wordt gemeld, niet meegeteld', t.zonderBedrag.map((x) => x.omschrijving), ['Nog onbekend']);
  check('volgorde van de kopjes is die van de lijst, niet van invoer', t.perCategorie[0].id === 'uitvoering' && t.perCategorie[1].id === 'activa');
  gelijk('een helemaal lege regel telt niet als "zonder bedrag"', M.berekenBegroting([r('overig')]).zonderBedrag.length, 0);
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
  gelijk('onbekend kopje wordt overig', M.leesBudgetRegels([{ categorie: 'bestaatniet', omschrijving: 'x' }])[0].categorie, 'overig');
  gelijk('kapotte kolom geeft een lege lijst', [M.leesBudgetRegels(null), M.leesBudgetRegels('x'), M.leesBudgetRegels({ regels: 5 })].map((x) => x.length), [0, 0, 0]);
  gelijk('te lange omschrijving wordt afgekapt', M.leesBudgetRegels([{ omschrijving: 'a'.repeat(500) }])[0].omschrijving.length, 200);
  gelijk('bron onbekend wordt handmatig', M.leesBudgetRegels([{ omschrijving: 'x', bron: 'raar' }])[0].bron, 'handmatig');
}

sectie('4. Kopjes en suggesties');
{
  const ids = M.CATEGORIEEN.map((c) => c.id);

  gelijk('geen dubbele kopjes', new Set(ids).size, ids.length);
  gelijk('de drie kopjes van Aisya, plus Overig', ids, ['uitvoering', 'activa', 'organisatie', 'overig']);
  const alle = M.CATEGORIEEN.flatMap((c) => c.suggesties.map(([n]) => n));
  check('personeel en vrijwilligers horen bij Projectuitvoering, voedselpakketten bij Activa, communicatie en huisvesting bij Organisatiekosten', M.CATEGORIEEN[0].suggesties.some(([n]) => n === 'Projectleider') && M.CATEGORIEEN[0].suggesties.some(([n]) => /Vrijwilliger/.test(n)) && M.CATEGORIEEN[1].suggesties.some(([n]) => n === 'Voedselpakketten') && M.CATEGORIEEN[2].suggesties.some(([n]) => /Communicatie/.test(n)) && M.CATEGORIEEN[2].suggesties.some(([n]) => /Zaalhuur/.test(n)));
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

klaar('begroting-model');
