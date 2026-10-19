// Deadlines: chronologisch overzicht van actuele subsidieregelingen.
// Bron: subsidieregelingen_tijdlijn met joins naar subsidieregelingen, funders,
// themas en regios. Volgt wijzigingen live via Supabase realtime.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  PAGE_SIZE,
  buildDeadlineDisplayOrder,
  fetchDeadlines,
  fetchFunderDeadlines,
  getDeadlineAccess,
  getDeadlineClickAction,
  haalBronDetails,
  watchDeadlines,
} from '../../data/services/deadlines.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';
import { CSS_WERKPLEK, PaginaKop, Tabs, Zijpaneel } from '../../shared/ui/werkplek.jsx';
// Admin Inline Edit Mode: uitsluitend zichtbaar/actief voor app.isAdmin (zie
// verderop). Bestaande data-laadlogica hierboven (fetchDeadlines/
// fetchFunderDeadlines/watchDeadlines) blijft voor alle gebruikers ongewijzigd
// — dit component doet zijn eigen, aparte admin-only ophaal-/opslaanwerk pas
// zodra een beheerder een kaart daadwerkelijk uitklapt.
import AdminInlineEdit from './AdminInlineEdit.jsx';
import ProjectOpnemen from './deadlines/ProjectOpnemen.jsx';
import MijnDeadlines from './deadlines/MijnDeadlines.jsx';
import { ActieplanOverzicht } from './financiering/ActieplanBlok.jsx';
import { bronUitDeadlineRij } from './financiering/toevoegen.js';
import { kansrijkheid } from './financiering/kansrijkheid.js';

// Regelgebaseerde inschatting: discipline, werkgebied en omvang tegenover het profiel.
// Geen score met valse precisie, alleen wat wel en niet aansluit.
const STATUS_ORDER = ['Open', 'Binnenkort', 'Doorlopend', 'Aangekondigd', 'Budget uitgeput', 'Gesloten'];

const STATUS_STYLE = {
  Open: { bg: '#EAF4EE', color: '#2F6D47', border: '#CFE4D7' },
  Binnenkort: { bg: '#EAF1F6', color: '#2C4A5E', border: '#CFDFEA' },
  Doorlopend: { bg: '#F1EDF7', color: '#584277', border: '#DED4EC' },
  Aangekondigd: { bg: '#EEF1F0', color: '#5A6A66', border: '#DDE4E1' },
  'Budget uitgeput': { bg: '#FBF1E3', color: '#8A5A16', border: '#EEDCC0' },
  Gesloten: { bg: '#F9ECEA', color: '#9E3B2C', border: '#EDD3CE' },
};

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const DEADLINE_OPTIONS = [
  ['alle', 'Alle'],
  ['30', 'Binnen 30 dagen'],
  ['90', 'Binnen 90 dagen'],
  ['binnenkort', 'Binnenkort'],
  ['doorlopend', 'Doorlopend'],
  ['heel_jaar', 'Heel jaar'],
];


function daysLeft(row) {
  if (row.dagen != null) {
    return row.dagen;
  }

  if (!row.deadline) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((new Date(`${row.deadline}T00:00:00`) - today) / 86400000);
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);

  return `${d.getDate()} ${MAANDEN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function formatAmount(min, max) {
  const f = (n) => `€ ${Number(n).toLocaleString('nl-NL')}`;

  if (min && max) {
    return `${f(min)} – ${f(max)}`;
  }

  if (max) {
    return `Max. ${f(max)}`;
  }

  if (min) {
    return `Vanaf ${f(min)}`;
  }

  return '–';
}

function deadlinePredicate(value, statuses) {
  return (row) => {
    const d = daysLeft(row);

    if (value === '30') {
      return d != null && d >= 0 && d <= 30;
    }

    if (value === '90') {
      return d != null && d >= 0 && d <= 90;
    }

    if (value === 'binnenkort') {
      // Dynamisch: alle deadlines waarvan de indiendatum ligt tussen vandaag
      // en 5 kalendermaanden vanaf vandaag — herberekend bij elke
      // filterdoorloop op basis van de actuele datum (new Date()), dus geen
      // vast aantal dagen en geen hardcoded datum. Regelingen zonder
      // concrete deadline_datum (d == null) of met een datum in het
      // verleden (d < 0) vallen hier per definitie buiten.
      if (d == null || d < 0) {
        return false;
      }

      const vandaag = new Date();
      vandaag.setHours(0, 0, 0, 0);
      const grens = new Date(vandaag);
      grens.setMonth(grens.getMonth() + 5);
      const dagenTotGrens = Math.round((grens - vandaag) / 86400000);

      return d <= dagenTotGrens;
    }

    if (value === 'doorlopend') {
      return row.status === 'Doorlopend';
    }

    if (value === 'heel_jaar') {
      // Premium-only jaaroverzicht: alle regelingen met een concrete
      // deadline in het lopende kalenderjaar, toekomstig én al verstreken.
      // Doorlopende regelingen hebben doorgaans geen deadline_datum en
      // vallen hier vanzelf buiten, zonder de chronologische jaarweergave
      // te verstoren. Voor Free/Pro is row.deadline hier altijd null (de
      // view mast dit veld af zolang volledig_zichtbaar niet geldt), dus
      // deze tak levert voor hen sowieso nooit extra regelingen op.
      return (
        row.deadline != null &&
        new Date(`${row.deadline}T00:00:00`).getFullYear() === new Date().getFullYear()
      );
    }

    // 'alle': de standaard, chronologische hoofd-tijdlijn. Doorlopende,
    // aangekondigde en binnenkort-regelingen, regelingen zonder concrete
    // deadline en verlopen regelingen horen daar niet in thuis; ze blijven
    // bereikbaar via hun eigen, bestaande filter (de pil "Doorlopend"/
    // "Binnenkort", of het statusvinkje "Aangekondigd").
    if (
      row.status === 'Doorlopend' ||
      row.status === 'Aangekondigd' ||
      row.status === 'Binnenkort' ||
      d == null ||
      d < 0
    ) {
      return statuses.indexOf(row.status) !== -1;
    }

    return true;
  };
}

// Vult een rij uit de deadline-views aan met de details uit kompas_bron_details. De rij blijft leidend voor id, soort, status en
// deadline; de details vullen aan wat de view niet (of leeg) meegaf.
function metBronDetails(rij, extra) {
  if (!extra) return rij;

  const lijst = (eigen, ander) => (eigen && eigen.length ? eigen : ander && ander.length ? ander : eigen || []);

  return {
    ...rij,
    themasNamen: lijst(rij.themasNamen, extra.themasNamen),
    doelgroepenNamen: lijst(rij.doelgroepenNamen, extra.doelgroepenNamen),
    werkgebiedenNamen: lijst(rij.werkgebiedenNamen, extra.werkgebiedenNamen),
    bandbreedteBijdrage: rij.bandbreedteBijdrage || extra.bandbreedteBijdrage,
    bedragMin: rij.bedragMin ?? extra.bedragMin,
    bedragMax: rij.bedragMax ?? extra.bedragMax,
    omschrijving: extra.omschrijving || rij.omschrijving,
    voorwaarden: rij.voorwaarden || extra.voorwaarden,
    url: rij.url || extra.url,
    accessTier: rij.accessTier || extra.accessTier,
    aanvraag: extra.aanvraag || null,
  };
}

const AANVRAAG_VELDEN = [
  ['typeProjecten', 'Type projecten'],
  ['beoordelingscriteria', 'Beoordelingscriteria'],
  ['eigenBijdrage', 'Eigen bijdrage'],
  ['cofinanciering', 'Cofinanciering'],
  ['begrotingseisen', 'Begrotingseisen'],
  ['behandeltermijn', 'Behandeltermijn'],
  ['aanvraagprocedure', 'Aanvraagprocedure'],
  ['bijdrageToelichting', 'Over de bijdrage'],
];

export default function DeadlinesPage() {
  const app = useApp();
  const store = useKompas();
  const tier = app.subscriptionTier || 'free';
  const premium = tier === 'premium';
  const paid = tier === 'pro' || premium;
  // Pro/Premium: twee segmenten. Mijn deadlines (standaard) toont de deadlines uit de eigen projectfinanciering,
  // Alle regelingen is het bestaande marktoverzicht. Free ziet alleen het marktoverzicht, ongewijzigd.
  const [segment, setSegment] = useState('mijn');

  const [supaRows, setSupaRows] = useState([]);
  // Funder-brede datamomenten (geen regelingkoppeling) — aparte feed, eigen
  // toegangsregel op basis van de Funder zelf, maar door elkaar getoond met
  // supaRows hierboven (zie de rows-samenvoeging verderop).
  const [supaFunderRows, setSupaFunderRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [deadline, setDeadline] = useState('alle');
  const [statuses, setStatuses] = useState([]);
  const [thema, setThema] = useState('alle');
  const [type, setType] = useState('alle');
  const [regio, setRegio] = useState('alle');
  const [bandbreedte, setBandbreedte] = useState('alle');
  const [archief, setArchief] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [upgradeId, setUpgradeId] = useState(null);
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 900);
  // Admin Inline Edit Mode: welke ene kaart momenteel is uitgeklapt voor
  // bewerken (nooit meer dan één tegelijk). Alleen gelezen/gezet wanneer
  // app.isAdmin waar is — voor overige gebruikers blijft dit altijd null en
  // heeft het geen enkel effect op wat zij zien of welke data wordt geladen.
  const [expandedAdminId, setExpandedAdminId] = useState(null);

  useEffect(() => {
    const onResize = () => setDesktop(window.innerWidth >= 900);

    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = useCallback(
    async (silent) => {
      if (!silent) {
        setLoading(true);
      }

      setError(false);

      // Het Premium-only jaaroverzicht ("Heel jaar") toont ook al verstreken
      // en gesloten regelingen van het lopende kalenderjaar; daarvoor is
      // dezelfde archief-fetch nodig als bij het handmatige "Toon archief"-
      // vinkje, ongeacht of dat vinkje zelf aanstaat.
      const jaaroverzicht = deadline === 'heel_jaar';
      const [{ rows, error: fout, offline }, funderRes] = await Promise.all([
        fetchDeadlines({ archief: archief || jaaroverzicht }),
        // Funder-brede datamomenten kennen geen "gesloten"/archief-status
        // zoals regelingen (funder_deadlines geeft altijd alleen de
        // eerstvolgende, nog niet verstreken datum terug) — dus geen
        // archief-parameter nodig, het archiefvinkje is hier niet van
        // toepassing.
        fetchFunderDeadlines(),
      ]);

      setSupaRows(rows);
      setSupaFunderRows(funderRes.rows || []);
      setLoading(false);

      // Zonder verbinding is er geen fout te melden: de pagina toont dan wat
      // via Beheer is toegevoegd, of de lege staat.
      setError(Boolean(fout) && !offline);
    },
    [archief, deadline],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Live meekijken plus een periodieke herberekening van de countdown.
  useEffect(() => {
    const stop = watchDeadlines(() => load(true));
    const poll = setInterval(() => load(true), 300000);

    return () => {
      if (stop) stop();
      clearInterval(poll);
    };
  }, [load]);

  // Wat via Beheer is toegevoegd staat vooraan, daarna wat uit Supabase komt
  // (regeling-specifieke deadlines), daarna de funder-brede datamomenten.
  // Een datamoment is óf funder-breed óf regeling-specifiek (nooit beide),
  // dus supaRows en supaFunderRows overlappen per constructie nooit — de
  // dedupe-check hieronder is alleen een vangnet tegen id-botsingen met wat
  // via Beheer is toegevoegd.
  const rows = useMemo(() => {
    const basis = store.deadlines || [];
    const alBekend = (id) => basis.some((d) => String(d.id) === String(id)) || supaRows.some((d) => String(d.id) === String(id));

    return basis
      .concat(supaRows.filter((r) => !basis.some((d) => String(d.id) === String(r.id))))
      .concat(supaFunderRows.filter((r) => !alBekend(r.id)));
  }, [store.deadlines, supaRows, supaFunderRows]);

  const matches = useCallback(
    (row, skip) => {
      if (!(archief || deadline === 'heel_jaar') && row.status === 'Gesloten') {
        return false;
      }

      if (skip !== 'q' && query.trim()) {
        const t = query.trim().toLowerCase();

        if (`${row.naam} ${row.funder} ${row.thema}`.toLowerCase().indexOf(t) === -1) {
          return false;
        }
      }

      if (skip !== 'deadline' && !deadlinePredicate(deadline, statuses)(row)) {
        return false;
      }

      if (skip !== 'status' && statuses.length && statuses.indexOf(row.status) === -1) {
        return false;
      }

      if (skip !== 'thema' && thema !== 'alle') {
        const themasNamen = row.themasNamen && row.themasNamen.length ? row.themasNamen : row.thema ? [row.thema] : [];

        if (themasNamen.indexOf(thema) === -1) {
          return false;
        }
      }

      if (skip !== 'type' && type !== 'alle' && row.funderType !== type) {
        return false;
      }

      if (skip !== 'regio' && regio !== 'alle') {
        const werkgebiedenNamen = row.werkgebiedenNamen && row.werkgebiedenNamen.length ? row.werkgebiedenNamen : row.regio ? [row.regio] : [];

        if (werkgebiedenNamen.indexOf(regio) === -1) {
          return false;
        }
      }

      if (skip !== 'bandbreedte' && bandbreedte !== 'alle' && row.bandbreedteBijdrage !== bandbreedte) {
        return false;
      }

      return true;
    },
    [archief, query, deadline, statuses, thema, type, regio, bandbreedte],
  );

  const sorted = useMemo(
    () =>
      rows
        .filter((r) => matches(r))
        .sort((a, b) => {
          // Uitsluitend chronologisch: de eerstvolgende concrete deadline
          // staat bovenaan. Status bepaalt niet langer de volgorde.
          const da = daysLeft(a);
          const db = daysLeft(b);

          if (da == null && db == null) {
            return a.naam.localeCompare(b.naam, 'nl');
          }

          if (da == null) {
            return 1;
          }

          if (db == null) {
            return -1;
          }

          if (da !== db) {
            return da - db;
          }

          return a.naam.localeCompare(b.naam, 'nl');
        }),
    [rows, matches],
  );

  // Centrale weergaveregel (zie data/services/deadlines.js): elke pagina
  // van PAGE_SIZE regelingen begint met FREE_SLOTS_PER_PAGE volledig
  // zichtbare regelingen. Voor Premium is dit een bypass — zij zien de
  // oorspronkelijke ranking, zoals bedoeld.
  const displayOrder = useMemo(
    () => buildDeadlineDisplayOrder(sorted, { bypass: premium }),
    [sorted, premium],
  );
  const shown = displayOrder.slice(0, limit);
  const lockedCount = sorted.filter((r) => getDeadlineAccess(r) === 'premium').length;
  const detailRij = rows.find((r) => String(r.id) === String(detailId)) || null;
  // Aanvullende details van de geopende regeling of het geopende fonds (beschrijving, disciplines, doelgroepen, werkgebieden,
  // bandbreedte en aanvraagdetails) uit kompas_bron_details: dezelfde toegangsregels als het dekkingsplan, alleen lezen.
  const [bronExtra, setBronExtra] = useState({});
  const extraSleutel = detailRij ? (detailRij.bronType === 'funder' ? `f:${detailRij.funderId}` : `r:${detailRij.id}`) : '';

  useEffect(() => {
    if (!detailRij || !detailRij.volledigZichtbaar || bronExtra[extraSleutel] !== undefined) return undefined;

    let actief = true;
    const fonds = detailRij.bronType === 'funder';

    haalBronDetails({ schemeIds: fonds ? [] : [detailRij.id], funderIds: fonds ? [detailRij.funderId] : [] }).then((res) => {
      if (!actief) return;

      const d = fonds ? (res.perFonds || {})[detailRij.funderId] : (res.perRegeling || {})[detailRij.id];

      setBronExtra((cur) => ({ ...cur, [extraSleutel]: d || null }));
    });

    return () => {
      actief = false;
    };
  }, [extraSleutel]);

  const detail = detailRij ? metBronDetails(detailRij, bronExtra[extraSleutel]) : null;
  const sluitDetail = useCallback(() => setDetailId(null), []);
  const upgradeRow = rows.find((r) => String(r.id) === String(upgradeId)) || null;

  // Eén centrale klikregel: een volledig zichtbare regeling opent de
  // bestaande detailkaart, een vergrendelde regeling opent de upgradekaart.
  // Nooit dezelfde modal voor beide — de gebruiker moet meteen zien waarom
  // de ervaring verschilt.
  const handleCardClick = (row) => {
    if (getDeadlineClickAction(row) === 'detail') {
      setDetailId(row.id);
    } else {
      setUpgradeId(row.id);
    }
  };

  const setFilter = (fn) => (value) => {
    fn(value);
    setLimit(PAGE_SIZE);
  };

  const clearFilters = () => {
    setQuery('');
    setDeadline('alle');
    setStatuses([]);
    setThema('alle');
    setType('alle');
    setRegio('alle');
    setBandbreedte('alle');
    setArchief(false);
    setLimit(PAGE_SIZE);
  };

  const countFor = (skip, pred) => rows.filter((r) => matches(r, skip) && pred(r)).length;
  const unique = (key) =>
    Array.from(new Set(rows.map((r) => r[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'nl'));
  // Voor disciplines/werkgebieden: leest de centrale, meerwaardige
  // koppelingen (arrayKey) uit i.p.v. het oude, mogelijk kommagescheiden
  // vrije-tekstveld (fallbackKey), zodat elke discipline/elk werkgebied als
  // los filter verschijnt in plaats van als samengevoegde combinatie.
  const uniqueFlat = (arrayKey, fallbackKey) => {
    const values = new Set();

    rows.forEach((r) => {
      const arr = r[arrayKey];

      if (arr && arr.length) {
        arr.forEach((v) => v && values.add(v));
      } else if (r[fallbackKey]) {
        values.add(r[fallbackKey]);
      }
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b, 'nl'));
  };

  const filtersActief =
    Boolean(query.trim()) ||
    deadline !== 'alle' ||
    statuses.length > 0 ||
    thema !== 'alle' ||
    type !== 'alle' ||
    regio !== 'alle' ||
    bandbreedte !== 'alle' ||
    archief;

  const filters = (
    <>
      <div className="fwk-dl-groep">
        <div className="fwk-dl-groeplabel">Deadline</div>
        <div className="fwk-dl-pillen">
          {DEADLINE_OPTIONS.map(([value, label]) => {
            // "Heel jaar" is het Premium-only jaaroverzicht (incl. verstreken
            // deadlines). Free/Pro zien de pil met een Premium-label i.p.v.
            // een telling, en de klik gaat naar de upgradeflow, niet naar
            // het filter zelf.
            const jaarFilterVergrendeld = value === 'heel_jaar' && !premium;
            const actief = deadline === value && !jaarFilterVergrendeld;

            return (
              <button
                key={value}
                type="button"
                className="fwk-dl-pil"
                aria-pressed={actief}
                onClick={() => (jaarFilterVergrendeld ? app.goAbonnementen() : setFilter(setDeadline)(value))}
              >
                <span>{label}</span>
                {jaarFilterVergrendeld ? (
                  <span className="fwk-dl-slot">Premium</span>
                ) : (
                  <span className="fwk-dl-tel">{countFor('deadline', deadlinePredicate(value, statuses))}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fwk-dl-groep">
        <div className="fwk-dl-groeplabel">Status</div>
        <div className="fwk-dl-pillen">
          {STATUS_ORDER.filter((st) => (st !== 'Gesloten' || archief) && rows.some((r) => r.status === st)).map((st) => (
            <button
              key={st}
              type="button"
              className="fwk-dl-pil"
              aria-pressed={statuses.indexOf(st) !== -1}
              onClick={() => {
                setStatuses((cur) => (cur.indexOf(st) === -1 ? cur.concat([st]) : cur.filter((x) => x !== st)));
                setLimit(PAGE_SIZE);
              }}
            >
              <span>{st}</span>
              <span className="fwk-dl-tel">{countFor('status', (r) => r.status === st)}</span>
            </button>
          ))}
        </div>
      </div>

      {[
        ['Discipline', thema, setThema, 'Alle disciplines', uniqueFlat('themasNamen', 'thema')],
        ['Werkgebied', regio, setRegio, 'Alle werkgebieden', uniqueFlat('werkgebiedenNamen', 'regio')],
        ['Type verstrekker', type, setType, 'Alle typen', unique('funderType')],
        ['Bandbreedte bijdrage', bandbreedte, setBandbreedte, 'Alle bandbreedtes', unique('bandbreedteBijdrage')],
      ].map(([title, value, setter, allLabel, values]) => (
        <label key={title} className="fwk-dl-groep">
          <span className="fwk-dl-veldlabel">{title}</span>
          <select value={value} onChange={(e) => setFilter(setter)(e.target.value)} className="fwk-dl-select">
            <option value="alle">{allLabel}</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      ))}

      <div className="fwk-dl-voet">
        <button type="button" className="fwk-dl-pil" aria-pressed={archief} onClick={() => setFilter(setArchief)(!archief)}>
          Toon archief
        </button>
        <button type="button" className="fwk-dl-wis" data-actief={filtersActief ? 'ja' : 'nee'} onClick={clearFilters}>
          Wis filters
        </button>
      </div>
    </>
  );

  const detailKans = detail ? kansrijkheid(detail, store.orgProfile || {}, store.projects) : null;
  const detailBron = detail && paid ? bronUitDeadlineRij(detail) : null;

  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <KompasSubnav actief="deadlines" maxWidth="1180px" toonPlan />

      <style>{CSS_WERKPLEK}</style>
      <style>{CSS_DEADLINES}</style>
      <div className="fwk-wp-pagina" style={css('min-height: 0;')}>
        <div className="fwk-dl-kop">
          <span className="fwk-dl-eyebrow">Deadlines</span>
          <PaginaKop
            titel="Actuele subsidieregelingen en deadlines"
            meta={
              <>
                <FundingDatabaseCount /> fondsen en regelingen in de database
              </>
            }
            help={
              <>
                {paid && <p>Mijn deadlines toont de deadlines uit de dekkingsplannen van uw projecten. Actieplan bundelt de acties per project.</p>}
                <p>
                  {paid ? 'Alle regelingen' : 'Dit'} is het volledige overzicht van regelingen en fondsen die nu open zijn, binnenkort openen of doorlopend aan te
                  vragen zijn. Klik op een regeling voor de details{paid ? ' en om hem in een project op te nemen' : ''}.
                </p>
              </>
            }
          />
        </div>
      </div>

      <div className="fwk-dl-body">
        {paid && (
          <div data-testid="deadlines-segmenten">
            <Tabs
              tabs={[
                { id: 'mijn', label: 'Mijn deadlines' },
                { id: 'actieplan', label: 'Actieplan' },
                { id: 'alle', label: 'Alle regelingen' },
              ]}
              actief={segment}
              onKies={setSegment}
              label="Deadlines"
              testidPrefix="segment-"
            />
          </div>
        )}

        {paid && segment === 'mijn' && <MijnDeadlines projecten={store.projects} onNaarAlleRegelingen={() => setSegment('alle')} />}

        {paid && segment === 'actieplan' && <ActieplanOverzicht projecten={store.projects} />}

        {(!paid || segment === 'alle') && (
          <div className="fwk-dl-raster" data-desktop={desktop ? 'ja' : 'nee'}>
            {desktop && (
              <aside className="fwk-dl-filters" aria-label="Filters">
                {filters}
              </aside>
            )}

            <div className="fwk-dl-lijstvak">
              <div className="fwk-dl-balk">
                <label className="fwk-dl-zoek">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    value={query}
                    onChange={(e) => setFilter(setQuery)(e.target.value)}
                    placeholder="Zoek in subsidieregelingen…"
                    aria-label="Zoek in subsidieregelingen"
                  />
                </label>

                {!desktop && (
                  <button type="button" className="fwk-dl-filterknop" onClick={() => setSheetOpen(true)} data-actief={filtersActief ? 'ja' : 'nee'}>
                    Filters
                  </button>
                )}

                {!loading && !error && sorted.length > 0 && (
                  <div className="fwk-dl-aantal" data-testid="deadlines-aantal">
                    <strong>
                      {sorted.length} {sorted.length === 1 ? 'regeling' : 'regelingen'}
                    </strong>{' '}
                    · gesorteerd op eerstvolgende deadline
                  </div>
                )}
              </div>

              {loading && (
                <div className="fwk-dl-lijst" aria-busy="true">
                  {['62%', '48%', '70%', '55%', '64%', '44%'].map((w, i) => (
                    <div key={i} className="fwk-dl-skelet">
                      <div style={css(`height: 15px; width: ${w}; border-radius: 6px; background: #EDF2EF; margin-bottom: 12px;`)} />
                      <div style={css('height: 11px; width: 34%; border-radius: 6px; background: #F2F6F4;')} />
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="fwk-dl-fout">
                  <div className="fwk-dl-fouttekst">De subsidieregelingen konden niet worden geladen. Probeer het opnieuw.</div>
                  <button type="button" className="fwk-dl-knop" data-soort="donker" onClick={() => load()}>
                    Opnieuw proberen
                  </button>
                </div>
              )}

              {!loading && !error && sorted.length === 0 && (
                <div className="fwk-dl-leeg">
                  <div className="fwk-dl-leegkop">Geen subsidieregelingen gevonden</div>
                  <div className="fwk-dl-leegtekst">Pas je filters aan of wis de filters om meer regelingen te bekijken.</div>
                  <button type="button" className="fwk-dl-knop" onClick={clearFilters}>
                    Wis filters
                  </button>
                </div>
              )}

              {!loading && !error && shown.length > 0 && (
                <div className="fwk-dl-lijst" data-paneel={detail ? 'open' : 'dicht'}>
                  {(() => {
                    const firstLockedIndex = shown.findIndex((row) => getDeadlineAccess(row) === 'premium');

                    return shown.map((r, i) => {
                      const locked = getDeadlineAccess(r) === 'premium';
                      const days = daysLeft(r);
                      const st = STATUS_STYLE[r.status] || STATUS_STYLE.Open;
                      const urgent = days != null && days >= 0 && days <= 14;
                      const isAdmin = app.isAdmin;
                      const adminExpanded = isAdmin && expandedAdminId === r.id;
                      const gekozen = detail && String(detail.id) === String(r.id);

                      return (
                        <div key={r.id} className="fwk-dl-item">
                          <div
                            role="button"
                            tabIndex={0}
                            className="fwk-dl-rij"
                            data-testid="deadline-rij"
                            data-vergrendeld={locked ? 'ja' : 'nee'}
                            aria-current={gekozen ? 'true' : undefined}
                            onClick={() => handleCardClick(r)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleCardClick(r);
                              }
                            }}
                          >
                            <div className="fwk-dl-naam">
                              <div className="fwk-dl-titel">
                                {r.naam}
                                {!locked && r.accessTier === 'premium' && (
                                  <span className="fwk-dl-tag fwk-dl-premiumlabel" data-toon="premium" data-testid="rij-premium">
                                    Premium
                                  </span>
                                )}
                              </div>
                              <div className="fwk-dl-sub">{locked ? `${r.thema || 'Discipline onbekend'} · ${r.regio}` : `${r.funder} · ${r.regio}`}</div>
                              {isAdmin && (
                                <div className="fwk-dl-admin" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                  <button type="button" aria-pressed={adminExpanded} onClick={() => setExpandedAdminId(adminExpanded ? null : r.id)}>
                                    {adminExpanded ? '✕ Sluiten' : '✏️ Bewerken'}
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="fwk-dl-kol">
                              <div className="fwk-dl-kollabel">Bedrag</div>
                              {locked ? (
                                <div className="fwk-dl-waarde fwk-dl-wazig">€ •••• – € ••••</div>
                              ) : (
                                <div className="fwk-dl-waarde">{formatAmount(r.bedragMin, r.bedragMax)}</div>
                              )}
                            </div>

                            <div className="fwk-dl-kol">
                              <div className="fwk-dl-kollabel">Deadline</div>
                              {locked ? (
                                <>
                                  <div className="fwk-dl-waarde fwk-dl-wazig">•• d</div>
                                  {i === firstLockedIndex && <span className="fwk-dl-ontgrendel">Ontgrendel met Premium</span>}
                                </>
                              ) : (
                                <>
                                  <div className="fwk-dl-dagen" data-urgent={urgent ? 'ja' : 'nee'}>
                                    {r.deadline ? (days != null && days >= 0 ? `${days}d` : 'Afgelopen') : 'Doorlopend'}
                                    {urgent && <span className="fwk-dl-stip" aria-label="binnen twee weken" />}
                                  </div>
                                  <div className="fwk-dl-datum">{r.deadline ? formatDate(r.deadline) : 'geen vaste sluitingsdatum'}</div>
                                </>
                              )}
                            </div>

                            <div className="fwk-dl-eind">
                              <span className="fwk-dl-status" style={css(`border-color: ${st.border}; background: ${st.bg}; color: ${st.color};`)}>
                                {r.status}
                              </span>
                            </div>
                          </div>

                          {adminExpanded && (
                            <div style={css('margin-top: 10px;')}>
                              <AdminInlineEdit row={r} onClose={() => setExpandedAdminId(null)} onSaved={() => load(true)} />
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {shown.length < sorted.length && (
                <button type="button" className="fwk-dl-meer" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                  Meer regelingen laden ({sorted.length - shown.length})
                </button>
              )}

              {lockedCount > 0 && (
                <div className="fwk-dl-premium">
                  <span>
                    Nog {lockedCount} {lockedCount === 1 ? 'actuele regeling' : 'actuele regelingen'} met bedrag, deadline en voorwaarden zichtbaar met Premium.
                  </span>
                  <button type="button" className="fwk-dl-knop" data-soort="donker" onClick={app.goAbonnementen}>
                    Bekijk alle deadlines met Premium
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Zijpaneel open={Boolean(detail)} onSluit={sluitDetail} titel={detail ? detail.naam : ''} testid="deadline-detail">
        {detail && (
          <>
            <div className="fwk-dl-chips">
              <span className="fwk-dl-status" style={css(`border-color: ${(STATUS_STYLE[detail.status] || STATUS_STYLE.Open).border}; background: ${(STATUS_STYLE[detail.status] || STATUS_STYLE.Open).bg}; color: ${(STATUS_STYLE[detail.status] || STATUS_STYLE.Open).color};`)}>
                {detail.status}
              </span>
              {detail.accessTier === 'premium' && (
                <span className="fwk-dl-tag" data-toon="premium" data-testid="detail-premium">
                  Premium
                </span>
              )}
              <span className="fwk-dl-chiptekst">
                {[detail.bronType === 'funder' ? 'Fonds' : 'Regeling', detail.funder, detail.regio].filter(Boolean).join(' · ')}
              </span>
              {(detail.themasNamen && detail.themasNamen.length ? detail.themasNamen : detail.thema ? [detail.thema] : []).slice(0, 3).map((t) => (
                <span key={t} className="fwk-dl-tag">
                  {t}
                </span>
              ))}
            </div>

            <div className="fwk-wp-feiten fwk-dl-feiten">
              {[
                ['Bedrag', formatAmount(detail.bedragMin, detail.bedragMax) || 'Niet bekend'],
                [
                  'Deadline',
                  detail.deadline
                    ? daysLeft(detail) != null && daysLeft(detail) < 0
                      ? `Afgelopen · ${formatDate(detail.deadline)}`
                      : `${daysLeft(detail)} dagen · ${formatDate(detail.deadline)}`
                    : 'Doorlopend',
                ],
                // Meerdere aanvraagrondes: beoordelingsdatum/-periode komen uit dezelfde eerstvolgende ronde als de deadline.
                detail.beoordelingsdatum || detail.beoordelingsperiode
                  ? ['Beoordeling', detail.beoordelingsdatum ? formatDate(detail.beoordelingsdatum) : detail.beoordelingsperiode]
                  : null,
                detail.bandbreedteBijdrage ? ['Bandbreedte bijdrage', detail.bandbreedteBijdrage] : null,
              ]
                .filter(Boolean)
                .map(([label, value]) => (
                  <div key={label} className="fwk-wp-feit">
                    <div className="fwk-wp-kol-label">{label}</div>
                    <div className="fwk-dl-feitwaarde">{value}</div>
                  </div>
                ))}
            </div>

            {detail.rondesAantal > 1 && <div className="fwk-dl-klein">Volgende ronde van {detail.rondesAantal} aanvraagrondes.</div>}

            <div className="fwk-wp-label">{detail.bronType === 'funder' ? 'Toelichting' : 'Voorwaarden'}</div>
            <div className="fwk-dl-tekst" data-leeg={detail.voorwaarden ? 'nee' : 'ja'}>
              {detail.voorwaarden || 'Nog geen voorwaarden bekend; controleer ze bij de officiële bron.'}
            </div>

            {detail.aanvraag && AANVRAAG_VELDEN.some(([k]) => detail.aanvraag[k]) && (
              <>
                <div className="fwk-wp-label">Aanvragen</div>
                <dl className="fwk-dl-aanvraag" data-testid="detail-aanvraag">
                  {AANVRAAG_VELDEN.filter(([k]) => detail.aanvraag[k]).map(([k, label]) => (
                    <div key={k}>
                      <dt>{label}</dt>
                      <dd>{detail.aanvraag[k]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            {detail.omschrijving && (
              <>
                <div className="fwk-wp-label">{detail.bronType === 'funder' ? 'Over dit fonds' : 'Over deze regeling'}</div>
                <div className="fwk-dl-tekst">{detail.omschrijving}</div>
              </>
            )}

            {[
              ['Doelgroepen', detail.doelgroepenNamen],
              ['Werkgebied', detail.werkgebiedenNamen],
            ].some(([, l]) => l && l.length) && (
              <div className="fwk-dl-voorwie">
                {[
                  ['Doelgroepen', detail.doelgroepenNamen],
                  ['Werkgebied', detail.werkgebiedenNamen],
                ]
                  .filter(([, l]) => l && l.length)
                  .map(([label, lijst]) => (
                    <div key={label}>
                      <strong>{label}:</strong> {lijst.join(', ')}
                    </div>
                  ))}
              </div>
            )}

            <div
              data-testid="detail-match"
              className="fwk-dl-match"
              style={css(`border-color: ${detailKans.border}; background: ${detailKans.bg};`)}
            >
              <span className="fwk-dl-matchicoon" style={css(`background: ${detailKans.color};`)} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <div>
                <div className="fwk-dl-matchkop" style={css(`color: ${detailKans.color};`)}>
                  {detailKans.label}
                </div>
                <div className="fwk-dl-matchtekst">{detailKans.tekst}</div>
              </div>
            </div>

            {/* Opnemen in een project (Pro/Premium): alleen voor volledig zichtbare rijen. Toevoegen loopt volledig via
                financiering/toevoegen.js; hier staat geen insertlogica. */}
            {detailBron && <ProjectOpnemen bron={detailBron} projecten={store.projects} />}

            {!paid && detail.bronType !== 'funder' && (
              <div className="fwk-dl-upsell">
                Opnemen in een project kan met Pro en Premium.{' '}
                <button type="button" className="fwk-wp-link" onClick={app.goAbonnementen}>
                  Bekijk de abonnementen
                </button>
              </div>
            )}

            <div className="fwk-dl-links">
              {detailBron && (
                <button type="button" className="fwk-wp-link" onClick={app.goKompas}>
                  <span data-testid="detail-bespreek">Bespreek met Subsidie Kompas</span>
                </button>
              )}
              {detail.aanvraag && detail.aanvraag.aanvraaglink && detail.aanvraag.aanvraaglink !== detail.url && (
                <a href={detail.aanvraag.aanvraaglink} target="_blank" rel="noopener noreferrer" className="fwk-wp-link" data-testid="detail-aanvraaglink">
                  Naar het aanvraagformulier →
                </a>
              )}
              {detail.url && (
                <a href={detail.url} target="_blank" rel="noopener noreferrer" className="fwk-wp-link" data-testid="detail-bron">
                  Naar de website van de verstrekker →
                </a>
              )}
            </div>
          </>
        )}
      </Zijpaneel>

      {/* Upgradekaart voor vergrendelde regelingen — bewust een andere inhoud dan de detailkaart hierboven, zodat direct
          duidelijk is waarom de ervaring verschilt. Toont uitsluitend wat al op de kaart zelf zichtbaar was (naam, discipline,
          werkgebied, status) — geen bedrag, geen deadline, geen voorwaarden, geen verstrekker: die velden heeft de database
          voor deze regeling nooit meegestuurd. */}
      <Zijpaneel open={Boolean(upgradeRow)} onSluit={() => setUpgradeId(null)} titel={upgradeRow ? upgradeRow.naam : ''} testid="deadline-upgrade">
        {upgradeRow && (
          <>
            <div className="fwk-dl-chips">
              <span className="fwk-dl-tag" data-toon="premium">
                Pro &amp; Premium
              </span>
              <span className="fwk-dl-status" style={css(`border-color: ${(STATUS_STYLE[upgradeRow.status] || STATUS_STYLE.Open).border}; background: ${(STATUS_STYLE[upgradeRow.status] || STATUS_STYLE.Open).bg}; color: ${(STATUS_STYLE[upgradeRow.status] || STATUS_STYLE.Open).color};`)}>
                {upgradeRow.status}
              </span>
              <span className="fwk-dl-chiptekst">{`${upgradeRow.thema || 'Discipline onbekend'} · ${upgradeRow.regio}`}</span>
            </div>

            <div className="fwk-dl-upgradekop">Geïnteresseerd in deze subsidieregeling?</div>
            <div className="fwk-dl-tekst">Met een Pro- of Premium-abonnement krijgt u toegang tot:</div>

            <ul className="fwk-dl-vinkjes">
              {[
                'Uitgebreide informatie over deze regeling',
                'Alle subsidiedetails: bedrag, deadline en voorwaarden',
                'Aanvullende, vergelijkbare subsidiemogelijkheden',
                'AI-matching op uw organisatieprofiel',
                'Extra functionaliteiten van Subsidie Kompas',
              ].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>

            <div className="fwk-dl-upgradeknoppen">
              <button type="button" className="fwk-dl-knop" data-soort="donker" onClick={() => { setUpgradeId(null); app.goAbonnementen(); }}>
                Bekijk Premium
              </button>
              <button type="button" className="fwk-dl-knop" data-soort="licht" onClick={() => { setUpgradeId(null); app.goAbonnementen(); }}>
                Bekijk Pro
              </button>
              <button type="button" className="fwk-wp-link" onClick={() => { setUpgradeId(null); app.goAbonnementen(); }}>
                Vergelijk abonnementen
              </button>
            </div>
          </>
        )}
      </Zijpaneel>

      {!desktop && sheetOpen && (
        <div className="fwk-dl-sheetachter" onMouseDown={(e) => e.target === e.currentTarget && setSheetOpen(false)}>
          <div className="fwk-dl-sheet" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="fwk-dl-sheetkop">
              <span>Filters</span>
              <button type="button" className="fwk-wp-sluit" aria-label="Sluiten" onClick={() => setSheetOpen(false)}>
                ×
              </button>
            </div>

            {filters}

            <button type="button" className="fwk-dl-knop" onClick={() => setSheetOpen(false)}>
              Toon resultaten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS_DEADLINES = `
.fwk-dl-kop { max-width: 1180px; margin: 0 auto; padding: clamp(18px, 3vw, 32px) clamp(16px, 4vw, 28px) 0; box-sizing: border-box; }
.fwk-dl-eyebrow { display: inline-flex; align-items: center; margin-bottom: 10px; padding: 5px 12px; border-radius: 999px; background: #E6F0EA; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; color: #2C4A5E; }
.fwk-dl-kop .fwk-wp-kop { margin-top: 0; }
.fwk-dl-body { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 28px) clamp(48px, 7vw, 90px); box-sizing: border-box; font-family: 'Mulish', sans-serif; }
.fwk-dl-raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(18px, 2.4vw, 28px); align-items: start; }
.fwk-dl-raster[data-desktop="ja"] { grid-template-columns: 264px minmax(0, 1fr); }
.fwk-dl-filters { position: sticky; top: 18px; display: flex; flex-direction: column; gap: 18px; padding: 18px; border: 1px solid #E1EAE4; border-radius: 18px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(44,74,94,0.03); }
.fwk-dl-groep { display: flex; flex-direction: column; gap: 8px; margin: 0; }
.fwk-dl-groeplabel { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #2C4A5E; }
.fwk-dl-veldlabel { font-size: 12.5px; font-weight: 700; color: #4B5C58; }
.fwk-dl-pillen { display: flex; flex-wrap: wrap; gap: 6px; }
.fwk-dl-pil { cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; min-height: 34px; padding: 6px 12px; border: 1px solid #DCE6E0; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #2C4A5E; transition: background .15s ease, border-color .15s ease, color .15s ease; }
.fwk-dl-pil:hover { border-color: #A8D5BA; }
.fwk-dl-pil[aria-pressed="true"] { border-color: #4E9A6C; background: #4E9A6C; color: #FFFFFF; }
.fwk-dl-tel { font-size: 11.5px; font-weight: 800; color: #8A9894; }
.fwk-dl-pil[aria-pressed="true"] .fwk-dl-tel { color: rgba(255,255,255,0.85); }
.fwk-dl-slot { font-size: 10.5px; font-weight: 800; letter-spacing: 0.02em; color: #4E9A6C; }
.fwk-dl-select { width: 100%; box-sizing: border-box; min-height: 42px; padding: 9px 12px; border: 1px solid #DCE6E0; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700; color: #2C4A5E; }
.fwk-dl-voet { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid #EDF2EF; }
.fwk-dl-wis { cursor: pointer; min-height: 34px; padding: 0; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #A3AFAB; }
.fwk-dl-wis[data-actief="ja"] { color: #4E9A6C; font-weight: 800; }
.fwk-dl-lijstvak { min-width: 0; display: flex; flex-direction: column; gap: 14px; container-type: inline-size; }
.fwk-dl-balk { display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; }
.fwk-dl-zoek { flex: 1 1 260px; max-width: 560px; min-width: 0; display: flex; align-items: center; gap: 10px; box-sizing: border-box; min-height: 48px; padding: 0 16px; border: 1px solid #DCE6E0; border-radius: 999px; background: #FFFFFF; color: #8A9894; transition: border-color .15s ease, box-shadow .15s ease; }
.fwk-dl-zoek:focus-within { border-color: #4E9A6C; box-shadow: 0 0 0 3px rgba(78,154,108,0.14); }
.fwk-dl-zoek input { flex: 1; min-width: 0; border: none; outline: none; background: none; font-family: 'Mulish', sans-serif; font-size: 15px; color: #2E3A38; }
.fwk-dl-filterknop { cursor: pointer; min-height: 48px; padding: 0 22px; border: 1px solid #DCE6E0; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; color: #2C4A5E; white-space: nowrap; }
.fwk-dl-filterknop[data-actief="ja"] { border-color: #4E9A6C; color: #2F6D47; }
.fwk-dl-aantal { margin-left: auto; font-size: 13.5px; color: #687974; }
.fwk-dl-aantal strong { font-weight: 800; color: #2C4A5E; }
.fwk-dl-lijst { display: flex; flex-direction: column; gap: 10px; }
.fwk-dl-skelet { padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF; }
.fwk-dl-rij { cursor: pointer; position: relative; display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(0, 1.3fr) minmax(0, 1fr) 128px; gap: 12px 20px; align-items: center; box-sizing: border-box; padding: 18px 24px; border: 1px solid #E6EDE9; border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(44,74,94,0.03); transition: border-color .15s ease, box-shadow .15s ease, opacity .2s ease, transform .15s ease; }
.fwk-dl-rij:hover { border-color: #A8D5BA; box-shadow: 0 6px 18px rgba(44,74,94,0.07); }
.fwk-dl-rij:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-dl-rij[aria-current="true"] { z-index: 59; border-color: #4E9A6C; box-shadow: 0 0 0 1px #4E9A6C, 0 14px 34px rgba(44,74,94,0.14); }
.fwk-dl-lijst[data-paneel="open"] .fwk-dl-rij:not([aria-current="true"]) { opacity: 0.55; }
.fwk-dl-naam { min-width: 0; }
.fwk-dl-titel { font-size: 16px; font-weight: 800; line-height: 1.3; color: #2C4A5E; overflow-wrap: anywhere; text-wrap: pretty; }
.fwk-dl-sub { margin-top: 4px; font-size: 13.5px; color: #687974; overflow-wrap: anywhere; }
.fwk-dl-admin { margin-top: 8px; }
.fwk-dl-admin button { cursor: pointer; padding: 4px 11px; border: 1px solid #BFD4C6; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 12px; font-weight: 800; color: #2C4A5E; }
.fwk-dl-admin button[aria-pressed="true"] { background: #EAF4EE; }
.fwk-dl-kol { min-width: 0; }
.fwk-dl-kollabel { margin-bottom: 3px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9AA6A2; }
.fwk-dl-waarde { font-size: 15px; font-weight: 700; color: #2E3A38; }
.fwk-dl-wazig { filter: blur(4.5px); user-select: none; color: #A9B5B1; }
.fwk-dl-ontgrendel { display: inline-block; margin-top: 6px; font-size: 12.5px; font-weight: 800; color: #4E9A6C; }
.fwk-dl-dagen { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 800; color: #2C4A5E; }
.fwk-dl-dagen[data-urgent="ja"] { color: #B23B2A; }
.fwk-dl-stip { width: 6px; height: 6px; border-radius: 50%; background: #B23B2A; }
.fwk-dl-datum { margin-top: 2px; font-size: 12.5px; color: #7B8985; }
.fwk-dl-eind { display: flex; justify-content: flex-start; }
.fwk-dl-status { display: inline-flex; align-items: center; padding: 5px 14px; border: 1px solid; border-radius: 999px; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; white-space: nowrap; }
@container (max-width: 620px) {
  .fwk-dl-rij { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding: 16px 18px; }
  .fwk-dl-naam { grid-column: 1 / -1; }
  .fwk-dl-eind { grid-column: 1 / -1; }
}
.fwk-dl-meer { cursor: pointer; min-height: 48px; padding: 0 24px; border: 1px solid #DCE6E0; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; color: #2C4A5E; }
.fwk-dl-meer:hover { border-color: #A8D5BA; }
.fwk-dl-premium { display: flex; align-items: center; justify-content: space-between; gap: 14px 18px; flex-wrap: wrap; padding: 16px 20px; border: 1px solid #D5E6DB; border-radius: 16px; background: #EAF4EE; }
.fwk-dl-premium > span { flex: 1 1 280px; min-width: 0; font-size: 14px; font-weight: 700; line-height: 1.5; color: #2F6D47; }
.fwk-dl-knop { cursor: pointer; box-sizing: border-box; min-height: 46px; padding: 0 22px; border: none; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; }
.fwk-dl-knop[data-soort="donker"] { background: #2C4A5E; }
.fwk-dl-knop[data-soort="licht"] { border: 1.5px solid #A8D5BA; background: #FFFFFF; color: #2C4A5E; }
.fwk-dl-fout { padding: 24px; border: 1px solid #EDD3CE; border-radius: 16px; background: #FDF6F5; }
.fwk-dl-fouttekst { margin-bottom: 14px; font-size: 15px; font-weight: 700; color: #9E3B2C; }
.fwk-dl-leeg { padding: 30px 26px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF; }
.fwk-dl-leegkop { margin-bottom: 6px; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; }
.fwk-dl-leegtekst { margin-bottom: 16px; font-size: 15px; line-height: 1.6; color: #4B5C58; }
.fwk-dl-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 2px 0 16px; }
.fwk-dl-chiptekst { font-size: 13px; color: #687974; }
.fwk-dl-tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: #EEF3F0; font-size: 12px; font-weight: 800; color: #2C4A5E; }
.fwk-dl-tag[data-toon="premium"] { background: #EAF4EE; color: #2F6D47; letter-spacing: 0.04em; text-transform: uppercase; font-size: 11px; }
.fwk-wp-feiten.fwk-dl-feiten { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
.fwk-dl-feiten .fwk-wp-feit { flex: 1 1 auto; min-width: 0; }
.fwk-dl-premiumlabel { margin-left: 8px; vertical-align: 2px; }
.fwk-dl-aanvraag { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.fwk-dl-aanvraag dt { font-size: 12.5px; font-weight: 800; color: #2C4A5E; }
.fwk-dl-aanvraag dd { margin: 1px 0 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #4B5C58; }
.fwk-dl-feitwaarde { margin-top: 3px; font-size: 14px; font-weight: 800; color: #2C4A5E; white-space: nowrap; }
.fwk-dl-klein { margin-top: 6px; font-size: 12.5px; color: #7B8985; }
.fwk-dl-tekst { font-size: 14px; line-height: 1.65; white-space: pre-wrap; color: #4B5C58; }
.fwk-dl-tekst[data-leeg="ja"] { color: #9AA6A2; }
.fwk-dl-voorwie { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; line-height: 1.5; color: #4B5C58; }
.fwk-dl-voorwie strong { color: #2C4A5E; }
.fwk-dl-match { margin-top: 18px; display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border: 1px solid; border-radius: 14px; }
.fwk-dl-matchicoon { flex: none; width: 22px; height: 22px; margin-top: 1px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
.fwk-dl-matchkop { margin-bottom: 3px; font-size: 14px; font-weight: 800; }
.fwk-dl-matchtekst { font-size: 13.5px; line-height: 1.6; color: #4B5C58; }
.fwk-dl-upsell { margin-top: 20px; padding-top: 16px; border-top: 1px solid #E1EAE4; font-size: 14px; line-height: 1.6; color: #4B5C58; }
.fwk-dl-links { margin-top: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.fwk-dl-upgradekop { margin: 4px 0 6px; font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; line-height: 1.3; color: #2C4A5E; }
.fwk-dl-vinkjes { list-style: none; margin: 14px 0 18px; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.fwk-dl-vinkjes li { position: relative; padding-left: 24px; font-size: 14.5px; line-height: 1.55; color: #3D4B48; }
.fwk-dl-vinkjes li::before { content: '✓'; position: absolute; left: 2px; top: 0; font-weight: 800; color: #4E9A6C; }
.fwk-dl-upgradeknoppen { display: flex; flex-direction: column; gap: 10px; }
.fwk-dl-upgradeknoppen .fwk-wp-link { align-self: center; min-height: 36px; }
.fwk-dl-sheetachter { position: fixed; inset: 0; z-index: 80; background: rgba(44,74,94,0.32); display: flex; align-items: flex-end; }
.fwk-dl-sheet { width: 100%; max-height: 86vh; overflow-y: auto; box-sizing: border-box; padding: 20px clamp(16px, 5vw, 24px) 26px; border-radius: 24px 24px 0 0; background: #FFFFFF; display: flex; flex-direction: column; gap: 20px; font-family: 'Mulish', sans-serif; }
.fwk-dl-sheetkop { display: flex; align-items: center; justify-content: space-between; gap: 14px; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; }
@media (max-width: 899px) {
  .fwk-dl-aantal { margin-left: 0; flex-basis: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .fwk-dl-rij, .fwk-dl-pil, .fwk-dl-zoek { transition: none; }
}
`;
