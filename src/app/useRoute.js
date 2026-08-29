// Hash-routering. Geen router-bibliotheek: één hook, één bron van waarheid.
// Hash werkt op elke host zonder herschrijfregels, dus een refresh op een
// diepe route kan niet stuklopen.
import { useCallback, useEffect, useState } from 'react';
import { matchRoute, naar, routeParam } from './routes.js';

export function useRoute() {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '#/' : window.location.hash || '#/'));

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', onChange);

    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const route = matchRoute(hash);

  const ga = useCallback((pad) => {
    if (`#${pad}` === window.location.hash) {
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
