// Snelle invoer van een cofinancier of andere financiering op naam (financier_naam). Eén gedeeld formulier voor
// het projectoverzicht en het tabblad Projectfinanciering; beide schrijven rechtstreeks naar
// subsidie_kompas_program_funding (via voegFinancierToe), dus er is geen tweede financiële bron.
//
// Geen koppeling aan een fonds of regeling uit de catalogus (geen gokwerk op namen): fondsen en regelingen
// uit de database neemt u op via Deadlines. Het bedrag telt mee volgens de status: Toegekend of Aangevraagd.
// De deadline is contextafhankelijk (zie deadlineVeldBij): standaard bij Interessant en In voorbereiding,
// optioneel bij Aangevraagd, niet bij Toegekend of Afgewezen.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { voegFinancierToe } from '../../../data/services/projectFinanciering.js';
import { STATUSSEN, STATUS_LABEL, deadlineVeldBij, leesBedragInvoer } from './dekkingsplan.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const INVOER =
  "box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2C4A5E;";

export default function FinancierFormulier({ projectId, onKlaar }) {
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState('');
  const [bedrag, setBedrag] = useState('');
  const [status, setStatus] = useState('awarded');
  const [deadline, setDeadline] = useState('');
  const [eigenDatum, setEigenDatum] = useState(false);
  const [notitieOpen, setNotitieOpen] = useState(false);
  const [notitie, setNotitie] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  const deadlineVeld = deadlineVeldBij(status);
  const toonDeadline = deadlineVeld === 'standaard' || (deadlineVeld === 'optioneel' && eigenDatum);

  const sluit = () => {
    setOpen(false);
    setNaam('');
    setBedrag('');
    setStatus('awarded');
    setDeadline('');
    setEigenDatum(false);
    setNotitieOpen(false);
    setNotitie('');
    setFout('');
  };

  const bewaar = async (e) => {
    e.preventDefault();

    const gelezen = leesBedragInvoer(bedrag);

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
      <button
        type="button"
        data-testid="pf-financier-open"
        onClick={() => setOpen(true)}
        style={css("cursor: pointer; min-height: 40px; padding: 0 16px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
      >
        + Financier toevoegen
      </button>
    );
  }

  return (
    <form
      data-testid="pf-financier-form"
      onSubmit={bewaar}
      style={css('box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px 14px; padding: 16px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}
    >
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
