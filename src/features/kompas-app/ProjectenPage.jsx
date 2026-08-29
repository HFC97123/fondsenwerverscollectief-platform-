// Projecten: per project looptijd, begroting, eerdere toekenningen,
// co-financiers, regelingen in het dekkingsplan en documenten.
import React, { useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import {
  COFIN_STATUSSEN,
  DOC_SOORTEN,
  PLAN_STATUSSEN,
  PROJECT_EMPTY,
  UITKOMSTEN,
  berekenDekking,
  useKompas,
} from './KompasStore.jsx';
import { Button, Field, EmptyState, Notice, Panel, PanelHeader, SectionHeading, Toggle, veldStijl, selectStijl } from '../../shared/ui/index.js';

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function formatDate(iso) {
  if (!iso) {
    return 'doorlopend';
  }

  const d = new Date(`${iso}T00:00:00`);

  return `${d.getDate()} ${MAANDEN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function dagenTot(iso) {
  if (!iso) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((new Date(`${iso}T00:00:00`) - today) / 86400000);
}

const VELDEN = [
  { n: 'naam', l: 'Naam van het project', p: 'Bijvoorbeeld: Buurtkeuken De Brug', breed: true },
  { n: 'programma', l: 'Programma of onderdeel', p: 'Waar valt het project onder?' },
  { n: 'doelgroep', l: 'Doelgroep', p: 'Voor wie is het project bedoeld?' },
  { n: 'periodeVan', l: 'Looptijd van', p: 'jan 2027' },
  { n: 'periodeTot', l: 'Looptijd tot', p: 'dec 2027' },
  { n: 'regio', l: 'Regio of plaats', p: 'Utrecht' },
  { n: 'omschrijving', l: 'Korte omschrijving', p: 'Wat gaat er gebeuren en wat levert het op?', breed: true, area: true },
  { n: 'begroting', l: 'Totale projectbegroting', p: '€ 85.000' },
  { n: 'gevraagd', l: 'Gevraagd bedrag', p: '€ 35.000' },
  { n: 'eigenBijdrage', l: 'Eigen bijdrage', p: '€ 7.500' },
];

export default function ProjectenPage() {
  const app = useApp();
  const store = useKompas();
  const paid = ['pro', 'premium'].indexOf(app.subscriptionTier || 'free') !== -1;

  const [form, setForm] = useState(null);
  const [melding, setMelding] = useState('');
  const [fout, setFout] = useState('');

  const komende = useMemo(() => {
    const uit = [];

    store.projects.forEach((pr) => {
      (pr.regelingen || []).forEach((r) => {
        if (!r.deadline || r.plan === 'Toegekend' || r.plan === 'Afgewezen') {
          return;
        }

        const dagen = dagenTot(r.deadline);

        if (dagen == null || dagen < 0) {
          return;
        }

        uit.push({ ...r, project: pr.naam || 'Naamloos project', dagen });
      });
    });

    return uit.sort((a, b) => a.dagen - b.dagen).slice(0, 6);
  }, [store.projects]);

  if (!paid) {
    return (
      <Panel>
        <PanelHeader title="Projecten"
          intro="Met Pro en Premium legt u per project de looptijd, begroting, eerdere aanvragen en co-financiers vast, en neemt u regelingen op in uw dekkingsplan."
        />
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Panel>
    );
  }

  const setVeld = (key, val) => {
    setForm((cur) => ({ ...cur, [key]: val }));
    setMelding('');
  };

  const setRij = (lijst, i, key, val) =>
    setForm((cur) => {
      const rows = (cur[lijst] || []).slice();
      rows[i] = { ...rows[i], [key]: val };

      return { ...cur, [lijst]: rows };
    });

  const voegRij = (lijst, blank) => setForm((cur) => ({ ...cur, [lijst]: (cur[lijst] || []).concat([blank]) }));

  const verwijderRij = (lijst, i) =>
    setForm((cur) => {
      const rows = (cur[lijst] || []).slice();
      rows.splice(i, 1);

      return { ...cur, [lijst]: rows };
    });

  const opslaan = () => {
    if (!String(form.naam || '').trim()) {
      setFout('Vul in ieder geval de naam van het project in.');

      return;
    }

    store.saveProject(form);
    setForm(null);
    setFout('');
    setMelding('Project opgeslagen.');
  };

  const uploadDocs = (e) => {
    const files = Array.prototype.slice.call(e.target.files || []);

    if (!files.length) {
      return;
    }

    const raad = (naam) => {
      const l = naam.toLowerCase();

      if (l.indexOf('begroting') !== -1) return 'Begroting';
      if (l.indexOf('dekking') !== -1) return 'Concept-dekkingsplan';
      if (l.indexOf('plan') !== -1) return 'Projectplan';

      return 'Overig';
    };

    const leesbaar = (f) => /^text\/|\.(txt|md|csv)$/i.test(`${f.type} ${f.name}`);
    const start = (form.docs || []).length;

    setForm((cur) => ({
      ...cur,
      docs: (cur.docs || []).concat(
        files.map((f) => ({
          naam: f.name,
          soort: raad(f.name),
          grootte: `${Math.max(1, Math.round(f.size / 1024))} kB`,
          tekst: '',
        })),
      ),
    }));

    // Tekstbestanden worden uitgelezen zodat de chat de inhoud kan meenemen.
    files.forEach((f, n) => {
      if (!leesbaar(f)) {
        return;
      }

      const reader = new FileReader();

      reader.onload = () =>
        setForm((cur) => {
          const docs = (cur.docs || []).slice();

          if (docs[start + n]) {
            docs[start + n] = { ...docs[start + n], tekst: String(reader.result || '').slice(0, 4000) };
          }

          return { ...cur, docs };
        });

      reader.readAsText(f);
    });

    e.target.value = '';
  };

  const dekking = form ? berekenDekking(form) : null;

  const rijStyle = css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center;');
  const kaartRij = css('display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 13px 16px; border: 1px solid #E1EAE4; border-radius: 14px; background: #F7F9F8;');
  const verwijderStyle = css('cursor: pointer; min-height: 44px; display: flex; align-items: center; padding: 0 6px; border: none; background: none; color: #9E3B2C; font-size: 13.5px; font-weight: 700;');

  return (
    <Panel>
      <PanelHeader title="Projecten"
        intro="Werft u per project of programma? Leg hier per project de looptijd, begroting, eerdere aanvragen en co-financiers vast. Subsidie Kompas gebruikt dit naast uw organisatieprofiel bij fondsselecties en aanvragen."
      />

      {komende.length > 0 && (
        <div style={css('margin-bottom: 24px; padding: 20px 22px; border: 1px solid #D6E3E9; border-radius: 20px; background: #EAF1F6;')}>
          <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-bottom: 16px;')}>
            <span style={css('font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
              Komende deadlines uit uw projecten
            </span>
            <span style={css('display: flex; align-items: center; gap: 14px; flex-wrap: wrap;')}>
              <select
                value={String(store.reminderDays)}
                onChange={(e) => store.patch({ reminderDays: Number(e.target.value) })}
                aria-label="Wanneer wilt u een herinnering"
                style={selectStijl}
              >
                {[7, 14, 21, 30].map((d) => (
                  <option key={d} value={String(d)}>
                    {d} dagen voor de deadline
                  </option>
                ))}
              </select>
              <Toggle
                on={store.reminderMail}
                onChange={() => store.patch({ reminderMail: !store.reminderMail })}
                label={store.reminderMail ? 'E-mail aan' : 'E-mail uit'}
                ariaLabel="Herinnering per e-mail"
              />
            </span>
          </div>

          <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
            {komende.map((k, i) => (
              <div key={`${k.id}-${i}`} style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 12px 16px; border-radius: 14px; background: #FFFFFF;')}>
                <span style={css('flex: 1 1 220px; min-width: 0;')}>
                  <span style={css('display: block; font-size: 14px; font-weight: 700; color: #2C4A5E;')}>{k.naam}</span>
                  <span style={css('display: block; margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>
                    {`${k.project} · ${k.plan || 'Gepland'} · ${
                      k.herinner === false ? 'geen herinnering' : `herinnering ${store.reminderDays} dagen ervoor`
                    }`}
                  </span>
                </span>
                <span style={css('flex-shrink: 0; text-align: right;')}>
                  <span style={css(`display: block; font-size: 14px; font-weight: 800; color: ${k.dagen <= 14 ? '#9E3B2C' : '#2C4A5E'};`)}>
                    {k.dagen} dagen
                  </span>
                  <span style={css('display: block; margin-top: 2px; font-size: 12.5px; color: #7B8985;')}>
                    {formatDate(k.deadline)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {store.projects.length > 0 && (
        <div style={css('margin-bottom: 22px; display: flex; flex-direction: column; gap: 10px;')}>
          {store.projects.map((p) => {
            const toegekend = (p.eerder || []).filter((x) => String(x.uitkomst || '').indexOf('oegekend') !== -1).length;
            const bits = [p.programma, [p.periodeVan, p.periodeTot].filter(Boolean).join(' – '), p.regio].filter(Boolean);

            return (
              <div key={p.id} style={css('padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;')}>
                <div style={css('min-width: 0; flex: 1 1 260px;')}>
                  <div style={css('margin-bottom: 5px; font-size: 15.5px; font-weight: 800; color: #2C4A5E;')}>
                    {p.naam || 'Naamloos project'}
                  </div>
                  <div style={css('font-size: 13.5px; color: #687974;')}>
                    {bits.length ? bits.join('  ·  ') : 'Nog geen looptijd of programma ingevuld'}
                  </div>
                  <div style={css('margin-top: 6px; font-size: 13px; color: #7B8985;')}>
                    {`${p.gevraagd ? `Gevraagd ${p.gevraagd}` : 'Gevraagd bedrag nog niet ingevuld'}  ·  ${toegekend} eerdere ${
                      toegekend === 1 ? 'toekenning' : 'toekenningen'
                    }  ·  ${(p.cofin || []).length} co-financiers  ·  ${(p.docs || []).length} documenten  ·  ${
                      (p.regelingen || []).length
                    } regelingen in het plan`}
                  </div>
                </div>
                <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
                  <Button variant="outline" onClick={() => { setForm(JSON.parse(JSON.stringify(p))); setMelding(''); }}>
                    Bewerken
                  </Button>
                  <Button variant="plain" onClick={() => store.deleteProject(p.id)}>
                    Verwijderen
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!store.projects.length && !form && (
        <div style={css('margin-bottom: 22px;')}>
          <EmptyState title="Nog geen projecten vastgelegd" text="Voeg uw eerste project toe om er per aanvraag mee te werken." />
        </div>
      )}

      {!form && (
        <Button onClick={() => { setForm({ ...PROJECT_EMPTY, id: `p${Date.now()}` }); setMelding(''); setFout(''); }}>
          + Nieuw project
        </Button>
      )}

      <Notice>{melding}</Notice>

      {form && (
        <div>
          <div style={css("margin-bottom: 26px; padding-bottom: 12px; border-bottom: 1px solid #E1EAE4; font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E;")}>
            {String(form.naam || '').trim() || 'Nieuw project'}
          </div>

          <div style={css('display: flex; flex-direction: column; gap: 34px;')}>
            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 18px;')}>
              {VELDEN.map((f) => (
                <Field key={f.n} style={f.breed ? { gridColumn: 'span 2' } : undefined}>
                  {f.l}
                  {f.area ? (
                    <textarea
                      value={form[f.n] || ''}
                      onChange={(e) => setVeld(f.n, e.target.value)}
                      placeholder={f.p}
                      rows={4}
                      style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical' }}
                    />
                  ) : (
                    <input value={form[f.n] || ''} onChange={(e) => setVeld(f.n, e.target.value)} placeholder={f.p} style={veldStijl} />
                  )}
                </Field>
              ))}
            </div>

            <div>
              <SectionHeading>Eerdere fondsen en toekenningen</SectionHeading>
              {!(form.eerder || []).length && (
                <div style={css('margin-bottom: 14px; font-size: 14.5px; color: #7B8985;')}>
                  Nog geen eerdere aanvragen vastgelegd.
                </div>
              )}
              <div style={css('display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;')}>
                {(form.eerder || []).map((r, i) => (
                  <div key={i} style={rijStyle}>
                    <input value={r.fonds || ''} onChange={(e) => setRij('eerder', i, 'fonds', e.target.value)} placeholder="Fonds of regeling" style={{ ...veldStijl, flex: '1 1 200px' }} />
                    <input value={r.jaar || ''} onChange={(e) => setRij('eerder', i, 'jaar', e.target.value)} placeholder="Jaar" style={{ ...veldStijl, flex: '0 1 90px' }} />
                    <input value={r.bedrag || ''} onChange={(e) => setRij('eerder', i, 'bedrag', e.target.value)} placeholder="Bedrag" style={{ ...veldStijl, flex: '0 1 130px' }} />
                    <select value={r.uitkomst || UITKOMSTEN[0]} onChange={(e) => setRij('eerder', i, 'uitkomst', e.target.value)} style={{ ...selectStijl, flex: '0 1 190px' }}>
                      {UITKOMSTEN.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <input value={r.reden || ''} onChange={(e) => setRij('eerder', i, 'reden', e.target.value)} placeholder="Toelichting bij de uitkomst" style={{ ...veldStijl, flex: '1 1 100%' }} />
                    <button type="button" onClick={() => verwijderRij('eerder', i)} style={verwijderStyle}>Verwijderen</button>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => voegRij('eerder', { fonds: '', jaar: '', bedrag: '', uitkomst: UITKOMSTEN[0], reden: '' })}>
                + Aanvraag toevoegen
              </Button>
            </div>

            <div>
              <SectionHeading>Co-financiers</SectionHeading>
              {!(form.cofin || []).length && (
                <div style={css('margin-bottom: 14px; font-size: 14.5px; color: #7B8985;')}>Nog geen co-financiers vastgelegd.</div>
              )}
              <div style={css('display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;')}>
                {(form.cofin || []).map((r, i) => (
                  <div key={i} style={rijStyle}>
                    <input value={r.naam || ''} onChange={(e) => setRij('cofin', i, 'naam', e.target.value)} placeholder="Co-financier" style={{ ...veldStijl, flex: '1 1 200px' }} />
                    <input value={r.bedrag || ''} onChange={(e) => setRij('cofin', i, 'bedrag', e.target.value)} placeholder="Bedrag" style={{ ...veldStijl, flex: '0 1 130px' }} />
                    <select value={r.status || COFIN_STATUSSEN[0]} onChange={(e) => setRij('cofin', i, 'status', e.target.value)} style={{ ...selectStijl, flex: '0 1 170px' }}>
                      {COFIN_STATUSSEN.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => verwijderRij('cofin', i)} style={verwijderStyle}>Verwijderen</button>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => voegRij('cofin', { naam: '', bedrag: '', status: COFIN_STATUSSEN[0] })}>
                + Co-financier toevoegen
              </Button>
            </div>

            <div>
              <SectionHeading>Regelingen in het dekkingsplan</SectionHeading>
              {(form.regelingen || []).length ? (
                <>
                  <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                    {(form.regelingen || []).map((r, i) => (
                      <div key={`${r.id}-${i}`} style={kaartRij}>
                        <div style={css('flex: 1 1 200px; min-width: 0;')}>
                          <div style={css('font-size: 14.5px; font-weight: 700; color: #2C4A5E;')}>{r.naam}</div>
                          <div style={css('margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>
                            {[r.funder, formatDate(r.deadline)].filter(Boolean).join('  ·  ')}
                          </div>
                        </div>
                        <input
                          value={r.aangevraagd != null && r.aangevraagd !== '' ? String(r.aangevraagd) : r.bedragMax ? String(r.bedragMax) : ''}
                          onChange={(e) => setRij('regelingen', i, 'aangevraagd', e.target.value)}
                          placeholder="Aan te vragen"
                          aria-label="Aan te vragen bedrag"
                          style={{ ...veldStijl, flex: '0 1 140px' }}
                        />
                        <select value={r.plan || 'Gepland'} onChange={(e) => setRij('regelingen', i, 'plan', e.target.value)} aria-label="Status van de aanvraag" style={{ ...selectStijl, flex: '0 1 160px' }}>
                          {PLAN_STATUSSEN.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                        <Toggle
                          on={r.herinner !== false}
                          onChange={() => setRij('regelingen', i, 'herinner', r.herinner === false)}
                          label={r.herinner === false ? 'Herinnering uit' : 'Herinnering aan'}
                        />
                        <button type="button" onClick={() => verwijderRij('regelingen', i)} style={verwijderStyle}>Verwijderen</button>
                      </div>
                    ))}
                  </div>

                  <div style={css('margin-top: 18px; padding: 20px 22px; border: 1px solid #D5E6DB; border-radius: 18px; background: #EAF4EE;')}>
                    <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 14px;')}>
                      <span style={css('font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>Dekking van de begroting</span>
                      <span style={css('font-size: 14px; font-weight: 700; color: #2F6D47;')}>{dekking.begroting}</span>
                    </div>
                    {dekking.heeftBegroting && (
                      <>
                        <div style={css('margin-bottom: 14px; display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: #FFFFFF;')}>
                          <span style={css(`width: ${dekking.pctToegekend}; background: #4E9A6C;`)} />
                          <span style={css(`width: ${dekking.pctAanvraag}; background: #A9C9DE;`)} />
                          <span style={css(`width: ${dekking.pctOpen}; background: #E4EBE7;`)} />
                        </div>
                        <div style={css('display: flex; flex-wrap: wrap; gap: 10px 26px; margin-bottom: 12px;')}>
                          <span style={css('font-size: 13.5px; color: #2C4A5E;')}><strong>{dekking.toegekend}</strong> toegekend</span>
                          <span style={css('font-size: 13.5px; color: #2C4A5E;')}><strong>{dekking.inAanvraag}</strong> in aanvraag</span>
                          <span style={css('font-size: 13.5px; color: #2C4A5E;')}><strong>{dekking.open}</strong> nog te dekken</span>
                        </div>
                      </>
                    )}
                    <div style={css('font-size: 14px; line-height: 1.65; color: #4B5C58;')}>{dekking.samenvatting}</div>
                  </div>
                </>
              ) : (
                <div style={css('font-size: 14.5px; line-height: 1.65; color: #7B8985;')}>
                  Nog geen regelingen opgenomen. Op de pagina Deadlines opent u een regeling en voegt u die toe aan dit project.
                </div>
              )}
            </div>

            <div>
              <SectionHeading>Documenten</SectionHeading>
              <div style={css('margin-bottom: 16px; max-width: 640px; font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
                Upload projectplannen, begrotingen en concept-dekkingsplannen. Subsidie Kompas gebruikt deze documenten
                als achtergrondinformatie bij vragen over dit project.
              </div>
              {(form.docs || []).length ? (
                <div style={css('display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;')}>
                  {(form.docs || []).map((d, i) => (
                    <div key={i} style={kaartRij}>
                      <div style={css('flex: 1 1 200px; min-width: 0;')}>
                        <div style={css('font-size: 14.5px; font-weight: 700; color: #2C4A5E; overflow-wrap: anywhere;')}>{d.naam}</div>
                        <div style={css('margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>{d.grootte}</div>
                      </div>
                      <select value={d.soort} onChange={(e) => setRij('docs', i, 'soort', e.target.value)} aria-label="Soort document" style={{ ...selectStijl, flex: '0 1 200px' }}>
                        {DOC_SOORTEN.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => verwijderRij('docs', i)} style={verwijderStyle}>Verwijderen</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={css('margin-bottom: 14px; font-size: 14.5px; color: #7B8985;')}>Nog geen documenten toegevoegd.</div>
              )}
              <label style={css(`
                cursor: pointer;
                box-sizing: border-box;
                min-height: 44px;
                display: inline-flex;
                align-items: center;
                padding: 12px 20px;
                border: 1px solid #D6E3E9;
                border-radius: 999px;
                background: #FFFFFF;
                color: #2C4A5E;
                font-size: 13.5px;
                font-weight: 800;
              `)}
              >
                + Documenten uploaden
                <input type="file" multiple onChange={uploadDocs} style={css('position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden;')} />
              </label>
            </div>
          </div>

          {fout && (
            <div style={css('margin-top: 24px; padding: 14px 18px; border: 1px solid #EDD3CE; border-radius: 14px; background: #FDF6F5; font-size: 14.5px; font-weight: 700; color: #9E3B2C;')}>
              {fout}
            </div>
          )}

          <div style={css('margin-top: 30px; display: flex; gap: 12px; flex-wrap: wrap;')}>
            <Button onClick={opslaan}>Project opslaan</Button>
            <Button variant="outline" onClick={() => { setForm(null); setFout(''); }}>Annuleren</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
