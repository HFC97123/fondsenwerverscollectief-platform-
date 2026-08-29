// Gedeelde staat voor de Subsidie Kompas-werkomgeving: organisatieprofiel,
// projecten, gegenereerde documentatie en bewaarde gesprekken.
// Lezen en schrijven loopt via data/services/workspace.js — dat is het enige
// bestand dat verandert als Supabase eraan komt.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  LEEG as EMPTY,
  bewaarOrgProfiel,
  bewaarVoorkeuren,
  bewaarWerkomgeving,
  haalWerkomgevingOp,
  laadWerkomgeving,
} from '../../data/services/workspace.js';

export const PROJECT_EMPTY = {
  id: null,
  naam: '',
  programma: '',
  periodeVan: '',
  periodeTot: '',
  doelgroep: '',
  regio: '',
  omschrijving: '',
  begroting: '',
  gevraagd: '',
  eigenBijdrage: '',
  eerder: [],
  cofin: [],
  docs: [],
  regelingen: [],
};

export const PLAN_STATUSSEN = ['Gepland', 'Aangevraagd', 'Toegekend', 'Afgewezen'];
export const UITKOMSTEN = ['In behandeling', 'Toegekend', 'Gedeeltelijk toegekend', 'Afgewezen'];
export const COFIN_STATUSSEN = ['Aangevraagd', 'Toegezegd', 'Verkennend', 'Afgewezen'];
export const DOC_SOORTEN = ['Projectplan', 'Begroting', 'Concept-dekkingsplan', 'Overig'];

const KompasContext = createContext(null);

export function useKompas() {
  const ctx = useContext(KompasContext);

  if (!ctx) {
    throw new Error('useKompas moet binnen KompasProvider worden gebruikt.');
  }

  return ctx;
}

export function KompasProvider({ children }) {
  const [st, setSt] = useState(laadWerkomgeving);

  // Bron van de gegevens: 'lokaal' tot een sessie de database oplevert.
  const bron = useRef('lokaal');

  // Bij een sessie de werkomgeving uit Supabase halen. Lukt dat niet, dan
  // blijft wat lokaal staat gewoon werken.
  useEffect(() => {
    let actief = true;

    haalWerkomgevingOp().then((uitDb) => {
      if (!actief || !uitDb) {
        return;
      }

      bron.current = 'supabase';
      setSt((cur) => ({ ...uitDb, deadlines: cur.deadlines }));
    });

    return () => {
      actief = false;
    };
  }, []);

  // Lokaal bewaren blijft altijd staan: het is de terugval bij verlies van
  // verbinding en de opslag voor wie niet is ingelogd.
  useEffect(() => {
    bewaarWerkomgeving(st);
  }, [st]);

  // Profiel en voorkeuren doorschrijven naar de database, ontdubbeld zodat
  // typen geen reeks aanroepen oplevert.
  const timer = useRef(null);

  useEffect(() => {
    if (bron.current !== 'supabase') {
      return undefined;
    }

    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      bewaarOrgProfiel(st.orgProfile);
      bewaarVoorkeuren({
        memberVisible: st.memberVisible,
        reminderMail: st.reminderMail,
        reminderDays: st.reminderDays,
      });
    }, 900);

    return () => clearTimeout(timer.current);
  }, [st.orgProfile, st.memberVisible, st.reminderMail, st.reminderDays]);

  const patch = useCallback((next) => setSt((cur) => ({ ...cur, ...next })), []);

  const value = useMemo(
    () => ({
      ...st,
      patch,

      setOrgField: (key, val) => setSt((cur) => ({ ...cur, orgProfile: { ...cur.orgProfile, [key]: val } })),

      clearOrgProfile: () => patch({ orgProfile: {} }),

      saveProject: (project) =>
        setSt((cur) => {
          const list = cur.projects.slice();
          const i = list.findIndex((p) => p.id === project.id);

          if (i === -1) {
            list.push(project);
          } else {
            list[i] = project;
          }

          return { ...cur, projects: list };
        }),

      deleteProject: (id) => setSt((cur) => ({ ...cur, projects: cur.projects.filter((p) => p.id !== id) })),

      addRegelingToProject: (regeling, projectId) =>
        setSt((cur) => {
          const list = cur.projects.slice();
          const i = list.findIndex((p) => p.id === projectId);

          if (i === -1) {
            return cur;
          }

          const bestaand = list[i].regelingen || [];

          if (bestaand.some((r) => String(r.id) === String(regeling.id))) {
            return cur;
          }

          list[i] = { ...list[i], regelingen: bestaand.concat([{ ...regeling, plan: 'Gepland', herinner: true }]) };

          return { ...cur, projects: list };
        }),

      setDocProject: (docId, projectId) =>
        setSt((cur) => ({
          ...cur,
          genDocs: cur.genDocs.map((d) => (d.id === docId ? { ...d, projectId } : d)),
        })),

      newDocVersion: (docId) =>
        setSt((cur) => ({
          ...cur,
          genDocs: cur.genDocs.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  versie: (d.versie || 1) + 1,
                  gemaakt: 'Vandaag',
                  versies: (d.versies || []).concat([{ v: d.versie || 1, gemaakt: d.gemaakt, grootte: d.grootte }]),
                }
              : d,
          ),
        })),

      deleteDoc: (docId) => setSt((cur) => ({ ...cur, genDocs: cur.genDocs.filter((d) => d.id !== docId) })),

      deleteConversation: (id) =>
        setSt((cur) => ({ ...cur, conversations: cur.conversations.filter((c) => c.id !== id) })),

      clearConversations: () => patch({ conversations: [] }),

      // Beheer · Deadlines. Vervang deze drie door Supabase-writes op
      // subsidieregelingen_tijdlijn en subsidieregelingen.
      saveRegeling: (regeling) =>
        setSt((cur) => {
          const list = cur.deadlines.slice();
          const i = list.findIndex((r) => r.id === regeling.id);

          if (i === -1) {
            list.unshift(regeling);
          } else {
            list[i] = regeling;
          }

          return { ...cur, deadlines: list };
        }),

      importRegelingen: (rijen) => setSt((cur) => ({ ...cur, deadlines: rijen.concat(cur.deadlines) })),

      deleteRegeling: (id) => setSt((cur) => ({ ...cur, deadlines: cur.deadlines.filter((r) => r.id !== id) })),

      clearRegelingen: () => patch({ deadlines: [] }),
    }),
    [st, patch],
  );

  return <KompasContext.Provider value={value}>{children}</KompasContext.Provider>;
}

// Dekking van de begroting: toegekend, in aanvraag en wat nog openstaat.
export function berekenDekking(project) {
  const bedrag = (v) => {
    const cijfers = String(v == null ? '' : v).replace(/[^0-9]/g, '');

    return cijfers ? Number(cijfers) : 0;
  };

  const euro = (n) => `€ ${Number(n).toLocaleString('nl-NL')}`;
  const begroting = bedrag(project.begroting);
  const som = (list, test, veld) => (list || []).filter(test).reduce((t, x) => t + bedrag(x[veld]), 0);

  const toegekend =
    bedrag(project.eigenBijdrage) +
    som(project.eerder, (x) => String(x.uitkomst || '').indexOf('oegekend') !== -1, 'bedrag') +
    som(project.regelingen, (x) => x.plan === 'Toegekend', 'aangevraagd') +
    som(project.cofin, (x) => x.status === 'Toegezegd', 'bedrag');

  const inAanvraag =
    som(project.eerder, (x) => x.uitkomst === 'In behandeling', 'bedrag') +
    som(project.regelingen, (x) => x.plan === 'Aangevraagd', 'aangevraagd') +
    som(project.cofin, (x) => x.status === 'Aangevraagd', 'bedrag');

  const open = Math.max(0, begroting - toegekend - inAanvraag);
  const pct = (n) => (begroting ? Math.round((n / begroting) * 100) : 0);

  return {
    heeftBegroting: begroting > 0,
    begroting: euro(begroting),
    toegekend: euro(toegekend),
    inAanvraag: euro(inAanvraag),
    open: euro(open),
    pctToegekend: `${pct(toegekend)}%`,
    pctAanvraag: `${pct(inAanvraag)}%`,
    pctOpen: `${Math.max(0, 100 - pct(toegekend) - pct(inAanvraag))}%`,
    samenvatting: begroting
      ? open === 0
        ? 'Uw begroting is volledig belegd met toekenningen en lopende aanvragen.'
        : `${pct(toegekend)}% is toegekend, ${pct(inAanvraag)}% staat in aanvraag. Er blijft ${euro(open)} te dekken.`
      : 'Vul de projectbegroting in om te zien hoeveel van uw project gedekt is.',
  };
}
