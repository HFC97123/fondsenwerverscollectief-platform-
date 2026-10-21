// Sluit de begroting met het dekkingsplan? Zuiver: geen database, geen netwerk, geen model.
//
// Na een upload of een voorstel uit de chat zet de server de nieuwe regels naast de begroting die er al stond en vergelijkt het totaal met het dekkingsplan van het project
// (eigen bijdrage, toegekend, aangevraagd en in planning), met dezelfde rekenmodule als het scherm (dekkingsplanRekenen.js). Het resultaat is een melding; er wordt
// niets geblokkeerd of aangepast. Het scherm toont het bij het groene blok, zodat het lid meteen ziet of de begroting en de dekking bij elkaar passen.
import { berekenDekking } from './dekkingsplanRekenen.js';
import { bedragTekst, financieringen, leesRegels } from './begrotingFeiten.ts';

export const MAX_REGELS_BEGROTING = 200; // gelijk aan MAX_REGELS in begrotingModel.js

export type SluitUitkomst = 'sluitend' | 'nog-te-dekken' | 'te-veel-gedekt' | 'geen-dekking';

export interface SluitControle {
  uitkomst: SluitUitkomst;
  begroting: number; // totaal van de regels die meetellen (hele euro's, zoals het scherm opslaat)
  eigenBijdrage: number;
  toegekend: number;
  aangevraagd: number;
  inPlanning: number;
  nogTeDekken: number; // na toegekend, aangevraagd, eigen bijdrage en wat in planning staat
  nogTeDekkenZonderPlanning: number; // alleen toegekend, aangevraagd en eigen bijdrage
  teVeel: number; // dekking boven de begroting
  tekst: string;
}

const euro = (n: number) => `€ ${bedragTekst(n)}`;

const schoon = (t: unknown, max: number): string => String(t ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const getal = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;

  const n = typeof v === 'number' ? v : Number(v);

  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : null;
};

const lijstVan = (x: unknown): unknown[] => (x && typeof x === 'object' && Array.isArray((x as any).regels) ? ((x as any).regels as unknown[]) : Array.isArray(x) ? x : []);

const sleutel = (r: any) => `${schoon(r?.categorie, 80)}|${schoon(r?.omschrijving, 200).toLowerCase()}|${getal(r?.aantal)}|${getal(r?.tarief)}|${getal(r?.bedrag)}`;

// Zoals samenvoegVoorstel in het scherm: 'toevoegen' laat alles staan en slaat regels over die er al precies zo staan; 'vervangen' neemt alleen de nieuwe. Maximaal 200.
export function samenvoegRuw(bestaand: unknown, nieuw: unknown[], modus: 'toevoegen' | 'vervangen'): unknown[] {
  const huidig = modus === 'vervangen' ? [] : lijstVan(bestaand);
  const gezien = new Set(huidig.map(sleutel));
  const erbij = (Array.isArray(nieuw) ? nieuw : []).filter((r) => !gezien.has(sleutel(r)));

  return [...huidig, ...erbij].slice(0, MAX_REGELS_BEGROTING);
}

export function sluitControle(inv: { regels: unknown[]; eigenBijdrage: unknown; financiering: unknown }): SluitControle | null {
  try {
    const geld = leesRegels({ regels: inv.regels }).filter((r) => !r.natura);
    const totaal = Math.round(geld.reduce((n, r) => n + (r.bedrag ?? 0), 0));

    if (totaal <= 0) return null; // zonder begroting valt er niets te vergelijken

    const eigen = getal(inv.eigenBijdrage) ?? 0;
    const lijst = financieringen(inv.financiering);
    const d = berekenDekking({ begroting: totaal, regels: lijst.map((f) => ({ status: f.status, awarded: f.awarded, requested: f.requested })), overige: eigen }) as any;

    const toegekend = Math.round(Number(d.toegekend ?? 0));
    const aangevraagd = Math.round(Number(d.aangevraagd ?? 0));
    const inPlanning = Math.round(Number(d.gepland ?? 0));
    const nogNodig = Math.max(0, Math.round(Number(d.nogNodig ?? 0)));
    const nogTePlannen = Math.max(0, Math.round(Number(d.nogTePlannen ?? 0)));
    const teVeel = Math.max(0, Math.round(Number(d.overgedekt ?? 0)));
    const gedektZeker = totaal - nogNodig;
    const basis = { begroting: totaal, eigenBijdrage: Math.round(eigen), toegekend, aangevraagd, inPlanning, nogTeDekken: nogTePlannen, nogTeDekkenZonderPlanning: nogNodig, teVeel };

    if (lijst.length === 0 && eigen <= 0) {
      return { ...basis, uitkomst: 'geen-dekking', tekst: `Er staat nog geen dekking bij dit project. De hele begroting van ${euro(totaal)} moet nog worden gedekt: zet de financiers en uw eigen bijdrage in Projectfinanciering.` };
    }

    if (teVeel > 0) {
      return { ...basis, uitkomst: 'te-veel-gedekt', tekst: `De dekking is ${euro(teVeel)} hoger dan de begroting van ${euro(totaal)} (toegekend, aangevraagd en in planning samen). Kijk of een financier of een regel in de begroting niet klopt.` };
    }

    if (nogTePlannen === 0) {
      return { ...basis, uitkomst: 'sluitend', tekst: `De begroting van ${euro(totaal)} sluit met het dekkingsplan.${inPlanning > 0 ? ` Let op: ${euro(inPlanning)} daarvan staat nog in planning en is niet aangevraagd.` : ''}` };
    }

    return {
      ...basis,
      uitkomst: 'nog-te-dekken',
      tekst: `De begroting van ${euro(totaal)} sluit nog niet: ${euro(gedektZeker)} is gedekt (eigen bijdrage, toegekend en aangevraagd)${inPlanning > 0 ? `, ${euro(inPlanning)} staat in planning` : ''}. Nog te dekken: ${euro(nogTePlannen)}.`,
    };
  } catch (_e) {
    return null; // een rare begroting blokkeert nooit het resultaat
  }
}

// Beide standen: wat er na "toevoegen" en (als er al een begroting stond) na "vervangen" van over is.
export function sluitNaToevoegen(inv: { bestaand: unknown; nieuw: unknown[]; eigenBijdrage: unknown; financiering: unknown }): { toevoegen: SluitControle | null; vervangen: SluitControle | null } {
  const bestaandAantal = lijstVan(inv.bestaand).length;

  return {
    toevoegen: sluitControle({ regels: samenvoegRuw(inv.bestaand, inv.nieuw, 'toevoegen'), eigenBijdrage: inv.eigenBijdrage, financiering: inv.financiering }),
    vervangen: bestaandAantal > 0 ? sluitControle({ regels: samenvoegRuw(inv.bestaand, inv.nieuw, 'vervangen'), eigenBijdrage: inv.eigenBijdrage, financiering: inv.financiering }) : null,
  };
}
