// Een nagebootste server met de ECHTE serverregels (aanvraagHandler.ts), een nagebootst model en een geheugendatabase. Voor de schermtests en het voorbeeld.
import { verwerk } from '../../supabase/functions/_shared/aanvraagHandler.ts';

export const USER = '11111111-1111-4111-8111-111111111111';
export const PROJECT = '33333333-3333-4333-8333-333333333333';
export const NU = new Date('2026-10-19T12:00:00Z');
export const RICHTLIJN = 'De aanvraag moet een projectbegroting bevatten. Het project dient binnen twaalf maanden te starten.';
export const AANVRAAG = 'Het project Samen Spelen start in januari 2027 en loopt twaalf maanden. Wij richten ons op kinderen van 6 tot 12 jaar in Rotterdam-Zuid. Onze aanpak bestaat uit wekelijkse sportlessen en een zomerkamp. De organisatie bestaat sinds 2015 en heeft de ANBI-status. Een overzicht van de kosten staat in bijlage twee.';
export const PLANBRON = {
  project: { naam: 'Samen Spelen', omschrijving: 'Sport en spel voor kinderen in Rotterdam-Zuid.', doelgroep: 'Kinderen van 6 tot 12 jaar', doelstellingen: 'Kinderen bewegen meer en leren samenwerken.', activiteiten: 'Wekelijkse sportlessen en een zomerkamp.', begroting: 40000, gevraagd: 25000 },
  info: { aanleiding: 'In de wijk zijn weinig plekken om veilig te spelen.' },
  organisatie: { name: 'Stichting Samen Spelen', rechtsvorm: 'stichting', opgericht: 2015 },
};


// ── Een server met de echte regels en een geheugendatabase ──────────────────────────────────────────────────────────────────────────────
export function maakServer(o = {}) {
  const s = { aanroepen: [], gebruik: [], tabel: new Map(), beoordelingen: new Map(), opties: { vlag: true, tier: 'pro', pagina: { ok: true, tekst: RICHTLIJN }, ...o } };
  const maand = (soort) => s.gebruik.filter((x) => x.succes && x.actie === soort).length;
  const deps = {
    modelNaam: 'test', nu: () => NU, vlagAan: () => s.opties.vlag,
    userUitToken: async (t) => (t === 'goed' ? { id: USER } : null),
    leesProfiel: async () => ({ profiel: { subscription_tier: s.opties.tier, subscription_active: s.opties.tier !== 'free', trial_ends_at: null, role: 'user' }, storing: false }),
    rateLimitOk: async () => true,
    projectIsVanGebruiker: async (p, u) => p === PROJECT && u === USER,
    telRijen: async (u, soort) => (soort === 'beoordelingen' ? s.beoordelingen.size : soort === 'plannen' ? maand('aanvraag_plan') : maand('aanvraag_eisen')),
    lijstAanvragen: async (u, p) => [...s.tabel.values()].filter((r) => r.user_id === u && r.program_id === p),
    leesAanvraag: async (u, id) => { const r = s.tabel.get(id); return r && r.user_id === u ? r : null; },
    bewaarAanvraag: async (rij) => {
      const bestaand = [...s.tabel.values()].find((r) => r.program_id === rij.program_id && r.soort === rij.soort && r.fonds_sleutel === rij.fonds_sleutel);
      const id = bestaand ? bestaand.id : `aa00000${s.tabel.size + 1}-0000-4000-8000-00000000000${s.tabel.size + 1}`;
      s.tabel.set(id, { created_at: '2026-10-19T10:00:00Z', updated_at: '2026-10-19T12:00:00Z', criteria: [], criteria_bron: null, bronnen: [], plan: null, plan_bijgewerkt_op: null, laatste_beoordeling_id: null, laatste_uitkomst: null, ...(bestaand || {}), ...rij, id });
      return id;
    },
    leesPlanBron: async () => s.opties.planBron || PLANBRON,
    slaBeoordelingOp: async (rij) => { const id = `bb00000${s.beoordelingen.size + 1}-0000-4000-8000-000000000001`; s.beoordelingen.set(id, { id, created_at: '2026-10-19T12:00:00Z', ...rij }); return id; },
    haalPagina: async (url) => { s.aanroepen.push(['pagina', url]); return s.opties.pagina; },
    roep: async (systeem, gebruiker) => {
      if (/Je schrijft één onderdeel/.test(systeem)) {
        const inv = JSON.parse(gebruiker);
        return { inhoud: JSON.stringify({ tekst: `${inv.feiten[0].tekst} Daarmee bereiken we 4500 kinderen. [aanvullen: het aantal deelnemers]`, gebruikt: inv.feiten.map((f) => f.id), vragen: ['Hoeveel kinderen doen mee?'] }), usage: { prompt_tokens: 10, completion_tokens: 5 } };
      }
      if (/Je haalt de eisen/.test(systeem)) {
        const bronnen = JSON.parse(gebruiker).bronnen;
        const waar = bronnen.find((b) => b.tekst.includes('moet een projectbegroting bevatten'))?.nummer ?? '1';
        return { inhoud: JSON.stringify({ eisen: [{ tekst: 'Een projectbegroting', soort: 'verplicht', gewicht: 3, bron: waar, bronstuk: 'moet een projectbegroting bevatten' }, { tekst: 'Start binnen twaalf maanden', soort: 'voorwaarde', gewicht: 2, bron: waar, bronstuk: 'dient binnen twaalf maanden te starten' }] }), usage: { prompt_tokens: 10, completion_tokens: 5 } };
      }
      const inv = JSON.parse(gebruiker);
      return { inhoud: JSON.stringify({ oordelen: inv.eisen.map((e, i) => (i === 0 ? { id: e.id, status: 'ontbreekt', citaat: '', verbetering: 'Voeg de begroting zelf toe' } : { id: e.id, status: 'gedekt', citaat: 'start in januari 2027 en loopt twaalf maanden', verbetering: '' })) }), usage: { prompt_tokens: 10, completion_tokens: 5 } };
    },
    meldGebruik: async (m) => { s.gebruik.push(m); },
  };

  const supabase = {
    functions: {
      invoke: async (naam, opties) => {
        s.aanroepen.push([naam, opties.body.mode]);
        const r = await verwerk({ method: 'POST', authorization: 'Bearer goed', bodyText: JSON.stringify(opties.body) }, deps);
        return r.status >= 200 && r.status < 300 ? { data: r.body, error: null } : { data: null, error: { context: { status: r.status, json: async () => r.body } } };
      },
    },
    from(tabel) {
      const q = { select: () => q, eq: () => q, is: () => q, maybeSingle: async () => ({ data: tabel === 'subsidie_kompas_aanvraag_beoordelingen' ? [...s.beoordelingen.values()][0] || null : null, error: null }) };
      return q;
    },
  };

  return { s, supabase };
}

