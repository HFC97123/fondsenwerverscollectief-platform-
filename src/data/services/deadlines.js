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

// ---------------------------------------------------------------------------
// Centrale weergave- en toegangsregels voor deadlinelijsten.
//
// Dit is de ENE plek die bepaalt: (a) of een regeling voor de huidige
// gebruiker vrij of vergrendeld is, (b) wat een klik op een kaart doet, en
// (c) in welke volgorde regelingen worden getoond zodat elke "pagina"
// (elke PAGE_SIZE-batch, zowel de eerste als elke volgende via "Meer
// laden") altijd met FREE_SLOTS_PER_PAGE volledig zichtbare regelingen
// begint. Een deadlinepagina moet deze functies gebruiken in plaats van
// zelf `row.volledigZichtbaar` te interpreteren of een eigen klikregel te
// verzinnen — zo kan dit niet meer per component uit elkaar gaan lopen.
//
// De daadwerkelijke beveiliging (welke velden gevuld zijn) gebeurt al in de
// database-view zelf (zie de module-toelichting hierboven); deze functies
// bepalen alleen presentatie/volgorde/klikgedrag bovenop wat de view al
// veilig heeft teruggegeven.

// Aantal regelingen per "pagina": de eerste batch (limit-startwaarde) en
// elke volgende batch die "Meer regelingen laden" toevoegt. Eén constante
// voor beide, zodat de garantie hieronder nooit stilletjes uit de pas kan
// gaan lopen met de paginagrootte die de pagina zelf gebruikt.
export const PAGE_SIZE = 12;

// Hoeveel van de eerste plekken van elke pagina gereserveerd zijn voor
// volledig zichtbare (gratis) regelingen.
export const FREE_SLOTS_PER_PAGE = 3;

// 'free' als de huidige gebruiker deze regeling volledig mag zien (de view
// heeft de velden al gevuld), anders 'premium'. Eén plek die dit onderscheid
// maakt; niets anders leest `row.volledigZichtbaar` rechtstreeks.
export function getDeadlineAccess(row) {
  return row && row.volledigZichtbaar ? 'free' : 'premium';
}

// Wat een klik op een kaart moet doen: de bestaande detailkaart voor
// volledig zichtbare regelingen, een upgradekaart voor vergrendelde.
// Bewust twee verschillende acties (nooit dezelfde modal) zodat de
// gebruiker meteen begrijpt waarom de ervaring verschilt.
export function getDeadlineClickAction(row) {
  return getDeadlineAccess(row) === 'free' ? 'detail' : 'upgrade';
}

// Bepaalt de weergavevolgorde voor de huidige toegang, bovenop de
// bestaande inhoudelijke sortering (die blijft leidend). De regel: elke
// pagina van PAGE_SIZE regelingen begint met FREE_SLOTS_PER_PAGE volledig
// zichtbare regelingen. Een vergrendelde regeling die daardoor in zo'n
// gereserveerde plek zou vallen, schuift alleen zo ver naar beneden als
// nodig is (tot de eerstvolgende niet-gereserveerde plek) en komt daar
// direct weer terug — verder blijft de volgorde ongewijzigd. Raakt de
// voorraad vrije regelingen op, dan wordt niets kunstmatig vrijgegeven: de
// gereserveerde plekken worden dan gewoon gevuld met wat er nog is.
//
// Voor Premium (bypass: true) is dit een no-op — Premium-gebruikers zien
// de oorspronkelijke ranking. In de praktijk is dit toch al vanzelf het
// geval (de view geeft Premium-gebruikers alles als volledig zichtbaar
// terug, dus er valt niets te verschuiven), maar de expliciete bypass
// maakt dat onafhankelijk van wat de database ooit teruggeeft, en
// scheelt de doorloop hieronder.
export function buildDeadlineDisplayOrder(sortedRows, { bypass = false, pageSize = PAGE_SIZE, freeSlotsPerPage = FREE_SLOTS_PER_PAGE } = {}) {
  const rows = sortedRows || [];

  if (bypass || rows.length === 0) {
    return rows;
  }

  const output = [];
  const holdback = []; // vergrendelde regelingen die uit een gereserveerde plek zijn geschoven
  let i = 0;
  const n = rows.length;

  while (output.length < n) {
    const windowPos = output.length % pageSize;
    const isReservedFreeSlot = windowPos < freeSlotsPerPage;

    if (isReservedFreeSlot) {
      let geplaatst = false;

      while (i < n) {
        const row = rows[i];
        i += 1;

        if (getDeadlineAccess(row) === 'free') {
          output.push(row);
          geplaatst = true;
          break;
        }

        holdback.push(row);
      }

      if (!geplaatst && holdback.length) {
        // Geen vrije regelingen meer over: niets kunstmatig vrijgeven, gewoon
        // de eerstvolgende (vergrendelde) regeling tonen.
        output.push(holdback.shift());
      }
    } else if (holdback.length) {
      // Zo hoog mogelijk terugplaatsen: de eerste kans na de gereserveerde
      // plekken van deze pagina.
      output.push(holdback.shift());
    } else if (i < n) {
      output.push(rows[i]);
      i += 1;
    }
  }

  return output;
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
