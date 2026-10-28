// Edge Function `aanvraag-assistent`: een aanvraag beoordelen tegen de eisen van een fonds (Pro en Premium). Aparte functie, zodat een deploy of fout
// hier de matching in `subsidie-kompas` nooit raakt. STANDAARD AAN voor Pro en Premium; alleen AANVRAAG_ASSISTENT=uit zet hem uit (noodrem).
//
// Alle logica staat in ../_shared/aanvraagHandler.ts (testbaar zonder netwerk). Dit bestand maakt alleen de echte verbindingen:
// Supabase (gebruiker, profiel, atomaire maandteller, opslag), OpenAI (Responses API) en het veilig ophalen van publieke websitepagina's.
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
const BEOORDELINGEN_TABEL = 'subsidie_kompas_aanvraag_beoordelingen';
const MAX_LIMIET = 1_000_000; // de database-functie neemt een gewoon getal; een onbegrensde (admin-)limiet wordt hier begrensd
const AANVRAGEN_TABEL = 'subsidie_kompas_aanvragen';
const VERSIES_TABEL = 'subsidie_kompas_aanvraag_versies';
const VERSIE_LIJST_KOLOMMEN = 'id, aanvraag_id, nummer, naam, status, herkomst, beoordeling_id, created_at, updated_at';
const VERSIE_KOLOMMEN = `${VERSIE_LIJST_KOLOMMEN}, antwoorden`;
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
  const { legGebruik, tokensUitUsage } = await import('../_shared/gebruikLog.ts');
  const { AFBEELDING_SYSTEEM } = await import('../_shared/aanvraagVragen.ts');
  const { safeFetchPublicPage } = await import('../_shared/safeFetch.ts');
  const { extractReadableText } = await import('../_shared/readableText.ts');
  const admin: any = createClient(url, serviceKey);

  // Het dekkingsplan van een project zoals het lid het ziet (zelfde functie en zichtbaarheid per abonnement als het scherm): alleen met het eigen token van het lid.
  const leesFinanciering = async (token: string | undefined, projectId: string): Promise<unknown[] | null> => {
    const anon = Deno.env.get('SUPABASE_ANON_KEY');

    if (!token || !anon) return null;

    try {
      const alsLid: any = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const { data: rijen, error: fe } = await alsLid.rpc('kompas_dekkingsplan', { p_program_id: projectId });

      return !fe && Array.isArray(rijen) ? rijen : null;
    } catch (_e) {
      return null;
    }
  };

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

    // Telt wat deze maand meetelt (afgerond, of een verse reservering) uit de eigen verbruikstabel van het account. Niet te lezen = null: de handler weigert dan (fail closed).
    telRijen: async (userId: string, soort: 'beoordelingen' | 'eisen' | 'plannen', sindsIso: string) => {
      const { data, error } = await admin.rpc('aanvraag_verbruik_tel', { p_user: userId, p_soort: soort, p_sinds: sindsIso });

      return error || typeof data !== 'number' ? null : data;
    },

    // Controleert de maandgrens en reserveert in één database-stap (slot per gebruiker): twee gelijktijdige verzoeken komen er niet allebei door.
    reserveer: async (userId: string, soort: 'beoordelingen' | 'eisen' | 'plannen', limiet: number, sindsIso: string) => {
      const p_limiet = Number.isFinite(limiet) ? Math.max(0, Math.min(Math.floor(limiet), MAX_LIMIET)) : MAX_LIMIET;
      const { data, error } = await admin.rpc('aanvraag_verbruik_reserveer', { p_user: userId, p_soort: soort, p_limiet, p_sinds: sindsIso });

      if (error || !data || typeof data !== 'object') return { ok: false as const, reden: 'storing' as const };

      const gebruikt = Number(data.gebruikt) || 0;

      if (data.ok === true && typeof data.id === 'string') return { ok: true as const, id: data.id, gebruikt };

      return { ok: false as const, reden: data.reden === 'te-veel-mislukt' ? ('te-veel-mislukt' as const) : ('maand-op' as const), gebruikt };
    },

    // Stand van de projectplannen: hoeveel verschillende projecten hebben (in het rollende jaar) een geschreven plan, en is dit project al geschreven?
    planStand: async (userId: string, projectId: string | null, sindsIso: string) => {
      const { data, error } = await admin.rpc('aanvraag_plan_stand', { p_user: userId, p_project: projectId, p_sinds: sindsIso });

      if (error || !data || typeof data !== 'object' || typeof data.gebruikt !== 'number') return null;

      return { gebruikt: data.gebruikt, projectKlaar: data.project_klaar === true };
    },

    // Reserveert het plan van dit project in één database-stap: één keer per project, en niet meer projecten dan het abonnement toestaat.
    planReserveer: async (userId: string, projectId: string, limiet: number, sindsIso: string) => {
      const p_limiet = Number.isFinite(limiet) ? Math.max(0, Math.min(Math.floor(limiet), MAX_LIMIET)) : MAX_LIMIET;
      const { data, error } = await admin.rpc('aanvraag_plan_reserveer', { p_user: userId, p_project: projectId, p_limiet, p_sinds: sindsIso });

      if (error || !data || typeof data !== 'object') return { ok: false as const, reden: 'storing' as const };

      const gebruikt = Number(data.gebruikt) || 0;

      if (data.ok === true && typeof data.id === 'string') return { ok: true as const, id: data.id, gebruikt };

      const reden = data.reden === 'al-geschreven' ? ('al-geschreven' as const) : data.reden === 'te-veel-mislukt' ? ('te-veel-mislukt' as const) : ('plan-limiet' as const);

      return { ok: false as const, reden, gebruikt };
    },

    // Rondt de reservering af. Lukt dat niet, dan blijft de reservering 10 minuten meetellen en daarna niet meer; het lid merkt niets.
    rondAf: async (reserveringId: string, userId: string, succes: boolean) => {
      try {
        const { error } = await admin.rpc('aanvraag_verbruik_rond_af', { p_id: reserveringId, p_user: userId, p_succes: succes });

        if (error) console.error('[aanvraag-assistent] rond_af_mislukt');
      } catch (_e) {
        console.error('[aanvraag-assistent] rond_af_fout');
      }
    },

    // Aanvragen: alleen via deze functie (service role), altijd gefilterd op de gebruiker uit het token.
    lijstAanvragen: async (userId: string, projectId: string) => {
      const { data, error } = await admin.from(AANVRAGEN_TABEL).select(AANVRAAG_KOLOMMEN).eq('user_id', userId).eq('program_id', projectId).order('updated_at', { ascending: false }).limit(100);

      return error ? null : data ?? [];
    },

    // Voor de kaart per fonds: hoeveel vragen, of de lijst is bevestigd, hoeveel antwoorden in de nieuwste versie staan en de lijst met stukken. Geen teksten.
    // Bestaan de kolommen nog niet (de migratie is nog niet gedraaid), dan geeft dit null en blijft de kaart zoals voorheen.
    lijstVoortgang: async (userId: string, aanvraagIds: string[]) => {
      const { data, error } = await admin.from(AANVRAGEN_TABEL).select('id, status, vragen, stukken').eq('user_id', userId).in('id', aanvraagIds.slice(0, 100));

      if (error || !data) return null;

      const uit: Record<string, unknown> = {};

      await Promise.all(
        data.map(async (r: any) => {
          const lijst: any[] = r.vragen && Array.isArray(r.vragen.lijst) ? r.vragen.lijst : [];
          const ids = new Set(lijst.map((v) => String(v?.id)));
          let aantalAntwoorden = 0;

          if (lijst.length) {
            const { data: v } = await admin.from(VERSIES_TABEL).select('antwoorden').eq('aanvraag_id', r.id).eq('user_id', userId).order('nummer', { ascending: false }).limit(1).maybeSingle();
            const a: any[] = v && Array.isArray(v.antwoorden) ? v.antwoorden : [];

            aantalAntwoorden = a.filter((o) => ids.has(String(o?.id)) && String(o?.tekst ?? '').replace(/\[aanvullen:[^\]]*\]/gi, '').trim().length > 0).length;
          }

          uit[r.id] = {
            status: r.status === 'definitief' ? 'definitief' : 'concept',
            aantalVragen: lijst.length,
            vragenBevestigd: Boolean(r.vragen && r.vragen.bevestigd),
            aantalAntwoorden,
            stukken: (Array.isArray(r.stukken) ? r.stukken : []).slice(0, 40).map((s: any) => ({
              id: String(s?.id ?? ''),
              tekst: String(s?.tekst ?? '').slice(0, 200),
              bron: s?.bron,
              sleutel: s?.sleutel ?? null,
              maxLeeftijdMaanden: s?.maxLeeftijdMaanden ?? null,
              nietVanToepassing: Boolean(s?.nietVanToepassing),
              klaar: Boolean(s?.klaar),
              documentNaam: String(s?.documentNaam ?? '').slice(0, 200),
            })),
          };
        }),
      );

      return uit;
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

    // Formulier: de vragen met hun tekenlimiet en de lijst met stukken van één aanvraag. Alleen via deze functie, altijd gefilterd op de gebruiker uit het token.
    // Het formulier zelf wordt niet bewaard, en er wordt nooit iets van de tekst gelogd.
    leesVragenStand: async (userId: string, aanvraagId: string) => {
      const { data, error } = await admin.from(AANVRAGEN_TABEL).select('id, program_id, soort, fonds_label, criteria, vragen, stukken, schrijf_maand, schrijf_aantal').eq('id', aanvraagId).eq('user_id', userId).maybeSingle();

      if (error) return 'storing' as const;

      return data ? { ...data, schrijf_aantal: Number(data.schrijf_aantal) || 0 } : null;
    },

    bewaarVragenStukken: async (userId: string, aanvraagId: string, velden: Record<string, unknown>) => {
      const { error } = await admin.from(AANVRAGEN_TABEL).update({ ...velden, updated_at: new Date().toISOString() }).eq('id', aanvraagId).eq('user_id', userId);

      return !error;
    },

    // Versiebeheer: alleen via deze functie (service role), altijd gefilterd op de gebruiker uit het token. Er wordt nooit iets van de tekst gelogd.
    leesVersieStand: async (userId: string, aanvraagId: string) => {
      const { data, error } = await admin.from(AANVRAGEN_TABEL).select('id, soort, status, definitieve_versie_id').eq('id', aanvraagId).eq('user_id', userId).maybeSingle();

      if (error) return 'storing' as const;

      return data ?? null;
    },

    lijstVersies: async (userId: string, aanvraagId: string) => {
      const { data, error } = await admin.from(VERSIES_TABEL).select(VERSIE_LIJST_KOLOMMEN).eq('aanvraag_id', aanvraagId).eq('user_id', userId).order('nummer', { ascending: false }).limit(50);

      return error ? null : data ?? [];
    },

    leesVersie: async (userId: string, versieId: string) => {
      const { data, error } = await admin.from(VERSIES_TABEL).select(VERSIE_KOLOMMEN).eq('id', versieId).eq('user_id', userId).maybeSingle();

      if (error) return 'storing' as const;

      return data ?? null;
    },

    // Het volgende nummer is het hoogste nummer plus één; de unieke sleutel (aanvraag, nummer) vangt twee gelijktijdige verzoeken op, dan proberen we het opnieuw.
    maakVersie: async (rij: Record<string, unknown>) => {
      for (let poging = 0; poging < 3; poging += 1) {
        const { data: laatste, error: leesFout } = await admin.from(VERSIES_TABEL).select('nummer').eq('aanvraag_id', rij.aanvraag_id).order('nummer', { ascending: false }).limit(1);

        if (leesFout) return null;

        const nummer = (laatste && laatste[0] ? Number(laatste[0].nummer) : 0) + 1;
        const { data, error } = await admin.from(VERSIES_TABEL).insert({ ...rij, nummer }).select(VERSIE_LIJST_KOLOMMEN).single();

        if (!error) return data;
        if (error.code !== '23505') {
          console.error('[aanvraag-assistent] versie_opslaan_mislukt');

          return null;
        }
      }

      return null;
    },

    werkVersieBij: async (userId: string, versieId: string, velden: Record<string, unknown>) => {
      const { error } = await admin.from(VERSIES_TABEL).update(velden).eq('id', versieId).eq('user_id', userId);

      if (error) console.error('[aanvraag-assistent] versie_bijwerken_mislukt');

      return !error;
    },

    verwijderVersie: async (userId: string, versieId: string) => {
      const { error } = await admin.from(VERSIES_TABEL).delete().eq('id', versieId).eq('user_id', userId);

      if (error) console.error('[aanvraag-assistent] versie_verwijderen_mislukt');

      return !error;
    },

    zetAanvraagStatus: async (userId: string, aanvraagId: string, velden: Record<string, unknown>) => {
      const { error } = await admin.from(AANVRAGEN_TABEL).update(velden).eq('id', aanvraagId).eq('user_id', userId);

      if (error) console.error('[aanvraag-assistent] aanvraagstatus_mislukt');

      return !error;
    },

    // Wat het plan van dit lid weet: het project (alleen eigen, niet gearchiveerd), de Projectdocumentatie en het organisatieprofiel.
    leesPlanBron: async (userId: string, projectId: string, token?: string) => {
      const { data: p, error: pe } = await admin.from('subsidie_kompas_programs').select('*').eq('id', projectId).eq('user_id', userId).is('archived_at', null).maybeSingle();

      if (pe || !p) return null;

      const { data: o } = await admin.from('subsidie_kompas_organizations').select('*').eq('user_id', userId).maybeSingle();
      const organisatie: Record<string, unknown> = {};

      if (o) {
        for (const [kolom, veld] of Object.entries(ORGANISATIE_KOLOM_NAAR_VELD)) organisatie[veld] = o[kolom];
      }

      const planning = String(p.planning || '').trim() || [p.period_start ? `vanaf ${p.period_start}` : '', p.period_end ? `tot ${p.period_end}` : ''].filter(Boolean).join(' ');
      const info = p.project_info && typeof p.project_info === 'object' && p.project_info.velden && typeof p.project_info.velden === 'object' ? p.project_info.velden : {};

      // Het actuele dekkingsplan, precies zoals het lid het ziet; lukt dit niet, dan blijft het weg uit de feiten en wordt de tekst er niet door geblokkeerd.
      const financiering = await leesFinanciering(token, projectId);

      // De documenten van het lid: de projectdocumenten (niet vervangen) en de organisatiedocumenten, met de tekst die er bij het uploaden uit is gehaald.
      // De begroting en het concept-dekkingsplan als bestand slaan we over: de actuele begroting en het dekkingsplan staan hierboven al, en die zijn leidend.
      // Lukt het lezen niet, dan gaat het schrijven gewoon verder zonder documenten.
      const documenten: Array<{ naam: string; soort: string; van: 'project' | 'organisatie'; tekst: string }> = [];

      try {
        const { data: pd } = await admin
          .from('subsidie_kompas_knowledge_items')
          .select('file_name, title, doc_type, extracted_text, created_at')
          .eq('user_id', userId)
          .eq('program_id', projectId)
          .is('superseded_at', null)
          .not('extracted_text', 'is', null)
          .order('created_at', { ascending: false })
          .limit(12);

        for (const d of pd ?? []) {
          if (d.doc_type === 'Begroting' || d.doc_type === 'Concept-dekkingsplan') continue;
          if (String(d.extracted_text ?? '').trim().length < 80) continue;

          documenten.push({ naam: String(d.title || d.file_name || 'Document'), soort: String(d.doc_type || ''), van: 'project', tekst: String(d.extracted_text) });
        }

        const { data: od } = await admin
          .from('subsidie_kompas_knowledge_items')
          .select('file_name, title, doc_type, extracted_text, created_at')
          .eq('user_id', userId)
          .is('program_id', null)
          .not('extracted_text', 'is', null)
          .order('created_at', { ascending: false })
          .limit(8);

        for (const d of od ?? []) {
          if (String(d.extracted_text ?? '').trim().length < 80) continue;

          documenten.push({ naam: String(d.title || d.file_name || 'Document'), soort: String(d.doc_type || ''), van: 'organisatie', tekst: String(d.extracted_text) });
        }
      } catch (_e) {
        console.error('[aanvraag-assistent] documenten_lezen_mislukt');
      }

      return {
        begroting: p.budget_lines ?? null,
        financiering,
        documenten,
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

    leesBegrotingStand: async (userId: string, projectId: string, token: string) => {
      const { data: p, error } = await admin.from('subsidie_kompas_programs').select('budget_lines, own_contribution').eq('id', projectId).eq('user_id', userId).maybeSingle();

      if (error || !p) return null;

      return { regels: p.budget_lines ?? null, eigenBijdrage: p.own_contribution, financiering: await leesFinanciering(token, projectId) };
    },

    slaBeoordelingOp: async (rij: Record<string, unknown>) => {
      const { data, error } = await admin.from(BEOORDELINGEN_TABEL).insert(rij).select('id').single();

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

        // De Responses API geeft input_tokens/output_tokens; de handler rekent met prompt_tokens/completion_tokens. Hier vertalen, anders blijft alles op 0.
        const tokens = tokensUitUsage(data?.usage);

        return { inhoud: jsonUitTekst(leesTekst(data)), usage: { prompt_tokens: tokens.input, completion_tokens: tokens.output } };
      } catch (_e) {
        return null;
      }
    },

    // Een formulier uit afbeeldingen (screenshot, foto, scan) letterlijk overtypen. De afbeeldingen komen uit de browser (al verkleind), worden hier alleen doorgegeven en niet bewaard (store: false).
    leesAfbeeldingen: async (afbeeldingen: string[]) => {
      try {
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
          body: JSON.stringify({
            model: MODEL,
            input: [
              { role: 'developer', content: AFBEELDING_SYSTEEM },
              { role: 'user', content: [{ type: 'input_text', text: 'Typ de tekst van deze afbeeldingen over.' }, ...afbeeldingen.map((a) => ({ type: 'input_image', image_url: a, detail: 'high' }))] },
            ],
            max_output_tokens: 8000,
            reasoning: { effort: 'low' },
            store: false,
          }),
        });

        if (!res.ok) return null;

        const data = await res.json();

        if (data?.status === 'failed' || data?.status === 'incomplete') return null;

        const tokens = tokensUitUsage(data?.usage);

        return { tekst: leesTekst(data), usage: { prompt_tokens: tokens.input, completion_tokens: tokens.output } };
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
