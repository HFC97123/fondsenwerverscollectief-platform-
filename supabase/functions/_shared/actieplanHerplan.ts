// Herplannen van een bestaand actieplan na een gewijzigde deadline, termijn of vergaderdatum. ZUIVER: geen database, geen netwerk.
//
// Het actieplan wordt NOOIT stilzwijgend overschreven. Deze module vergelijkt de taken die al bestaan met de planning die nu uit de gegevens
// van de financier volgt en geeft een VOORSTEL terug: per taak de oude en de nieuwe datum, met de reden en of het lid de taak zelf heeft
// aangepast. De server past alleen toe wat het lid expliciet kiest; een door het lid aangepaste taak vraagt daarbovenop om een uitdrukkelijk
// "ook handmatig aangepaste taken" (nooit de standaard).

export interface BestaandeTaak {
  id: string;
  titel: string;
  fundingId: string | null;
  datum: string | null;
  status: string;
  proposedAt?: string | null;
  updatedAt?: string | null;
  datumHerkomst?: string | null; // 'handmatig' = het lid paste de datum zelf aan (migratie D)
  planningHandmatig?: boolean | null; // migratie D: door de database gezet bij een wijziging van datum of titel door het lid
}

export interface GeplandeTaak {
  titel: string;
  fundingId: string | null;
  datum: string | null;
  datumHerkomst: 'bron' | 'berekend' | 'aanname' | null;
  datumBron: string | null;
  datumControle: string | null;
  toelichting: string;
  fase: string | null;
}

export interface Wijziging {
  actieId: string;
  titel: string;
  fundingId: string | null;
  oud: string | null;
  nieuw: string | null;
  nieuweHerkomst: 'bron' | 'berekend' | 'aanname' | null;
  nieuweBron: string | null;
  nieuweControle: string | null;
  toelichting: string;
  fase: string | null;
  handmatig: boolean; // het lid heeft deze taak zelf aangepast: alleen toepassen na uitdrukkelijke keuze
  reden: 'datum-gewijzigd' | 'datum-vervallen' | 'datum-nieuw';
}

export interface HerplanUitkomst {
  wijzigingen: Wijziging[];
  ongewijzigd: number;
  afgerond: number; // al afgeronde taken: blijven buiten beeld
  ontbrekend: number; // geplande taken die nog niet bestaan (bijv. het lid verwijderde ze); worden hier niet opnieuw aangemaakt
}

export const taakSleutelVan = (titel: string, fundingId: string | null): string => `${fundingId ?? ''}|${titel.trim().toLowerCase()}`.slice(0, 400);
const ACTIEF = new Set(['todo', 'open', 'in_progress', 'in-progress', 'planned']);

// Heeft het lid deze taak zelf aangepast? Met migratie D weet de database het (planning_handmatig); zonder die migratie geldt voorzichtig:
// elke wijziging na het voorstellen (updated_at later dan proposed_at + 5 seconden) telt als aangepast.
export function isHandmatigAangepast(t: BestaandeTaak): boolean {
  if (t.planningHandmatig === true || t.datumHerkomst === 'handmatig') return true;
  if (t.planningHandmatig === false) return false;

  const u = t.updatedAt ? Date.parse(t.updatedAt) : NaN;
  const p = t.proposedAt ? Date.parse(t.proposedAt) : NaN;

  return Number.isFinite(u) && Number.isFinite(p) && u - p > 5000;
}

export function bepaalHerplanning(bestaand: readonly BestaandeTaak[], gepland: readonly GeplandeTaak[]): HerplanUitkomst {
  const perSleutel = new Map(bestaand.map((t) => [taakSleutelVan(t.titel, t.fundingId), t]));
  const uit: HerplanUitkomst = { wijzigingen: [], ongewijzigd: 0, afgerond: 0, ontbrekend: 0 };

  for (const g of gepland) {
    const t = perSleutel.get(taakSleutelVan(g.titel, g.fundingId));

    if (!t) {
      uit.ontbrekend += 1;
      continue;
    }

    if (!ACTIEF.has(String(t.status).toLowerCase())) {
      uit.afgerond += 1;
      continue;
    }

    if ((t.datum ?? null) === (g.datum ?? null)) {
      uit.ongewijzigd += 1;
      continue;
    }

    uit.wijzigingen.push({
      actieId: t.id,
      titel: t.titel,
      fundingId: t.fundingId,
      oud: t.datum ?? null,
      nieuw: g.datum ?? null,
      nieuweHerkomst: g.datumHerkomst,
      nieuweBron: g.datumBron,
      nieuweControle: g.datumControle,
      toelichting: g.toelichting,
      fase: g.fase,
      handmatig: isHandmatigAangepast(t),
      reden: g.datum == null ? 'datum-vervallen' : t.datum == null ? 'datum-nieuw' : 'datum-gewijzigd',
    });
  }

  return uit;
}
