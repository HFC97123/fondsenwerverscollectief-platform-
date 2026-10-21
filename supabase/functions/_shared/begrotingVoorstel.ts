// Begrotingsvoorstel uit het gesprek (Documenten › Begroting, fase 2). Het lid bespreekt de begroting met Subsidie Kompas in de chat; deze module zet het
// antwoord van de chat om in begrotingsregels die het lid kan nakijken en in de begroting kan zetten. Zonder netwerk en zonder database te testen: het model
// komt binnen als `roep`.
//
// Regels die hier gelden:
//   - Alleen wat in de tekst staat. Een kostenpost die niet genoemd wordt, komt er niet in.
//   - De server rekent niets uit. Aantal, tarief en bedrag worden letterlijk overgenomen; het scherm rekent aantal x tarief zelf.
//   - Een bedrag dat de tekst als schatting of richtbedrag noemt, krijgt schatting=true en wordt zo getoond; een bedrag dat het lid zelf noemde niet.
//     Een ontbrekend bedrag blijft leeg.
//   - Het kopje is een vast kopje of een eigen, korte naam. Onbekend of leeg = geen kopje.
//   - Uitkomst wordt streng gevalideerd; wat niet klopt valt weg en wordt geteld.
import type { ModelAanroep } from './aanvraagAssistent.ts';

export const MAX_REGELS_VOORSTEL = 60;
export const MAX_TEKENS_VOORSTEL = 40_000;
const MAX_TEKST = 200;
const MAX_TOELICHTING = 500;
const MAX_KOPJENAAM = 60;
const VASTE_KOPJES = ['uitvoering', 'activa', 'communicatie', 'organisatie'] as const;

export interface VoorstelRegel {
  categorie: string; // vast kopje-id, 'eigen:<naam>' of '' (geen kopje)
  omschrijving: string;
  aantal: number | null;
  eenheid: string;
  tarief: number | null;
  bedrag: number | null;
  soort: 'geld' | 'natura';
  schatting: boolean;
  toelichting: string;
}

export interface VoorstelStatistiek {
  voorgesteld: number;
  geldig: number;
  verworpen: number;
}

const schoon = (t: unknown, max: number): string => String(t ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const getal = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;

  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));

  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : null;
};

export const VOORSTEL_SYSTEEM = `Je zet een gesprek over de begroting van een project om in begrotingsregels. Je krijgt de tekst van het antwoord uit de chat. Antwoord ALLEEN met JSON.

Vorm: {"regels":[{"kopje":"uitvoering|activa|communicatie|organisatie|eigen","eigenKopje":"korte naam, alleen bij kopje eigen","omschrijving":"...","aantal":getal of null,"eenheid":"...","tarief":getal of null,"bedrag":getal of null,"natura":true of false,"schatting":true of false,"toelichting":"..."}]}

Regels:
- Neem alleen kostenposten op die in de tekst staan. Verzin geen posten, aantallen, tarieven of bedragen.
- Reken niets uit. Noemt de tekst aantal en tarief, geef die allebei en laat bedrag null. Noemt de tekst alleen een bedrag voor de post, geef dat als bedrag en laat aantal en tarief null. Noemt de tekst geen bedrag, of staat er [in te vullen door gebruiker], zet dan alles op null.
- schatting is true als de tekst het bedrag of tarief een schatting, richtbedrag, indicatie, circa of ongeveer noemt, of als het duidelijk niet door het lid zelf is opgegeven. Heeft het lid het bedrag zelf genoemd, dan is schatting false.
- natura is true bij een bijdrage in natura (bijvoorbeeld gratis zaal, of uren van vrijwilligers die niet worden vergoed).
- kopje: uitvoering = mankracht, personeelskosten, vrijwilligers en het trainen daarvan en andere kosten om het project uit te voeren; activa = uitrusting en materialen voor de hulpverlening; communicatie = kosten om het project onder de aandacht te brengen; organisatie = kosten voor fondsenwerving, huisvesting, overhead, verzekeringen en boekhouding. Past een post nergens, kies kopje eigen met een korte, duidelijke naam in eigenKopje.
- Totaalregels, subtotalen en dekkingsregels (eigen bijdrage, fondsen) zijn geen kostenposten: laat ze weg.
- omschrijving is kort (maximaal 200 tekens), eenheid is bijvoorbeeld uur, stuk, maand, pakket of vrijwilliger.
- Staat er geen enkele kostenpost in de tekst, antwoord dan {"regels":[]}.`;

export const bouwVoorstelBericht = (tekst: string): string => `TEKST UIT DE CHAT:\n"""\n${String(tekst ?? '').replace(/\u0000/g, '').slice(0, MAX_TEKENS_VOORSTEL).replace(/"""/g, '"')}\n"""`;

// Eén door het model genoemde regel -> een schone regel, of null.
export function schoneVoorstelRegel(ruw: any): VoorstelRegel | null {
  if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw)) return null;

  const omschrijving = schoon(ruw.omschrijving, MAX_TEKST);

  if (!omschrijving) return null;

  const kopje = schoon(ruw.kopje, 20).toLowerCase();
  let categorie = '';

  if ((VASTE_KOPJES as readonly string[]).includes(kopje)) categorie = kopje;
  else if (kopje === 'eigen') {
    const naam = schoon(ruw.eigenKopje, MAX_KOPJENAAM);

    categorie = naam ? `eigen:${naam}` : '';
  }

  let aantal = getal(ruw.aantal);
  let tarief = getal(ruw.tarief);
  let bedrag = getal(ruw.bedrag);

  // Aantal en tarief horen bij elkaar; het scherm rekent ze zelf uit. Eén van de twee alleen zegt niets over een bedrag.
  if ((aantal === null) !== (tarief === null)) {
    aantal = null;
    tarief = null;
  }

  if (aantal !== null && tarief !== null) bedrag = null;

  return {
    categorie,
    omschrijving,
    aantal,
    eenheid: schoon(ruw.eenheid, 40),
    tarief,
    bedrag,
    soort: ruw.natura === true ? 'natura' : 'geld',
    schatting: ruw.schatting === true && (bedrag !== null || tarief !== null),
    toelichting: schoon(ruw.toelichting, MAX_TOELICHTING),
  };
}

export function valideerVoorstel(ruw: unknown): { regels: VoorstelRegel[]; stat: VoorstelStatistiek } {
  const lijst = ruw && typeof ruw === 'object' && Array.isArray((ruw as any).regels) ? ((ruw as any).regels as unknown[]) : [];
  const gezien = new Set<string>();
  const regels: VoorstelRegel[] = [];

  for (const r of lijst) {
    const s = schoneVoorstelRegel(r);

    if (!s) continue;

    const sleutel = `${s.categorie}|${s.omschrijving.toLowerCase()}|${s.aantal}|${s.tarief}|${s.bedrag}`;

    if (gezien.has(sleutel)) continue;

    gezien.add(sleutel);
    regels.push(s);

    if (regels.length >= MAX_REGELS_VOORSTEL) break;
  }

  return { regels, stat: { voorgesteld: lijst.length, geldig: regels.length, verworpen: Math.max(0, lijst.length - regels.length) } };
}

// -> regels (mogelijk leeg) en het verbruik; gelukt=false als het model niets bruikbaars gaf (dan telt de aanroep niet mee).
export async function maakBegrotingVoorstel(inv: { tekst: string; roep: ModelAanroep }): Promise<{
  regels: VoorstelRegel[];
  stat: VoorstelStatistiek;
  usage: { prompt_tokens: number; completion_tokens: number };
  gelukt: boolean;
}> {
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  const antwoord = await inv.roep(VOORSTEL_SYSTEEM, bouwVoorstelBericht(inv.tekst));

  if (!antwoord) return { regels: [], stat: { voorgesteld: 0, geldig: 0, verworpen: 0 }, usage, gelukt: false };

  usage.prompt_tokens = Number(antwoord.usage?.prompt_tokens ?? 0) || 0;
  usage.completion_tokens = Number(antwoord.usage?.completion_tokens ?? 0) || 0;

  let ruw: unknown = null;

  try {
    ruw = JSON.parse(antwoord.inhoud || '{}');
  } catch (_e) {
    return { regels: [], stat: { voorgesteld: 0, geldig: 0, verworpen: 0 }, usage, gelukt: false };
  }

  const { regels, stat } = valideerVoorstel(ruw);

  return { regels, stat, usage, gelukt: true };
}
