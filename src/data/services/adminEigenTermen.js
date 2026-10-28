// Beheer · "Nieuwe woorden": woorden die leden zelf typten bij "Overig" (discipline, doelgroep, werkgebied) en die we nog niet kenden.
// Elk woord komt met een advies van de AI. De beheerder maakt er een nieuwe waarde van, koppelt het als synoniem (herkenningswoord) aan een
// bestaande waarde, of wijst het af. Goedgekeurde woorden worden daarna automatisch herkend, zonder AI.
// Alleen via de admin-RPC's (beheerder-only, SECURITY DEFINER).
import { query } from '../client.js';

export const WOORD_STATUSSEN = [
  { value: 'nieuw', label: 'Nieuw' },
  { value: 'toegevoegd', label: 'Nieuwe waarde' },
  { value: 'synoniem', label: 'Synoniem' },
  { value: 'afgewezen', label: 'Afgewezen' },
];

export const WOORD_CATEGORIEEN = [
  { value: 'discipline', label: 'Discipline', tabel: 'themas' },
  { value: 'doelgroep', label: 'Doelgroep', tabel: 'doelgroepen' },
  { value: 'regio', label: 'Werkgebied', tabel: 'regios' },
];

// -> { rijen, fout }
export async function haalEigenTermen({ status = 'nieuw', zoek = '', limiet = 100 } = {}) {
  const res = await query((sb) => sb.rpc('admin_eigen_termen_lijst', { p_status: status || null, p_zoek: zoek || null, p_limiet: limiet }), []);

  return { rijen: Array.isArray(res.data) ? res.data : [], fout: res.error ? 'De lijst kon niet worden geladen.' : '' };
}

// -> { telling: { nieuw: 3, ... }, fout }
export async function telEigenTermen() {
  const res = await query((sb) => sb.rpc('admin_eigen_termen_telling'), []);
  const telling = {};

  (Array.isArray(res.data) ? res.data : []).forEach((r) => {
    telling[r.review_status] = Number(r.aantal) || 0;
  });

  return { telling, fout: res.error ? 'De telling kon niet worden geladen.' : '' };
}

// actie: 'nieuwe_waarde' | 'synoniem' | 'afwijzen' | 'terug'. -> { ok, fout }
export async function beslisEigenTerm({ id, actie, categorie = null, naam = null }) {
  const res = await query((sb) => sb.rpc('admin_eigen_term_beslis', { p_id: id, p_actie: actie, p_categorie: categorie, p_naam: naam }));

  return { ok: !res.error, fout: res.error ? (res.error.message || 'Opslaan is niet gelukt.').slice(0, 160) : '' };
}

// -> { rijen, fout }
export async function haalHerkenningswoorden() {
  const res = await query((sb) => sb.rpc('admin_herkenningswoorden_lijst'), []);

  return { rijen: Array.isArray(res.data) ? res.data : [], fout: res.error ? 'De lijst kon niet worden geladen.' : '' };
}

// -> { ok, fout }
export async function verwijderHerkenningswoord(id) {
  const res = await query((sb) => sb.rpc('admin_herkenningswoord_verwijder', { p_id: id }));

  return { ok: !res.error, fout: res.error ? 'Verwijderen is niet gelukt.' : '' };
}

// De bestaande waarden per categorie, voor de keuzelijst. -> { discipline: [...], doelgroep: [...], regio: [...] }
export async function haalBestaandeWaarden() {
  const uit = { discipline: [], doelgroep: [], regio: [] };

  await Promise.all(
    WOORD_CATEGORIEEN.map(async (c) => {
      const res = await query((sb) => sb.from(c.tabel).select('naam').order('naam'), []);

      uit[c.value] = (Array.isArray(res.data) ? res.data : []).map((r) => r.naam).filter(Boolean);
    }),
  );

  return uit;
}
