// Het compacte projectformulier: dezelfde velden voor een nieuw project (Projecten > + Nieuw project, modus 'nieuw')
// en voor het bewerken van een bestaand project (projectdossier, modus 'bewerk'). Eén formulier, geen tweede.
// Alleen de gegevens waarmee Subsidie Kompas matcht en de financiering volgt. Programma, partners, doelstellingen,
// activiteiten, impact, resultaten, planning en schrijfvoorkeur blijven bestaan in het project en worden beheerd
// als Projectinformatie op de pagina Documenten (zie projectinformatie/). Er verdwijnt niets uit de database.
//
// Het te financieren bedrag is read-only en wordt uitsluitend afgeleid met teFinancieren() uit
// financiering/dekkingsplan.js (begroting min eigen bijdrage, nooit negatief): dezelfde functie als
// bij het opslaan, dus er is geen tweede berekening.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { Button, ClassificatieSelect, Field, veldStijl } from '../../shared/ui/index.js';
import { formatEuro, leesBedragInvoer, teFinancieren } from './financiering/dekkingsplan.js';
import { ISO_DATUM } from './projectOpslaan.js';
import { stelTrefwoordenVoor, voegRegioToe } from './projectinformatie/trefwoorden.js';
import TrefwoordVoorstellen from './projectinformatie/TrefwoordVoorstellen.jsx';
import WerkgebiedVerfijning from './WerkgebiedVerfijning.jsx';
import { LANDNAMEN } from '../../shared/werkgebied/werkgebied.js';

// De velden van het aanmaakformulier, in volgorde. Gebruikt door de pagina en door de tests.
export const NIEUW_PROJECT_VELDEN = ['naam', 'doelgroep', 'discipline', 'periodeVan', 'periodeTot', 'regio', 'omschrijving', 'begroting', 'eigenBijdrage'];

export const OMSCHRIJVING_HULPTEKST = 'Heb je al een projectplan of two-pager? Voeg die toe en laat Subsidie Kompas je projectomschrijving aanvullen.';

const HULP_LABEL = 'display: block; margin-bottom: 4px; font-size: 12.5px; font-weight: 700; color: #7B8985;';
const HULP = 'display: block; margin-top: 4px; font-size: 12.5px; line-height: 1.5; font-weight: 600; color: #7B8985;';

const alsLijst = (w) => (Array.isArray(w) ? w : w ? [w] : []);

// Het te financieren bedrag zoals het formulier het toont: een getal, of null zolang een bedrag ongeldig is.
export function teFinancierenUitFormulier(form) {
  const b = leesBedragInvoer(form && form.begroting);
  const e = leesBedragInvoer(form && form.eigenBijdrage);

  if (!b.ok || !e.ok) {
    return null;
  }

  return teFinancieren(b.waarde, e.waarde);
}

// Looptijd: een native datumveld. Een bestaand project met vrije tekst ("Q1 2026") houdt een tekstveld, zodat die
// waarde niet stil verdwijnt; kiest u een datum, dan komt er een echte datum voor in de plaats.
function DatumInvoer({ testid, label, waarde, onChange, min, max }) {
  const v = waarde || '';

  if (v && !ISO_DATUM.test(v)) {
    return (
      <span style={css('display: grid; gap: 6px;')}>
        <input data-testid={testid} aria-label={label} value={v} onChange={(ev) => onChange(ev.target.value)} style={veldStijl} />
        <button type="button" onClick={() => onChange('')} style={css('justify-self: start; cursor: pointer; border: none; background: none; padding: 0; font-size: 12.5px; font-weight: 700; color: #4E9A6C;')}>
          Kies een datum
        </button>
      </span>
    );
  }

  return <input data-testid={testid} type="date" aria-label={label} value={v} min={min || undefined} max={max || undefined} onChange={(ev) => onChange(ev.target.value)} style={veldStijl} />;
}

export default function NieuwProjectFormulier({ form, setVeld, doelgroepen, themas = [], regios = [], fout, bezig, onOpslaan, onAnnuleer, modus = 'nieuw' }) {
  const bewerk = modus === 'bewerk';

  // Trefwoorden uit de omschrijving (en naam) op de achtergrond koppelen aan Doelgroep, Discipline en Werkgebied.
  // Alleen voorstellen uit de bestaande tabellen; het lid kiest zelf (zie projectinformatie/trefwoorden.js).
  const [scanTekst, setScanTekst] = useState(`${form.naam || ''}. ${form.omschrijving || ''}`);
  const [genegeerd, setGenegeerd] = useState({});
  // Verandert wanneer het lid de omschrijving of het werkgebied verlaat; daarna vraagt WerkgebiedVerfijning (eenmalig per tekst) om plaatsvoorstellen.
  const [controleSleutel, setControleSleutel] = useState(0);
  const controleer = () => setControleSleutel((n) => n + 1);
  // Landen als suggestie naast de bestaande werkgebieden; een gekozen land wordt als ISO-code opgeslagen (zie werkgebiedVoorOpslag).
  const regioOpties = useMemo(() => Array.from(new Set([...regios, ...LANDNAMEN])), [regios]);

  useEffect(() => {
    const t = setTimeout(() => setScanTekst(`${form.naam || ''}. ${form.omschrijving || ''}`), 500);

    return () => clearTimeout(t);
  }, [form.naam, form.omschrijving]);

  const voorstellen = useMemo(() => {
    const v = stelTrefwoordenVoor({ tekst: scanTekst, doelgroepen, themas, regios, gekozen: { doelgroep: form.doelgroep, discipline: form.discipline, regio: form.regio } });
    const zichtbaar = (cat) => v[cat].filter((x) => !genegeerd[`${cat}:${x.naam}`]);

    return { doelgroep: zichtbaar('doelgroep'), discipline: zichtbaar('discipline'), regio: zichtbaar('regio') };
  }, [scanTekst, doelgroepen, themas, regios, form.doelgroep, form.discipline, form.regio, genegeerd]);

  const negeer = (cat) => (naam) => setGenegeerd((cur) => ({ ...cur, [`${cat}:${naam}`]: true }));
  const te = teFinancierenUitFormulier(form);
  const b = leesBedragInvoer(form.begroting);
  const e = leesBedragInvoer(form.eigenBijdrage);
  const eigenTeHoog = b.ok && e.ok && b.waarde != null && e.waarde != null && e.waarde > b.waarde;

  return (
    <form
      data-testid={bewerk ? 'project-bewerk-formulier' : 'nieuw-project-formulier'}
      data-modus={modus}
      onSubmit={(ev) => {
        ev.preventDefault();
        onOpslaan();
      }}
    >
      {!bewerk && (
        <div style={css("margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #E1EAE4; font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E;")}>
          {String(form.naam || '').trim() || 'Nieuw project'}
        </div>
      )}

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 14px;')}>
        <Field span="1 / -1">
          Projectnaam
          <input data-testid="np-naam" value={form.naam || ''} onChange={(ev) => setVeld('naam', ev.target.value)} placeholder="Bijvoorbeeld: Buurtkeuken De Brug" style={veldStijl} />
        </Field>

        <Field>
          Doelgroep
          {/* Alleen waarden uit de tabel doelgroepen (dezelfde lijst als de matching); geen vrije tekst. */}
          <ClassificatieSelect
            opties={doelgroepen}
            waarde={alsLijst(form.doelgroep)}
            onChange={(nieuw) => setVeld('doelgroep', nieuw)}
            multi
            placeholder="Selecteer doelgroep(en)"
            ariaLabel="Doelgroep"
          />
          <TrefwoordVoorstellen testid="np-voorstel-doelgroep" voorstellen={voorstellen.doelgroep} onKies={(n) => setVeld('doelgroep', [...alsLijst(form.doelgroep), n])} onNegeer={negeer('doelgroep')} />
        </Field>

        <Field>
          Disciplines
          {/* Alleen waarden uit de tabel themas (dezelfde lijst als de matching); geen vrije tekst. */}
          <ClassificatieSelect
            opties={themas}
            waarde={alsLijst(form.discipline)}
            onChange={(nieuw) => setVeld('discipline', nieuw)}
            multi
            placeholder="Selecteer discipline(s)"
            ariaLabel="Disciplines"
          />
          <TrefwoordVoorstellen testid="np-voorstel-discipline" voorstellen={voorstellen.discipline} onKies={(n) => setVeld('discipline', [...alsLijst(form.discipline), n])} onNegeer={negeer('discipline')} />
        </Field>

        <Field span="1 / -1">
          <span id="np-looptijd-label">Looptijd</span>
          <div role="group" aria-labelledby="np-looptijd-label" data-testid="np-looptijd" style={css('display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 10px; align-items: end;')} className="fwk-np-looptijd">
            <div style={css('display: block; min-width: 0;')}>
              <span style={css(HULP_LABEL)}>Startdatum</span>
              <DatumInvoer testid="np-periode-van" label="Startdatum" waarde={form.periodeVan} max={ISO_DATUM.test(form.periodeTot || '') ? form.periodeTot : ''} onChange={(w) => setVeld('periodeVan', w)} />
            </div>
            <span aria-hidden="true" className="fwk-np-pijl" style={css('padding-bottom: 12px; font-weight: 800; color: #7B8985;')}>→</span>
            <div style={css('display: block; min-width: 0;')}>
              <span style={css(HULP_LABEL)}>Einddatum</span>
              <DatumInvoer testid="np-periode-tot" label="Einddatum" waarde={form.periodeTot} min={ISO_DATUM.test(form.periodeVan || '') ? form.periodeVan : ''} onChange={(w) => setVeld('periodeTot', w)} />
            </div>
          </div>
          <style>{'@media (max-width: 520px) { .fwk-np-looptijd { grid-template-columns: minmax(0, 1fr) !important; } .fwk-np-pijl { display: none; } }'}</style>
        </Field>

        <Field span="1 / -1">
          Werkgebied / locatie
          {/* Bestaande regio's (tabel regios) als suggesties; een specifieke plaats of regio mag ook vrij. */}
          <input data-testid="np-regio" list="np-regio-opties" value={form.regio || ''} onChange={(ev) => setVeld('regio', ev.target.value)} onBlur={controleer} placeholder="Bijvoorbeeld: Amsterdam, Landelijk of Utrecht en Flevoland" style={veldStijl} autoComplete="off" />
          <datalist id="np-regio-opties">
            {regioOpties.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <TrefwoordVoorstellen testid="np-voorstel-regio" voorstellen={voorstellen.regio} onKies={(n) => setVeld('regio', voegRegioToe(form.regio, n))} onNegeer={negeer('regio')} />
          <WerkgebiedVerfijning regio={form.regio} omschrijving={form.omschrijving} werkgebied={form.werkgebied} setWerkgebied={(w) => setVeld('werkgebied', w)} controleSleutel={controleSleutel} />
        </Field>

        <Field span="1 / -1">
          Projectomschrijving
          <textarea
            data-testid="np-omschrijving"
            value={form.omschrijving || ''}
            onChange={(ev) => setVeld('omschrijving', ev.target.value)}
            onBlur={controleer}
            placeholder="Wat gaat er gebeuren en wat levert het op?"
            rows={4}
            style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical' }}
          />
          <span data-testid="np-omschrijving-hulp" style={css(HULP)}>{OMSCHRIJVING_HULPTEKST}</span>
        </Field>

        <Field>
          Totale projectbegroting
          <input data-testid="np-begroting" inputMode="decimal" value={form.begroting ?? ''} onChange={(ev) => setVeld('begroting', ev.target.value)} placeholder="€ 85.000" style={veldStijl} />
        </Field>

        <Field>
          Eigen bijdrage
          <input data-testid="np-eigen" inputMode="decimal" value={form.eigenBijdrage ?? ''} onChange={(ev) => setVeld('eigenBijdrage', ev.target.value)} placeholder="€ 7.500" style={veldStijl} />
        </Field>

        <Field span="1 / -1">
          Te financieren bedrag
          <div
            data-testid="np-te-financieren"
            data-waarde={te == null ? '' : String(te)}
            aria-live="polite"
            style={{ ...veldStijl, display: 'flex', alignItems: 'center', background: '#F2F6F4', color: '#2C4A5E', fontWeight: 800 }}
          >
            {te == null ? '—' : formatEuro(te)}
          </div>
          <span style={css(HULP)}>
            Automatisch berekend: totale projectbegroting min eigen bijdrage.
            {eigenTeHoog ? ' De eigen bijdrage is hoger dan de begroting; het te financieren bedrag is dan € 0.' : ''}
          </span>
        </Field>
      </div>

      {fout && (
        <div role="alert" data-testid={bewerk ? 'bewerk-fout' : 'np-fout'} style={css('margin-top: 24px; padding: 14px 18px; border: 1px solid #EDD3CE; border-radius: 14px; background: #FDF6F5; font-size: 14.5px; font-weight: 700; color: #9E3B2C;')}>
          {fout}
        </div>
      )}

      <div style={css('margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;')}>
        <Button type="submit" disabled={bezig}>
          {bewerk ? (bezig ? 'Bezig met opslaan…' : 'Project opslaan') : bezig ? 'Project wordt aangemaakt…' : 'Project aanmaken'}
        </Button>
        <Button variant="outline" onClick={onAnnuleer}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
