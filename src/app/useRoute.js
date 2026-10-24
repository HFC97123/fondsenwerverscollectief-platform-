// Routering. Geen router-bibliotheek: één hook, één bron van waarheid.
// Intern werkt alles met hashpaden ('#/kompas/deadlines'); de adresbalk toont een gewoon adres
// (/subsidie-kompas/deadlines), zie adres.js. Vercel stuurt elk adres naar index.html, dus een refresh op een
// diepe route loopt niet stuk.
import { useCallback, useEffect, useState } from 'react';
import { matchRoute, naar, routeParam } from './routes.js';
import { huidigeHash } from './adres.js';

export function useRoute() {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '#/' : huidigeHash()));

  useEffect(() => {
    const onChange = () => {
      setHash(huidigeHash());
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', onChange);

    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const route = matchRoute(hash);

  const ga = useCallback((pad) => {
    if (`#${pad}` === huidigeHash()) {
      window.scrollTo(0, 0);

      return;
    }

    naar(pad);
  }, []);

  useEffect(() => {
    document.title =
      route.pad === '/' ? route.titel : `${route.titel} · Het Fondsenwervers Collectief`;
  }, [route]);

  return { route, hash, param: routeParam(hash, route), ga };
}
