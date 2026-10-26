// Een nagebootste server met de ECHTE serverregels (aanvraagHandler.ts), een nagebootst model en een geheugendatabase. Voor de schermtests en het voorbeeld.
import { verwerk } from '../../supabase/functions/_shared/aanvraagHandler.ts';

export const USER = '11111111-1111-4111-8111-111111111111';
export const PROJECT = '33333333-3333-4333-8333-333333333333';
export const NU = new Date('2026-10-19T12:00:00Z');
export const RICHTLIJN = 'De aanvraag moet een projectbegroting bevatten. Het project dient binnen twaalf maanden te starten.';
export const AANVRAAG = 'Het project Samen Spelen start in januari 2027 en loopt twaalf maanden. Wij richten ons op kinderen van 6 tot 12 jaar in Rotterdam-Zuid. Onze aanpak bestaat uit wekelijkse sportlessen en een zomerkamp. De organisatie bestaat sinds 2015 en heeft de ANBI-status. Een overzicht van de kosten staat in bijlage twee.';
export const FORMULIER = `1. Beschrijf de aanleiding en het doel van uw project (maximaal 1500 tekens)
2. Wie is de doelgroep?
3. Hoe wordt het project na afloop voortgezet?
Bijlagen: een aanbevelingsbrief van de gemeente.`;
export const PLANBRON = {
  project: { naam: 'Samen Spelen', omschrijving: 'Sport en spel voor kinderen in Rotterdam-Zuid.', doelgroep: 'Kinderen van 6 tot 12 jaar', doelstellingen: 'Kinderen bewegen meer en leren samenwerken.', activiteiten: 'Wekelijkse sportlessen en een zomerkamp.', begroting: 40000, gevraagd: 25000, regio: 'Rotterdam-Zuid', impact: 'Kinderen bewegen meer.', planning: 'Januari tot en met december 2027.' },
  info: { aanleiding: 'In de wijk zijn weinig plekken om veilig te spelen.', borging: 'De gemeente neemt de lessen na twee jaar over.' },
  organisatie: { name: 'Stichting Samen Spelen', rechtsvorm: 'stichting', opgericht: 2015, mission: 'Elk kind verdient een plek om te spelen.' },
};


// ── Een server met de echte regels en een geheugendatabase ──────────────────────────────────────────────────────────────────────────────
export function maakServer(o = {}) {
  const s = { aanroepen: [], gebruik: [], planProjecten: new Set(), planIds: new Map(), tabel: new Map(), beoordelingen: new Map(), opties: { vlag: true, tier: 'pro', pagina: { ok: true, tekst: RICHTLIJN }, ...o } };
  const maand = (soort) => s.gebruik.filter((x) => x.succes && x.actie === soort).length;
  const deps = {
    modelNaam: 'test', nu: () => NU, vlagAan: () => s.opties.vlag,
    userUitToken: async (t) => (t === 'goed' ? { id: USER } : null),
    leesBegrotingStand: async () => ({ regels: s.opties.standRegels ?? null, eigenBijdrage: 2000, financiering: s.opties.financieringNull ? null : [{ id: 'a', program_id: 'p', bron_type: 'financier', bron_status: 'zichtbaar', bron_naam: 'Fonds A', requested_amount: 5000, awarded_amount: 5000, status: 'awarded' }, { id: 'b', program_id: 'p', bron_type: 'financier', bron_status: 'zichtbaar', bron_naam: 'Fonds B', requested_amount: 4000, awarded_amount: null, status: 'submitted' }, { id: 'c', program_id: 'p', bron_type: 'financier', bron_status: 'zichtbaar', bron_naam: 'Fonds C', requested_amount: 3000, awarded_amount: null, status: 'preparing' }] }),
    leesProfiel: async () => ({ profiel: { subscription_tier: s.opties.tier, subscription_active: s.opties.tier !== 'free', trial_ends_at: null, role: 'user' }, storing: false }),
    rateLimitOk: async () => true,
    projectIsVanGebruiker: async (p, u) => p === PROJECT && u === USER,
    telRijen: async (u, soort) => (soort === 'beoordelingen' ? s.beoordelingen.size : soort === 'plannen' ? maand('aanvraag_plan') : maand('aanvraag_eisen')),
    reserveer: async (u, soort, limiet) => {
      const g = soort === 'beoordelingen' ? s.beoordelingen.size : maand('aanvraag_eisen');
      return g >= limiet ? { ok: false, reden: 'maand-op', gebruikt: g } : { ok: true, id: `rr000000-0000-4000-8000-${String(s.aanroepen.length).padStart(12, '0')}`, gebruikt: g };
    },
    planStand: async (u, p) => ({ gebruikt: s.planProjecten.size, projectKlaar: p ? s.planProjecten.has(p) : false }),
    planReserveer: async (u, p, limiet) => {
      if (s.planProjecten.has(p)) return { ok: false, reden: 'al-geschreven', gebruikt: s.planProjecten.size };
      if (s.planProjecten.size >= limiet) return { ok: false, reden: 'plan-limiet', gebruikt: s.planProjecten.size };
      const id = `pp000000-0000-4000-8000-${String(s.planIds.size + 1).padStart(12, '0')}`;
      s.planIds.set(id, p);
      s.planProjecten.add(p);
      return { ok: true, id, gebruikt: s.planProjecten.size - 1 };
    },
    rondAf: async (id, u, succes) => { if (!succes && s.planIds.has(id)) s.planProjecten.delete(s.planIds.get(id)); },
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
        return { inhoud: JSON.stringify({ tekst: `${inv.feiten[0].tekst} [aanvullen: het aantal deelnemers]`, gebruikt: inv.feiten.map((f) => f.id), vragen: ['Hoeveel kinderen doen mee?'] }), usage: { prompt_tokens: 10, completion_tokens: 5 } };
      }
      if (/Je zet de tekst van een bestaande projectbegroting om/.test(systeem)) {
        s.laatsteUpload = gebruiker;
        return { inhoud: JSON.stringify({ regels: [
          { sectie: 'Uitvoering', kopje: 'uitvoering', omschrijving: 'Projectleider', aantal: 100, eenheid: 'uur', tarief: 50, bedrag: 5000, natura: false, schatting: false },
          { sectie: 'Uitvoering', kopje: 'uitvoering', omschrijving: 'Training vrijwilligers', aantal: null, tarief: null, bedrag: 2000, natura: false, schatting: false },
          { sectie: 'Activa', kopje: 'activa', omschrijving: 'Materiaal', aantal: 10, eenheid: 'stuk', tarief: 25, bedrag: 300, natura: false, schatting: false },
          { sectie: 'Locatie', kopje: 'eigen', eigenKopje: 'Locatie', omschrijving: 'Verzekering', aantal: null, tarief: null, bedrag: null, natura: false, schatting: false },
        ], totalen: [{ soort: 'subtotaal', sectie: 'Uitvoering', bedrag: 7000 }, { soort: 'subtotaal', sectie: 'Activa', bedrag: 250 }, { soort: 'totaal', sectie: '', bedrag: 9000 }] }), usage: { prompt_tokens: 1500, completion_tokens: 300 } };
      }
      if (/Je zet een gesprek over de begroting/.test(systeem)) {
        return { inhoud: JSON.stringify({ regels: [
          { kopje: 'uitvoering', omschrijving: 'Projectleider', aantal: 120, eenheid: 'uur', tarief: 45, bedrag: null, natura: false, schatting: false },
          { kopje: 'activa', omschrijving: 'Voedselpakketten', aantal: null, eenheid: 'pakket', tarief: null, bedrag: 2500, natura: false, schatting: true },
          { kopje: 'communicatie', omschrijving: 'Flyers', aantal: null, tarief: null, bedrag: null },
        ] }), usage: { prompt_tokens: 900, completion_tokens: 200 } };
      }
      if (/Je haalt uit de tekst van het aanvraagformulier/.test(systeem)) {
        s.vragenGelezen = (s.vragenGelezen || 0) + 1;
        return { inhoud: JSON.stringify(s.opties.vragenUit || {
          vragen: [
            { vraag: 'Beschrijf de aanleiding en het doel van uw project.', bronstuk: 'Beschrijf de aanleiding en het doel van uw project (maximaal 1500 tekens)', maxTekens: 1500 },
            { vraag: 'Wie is de doelgroep?', bronstuk: 'Wie is de doelgroep', maxTekens: null },
            { vraag: 'Hoe wordt het project na afloop voortgezet?', bronstuk: 'Hoe wordt het project na afloop voortgezet', maxTekens: null },
          ],
          stukken: [{ stuk: 'Aanbevelingsbrief van de gemeente', bronstuk: 'een aanbevelingsbrief van de gemeente', maxLeeftijdMaanden: null }],
        }), usage: { prompt_tokens: 20, completion_tokens: 10 } };
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

  // Versies (concept/definitief): een geheugenversie van de tabel, met dezelfde vorm als de echte opslag. Uit te zetten met { zonderVersies: true }.
  if (!s.opties.zonderVersies) {
    s.versies = new Map();
    let vteller = 0;
    const eigen = (u, id) => { const r = s.tabel.get(id); return r && r.user_id === u ? r : null; };

    Object.assign(deps, {
      leesVersieStand: async (u, id) => { const a = eigen(u, id); return a ? { id: a.id, soort: a.soort, status: a.status || 'concept', definitieve_versie_id: a.definitieve_versie_id || null } : null; },
      lijstVersies: async (u, id) => (eigen(u, id) ? [...s.versies.values()].filter((v) => v.aanvraag_id === id).map(({ antwoorden, ...rest }) => rest).sort((x, y) => y.nummer - x.nummer) : []),
      leesVersie: async (u, id) => { const v = s.versies.get(id); return v && v.user_id === u ? { ...v } : null; },
      maakVersie: async (rij) => {
        vteller += 1;
        const nummer = Math.max(0, ...[...s.versies.values()].filter((v) => v.aanvraag_id === rij.aanvraag_id).map((v) => v.nummer)) + 1;
        const v = { id: `99999999-9999-4999-8999-${String(vteller).padStart(12, '0')}`, aanvraag_id: rij.aanvraag_id, user_id: rij.user_id, nummer, naam: rij.naam, status: rij.status, herkomst: rij.herkomst, antwoorden: rij.antwoorden, beoordeling_id: null, created_at: '2026-10-26T10:00:00Z', updated_at: '2026-10-26T12:00:00Z' };
        s.versies.set(v.id, v);
        return { ...v };
      },
      werkVersieBij: async (u, id, velden) => { const v = s.versies.get(id); if (!v || v.user_id !== u) return false; Object.assign(v, velden); return true; },
      verwijderVersie: async (u, id) => { const v = s.versies.get(id); if (!v || v.user_id !== u) return false; s.versies.delete(id); return true; },
      zetAanvraagStatus: async (u, id, velden) => { const a = eigen(u, id); if (!a) return false; a.status = velden.status; if ('definitieve_versie_id' in velden) a.definitieve_versie_id = velden.definitieve_versie_id ?? null; return true; },
    });
  }

  // Vragenlijst en stukken van een formulier (bewaard op de aanvraag). Uit te zetten met { zonderVragen: true }.
  if (!s.opties.zonderVragen) {
    const eigenRij = (u, id) => { const r = s.tabel.get(id); return r && r.user_id === u ? r : null; };

    Object.assign(deps, {
      leesVragenStand: async (u, id) => { const a = eigenRij(u, id); return a ? { id: a.id, program_id: a.program_id, soort: a.soort, fonds_label: a.fonds_label || '', criteria: a.criteria || [], vragen: a.vragen || null, stukken: a.stukken || null, schrijf_maand: a.schrijf_maand || null, schrijf_aantal: a.schrijf_aantal || 0 } : null; },
      bewaarVragenStukken: async (u, id, velden) => { const a = eigenRij(u, id); if (!a) return false; Object.assign(a, velden); return true; },
      lijstVoortgang: async (u, ids) => {
        const uit = {};

        for (const id of ids) {
          const a = eigenRij(u, id);

          if (!a) continue;

          const lijst = a.vragen && Array.isArray(a.vragen.lijst) ? a.vragen.lijst : [];
          const nieuwste = [...s.versies.values()].filter((v) => v.aanvraag_id === id).sort((x, y) => y.nummer - x.nummer)[0];
          const aantal = nieuwste ? nieuwste.antwoorden.filter((o) => lijst.some((v) => v.id === o.id) && String(o.tekst || '').replace(/\[aanvullen:[^\]]*\]/gi, '').trim().length > 0).length : 0;

          uit[id] = { status: a.status === 'definitief' ? 'definitief' : 'concept', aantalVragen: lijst.length, vragenBevestigd: Boolean(a.vragen && a.vragen.bevestigd), aantalAntwoorden: aantal, stukken: Array.isArray(a.stukken) ? a.stukken : [] };
        }

        return uit;
      },
    });
  }

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

