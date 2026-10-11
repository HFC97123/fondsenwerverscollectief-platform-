// Projecten: per project looptijd, begroting, financiering (uit Projectfinanciering) en documenten.
// Nieuw project = licht aanmaakformulier (NieuwProjectFormulier); bewerken = uitgebreid formulier.
// Cofinanciers, eerdere toekenningen en regelingen staan in Projectfinanciering
// (subsidie_kompas_program_funding), niet meer in dit formulier.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { DOC_SOORTEN, PROJECT_EMPTY, useKompas } from './KompasStore.jsx';
import NieuwProjectFormulier from './NieuwProjectFormulier.jsx';
import { haalClassificatiesOp } from '../../data/services/classificaties.js';
import { Button, ClassificatieSelect, Field, EmptyState, Notice, Panel, PanelHeader, SectionHeading, Toggle, veldStijl, selectStijl } from '../../shared/ui/index.js';
import ExportMenu from '../../shared/ui/ExportMenu.jsx';
import { isEchtId } from '../../data/services/projecten.js';
import { projectExport } from './exportBronnen.js';
import { useDekkingsplannen } from './financiering/useProjectFinanciering.js';
import { projectFinancieringHref } from './financiering/deeplinks.js';
import { STATUS_LABEL, bedragenVoorOpslaan, dekkingVanProject, formatDatum, formatEuro, komendeDeadlines, periodeTekst, teFinancieren } from './financiering/dekkingsplan.js';

const VELDEN = [
  { n: 'naam', l: 'Naam van het project', p: 'Bijvoorbeeld: Buurtkeuken De Brug', breed: true },
  { n: 'programma', l: 'Programma of onderdeel', p: 'Waar valt het project onder?' },
  { n: 'doelgroep', l: 'Doelgroep', p: 'Voor wie is het project bedoeld?', classificatie: true },
  { n: 'periodeVan', l: 'Looptijd van', p: '', datum: true },
  { n: 'periodeTot', l: 'Looptijd tot', p: '', datum: true },
  { n: 'regio', l: 'Projectlocatie', p: 'Waar vindt dit project plaats? Bijvoorbeeld: Accra, Ghana' },
  { n: 'partners', l: 'Partners', p: 'Met welke andere organisaties werkt u samen?' },
  { n: 'omschrijving', l: 'Projectomschrijving', p: 'Wat gaat er gebeuren en wat levert het op?', breed: true, area: true },
  { n: 'doelstellingen', l: 'Doelstellingen', p: 'Wat wilt u met dit project bereiken?', breed: true, area: true },
  { n: 'activiteiten', l: 'Activiteiten', p: 'Welke activiteiten voert u uit?', breed: true, area: true },
  { n: 'impact', l: 'Beoogde impact', p: 'Welk verschil maakt dit project, voor wie?', breed: true, area: true },
  { n: 'planning', l: 'Planning', p: 'Belangrijkste fasen en data', breed: true },
  { n: 'schrijfvoorkeur', l: 'Schrijfvoorkeur voor dit project', p: 'Bijvoorbeeld: warm en mensgericht, zakelijk, resultaatgericht. Geldt voor alle teksten van dit project.', breed: true },
  { n: 'resultaten', l: 'Resultaten', p: 'Wat heeft dit project tot nu toe opgeleverd?', breed: true, area: true },
  { n: 'begroting', l: 'Totale projectbegroting', p: '€ 85.000' },
  { n: 'eigenBijdrage', l: 'Eigen bijdrage', p: '€ 7.500' },
];

const BRON_LABELS = {
  handmatig: 'ingevuld door u',
  upload: 'uit een document',
  gesprek: 'uit het gesprek',
  'gesprek-bevestigd': 'door u bevestigd in het gesprek',
  'ai-afgeleid': 'afgeleid door AI, niet bevestigd',
};

// Looptijd: een native datumveld. Een bestaand project met vrije tekst ("Q1 2026") houdt een tekstveld,
// zodat die waarde niet stil verdwijnt; kiest u een datum, dan komt er een echte datum voor in de plaats.
const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

function LooptijdInvoer({ waarde, onChange, label }) {
  const v = waarde || '';

  if (v && !ISO_DATUM.test(v)) {
    return (
      <span style={css('display: grid; gap: 6px;')}>
        <input value={v} onChange={(e) => onChange(e.target.value)} aria-label={label} style={veldStijl} />
        <button type="button" onClick={() => onChange('')} style={css('justify-self: start; cursor: pointer; border: none; background: none; padding: 0; font-size: 12.5px; font-weight: 700; color: #4E9A6C;')}>
          Kies een datum
        </button>
      </span>
    );
  }

  return <input type="date" value={v} onChange={(e) => onChange(e.target.value)} aria-label={label} style={veldStijl} />;
}

export default function ProjectenPage({ embedded = false } = {}) {
  const app = useApp();
  const store = useKompas();
  const paid = ['pro', 'premium'].indexOf(app.subscriptionTier || 'free') !== -1;

  const [form, setForm] = useState(null);
  const [melding, setMelding] = useState('');
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  // Doelgroep gebruikt dezelfde centrale classificatielijst als het
  // organisatieprofiel (zie data/services/classificaties.js) in plaats van
  // vrije tekst, zodat er maar één plek is waar doelgroepen worden beheerd.
  const [doelgroepen, setDoelgroepen] = useState([]);

  useEffect(() => {
    let actief = true;

    haalClassificatiesOp().then((lijst) => {
      if (actief) {
        setDoelgroepen(lijst.doelgroepen || []);
      }
    });

    return () => {
      actief = false;
    };
  }, []);

  // Dekkingsplannen: dezelfde bron (kompas_dekkingsplan) als het projectdossier en het Dashboard.
  const projectIds = useMemo(() => (paid ? (store.projects || []).filter((p) => !p.gearchiveerd).map((p) => p.id) : []), [paid, store.projects]);
  const financiering = useDekkingsplannen(projectIds);

  const komende = useMemo(() => komendeDeadlines(store.projects, financiering.perProject, new Date(), 6), [store.projects, financiering.perProject]);

  // Deep link vanuit het projectdossier: #/kompas/projecten?bewerk=<id> opent het bewerkformulier.
  const bewerkId = useMemo(() => {
    const m = /[?&]bewerk=([^&]+)/.exec(window.location.hash || '');

    return m ? decodeURIComponent(m[1]) : null;
  }, []);

  useEffect(() => {
    if (!bewerkId || form) {
      return;
    }

    const doel = (store.projects || []).find((p) => p.id === bewerkId);

    if (doel) {
      setForm(JSON.parse(JSON.stringify(doel)));
      setMelding('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bewerkId, store.projects]);

  if (!paid) {
    return (
      <Panel embedded={embedded}>
        {!embedded && (
          <PanelHeader title="Projecten"
            intro="Met Pro en Premium legt u per project de looptijd en begroting vast, en volgt u de financiering: toegekend, aangevraagd en cofinanciers."
          />
        )}
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


  const verwijderRij = (lijst, i) =>
    setForm((cur) => {
      const rows = (cur[lijst] || []).slice();
      const [weg] = rows.splice(i, 1);

      // Een document dat al in de database staat, wordt alleen verwijderd
      // omdat het lid dat hier expliciet kiest (nooit door een ander scherm).
      const verwijderdeDocIds =
        lijst === 'docs' && weg && weg.id ? (cur.verwijderdeDocIds || []).concat([weg.id]) : cur.verwijderdeDocIds;

      return { ...cur, [lijst]: rows, ...(verwijderdeDocIds ? { verwijderdeDocIds } : {}) };
    });

  const opslaan = () => {
    if (!String(form.naam || '').trim()) {
      setFout('Vul in ieder geval de naam van het project in.');

      return;
    }

    if (form.periodeVan && form.periodeTot && /^\d{4}-\d{2}-\d{2}$/.test(form.periodeVan) && /^\d{4}-\d{2}-\d{2}$/.test(form.periodeTot) && form.periodeTot < form.periodeVan) {
      setFout('De einddatum van de looptijd ligt voor de startdatum.');

      return;
    }

    // Bedragen strikt omzetten (geen raden); het te financieren bedrag wordt bij het opslaan afgeleid.
    const bedragen = bedragenVoorOpslaan(form);

    if (!bedragen.ok) {
      setFout(bedragen.fout);

      return;
    }

    const { nieuw, ...zonderVlag } = form;
    const teBewaren = { ...zonderVlag, begroting: bedragen.begroting, eigenBijdrage: bedragen.eigenBijdrage, gevraagd: bedragen.begroting === '' ? '' : teFinancieren(bedragen.begroting, bedragen.eigenBijdrage) };
    const bewaar = store.saveProject(teBewaren);

    setFout('');
    setBezig(true);

    // Lukt het bewaren in de database niet, dan zeggen we dat ook; het formulier blijft dan open.
    Promise.resolve(bewaar).then((id) => {
      setBezig(false);

      if (id === null) {
        setMelding('');
        setFout('Het project kon niet in de database worden opgeslagen. Probeer het opnieuw.');

        return;
      }

      setForm(null);

      if (nieuw && isEchtId(id)) {
        // Na het aanmaken direct naar het projectdossier.
        window.location.hash = `#/kompas/projecten/${id}`;

        return;
      }

      setMelding('Project opgeslagen.');
    });
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

  const kaartRij = css('display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 13px 16px; border: 1px solid #E1EAE4; border-radius: 14px; background: #F7F9F8;');
  const verwijderStyle = css('cursor: pointer; min-height: 44px; display: flex; align-items: center; padding: 0 6px; border: none; background: none; color: #9E3B2C; font-size: 13.5px; font-weight: 700;');

  return (
    <Panel embedded={embedded}>
      {!embedded && (
        <PanelHeader title="Projecten"
          intro="Werft u per project of programma? Leg hier per project de looptijd en begroting vast; de financiering (toegekend, aangevraagd, cofinanciers) volgt u in het projectdossier. Subsidie Kompas gebruikt dit naast uw organisatieprofiel bij fondsselecties en aanvragen."
        />
      )}

      {komende.length > 0 && !(form && form.nieuw) && (
        <div style={css('margin-bottom: 16px; padding: 14px 18px; border: 1px solid #D6E3E9; border-radius: 20px; background: #EAF1F6;')}>
          <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 12px;')}>
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
            {komende.map((k) => (
              <div key={k.sleutel} data-testid="projecten-komende-deadline" style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 12px 16px; border-radius: 14px; background: #FFFFFF;')}>
                <span style={css('flex: 1 1 220px; min-width: 0;')}>
                  <a href={projectFinancieringHref(k.projectId)} style={css('display: block; font-size: 14px; font-weight: 700; color: #2C4A5E; text-decoration: none;')}>{k.naam}</a>
                  <span style={css('display: block; margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>
                    {`${k.projectNaam} · ${STATUS_LABEL[k.status] || k.status} · ${
                      k.reminder === false ? 'geen herinnering' : `herinnering ${store.reminderDays} dagen ervoor`
                    }`}
                  </span>
                </span>
                <span style={css('flex-shrink: 0; text-align: right;')}>
                  <span style={css(`display: block; font-size: 14px; font-weight: 800; color: ${k.dagen <= 14 ? '#9E3B2C' : '#2C4A5E'};`)}>
                    {k.dagen} dagen
                  </span>
                  <span style={css('display: block; margin-top: 2px; font-size: 12.5px; color: #7B8985;')}>
                    {formatDatum(k.datum)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {store.projects.length > 0 && !(form && form.nieuw) && (
        <div style={css('margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px;')}>
          {store.projects.map((p) => {
            const bits = [p.programma, periodeTekst(p.periodeVan, p.periodeTot), p.regio].filter(Boolean);
            const regelsVanProject = financiering.perProject[p.id];
            const dek = Array.isArray(regelsVanProject) ? dekkingVanProject(p, regelsVanProject) : null;
            // Financiering uitsluitend uit de financieringsregels (zelfde berekening als Dashboard en projectdossier).
            const finTekst = p.gearchiveerd
              ? ''
              : !isEchtId(p.id)
                ? 'Sla het project op om de financiering te volgen'
                : financiering.status === 'laden' && !dek
                  ? 'Financiering wordt geladen…'
                  : !dek
                    ? 'De financiering kon niet worden geladen'
                    : !dek.heeftBegroting
                      ? 'Totale projectbegroting nog niet ingevuld'
                      : `Toegekend ${formatEuro(dek.toegekend)}  ·  Aangevraagd ${formatEuro(dek.aangevraagd)}  ·  Eigen bijdrage ${formatEuro(dek.overige)}  ·  ${
                          dek.volledigGedekt ? 'Volledig gedekt' : `Nog te financieren ${formatEuro(dek.nogNodig)}`
                        }`;
            const docTekst = `${(p.docs || []).length} ${(p.docs || []).length === 1 ? 'document' : 'documenten'}`;

            return (
              <div key={p.id} style={css('padding: 14px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;')}>
                <div style={css('min-width: 0; flex: 1 1 260px;')}>
                  <div style={css('margin-bottom: 5px; font-size: 15.5px; font-weight: 800; color: #2C4A5E;')}>
                    {p.naam || 'Naamloos project'}
                    {p.gearchiveerd && <span style={css('margin-left: 8px; font-size: 12px; font-weight: 700; color: #7B8985;')}>(gearchiveerd)</span>}
                  </div>
                  <div style={css('font-size: 13.5px; color: #687974;')}>
                    {bits.length ? bits.join('  ·  ') : 'Nog geen looptijd of programma ingevuld'}
                  </div>
                  <div data-testid="projecten-kaart-financiering" style={css('margin-top: 6px; font-size: 13px; color: #7B8985;')}>
                    {[finTekst, docTekst].filter(Boolean).join('  ·  ')}
                  </div>
                </div>
                <div style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center;')}>
                  {isEchtId(p.id) && (
                    <a
                      href={`#/kompas/projecten/${p.id}`}
                      data-testid="open-project"
                      style={css("display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; padding: 8px 18px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; text-decoration: none;")}
                    >
                      Open project
                    </a>
                  )}
                  <ExportMenu
                    toegestaan={paid}
                    uitlijnen="rechts"
                    maat="normaal"
                    ariaLabel={`Project ${p.naam || 'Naamloos project'} exporteren`}
                    bouwModel={projectExport({ projectId: p.id, store })}
                  />
                  <Button variant="outline" onClick={() => { setForm(JSON.parse(JSON.stringify(p))); setMelding(''); }}>
                    Bewerken
                  </Button>
                  <Button variant="plain" onClick={() => store.archiveProject(p.id, !p.gearchiveerd)}>
                    {p.gearchiveerd ? 'Terugzetten' : 'Archiveren'}
                  </Button>
                  <Button variant="plain" onClick={() => { if (window.confirm(`Project "${p.naam || 'Naamloos project'}" definitief verwijderen? Ook de documenten van dit project worden verwijderd.`)) store.deleteProject(p.id); }}>
                    Verwijderen
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!store.projects.length && !form && (
        <div style={css('margin-bottom: 16px;')}>
          <EmptyState title="Nog geen projecten vastgelegd" text="Voeg uw eerste project toe om er per aanvraag mee te werken." />
        </div>
      )}

      {!form && (
        <Button onClick={() => { setForm({ ...PROJECT_EMPTY, id: `p${Date.now()}`, nieuw: true }); setMelding(''); setFout(''); }}>
          + Nieuw project
        </Button>
      )}

      <Notice>{melding}</Notice>

      {form && form.nieuw && (
        <NieuwProjectFormulier
          form={form}
          setVeld={setVeld}
          doelgroepen={doelgroepen}
          fout={fout}
          bezig={bezig}
          onOpslaan={opslaan}
          onAnnuleer={() => { setForm(null); setFout(''); }}
        />
      )}

      {form && !form.nieuw && (
        <div>
          <div style={css("margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #E1EAE4; font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E;")}>
            {String(form.naam || '').trim() || 'Nieuw project'}
          </div>

          <div style={css('display: flex; flex-direction: column; gap: 22px;')}>
            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 14px;')}>
              {VELDEN.map((f) => (
                <Field key={f.n} style={f.breed ? { gridColumn: 'span 2' } : undefined}>
                  {f.l}
                  {f.classificatie ? (
                    <ClassificatieSelect
                      opties={doelgroepen}
                      waarde={Array.isArray(form[f.n]) ? form[f.n] : form[f.n] ? [form[f.n]] : []}
                      onChange={(nieuw) => setVeld(f.n, nieuw)}
                      multi
                      metAnders
                      placeholder={f.p}
                      ariaLabel={f.l}
                    />
                  ) : f.datum ? (
                    <LooptijdInvoer waarde={form[f.n]} onChange={(w) => setVeld(f.n, w)} label={f.l} />
                  ) : f.area ? (
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
                  {form.bronnen && form.bronnen[f.n] && (
                    <span style={css('display: block; margin-top: 4px; font-size: 12px; font-weight: 600; color: #7B8985;')}>
                      Herkomst: {BRON_LABELS[form.bronnen[f.n]] || form.bronnen[f.n]}
                    </span>
                  )}
                </Field>
              ))}
              <Field span="1 / -1">
                Te financieren bedrag
                <div data-testid="bewerk-te-financieren" style={{ ...veldStijl, display: 'flex', alignItems: 'center', background: '#F2F6F4', color: '#2C4A5E', fontWeight: 800 }}>
                  {formatEuro(teFinancieren(form.begroting, form.eigenBijdrage))}
                </div>
                <span style={css('font-size: 12.5px; font-weight: 600; color: #7B8985;')}>Automatisch berekend: totale projectbegroting min eigen bijdrage.</span>
              </Field>
            </div>

            <div>
              <SectionHeading>Cofinanciers en andere financiering</SectionHeading>
              <div data-testid="form-dekkingsplan-verwijzing" style={css('font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
                Cofinanciers, eerdere toekenningen, fondsen en regelingen (bedragen, status, eigen deadline en herinnering) beheert u in het projectdossier, op het tabblad Projectfinanciering.
                {isEchtId(form.id) ? (
                  <>
                    {' '}
                    <a href={projectFinancieringHref(form.id)} style={css('font-weight: 800; color: #4E9A6C; text-decoration: none;')}>
                      Open het projectfinancieringstabblad
                    </a>
                  </>
                ) : (
                  ' Sla het project eerst op om een dekkingsplan op te bouwen.'
                )}
              </div>
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
                        <div style={css('margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>
                          {[d.grootte, d.versie ? `versie ${d.versie}` : '', d.context && d.context.fonds ? `voor ${d.context.fonds}` : '', d.vervangen ? 'vervangen door een nieuwere versie' : ''].filter(Boolean).join(' · ')}
                        </div>
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

          <div style={css('margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;')}>
            <Button onClick={opslaan}>Project opslaan</Button>
            <Button variant="outline" onClick={() => { setForm(null); setFout(''); }}>Annuleren</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
