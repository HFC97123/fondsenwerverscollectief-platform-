// Edge Function `aanvraag-assistent`: een aanvraag beoordelen tegen de eisen van een fonds (Pro en Premium). Aparte functie, zodat een deploy of fout
// hier de matching in `subsidie-kompas` nooit raakt. STANDAARD AAN voor Pro en Premium; alleen AANVRAAG_ASSISTENT=uit zet hem uit (noodrem).
//
// Alle logica staat in ../_shared/aanvraagHandler.ts (testbaar zonder netwerk). Dit bestand maakt alleen de echte verbindingen:
// Supabase (gebruiker, profiel, tellingen, opslag), OpenAI (Responses API) en het veilig ophalen van publieke websitepagina's.
//
// Geheimen (Supabase, Edge Functions): OPENAI_API_KEY (bestaat al), optioneel OPENAI_CHAT_MODEL (standaard gpt-5.5), optioneel AANVRAAG_ASSISTENT=uit (noodrem).
// Verify JWT blijft uit: de functie controleert het token zelf.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = Deno.env.get('OPENAI_CHAT_MODEL') || 'gpt-5.5';
const MODEL_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 4000;
const TELLING_TABEL = { beoordelingen: 'subsidie_kompas_aanvraag_beoordelingen', eisen: 'kompas_gebruik_log', plannen: 'kompas_gebruik_log' } as const;
const AANVRAGEN_TABEL = 'subsidie_kompas_aanvragen';
const AANVRAAG_KOLOMMEN = 'id, program_id, soort, fonds_label, criteria, criteria_bron, bronnen, plan, plan_bijgewerkt_op, laatste_beoordeling_id, laatste_uitkomst, created_at, updated_at';

// Organisatieprofiel: kolom in de database naar het veld dat het plan gebruikt (zelfde vertaling als eigenOrganisatieprofiel in subsidie-kompas).
const ORGANISATIE_KOLOM_NAAR_VELD: Record<string, string> = {
  organization_name: 'name',
  legal_form: 'rechtsvorm',
  founding_year: 'opgericht',
  anbi_status: 'anbi',
  mission: 'mission',
  vision: 'visie',
  working_area: 'regio',
  headquarters_location: 'gemeente',
  province: 'provincie',
  staff_count: 'medewerkers',
  volunteer_count: 'vrijwilligers',
};

function antwoord(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
}

async function resolveHost(host: string): Promise<string[]> {
  const vraag = async (soort: 'A' | 'AAAA') => {
    try {
      return await (Deno as any).resolveDns(host, soort);
    } catch (_e) {
      return [];
    }
  };
  const [a, b] = await Promise.all([vraag('A'), vraag('AAAA')]);

  return [...a, ...b].map(String);
}

// Haalt de tekst uit een Responses-API-antwoord (alle output_text-stukken van alle berichten).
function leesTekst(data: any): string {
  const delen: string[] = [];

  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== 'message') continue;

    for (const c of Array.isArray(item?.content) ? item.content : []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') delen.push(c.text);
    }
  }

  return delen.join('');
}

// Sommige modellen zetten JSON toch in een codeblok; haal het eerste volledige object eruit.
function jsonUitTekst(t: string): string {
  const s = t.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const begin = s.indexOf('{');
  const eind = s.lastIndexOf('}');

  return begin >= 0 && eind > begin ? s.slice(begin, eind + 1) : s;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!apiKey || !url || !serviceKey) return antwoord(500, { ok: false, reden: 'niet-geconfigureerd', error: 'De aanvraag-assistent is niet geconfigureerd.' });

  // Dynamisch geladen: een verzoek met de vlag uit kost zo weinig mogelijk, en een fout in deze modules raakt alleen deze functie.
  const { verwerk, aanvraagVlagAan } = await import('../_shared/aanvraagHandler.ts');
  const { legGebruik } = await import('../_shared/gebruikLog.ts');
  const { safeFetchPublicPage } = await import('../_shared/safeFetch.ts');
  const { extractReadableText } = await import('../_shared/readableText.ts');
  const admin: any = createClient(url, serviceKey);

  const deps = {
    modelNaam: MODEL,
    nu: () => new Date(),
    vlagAan: (userId: string) => aanvraagVlagAan(Deno.env.get('AANVRAAG_ASSISTENT'), userId),

    userUitToken: async (token: string) => {
      const { data } = await admin.auth.getUser(token);

      return data?.user?.id ? { id: String(data.user.id) } : null;
    },

    leesProfiel: async (userId: string) => {
      const { data, error } = await admin.from('profiles').select('subscription_tier, subscription_active, trial_ends_at, role').eq('id', userId).single();

      if (error || !data) return { profiel: null, storing: error?.code !== 'PGRST116' };

      return { profiel: data, storing: false };
    },

    // Misbruikbeveiliging, zelfde functie als de chat. Een storing hier laat het verzoek door (fail open): het is geen kernfunctionaliteit.
    rateLimitOk: async (userId: string) => {
      const { data, error } = await admin.rpc('kompas_check_rate_limit', { p_profile_id: userId, p_max_requests: 20, p_window_seconds: 60 });

      return error ? true : data !== false;
    },

    projectIsVanGebruiker: async (projectId: string, userId: string) => {
      const { data, error } = await admin.from('subsidie_kompas_programs').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();

      if (error) return null;

      return Boolean(data?.id);
    },

    // Telt de afgeronde acties van deze maand. Een tabel die niet bestaat of niet te lezen is geeft null: de handler weigert dan (fail closed).
    telRijen: async (userId: string, soort: 'beoordelingen' | 'eisen' | 'plannen', sindsIso: string) => {
      let q = admin.from(TELLING_TABEL[soort]).select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', sindsIso);

      if (soort === 'eisen') q = q.eq('action_type', 'aanvraag_eisen').eq('success', true);
      if (soort === 'plannen') q = q.eq('action_type', 'aanvraag_plan').eq('success', true);

      const { count, error } = await q;

      return error || typeof count !== 'number' ? null : count;
    },

    // Aanvragen: alleen via deze functie (service role), altijd gefilterd op de gebruiker uit het token.
    lijstAanvragen: async (userId: string, projectId: string) => {
      const { data, error } = await admin.from(AANVRAGEN_TABEL).select(AANVRAAG_KOLOMMEN).eq('user_id', userId).eq('program_id', projectId).order('updated_at', { ascending: false }).limit(100);

      return error ? null : data ?? [];
    },

    leesAanvraag: async (userId: string, id: string) => {
      const { data, error } = await admin.from(AANVRAGEN_TABEL).select(AANVRAAG_KOLOMMEN).eq('id', id).eq('user_id', userId).maybeSingle();

      if (error) return 'storing' as const;

      return data ?? null;
    },

    // Maakt de aanvraag aan of wijzigt alleen de meegegeven velden (upsert op project + soort + fondssleutel).
    bewaarAanvraag: async (rij: Record<string, unknown>) => {
      const { data, error } = await admin.from(AANVRAGEN_TABEL).upsert({ ...rij, updated_at: new Date().toISOString() }, { onConflict: 'program_id,soort,fonds_sleutel' }).select('id').single();

      if (error) {
        console.error('[aanvraag-assistent] aanvraag_opslaan_mislukt');

        return null;
      }

      return data?.id ? String(data.id) : null;
    },

    // Wat het plan van dit lid weet: het project (alleen eigen, niet gearchiveerd), de Projectdocumentatie en het organisatieprofiel.
    leesPlanBron: async (userId: string, projectId: string) => {
      const { data: p, error: pe } = await admin.from('subsidie_kompas_programs').select('*').eq('id', projectId).eq('user_id', userId).is('archived_at', null).maybeSingle();

      if (pe || !p) return null;

      const { data: o } = await admin.from('subsidie_kompas_organizations').select('*').eq('user_id', userId).maybeSingle();
      const organisatie: Record<string, unknown> = {};

      if (o) {
        for (const [kolom, veld] of Object.entries(ORGANISATIE_KOLOM_NAAR_VELD)) organisatie[veld] = o[kolom];
      }

      const planning = String(p.planning || '').trim() || [p.period_start ? `vanaf ${p.period_start}` : '', p.period_end ? `tot ${p.period_end}` : ''].filter(Boolean).join(' ');
      const info = p.project_info && typeof p.project_info === 'object' && p.project_info.velden && typeof p.project_info.velden === 'object' ? p.project_info.velden : {};

      return {
        project: {
          naam: p.name,
          omschrijving: p.description,
          doelgroep: p.target_groups,
          regio: p.location,
          doelstellingen: p.goals,
          activiteiten: p.activities,
          planning,
          impact: p.impact_description,
          partners: p.partners,
          resultaten: p.results,
          begroting: p.budget_total,
          gevraagd: p.requested_amount,
          eigenBijdrage: p.own_contribution,
        },
        info,
        organisatie,
      };
    },

    slaBeoordelingOp: async (rij: Record<string, unknown>) => {
      const { data, error } = await admin.from(TELLING_TABEL.beoordelingen).insert(rij).select('id').single();

      if (error) {
        console.error('[aanvraag-assistent] opslaan_mislukt');

        return null;
      }

      return data?.id ? String(data.id) : null;
    },

    // Alleen publieke https-pagina's, via de veilige ophaalfunctie. Naar de gebruiker gaat alleen een grove reden, nooit de interne foutdetails.
    haalPagina: async (pagina: string) => {
      const r = await safeFetchPublicPage(pagina, { resolveHost, timeoutMs: 8000 });

      if (!r.ok) return { ok: false as const, reden: r.fout === 'forbidden_host' || r.fout === 'forbidden_ip' || r.fout === 'invalid_url' ? ('niet-toegestaan' as const) : ('niet-bereikbaar' as const) };

      const tekst = extractReadableText(r.tekst, r.contentType).text;

      return tekst.trim() ? { ok: true as const, tekst } : { ok: false as const, reden: 'niet-leesbaar' as const };
    },

    roep: async (systeem: string, gebruiker: string) => {
      const aanroep = async (metFormat: boolean) =>
        fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
          body: JSON.stringify({
            model: MODEL,
            input: [
              { role: 'developer', content: systeem },
              { role: 'user', content: gebruiker },
            ],
            max_output_tokens: MAX_OUTPUT_TOKENS,
            reasoning: { effort: 'low' },
            store: false,
            ...(metFormat ? { text: { format: { type: 'json_object' } } } : {}),
          }),
        });

      try {
        let res = await aanroep(true);

        // Wordt de JSON-modus voor dit model niet geaccepteerd, probeer dan één keer zonder: het antwoord wordt toch streng gelezen.
        if (res.status === 400) res = await aanroep(false);
        if (!res.ok) return null;

        const data = await res.json();

        if (data?.status === 'failed' || data?.status === 'incomplete') return null;

        return { inhoud: jsonUitTekst(leesTekst(data)), usage: data?.usage };
      } catch (_e) {
        return null;
      }
    },

    // Nooit inhoud: alleen tellers, duur, model en tier (zie gebruikLog.ts).
    meldGebruik: async (m: any) => {
      await legGebruik(admin, { ...m });
    },
  };

  const bodyText = await req.text();
  const uit = await verwerk({ method: req.method, authorization: req.headers.get('Authorization') || '', bodyText }, deps as any);

  return antwoord(uit.status, uit.body, uit.headers ?? {});
});
