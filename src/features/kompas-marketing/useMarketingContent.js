// Haalt de marketinginhoud één keer per sessie op en deelt die.
// Levert altijd inhoud: uit Supabase als die er is, anders de goedgekeurde tekst.
import { useEffect, useState } from 'react';
import { fetchFaqSections, fetchStappen } from '../../data/services/marketing.js';
import { FAQ_SECTIONS } from './faqContent.jsx';

function maakHook(fetcher, standaard) {
  let cache = null;
  let pending = null;
  const listeners = new Set();

  return function useInhoud() {
    const [inhoud, setInhoud] = useState(cache || standaard);

    useEffect(() => {
      if (cache) {
        return undefined;
      }

      const onDone = (v) => setInhoud(v || standaard);

      listeners.add(onDone);

      if (!pending) {
        pending = fetcher().then((v) => {
          cache = v || standaard;
          listeners.forEach((fn) => fn(cache));

          return cache;
        });
      }

      return () => {
        listeners.delete(onDone);
      };
    }, []);

    return inhoud;
  };
}

export const useFaqSections = maakHook(fetchFaqSections, FAQ_SECTIONS);
export const useStappen = maakHook(fetchStappen, null);
