// Subsidieregelingen en hun deadlines.
// AANNAME: de tijdlijn staat in subsidieregelingen_tijdlijn met een relatie naar
// subsidieregelingen, en die naar funders, themas en regios. Zie data/SCHEMA.md.
// Wijkt uw schema af, pas dan alleen SELECT en normalize hieronder aan.
import { query, supabase } from '../client.js';

export const SELECT = [
  'id, status, deadline_datum, dagen_resterend,',
  'regeling:subsidieregelingen (',
  '  id, naam, bedrag_min, bedrag_max, omschrijving, voorwaarden, url,',
  '  funder:funders ( id, naam, type ),',
  '  themas:subsidieregeling_themas ( thema:themas ( naam ) ),',
  '  regios:subsidieregeling_regios ( regio:regios ( naam ) )',
  ')',
].join(' ');

export const STATUS_ORDER = [
  'Open',
  'Binnenkort',
  'Doorlopend',
  'Aangekondigd',
  'Budget uitgeput',
  'Gesloten',
];

// Brengt een rij uit de database naar de vorm die de pagina gebruikt.
export function normalize(row) {
  const reg = row.regeling || {};
  const funder = reg.funder || {};

  return {
    id: row.id,
    naam: reg.naam || '—',
    funder: funder.naam || '—',
    funderType: funder.type || '',
    regio: (reg.regios || []).map((x) => (x.regio || {}).naam).filter(Boolean)[0] || 'Nederland',
    thema: (reg.themas || []).map((x) => (x.thema || {}).naam).filter(Boolean)[0] || '',
    status: row.status || 'Open',
    deadline: row.deadline_datum || null,
    dagen: typeof row.dagen_resterend === 'number' ? row.dagen_resterend : null,
    bedragMin: reg.bedrag_min ?? null,
    bedragMax: reg.bedrag_max ?? null,
    omschrijving: reg.omschrijving || '',
    voorwaarden: reg.voorwaarden || '',
    url: reg.url || '',
  };
}

export async function fetchDeadlines({ archief = false, limit = 200 } = {}) {
  const res = await query((sb) => {
    let q = sb.from('subsidieregelingen_tijdlijn').select(SELECT).limit(limit);

    if (!archief) {
      q = q.neq('status', 'Gesloten');
    }

    return q;
  }, []);

  return {
    rows: (res.data || []).map(normalize),
    error: res.error,
    offline: res.offline,
  };
}

// Volgt wijzigingen live. Geeft een opzegfunctie terug, of null als realtime
// niet beschikbaar is.
export function watchDeadlines(onChange) {
  if (!supabase || typeof supabase.channel !== 'function') {
    return null;
  }

  try {
    const channel = supabase
      .channel('sk-deadlines')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subsidieregelingen_tijdlijn' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subsidieregelingen' }, onChange)
      .subscribe();

    return () => supabase.removeChannel(channel);
  } catch (e) {
    return null;
  }
}
