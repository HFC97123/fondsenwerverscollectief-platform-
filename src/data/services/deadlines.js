// Subsidieregelingen en hun deadlines.
// Bron: de view `subsidieregelingen_deadlines`. Die view leest de bestaande
// tabellen subsidieregelingen/funders, en dwingt de toegangsregels
// (Free/Pro/Premium/Admin) zelf al af op basis van `data_tier` en de
// ingelogde gebruiker (current_user_has_pro_access / current_user_has_premium_access).
// Velden die een gebruiker niet mag zien (exacte deadline, bedrag,
// voorwaarden, naam/website van de fondsverstrekker) komen als `null` terug
// uit de database zelf — dit bestand voegt geen eigen beveiliging toe en mag
// dat ook niet doen. Zie data/SCHEMA.md.
import { query, supabase } from '../client.js';

export const SELECT = [
  'id, naam, thema, data_tier, source_type, status, status_ruw,',
  'volledig_zichtbaar, deadline_datum, dagen_resterend, deadline_periode,',
  'bedrag_min, bedrag_max, voorwaarden, funder_naam, funder_website, funder_type',
].join(' ');

export const STATUS_ORDER = [
  'Open',
  'Binnenkort',
  'Doorlopend',
  'Aangekondigd',
  'Budget uitgeput',
  'Gesloten',
];

// Brengt een rij uit de view naar de vorm die de pagina gebruikt.
export function normalize(row) {
  return {
    id: row.id,
    naam: row.naam || '—',
    funder: row.funder_naam || '—',
    funderType: row.funder_type || '',
    regio: 'Nederland',
    thema: row.thema || '',
    status: row.status || 'Open',
    deadline: row.deadline_datum || null,
    dagen: typeof row.dagen_resterend === 'number' ? row.dagen_resterend : null,
    bedragMin: row.bedrag_min ?? null,
    bedragMax: row.bedrag_max ?? null,
    omschrijving: '',
    voorwaarden: row.voorwaarden || '',
    url: row.funder_website || '',
    volledigZichtbaar: Boolean(row.volledig_zichtbaar),
    dataTier: row.data_tier || null,
    sourceType: row.source_type || null,
    periode: row.deadline_periode || null,
  };
}

export async function fetchDeadlines({ archief = false, limit = 200 } = {}) {
  const res = await query((sb) => {
    let q = sb.from('subsidieregelingen_deadlines').select(SELECT).limit(limit);

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
// niet beschikbaar is. De view zelf is niet realtime-abonneerbaar, dus we
// luisteren op de onderliggende tabel; de client haalt bij een wijziging
// opnieuw op via fetchDeadlines(), waarna de toegangsregels weer via de view lopen.
export function watchDeadlines(onChange) {
  if (!supabase || typeof supabase.channel !== 'function') {
    return null;
  }

  try {
    const channel = supabase
      .channel('sk-deadlines')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subsidieregelingen' }, onChange)
      .subscribe();

    return () => supabase.removeChannel(channel);
  } catch (e) {
    return null;
  }
}
