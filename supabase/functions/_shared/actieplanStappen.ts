// Concrete vervolgstappen (het actieplan) per financieringsmogelijkheid. ZUIVER: geen database, geen netwerk.
//
// De planning zelf (voorbereiden, indienen, opvolgen, herkomst per datum) zit in actieplanPlanning.ts. Dit bestand zet de uitkomst om naar
// actiestappen voor het contract en voegt de stappen toe die uit andere gegevens volgen:
//   - Wat nog niet vaststaat (bijdragegrenzen, bedrag, bronstatus) wordt een eigen vervolgstap en staat in de toelichting.
//   - Een goede bronstatus ('gecontroleerd') betekent niet dat het lid in aanmerking komt: de stappen blijven "voorwaarden controleren".
//   - Een mislukte of ontbrekende broncontrole blokkeert niets; er komt een stap "bron zelf controleren" bij.
//   - Een deadline wordt alleen gebruikt als het contract hem als geverifieerd (uit onze database) kent.
// De validatie van datums (nooit voor vandaag, nooit na een geverifieerde deadline) en het ontdubbelen doet valideerVoorstel (het contract).
// @deno-types="./voorstelContract.d.ts"
import { isEchteDatum, navragenTitel } from './voorstelContract.js';
import type { ContractRegel } from './voorstelContract.js';
import { bronOordeelTekst } from './bronControle.ts';
import type { BronOordeel } from './bronControle.ts';
import { planFinancier } from './actieplanPlanning.ts';
import type { PlanningBron, PlanningOpties, PlanSamenvatting } from './actieplanPlanning.ts';

const MAX_TITEL = 200;

function plusDagen(iso: string, dagen: number): string | null {
  if (!isEchteDatum(iso)) return null;

  const d = new Date(`${iso}T00:00:00Z`);

  d.setUTCDate(d.getUTCDate() + dagen);

  return d.toISOString().slice(0, 10);
}

type Stap = Record<string, unknown>;

const EIGEN_DATUM = 'Voorlopige planningsaanname, geen datum van de financier: eigen streefdatum. U kunt de datum aanpassen.';

// Een losse eigen stap (zonder planningsmotor): altijd een eigen streefdatum en dus herkomst 'aanname'.
function stap(regel: ContractRegel, vandaag: string, dagen: number, titel: string, prioriteit: 'high' | 'normal' | 'low', toelichting: string): Stap {
  const datum = plusDagen(vandaag, dagen);

  return {
    titel: titel.slice(0, MAX_TITEL),
    regelSleutel: regel.sleutel,
    financier: regel.naam,
    datum,
    datumType: 'streef',
    externeDeadline: null,
    prioriteit,
    toelichting,
    automatisch: true,
    fase: null,
    datumHerkomst: datum ? 'aanname' : null,
    datumBron: datum ? `eigen streefdatum, ${dagen} dagen na vandaag` : null,
    datumControle: null,
  };
}

export interface PlantOpties {
  bronOordeel?: BronOordeel; // alleen bekend bij het OPSLAAN (de server leest dan de vastgelegde broncontrole)
  heeftBedrag?: boolean; // of het lid nu een bedrag voor deze regel koos
  planning?: PlanningBron | null; // wat de database over het plannen van deze financier weet (server)
  planningOpties?: PlanningOpties;
}

export interface PlantUitkomst {
  acties: Stap[];
  samenvatting: PlanSamenvatting;
}

// Plan voor één regel: de reeks stappen plus de samenvatting (modus, voorbereidingstijd, aannames, waarschuwingen) voor de interface.
export function plantRegel(regel: ContractRegel, vandaag: string, opties: PlantOpties = {}): PlantUitkomst {
  const geverifieerd = Boolean(regel.deadline && regel.deadline.status === 'geverifieerd' && regel.deadline.datum && isEchteDatum(regel.deadline.datum));
  // De deadline van het CONTRACT geldt (alleen geverifieerd = uit onze database); een niet-geverifieerde datum telt hier nooit.
  const planning: PlanningBron = { ...(opties.planning ?? {}), deadline: geverifieerd ? regel.deadline.datum : null };
  const plan = planFinancier(regel.naam, planning, vandaag, { bedrag: regel.bedrag, ...(opties.planningOpties ?? {}) });
  const uit: Stap[] = plan.stappen.map((s) => ({
    titel: s.titel,
    regelSleutel: regel.sleutel,
    financier: regel.naam,
    datum: s.datum,
    datumType: 'streef',
    externeDeadline: s.externeDeadline,
    prioriteit: s.prioriteit,
    toelichting: s.toelichting,
    automatisch: true,
    fase: s.fase,
    datumHerkomst: s.datumHerkomst,
    datumBron: s.datumBron,
    datumControle: s.datumControle,
  }));

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

  return { acties: uit, samenvatting: plan.samenvatting };
}

// Reeks stappen voor één regel (zie plantRegel).
export function plantActies(regel: ContractRegel, vandaag: string, opties: PlantOpties = {}): Stap[] {
  return plantRegel(regel, vandaag, opties).acties;
}

// Een stap voor een online gevonden financier (staat niet in onze database): nooit gecontroleerd, nooit een deadline of bedrag.
// Titels bevatten de naam van de financier, zodat dezelfde stap bij een tweede poging als dubbel wordt herkend.
export function plantOnlineActies(naam: string, url: string | null, vandaag: string): Array<{ titel: string; datum: string | null; prioriteit: 'high' | 'normal' | 'low'; toelichting: string }> {
  const bron = url ? ` Bron waar Subsidiekompas het vond: ${url}.` : '';
  const kort = (t: string) => t.slice(0, MAX_TITEL);
  const d = (n: number) => plusDagen(vandaag, n);

  return [
    { titel: kort(`${naam} beoordelen: past dit bij uw project?`), datum: d(7), prioriteit: 'high', toelichting: `Online gevonden door Subsidiekompas en niet gecontroleerd. Beoordeel of de financier bestaat, actief is en bij uw doelgroep en werkgebied past.${bron} Eigen streefdatum.` },
    { titel: kort(navragenTitel(naam)), datum: d(14), prioriteit: 'normal', toelichting: `Er is geen deadline, behandeltermijn, bijdragegrens of bedrag bekend. Vraag het aanvraagmoment en de behandeltermijn na, noteer ook de voorwaarden en bijdragegrenzen en zet pas daarna een bedrag in uw dekkingsplan. Eigen streefdatum.` },
    { titel: kort(`Beslissen of ${naam} in uw dekkingsplan komt`), datum: d(21), prioriteit: 'normal', toelichting: 'Kies na uw beoordeling: opnemen met een bedrag, laten staan als reserve, of verwijderen. Eigen streefdatum.' },
  ];
}
