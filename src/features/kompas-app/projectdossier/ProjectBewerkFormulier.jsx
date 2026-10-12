// Projectgegevens bewerken, in het projectdossier (tab Overzicht) op de plek waar de gegevens staan.
// Dit is het ENIGE bewerkformulier voor een bestaand project; Projecten > Nieuw project is het lichte
// aanmaakformulier (NieuwProjectFormulier). Documenten beheert u in de tab Documenten.
// Cofinanciers en financiering staan in de tab Projectfinanciering (subsidie_kompas_program_funding).
import React, { useEffect, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button, ClassificatieSelect, Field, veldStijl } from '../../../shared/ui/index.js';
import { haalClassificatiesOp } from '../../../data/services/classificaties.js';
import { bedragenVoorOpslaan, formatEuro, teFinancieren } from '../financiering/dekkingsplan.js';

export const BEWERK_VELDEN = [
  { n: 'naam', l: 'Naam van het project', p: 'Bijvoorbeeld: Buurtkeuken De Brug', breed: true },
  { n: 'programma', l: 'Programma of onderdeel', p: 'Waar valt het project onder?' },
  { n: 'doelgroep', l: 'Doelgroep', p: 'Selecteer doelgroep(en)', classificatie: 'doelgroepen' },
  { n: 'discipline', l: 'Discipline', p: 'Selecteer discipline(s)', classificatie: 'themas' },
  { n: 'periodeVan', l: 'Looptijd: startdatum', p: '', datum: true },
  { n: 'periodeTot', l: 'Looptijd: einddatum', p: '', datum: true },
  { n: 'regio', l: 'Werkgebied / locatie', p: 'Bijvoorbeeld: Amsterdam, Landelijk of Accra, Ghana', regios: true },
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

export default function ProjectBewerkFormulier({ project, store, onKlaar, onAnnuleer }) {
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(project)));
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  // Doelgroep en discipline gebruiken dezelfde centrale classificatielijsten als het organisatieprofiel.
  const [doelgroepen, setDoelgroepen] = useState([]);
  const [themas, setThemas] = useState([]);
  const [regios, setRegios] = useState([]);

  useEffect(() => {
    let actief = true;

    haalClassificatiesOp().then((lijst) => {
      if (actief) {
        setDoelgroepen(lijst.doelgroepen || []);
        setThemas(lijst.themas || []);
        setRegios(lijst.regios || []);
      }
    });

    return () => {
      actief = false;
    };
  }, []);

  const setVeld = (key, val) => {
    setForm((cur) => ({ ...cur, [key]: val }));
    setFout('');
  };

  const opslaan = () => {
    if (!String(form.naam || '').trim()) {
      setFout('Vul in ieder geval de naam van het project in.');

      return;
    }

    if (form.periodeVan && form.periodeTot && ISO_DATUM.test(form.periodeVan) && ISO_DATUM.test(form.periodeTot) && form.periodeTot < form.periodeVan) {
      setFout('De einddatum van de looptijd ligt voor de startdatum.');

      return;
    }

    // Bedragen strikt omzetten (geen raden); het te financieren bedrag wordt bij het opslaan afgeleid.
    const bedragen = bedragenVoorOpslaan(form);

    if (!bedragen.ok) {
      setFout(bedragen.fout);

      return;
    }

    const teBewaren = {
      ...form,
      begroting: bedragen.begroting,
      eigenBijdrage: bedragen.eigenBijdrage,
      gevraagd: bedragen.begroting === '' ? '' : teFinancieren(bedragen.begroting, bedragen.eigenBijdrage),
    };

    setFout('');
    setBezig(true);

    // Lukt het bewaren in de database niet, dan zeggen we dat ook; het formulier blijft dan open.
    Promise.resolve(store.saveProject(teBewaren)).then((id) => {
      setBezig(false);

      if (id === null) {
        setFout('Het project kon niet in de database worden opgeslagen. Probeer het opnieuw.');

        return;
      }

      onKlaar('Projectgegevens opgeslagen.');
    });
  };

  return (
    <form
      data-testid="project-bewerk-formulier"
      onSubmit={(ev) => {
        ev.preventDefault();
        opslaan();
      }}
    >
      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 14px;')}>
        {BEWERK_VELDEN.map((f) => (
          <Field key={f.n} style={f.breed ? { gridColumn: 'span 2' } : undefined}>
            {f.l}
            {f.classificatie ? (
              <ClassificatieSelect
                opties={f.classificatie === 'themas' ? themas : doelgroepen}
                waarde={Array.isArray(form[f.n]) ? form[f.n] : form[f.n] ? [form[f.n]] : []}
                onChange={(nieuw) => setVeld(f.n, nieuw)}
                multi
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
            ) : f.regios ? (
              <>
                <input value={form[f.n] || ''} list="bewerk-regio-opties" onChange={(e) => setVeld(f.n, e.target.value)} placeholder={f.p} style={veldStijl} autoComplete="off" />
                <datalist id="bewerk-regio-opties">
                  {regios.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </>
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

      {fout && (
        <div role="alert" data-testid="bewerk-fout" style={css('margin-top: 20px; padding: 14px 18px; border: 1px solid #EDD3CE; border-radius: 14px; background: #FDF6F5; font-size: 14.5px; font-weight: 700; color: #9E3B2C;')}>
          {fout}
        </div>
      )}

      <div style={css('margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;')}>
        <Button type="submit" disabled={bezig}>{bezig ? 'Bezig met opslaan…' : 'Project opslaan'}</Button>
        <Button variant="outline" onClick={onAnnuleer}>Annuleren</Button>
      </div>
    </form>
  );
}
