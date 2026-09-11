// Subsidieregelingen en hun deadlines.
// Bron: de view `subsidieregelingen_deadlines`. Die view leest de bestaande
// tabellen subsidieregelingen/funders, en dwingt de toegangsregels
// (Free/Pro/Premium/Admin) zelf al af op basis van `data_tier` en de
// ingelogde gebruiker (current_user_has_pro_access / current_user_has_premium_access).
// Velden die een gebruiker niet mag zien (exacte deadline, bedrag,
// voorwaarden, naam/website van de fondsverstrekker) komen als `null` terug
// uit de database zelf — dit bestand voegt geen eigen beveiliging toe en mag
// dat ook niet doen. Zie data/SCHEMA.md.
//
// themas_namen/doelgroepen_namen/werkgebieden_namen komen uit de centrale
// koppeltabellen (dezelfde disciplines/doelgroepen/werkgebieden als Beheer)
// — dit is de source of truth voor filters/matching, niet de losse
// thema/werkgebied-tekstvelden. Die tekstvelden blijven wel meekomen en
// dienen alleen nog als fallback voor regelingen die nog niet (volledig)
// aan de centrale lijsten gekoppeld zijn (zie normalize() hieronder).
import { query, supabase } from '../client.js';

export const SELECT = [
  'id, naam, thema, werkgebied, data_tier, source_type, status, status_ruw,',
  'volledig_zichtbaar, deadline_datum, dagen_resterend, deadline_periode,',
  'bedrag_min, bedrag_max, voorwaarden, funder_naam, funder_website, funder_type,',
  'themas_namen, doelgroepen_namen, werkgebieden_namen, bandbreedte_bijdrage_naam,',
  'beoordelingsdatum, beoordelingsperiode, rondes_aantal',
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
  const themasNamen = row.themas_namen || [];
  const doelgroepenNamen = row.doelgroepen_namen || [];
  const werkgebiedenNamen = row.werkgebieden_namen || [];

  return {
    id: row.id,
    naam: row.naam || '—',
    funder: row.funder_naam || '—',
    funderType: row.funder_type || '',
    // Voorkeur voor de centrale koppeling; valt terug op het oude
    // vrije-tekstveld zolang een regeling nog niet (volledig) geclassificeerd
    // is via Beheer → Classificaties. Zo blijft de weergave altijd gevuld,
    // zonder dat er ergens een eigen tweede lijst nodig is.
    regio: werkgebiedenNamen.length ? werkgebiedenNamen.join(', ') : row.werkgebied || 'Landelijk',
    thema: themasNamen.length ? themasNamen.join(', ') : row.thema || '',
    themasNamen,
    doelgroepenNamen,
    werkgebiedenNamen,
    bandbreedteBijdrage: row.bandbreedte_bijdrage_naam || null,
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
    // Meerdere aanvraagrondes: alleen gevuld wanneer deze regeling rondes
    // heeft (rondes_aantal > 0) én de eerstvolgende ronde nog geldig is —
    // dezelfde eerstvolgende-ronde die ook `deadline` hierboven bepaalt.
    // Voor niet-volledig-zichtbare regelingen komt dit al als null terug uit
    // de view zelf, net als de andere vergrendelde velden.
    beoordelingsdatum: row.beoordelingsdatum || null,
    beoordelingsperiode: row.beoordelingsperiode || null,
    rondesAantal: typeof row.rondes_aantal === 'number' ? row.rondes_aantal : 0,
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

// Funder-brede datamomenten (geen regelingkoppeling — de deadline geldt voor
// het hele fonds). Bron: de view `funder_deadlines`, zelfde architectuur en
// zelfde toegangsregels (Free/Pro/Premium/Admin) als subsidieregelingen_deadlines
// hierboven, alleen dan tegen de eigen access_tier/data_tier/source_type van
// de Funder in plaats van de subsidieregeling — geen tweede rechtenmodel.
// Een datamoment is óf funder-breed óf regeling-specifiek (nooit beide), dus
// deze rijen en die van fetchDeadlines() overlappen per constructie nooit:
// geen aparte deduplicatie nodig.
export const FUNDER_SELECT = [
  'id, funder_id, funder_naam, funder_type, datamoment_type, datamoment_naam,',
  'data_tier, source_type, volledig_zichtbaar, deadline_datum, dagen_resterend,',
  'deadline_periode, sluitingstijd, toelichting, bron_url, funder_website, missie,',
  'aanvraagcriteria, bijdrage_min, bijdrage_max, bandbreedte_bijdrage_naam,',
  'themas_namen, doelgroepen_namen, werkgebieden_namen',
].join(' ');

// Brengt een rij uit funder_deadlines naar dezelfde vorm als normalize()
// hierboven, zodat de Deadlines-pagina beide bronnen door elkaar (gesorteerd
// op deadline) kan tonen zonder daar zelf onderscheid in te hoeven maken.
// funder_naam is hier de "titel" van de kaart (er is geen aparte
// regelingnaam) en blijft daarom, anders dan bij subsidieregelingen_deadlines,
// altijd gevuld — precies zoals de database-view het al teruggeeft.
export function normalizeFunderDeadline(row) {
  const themasNamen = row.themas_namen || [];
  const doelgroepenNamen = row.doelgroepen_namen || [];
  const werkgebiedenNamen = row.werkgebieden_namen || [];

  return {
    id: row.id,
    bronType: 'funder',
    naam: row.funder_naam || '—',
    funder: row.funder_naam || '—',
    funderType: row.funder_type || '',
    regio: werkgebiedenNamen.length ? werkgebiedenNamen.join(', ') : 'Landelijk',
    thema: themasNamen.length ? themasNamen.join(', ') : '',
    themasNamen,
    doelgroepenNamen,
    werkgebiedenNamen,
    bandbreedteBijdrage: row.bandbreedte_bijdrage_naam || null,
    // Alleen actieve, nog niet verstreken datamomenten komen uit deze view
    // (zie funder_volgende_datamoment) — status is voor deze kaarten dus
    // altijd "Open", net als bij een regeling zonder expliciete status.
    status: 'Open',
    deadline: row.deadline_datum || null,
    dagen: typeof row.dagen_resterend === 'number' ? row.dagen_resterend : null,
    bedragMin: row.bijdrage_min ?? null,
    bedragMax: row.bijdrage_max ?? null,
    omschrijving: row.missie || '',
    voorwaarden: row.aanvraagcriteria || row.toelichting || '',
    url: row.bron_url || row.funder_website || '',
    volledigZichtbaar: Boolean(row.volledig_zichtbaar),
    dataTier: row.data_tier || null,
    sourceType: row.source_type || null,
    periode: row.deadline_periode || null,
    datamomentType: row.datamoment_type || null,
    datamomentNaam: row.datamoment_naam || null,
    toelichting: row.toelichting || '',
    funderWebsite: row.funder_website || '',
  };
}

export async function fetchFunderDeadlines({ limit = 200 } = {}) {
  const res = await query((sb) => sb.from('funder_deadlines').select(FUNDER_SELECT).limit(limit), []);

  return {
    rows: (res.data || []).map(normalizeFunderDeadline),
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
// volledig zichtbare (gratis) regelingen. Op expliciet verzoek verhoogd van
// 3 naar 5 (2026-09-11) — uitsluitend deze waarde wijzigt; het
// windowing-mechanisme in buildDeadlineDisplayOrder() hieronder (en dus de
// bestaande Free/Pro/Premium-toegangsregels, sortering en architectuur)
// blijft ongewijzigd.
export const FREE_SLOTS_PER_PAGE = 5;

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
// niet beschikbaar is. De views zelf zijn niet realtime-abonneerbaar, dus we
// luisteren op de onderliggende tabellen; de client haalt bij een wijziging
// opnieuw op via fetchDeadlines()/fetchFunderDeadlines(), waarna de
// toegangsregels weer via de views lopen. subsidieregeling_rondes moet hier
// ook bij: zodra een regeling aanvraagrondes heeft is die tabel de bron van
// de deadline, dus een toegevoegde/gewijzigde/verwijderde ronde in Beheer
// moet de Timeline net zo live bijwerken als een wijziging op
// subsidieregelingen/funders zelf.
export function watchDeadlines(onChange) {
  if (!supabase || typeof supabase.channel !== 'function') {
    return null;
  }

  try {
    const channel = supabase
      .channel('sk-deadlines')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subsidieregelingen' }, onChange)
      // subsidieregeling_rondes voedt zowel de regeling-specifieke deadline
      // (via subsidieregeling_volgende_ronde) als de funder-brede feed (via
      // funder_volgende_datamoment) — één abonnement voor beide.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subsidieregeling_rondes' }, onChange)
      // funders zelf, voor wijzigingen aan naam/toegangsniveau/classificatie
      // van een fonds met een funder-brede deadline.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'funders' }, onChange)
      .subscribe();

    return () => supabase.removeChannel(channel);
  } catch (e) {
    return null;
  }
}
