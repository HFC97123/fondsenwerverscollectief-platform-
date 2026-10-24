// Concrete vervolgstappen (het actieplan) per financieringsmogelijkheid. ZUIVER: geen database, geen netwerk.
//
// De planning zelf (indiendatum, besluitdatum, herkomst per datum) zit in actieplanPlanning.ts. Dit bestand maakt er een SLANK actieplan van:
// zonder bekende indiendatum één actie (contact opnemen), met een indiendatum twee (indienen en uitslag).
// Een deadline wordt alleen gebruikt als het contract hem als geverifieerd (uit onze database) kent.
// De validatie van datums (nooit voor vandaag, nooit na een geverifieerde deadline) en het ontdubbelen doet valideerVoorstel (het contract).
// @deno-types="./voorstelContract.d.ts"
import { isEchteDatum, navragenTitel } from './voorstelContract.js';
import type { ContractRegel } from './voorstelContract.js';
import type { BronOordeel } from './bronControle.ts';
import { planFinancier, plusMaanden } from './actieplanPlanning.ts';
import type { PlanningBron, PlanningOpties, PlanSamenvatting } from './actieplanPlanning.ts';

const MAX_TITEL = 200;

function plusDagen(iso: string, dagen: number): string | null {
  if (!isEchteDatum(iso)) return null;

  const d = new Date(`${iso}T00:00:00Z`);

  d.setUTCDate(d.getUTCDate() + dagen);

  return d.toISOString().slice(0, 10);
}

type Stap = Record<string, unknown>;

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

// Plan voor één regel, slank (opdracht Aisya, 24-10-2026):
//   - Is er een eerstvolgende indiendatum bekend (uit onze database), dan twee acties: indienen op die datum en de uitslag. Is er geen
//     behandeltermijn of beoordelingsmoment bekend, dan geldt: uitslag binnen ongeveer 3 maanden na indienen.
//   - Is er geen indiendatum bekend, dan één actie: contact opnemen met het fonds over passendheid, aanvraag en behandeltermijn.
// De volledige planningsmotor (planFinancier) blijft de datums en de samenvatting voor de interface leveren.
export function plantRegel(regel: ContractRegel, vandaag: string, opties: PlantOpties = {}): PlantUitkomst {
  const geverifieerd = Boolean(regel.deadline && regel.deadline.status === 'geverifieerd' && regel.deadline.datum && isEchteDatum(regel.deadline.datum));
  // De deadline van het CONTRACT geldt (alleen geverifieerd = uit onze database); een niet-geverifieerde datum telt hier nooit.
  const planning: PlanningBron = { ...(opties.planning ?? {}), deadline: geverifieerd ? regel.deadline.datum : null };
  const plan = planFinancier(regel.naam, planning, vandaag, { bedrag: regel.bedrag, ...(opties.planningOpties ?? {}) });
  const sm = plan.samenvatting;
  const basis = { regelSleutel: regel.sleutel, financier: regel.naam, datumType: 'streef', automatisch: true, datumControle: null };

  if (sm.deadline) {
    const ind = plan.stappen.find((s) => s.fase === 'indienen');
    const bes = plan.stappen.find((s) => s.fase === 'besluit');
    // Een bekende behandeltermijn of een bekend beoordelingsmoment gaat voor; anders ongeveer 3 maanden na indienen.
    const besluitBekend = Boolean(sm.behandeltermijn || (planning.beoordelingsdatum && planning.beoordelingsdatum >= vandaag) || planning.vergaderdatum) && Boolean(bes?.datum);
    const besluitDatum = besluitBekend && bes?.datum ? bes.datum : plusMaanden(sm.deadline, 3);
    const acties: Stap[] = [
      {
        ...basis,
        titel: `Aanvraag bij ${regel.naam} indienen`.slice(0, MAX_TITEL),
        datum: sm.deadline,
        externeDeadline: sm.deadline,
        prioriteit: 'high',
        toelichting: `Uiterste indiendatum: ${sm.deadline}.`,
        fase: 'indienen',
        datumHerkomst: sm.deadline === planning.deadline ? 'bron' : (ind?.datumHerkomst ?? 'berekend'),
        datumBron: sm.deadline === planning.deadline ? 'sluitingsdatum van de financier' : (ind?.datumBron ?? null),
      },
      {
        ...basis,
        titel: `Uitslag van ${regel.naam} verwacht`.slice(0, MAX_TITEL),
        datum: besluitDatum,
        externeDeadline: null,
        prioriteit: 'normal',
        toelichting: besluitBekend ? 'Volgens de behandeltermijn van de financier.' : 'Binnen ongeveer 3 maanden na indienen.',
        fase: 'besluit',
        datumHerkomst: besluitBekend ? (bes?.datumHerkomst ?? 'berekend') : 'aanname',
        datumBron: besluitBekend ? (bes?.datumBron ?? null) : 'ongeveer 3 maanden na indienen',
      },
    ];

    return { acties, samenvatting: sm };
  }

  const datum = plusDagen(vandaag, 7);

  return {
    acties: [
      {
        ...basis,
        titel: navragenTitel(regel.naam),
        datum,
        externeDeadline: null,
        prioriteit: 'high',
        toelichting: 'Er is nog geen indiendatum bekend. Vraag na of uw project past, wanneer u kunt aanvragen en hoe lang de behandeling duurt.',
        fase: 'navragen',
        datumHerkomst: datum ? 'aanname' : null,
        datumBron: datum ? 'eigen streefdatum' : null,
      },
    ],
    samenvatting: sm,
  };
}

// Reeks stappen voor één regel (zie plantRegel).
export function plantActies(regel: ContractRegel, vandaag: string, opties: PlantOpties = {}): Stap[] {
  return plantRegel(regel, vandaag, opties).acties;
}

// Een online gevonden financier (staat niet in onze database): geen deadline of bedrag bekend, dus één stap: contact opnemen.
// De titel is dezelfde als bij een financier zonder indiendatum, zodat een tweede poging hem als dubbel herkent.
export function plantOnlineActies(naam: string, url: string | null, vandaag: string): Array<{ titel: string; datum: string | null; prioriteit: 'high' | 'normal' | 'low'; toelichting: string }> {
  const bron = url ? ` Gevonden via ${url}.` : '';

  return [{ titel: navragenTitel(naam).slice(0, MAX_TITEL), datum: plusDagen(vandaag, 7), prioriteit: 'high', toelichting: `Vraag na of uw project past, wanneer u kunt aanvragen en hoe lang de behandeling duurt.${bron}` }];
}
