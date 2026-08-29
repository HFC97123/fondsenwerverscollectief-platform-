// Documentatie: alles wat Subsidie Kompas opmaakt, met versies en
// projectkoppeling. Klik een naam om er in de chat mee verder te werken.
import React, { useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';
import { Button, EmptyState, Notice, Panel, PanelHeader, selectStijl } from '../../shared/ui/index.js';

const TYPE_STIJL = {
  Word: { label: 'DOCX', bg: '#EAF1F6', color: '#2C4A5E' },
  PDF: { label: 'PDF', bg: '#F9ECEA', color: '#9E3B2C' },
  Excel: { label: 'XLSX', bg: '#EAF4EE', color: '#2F6D47' },
};

const FILTERS = [
  ['alle', 'Alle documentatie'],
  ['Word', 'Word'],
  ['Excel', 'Excel'],
  ['PDF', 'PDF'],
];

export default function DocumentatiePage() {
  const app = useApp();
  const store = useKompas();
  const paid = ['pro', 'premium'].indexOf(app.subscriptionTier || 'free') !== -1;

  const [filter, setFilter] = useState('alle');
  const [melding, setMelding] = useState('');

  if (!paid) {
    return (
      <Panel>
        <PanelHeader title="Documentatie"
          intro="Met Pro en Premium maakt Subsidie Kompas projectplannen en aanvragen in Word, begrotingen in Excel en definitieve versies in pdf. Ze komen hier terecht, met versies en een koppeling aan uw projecten."
        />
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Panel>
    );
  }

  const alle = store.genDocs || [];
  const zichtbaar = alle.filter((d) => filter === 'alle' || d.soort === filter);
  const projectNaam = (id) => (store.projects.find((p) => p.id === id) || {}).naam || 'Geen project';

  const openInChat = (doc) => {
    store.patch({ activeDoc: { id: doc.id, naam: doc.naam, soort: doc.soort, projectId: doc.projectId || '' } });
    window.location.hash = '#/subsidie-kompas';
  };

  const actieStyle = (kleur) =>
    css(`
      cursor: pointer;
      min-height: 44px;
      display: flex;
      align-items: center;
      border: none;
      background: none;
      padding: 0;
      font-family: 'Mulish', sans-serif;
      font-size: 13.5px;
      font-weight: 700;
      color: ${kleur};
    `);

  return (
    <Panel>
      <PanelHeader title="Documentatie"
        intro="Alles wat Subsidie Kompas voor u opmaakt komt hier terecht: projectplannen en aanvragen in Word, begrotingen en dekkingsplannen in Excel, en definitieve versies in pdf. Koppel elk document aan een project, zodat uw documentatie bij de juiste aanvraag blijft. Klik op een naam om er in de chat mee verder te werken."
      />

      <div style={css('display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px;')}>
        {FILTERS.map(([value, label]) => {
          const actief = filter === value;
          const aantal = value === 'alle' ? alle.length : alle.filter((d) => d.soort === value).length;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={actief}
              onClick={() => { setFilter(value); setMelding(''); }}
              style={css(`
                cursor: pointer;
                box-sizing: border-box;
                min-height: 40px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 10px 16px;
                border: 1px solid ${actief ? '#BFD4C6' : '#E1EAE4'};
                border-radius: 999px;
                background: ${actief ? '#EAF4EE' : '#FFFFFF'};
                color: ${actief ? '#2F6D47' : '#3D4B48'};
                font-family: 'Mulish', sans-serif;
                font-size: 13.5px;
                font-weight: 700;
              `)}
            >
              <span>{label}</span>
              <span style={css('font-size: 12px; color: #7B8985;')}>{aantal}</span>
            </button>
          );
        })}
      </div>

      {zichtbaar.length > 0 && (
        <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
          {zichtbaar.map((d) => {
            const stijl = TYPE_STIJL[d.soort] || TYPE_STIJL.Word;
            const versies = (d.versies || []).slice().reverse();

            return (
              <div key={d.id} style={css('display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 15px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8;')}>
                <span style={css(`
                  flex-shrink: 0;
                  padding: 7px 11px;
                  border-radius: 9px;
                  background: ${stijl.bg};
                  color: ${stijl.color};
                  font-size: 11px;
                  font-weight: 800;
                  letter-spacing: 0.04em;
                `)}
                >
                  {stijl.label}
                </span>

                <button
                  type="button"
                  onClick={() => openInChat(d)}
                  style={css('cursor: pointer; flex: 1 1 220px; min-width: 0; border: none; background: none; padding: 0; text-align: left;')}
                >
                  <span style={css("display: block; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; color: #2C4A5E; overflow-wrap: anywhere;")}>
                    {d.naam}
                  </span>
                  <span style={css("display: block; margin-top: 3px; font-family: 'Mulish', sans-serif; font-size: 12.5px; color: #7B8985;")}>
                    {`Versie ${d.versie || 1}  ·  ${d.gemaakt}  ·  ${d.grootte}  ·  openen in de chat`}
                  </span>
                </button>

                <select
                  value={d.projectId || ''}
                  onChange={(e) => { store.setDocProject(d.id, e.target.value); setMelding(`${d.naam} staat nu bij ${projectNaam(e.target.value)}.`); }}
                  aria-label="Koppel aan project"
                  style={{ ...selectStijl, flex: '0 1 200px', minWidth: 0 }}
                >
                  <option value="">Geen project</option>
                  {store.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.naam || 'Naamloos project'}
                    </option>
                  ))}
                </select>

                <span style={css('display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;')}>
                  <button
                    type="button"
                    onClick={() => { store.newDocVersion(d.id); setMelding(`${d.naam} is bewaard als versie ${(d.versie || 1) + 1}. De vorige versie blijft beschikbaar.`); }}
                    style={actieStyle('#2C4A5E')}
                  >
                    Nieuwe versie
                  </button>
                  <span style={{ ...actieStyle('#4E9A6C'), fontWeight: 800 }}>Downloaden ↓</span>
                  <button
                    type="button"
                    onClick={() => { store.deleteDoc(d.id); setMelding('Document verwijderd.'); }}
                    style={actieStyle('#9E3B2C')}
                  >
                    Verwijderen
                  </button>
                </span>

                {versies.length > 0 && (
                  <span style={css('flex: 1 1 100%; display: flex; flex-direction: column; gap: 6px; padding-top: 12px; border-top: 1px solid #E4EBE7;')}>
                    {versies.map((v) => (
                      <span key={v.v} style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12.5px; color: #7B8985;')}>
                        <span>{`Versie ${v.v}  ·  ${v.gemaakt}  ·  ${v.grootte}`}</span>
                        <span style={css('font-weight: 700; color: #4E9A6C; cursor: pointer;')}>Downloaden ↓</span>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!alle.length && (
        <EmptyState title="Nog geen documentatie"
          text="Vraag Subsidie Kompas om een projectplan, begroting of aanvraag op te maken. Het document komt daarna hier te staan."
        />
      )}

      {alle.length > 0 && !zichtbaar.length && (
        <div style={css('padding: 20px 18px; border: 1px dashed #D5E0D9; border-radius: 16px; font-size: 14.5px; color: #7B8985;')}>
          Geen documentatie van dit type.
        </div>
      )}

      <Notice>{melding}</Notice>
    </Panel>
  );
}
