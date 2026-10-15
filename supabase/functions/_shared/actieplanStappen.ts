// Concrete vervolgstappen (het actieplan) per financieringsmogelijkheid. ZUIVER: geen database, geen netwerk.
//
// Vroeger waren er alleen taken als de deadline bekend en geverifieerd was; zonder bekende deadline bleef er één verificatietaak over. Nu krijgt
// ELKE gekozen mogelijkheid een bruikbare reeks vervolgstappen, met deze regels:
//   - Een externe deadline van de financier wordt alleen gebruikt als hij uit onze database komt en geverifieerd is (dan: terugplannen vanaf die
//     datum, zoals voorheen). Zonder geverifieerde deadline zijn alle datums EIGEN streefdatums vanaf vandaag, en dat staat er ook bij.
//   - Wat nog niet vaststaat (deadline, bijdragegrenzen, bedrag, bronstatus) wordt een eigen vervolgstap en staat in de toelichting.
//   - Een goede bronstatus ('gecontroleerd') betekent niet dat het lid in aanmerking komt: de stappen blijven "voorwaarden controleren".
//   - Een mislukte of ontbrekende broncontrole blokkeert niets; er komt een stap "bron zelf controleren" bij.
//
// De validatie van datums (nooit voor vandaag, nooit na een geverifieerde deadline) en het ontdubbelen doet valideerVoorstel (het contract).
// @deno-types="./voorstelContract.d.ts"
import { isEchteDatum, plantTerug } from './voorstelContract.js';
import type { ContractRegel } from './voorstelContract.js';
import { bronOordeelTekst } from './bronControle.ts';
import type { BronOordeel } from './bronControle.ts';

const MAX_TITEL = 200;

function plusDagen(iso: string, dagen: number): string | null {
  if (!isEchteDatum(iso)) return null;

  const d = new Date(`${iso}T00:00:00Z`);

  d.setUTCDate(d.getUTCDate() + dagen);

  return d.toISOString().slice(0, 10);
}

type Stap = Record<string, unknown>;

function stap(regel: ContractRegel, vandaag: string, dagen: number, titel: string, prioriteit: 'high' | 'normal' | 'low', toelichting: string): Stap {
  return {
    titel: titel.slice(0, MAX_TITEL),
    regelSleutel: regel.sleutel,
    financier: regel.naam,
    datum: plusDagen(vandaag, dagen),
    datumType: 'streef',
    externeDeadline: null,
    prioriteit,
    toelichting,
    automatisch: true,
  };
}

const EIGEN_DATUM = 'Eigen streefdatum, geen deadline van de financier.';

// Reeks stappen voor één regel. `bronOordeel` is alleen bekend bij het OPSLAAN (de server leest dan de vastgelegde broncontrole); bij het tonen van
// het voorstel is hij undefined en komt er geen bronstap in het voorstel. `heeftBedrag`: of het lid nu een bedrag voor deze regel koos.
export function plantActies(regel: ContractRegel, vandaag: string, opties: { bronOordeel?: BronOordeel; heeftBedrag?: boolean } = {}): Stap[] {
  const geverifieerd = Boolean(regel.deadline && regel.deadline.status === 'geverifieerd' && regel.deadline.datum && isEchteDatum(regel.deadline.datum));
  const uit: Stap[] = [];

  if (geverifieerd) {
    // Bekende deadline: terugplannen vanaf die datum (voorwaarden, vooroverleg, stukken, voorbereiden, indienen).
    uit.push(...plantTerug(regel, vandaag));
  } else {
    uit.push(
      stap(regel, vandaag, 7, `Deadline en openstelling van ${regel.naam} verifiëren`, 'high', `De deadline is niet geverifieerd. Controleer de actuele openstelling bij de financier voordat u verder plant. ${EIGEN_DATUM}`),
      stap(regel, vandaag, 10, `Voorwaarden en doelgroep van ${regel.naam} met uw project vergelijken`, 'high', `Lees de actuele voorwaarden op de website van de financier en noteer wat niet past of onduidelijk is. ${EIGEN_DATUM}`),
      stap(regel, vandaag, 14, `Contact opnemen met ${regel.naam}: vooroverleg of vragen over passendheid`, 'normal', `Vraag naar de eerstvolgende ronde, de deadline en of uw project past. ${EIGEN_DATUM}`),
      stap(regel, vandaag, 21, 'Projectstukken verzamelen (begroting, plan, statuten)', 'normal', EIGEN_DATUM),
      stap(regel, vandaag, 28, `Aanvraagplanning voor ${regel.naam} maken zodra de deadline bekend is`, 'normal', `Zodra de deadline is bevestigd, plant u de stappen terug vanaf die datum (voorbereiden, laten reviewen, indienen). ${EIGEN_DATUM}`),
    );
  }

  // Wat nog niet vaststaat wordt een eigen stap.
  if (regel.grenzen && regel.grenzen.min == null && regel.grenzen.max == null) {
    uit.push(stap(regel, vandaag, 7, `Bijdragegrenzen van ${regel.naam} navragen`, 'normal', `De minimale en maximale bijdrage zijn niet bekend. Zonder grenzen kan het aan te vragen bedrag niet worden bepaald. ${EIGEN_DATUM}`));
  }

  if (opties.heeftBedrag === false) {
    uit.push(stap(regel, vandaag, 10, `Aan te vragen bedrag bij ${regel.naam} bepalen`, 'normal', `Er is nog geen bedrag voor deze mogelijkheid gekozen. Bepaal het bedrag op basis van de grenzen van de financier en uw financieringsgat. ${EIGEN_DATUM}`));
  }

  const o = opties.bronOordeel;

  if (o && o !== 'gecontroleerd') {
    uit.push(stap(regel, vandaag, 5, `Bron van ${regel.naam} zelf controleren`, 'high', `${bronOordeelTekst(o)} ${EIGEN_DATUM}`));
  }

  return uit;
}

// Een stap voor een online gevonden financier (staat niet in onze database): nooit gecontroleerd, nooit een deadline of bedrag.
// Titels bevatten de naam van de financier, zodat dezelfde stap bij een tweede poging als dubbel wordt herkend.
export function plantOnlineActies(naam: string, url: string | null, vandaag: string): Array<{ titel: string; datum: string | null; prioriteit: 'high' | 'normal' | 'low'; toelichting: string }> {
  const bron = url ? ` Bron waar Subsidiekompas het vond: ${url}.` : '';
  const kort = (t: string) => t.slice(0, MAX_TITEL);
  const d = (n: number) => plusDagen(vandaag, n);

  return [
    { titel: kort(`${naam} beoordelen: past dit bij uw project?`), datum: d(7), prioriteit: 'high', toelichting: `Online gevonden door Subsidiekompas en niet gecontroleerd. Beoordeel of de financier bestaat, actief is en bij uw doelgroep en werkgebied past.${bron} Eigen streefdatum.` },
    { titel: kort(`Voorwaarden, deadline en bijdrage van ${naam} nagaan`), datum: d(14), prioriteit: 'normal', toelichting: `Er is geen deadline, bijdragegrens of bedrag bekend. Noteer wat u vindt en zet pas daarna een bedrag in uw dekkingsplan. Eigen streefdatum.` },
    { titel: kort(`Beslissen of ${naam} in uw dekkingsplan komt`), datum: d(21), prioriteit: 'normal', toelichting: 'Kies na uw beoordeling: opnemen met een bedrag, laten staan als reserve, of verwijderen. Eigen streefdatum.' },
  ];
}
