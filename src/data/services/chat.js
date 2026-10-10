// De AI-assistent. Behoudt de bestaande Edge Function 'subsidie-kompas'.
// Bestaat de functie niet of is Supabase niet geconfigureerd, dan komt er een
// nette melding terug in plaats van een uitzondering — de UI blijft intact.
import { supabase } from '../client.js';

export const CHAT_FUNCTION = 'subsidie-kompas';

const GEEN_VERBINDING =
  'De assistent is nu niet beschikbaar. Probeer het later opnieuw of neem contact op als dit blijft gebeuren.';

/*
  Aanroep van de assistent, zonder streaming.

  messages     [{ role, content }]  het gesprek tot nu toe
  tier         'free' | 'pro' | 'premium'
  permissions  { canGenerateFiles, canUploadFiles, canUseKnowledgeBase,
                 canUseFundDatabase, canUseOrganizationMemory }
  context      optioneel: organisatieprofiel, projecten, actief document
  orgProfile   optioneel (fase 6): het organisatieprofiel zelf, alleen voor
               Pro/Premium - laat de Edge Function zien welke velden nog
               ontbreken, zodat de AI daar tijdens het gesprek naar kan vragen
  project      optioneel (vervolgopdracht, prioriteit 6): het aan dit gesprek
               gekoppelde project zelf, alleen voor Pro/Premium - zelfde
               principe als orgProfile hierboven, nu voor projectvelden
               (doelgroep, omschrijving, begroting, ...) in plaats van
               organisatievelden.
  matchSignalen  optioneel (AI Fundraising Assistant, fase 1): de rauwe
               signalen voor de matchscore-engine - zie buildMatchSignalen()
               hieronder. Alleen ruwe data, geen berekening: het scoren zelf
               gebeurt uitsluitend server-side in de Edge Function, zodat er
               geen matchlogica dubbel bestaat in frontend én backend.
  kompasMode   optioneel: welke Subsidie Kompas-workflow actief is
               ('algemeen' | 'fondsadvies' | 'aanvraagbeoordeling' |
               'projectplan' | 'begroting' | 'strategie' | 'actieplan'). De
               Edge Function valideert dit zelf server-side tegen een
               vaste lijst (KOMPAS_MODES) en valt bij een ontbrekende of
               onbekende waarde terug op 'algemeen' - hier dus geen nieuwe
               validatie nodig, gewoon doorgeven.
  projectDossier  optioneel (verstevigen Projectplan-runtime, punten 2/3): het
               compacte, intern bijgehouden Projectdossier zoals dat na het
               vorige antwoord is teruggekomen - puur doorgeven, nooit hier
               zelf aanpassen. De Edge Function stuurt in de respons een
               bijgewerkte versie terug (alleen relevant/gevuld wanneer
               kompasMode 'projectplan' is); ontbreekt die, dan blijft de
               vorige waarde gewoon gelden (zie KompasToolPage.jsx).

  Geeft terug: { answer, sources, veldVoorstellen, projectDossier, error }
*/
export async function askKompas({ messages, tier, permissions, context, conversationId, activeProgramId, matchSignalen, kompasMode, projectDossier }) {
  if (!supabase) {
    return { answer: null, sources: [], veldVoorstellen: {}, projectDossier: null, error: GEEN_VERBINDING };
  }

  try {
    const { data, error } = await supabase.functions.invoke(CHAT_FUNCTION, {
      body: {
        messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
        subscriptionTier: tier,
        permissions: permissions || {},
        // Extra achtergrond. De Edge Function mag dit negeren zolang het daar
        // nog niet is aangesloten; de aanroep blijft geldig.
        context: context || null,
        conversationId: conversationId ?? null,
        // Organisatie en actief project worden door de server zelf uit de
        // database gelezen (per ingelogde gebruiker); de browser stuurt alleen
        // mee WELK project actief is. Zonder id: geen projectcontext.
        activeProgramId: activeProgramId || null,
        contextVersie: 2,
        matchSignalen: matchSignalen || null,
        kompasMode: kompasMode || null,
        projectDossier: projectDossier || null,
      },
    });

    if (error) {
      throw error;
    }

    if (!data || !data.answer) {
      throw new Error('Geen antwoord ontvangen.');
    }

    return {
      answer: data.answer,
      sources: data.sources || [],
      veldVoorstellen: data.veldVoorstellen || {},
      projectDossier: data.projectDossier || null,
      projectDossierBronnen: data.projectDossierBronnen || {},
      error: null,
    };
  } catch (e) {
    return { answer: null, sources: [], veldVoorstellen: {}, projectDossier: null, error: GEEN_VERBINDING };
  }
}

/*
  Aanroep met streaming: het antwoord komt woord voor woord binnen.
  onDelta(stukje) wordt per fragment aangeroepen.

  Geeft terug: { answer, sources, veldVoorstellen, error, partial }

  partial: true betekent dat de verbinding onderweg is weggevallen (bijv. een
  platform-timeout bij een zeer zwaar verzoek) - answer bevat dan alsnog de
  tekst die al binnenkwam vóór het wegvallen, in plaats van dat deze wordt
  weggegooid. Dit is bewust géén gewone succesvolle afronding: de aanroeper
  moet dit onderscheiden kunnen tonen (STAP 5 - nooit een afgebroken antwoord
  ongemarkeerd als volledig antwoord tonen).

  Antwoordt de Edge Function niet met text/event-stream — bijvoorbeeld omdat de
  oude versie nog draait — dan valt deze functie terug op askKompas(), zodat de
  gebruiker altijd een antwoord krijgt.
*/
export async function askKompasStream({ messages, tier, permissions, context, conversationId, activeProgramId, matchSignalen, kompasMode, projectDossier, onDelta }) {
  if (!supabase) {
    return { answer: null, sources: [], veldVoorstellen: {}, projectDossier: null, error: GEEN_VERBINDING };
  }

  try {
    const { data: sessie } = await supabase.auth.getSession();
    const token = sessie?.session?.access_token;
    const basis = import.meta.env.VITE_SUPABASE_URL;

    const res = await fetch(`${basis}/functions/v1/${CHAT_FUNCTION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
        subscriptionTier: tier,
        permissions: permissions || {},
        context: context || null,
        conversationId: conversationId ?? null,
        // Organisatie en actief project worden door de server zelf uit de
        // database gelezen (per ingelogde gebruiker); de browser stuurt alleen
        // mee WELK project actief is. Zonder id: geen projectcontext.
        activeProgramId: activeProgramId || null,
        contextVersie: 2,
        matchSignalen: matchSignalen || null,
        kompasMode: kompasMode || null,
        projectDossier: projectDossier || null,
        stream: true,
      }),
    });

    const soort = res.headers.get('content-type') || '';

    // Geen stream: de functie ondersteunt het nog niet.
    if (!res.ok || soort.indexOf('text/event-stream') === -1) {
      return askKompas({ messages, tier, permissions, context, conversationId, activeProgramId, matchSignalen, kompasMode, projectDossier });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let volledig = '';
    let sources = [];
    let veldVoorstellen = {};
    let projectDossierUit = null;
    let projectDossierBronnenUit = {};
    let serverFout = null;
    // STAP 5 (gevonden tijdens de belastingstest met het zwaarste testgeval):
    // een verbroken verbinding gooit niet altijd een leesfout - bij een
    // platform-timeout tijdens het genereren kan de stream ook gewoon *netjes*
    // eindigen (reader.read() geeft done:true) zonder dat er ooit een 'done'-
    // of 'error'-bericht van de server is binnengekomen. Zonder deze vlag zou
    // de reeds binnengekomen (afgekapte) tekst hieronder stilzwijgend als
    // volledig antwoord worden teruggegeven - precies wat STAP 5 verbiedt.
    let kreegDone = false;

    try {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const regels = buffer.split('\n');
        buffer = regels.pop() || '';

        for (const regel of regels) {
          const t = regel.trim();

          if (!t.startsWith('data:')) continue;

          try {
            const deel = JSON.parse(t.slice(5).trim());

            if (deel.error) {
              // Een expliciete foutmelding van de Edge Function zelf (bijv.
              // de model gaf 'response.failed') - dit is geen wegvallende
              // verbinding, dus hier blijft de bestaande, nette foutmelding
              // leidend en wordt eventuele losse deltatekst niet als
              // (mogelijk onbetrouwbaar) antwoord getoond.
              serverFout = deel.error;

              continue;
            }

            if (deel.delta) {
              volledig += deel.delta;

              if (onDelta) onDelta(deel.delta);
            }

            if (deel.done) {
              kreegDone = true;
              volledig = deel.answer || volledig;
              sources = deel.sources || [];
              veldVoorstellen = deel.veldVoorstellen || {};
              projectDossierUit = deel.projectDossier || null;
              projectDossierBronnenUit = deel.projectDossierBronnen || {};
            }
          } catch (e) {
            // onvolledig JSON-fragment (regel liep over twee chunks) - de
            // volgende regel maakt dit compleet, dus dit is geen echte fout.
          }
        }
      }
    } catch (leesFout) {
      // STAP 5: de verbinding viel onderweg weg (bijv. de platform-timeout
      // bij een zeer zwaar verzoek). Wat al binnenkwam via onDelta() staat al
      // op het scherm bij het lid - dat nu weggooien en een generieke
      // foutmelding tonen zou erger zijn dan het te laten staan. Er al wél
      // tekst is: toon die, duidelijk gemarkeerd als afgebroken (partial),
      // nooit ongemarkeerd als volledig antwoord.
      if (volledig) {
        return { answer: volledig, sources: [], veldVoorstellen: {}, projectDossier: null, error: null, partial: true };
      }

      return { answer: null, sources: [], veldVoorstellen: {}, projectDossier: null, error: GEEN_VERBINDING };
    }

    if (serverFout) {
      return { answer: null, sources: [], veldVoorstellen: {}, projectDossier: null, error: serverFout };
    }

    if (!kreegDone) {
      // De verbinding is netjes gesloten, maar de server heeft nooit een
      // afrondend signaal gestuurd (zie toelichting bij kreegDone hierboven).
      // Zelfde behandeling als een leesfout: toon wat er al was, duidelijk
      // gemarkeerd als afgebroken, nooit ongemarkeerd als volledig antwoord.
      if (volledig) {
        return { answer: volledig, sources: [], veldVoorstellen: {}, projectDossier: null, error: null, partial: true };
      }

      return { answer: null, sources: [], veldVoorstellen: {}, projectDossier: null, error: GEEN_VERBINDING };
    }

    if (!volledig) {
      throw new Error('Leeg antwoord.');
    }

    return { answer: volledig, sources, veldVoorstellen, projectDossier: projectDossierUit, projectDossierBronnen: projectDossierBronnenUit, error: null };
  } catch (e) {
    return { answer: null, sources: [], veldVoorstellen: {}, projectDossier: null, error: GEEN_VERBINDING };
  }
}

/*
  Laat een geüpload organisatiedocument analyseren (fase 3). Geeft
  { velden, error } terug - velden is een object met voorgestelde
  organisatieprofiel-waarden (bijv. { mission: '...', kvk: '12345678' }),
  nooit vanzelf opgeslagen: de pagina toont dit altijd eerst ter goedkeuring.
*/
export async function extractOrganisatieVelden({ text, fileName }) {
  if (!supabase) {
    return { velden: {}, error: GEEN_VERBINDING };
  }

  try {
    const { data, error } = await supabase.functions.invoke(CHAT_FUNCTION, {
      body: { mode: 'extract', text, fileName: fileName || null },
    });

    if (error) {
      throw error;
    }

    return { velden: (data && data.velden) || {}, error: null };
  } catch (e) {
    return { velden: {}, error: 'Het document kon niet worden geanalyseerd. Probeer het opnieuw.' };
  }
}

/*
  RC1 stap 3D-4 (2026-10-01): laat een al in de chat opgestelde begrotingstekst
  structureren (mode: 'budget'), voor de "Exporteren naar Excel"-knop in de
  begrotingsworkflow (KompasToolPage.jsx). Geeft { budget, error } terug -
  'budget' is hier UITSLUITEND de letterlijk uit de tekst getranscribeerde
  vorm ({ expenseLines, meta }, zie budgetUitTekst() in de Edge Function);
  alle rekenwerk en validatie gebeurt pas daarna, client-side, in
  berekenBudget() - nooit hier en nooit server-side.
*/
export async function haalBudgetUitTekst({ tekst }) {
  if (!supabase) {
    return { budget: null, error: GEEN_VERBINDING };
  }

  try {
    const { data, error } = await supabase.functions.invoke(CHAT_FUNCTION, {
      body: { mode: 'budget', text: tekst },
    });

    if (error) {
      throw error;
    }

    return { budget: (data && data.budget) || null, error: null };
  } catch (e) {
    return { budget: null, error: 'De begroting kon niet worden geanalyseerd. Probeer het opnieuw.' };
  }
}

/*
  Laat de eigen website analyseren (fase 4). Geeft { velden, paginas, error }
  terug - net als extractOrganisatieVelden() hierboven wordt niets vanzelf
  opgeslagen; de pagina toont dit altijd eerst ter goedkeuring. 'paginas' is
  de lijst gelezen pagina's (homepage plus, indien gevonden, een paar
  voor de hand liggende pagina's zoals "over ons"), zodat de gebruiker kan
  zien waar de voorstellen vandaan komen.
*/
export async function analyseerWebsite({ url }) {
  if (!supabase) {
    return { velden: {}, paginas: [], error: GEEN_VERBINDING };
  }

  try {
    const { data, error } = await supabase.functions.invoke(CHAT_FUNCTION, {
      body: { mode: 'website', url },
    });

    if (error) {
      throw error;
    }

    return { velden: (data && data.velden) || {}, paginas: (data && data.paginas) || [], error: null };
  } catch (e) {
    return { velden: {}, paginas: [], error: 'De website kon niet worden geanalyseerd. Probeer het opnieuw.' };
  }
}

/*
  Bouwt de achtergrondtekst uit het profiel, de projecten en het actieve
  document. Blijft aan deze kant zodat de Edge Function er niets van hoeft te
  weten tot die is bijgewerkt.
*/
export function buildContext({ activeDoc, projects, linkedProjectId }) {
  // Organisatieprofiel en actief project komen niet meer vanuit de browser:
  // de server leest die zelf uit de database, voor de ingelogde gebruiker en
  // alleen voor het actieve project (active_program_id). Hier staat daarom
  // alleen nog het document waaraan het lid nu verder werkt - en alleen als
  // dat document bij het actieve project hoort.
  if (!activeDoc || !linkedProjectId || activeDoc.projectId !== linkedProjectId) {
    return null;
  }

  const project = (projects || []).find((p) => p.id === linkedProjectId);

  return (
    `Het lid werkt nu verder aan het document "${activeDoc.naam}" (${activeDoc.soort})` +
    (project ? ` bij het project ${project.naam || ''}` : '') +
    '. Ga uit van de eerdere versie en stel gerichte vragen als informatie ontbreekt.'
  );
}

/*
  AI Fundraising Assistant, fase 1: bouwt de rauwe matchsignalen uit het
  organisatieprofiel en het ACTIEVE project van dit lid (geen terugval op een
  willekeurig ander project). Puur een uitleesfunctie, geen scoring — het berekenen
  van een matchscore gebeurt uitsluitend server-side in de Edge Function
  (subsidie-kompas), zodat er geen matchlogica dubbel bestaat in frontend én
  backend. Geeft null terug zolang er niets bruikbaars bekend is, dan blijft
  het gesprek werken zoals voorheen (zonder matchscores).
*/
export function buildMatchSignalen({ orgProfile, projects, linkedProjectId }) {
  const profiel = orgProfile || {};
  const themas = Array.isArray(profiel.themas) ? profiel.themas : [];

  // Het ACTIEVE project is leidend; zonder actief project bestaat er geen
  // projectcriterium (dus ook geen terugval op "het eerste project").
  const project = linkedProjectId ? (projects || []).find((p) => p.id === linkedProjectId && !p.gearchiveerd) || null : null;

  const projectDoelgroepen = project && Array.isArray(project.doelgroep) ? project.doelgroep.filter(Boolean) : [];
  const doelgroepen = project && projectDoelgroepen.length ? projectDoelgroepen : Array.isArray(profiel.doelgroepen) ? profiel.doelgroepen : [];
  const werkgebied = (project && String(project.regio || '').trim()) || profiel.regio || '';

  const gevraagdCijfers = project ? String(project.gevraagd || '').replace(/[^0-9]/g, '') : '';
  const gevraagdBedrag = gevraagdCijfers ? Number(gevraagdCijfers) : null;

  if (!themas.length && !doelgroepen.length && !werkgebied && !gevraagdBedrag) {
    return null;
  }

  return { themas, doelgroepen, werkgebied, gevraagdBedrag };
}
