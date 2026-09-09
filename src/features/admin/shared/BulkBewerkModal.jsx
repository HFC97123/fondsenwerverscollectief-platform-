// Volwaardige bulk-editor (vervolgopdracht): vervangt niets van de
// bestaande single-actie bulkbalk (AdminAccessTierBulkActie blijft bestaan
// en wordt hier gewoon ook aangeroepen als "Toegangsniveau" wordt
// aangevinkt) - dit is een extra, generieke modal die AdminFunders.jsx en
// AdminDeadlines.jsx allebei met hun eigen veldenlijst hergebruiken, in
// plaats van dat elk scherm zijn eigen bulk-editor bouwt.
//
// Twee stappen in dezelfde modal (hergebruikt AdminEditModal als schil,
// geen tweede modalpatroon):
//   1. "configureren" - per veld een checkbox; alleen aangevinkte velden
//      krijgen een invoercontrole. Nooit een bestaande waarde vooraf
//      ingevuld (dat zou bij gemengde waarden misleidend zijn) - in plaats
//      daarvan een kleine, informatieve regel per veld ("Huidig: Premium
//      (alle geselecteerde)" of "Huidig: gemengde waarden"), berekend uit
//      de al geladen rijen van de huidige pagina/selectie - geen extra
//      requests per veld.
//   2. "bevestigen" - samenvatting van alle wijzigingen + aantal records,
//      met een expliciete "Wijzigingen toepassen"-knop. Nooit direct
//      toepassen vanuit stap 1.
//
// Voor classificatievelden (disciplines/doelgroepen/werkgebieden) toont dit
// bewust geen "huidige waarde" - dat zou per record kunnen verschillen en
// zou N extra koppelingen-ophalingen vergen voor een informatieve regel die
// voor Toevoegen/Verwijderen niet eens relevant is (die werken ongeacht de
// huidige staat); alleen "Vervangen" overschrijft alles, en dat wordt in de
// samenvatting expliciet en duidelijk benoemd.
import React, { useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import ClassificatieSelect from '../../../shared/ui/ClassificatieSelect.jsx';
import AdminEditModal from './AdminEditModal.jsx';
import { inputStyle } from './adminStyles.js';

const ACTIE_OPTIES = [
  { value: 'add', label: 'Toevoegen' },
  { value: 'remove', label: 'Verwijderen' },
  { value: 'replace', label: 'Vervangen' },
];

function samenvatWaarde(rijen, accessor) {
  if (!rijen.length) {
    return { mixed: false, waarde: undefined };
  }

  const waarden = new Set(rijen.map((r) => accessor(r)));

  if (waarden.size === 1) {
    return { mixed: false, waarde: [...waarden][0] };
  }

  return { mixed: true, waarde: undefined };
}

function HuidigeWaardeInfo({ rijen, veld }) {
  if (veld.kind === 'classificatie') {
    return (
      <p style={css('margin: 4px 0 0; font-size: 12px; color: #82918B;')}>
        De huidige koppelingen kunnen per record verschillen — die worden hier niet vooraf getoond.
      </p>
    );
  }

  const { mixed, waarde } = samenvatWaarde(rijen, veld.accessor);
  const label = mixed ? 'gemengde waarden' : veld.labelVoorWaarde ? veld.labelVoorWaarde(waarde) : waarde || '—';

  return (
    <p style={css('margin: 4px 0 0; font-size: 12px; color: #82918B;')}>
      Huidig: {mixed ? <em>gemengde waarden</em> : label} {mixed ? '' : '(alle geselecteerde)'}
    </p>
  );
}

// veld.kind: 'single' | 'classificatie'
// single: { key, label, control: 'select'|'text', opties?, placeholder?, accessor, labelVoorWaarde? }
// classificatie: { key, label, opties }
export default function BulkBewerkModal({ titel, aantal, rijen, velden, onCancel, onBevestig, bezig, fout }) {
  const [stap, setStap] = useState('configureren');
  const [aangevinkt, setAangevinkt] = useState({});
  const [waarden, setWaarden] = useState({});
  const [classificatieActies, setClassificatieActies] = useState({});
  const [classificatieWaarden, setClassificatieWaarden] = useState({});

  const toggleVeld = (key, kind) => {
    setAangevinkt((cur) => {
      const nu = !cur[key];
      const volgende = { ...cur, [key]: nu };

      if (nu && kind === 'single' && !(key in waarden)) {
        setWaarden((w) => ({ ...w, [key]: undefined }));
      }
      if (nu && kind === 'classificatie' && !(key in classificatieActies)) {
        setClassificatieActies((a) => ({ ...a, [key]: 'add' }));
        setClassificatieWaarden((w) => ({ ...w, [key]: [] }));
      }

      return volgende;
    });
  };

  const actieveVelden = velden.filter((v) => aangevinkt[v.key]);

  const kanNaarSamenvatting =
    actieveVelden.length > 0 &&
    actieveVelden.every((v) => {
      if (v.kind === 'classificatie') {
        return (classificatieWaarden[v.key] || []).length > 0;
      }

      return waarden[v.key] !== undefined;
    });

  const wijzigingenSamenvatting = useMemo(
    () =>
      actieveVelden.map((v) => {
        if (v.kind === 'classificatie') {
          const actie = classificatieActies[v.key] || 'add';
          const actieLabel = (ACTIE_OPTIES.find((a) => a.value === actie) || {}).label || actie;
          const namen = (classificatieWaarden[v.key] || []).join(', ');

          return { key: v.key, tekst: `${v.label}: ${namen} ${actieLabel.toLowerCase()}` };
        }

        const waarde = waarden[v.key];
        const label = v.labelVoorWaarde ? v.labelVoorWaarde(waarde) : waarde === '' ? '(leeg)' : waarde;

        return { key: v.key, tekst: `${v.label} → ${label}` };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actieveVelden, waarden, classificatieActies, classificatieWaarden],
  );

  const bevestigen = () => {
    const payload = {};

    actieveVelden.forEach((v) => {
      if (v.kind === 'classificatie') {
        payload[v.key] = { actie: classificatieActies[v.key] || 'add', namen: classificatieWaarden[v.key] || [] };
      } else {
        payload[v.key] = waarden[v.key];
      }
    });

    onBevestig(payload);
  };

  // Verdediging in twee lagen: de knop zelf is disabled (saveDisabled) zodra
  // kanNaarSamenvatting false is, én de handler zelf negeert een klik in die
  // staat nog eens expliciet — zodat dit ook correct blijft als
  // AdminEditModal ooit los van de disabled-knop aangeroepen wordt.
  const naarSamenvatting = () => {
    if (!kanNaarSamenvatting) {
      return;
    }

    setStap('bevestigen');
  };

  return (
    <AdminEditModal
      title={titel}
      onClose={onCancel}
      onSave={stap === 'configureren' ? naarSamenvatting : bevestigen}
      saving={bezig}
      dirty
      saveLabel={stap === 'configureren' ? 'Volgende: samenvatting' : 'Wijzigingen toepassen'}
      savingLabel="Bezig…"
      saveDisabled={stap === 'configureren' && !kanNaarSamenvatting}
    >
      {fout ? (
        <div style={css('margin-bottom: 16px; padding: 12px 14px; border-radius: 10px; background: #FFF1EF; color: #A13B2F; font-size: 13px; font-weight: 600;')}>
          {fout}
        </div>
      ) : null}

      {stap === 'configureren' ? (
        <>
          <p style={css('margin: -4px 0 16px; font-size: 13px; color: #82918B;')}>
            Vink de velden aan die u voor deze {aantal} geselecteerde {aantal === 1 ? 'record' : 'records'} wilt
            wijzigen. Een niet-aangevinkt veld blijft op elk record ongewijzigd.
          </p>

          {!kanNaarSamenvatting ? (
            <p style={css('margin: -8px 0 16px; font-size: 12.5px; color: #A67A2E;')}>
              {actieveVelden.length === 0
                ? 'Vink minimaal één veld aan om verder te gaan.'
                : 'Kies bij elk aangevinkt veld een waarde (of, voor classificaties, minimaal één selectie) om verder te gaan.'}
            </p>
          ) : null}

          <div style={css('display: grid; gap: 18px;')}>
            {velden.map((v) => {
              const actief = !!aangevinkt[v.key];

              return (
                <div
                  key={v.key}
                  style={css(`padding: 14px 16px; border: 1px solid ${actief ? '#BFD4C6' : '#E1EAE4'}; border-radius: 12px; background: ${actief ? '#F7FAF8' : '#FFFFFF'};`)}
                >
                  <label style={css('display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 700; color: #2C4A5E;')}>
                    <input type="checkbox" checked={actief} onChange={() => toggleVeld(v.key, v.kind)} />
                    {v.label}
                  </label>

                  {!actief ? <HuidigeWaardeInfo rijen={rijen} veld={v} /> : null}

                  {actief && v.kind === 'single' && v.control === 'select' ? (
                    <select
                      aria-label={v.label}
                      style={{ ...inputStyle, marginTop: 10 }}
                      value={waarden[v.key] ?? ''}
                      onChange={(e) => setWaarden((w) => ({ ...w, [v.key]: e.target.value }))}
                    >
                      <option value="" disabled hidden={waarden[v.key] !== undefined}>
                        Kies…
                      </option>
                      {v.opties.map((o) => (
                        <option key={String(o.value)} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {actief && v.kind === 'single' && v.control === 'text' ? (
                    <input
                      aria-label={v.label}
                      style={{ ...inputStyle, marginTop: 10 }}
                      value={waarden[v.key] ?? ''}
                      placeholder={v.placeholder}
                      onChange={(e) => setWaarden((w) => ({ ...w, [v.key]: e.target.value }))}
                    />
                  ) : null}

                  {actief && v.kind === 'classificatie' ? (
                    <div style={css('margin-top: 10px; display: grid; gap: 10px;')}>
                      <span style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
                        {ACTIE_OPTIES.map((a) => (
                          <button
                            key={a.value}
                            type="button"
                            onClick={() => setClassificatieActies((c) => ({ ...c, [v.key]: a.value }))}
                            style={css(`
                              cursor: pointer;
                              padding: 6px 14px;
                              border-radius: 999px;
                              border: 1px solid ${(classificatieActies[v.key] || 'add') === a.value ? '#4E9A6C' : '#D5E0D9'};
                              background: ${(classificatieActies[v.key] || 'add') === a.value ? '#EAF4EE' : '#FFFFFF'};
                              color: ${(classificatieActies[v.key] || 'add') === a.value ? '#2F6D47' : '#536460'};
                              font-family: inherit;
                              font-size: 12.5px;
                              font-weight: 700;
                            `)}
                          >
                            {a.label}
                          </button>
                        ))}
                      </span>
                      <ClassificatieSelect
                        opties={v.opties}
                        waarde={classificatieWaarden[v.key] || []}
                        onChange={(waarde) => setClassificatieWaarden((w) => ({ ...w, [v.key]: waarde }))}
                        placeholder={`${v.label} selecteren…`}
                        ariaLabel={v.label}
                      />
                      {(classificatieActies[v.key] || 'add') === 'replace' ? (
                        <p style={css('margin: 0; font-size: 12px; color: #A13B2F;')}>
                          Let op: dit vervangt alle bestaande {v.label.toLowerCase()} van elk geselecteerd record door
                          precies deze selectie.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p style={css('margin: -4px 0 16px; font-size: 14px; color: #2C4A5E;')}>
            U gaat <strong>{wijzigingenSamenvatting.length}</strong>{' '}
            {wijzigingenSamenvatting.length === 1 ? 'wijziging' : 'wijzigingen'} toepassen op{' '}
            <strong>
              {aantal} {aantal === 1 ? 'record' : 'records'}
            </strong>
            :
          </p>
          <ul style={css('margin: 0 0 16px; padding-left: 20px; font-size: 14px; color: #2E3A38; line-height: 1.9;')}>
            {wijzigingenSamenvatting.map((w) => (
              <li key={w.key}>{w.tekst}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStap('configureren')}
            style={css('padding: 0; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 700; color: #2F6D47; cursor: pointer;')}
          >
            ← Terug naar velden aanpassen
          </button>
        </>
      )}
    </AdminEditModal>
  );
}
