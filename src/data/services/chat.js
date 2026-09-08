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

  Geeft terug: { answer, sources, veldVoorstellen, error }
*/
export async function askKompas({ messages, tier, permissions, context, conversationId, orgProfile }) {
  if (!supabase) {
    return { answer: null, sources: [], veldVoorstellen: {}, error: GEEN_VERBINDING };
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
        orgProfile: orgProfile || null,
      },
    });

    if (error) {
      throw error;
    }

    if (!data || !data.answer) {
      throw new Error('Geen antwoord ontvangen.');
    }

    return { answer: data.answer, sources: data.sources || [], veldVoorstellen: data.veldVoorstellen || {}, error: null };
  } catch (e) {
    return { answer: null, sources: [], veldVoorstellen: {}, error: GEEN_VERBINDING };
  }
}

/*
  Aanroep met streaming: het antwoord komt woord voor woord binnen.
  onDelta(stukje) wordt per fragment aangeroepen.

  Geeft terug: { answer, sources, error }

  Antwoordt de Edge Function niet met text/event-stream — bijvoorbeeld omdat de
  oude versie nog draait — dan valt deze functie terug op askKompas(), zodat de
  gebruiker altijd een antwoord krijgt.
*/
export async function askKompasStream({ messages, tier, permissions, context, conversationId, onDelta }) {
  if (!supabase) {
    return { answer: null, sources: [], error: GEEN_VERBINDING };
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
        stream: true,
      }),
    });

    const soort = res.headers.get('content-type') || '';

    // Geen stream: de functie ondersteunt het nog niet.
    if (!res.ok || soort.indexOf('text/event-stream') === -1) {
      return askKompas({ messages, tier, permissions, context, conversationId });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let volledig = '';
    let sources = [];

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
            throw new Error(deel.error);
          }

          if (deel.delta) {
            volledig += deel.delta;

            if (onDelta) onDelta(deel.delta);
          }

          if (deel.done) {
            volledig = deel.answer || volledig;
            sources = deel.sources || [];
          }
        } catch (e) {
          if (e && e.message && e.message !== 'Unexpected end of JSON input') {
            throw e;
          }
        }
      }
    }

    if (!volledig) {
      throw new Error('Leeg antwoord.');
    }

    return { answer: volledig, sources, error: null };
  } catch (e) {
    return { answer: null, sources: [], error: GEEN_VERBINDING };
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
export function buildContext({ orgProfile, projects, activeDoc, fieldLabels, linkedProjectId }) {
  const delen = [];
  const profiel = orgProfile || {};

  // Fase 5, punt 6/7 uit het oorspronkelijke verzoek: de AI moet weten welk
  // project bij dit gesprek hoort, als het lid dat heeft gekoppeld.
  if (linkedProjectId) {
    const gekoppeld = (projects || []).find((p) => p.id === linkedProjectId);

    if (gekoppeld) {
      delen.push(
        `Dit gesprek is door het lid gekoppeld aan het project "${gekoppeld.naam || 'Naamloos project'}". Ga hiervan uit als hoofdonderwerp, tenzij het lid het duidelijk over iets anders heeft.`,
      );
    }
  }

  const gevuld = Object.keys(profiel).filter((k) => {
    const v = profiel[k];

    return Array.isArray(v) ? v.length : String(v || '').trim();
  });

  if (gevuld.length) {
    const regels = gevuld.map((k) => {
      const label = (fieldLabels && fieldLabels[k]) || k;
      const v = Array.isArray(profiel[k]) ? profiel[k].join(', ') : profiel[k];

      return `- ${label}: ${v}`;
    });

    delen.push(`Organisatieprofiel van dit lid:\n${regels.join('\n')}`);
  }

  if ((projects || []).length) {
    const regels = projects.map((pr) => {
      const docs = pr.docs || [];
      const namen = docs.map((d) => `${d.soort}: ${d.naam}`).join('; ');
      const inhoud = docs
        .filter((d) => d.tekst)
        .map((d) => `Inhoud van ${d.naam}:\n${d.tekst}`)
        .join('\n\n');

      return [
        `- ${pr.naam || 'Naamloos project'}`,
        pr.gevraagd ? `, gevraagd bedrag ${pr.gevraagd}` : '',
        pr.begroting ? `, begroting ${pr.begroting}` : '',
        namen ? `\n  Documenten: ${namen}` : '',
        inhoud ? `\n${inhoud}` : '',
      ].join('');
    });

    delen.push(`Projecten van dit lid:\n${regels.join('\n')}`);
  }

  if (activeDoc) {
    const project = (projects || []).find((p) => p.id === activeDoc.projectId);

    delen.push(
      `Het lid werkt nu verder aan het document "${activeDoc.naam}" (${activeDoc.soort})` +
        (project ? ` bij het project ${project.naam || ''}` : '') +
        '. Ga uit van de eerdere versie en stel gerichte vragen als informatie ontbreekt.',
    );
  }

  if (!delen.length) {
    return null;
  }

  return `Gebruik deze achtergrondinformatie waar die relevant is. Verzin niets wat er niet staat.\n\n${delen.join('\n\n')}`;
}
