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
  watchDeadlines,
} from '../../data/services/deadlines.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';

// Regelgebaseerde inschatting: discipline, werkgebied en omvang tegenover het profiel.
// Geen score met valse precisie, alleen wat wel en niet aansluit.
function kansrijkheid(regeling, orgProfile, projects) {
  const themas = [].concat(orgProfile.themes || [], orgProfile.themas || []).map((x) => String(x).toLowerCase());
  const werkgebied = String(orgProfile.region || orgProfile.regio || '').toLowerCase();
  const punten = [];
  const minpunten = [];

  // Voorkeur voor de centrale, gestructureerde koppelingen (themasNamen/
  // werkgebiedenNamen, uit dezelfde disciplines/werkgebieden-tabellen als
  // Beheer); valt terug op de losse thema/regio-strings voor regelingen die
  // nog niet aan de centrale lijsten gekoppeld zijn.
  const regelingThemas = regeling.themasNamen && regeling.themasNamen.length ? regeling.themasNamen : regeling.thema ? [regeling.thema] : [];
  const aansluitendeThemas = regelingThemas.filter(
    (rt) => rt && themas.some((t) => t && (t.indexOf(rt.toLowerCase()) !== -1 || rt.toLowerCase().indexOf(t) !== -1)),
  );

  if (regelingThemas.length && aansluitendeThemas.length) {
    punten.push(`de disciplines ${aansluitendeThemas.join(', ')} sluiten aan bij uw profiel`);
  } else if (regelingThemas.length && themas.length) {
    minpunten.push(`de disciplines ${regelingThemas.join(', ')} sluiten niet aan bij uw profiel`);
  }

  const regelingWerkgebieden =
    regeling.werkgebiedenNamen && regeling.werkgebiedenNamen.length
      ? regeling.werkgebiedenNamen
      : regeling.regio
        ? [regeling.regio]
        : [];

  if (werkgebied && regelingWerkgebieden.length) {
    const sluitAan = regelingWerkgebieden.some((rw) => {
      const r = rw.toLowerCase();

      return r === 'nederland' || r === 'landelijk' || werkgebied.indexOf(r) !== -1 || r.indexOf(werkgebied) !== -1;
    });

    if (sluitAan) {
      punten.push('het werkgebied sluit aan');
    } else {
      minpunten.push(`het werkgebied ${regelingWerkgebieden.join(', ')} wijkt af van uw werkgebied`);
    }
  }

  if (regeling.status === 'Open') punten.push('de regeling is nu open');
  if (regeling.status === 'Budget uitgeput') minpunten.push('het budget is voor deze ronde uitgeput');
  if (regeling.status === 'Aangekondigd') minpunten.push('de openingsdatum is nog niet bekend');

  const gevraagd = (projects || [])
    .map((p) => Number(String(p.gevraagd || '').replace(/[^0-9]/g, '')))
    .filter(Boolean)[0];

  if (gevraagd && regeling.bedragMax && gevraagd > regeling.bedragMax) {
    minpunten.push('uw gevraagde bedrag ligt boven het maximum van deze regeling');
  }

  const label = !themas.length && !werkgebied
    ? 'Vul uw organisatieprofiel'
    : minpunten.length === 0 && punten.length
      ? 'Goede match'
      : punten.length >= minpunten.length
        ? 'Mogelijk passend'
        : 'Waarschijnlijk niet passend';

  const kleuren = {
    'Goede match': { bg: '#EAF4EE', color: '#2F6D47', border: '#CFE4D7' },
    'Mogelijk passend': { bg: '#EAF1F6', color: '#2C4A5E', border: '#CFDFEA' },
    'Waarschijnlijk niet passend': { bg: '#FBF1E3', color: '#8A5A16', border: '#EEDCC0' },
    'Vul uw organisatieprofiel': { bg: '#EEF1F0', color: '#5A6A66', border: '#DDE4E1' },
  };

  const tekst = label === 'Vul uw organisatieprofiel'
    ? 'Zodra uw discipline en werkgebied in het profiel staan, kan Subsidie Kompas beoordelen of deze regeling bij u past.'
    : `${punten.length ? `Wat aansluit: ${punten.join(', ')}.` : ''}${minpunten.length ? `${punten.length ? ' ' : ''}Let op: ${minpunten.join(', ')}.` : ''}`;

  return { label, tekst, ...kleuren[label] };
}

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
      return row.status === 'Binnenkort';
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

export default function DeadlinesPage() {
  const app = useApp();
  const store = useKompas();
  const tier = app.subscriptionTier || 'free';
  const premium = tier === 'premium';
  const paid = tier === 'pro' || premium;
  const [projectId, setProjectId] = useState('');
  const [addMsg, setAddMsg] = useState('');

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
  const detail = rows.find((r) => String(r.id) === String(detailId)) || null;
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

  const pillStyle = (active) =>
    css(`
      cursor: pointer;
      box-sizing: border-box;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 13px;
      border: 1px solid ${active ? '#BFD4C6' : '#E1EAE4'};
      border-radius: 12px;
      background: ${active ? '#EAF4EE' : '#FFFFFF'};
      color: ${active ? '#2F6D47' : '#3D4B48'};
      font-size: 13.5px;
      font-weight: 700;
    `);

  const selectStijl = css(`
    width: 100%;
    box-sizing: border-box;
    min-height: 44px;
    padding: 11px 12px;
    border: 1px solid #D5E0D9;
    border-radius: 12px;
    background: #FFFFFF;
    font-family: 'Mulish', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #2C4A5E;
    outline: none;
  `);

  const groupTitle = css(`
    margin-bottom: 8px;
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #2C4A5E;
  `);

  const filters = (
    <>
      <div>
        <div style={groupTitle}>Deadline</div>
        <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
          {DEADLINE_OPTIONS.map(([value, label]) => {
            // "Heel jaar" is het Premium-only jaaroverzicht (incl. verstreken
            // deadlines). Free/Pro zien de pil met een Premium-label i.p.v.
            // een telling, en de klik gaat naar de upgradeflow, niet naar
            // het filter zelf.
            const jaarFilterVergrendeld = value === 'heel_jaar' && !premium;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={deadline === value && !jaarFilterVergrendeld}
                onClick={() => (jaarFilterVergrendeld ? app.goAbonnementen() : setFilter(setDeadline)(value))}
                style={pillStyle(deadline === value && !jaarFilterVergrendeld)}
              >
                <span>{label}</span>
                {jaarFilterVergrendeld ? (
                  <span style={css('font-size: 11px; font-weight: 800; color: #4E9A6C;')}>Premium</span>
                ) : (
                  <span style={css('font-size: 12px; color: #7B8985;')}>
                    {countFor('deadline', deadlinePredicate(value, statuses))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={groupTitle}>Status</div>
        <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
          {STATUS_ORDER.filter((st) => (st !== 'Gesloten' || archief) && rows.some((r) => r.status === st)).map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={statuses.indexOf(st) !== -1}
              onClick={() => {
                setStatuses((cur) => (cur.indexOf(st) === -1 ? cur.concat([st]) : cur.filter((x) => x !== st)));
                setLimit(PAGE_SIZE);
              }}
              style={pillStyle(statuses.indexOf(st) !== -1)}
            >
              <span>{st}</span>
              <span style={css('font-size: 12px; color: #7B8985;')}>{countFor('status', (r) => r.status === st)}</span>
            </button>
          ))}
        </div>
      </div>

      {[
        ['Discipline', thema, setThema, 'Alle disciplines', uniqueFlat('themasNamen', 'thema')],
        ['Type verstrekker', type, setType, 'Alle typen', unique('funderType')],
        ['Werkgebied', regio, setRegio, 'Alle werkgebieden', uniqueFlat('werkgebiedenNamen', 'regio')],
        ['Bandbreedte bijdrage', bandbreedte, setBandbreedte, 'Alle bandbreedtes', unique('bandbreedteBijdrage')],
      ].map(([title, value, setter, allLabel, values]) => (
        <div key={title}>
          <div style={groupTitle}>{title}</div>
          <select value={value} onChange={(e) => setFilter(setter)(e.target.value)} style={selectStijl}>
            <option value="alle">{allLabel}</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div style={css('display: flex; flex-direction: column; gap: 10px; padding-top: 18px; border-top: 1px solid #E1EAE4;')}>
        <button type="button" aria-pressed={archief} onClick={() => setFilter(setArchief)(!archief)} style={pillStyle(archief)}>
          Toon archief
        </button>
        <button
          type="button"
          onClick={clearFilters}
          style={css(`
            cursor: pointer;
            min-height: 40px;
            display: flex;
            align-items: center;
            border: none;
            background: none;
            font-size: 13.5px;
            font-weight: 700;
            color: #4E9A6C;
          `)}
        >
          Wis filters
        </button>
      </div>
    </>
  );

  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <KompasSubnav actief="deadlines" maxWidth="1180px" toonPlan />

      <div style={css('max-width: 1180px; margin: 0 auto; padding: clamp(34px, 5vw, 56px) clamp(16px, 4vw, 24px) clamp(20px, 3vw, 30px);')}>
        <div style={css(`
          display: inline-block;
          padding: 7px 16px;
          border-radius: 999px;
          background: #EAF4EE;
          color: #2C4A5E;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 20px;
        `)}
        >
          Deadlines
        </div>

        <h1 style={css(`
          font-family: 'Newsreader', serif;
          font-size: clamp(30px, 5vw, 46px);
          font-weight: 600;
          color: #2C4A5E;
          line-height: 1.15;
          margin: 0 0 16px;
          max-width: 760px;
        `)}
        >
          Actuele subsidieregelingen en deadlines
        </h1>

        <p style={css('font-size: 17.5px; line-height: 1.65; color: #4B5C58; max-width: 680px; margin: 0;')}>
          Een chronologisch overzicht van regelingen die nu open zijn, binnenkort openen of doorlopend aan te vragen
          zijn. De database bevat <FundingDatabaseCount /> fondsen en regelingen.
        </p>
      </div>

      <div style={css('max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px) clamp(48px, 7vw, 90px);')}>
        <div style={css(`
          display: grid;
          grid-template-columns: ${desktop ? '250px minmax(0, 1fr)' : 'minmax(0, 1fr)'};
          gap: clamp(18px, 2.4vw, 30px);
          align-items: start;
        `)}
        >
          {desktop && (
            <aside style={css(`
              position: sticky;
              top: 18px;
              display: flex;
              flex-direction: column;
              gap: 16px;
              padding: 16px;
              border: 1px solid #E1EAE4;
              border-radius: 20px;
              background: #FFFFFF;
            `)}
            >
              {filters}
            </aside>
          )}

          <div style={css('min-width: 0; display: flex; flex-direction: column; gap: 14px;')}>
            <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
              <input
                value={query}
                onChange={(e) => setFilter(setQuery)(e.target.value)}
                placeholder="Zoek in subsidieregelingen…"
                style={css(`
                  flex: 1 1 240px;
                  min-width: 0;
                  box-sizing: border-box;
                  min-height: 48px;
                  padding: 14px 16px;
                  border: 1px solid #D5E0D9;
                  border-radius: 14px;
                  background: #FFFFFF;
                  font-family: 'Mulish', sans-serif;
                  font-size: 15px;
                  color: #2E3A38;
                  outline: none;
                `)}
              />

              {!desktop && (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  style={css(`
                    cursor: pointer;
                    box-sizing: border-box;
                    min-height: 48px;
                    display: flex;
                    align-items: center;
                    padding: 14px 22px;
                    border: 1px solid #D5E0D9;
                    border-radius: 14px;
                    background: #FFFFFF;
                    color: #2C4A5E;
                    font-size: 14.5px;
                    font-weight: 800;
                    white-space: nowrap;
                  `)}
                >
                  Filters
                </button>
              )}
            </div>

            {!loading && !error && sorted.length > 0 && (
              <div style={css('font-size: 13.5px; font-weight: 700; color: #687974;')}>
                {sorted.length} {sorted.length === 1 ? 'regeling' : 'regelingen'} · gesorteerd op eerstvolgende deadline
              </div>
            )}

            {loading && (
              <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                {['62%', '48%', '70%', '55%', '64%', '44%'].map((w, i) => (
                  <div key={i} style={css('padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}>
                    <div style={css(`height: 15px; width: ${w}; border-radius: 6px; background: #EDF2EF; margin-bottom: 12px;`)} />
                    <div style={css('height: 11px; width: 34%; border-radius: 6px; background: #F2F6F4;')} />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={css('padding: 26px 24px; border: 1px solid #EDD3CE; border-radius: 18px; background: #FDF6F5;')}>
                <div style={css('margin-bottom: 14px; font-size: 15.5px; font-weight: 700; color: #9E3B2C;')}>
                  De subsidieregelingen konden niet worden geladen. Probeer het opnieuw.
                </div>
                <button
                  type="button"
                  onClick={() => load()}
                  style={css(`
                    cursor: pointer;
                    min-height: 44px;
                    padding: 12px 22px;
                    border: none;
                    border-radius: 999px;
                    background: #2C4A5E;
                    color: #FFFFFF;
                    font-size: 14px;
                    font-weight: 800;
                  `)}
                >
                  Opnieuw proberen
                </button>
              </div>
            )}

            {!loading && !error && sorted.length === 0 && (
              <div style={css('padding: 34px 26px; border: 1px solid #E1EAE4; border-radius: 18px; background: #FFFFFF;')}>
                <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>
                  Geen subsidieregelingen gevonden
                </div>
                <div style={css('margin-bottom: 18px; font-size: 15px; line-height: 1.65; color: #4B5C58;')}>
                  Pas je filters aan of wis de filters om meer regelingen te bekijken.
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  style={css(`
                    cursor: pointer;
                    min-height: 44px;
                    padding: 12px 22px;
                    border: none;
                    border-radius: 999px;
                    background: #4E9A6C;
                    color: #FFFFFF;
                    font-size: 14px;
                    font-weight: 800;
                  `)}
                >
                  Wis filters
                </button>
              </div>
            )}

            {!loading && !error && shown.length > 0 && (
              <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                {(() => {
                  const firstLockedIndex = shown.findIndex((row) => getDeadlineAccess(row) === 'premium');
                  return shown.map((r, i) => {
                  const locked = getDeadlineAccess(r) === 'premium';
                  const days = daysLeft(r);
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.Open;
                  const urgent = days != null && days >= 0 && days <= 14;

                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCardClick(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCardClick(r);
                        }
                      }}
                      style={css(`
                        cursor: pointer;
                        padding: 18px 22px;
                        border: 1px solid #E1EAE4;
                        border-radius: 16px;
                        background: #FFFFFF;
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
                        gap: 14px 18px;
                        align-items: center;
                      `)}
                    >
                      <div style={css('min-width: 0;')}>
                        <div style={css('margin-bottom: 5px; font-size: 16px; font-weight: 800; color: #2C4A5E; text-wrap: pretty;')}>
                          {r.naam}
                        </div>
                        <div style={css('font-size: 13.5px; color: #687974;')}>
                          {locked ? `${r.thema || 'Discipline onbekend'} · ${r.regio}` : `${r.funder} · ${r.regio}`}
                        </div>
                      </div>

                      <div style={css('min-width: 0;')}>
                        <div style={css('margin-bottom: 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #9AA6A2;')}>
                          BEDRAG
                        </div>
                        {locked ? (
                          <div style={css('filter: blur(4.5px); user-select: none; font-size: 14.5px; font-weight: 700; color: #A9B5B1;')}>
                            € •••• – € ••••
                          </div>
                        ) : (
                          <div style={css('font-size: 14.5px; font-weight: 700; color: #2E3A38;')}>
                            {formatAmount(r.bedragMin, r.bedragMax)}
                          </div>
                        )}
                      </div>

                      <div style={css('min-width: 0;')}>
                        <div style={css('margin-bottom: 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #9AA6A2;')}>
                          DEADLINE
                        </div>
                        {locked ? (
                          <>
                            <div style={css('filter: blur(4.5px); user-select: none; font-size: 14.5px; font-weight: 700; color: #A9B5B1;')}>
                              •• d
                            </div>
                            {i === firstLockedIndex && (
                              <span style={css('display: inline-block; margin-top: 6px; font-size: 12.5px; font-weight: 800; color: #4E9A6C;')}>
                                Ontgrendel met Premium
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <div style={css(`
                              font-size: 14.5px;
                              font-weight: ${urgent ? 800 : 700};
                              color: ${urgent ? '#9E3B2C' : '#2C4A5E'};
                            `)}
                            >
                              {r.deadline ? (days != null && days >= 0 ? `${days}d` : 'Afgelopen') : 'Doorlopend'}
                            </div>
                            <div style={css('margin-top: 2px; font-size: 12.5px; color: #7B8985;')}>
                              {r.deadline ? formatDate(r.deadline) : 'geen vaste sluitingsdatum'}
                            </div>
                          </>
                        )}
                      </div>

                      <div style={css('display: flex; justify-content: flex-start;')}>
                        <span style={css(`
                          padding: 6px 14px;
                          border: 1px solid ${st.border};
                          border-radius: 999px;
                          background: ${st.bg};
                          color: ${st.color};
                          font-size: 12.5px;
                          font-weight: 800;
                          white-space: nowrap;
                        `)}
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            )}

            {shown.length < sorted.length && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                style={css(`
                  cursor: pointer;
                  box-sizing: border-box;
                  min-height: 48px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 14px 24px;
                  border: 1px solid #D5E0D9;
                  border-radius: 14px;
                  background: #FFFFFF;
                  color: #2C4A5E;
                  font-size: 14.5px;
                  font-weight: 800;
                `)}
              >
                Meer regelingen laden ({sorted.length - shown.length})
              </button>
            )}

            {lockedCount > 0 && (
              <div style={css(`
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                flex-wrap: wrap;
                padding: 18px 22px;
                border: 1px solid #D5E6DB;
                border-radius: 16px;
                background: #EAF4EE;
              `)}
              >
                <span style={css('flex: 1 1 280px; min-width: 0; font-size: 14px; font-weight: 700; color: #2F6D47; text-wrap: pretty;')}>
                  Nog {lockedCount} {lockedCount === 1 ? 'actuele regeling' : 'actuele regelingen'} met bedrag, deadline
                  en voorwaarden zichtbaar met Premium.
                </span>
                <button
                  type="button"
                  onClick={app.goAbonnementen}
                  style={css(`
                    cursor: pointer;
                    flex-shrink: 0;
                    padding: 11px 20px;
                    border: none;
                    border-radius: 999px;
                    background: #2C4A5E;
                    color: #FFFFFF;
                    font-size: 13.5px;
                    font-weight: 800;
                  `)}
                >
                  Bekijk alle deadlines met Premium
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {detail && (
        <div style={css(`
          position: fixed;
          inset: 0;
          z-index: 90;
          background: rgba(44,74,94,0.34);
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
        `)}
        >
          <div style={css(`
            width: min(520px, 100%);
            max-height: 100vh;
            overflow-y: auto;
            box-sizing: border-box;
            padding: clamp(22px, 3vw, 34px);
            background: #FFFFFF;
            border-radius: 24px 24px 0 0;
          `)}
          >
            <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px;')}>
              <span style={css("min-width: 0; font-family: 'Newsreader', serif; font-size: clamp(23px, 3vw, 28px); font-weight: 600; color: #2C4A5E; line-height: 1.25;")}>
                {detail.naam}
              </span>
              <button
                type="button"
                aria-label="Sluiten"
                onClick={() => setDetailId(null)}
                style={css(`
                  cursor: pointer;
                  flex-shrink: 0;
                  width: 44px;
                  height: 44px;
                  border: 1px solid #E1EAE4;
                  border-radius: 14px;
                  background: #FFFFFF;
                  color: #2C4A5E;
                  font-size: 18px;
                  font-weight: 700;
                `)}
              >
                ×
              </button>
            </div>

            <div style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;')}>
              <span style={css(`
                padding: 6px 14px;
                border: 1px solid ${(STATUS_STYLE[detail.status] || STATUS_STYLE.Open).border};
                border-radius: 999px;
                background: ${(STATUS_STYLE[detail.status] || STATUS_STYLE.Open).bg};
                color: ${(STATUS_STYLE[detail.status] || STATUS_STYLE.Open).color};
                font-size: 12.5px;
                font-weight: 800;
              `)}
              >
                {detail.status}
              </span>
              <span style={css('font-size: 14px; color: #687974;')}>{`${detail.funder} · ${detail.regio}`}</span>
              {detail.thema && (
                <span style={css('padding: 3px 10px; border-radius: 999px; background: #F2F6F4; color: #4B5C58; font-size: 11.5px; font-weight: 700;')}>
                  {detail.thema}
                </span>
              )}
            </div>

            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 12px; margin-bottom: 18px;')}>
              {[
                ['BEDRAG', formatAmount(detail.bedragMin, detail.bedragMax)],
                detail.bandbreedteBijdrage ? ['BANDBREEDTE BIJDRAGE', detail.bandbreedteBijdrage] : null,
                [
                  'DEADLINE',
                  detail.deadline
                    ? (daysLeft(detail) != null && daysLeft(detail) < 0
                        ? `Afgelopen · ${formatDate(detail.deadline)}`
                        : `${daysLeft(detail)} dagen · ${formatDate(detail.deadline)}`)
                    : 'Doorlopend, geen vaste sluitingsdatum',
                ],
                // Meerdere aanvraagrondes: beoordelingsdatum/-periode komen uit
                // dezelfde eerstvolgende-ronde als de DEADLINE-tegel hierboven
                // (subsidieregeling_volgende_ronde) — geen eigen logica.
                detail.beoordelingsdatum || detail.beoordelingsperiode
                  ? ['BEOORDELING', detail.beoordelingsdatum ? formatDate(detail.beoordelingsdatum) : detail.beoordelingsperiode]
                  : null,
              ]
                .filter(Boolean)
                .map(([label, value]) => (
                <div key={label} style={css('padding: 16px 18px; border: 1px solid #E1EAE4; border-radius: 14px; background: #F7F9F8;')}>
                  <div style={css('margin-bottom: 5px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #9AA6A2;')}>
                    {label}
                  </div>
                  <div style={css('font-size: 15px; font-weight: 700; color: #2C4A5E;')}>{value}</div>
                </div>
              ))}
            </div>

            {detail.rondesAantal > 1 && (
              <div style={css('margin: -8px 0 16px; font-size: 13px; color: #7B8985;')}>
                Volgende ronde van in totaal {detail.rondesAantal} aanvraagrondes voor deze regeling.
              </div>
            )}

            {detail.omschrijving && (
              <div style={css('margin-bottom: 16px;')}>
                <div style={css('margin-bottom: 7px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.05em; color: #2C4A5E;')}>
                  {detail.bronType === 'funder' ? 'OVER DIT FONDS' : 'OVER DEZE REGELING'}
                </div>
                <div style={css('font-size: 15px; line-height: 1.7; color: #4B5C58; white-space: pre-wrap;')}>
                  {detail.omschrijving}
                </div>
              </div>
            )}

            {detail.voorwaarden && (
              <div style={css('margin-bottom: 16px;')}>
                <div style={css('margin-bottom: 7px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.05em; color: #2C4A5E;')}>
                  {detail.bronType === 'funder' ? 'TOELICHTING' : 'VOORWAARDEN'}
                </div>
                <div style={css('font-size: 15px; line-height: 1.7; color: #4B5C58; white-space: pre-wrap;')}>
                  {detail.voorwaarden}
                </div>
              </div>
            )}

            {!detail.omschrijving && !detail.voorwaarden && (
              <div style={css('margin-bottom: 16px; padding: 14px 16px; border: 1px dashed #D5E0D9; border-radius: 14px; font-size: 14.5px; line-height: 1.65; color: #7B8985;')}>
                {detail.bronType === 'funder'
                  ? 'Omschrijving en toelichting komen uit de database. Zodra dit fonds daar is aangevuld, staan ze hier.'
                  : 'Omschrijving en voorwaarden komen uit de database. Zodra deze regeling daar is aangevuld, staan ze hier.'}
              </div>
            )}

            {(() => {
              const kans = kansrijkheid(detail, store.orgProfile || {}, store.projects);

              return (
                <div style={css(`margin-bottom: 16px; padding: 16px 18px; border: 1px solid ${kans.border}; border-radius: 16px; background: ${kans.bg};`)}>
                  <div style={css(`margin-bottom: 6px; font-size: 13px; font-weight: 800; color: ${kans.color};`)}>
                    {kans.label}
                  </div>
                  <div style={css('font-size: 14px; line-height: 1.65; color: #4B5C58; text-wrap: pretty;')}>{kans.tekst}</div>
                </div>
              );
            })()}

            {/* Een funder-breed datamoment (bronType 'funder') heeft geen eigen
                regeling om in een project op te nemen — dekkingsplannen zijn
                gekoppeld aan een subsidieregeling, niet aan een fonds als
                geheel. Voor deze kaarten blijft alleen de bronlink hieronder
                over. */}
            {detail.bronType !== 'funder' && (
            <div style={css('margin-bottom: 16px; padding-top: 16px; border-top: 1px solid #E1EAE4;')}>
              <div style={css('margin-bottom: 6px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
                Opnemen in een project
              </div>

              {!paid && (
                <div style={css('font-size: 14px; line-height: 1.65; color: #4B5C58;')}>
                  Met Pro en Premium legt u projecten vast en neemt u regelingen op in uw dekkingsplan.{' '}
                  <button
                    type="button"
                    onClick={app.goAbonnementen}
                    style={css("cursor: pointer; border: none; background: none; padding: 0; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #4E9A6C;")}
                  >
                    Bekijk de abonnementen
                  </button>
                </div>
              )}

              {paid && !store.projects.length && (
                <div style={css('font-size: 14px; line-height: 1.65; color: #4B5C58;')}>
                  U heeft nog geen project vastgelegd. Maak er een aan bij Projecten, dan kunt u regelingen in het
                  dekkingsplan opnemen.
                </div>
              )}

              {paid && store.projects.length > 0 && (
                <>
                  <div style={css('margin-bottom: 14px; font-size: 14px; line-height: 1.65; color: #4B5C58;')}>
                    Zet deze regeling in het dekkingsplan van een van uw projecten. Subsidie Kompas neemt de deadline en
                    het bedrag mee.
                  </div>
                  <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
                    <select
                      value={projectId || store.projects[0].id}
                      onChange={(e) => { setProjectId(e.target.value); setAddMsg(''); }}
                      aria-label="Kies een project"
                      style={css(`
                        flex: 1 1 200px;
                        min-width: 0;
                        box-sizing: border-box;
                        min-height: 46px;
                        padding: 12px 14px;
                        border: 1px solid #D5E0D9;
                        border-radius: 12px;
                        background: #FFFFFF;
                        font-family: 'Mulish', sans-serif;
                        font-size: 14.5px;
                        font-weight: 700;
                        color: #2C4A5E;
                        outline: none;
                      `)}
                    >
                      {store.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.naam || 'Naamloos project'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const id = projectId || store.projects[0].id;
                        const naam = (store.projects.find((p) => p.id === id) || {}).naam || 'uw project';

                        store.addRegelingToProject(
                          {
                            id: detail.id,
                            naam: detail.naam,
                            funder: detail.funder,
                            deadline: detail.deadline,
                            status: detail.status,
                            bedragMax: detail.bedragMax,
                          },
                          id,
                        );

                        setAddMsg(`${detail.naam} is opgenomen in ${naam}.`);
                      }}
                      style={css(`
                        cursor: pointer;
                        box-sizing: border-box;
                        min-height: 46px;
                        padding: 13px 22px;
                        border: none;
                        border-radius: 999px;
                        background: #4E9A6C;
                        color: #FFFFFF;
                        font-family: 'Mulish', sans-serif;
                        font-size: 14.5px;
                        font-weight: 800;
                      `)}
                    >
                      Toevoegen
                    </button>
                  </div>
                </>
              )}

              {addMsg && (
                <div style={css('margin-top: 14px; padding: 13px 16px; border: 1px solid #BFD4C6; border-radius: 12px; background: #EAF4EE; font-size: 14.5px; font-weight: 700; color: #2F6D47;')}>
                  {addMsg}
                </div>
              )}
            </div>
            )}

            {detail.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                style={css('display: inline-block; font-size: 14.5px; font-weight: 800; color: #4E9A6C;')}
              >
                Naar de website van de verstrekker →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Upgradekaart voor vergrendelde regelingen — bewust een volledig
          andere kaart dan de detailkaart hierboven (geen gedeelde state,
          geen gedeelde opmaak), zodat direct duidelijk is waarom de
          ervaring verschilt. Toont uitsluitend wat al op de kaart zelf
          zichtbaar was (naam, discipline, werkgebied, status) — geen bedrag, geen
          deadline, geen voorwaarden, geen verstrekker: die velden heeft
          de database voor deze regeling nooit meegestuurd. */}
      {upgradeRow && (
        <div style={css(`
          position: fixed;
          inset: 0;
          z-index: 90;
          background: rgba(44,74,94,0.34);
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
        `)}
        >
          <div style={css(`
            width: min(480px, 100%);
            max-height: 100vh;
            overflow-y: auto;
            box-sizing: border-box;
            padding: clamp(22px, 3vw, 34px);
            background: #FFFFFF;
            border-radius: 24px 24px 0 0;
            border-top: 4px solid #4E9A6C;
          `)}
          >
            <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px;')}>
              <div style={css('min-width: 0;')}>
                <div style={css('display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 5px 12px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em;')}>
                  PRO &amp; PREMIUM
                </div>
                <div style={css("font-family: 'Newsreader', serif; font-size: clamp(21px, 2.8vw, 25px); font-weight: 600; color: #2C4A5E; line-height: 1.25;")}>
                  {upgradeRow.naam}
                </div>
              </div>
              <button
                type="button"
                aria-label="Sluiten"
                onClick={() => setUpgradeId(null)}
                style={css(`
                  cursor: pointer;
                  flex-shrink: 0;
                  width: 44px;
                  height: 44px;
                  border: 1px solid #E1EAE4;
                  border-radius: 14px;
                  background: #FFFFFF;
                  color: #2C4A5E;
                  font-size: 18px;
                  font-weight: 700;
                `)}
              >
                ×
              </button>
            </div>

            <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;')}>
              <span style={css(`
                padding: 6px 14px;
                border: 1px solid ${(STATUS_STYLE[upgradeRow.status] || STATUS_STYLE.Open).border};
                border-radius: 999px;
                background: ${(STATUS_STYLE[upgradeRow.status] || STATUS_STYLE.Open).bg};
                color: ${(STATUS_STYLE[upgradeRow.status] || STATUS_STYLE.Open).color};
                font-size: 12.5px;
                font-weight: 800;
              `)}
              >
                {upgradeRow.status}
              </span>
              <span style={css('font-size: 14px; color: #687974;')}>
                {`${upgradeRow.thema || 'Discipline onbekend'} · ${upgradeRow.regio}`}
              </span>
            </div>

            <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; line-height: 1.3;")}>
              Geïnteresseerd in deze subsidieregeling?
            </div>

            <div style={css('margin-bottom: 18px; font-size: 15px; line-height: 1.7; color: #4B5C58;')}>
              Met een Pro- of Premium-abonnement krijgt u toegang tot:
            </div>

            <div style={css('display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;')}>
              {[
                'Uitgebreide informatie over deze regeling',
                'Alle subsidiedetails: bedrag, deadline en voorwaarden',
                'Aanvullende, vergelijkbare subsidiemogelijkheden',
                'AI-matching op uw organisatieprofiel',
                'Extra functionaliteiten van Subsidie Kompas',
              ].map((t) => (
                <div key={t} style={css('display: flex; gap: 10px; align-items: flex-start;')}>
                  <span style={css('flex-shrink: 0; width: 15px; color: #4E9A6C; font-size: 13px; font-weight: 700; line-height: 1.6;')}>
                    ✓
                  </span>
                  <span style={css('font-size: 14.5px; line-height: 1.6; color: #3D4B48;')}>{t}</span>
                </div>
              ))}
            </div>

            <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
              <button
                type="button"
                onClick={() => { setUpgradeId(null); app.goAbonnementen(); }}
                style={css(`
                  cursor: pointer;
                  box-sizing: border-box;
                  min-height: 48px;
                  border: none;
                  border-radius: 999px;
                  background: #2C4A5E;
                  color: #FFFFFF;
                  font-family: 'Mulish', sans-serif;
                  font-size: 14.5px;
                  font-weight: 800;
                `)}
              >
                Bekijk Premium
              </button>
              <button
                type="button"
                onClick={() => { setUpgradeId(null); app.goAbonnementen(); }}
                style={css(`
                  cursor: pointer;
                  box-sizing: border-box;
                  min-height: 48px;
                  border: 1.5px solid #A8D5BA;
                  border-radius: 999px;
                  background: #FFFFFF;
                  color: #2C4A5E;
                  font-family: 'Mulish', sans-serif;
                  font-size: 14.5px;
                  font-weight: 800;
                `)}
              >
                Bekijk Pro
              </button>
              <button
                type="button"
                onClick={() => { setUpgradeId(null); app.goAbonnementen(); }}
                style={css(`
                  cursor: pointer;
                  min-height: 40px;
                  border: none;
                  background: none;
                  font-family: 'Mulish', sans-serif;
                  font-size: 13.5px;
                  font-weight: 700;
                  color: #4E9A6C;
                `)}
              >
                Vergelijk abonnementen
              </button>
            </div>
          </div>
        </div>
      )}

      {!desktop && sheetOpen && (
        <div style={css('position: fixed; inset: 0; z-index: 80; background: rgba(44,74,94,0.32); display: flex; align-items: flex-end;')}>
          <div style={css(`
            width: 100%;
            max-height: 82vh;
            overflow-y: auto;
            box-sizing: border-box;
            padding: 22px clamp(16px, 5vw, 24px) 28px;
            border-radius: 24px 24px 0 0;
            background: #FFFFFF;
            display: flex;
            flex-direction: column;
            gap: 22px;
          `)}
          >
            <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px;')}>
              <span style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>
                Filters
              </span>
              <button
                type="button"
                aria-label="Sluiten"
                onClick={() => setSheetOpen(false)}
                style={css(`
                  cursor: pointer;
                  width: 44px;
                  height: 44px;
                  border: 1px solid #E1EAE4;
                  border-radius: 14px;
                  background: #FFFFFF;
                  color: #2C4A5E;
                  font-size: 18px;
                  font-weight: 700;
                `)}
              >
                ×
              </button>
            </div>

            {filters}

            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              style={css(`
                cursor: pointer;
                box-sizing: border-box;
                min-height: 48px;
                border: none;
                border-radius: 999px;
                background: #4E9A6C;
                color: #FFFFFF;
                font-size: 14.5px;
                font-weight: 800;
              `)}
            >
              Toon resultaten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
