// Eén fonds in het overzicht van Indienen: de naam, de status en de vier stappen (Vragenlijst, Antwoorden, Stukken, Controle) met één knop voor wat nu aan de beurt is.
// Heeft de server geen voortgang (de formulierfunctie staat nog niet aan), dan toont de kaart de oude regel met chips.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Chip } from '../../../shared/ui/werkplek.jsx';
import { STAP_KNOP, aanvraagBadges, datumTekst, stappenUitVoortgang, uitkomstLabel, volgendeStap } from './aanvraagModel.js';

export default function FondsKaart({ aanvraag: a, docs = [], onOpen }) {
  const stappen = stappenUitVoortgang(a.voortgang, docs);
  const volgende = stappen ? volgendeStap(stappen) : null;
  const alleKlaar = Boolean(stappen) && stappen.every((s) => s.klaar);
  const definitief = Boolean(a.voortgang && a.voortgang.status === 'definitief');
  const sub = `${a.aantalCriteria} ${a.aantalCriteria === 1 ? 'criterium' : 'criteria'} · bijgewerkt op ${datumTekst(a.bijgewerkt) || 'onbekende datum'}`;

  return (
    <div className="fwk-aa-kaart" data-testid="aa-rij-aanvraag">
      <div style={css('display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;')}>
        <div style={css('min-width: 0;')}>
          <h3 className="fwk-aa-kaart-titel">{a.fondsLabel || 'Fonds'}</h3>
          <div className="fwk-aa-klein">{sub}</div>
        </div>
        {stappen ? (
          <Chip toon={definitief ? 'groen' : 'blauw'}>{definitief ? 'Definitief' : 'Concept'}</Chip>
        ) : (
          <span className="fwk-aa-chips" style={css('margin: 0; justify-content: flex-end;')}>
            {aanvraagBadges(a).map((b) => (
              <Chip key={b.tekst} toon={b.toon}>
                {b.tekst}
              </Chip>
            ))}
          </span>
        )}
      </div>

      {stappen && (
        <ol className="fwk-aa-mini" aria-label="Voortgang van deze aanvraag" data-testid="aa-mini-stappen">
          {stappen.map((s) => (
            <li key={s.id} data-staat={s.klaar ? 'klaar' : volgende && volgende.id === s.id ? 'nu' : 'later'}>
              <i aria-hidden="true" />
              <b>{s.naam}</b>
              <small>{s.sub}</small>
            </li>
          ))}
        </ol>
      )}

      <div style={css('display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; margin-top: 14px;')}>
        <Button onClick={() => onOpen(a, volgende ? volgende.id : null)} ariaLabel={`Open aanvraag voor ${a.fondsLabel || 'dit fonds'}`}>
          {stappen ? (alleKlaar ? 'Open aanvraag' : STAP_KNOP[volgende.id] + ' →') : 'Open aanvraag'}
        </Button>
        {a.laatsteUitkomst && uitkomstLabel(a.laatsteUitkomst) && <span className="fwk-aa-klein">Laatste beoordeling: {uitkomstLabel(a.laatsteUitkomst).toLowerCase()}</span>}
      </div>
    </div>
  );
}
