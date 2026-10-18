// Serviceclubs (Rotary, Lions, Kiwanis, Soroptimisten): landelijke vermeldingen van netwerken met veel zelfstandige lokale clubs.
// ZUIVER: geen database, geen netwerk, geen modelaanroep.
//
// Afspraak (Aisya, 18-10-2026):
//   - Een serviceclub-vermelding telt wel mee in de dekking (Pro 120%, Premium 140%), maar staat helemaal onderaan: pas als de andere
//     financiers het doel niet halen. Dat regelt dekkingsmix.ts met het veld `optioneel`.
//   - Ze wordt alleen aangeboden als het project REGIONAAL is, NIET in het buitenland plaatsvindt, en gaat over kinderen, meisjes of
//     vrouwen, of over noodhulp. Anders is de club niet relevant en wordt ze niet getoond.
//   - Wordt ze aangeboden, dan altijd met de tekst dat het optioneel is: eerst kijken of een club in de regio aansluit.
//
// Welke records? Een serviceclub-vermelding is een funder van type `service_club` waarvan het werkgebied "Regionaal" bevat: dat is de
// lokale-clubroute. De internationale serviceclubfondsen (Lions Clubs International Foundation, The Rotary Foundation, Kiwanis Children's
// Fund) zijn wel `service_club`, maar hebben geen "Regionaal" in hun werkgebied en blijven gewone financiers met hun eigen
// werkgebiedtoets van de matching.

import { projectGebied } from './werkgebied.ts';

export const OPTIONEEL_ONDERDEEL = 'Optioneel te onderzoeken';
export const OPTIONEEL_TEKST = 'Optioneel te onderzoeken: kijk eerst of een serviceclub in uw regio aansluit bij het onderwerp van uw project. Niet elke gemeente heeft een club en elke club beslist zelf.';

export type ServiceclubReden = 'ok' | 'buitenland' | 'niet-regionaal' | 'werkgebied-onbekend' | 'onderwerp';

export interface ServiceclubProject {
  themas: readonly string[];
  doelgroepen: readonly string[];
  regios: readonly string[];
  locatieTekst: string;
  activiteiten?: readonly string[];
}

const norm = (t: unknown): string => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Doelgroepen en disciplines waarbij een serviceclub zinvol is (namen uit de database-taxonomie).
const DOELGROEPEN_CLUBS = new Set(['kinderen', 'vrouwen en meisjes', 'gezinnen'].map(norm));
const THEMAS_CLUBS = new Set(['jeugd en kinderen', 'noodhulp'].map(norm));

// Regio's die NIET lokaal of regionaal zijn: landelijk, Europa, de wereld en alles buiten Nederland.
const GEEN_REGIONAAL = new Set(
  ['landelijk', 'europa', 'oost-europa', 'wereld / internationaal', 'afrika', 'azie', 'latijns-amerika', 'zuid-amerika', 'noord-amerika', 'midden-oosten', 'caribisch gebied', 'caribisch deel van het koninkrijk', 'belgie', 'luxemburg', 'brazilie'].map(norm),
);
const BUITENLAND_REGIOS = new Set(
  ['europa', 'oost-europa', 'wereld / internationaal', 'afrika', 'azie', 'latijns-amerika', 'zuid-amerika', 'noord-amerika', 'midden-oosten', 'caribisch gebied', 'caribisch deel van het koninkrijk', 'belgie', 'luxemburg', 'brazilie'].map(norm),
);
const NEDERLAND_TERMEN = new Set(['nederland', 'heel nederland', 'landelijk', 'in heel nederland', 'door heel nederland'].map(norm));

// Is dit databaserecord een serviceclub-vermelding met de lokale-clubroute?
export function isServiceclubVermelding(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;

  const r = row as Record<string, unknown>;

  if (norm(r.funder_type ?? r.type_gever) !== 'service_club') return false;

  const gebieden = Array.isArray(r.werkgebieden_namen) ? r.werkgebieden_namen : [];

  return gebieden.some((g) => norm(g) === 'regionaal');
}

// Mag een serviceclub-vermelding bij dit project worden aangeboden?
export function serviceclubBeoordeling(p: ServiceclubProject): { aanbieden: boolean; reden: ServiceclubReden } {
  const regios = (p.regios ?? []).map(norm).filter(Boolean);
  const locatie = norm(p.locatieTekst);

  // 1. Buitenland: een buitenlandse regio, of een land of werelddeel in de projectlocatie.
  const gebied = projectGebied([p.locatieTekst, ...(p.regios ?? [])]);

  if (regios.some((r) => BUITENLAND_REGIOS.has(r)) || gebied.landen.length > 0 || gebied.werelddelen.length > 0) return { aanbieden: false, reden: 'buitenland' };

  // 2. Regionaal: iets anders dan alleen "landelijk" (een provincie, plaats, regio) of een vrije locatie die geen heel Nederland is.
  const lokaleRegio = regios.some((r) => !GEEN_REGIONAAL.has(r));
  const lokaleLocatie = locatie !== '' && !NEDERLAND_TERMEN.has(locatie);

  if (!lokaleRegio && !lokaleLocatie) return { aanbieden: false, reden: regios.length || locatie ? 'niet-regionaal' : 'werkgebied-onbekend' };

  // 3. Onderwerp: kinderen, meisjes of vrouwen, of noodhulp.
  const onderwerp =
    (p.doelgroepen ?? []).some((d) => DOELGROEPEN_CLUBS.has(norm(d))) ||
    (p.themas ?? []).some((t) => THEMAS_CLUBS.has(norm(t))) ||
    (p.activiteiten ?? []).some((a) => norm(a) === 'noodhulp');

  if (!onderwerp) return { aanbieden: false, reden: 'onderwerp' };

  return { aanbieden: true, reden: 'ok' };
}
