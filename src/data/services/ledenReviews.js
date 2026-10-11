// Ledenwaarderingen (ratings/reviews) voor de homepage.
// De homepage toont alleen nog het gemiddelde (statistiektegel, zie
// fetchLedenWaardering); de losse reviewkaarten zijn van de homepage gehaald.
// De RPC en de helpers voor losse reviews hieronder blijven bestaan.
// Eén RPC-aanroep, één keer per sessie, gedeeld door de hele site (zelfde
// patroon als members.js).
//
// public.member_reviews is niet leesbaar voor bezoekers (RLS: alleen admins).
// publieke_ledenreviews() is een SECURITY DEFINER-functie die uitsluitend
// goedgekeurde, publieke waarderingen teruggeeft (maximaal 5): rating,
// reviewtekst, weergavenaam en -functie. Geen profile_id, e-mailadres of
// andere profielgegevens.
import { useEffect, useState } from 'react';
import { query } from '../client.js';

export const MAX_LEDENREVIEWS = 5;

// Normaliseert de RPC-rijen; ongeldige rijen vallen weg, nooit meer dan 5.
export function normaliseerLedenReviews(rijen) {
  if (!Array.isArray(rijen)) {
    return [];
  }

  return rijen
    .map((r) => ({
      rating: Number(r && r.rating),
      tekst: r && typeof r.review_text === 'string' ? r.review_text.trim() : '',
      naam: r && typeof r.display_name === 'string' ? r.display_name.trim() : '',
      functie: r && typeof r.display_role === 'string' ? r.display_role.trim() : '',
    }))
    .filter((r) => Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5)
    .slice(0, MAX_LEDENREVIEWS);
}

// Geeft een (mogelijk lege) lijst terug; bij een fout of zonder configuratie
// een lege lijst, zodat de homepage dan gewoon zonder deze sectie doorloopt.
export async function fetchLedenReviews() {
  const res = await query(async (sb) => {
    const { data, error } = await sb.rpc('publieke_ledenreviews', { p_limit: MAX_LEDENREVIEWS });

    return error ? { data: null, error } : { data };
  }, null);

  return normaliseerLedenReviews(res.data);
}

// --- Gemiddelde waardering (statistiektegel) ---------------------------------
// publieke_ledenwaardering() is een SECURITY DEFINER-functie die uitsluitend
// { gemiddelde, aantal } teruggeeft, over dezelfde populatie als
// publieke_ledenreviews() (goedgekeurd, publiek, goedgekeurd lid), maar zonder
// de limiet van 5 rijen. Eén aanroep per sessie.

// Normaliseert het RPC-resultaat (array met één rij of één object) naar
// { gemiddelde: number | null, aantal: number }. Alleen geldige numerieke
// waarderingen tellen; null, leeg of buiten 1-5 betekent: geen gemiddelde.
export function normaliseerLedenWaardering(data) {
  const rij = Array.isArray(data) ? data[0] : data;
  const leeg = { gemiddelde: null, aantal: 0 };

  if (!rij || typeof rij !== 'object') {
    return leeg;
  }

  const ruw = rij.gemiddelde;
  const gemiddelde = ruw === null || ruw === undefined || (typeof ruw === 'string' && ruw.trim() === '') ? NaN : Number(ruw);
  const aantal = Number(rij.aantal);

  if (!Number.isFinite(gemiddelde) || gemiddelde < 1 || gemiddelde > 5 || !Number.isFinite(aantal) || aantal < 1) {
    return leeg;
  }

  return { gemiddelde, aantal: Math.floor(aantal) };
}

// Nederlandse notatie met altijd één decimaal en een komma: 5,0 / 4,8.
// Zonder geldig gemiddelde een streepje, nooit 0, 0,0, NaN of undefined.
export function formatGemiddeldeWaardering(gemiddelde) {
  if (typeof gemiddelde !== 'number' || !Number.isFinite(gemiddelde) || gemiddelde < 1 || gemiddelde > 5) {
    return '—';
  }

  return (Math.round(gemiddelde * 10) / 10).toFixed(1).replace('.', ',');
}

// Bij een fout of zonder configuratie: geen gemiddelde (dus '—'), nooit een testwaarde.
export async function fetchLedenWaardering() {
  const res = await query(async (sb) => {
    const { data, error } = await sb.rpc('publieke_ledenwaardering');

    return error ? { data: null, error } : { data };
  }, null);

  return normaliseerLedenWaardering(res.data);
}

let waarderingCache = null;
let waarderingPending = null;
const waarderingListeners = new Set();

export function useLedenWaardering() {
  const [waardering, setWaardering] = useState(waarderingCache);

  useEffect(() => {
    if (waarderingCache !== null) {
      return undefined;
    }

    const onDone = (v) => setWaardering(v);

    waarderingListeners.add(onDone);

    if (!waarderingPending) {
      waarderingPending = fetchLedenWaardering().then((v) => {
        waarderingCache = v;
        waarderingPending = null;
        waarderingListeners.forEach((fn) => fn(v));

        return v;
      });
    }

    return () => {
      waarderingListeners.delete(onDone);
    };
  }, []);

  return {
    gemiddelde: waardering ? waardering.gemiddelde : null,
    aantal: waardering ? waardering.aantal : 0,
    loading: waardering === null,
    // Tijdens laden een ellipsteken, zonder geldige waarderingen een streepje.
    label: waardering === null ? '…' : formatGemiddeldeWaardering(waardering.gemiddelde),
  };
}

let cache = null;
let pending = null;
const listeners = new Set();

export function useLedenReviews() {
  const [reviews, setReviews] = useState(cache);

  useEffect(() => {
    if (cache !== null) {
      return undefined;
    }

    const onDone = (v) => setReviews(v);

    listeners.add(onDone);

    if (!pending) {
      pending = fetchLedenReviews().then((v) => {
        cache = v;
        pending = null;
        listeners.forEach((fn) => fn(v));

        return v;
      });
    }

    return () => {
      listeners.delete(onDone);
    };
  }, []);

  return { reviews: reviews || [], loading: reviews === null };
}
