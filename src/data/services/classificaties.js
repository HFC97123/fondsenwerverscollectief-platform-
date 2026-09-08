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
//
// Belangrijk: bij een mislukte aanroep (bijvoorbeeld een permission-denied
// door een ontbrekend databaserecht) wordt de cache NIET gevuld met het
// mislukte resultaat - anders zou één tijdelijke fout de rest van de sessie
// een lege lijst laten zien, zonder dat een ververste pagina dat ooit kan
// herstellen. Elke aanroeper krijgt bovendien altijd een `error`-veld terug
// en moet dat controleren; stilzwijgend doorgaan alsof de lijst "gewoon
// leeg" is, is precies de fout die deze module eerder maskeerde.
import { query } from '../client.js';

let cachePromise = null;
let bandbreedtesPromise = null;

async function haalTabelOp(tabel) {
  const { data, error } = await query((sb) => sb.from(tabel).select('naam').order('naam'), []);

  return { rows: (data || []).map((r) => r.naam).filter(Boolean), error };
}

// Geeft { themas, doelgroepen, regios, error } terug (elk een array met
// namen, alfabetisch). `error` is null zolang alle drie de opvragingen
// slaagden; anders het eerste foutobject dat optrad. Bij een fout blijven
// de betreffende lijsten leeg (nooit een eigen hardgecodeerde lijst als
// terugval) én wordt de cache overgeslagen, zodat een volgende aanroep
// (bijvoorbeeld na een pagina-ververs) het opnieuw probeert.
export function haalClassificatiesOp() {
  if (!cachePromise) {
    cachePromise = Promise.all([haalTabelOp('themas'), haalTabelOp('doelgroepen'), haalTabelOp('regios')]).then(
      ([themas, doelgroepen, regios]) => {
        const error = themas.error || doelgroepen.error || regios.error || null;

        if (error) {
          cachePromise = null;
        }

        return { themas: themas.rows, doelgroepen: doelgroepen.rows, regios: regios.rows, error };
      },
    );
  }

  return cachePromise;
}

// De centrale bandbreedte-bijdrage-categorieën, op vaste volgorde (laag naar
// hoog bedrag) - niet alfabetisch, vandaar een los pad naast
// haalClassificatiesOp() met zijn eigen vorm ({ id, naam, bedragMin,
// bedragMax } i.p.v. een kale naam-string, omdat de gekoppelde kolom een
// FK-id is, geen vrije tekst). Geeft { rows, error } terug — zie de
// modulenotitie hierboven over waarom dit niet meer stilzwijgend faalt.
export function haalBandbreedtesOp() {
  if (!bandbreedtesPromise) {
    bandbreedtesPromise = query(
      (sb) => sb.from('bandbreedtes_bijdrage').select('id, naam, bedrag_min, bedrag_max, volgorde').order('volgorde'),
      [],
    ).then(({ data, error }) => {
      if (error) {
        bandbreedtesPromise = null;
      }

      return {
        rows: (data || []).map((r) => ({ id: r.id, naam: r.naam, bedragMin: r.bedrag_min, bedragMax: r.bedrag_max })),
        error,
      };
    });
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
