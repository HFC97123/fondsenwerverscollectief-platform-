// Gepubliceerde inhoud en websiteteksten uit Supabase.
// Is er niets gepubliceerd of geen verbinding, dan blijven de lijsten leeg;
// pagina's tonen dan hun eigen lege staat en lopen niet stuk.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../../data/client.js';
import { collections, siteTextBlocks } from '../../data/collections.js';

const ContentContext = createContext(null);

export function useContent() {
  const ctx = useContext(ContentContext);

  if (!ctx) {
    throw new Error('useContent moet binnen ContentProvider worden gebruikt.');
  }

  return ctx;
}

const TEKST_STANDAARD = Object.fromEntries(
  siteTextBlocks.flatMap((b) => b.items).map((i) => [i.key, i.fallback || '']),
);

export function ContentProvider({ children }) {
  const [inhoud, setInhoud] = useState({});
  const [teksten, setTeksten] = useState({});
  const [geladen, setGeladen] = useState(false);

  const laad = useCallback(async () => {
    if (!supabase) {
      setGeladen(true);

      return;
    }

    try {
      const resultaten = await Promise.all(
        collections.map(async (c) => {
          const { data, error } = await supabase
            .from(c.table)
            .select('*')
            .eq('status', 'published')
            .order(c.order.column, { ascending: c.order.ascending, nullsFirst: false });

          if (error) {
            return [c.key, []];
          }

          return [c.key, (data || []).map((row) => c.mapForSite(row))];
        }),
      );

      const { data: tekstRijen } = await supabase.from('site_content').select('key, value');

      setInhoud(Object.fromEntries(resultaten));
      setTeksten(
        Object.fromEntries((tekstRijen || []).filter((r) => r.value).map((r) => [r.key, r.value])),
      );
      setGeladen(true);
    } catch (e) {
      setGeladen(true);
    }
  }, []);

  useEffect(() => {
    laad();
  }, [laad]);

  const waarden = {
    geladen,
    // Lijst uit de database, of een lege lijst.
    lijst: (sleutel) => inhoud[sleutel] || [],
    // Losse websitetekst met de standaardwaarde uit collections.js als terugval.
    tekst: (sleutel) => teksten[sleutel] || TEKST_STANDAARD[sleutel] || '',
    teksten,
    herlaad: laad,
  };

  return <ContentContext.Provider value={waarden}>{children}</ContentContext.Provider>;
}
