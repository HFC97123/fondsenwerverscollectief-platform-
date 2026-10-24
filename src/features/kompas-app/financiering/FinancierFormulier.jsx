// Snelle invoer van een cofinancier of andere financiering op naam (financier_naam). Eén gedeeld formulier voor
// het projectoverzicht en het tabblad Projectfinanciering; beide schrijven rechtstreeks naar
// subsidie_kompas_program_funding (via voegFinancierToe), dus er is geen tweede financiële bron.
//
// Geen koppeling aan een fonds of regeling uit de catalogus (geen gokwerk op namen): fondsen en regelingen
// uit de database neemt u op via Deadlines. Het bedrag telt mee volgens de status: Toegekend of Aangevraagd.
// De deadline is contextafhankelijk (zie deadlineVeldBij): standaard bij Interessant en In voorbereiding,
// optioneel bij Aangevraagd, niet bij Toegekend of Afgewezen.
import React, { useEffect, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { voegFinancierToe } from '../../../data/services/projectFinanciering.js';
import { STATUSSEN, STATUS_LABEL, deadlineVeldBij, leesBedragInvoer } from './dekkingsplan.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const INVOER =
  "box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2C4A5E;";

// Eigen bijdrage: telt in de dekking als financier. Ze staat in het project zelf (één bron, ook voor de projectgegevens), dus dit formulier
// schrijft haar via `onEigenBijdrage` naar het project en niet als losse regel in het dekkingsplan (anders telt ze dubbel).
export default function FinancierFormulier({ projectId, onKlaar, eigenBijdrage = 0, onEigenBijdrage = null, openEigen = 0 }) {
  const [open, setOpen] = useState(false);
  const [uitleg, setUitleg] = useState(false);
  const [soort, setSoort] = useState('financier'); // 'financier' | 'eigen'
  const [naam, setNaam] = useState('');
  const [bedrag, setBedrag] = useState('');
  const [status, setStatus] = useState('awarded');
  const [deadline, setDeadline] = useState('');
  const [eigenDatum, setEigenDatum] = useState(false);
  const [notitieOpen, setNotitieOpen] = useState(false);
  const [notitie, setNotitie] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  // "Aanpassen" bij de regel Eigen bijdrage opent dit formulier direct in de stand voor de eigen bijdrage.
  useEffect(() => {
    if (!openEigen) return;

    setSoort('eigen');
    setBedrag(eigenBijdrage ? String(eigenBijdrage).replace('.', ',') : '');
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEigen]);

  const deadlineVeld = deadlineVeldBij(status);
  const toonDeadline = deadlineVeld === 'standaard' || (deadlineVeld === 'optioneel' && eigenDatum);

  const sluit = () => {
    setOpen(false);
    setNaam('');
    setBedrag('');
    setStatus('awarded');
    setSoort('financier');
    setDeadline('');
    setEigenDatum(false);
    setNotitieOpen(false);
    setNotitie('');
    setFout('');
  };

  const bewaar = async (e) => {
    e.preventDefault();

    const gelezen = leesBedragInvoer(bedrag);

    if (soort === 'eigen') {
      if (!gelezen.ok || gelezen.waarde == null) {
        setFout('Vul een bedrag in, bijvoorbeeld 7.500.');

        return;
      }

      setBezig(true);

      const gelukt = typeof onEigenBijdrage === 'function' ? await onEigenBijdrage(Math.round(gelezen.waarde)) : false;

      setBezig(false);

      if (!gelukt) {
        setFout('Opslaan is niet gelukt. Probeer het opnieuw.');

        return;
      }

      sluit();

      return;
    }

    if (!naam.trim()) {
      setFout('Vul de naam van de financier in.');

      return;
    }

    if (!gelezen.ok) {
      setFout('Vul een bedrag in, bijvoorbeeld 12.500.');

      return;
    }

    setBezig(true);

    const res = await voegFinancierToe({ projectId, naam, bedrag: gelezen.waarde, status, deadline: toonDeadline ? deadline : null, notitie });

    setBezig(false);

    if (!res.ok) {
      setFout(res.reden === 'bestaat-al' ? 'Deze financier staat al bij dit project.' : 'Toevoegen is niet gelukt. Probeer het opnieuw.');

      return;
    }

    sluit();
    await onKlaar();
  };

  if (!open) {
    return (
      <span
        style={css('position: relative; display: inline-block;')}
        onMouseEnter={() => setUitleg(true)}
        onMouseLeave={() => setUitleg(false)}
      >
        <button
          type="button"
          data-testid="pf-financier-open"
          aria-describedby="pf-financier-uitleg"
          onClick={() => setOpen(true)}
          onFocus={() => setUitleg(true)}
          onBlur={() => setUitleg(false)}
          style={css("cursor: pointer; min-height: 40px; padding: 0 16px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
        >
          + Financier toevoegen
        </button>
        {uitleg && (
          <span
            id="pf-financier-uitleg"
            role="tooltip"
            data-testid="pf-financier-uitleg"
            style={css(`${TEKST} position: absolute; z-index: 20; left: 0; bottom: calc(100% + 8px); width: 300px; max-width: 80vw; box-sizing: border-box; padding: 12px 14px; border: 1px solid #CFDDD5; border-radius: 12px; background: #FFFFFF; box-shadow: 0 8px 24px rgba(44, 74, 94, 0.14); font-size: 13px; color: #2C4A5E;`)}
          >
            <strong style={css('display: block; margin-bottom: 4px;')}>Bijvoorbeeld:</strong>
            <span style={css('display: block;')}>• Een fonds waar u zelf al een aanvraag voor wilt doen</span>
            <span style={css('display: block;')}>• Een eigen bijdrage</span>
          </span>
        )}
      </span>
    );
  }

  return (
    <form
      data-testid="pf-financier-form"
      onSubmit={bewaar}
      style={css('box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px 14px; padding: 16px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}
    >
      {typeof onEigenBijdrage === 'function' && (
        <div style={css('grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap;')} role="group" aria-label="Soort financiering">
          {[['financier', 'Financier'], ['eigen', 'Eigen bijdrage']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`pf-financier-soort-${id}`}
              aria-pressed={soort === id}
              onClick={() => {
                setSoort(id);
                setFout('');
                setBedrag(id === 'eigen' && eigenBijdrage ? String(eigenBijdrage).replace('.', ',') : '');
              }}
              style={css(`cursor: pointer; min-height: 36px; padding: 0 16px; border-radius: 999px; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; border: 1px solid ${soort === id ? '#4E9A6C' : '#CFDDD5'}; background: ${soort === id ? '#E3F2E8' : '#FFFFFF'}; color: ${soort === id ? '#2F6D47' : '#2C4A5E'};`)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {soort === 'eigen' ? (
        <>
          <label style={css('min-width: 0;')}>
            <span style={css(LABEL)}>Eigen bijdrage (bedrag)</span>
            <input data-testid="pf-eigen-bedrag" inputMode="decimal" value={bedrag} onChange={(e) => setBedrag(e.target.value)} placeholder="€" style={css(INVOER)} />
          </label>
          <div style={css(`${TEKST} grid-column: 1 / -1; font-size: 13px;`)}>Een eigen bijdrage telt mee in de dekking van de begroting, net als een financier.</div>
        </>
      ) : (
      <>
      <label style={css('min-width: 0;')}>
        <span style={css(LABEL)}>Financier</span>
        <input data-testid="pf-financier-naam" value={naam} maxLength={200} onChange={(e) => setNaam(e.target.value)} placeholder="Bijvoorbeeld Gemeente Amsterdam" style={css(INVOER)} />
      </label>
      <label style={css('min-width: 0;')}>
        <span style={css(LABEL)}>Bedrag</span>
        <input data-testid="pf-financier-bedrag" inputMode="decimal" value={bedrag} onChange={(e) => setBedrag(e.target.value)} placeholder="€" style={css(INVOER)} />
      </label>
      <label style={css('min-width: 0;')}>
        <span style={css(LABEL)}>Status</span>
        <select data-testid="pf-financier-status" value={status} onChange={(e) => setStatus(e.target.value)} style={css(INVOER)}>
          {STATUSSEN.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      {deadlineVeld === 'standaard' && (
        <label style={css('min-width: 0;')}>
          <span style={css(LABEL)}>Deadline</span>
          <input data-testid="pf-financier-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={css(INVOER)} />
        </label>
      )}
      {deadlineVeld === 'optioneel' && (
        <div style={css('min-width: 0;')}>
          {eigenDatum ? (
            <label>
              <span style={css(LABEL)}>Eigen datum (optioneel)</span>
              <input data-testid="pf-financier-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={css(INVOER)} />
            </label>
          ) : (
            <button
              type="button"
              data-testid="pf-financier-deadline-toon"
              onClick={() => setEigenDatum(true)}
              style={css("cursor: pointer; margin-top: 18px; min-height: 40px; padding: 0; border: none; background: none; color: #4E9A6C; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
            >
              + Eigen datum bijhouden
            </button>
          )}
        </div>
      )}

      <div style={css('grid-column: 1 / -1; min-width: 0;')}>
        {notitieOpen ? (
          <label>
            <span style={css(LABEL)}>Notitie (optioneel)</span>
            <textarea data-testid="pf-financier-notitie" rows={2} maxLength={4000} value={notitie} onChange={(e) => setNotitie(e.target.value)} style={css(`${INVOER} resize: vertical; line-height: 1.5;`)} />
          </label>
        ) : (
          <button
            type="button"
            data-testid="pf-financier-notitie-toon"
            onClick={() => setNotitieOpen(true)}
            style={css("cursor: pointer; min-height: 32px; padding: 0; border: none; background: none; color: #4E9A6C; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
          >
            + Notitie toevoegen
          </button>
        )}
      </div>

      </>
      )}

      <div style={css('grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>
        <button
          type="submit"
          disabled={bezig}
          data-testid="pf-financier-opslaan"
          style={css("cursor: pointer; min-height: 40px; padding: 0 18px; border: none; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
        >
          {bezig ? 'Opslaan…' : 'Opslaan'}
        </button>
        <button type="button" onClick={sluit} style={css("cursor: pointer; min-height: 40px; padding: 0 14px; border: none; background: none; color: #4B5C58; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700;")}>
          Annuleren
        </button>
        {fout && (
          <span role="alert" data-testid="pf-financier-fout" style={css(`${TEKST} font-size: 13px; font-weight: 700; color: #9E3B2C;`)}>
            {fout}
          </span>
        )}
      </div>
    </form>
  );
}
