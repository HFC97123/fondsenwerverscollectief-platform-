// Beheer · Deadlines: regelingen los toevoegen of via CSV importeren.
// Schrijft nu naar de lokale lijst; vervang saveRegeling/importeer door
// Supabase-writes op subsidieregelingen_tijdlijn en subsidieregelingen.
import React, { useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useKompas } from '../kompas-app/KompasStore.jsx';
import { Button, Label, Melding, SectieKop, inputStyle, selectStyle } from '../website/legacyUi.jsx';

const STATUSSEN = ['Open', 'Binnenkort', 'Doorlopend', 'Aangekondigd', 'Budget uitgeput', 'Gesloten'];
const TYPEN = ['Vermogensfonds', 'Gemeente', 'Provincie', 'Corporate Foundation', 'Rijksfonds'];

const LEEG = {
  id: null,
  naam: '',
  funder: '',
  funderType: '',
  regio: '',
  thema: '',
  status: 'Open',
  deadline: '',
  bedragMin: '',
  bedragMax: '',
};

// CSV-kolommen; per veld de namen die we accepteren.
const KOLOMMEN = {
  naam: ['naam', 'regeling', 'regelingnaam'],
  funder: ['verstrekker', 'funder', 'fonds'],
  funderType: ['type', 'type verstrekker', 'fundertype'],
  regio: ['regio'],
  thema: ['thema'],
  status: ['status'],
  deadline: ['deadline', 'deadline_datum', 'sluitingsdatum'],
  bedragMin: ['bedrag_min', 'bedrag vanaf', 'bedragmin'],
  bedragMax: ['bedrag_max', 'bedrag tot', 'bedragmax'],
};

function getal(waarde) {
  const cijfers = String(waarde == null ? '' : waarde).replace(/[^0-9]/g, '');

  return cijfers ? Number(cijfers) : null;
}

export default function AdminDeadlines() {
  const store = useKompas();
  const regelingen = store.deadlines || [];

  const [form, setForm] = useState(null);
  const [melding, setMelding] = useState('');
  const [fout, setFout] = useState('');

  // Houdt vrij ingetypte waarden consistent: spaties eraf en hergebruik van een
  // bestaande schrijfwijze, zodat de filters op de pagina niet uiteenlopen.
  const bestaand = useMemo(
    () => (veld, waarde) => {
      const v = String(waarde || '').trim();

      if (!v) {
        return '';
      }

      const match = regelingen
        .map((r) => r[veld])
        .filter(Boolean)
        .find((x) => String(x).toLowerCase() === v.toLowerCase());

      return match || v;
    },
    [regelingen],
  );

  const opslaan = () => {
    const datum = String(form.deadline || '').trim();

    if (!String(form.naam || '').trim()) {
      setFout('Vul de naam van de regeling in.');

      return;
    }

    if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setFout('De deadline moet als jjjj-mm-dd worden ingevuld, bijvoorbeeld 2026-09-15. Laat het veld leeg bij een doorlopende regeling.');

      return;
    }

    const schoon = {
      ...form,
      naam: String(form.naam).trim(),
      funder: String(form.funder || '').trim() || '—',
      funderType: bestaand('funderType', form.funderType),
      regio: bestaand('regio', form.regio) || 'Nederland',
      thema: bestaand('thema', form.thema),
      status: String(form.status || 'Open').trim(),
      deadline: datum || null,
      dagen: null,
      bedragMin: getal(form.bedragMin),
      bedragMax: getal(form.bedragMax),
    };

    store.saveRegeling(schoon);
    setForm(null);
    setFout('');
    setMelding('Regeling opgeslagen.');
  };

  const importeer = (e) => {
    const file = (e.target.files || [])[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const tekst = String(reader.result || '').replace(/\r/g, '');
      const regels = tekst.split('\n').filter((l) => l.trim());

      if (!regels.length) {
        setMelding('Het bestand bevat geen regels.');

        return;
      }

      const sep = regels[0].indexOf(';') !== -1 ? ';' : ',';
      const kop = regels[0].split(sep).map((h) => h.trim().toLowerCase());
      const index = {};

      Object.keys(KOLOMMEN).forEach((veld) => {
        index[veld] = KOLOMMEN[veld].reduce((gevonden, naam) => (gevonden !== -1 ? gevonden : kop.indexOf(naam)), -1);
      });

      if (index.naam === -1) {
        setMelding('Kolom met de naam van de regeling niet gevonden. Verwacht een kolom "naam" of "regeling".');

        return;
      }

      const nieuw = [];
      let overgeslagen = 0;

      for (let i = 1; i < regels.length; i += 1) {
        const cellen = regels[i].split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
        const val = (veld) => (index[veld] === -1 ? '' : cellen[index[veld]] || '');

        if (!val('naam')) {
          continue;
        }

        const sleutel = `${val('naam')}|${val('funder')}`.toLowerCase();
        const dubbel = regelingen
          .concat(nieuw)
          .some((r) => `${String(r.naam || '')}|${String(r.funder || '')}`.toLowerCase() === sleutel);

        if (dubbel) {
          overgeslagen += 1;
          continue;
        }

        nieuw.push({
          id: `imp${Date.now()}-${i}`,
          naam: val('naam'),
          funder: val('funder') || '—',
          funderType: val('funderType'),
          regio: val('regio') || 'Nederland',
          thema: val('thema'),
          status: val('status') || 'Open',
          deadline: val('deadline') || null,
          dagen: null,
          bedragMin: getal(val('bedragMin')),
          bedragMax: getal(val('bedragMax')),
        });
      }

      store.importRegelingen(nieuw);
      setMelding(
        `${nieuw.length} ${nieuw.length === 1 ? 'regeling' : 'regelingen'} toegevoegd.${
          overgeslagen ? ` ${overgeslagen} dubbele overgeslagen.` : ''
        }`,
      );
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const velden = [
    { n: 'naam', l: 'Naam van de regeling', breed: true },
    { n: 'funder', l: 'Verstrekker' },
    { n: 'funderType', l: 'Type verstrekker', opties: TYPEN },
    { n: 'regio', l: 'Regio' },
    { n: 'thema', l: 'Thema' },
    { n: 'status', l: 'Status', opties: STATUSSEN },
    { n: 'deadline', l: 'Deadline als jjjj-mm-dd, leeg bij doorlopend' },
    { n: 'bedragMin', l: 'Bedrag vanaf' },
    { n: 'bedragMax', l: 'Bedrag tot' },
  ];

  return (
    <div>
      <div style={css('margin-bottom: 28px; padding: clamp(20px, 3vw, 28px); border: 1px solid #D5E0D9; border-radius: 20px; background: #FFFFFF;')}>
        <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: clamp(21px, 2.8vw, 25px); color: #2C4A5E;")}>
          Regelingen uploaden
        </div>
        <div style={css('margin-bottom: 18px; max-width: 680px; font-size: 15px; line-height: 1.65; color: #536460;')}>
          Upload een CSV-bestand met de kolommen naam, verstrekker, type, regio, thema, status, deadline, bedrag_min en
          bedrag_max. Een deadline noteert u als jjjj-mm-dd; laat het veld leeg bij doorlopende regelingen. Nieuwe
          regelingen komen bovenaan de Deadlines-pagina te staan.
        </div>

        <div style={css('display: flex; gap: 12px; flex-wrap: wrap; align-items: center;')}>
          <label style={css(`
            cursor: pointer;
            box-sizing: border-box;
            min-height: 46px;
            display: inline-flex;
            align-items: center;
            padding: 13px 22px;
            border-radius: 999px;
            background: #4E9A6C;
            color: #FFFFFF;
            font-family: 'Mulish', sans-serif;
            font-size: 14.5px;
            font-weight: 800;
          `)}
          >
            CSV-bestand kiezen
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={importeer}
              style={css('position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden;')}
            />
          </label>

          <Button
            variant="danger"
            onClick={() => { store.clearRegelingen(); setMelding('Alle regelingen verwijderd.'); }}
          >
            Alle regelingen verwijderen
          </Button>
        </div>

        <Melding>{melding}</Melding>
      </div>

      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;')}>
        <span style={css('font-size: 14.5px; font-weight: 700; color: #687974;')}>
          {`${regelingen.length} ${regelingen.length === 1 ? 'regeling' : 'regelingen'} in de database`}
        </span>
        {!form && (
          <Button onClick={() => { setForm({ ...LEEG, id: `d${Date.now()}` }); setFout(''); setMelding(''); }}>
            + Regeling toevoegen
          </Button>
        )}
      </div>

      {form && (
        <div style={css('margin-bottom: 28px; padding: clamp(20px, 3vw, 28px); border: 1px solid #D5E0D9; border-radius: 20px; background: #FFFFFF;')}>
          <SectieKop>{String(form.naam || '').trim() || 'Nieuwe regeling'}</SectieKop>

          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 18px;')}>
            {velden.map((f) => (
              <Label key={f.n} style={f.breed ? { gridColumn: 'span 2' } : undefined}>
                {f.l}
                {f.opties ? (
                  <select
                    value={form[f.n] || ''}
                    onChange={(e) => { setForm({ ...form, [f.n]: e.target.value }); setFout(''); }}
                    style={{ ...selectStyle, width: '100%' }}
                  >
                    <option value="">Niet ingevuld</option>
                    {f.opties.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form[f.n] == null ? '' : String(form[f.n])}
                    onChange={(e) => { setForm({ ...form, [f.n]: e.target.value }); setFout(''); }}
                    style={inputStyle}
                  />
                )}
              </Label>
            ))}
          </div>

          {fout && (
            <div style={css('margin-top: 20px; padding: 14px 18px; border: 1px solid #EDD3CE; border-radius: 14px; background: #FDF6F5; font-size: 14.5px; line-height: 1.6; font-weight: 700; color: #9E3B2C;')}>
              {fout}
            </div>
          )}

          <div style={css('margin-top: 26px; display: flex; gap: 12px; flex-wrap: wrap;')}>
            <Button onClick={opslaan}>Regeling opslaan</Button>
            <Button variant="outline" onClick={() => { setForm(null); setFout(''); }}>
              Annuleren
            </Button>
          </div>
        </div>
      )}

      <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
        {regelingen.map((r) => (
          <div key={r.id} style={css('display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 15px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}>
            <div style={css('flex: 1 1 240px; min-width: 0;')}>
              <div style={css('font-size: 15px; font-weight: 800; color: #2C4A5E;')}>{r.naam}</div>
              <div style={css('margin-top: 4px; font-size: 13px; color: #7B8985;')}>
                {[r.funder, r.regio, r.deadline || 'doorlopend'].filter(Boolean).join('  ·  ')}
              </div>
            </div>

            <span style={css('padding: 5px 13px; border-radius: 999px; background: #EAF1F6; color: #2C4A5E; font-size: 12px; font-weight: 800;')}>
              {r.status}
            </span>

            <span style={css('display: flex; gap: 14px; flex-shrink: 0;')}>
              <button
                type="button"
                onClick={() => { setForm({ ...LEEG, ...r }); setFout(''); setMelding(''); }}
                style={css("cursor: pointer; min-height: 44px; display: flex; align-items: center; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700; color: #2C4A5E;")}
              >
                Bewerken
              </button>
              <button
                type="button"
                onClick={() => { store.deleteRegeling(r.id); setMelding('Regeling verwijderd.'); }}
                style={css("cursor: pointer; min-height: 44px; display: flex; align-items: center; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700; color: #9E3B2C;")}
              >
                Verwijderen
              </button>
            </span>
          </div>
        ))}

        {!regelingen.length && (
          <div style={css('padding: 24px 20px; border: 1px dashed #D5E0D9; border-radius: 16px; font-size: 14.5px; line-height: 1.65; color: #7B8985;')}>
            Nog geen regelingen. Upload een CSV-bestand of voeg er handmatig een toe.
          </div>
        )}
      </div>
    </div>
  );
}
