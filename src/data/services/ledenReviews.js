// Ledenwaarderingen (ratings/reviews) voor de homepage.
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
