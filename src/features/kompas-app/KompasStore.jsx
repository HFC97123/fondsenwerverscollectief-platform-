// Gedeelde staat voor de Subsidie Kompas-werkomgeving: organisatieprofiel,
// projecten, gegenereerde documentatie en bewaarde gesprekken.
// Lezen en schrijven loopt via data/services/workspace.js — dat is het enige
// bestand dat verandert als Supabase eraan komt.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  LEEG as EMPTY,
  bewaarVoorkeuren,
  bewaarWerkomgeving,
  haalWerkomgevingOp,
  laadWerkomgeving,
  ruimOudeGedeeldeOpslagOp,
} from '../../data/services/workspace.js';
import {
  bewaarOrganisatieVelden,
  haalOrganisatieprofielOp,
  verwijderOrganisatieprofiel,
  wisOrganisatieVeld,
} from '../../data/services/organisatieprofiel.js';
import { archiveerProject, bewaarProject, haalProjectenOp, isEchtId, verwijderProject } from '../../data/services/projecten.js';
import { markeerHandmatigeWijzigingen, pasUpdatesToe } from './projectKoppeling.js';
import {
  haalGesprekkenOp,
  verwijderAlleGesprekken,
  verwijderGesprek as verwijderGesprekService,
} from '../../data/services/gesprekken.js';

export const PROJECT_EMPTY = {
  id: null,
  naam: '',
  programma: '',
  periodeVan: '',
  periodeTot: '',
  doelgroep: [],
  regio: '',
  omschrijving: '',
  doelstellingen: '',
  partners: '',
  resultaten: '',
  begroting: '',
  gevraagd: '',
  eigenBijdrage: '',
  eerder: [],
  cofin: [],
  docs: [],
  regelingen: [],
  // Projectniveau (niet organisatiebreed, niet documentspecifiek):
  activiteiten: '',
  impact: '',
  planning: '',
  schrijfvoorkeur: '',
  // Herkomst per veld: handmatig | upload | gesprek | gesprek-bevestigd.
  bronnen: {},
  gearchiveerd: false,
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

// userId = het user_id van de ingelogde gebruiker (of null zonder sessie).
// KompasApp geeft deze provider een key={userId}, zodat bij elke wisseling van
// account ALLE staat (organisatieprofiel, projecten, gesprekken, herkomst)
// opnieuw en leeg begint - er blijft nooit iets van het vorige account hangen.
export function KompasProvider({ children, userId = null }) {
  const [st, setSt] = useState(() => {
    ruimOudeGedeeldeOpslagOp();

    return laadWerkomgeving(userId);
  });
  const [orgBronnen, setOrgBronnen] = useState({});

  // Bron van de gegevens: 'lokaal' tot een sessie de database oplevert.
  const bron = useRef('lokaal');

  // Projecten/documentatie/gesprekken/voorkeuren: nog het oude spoor
  // (workspace.js), dat vooralsnog altijd stil terugvalt op localStorage
  // omdat de tabellen die het verwacht niet bestaan. Blijft ongewijzigd tot
  // een volgende fase dit ook op de echte tabellen aansluit.
  useEffect(() => {
    let actief = true;

    haalWerkomgevingOp().then((uitDb) => {
      if (!actief || !uitDb) {
        return;
      }

      bron.current = 'supabase';
      setSt((cur) => ({ ...uitDb, orgProfile: cur.orgProfile, deadlines: cur.deadlines }));
    });

    return () => {
      actief = false;
    };
  }, []);

  // Organisatieprofiel: wel op de echte tabellen (subsidie_kompas_organizations
  // + subsidie_kompas_organization_field_sources), onafhankelijk van
  // haalWerkomgevingOp() hierboven - dat faalt voor de andere onderdelen nog
  // steeds stil, maar het organisatieprofiel hoeft daar niet op te wachten.
  const orgBron = useRef('lokaal');

  useEffect(() => {
    let actief = true;

    haalOrganisatieprofielOp().then((res) => {
      if (!actief || !res) {
        return;
      }

      // Alleen het profiel van precies déze gebruiker. Komt het antwoord van
      // een andere gebruiker dan de provider kent, dan wordt het genegeerd.
      if (!userId || res.gebruikerId !== userId) {
        return;
      }

      orgBron.current = 'supabase';
      setOrgBronnen(res.bronnen || {});
      // VERVANGEN, niet samenvoegen: de database is de enige bron. Heeft deze
      // gebruiker (nog) geen organisatie, dan is res.profiel {} en blijft de
      // organisatiecontext leeg.
      setSt((cur) => ({ ...cur, orgProfile: res.profiel || {} }));
    });

    return () => {
      actief = false;
    };
  }, []);

  // Projecten: ook al op de echte tabel (subsidie_kompas_programs), los van
  // haalWerkomgevingOp() hierboven.
  const projectenBron = useRef('lokaal');

  useEffect(() => {
    let actief = true;

    haalProjectenOp().then((lijst) => {
      if (!actief || lijst === null) {
        return;
      }

      projectenBron.current = 'supabase';
      setSt((cur) => ({ ...cur, projects: lijst }));
    });

    return () => {
      actief = false;
    };
  }, []);

  // Gesprekken: ook al op de echte tabellen (subsidie_kompas_conversations/
  // messages), los van haalWerkomgevingOp() hierboven. Hier komt alleen de
  // lichte lijst (id/titel/tijd/projectId) binnen - de berichten van een
  // gesprek worden pas geladen als het lid dat gesprek opent (zie
  // gesprekken.js's haalBerichtenOp, rechtstreeks aangeroepen vanuit
  // KompasToolPage.jsx).
  const gesprekkenBron = useRef('lokaal');

  useEffect(() => {
    let actief = true;

    haalGesprekkenOp().then((lijst) => {
      if (!actief || lijst === null) {
        return;
      }

      gesprekkenBron.current = 'supabase';
      setSt((cur) => ({ ...cur, conversations: lijst }));
    });

    return () => {
      actief = false;
    };
  }, []);

  // Lokaal bewaren blijft altijd staan: het is de terugval bij verlies van
  // verbinding en de opslag voor wie niet is ingelogd.
  useEffect(() => {
    bewaarWerkomgeving(userId, st);
  }, [st, userId]);

  // Voorkeuren doorschrijven naar de database, ontdubbeld zodat typen geen
  // reeks aanroepen oplevert. Het organisatieprofiel loopt sinds kort apart
  // via setOrgField/clearOrgField hieronder (per veld, met herkomst).
  const timer = useRef(null);

  useEffect(() => {
    if (bron.current !== 'supabase') {
      return undefined;
    }

    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      bewaarVoorkeuren({
        memberVisible: st.memberVisible,
        reminderMail: st.reminderMail,
        reminderDays: st.reminderDays,
      });
    }, 900);

    return () => clearTimeout(timer.current);
  }, [st.memberVisible, st.reminderMail, st.reminderDays]);

  // Organisatieprofielvelden: per veld gedebiend bewaren (900ms), zodat typen
  // geen reeks aanroepen oplevert maar de herkomst per veld wel correct
  // 'handmatig' blijft - een re-save van het hele profiel zou de herkomst van
  // velden die later via website/document/gesprek zijn gevuld overschrijven.
  const orgVeldTimers = useRef({});

  const bewaarOrgVeldGedebiend = useCallback((veld, waarde) => {
    if (orgBron.current !== 'supabase') {
      return;
    }

    clearTimeout(orgVeldTimers.current[veld]);
    orgVeldTimers.current[veld] = setTimeout(() => {
      bewaarOrganisatieVelden({ [veld]: waarde }, 'handmatig').then((res) => {
        if (res.organizationId) {
          setOrgBronnen((cur) => ({
            ...cur,
            [veld]: { type: 'handmatig', ref: null, tijd: new Date().toISOString() },
          }));
        }
      });
    }, 900);
  }, []);

  const patch = useCallback((next) => setSt((cur) => ({ ...cur, ...next })), []);

  // Altijd de laatste projectenlijst, ook binnen dezelfde tik: zo wordt het
  // bijgewerkte project eerst berekend en daarna pas bewaard, in plaats van
  // het uit een setState-functie te "vangen" (die React uitstelt, waardoor
  // bewaren dan stil kon overslaan).
  const projectenRef = useRef(st.projects);

  projectenRef.current = st.projects;

  const pasProjectToe = useCallback((projectId, maakNieuw) => {
    const huidig = projectenRef.current.find((p) => p.id === projectId);

    if (!huidig) {
      return null;
    }

    const nieuw = maakNieuw(huidig);

    if (nieuw && nieuw !== huidig) {
      projectenRef.current = projectenRef.current.map((p) => (p.id === projectId ? nieuw : p));
      setSt((cur) => ({ ...cur, projects: cur.projects.map((p) => (p.id === projectId ? nieuw : p)) }));
    }

    return nieuw || null;
  }, []);

  // Bewaart één project in de database en zet het definitieve id (en de
  // definitieve document-id's) terug in de staat. Geeft het uiteindelijke id
  // terug, of null als bewaren in de database mislukte. Zonder databasebron
  // (niet ingelogd) blijft het lokaal en geeft het tijdelijke id terug.
  const persistProject = useCallback((teBewaren, tijdelijkId) => {
    if (projectenBron.current !== 'supabase') {
      return Promise.resolve(tijdelijkId);
    }

    return bewaarProject(teBewaren).then((res) => {
      if (!res.id) {
        return null;
      }

      setSt((cur) => ({
        ...cur,
        projects: cur.projects.map((p) =>
          p.id === tijdelijkId ? { ...p, id: res.id, docs: res.docs || p.docs, verwijderdeDocIds: [] } : p,
        ),
      }));

      return res.id;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...st,
      patch,
      orgBronnen,

      setOrgField: (key, val) => {
        setSt((cur) => ({ ...cur, orgProfile: { ...cur.orgProfile, [key]: val } }));
        bewaarOrgVeldGedebiend(key, val);
      },

      // Wist een enkel veld (waarde + herkomst), in plaats van het hele profiel.
      clearOrgField: (key) => {
        setSt((cur) => ({ ...cur, orgProfile: { ...cur.orgProfile, [key]: Array.isArray(cur.orgProfile[key]) ? [] : '' } }));
        setOrgBronnen((cur) => {
          const volgende = { ...cur };

          delete volgende[key];

          return volgende;
        });

        if (orgBron.current === 'supabase') {
          wisOrganisatieVeld(key);
        }
      },

      clearOrgProfile: () => {
        patch({ orgProfile: {} });
        setOrgBronnen({});

        if (orgBron.current === 'supabase') {
          verwijderOrganisatieprofiel();
        }
      },

      // Neemt goedgekeurde AI-voorstellen over in het profiel, met de juiste
      // herkomst (nooit 'handmatig') - gebruikt door de documentanalyse
      // (fase 3) en straks ook door de website-analyse. Dit is geen getypte
      // invoer maar een expliciete, eenmalige bevestiging door het lid, dus
      // meteen bewaard in plaats van gedebiend zoals setOrgField.
      overnemenOrgVelden: (velden, sourceType, sourceRef) => {
        if (!velden || !Object.keys(velden).length) {
          return;
        }

        setSt((cur) => ({ ...cur, orgProfile: { ...cur.orgProfile, ...velden } }));

        const tijd = new Date().toISOString();

        setOrgBronnen((cur) => {
          const volgende = { ...cur };

          Object.keys(velden).forEach((veld) => {
            volgende[veld] = { type: sourceType, ref: sourceRef || null, tijd };
          });

          return volgende;
        });

        if (orgBron.current === 'supabase') {
          bewaarOrganisatieVelden(velden, sourceType, sourceRef || null);
        }
      },

      // Een tijdelijk lokaal id (voor een nieuw project, vóórdat de database
      // een echt id teruggeeft) zodat de rij meteen zichtbaar is; zodra
      // bewaarProject() een echt id oplevert, wordt die er alsnog ingezet.
      // Geeft een belofte terug met het uiteindelijke id (null bij mislukken).
      // Wijzigingen via dit formulier zijn door het lid zelf gedaan en krijgen
      // herkomst 'handmatig'.
      saveProject: (project) => {
        const tijdelijkId = project.id || `tijdelijk-${Date.now()}`;
        const vorig = (st.projects || []).find((p) => p.id === tijdelijkId) || null;
        const teBewaren = { ...project, id: tijdelijkId, bronnen: markeerHandmatigeWijzigingen(vorig, project) };

        setSt((cur) => {
          const list = cur.projects.slice();
          const i = list.findIndex((p) => p.id === tijdelijkId);

          if (i === -1) {
            list.push(teBewaren);
          } else {
            list[i] = teBewaren;
          }

          return { ...cur, projects: list };
        });

        return persistProject(teBewaren, tijdelijkId);
      },

      // Maakt een nieuw project aan uit het gespreksdossier (alleen aangeroepen
      // na een duidelijk signaal en een duplicaatcontrole, zie
      // projectKoppeling.js). Geeft een belofte met het echte id (null bij
      // mislukken - dan wordt het gesprek ook niet aan een niet-bestaand
      // project gekoppeld).
      maakProject: ({ naam, velden, bronnen }) => {
        const tijdelijkId = `tijdelijk-${Date.now()}`;
        const project = {
          ...PROJECT_EMPTY,
          ...velden,
          naam,
          id: tijdelijkId,
          bronnen: { ...(bronnen || {}) },
        };

        setSt((cur) => ({ ...cur, projects: cur.projects.concat([project]) }));

        return persistProject(project, tijdelijkId).then((id) => {
          if (!id) {
            setSt((cur) => ({ ...cur, projects: cur.projects.filter((p) => p.id !== tijdelijkId) }));
          }

          return id;
        });
      },

      // Vult/werkt één bestaand project bij met velden uit het gesprek
      // (zie bepaalVeldUpdates). Raakt nooit een ander project.
      werkProjectBij: (projectId, updates, opties) => {
        const bijgewerkt = pasProjectToe(projectId, (huidig) => pasUpdatesToe(huidig, updates, opties));

        return bijgewerkt ? persistProject(bijgewerkt, projectId) : Promise.resolve(null);
      },

      // Veilige standaard i.p.v. verwijderen: het project doet niet meer mee
      // als actief project of in matching, maar niets gaat verloren.
      archiveProject: (id, archiveren = true) => {
        setSt((cur) => ({
          ...cur,
          projects: cur.projects.map((p) => (p.id === id ? { ...p, gearchiveerd: archiveren } : p)),
        }));

        if (projectenBron.current === 'supabase' && isEchtId(id)) {
          archiveerProject(id, archiveren);
        }
      },

      deleteProject: (id) => {
        setSt((cur) => ({ ...cur, projects: cur.projects.filter((p) => p.id !== id) }));

        if (projectenBron.current === 'supabase' && isEchtId(id)) {
          verwijderProject(id);
        }
      },

      addRegelingToProject: (regeling, projectId) => {
        const bijgewerkt = pasProjectToe(projectId, (huidig) => {
          const bestaand = huidig.regelingen || [];

          if (bestaand.some((r) => String(r.id) === String(regeling.id))) {
            return huidig;
          }

          return { ...huidig, regelingen: bestaand.concat([{ ...regeling, plan: 'Gepland', herinner: true }]) };
        });

        if (bijgewerkt) {
          persistProject(bijgewerkt, projectId);
        }
      },

      // Vervolgopdracht, prioriteit 7 (Export - "Opslaan bij project"): voegt
      // een door de AI opgesteld resultaat (projectplan, begroting, ...) toe
      // aan de documenten van het gekoppelde project, en bewaart het project
      // meteen - exact hetzelfde patroon als addRegelingToProject hierboven.
      // Bewust GEEN gebruik van genDocs/de Documentatie-opslag: die loopt op
      // tabellen (documentatie/documentatie_versies) die niet bestaan (zie
      // workspace.js) en valt daardoor altijd terug op localStorage. Deze
      // functie hergebruikt in plaats daarvan de al werkende opslag van
      // projectdocumenten (project.docs -> subsidie_kompas_knowledge_items,
      // zie projecten.js) - geen nieuwe opslagstructuur.
      addGeneratedDocToProject: (projectId, doc) => {
        const fondsVan = (d) => String((d.context && d.context.fonds) || '').trim().toLowerCase();

        const bijgewerkt = pasProjectToe(projectId, (huidig) => {
          const bestaand = huidig.docs || [];

          // Geen dubbele opslag: exact dezelfde tekst en soort niet nogmaals
          // toevoegen (bijv. bij twee keer op "Opslaan bij project" klikken).
          if (bestaand.some((d) => d.soort === doc.soort && d.tekst === doc.tekst)) {
            return huidig;
          }

          // Een nieuwe generatie wordt een NIEUWE versie naast de vorige
          // (zelfde soort + zelfde fonds); de vorige wordt niet vervangen.
          const zelfde = (d) => d.soort === doc.soort && fondsVan(d) === fondsVan(doc);
          const versie = bestaand.filter(zelfde).reduce((m, d) => Math.max(m, d.versie || 1), 0) + 1;

          return {
            ...huidig,
            docs: bestaand
              .map((d) => (zelfde(d) ? { ...d, vervangen: true } : d))
              .concat([{ ...doc, versie, vervangen: false, bron: 'generated', gemaakt: new Date().toISOString() }]),
          };
        });

        if (bijgewerkt) {
          persistProject(bijgewerkt, projectId);
        }
      },

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

      deleteConversation: (id) => {
        setSt((cur) => ({ ...cur, conversations: cur.conversations.filter((c) => c.id !== id) }));

        if (gesprekkenBron.current === 'supabase') {
          verwijderGesprekService(id);
        }
      },

      clearConversations: () => {
        patch({ conversations: [] });

        if (gesprekkenBron.current === 'supabase') {
          verwijderAlleGesprekken();
        }
      },

      // Zet een net aangemaakt of bijgewerkt gesprek vooraan in de lijst -
      // gebruikt door KompasToolPage.jsx zelf rechtstreeks na
      // maakGesprekAan()/voegBerichtToe()/koppelGesprekAanProject(), zodat de
      // "Eerdere gesprekken"-lijst meteen klopt zonder opnieuw op te halen.
      // Altijd vooraan zetten (in plaats van op de bestaande plek bijwerken)
      // houdt dit in lijn met haalGesprekkenOp(), die op updated_at aflopend
      // sorteert: het gesprek waarin net iets is gebeurd hoort bovenaan.
      upsertGesprekInLijst: (gesprek) =>
        setSt((cur) => {
          const bestaand = cur.conversations.find((c) => c.id === gesprek.id);
          const zonder = cur.conversations.filter((c) => c.id !== gesprek.id);
          const bijgewerkt = bestaand ? { ...bestaand, ...gesprek } : gesprek;

          return { ...cur, conversations: [bijgewerkt, ...zonder] };
        }),

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
    [st, patch, orgBronnen, bewaarOrgVeldGedebiend, persistProject, pasProjectToe],
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
