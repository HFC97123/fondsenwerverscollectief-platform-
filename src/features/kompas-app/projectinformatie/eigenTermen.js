// Eigen woorden van het lid ("Overig, anders namelijk") bij een project. Pure logica (geen React, geen database).
// Vorm: [{ woord: 'drummen', koppelingen: [{ categorie: 'discipline', naam: 'Muziek' }] }]. Een woord zonder koppelingen blijft gewoon bij het
// project staan en zichtbaar: het wordt nooit stil weggegooid. De gekozen waarden zelf staan in discipline, doelgroep en regio; alleen die lezen
// de matching.

export const MAX_EIGEN_TERMEN = 12;
export const MAX_EIGEN_TERM_LENGTE = 60;
export const CATEGORIEEN = ['discipline', 'doelgroep', 'regio'];

const sleutel = (t) => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const schoon = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

// Leest wat in de database staat (of een eerdere stand van het formulier); rommel valt af, de volgorde blijft.
export function leesEigenTermen(raw) {
  const lijst = Array.isArray(raw) ? raw : [];
  const uit = [];

  for (const r of lijst) {
    const woord = schoon(r && typeof r === 'object' ? r.woord : r);

    if (woord.length < 2 || woord.length > MAX_EIGEN_TERM_LENGTE || uit.some((x) => sleutel(x.woord) === sleutel(woord))) continue;

    const koppelingen = [];

    for (const k of Array.isArray(r && r.koppelingen) ? r.koppelingen : []) {
      const naam = schoon(k && k.naam);

      if (CATEGORIEEN.includes(k && k.categorie) && naam && !koppelingen.some((x) => x.categorie === k.categorie && sleutel(x.naam) === sleutel(naam))) {
        koppelingen.push({ categorie: k.categorie, naam });
      }
    }

    uit.push({ woord, koppelingen });

    if (uit.length >= MAX_EIGEN_TERMEN) break;
  }

  return uit;
}

// Wat naar de database gaat: dezelfde schoonmaak.
export const eigenTermenVoorOpslag = (lijst) => leesEigenTermen(lijst);

// Een of meer woorden toevoegen (komma of puntkomma scheidt). Geeft de nieuwe lijst; bestaande woorden en hun koppelingen blijven staan.
export function voegWoordenToe(lijst, invoer) {
  const huidig = leesEigenTermen(lijst);
  const nieuw = String(invoer == null ? '' : invoer).split(/[,;\n]/).map(schoon).filter((w) => w.length >= 2 && w.length <= MAX_EIGEN_TERM_LENGTE);
  const uit = [...huidig];

  for (const woord of nieuw) {
    if (uit.length >= MAX_EIGEN_TERMEN) break;
    if (!uit.some((x) => sleutel(x.woord) === sleutel(woord))) uit.push({ woord, koppelingen: [] });
  }

  return uit;
}

export const verwijderWoord = (lijst, woord) => leesEigenTermen(lijst).filter((x) => sleutel(x.woord) !== sleutel(woord));

// Noteert dat een eigen woord aan een bestaande waarde gekoppeld is (nadat het lid het voorstel koos).
export function legKoppeling(lijst, woord, categorie, naam) {
  if (!CATEGORIEEN.includes(categorie)) return leesEigenTermen(lijst);

  return leesEigenTermen(lijst).map((x) => (sleutel(x.woord) === sleutel(woord) && !x.koppelingen.some((k) => k.categorie === categorie && sleutel(k.naam) === sleutel(naam)) ? { ...x, koppelingen: [...x.koppelingen, { categorie, naam: schoon(naam) }] } : x));
}

export const zonderKoppeling = (lijst) => leesEigenTermen(lijst).filter((x) => !x.koppelingen.length);
