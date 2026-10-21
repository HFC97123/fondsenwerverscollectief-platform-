// Feiten uit de begroting en het dekkingsplan van een project, voor de projectplan- en fondsteksten. Zuiver: geen database, geen netwerk, geen model.
//
// Waarom: elke tekst per fonds moet de ACTUELE begroting en het ACTUELE dekkingsplan (met de toekenningen tot nu toe) gebruiken. De server leest ze bij elke aanroep
// opnieuw (leesPlanBron) en zet ze hier om in feiten. De bedragen worden hier door ONZE code uitgerekend en opgeschreven; het model mag ze alleen overnemen
// (projectplan.ts verwijdert elke zin met een getal dat niet in de gebruikte feiten staat).
//
// Regels:
//   - Alleen wat het lid zelf heeft vastgelegd: begrotingsregels (Documenten > Begroting) en financieringsregels (Projectfinanciering).
//   - Een bedrag dat als schatting is gemarkeerd, blijft in de tekst "schatting"; een bijdrage in natura telt niet mee in het totaal en staat apart.
//   - Afgewezen of ingetrokken financiering staat er niet in. Een financier die het abonnement niet laat zien, krijgt geen naam.
import { berekenDekking, regelUitRpc } from './dekkingsplanRekenen.js';

export interface BegrotingFeit {
  sleutel: string;
  label: string;
  tekst: string;
  bron: 'begroting' | 'dekkingsplan';
}

const MAX_REGELS_TOTAAL = 200;
const MAX_FEIT_TEKST = 1_900;
const VASTE_KOPJES: Readonly<Record<string, string>> = Object.freeze({
  uitvoering: 'Projectuitvoering',
  activa: 'Activa en uitrusting',
  communicatie: 'Communicatiekosten',
  organisatie: 'Organisatiekosten',
});

const schoon = (t: unknown, max: number): string => String(t ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const getal = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;

  const n = typeof v === 'number' ? v : Number(v);

  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : null;
};

// 12500 -> "12.500"; 12.5 -> "12,50"
export function bedragTekst(n: number): string {
  const [heel, deel] = (Math.round(n * 100) / 100).toFixed(2).split('.');
  const mooi = heel.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return deel === '00' ? mooi : `${mooi},${deel}`;
}

const euro = (n: number) => `€ ${bedragTekst(n)}`;

interface Regel {
  kopje: string;
  omschrijving: string;
  aantal: number | null;
  eenheid: string;
  tarief: number | null;
  bedrag: number | null; // het bedrag van deze regel (aantal x tarief of vast bedrag), of null
  natura: boolean;
  schatting: boolean;
}

function kopjeNaam(categorie: string): string {
  if (VASTE_KOPJES[categorie]) return VASTE_KOPJES[categorie];
  if (categorie.startsWith('eigen:')) return schoon(categorie.slice(6), 60) || 'Overige kosten';

  return 'Overige kosten';
}

export function leesRegels(ruw: unknown): Regel[] {
  const lijst = ruw && typeof ruw === 'object' && Array.isArray((ruw as any).regels) ? ((ruw as any).regels as unknown[]) : [];
  const uit: Regel[] = [];

  for (const r of lijst.slice(0, MAX_REGELS_TOTAAL)) {
    if (!r || typeof r !== 'object') continue;

    const o = r as Record<string, unknown>;
    const omschrijving = schoon(o.omschrijving, 200);

    if (!omschrijving) continue;

    const aantal = getal(o.aantal);
    const tarief = getal(o.tarief);
    const bedrag = aantal !== null && tarief !== null ? Math.round(aantal * tarief * 100) / 100 : getal(o.bedrag);

    uit.push({
      kopje: kopjeNaam(schoon(o.categorie, 80)),
      omschrijving,
      aantal: aantal !== null && tarief !== null ? aantal : null,
      eenheid: schoon(o.eenheid, 40),
      tarief: aantal !== null && tarief !== null ? tarief : null,
      bedrag,
      natura: o.soort === 'natura',
      schatting: o.schatting === true && bedrag !== null,
    });
  }

  return uit;
}

function regelTekst(r: Regel): string {
  const reken = r.aantal !== null && r.tarief !== null ? `${bedragTekst(r.aantal)}${r.eenheid ? ` ${r.eenheid}` : ''} × ${euro(r.tarief)} = ` : '';
  const bedrag = r.bedrag === null ? 'bedrag nog niet ingevuld' : `${reken}${euro(r.bedrag)}`;

  return `${r.omschrijving}: ${bedrag}${r.schatting ? ' (schatting)' : ''}`;
}

function begrotingFeiten(ruw: unknown): BegrotingFeit[] {
  const regels = leesRegels(ruw);

  if (!regels.length) return [];

  const feiten: BegrotingFeit[] = [];
  const kopjes: string[] = [];

  for (const r of regels) if (!r.natura && !kopjes.includes(r.kopje)) kopjes.push(r.kopje);

  let totaal = 0;
  let schatting = 0;

  for (const k of kopjes) {
    const deze = regels.filter((r) => !r.natura && r.kopje === k);
    const subtotaal = deze.reduce((n, r) => n + (r.bedrag ?? 0), 0);

    totaal += subtotaal;
    schatting += deze.filter((r) => r.schatting).reduce((n, r) => n + (r.bedrag ?? 0), 0);

    const regelTeksten: string[] = [];
    let lengte = 0;

    for (const r of deze) {
      const t = regelTekst(r);

      if (lengte + t.length > MAX_FEIT_TEKST - 120) break;

      regelTeksten.push(t);
      lengte += t.length + 2;
    }

    const rest = deze.length - regelTeksten.length;

    feiten.push({
      sleutel: `begroting.kopje.${feiten.length + 1}`,
      bron: 'begroting',
      label: `Begroting: ${k}`,
      tekst: `${regelTeksten.join('; ')}${rest > 0 ? `; en nog ${rest} regels` : ''}. Subtotaal ${k}: ${euro(subtotaal)}.`.slice(0, MAX_FEIT_TEKST),
    });
  }

  const natura = regels.filter((r) => r.natura);

  if (natura.length) {
    const naturaTekst = natura.slice(0, 15).map(regelTekst).join('; ');
    const naturaTotaal = natura.reduce((n, r) => n + (r.bedrag ?? 0), 0);

    feiten.push({
      sleutel: 'begroting.natura',
      bron: 'begroting',
      label: 'Begroting: bijdragen in natura',
      tekst: `${naturaTekst}. Dit zijn bijdragen in natura; ze tellen niet mee in de totale begroting.${naturaTotaal > 0 ? ` Waarde in natura: ${euro(naturaTotaal)}.` : ''}`.slice(0, MAX_FEIT_TEKST),
    });
  }

  feiten.push({
    sleutel: 'begroting.totaal',
    bron: 'begroting',
    label: 'Begroting: totaal van de regels',
    tekst: `Totaal van de begrotingsregels: ${euro(totaal)}${schatting > 0 ? `, waarvan ${euro(schatting)} nog een schatting is` : ''}.`,
  });

  return feiten;
}

interface Financiering {
  naam: string;
  status: string;
  requested: number | null;
  awarded: number | null;
  zichtbaar: boolean;
}

function financieringen(ruw: unknown): Financiering[] {
  const lijst = Array.isArray(ruw) ? ruw.slice(0, 200) : [];
  const uit: Financiering[] = [];

  for (const rij of lijst) {
    if (!rij || typeof rij !== 'object') continue;

    const r = regelUitRpc(rij) as any;

    if (!r || r.status === 'rejected' || r.status === 'withdrawn') continue;

    uit.push({
      naam: r.bronStatus === 'zichtbaar' ? schoon(r.naam, 120) || 'Onbekende financier' : 'Een financier die niet zichtbaar is in uw abonnement',
      status: String(r.status),
      requested: getal(r.requested),
      awarded: getal(r.awarded),
      zichtbaar: r.bronStatus === 'zichtbaar',
    });
  }

  return uit;
}

function dekkingFeiten(project: Record<string, unknown>, ruw: unknown): BegrotingFeit[] {
  const lijst = financieringen(ruw);
  const begroting = getal(project?.begroting);
  const eigen = getal(project?.eigenBijdrage) ?? 0;
  const feiten: BegrotingFeit[] = [];

  const toegekend = lijst.filter((f) => f.status === 'awarded');
  const aangevraagd = lijst.filter((f) => f.status === 'submitted');
  const planning = lijst.filter((f) => f.status === 'interesting' || f.status === 'preparing');
  const bedragToegekend = (f: Financiering) => f.awarded ?? f.requested;
  const noem = (f: Financiering, b: number | null) => `${f.naam} ${b === null ? '(bedrag nog niet bekend)' : euro(b)}`;

  const delenToegekend: string[] = [];

  if (eigen > 0) delenToegekend.push(`Eigen bijdrage ${euro(eigen)}`);

  for (const f of toegekend) delenToegekend.push(noem(f, bedragToegekend(f)));

  if (delenToegekend.length) {
    feiten.push({ sleutel: 'dekking.toegekend', bron: 'dekkingsplan', label: 'Dekkingsplan: toegekend en eigen bijdrage', tekst: `Al gedekt: ${delenToegekend.join('; ')}.`.slice(0, MAX_FEIT_TEKST) });
  }

  if (aangevraagd.length) {
    feiten.push({
      sleutel: 'dekking.aangevraagd',
      bron: 'dekkingsplan',
      label: 'Dekkingsplan: aangevraagd, nog geen besluit',
      tekst: `Aangevraagd, nog geen besluit: ${aangevraagd.map((f) => noem(f, f.requested)).join('; ')}.`.slice(0, MAX_FEIT_TEKST),
    });
  }

  if (planning.length) {
    feiten.push({
      sleutel: 'dekking.planning',
      bron: 'dekkingsplan',
      label: 'Dekkingsplan: in planning',
      tekst: `In planning, nog niet aangevraagd: ${planning.map((f) => noem(f, f.requested)).join('; ')}.`.slice(0, MAX_FEIT_TEKST),
    });
  }

  if (begroting !== null && begroting > 0) {
    const d = berekenDekking({
      begroting,
      regels: lijst.map((f) => ({ status: f.status, awarded: f.awarded, requested: f.requested })),
      overige: eigen,
    }) as any;
    const gedekt = Math.max(0, begroting - Number(d.nogNodig ?? 0));
    const metPlanning = Math.max(0, begroting - Number(d.nogTePlannen ?? 0));

    feiten.push({
      sleutel: 'dekking.stand',
      bron: 'dekkingsplan',
      label: 'Dekkingsplan: stand',
      tekst:
        `Totale begroting ${euro(begroting)}. Gedekt met toegekend, aangevraagd en eigen bijdrage: ${euro(gedekt)}. ` +
        `Nog te dekken: ${euro(Number(d.nogNodig ?? 0))}. Met de financiers in planning erbij is ${euro(metPlanning)} gedekt en blijft ${euro(Number(d.nogTePlannen ?? 0))} over.`,
    });
  }

  return feiten;
}

export function begrotingEnDekkingFeiten(bron: { project?: Record<string, unknown>; begroting?: unknown; financiering?: unknown }): BegrotingFeit[] {
  try {
    return [...begrotingFeiten(bron?.begroting), ...dekkingFeiten((bron?.project ?? {}) as Record<string, unknown>, bron?.financiering)];
  } catch (_e) {
    return []; // nooit de tekst blokkeren door een rare begroting
  }
}
