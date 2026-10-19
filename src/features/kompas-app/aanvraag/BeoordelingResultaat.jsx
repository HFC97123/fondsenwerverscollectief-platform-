// Het resultaat van "Beoordeel mijn aanvraag": per criterium gedekt, deels of ontbreekt, met een citaat uit de eigen tekst van het lid.
// Geen score en geen kans: de uitkomst is een van drie vaste teksten, door de server berekend. Het lid beslist zelf.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { Blok, Chip, Melding } from '../../../shared/ui/werkplek.jsx';
import { bronLabel, eerstAanpakken, koppelOordelen, soortLabel, statusLabel, statusToon, telStatussen, uitkomstLabel, uitkomstToon } from './aanvraagModel.js';

const hoofdletter = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function Oordeel({ g }) {
  return (
    <li data-testid="aa-oordeel" data-status={g.status}>
      <div className="fwk-aa-eis">
        <div className="fwk-aa-eis-tekst">{g.eis.tekst}</div>
        <Chip toon={statusToon(g.status)}>{statusLabel(g.status)}</Chip>
      </div>
      <div className="fwk-aa-chips">
        <Chip toon="grijs">{soortLabel(g.eis.soort)}</Chip>
        <Chip toon="grijs">{bronLabel(g.eis)}</Chip>
      </div>
      {g.citaatAanvraag && (
        <div className="fwk-aa-citaat">
          <b>In uw tekst</b>
          {g.citaatAanvraag}
        </div>
      )}
      {g.status !== 'gedekt' && g.bronStuk && (
        <div className="fwk-aa-citaat">
          <b>Het fonds vraagt</b>
          {g.bronStuk}
        </div>
      )}
      {g.status !== 'gedekt' && (g.verbetering || g.status === 'niet-beoordeeld') && (
        <p className="fwk-aa-tekst" style={css('margin: 8px 0 0; white-space: normal;')}>
          {g.status === 'niet-beoordeeld' ? 'Hierover kon niets met zekerheid worden gezegd, omdat er geen letterlijk citaat uit uw tekst bij te vinden was. Controleer dit zelf.' : g.verbetering}
        </p>
      )}
    </li>
  );
}

// antwoord: { uitkomst, uitkomstTekst?, eisen, resultaten, punten, statistiek }
export default function BeoordelingResultaat({ antwoord, datum, onSluit }) {
  const gekoppeld = koppelOordelen(antwoord.eisen, antwoord.resultaten);
  const tel = telStatussen(gekoppeld);
  const eerst = eerstAanpakken(antwoord.punten, gekoppeld, 5);
  const zonderCitaat = Number(antwoord.statistiek && antwoord.statistiek.zonderGeldigCitaat) || 0;
  const toon = uitkomstToon(antwoord.uitkomst) === 'groen' ? 'succes' : uitkomstToon(antwoord.uitkomst) === 'oranje' ? 'waarschuwing' : 'info';

  return (
    <div className="fwk-wp-stapel" data-testid="aa-beoordeling">
      <Blok titel={`Beoordeling${datum ? ` van ${datum}` : ''}`} actie={onSluit ? <button type="button" className="fwk-wp-link" onClick={onSluit}>Sluiten</button> : null}>
        <Melding toon={toon} testid="aa-uitkomst">
          <span>
            <strong>{uitkomstLabel(antwoord.uitkomst)}.</strong> {hoofdletter(String(antwoord.uitkomstTekst || '').replace(/^[^:]*:\s*/, ''))}
          </span>
        </Melding>
        <div className="fwk-aa-chips" style={css('margin-top: 12px;')} data-testid="aa-tellingen">
          <Chip toon="groen">Gedekt {tel.gedekt}</Chip>
          <Chip toon="oranje">Deels {tel.deels}</Chip>
          <Chip toon="rood">Ontbreekt {tel.ontbreekt}</Chip>
          {tel['niet-beoordeeld'] > 0 && <Chip toon="grijs">Niet beoordeeld {tel['niet-beoordeeld']}</Chip>}
        </div>
        <p className="fwk-aa-klein" style={css('margin: 12px 0 0;')}>
          Dit is een hulpmiddel, geen oordeel van het fonds en geen voorspelling. U beslist zelf of uw aanvraag klaar is.
        </p>
        {zonderCitaat > 0 && (
          <p className="fwk-aa-klein" style={css('margin: 6px 0 0;')}>
            Bij {zonderCitaat} {zonderCitaat === 1 ? 'oordeel' : 'oordelen'} kon geen letterlijk citaat uit uw tekst worden gevonden. Die staan als "niet beoordeeld", niet als gedekt.
          </p>
        )}
      </Blok>

      {eerst.length > 0 && (
        <Blok titel="Pak dit eerst aan" testid="aa-eerst">
          <ol className="fwk-aa-lijst">
            {eerst.map((g) => (
              <li key={g.eis.id}>
                <div className="fwk-aa-eis">
                  <div className="fwk-aa-eis-tekst">{g.eis.tekst}</div>
                  <Chip toon={statusToon(g.status)}>{statusLabel(g.status)}</Chip>
                </div>
                {g.verbetering && (
                  <p className="fwk-aa-tekst" style={css('margin: 6px 0 0; white-space: normal;')}>
                    {g.verbetering}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Blok>
      )}

      <Blok titel="Alle criteria" aantal={gekoppeld.length} testid="aa-alle-oordelen">
        <ul className="fwk-aa-lijst">
          {gekoppeld.map((g) => (
            <Oordeel key={g.eis.id} g={g} />
          ))}
        </ul>
      </Blok>
    </div>
  );
}
