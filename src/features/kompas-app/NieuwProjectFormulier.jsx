// Licht aanmaakformulier voor een nieuw project (Projecten > + Nieuw project).
// Bewust alleen de gegevens die nodig zijn om te starten; de rest (programma, partners, doelstellingen,
// activiteiten, impact, resultaten, schrijfvoorkeur) blijft bestaan in het project en is later aan te
// vullen via het bewerkformulier of de chat. Er verdwijnt niets uit de database.
//
// Het te financieren bedrag is read-only en wordt uitsluitend afgeleid met teFinancieren() uit
// financiering/dekkingsplan.js (begroting min eigen bijdrage, nooit negatief): dezelfde functie als
// bij het opslaan, dus er is geen tweede berekening.
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { Button, ClassificatieSelect, Field, veldStijl } from '../../shared/ui/index.js';
import { formatEuro, leesBedragInvoer, teFinancieren } from './financiering/dekkingsplan.js';

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

export default function NieuwProjectFormulier({ form, setVeld, doelgroepen, themas = [], regios = [], fout, bezig, onOpslaan, onAnnuleer }) {
  const te = teFinancierenUitFormulier(form);
  const b = leesBedragInvoer(form.begroting);
  const e = leesBedragInvoer(form.eigenBijdrage);
  const eigenTeHoog = b.ok && e.ok && b.waarde != null && e.waarde != null && e.waarde > b.waarde;

  return (
    <form
      data-testid="nieuw-project-formulier"
      onSubmit={(ev) => {
        ev.preventDefault();
        onOpslaan();
      }}
    >
      <div style={css("margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #E1EAE4; font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E;")}>
        {String(form.naam || '').trim() || 'Nieuw project'}
      </div>

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
        </Field>

        <Field>
          Discipline
          {/* Alleen waarden uit de tabel themas (dezelfde lijst als de matching); geen vrije tekst. */}
          <ClassificatieSelect
            opties={themas}
            waarde={alsLijst(form.discipline)}
            onChange={(nieuw) => setVeld('discipline', nieuw)}
            multi
            placeholder="Selecteer discipline(s)"
            ariaLabel="Discipline"
          />
        </Field>

        <Field span="1 / -1">
          <span id="np-looptijd-label">Looptijd</span>
          <div role="group" aria-labelledby="np-looptijd-label" data-testid="np-looptijd" style={css('display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 10px; align-items: end;')} className="fwk-np-looptijd">
            <div style={css('display: block; min-width: 0;')}>
              <span style={css(HULP_LABEL)}>Startdatum</span>
              <input data-testid="np-periode-van" type="date" aria-label="Startdatum" value={form.periodeVan || ''} max={form.periodeTot || undefined} onChange={(ev) => setVeld('periodeVan', ev.target.value)} style={veldStijl} />
            </div>
            <span aria-hidden="true" className="fwk-np-pijl" style={css('padding-bottom: 12px; font-weight: 800; color: #7B8985;')}>→</span>
            <div style={css('display: block; min-width: 0;')}>
              <span style={css(HULP_LABEL)}>Einddatum</span>
              <input data-testid="np-periode-tot" type="date" aria-label="Einddatum" value={form.periodeTot || ''} min={form.periodeVan || undefined} onChange={(ev) => setVeld('periodeTot', ev.target.value)} style={veldStijl} />
            </div>
          </div>
          <style>{'@media (max-width: 520px) { .fwk-np-looptijd { grid-template-columns: minmax(0, 1fr) !important; } .fwk-np-pijl { display: none; } }'}</style>
        </Field>

        <Field span="1 / -1">
          Werkgebied / locatie
          {/* Bestaande regio's (tabel regios) als suggesties; een specifieke plaats of regio mag ook vrij. */}
          <input data-testid="np-regio" list="np-regio-opties" value={form.regio || ''} onChange={(ev) => setVeld('regio', ev.target.value)} placeholder="Bijvoorbeeld: Amsterdam, Landelijk of Utrecht en Flevoland" style={veldStijl} autoComplete="off" />
          <datalist id="np-regio-opties">
            {regios.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>

        <Field span="1 / -1">
          Projectomschrijving
          <textarea
            data-testid="np-omschrijving"
            value={form.omschrijving || ''}
            onChange={(ev) => setVeld('omschrijving', ev.target.value)}
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
        <div role="alert" data-testid="np-fout" style={css('margin-top: 24px; padding: 14px 18px; border: 1px solid #EDD3CE; border-radius: 14px; background: #FDF6F5; font-size: 14.5px; font-weight: 700; color: #9E3B2C;')}>
          {fout}
        </div>
      )}

      <div style={css('margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;')}>
        <Button type="submit" disabled={bezig}>
          {bezig ? 'Project wordt aangemaakt…' : 'Project aanmaken'}
        </Button>
        <Button variant="outline" onClick={onAnnuleer}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
