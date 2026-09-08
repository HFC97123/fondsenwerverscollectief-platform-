// Centrale classificatielijsten van Subsidie Kompas: disciplines (themas),
// doelgroepen, werkgebieden (regios) en bandbreedte-bijdrage. Eén plek die
// deze opzoektabellen ophaalt, zodat organisatieprofiel, projecten en
// filters/matching/AI altijd uit dezelfde lijst putten - in plaats van dat
// elke pagina zijn eigen hardgecodeerde variant bijhoudt (zoals
// CHIP_OPTIES.themas/doelgroepen dat tot nu toe deden, en zoals de 8
// bandbreedte-categorieën nergens los als JS-array mogen terugkomen).
//
// Alle tabellen zijn publiek leesbaar voor ingelogde leden (RLS:
// authenticated/select/true) en veranderen zelden - vandaar de simpele,
// module-brede cache (per sessie, niet persistent) in plaats van een
// aanroep per veld/pagina.
import { query } from '../client.js';

let cachePromise = null;
let bandbreedtesPromise = null;

async function haalTabelOp(tabel) {
  const { data } = await query((sb) => sb.from(tabel).select('naam').order('naam'), []);

  return (data || []).map((r) => r.naam).filter(Boolean);
}

// Geeft { themas, doelgroepen, regios } terug (elk een array met namen,
// alfabetisch). Bij geen sessie/database komt een lege lijst terug per
// classificatie - de aanroepende pagina valt dan terug op "geen opties",
// nooit op een eigen hardgecodeerde lijst (die zou weer een tweede source
// of truth worden).
export function haalClassificatiesOp() {
  if (!cachePromise) {
    cachePromise = Promise.all([
      haalTabelOp('themas'),
      haalTabelOp('doelgroepen'),
      haalTabelOp('regios'),
    ]).then(([themas, doelgroepen, regios]) => ({ themas, doelgroepen, regios }));
  }

  return cachePromise;
}

// De centrale bandbreedte-bijdrage-categorieën, op vaste volgorde (laag naar
// hoog bedrag) - niet alfabetisch, vandaar een los pad naast
// haalClassificatiesOp() met zijn eigen vorm ({ id, naam, bedragMin,
// bedragMax } i.p.v. een kale naam-string, omdat de gekoppelde kolom een
// FK-id is, geen vrije tekst).
export function haalBandbreedtesOp() {
  if (!bandbreedtesPromise) {
    bandbreedtesPromise = query(
      (sb) => sb.from('bandbreedtes_bijdrage').select('id, naam, bedrag_min, bedrag_max, volgorde').order('volgorde'),
      [],
    ).then(({ data }) =>
      (data || []).map((r) => ({ id: r.id, naam: r.naam, bedragMin: r.bedrag_min, bedragMax: r.bedrag_max })),
    );
  }

  return bandbreedtesPromise;
}

// Voor het zeldzame geval dat een lid tijdens de sessie zelf iets aan een
// classificatie zou kunnen toevoegen (nu nog niet het geval - schrijven kan
// alleen via een migratie/beheerder) - laat de cache dan verversen in plaats
// van de pagina te herladen.
export function wisClassificatieCache() {
  cachePromise = null;
  bandbreedtesPromise = null;
}
