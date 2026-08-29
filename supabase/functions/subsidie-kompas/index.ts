// Edge Function: de assistent van Subsidie Kompas.
//
// Antwoordt op twee manieren:
//   stream: false  -> { answer, sources }        (de huidige frontend)
//   stream: true   -> text/event-stream          (voor woord-voor-woord antwoord)
//
// Legt per aanroep het tokengebruik vast in ai_verbruik, en leest de
// systeemtekst uit ai_prompts zodat die zonder code te wijzigen aanpasbaar is.
//
// Zetten: supabase functions deploy subsidie-kompas
// Nodig:  OPENAI_API_KEY als secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';

const SYSTEEM_STANDAARD = `Je bent Subsidie Kompas, de digitale subsidieadviseur en fondsenwerver van Het Fondsenwervers Collectief.

Je helpt Nederlandse maatschappelijke organisaties bij het vinden van passende fondsen en subsidies en bij het schrijven van sterke aanvragen.

Werkwijze:
- Antwoord in het Nederlands, zakelijk en praktisch.
- Spreek de gebruiker aan met u.
- Noem leden van het Collectief "leden", geen "gebruikers".
- Verzin geen fondsen, bedragen, deadlines of voorwaarden. Weet je iets niet, zeg dat en vraag door.
- Vraag naar ontbrekende informatie in plaats van aannames te doen.
- Verwijs bij bedragen en deadlines naar de bron.`;

const PREMIUM_AANVULLING = `Dit lid heeft Premium. Je mag verwijzen naar de exclusieve fondsendatabase van het Collectief, met fondsen en subsidieverstrekkers die online niet of beperkt vindbaar zijn.`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Beheerbare systeemtekst; valt terug op de tekst hierboven.
async function systeemtekst(admin: any, premium: boolean) {
  let basis = SYSTEEM_STANDAARD;
  let aanvulling = PREMIUM_AANVULLING;

  try {
    const { data } = await admin
      .from('ai_prompts')
      .select('key, prompt')
      .in('key', ['kompas.system', 'kompas.premium_addendum']);

    (data || []).forEach((r: any) => {
      if (r.key === 'kompas.system' && r.prompt) basis = r.prompt;
      if (r.key === 'kompas.premium_addendum' && r.prompt) aanvulling = r.prompt;
    });
  } catch (_) {
    // tabel bestaat nog niet; de standaardtekst geldt
  }

  return premium ? `${basis}\n\n${aanvulling}` : basis;
}

async function legVerbruikVast(admin: any, row: Record<string, unknown>) {
  try {
    await admin.from('ai_verbruik').insert(row);
  } catch (_) {
    // verbruik vastleggen mag een antwoord nooit blokkeren
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    return json({ error: 'De assistent is niet geconfigureerd.' }, 500);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  // Wie vraagt dit, en met welk abonnement?
  const authHeader = req.headers.get('Authorization') || '';
  let profileId: string | null = null;
  let tier = 'free';

  if (authHeader.startsWith('Bearer ')) {
    const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    const user = userData?.user;

    if (user) {
      profileId = user.id;

      const { data: profiel } = await admin
        .from('profiles')
        .select('subscription_tier, subscription_active')
        .eq('id', user.id)
        .single();

      if (profiel?.subscription_active && profiel.subscription_tier) {
        tier = profiel.subscription_tier;
      }
    }
  }

  let body: any;

  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  }

  const berichten = Array.isArray(body.messages) ? body.messages : [];

  if (!berichten.length) {
    return json({ error: 'Geen vraag ontvangen.' }, 400);
  }

  // Het abonnement komt uit het profiel, niet uit de aanvraag. De browser kan
  // dit dus niet ophogen.
  const premium = tier === 'premium';
  const systeem = await systeemtekst(admin, premium);

  const invoer = [
    { role: 'system', content: systeem },
    ...(body.context ? [{ role: 'system', content: String(body.context).slice(0, 24000) }] : []),
    ...berichten
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 12000) })),
  ];

  const wilStream = body.stream === true;

  const antwoord = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: invoer,
      temperature: 0.3,
      max_tokens: 2000,
      stream: wilStream,
      ...(wilStream ? { stream_options: { include_usage: true } } : {}),
    }),
  });

  if (!antwoord.ok) {
    return json({ error: 'De assistent kon geen antwoord geven. Probeer het opnieuw.' }, 502);
  }

  // Antwoord in één keer.
  if (!wilStream) {
    const data = await antwoord.json();
    const tekst = data.choices?.[0]?.message?.content;

    if (!tekst) {
      return json({ error: 'De assistent gaf een leeg antwoord.' }, 502);
    }

    if (profileId) {
      await legVerbruikVast(admin, {
        profile_id: profileId,
        gesprek_id: body.conversationId ?? null,
        model: MODEL,
        tokens_in: data.usage?.prompt_tokens ?? null,
        tokens_uit: data.usage?.completion_tokens ?? null,
      });
    }

    return json({ answer: tekst, sources: [] });
  }

  // Antwoord woord voor woord. De frontend leest dit met een EventSource-achtige
  // lus; elke regel is 'data: {json}'.
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = antwoord.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let volledig = '';
      let usage: any = null;

      const stuur = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

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

            const payload = t.slice(5).trim();

            if (payload === '[DONE]') continue;

            try {
              const deel = JSON.parse(payload);
              const stukje = deel.choices?.[0]?.delta?.content;

              if (deel.usage) usage = deel.usage;

              if (stukje) {
                volledig += stukje;
                stuur({ delta: stukje });
              }
            } catch (_) {
              // onvolledig fragment; volgende ronde
            }
          }
        }

        stuur({ done: true, answer: volledig, sources: [] });
      } catch (_) {
        stuur({ error: 'De verbinding met de assistent viel weg.' });
      } finally {
        controller.close();

        if (profileId) {
          await legVerbruikVast(admin, {
            profile_id: profileId,
            gesprek_id: body.conversationId ?? null,
            model: MODEL,
            tokens_in: usage?.prompt_tokens ?? null,
            tokens_uit: usage?.completion_tokens ?? null,
          });
        }
      }
    },
  });

  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
});
