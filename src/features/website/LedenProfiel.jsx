// Het eigen ledenprofiel op de Netwerk-pagina: profielfoto (toevoegen, wijzigen,
// verwijderen) en de beschrijving ("Over mij"). Leden kunnen alleen hun eigen
// profiel wijzigen (RPC's zet_mijn_avatar / zet_mijn_bio, zie
// data/services/profielFoto.js). Professionele context (werkgever, functie,
// type opdrachten, thema's, ervaring) hoort in de beschrijving, niet in losse velden.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import ProfielAvatar from '../../shared/ui/ProfielAvatar.jsx';
import {
  FOTO_TYPES,
  MAX_BIO_TEKENS,
  normaliseerBio,
  slaBioOp,
  uploadProfielFoto,
  valideerFoto,
  verwijderProfielFoto,
} from '../../data/services/profielFoto.js';

const knop = (primair) =>
  css(
    `cursor: pointer; padding: 9px 20px; border-radius: 999px; font-family: inherit; font-weight: 700; font-size: 13.5px; line-height: 1.2; border: 1.5px solid ${primair ? '#4E9A6C' : '#E1EAE4'}; background: ${primair ? '#4E9A6C' : '#FFFFFF'}; color: ${primair ? '#FFFFFF' : '#4E9A6C'};`,
  );
const knopUit = { opacity: 0.6, cursor: 'default' };
const foutStijl = css('font-size: 13.5px; line-height: 1.45; color: #B3412F; margin-top: 12px;');
const okStijl = css('font-size: 13.5px; line-height: 1.45; color: #2F7D55; margin-top: 12px;');

// Avatar + knoppen "Foto toevoegen/wijzigen/verwijderen". Een gekozen foto wordt
// eerst als voorbeeld getoond en pas na "Opslaan" geüpload.
export function LedenProfielFoto({ userId, fotoPad, initialen, naam, magBewerken, onGewijzigd }) {
  const invoer = useRef(null);
  const [voorbeeld, setVoorbeeld] = useState(null); // { file, url }
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');

  useEffect(
    () => () => {
      if (voorbeeld && voorbeeld.url) {
        URL.revokeObjectURL(voorbeeld.url);
      }
    },
    [voorbeeld],
  );

  const kies = () => {
    setFout('');
    setMelding('');

    if (invoer.current) {
      invoer.current.click();
    }
  };

  const bijKeuze = (e) => {
    const file = e.target.files && e.target.files[0];

    e.target.value = '';
    setMelding('');

    if (!file) {
      return;
    }

    const v = valideerFoto(file);

    if (!v.ok) {
      setVoorbeeld(null);
      setFout(v.fout);

      return;
    }

    setFout('');
    setVoorbeeld({ file, url: URL.createObjectURL(file) });
  };

  const annuleer = () => {
    setVoorbeeld(null);
    setFout('');
  };

  const opslaan = async () => {
    if (!voorbeeld || bezig) {
      return;
    }

    setBezig(true);
    setFout('');

    const res = await uploadProfielFoto({ userId, file: voorbeeld.file, oudPad: fotoPad });

    if (res.fout) {
      setFout(res.fout);
      setBezig(false);

      return;
    }

    if (onGewijzigd) {
      await onGewijzigd();
    }

    setVoorbeeld(null);
    setMelding('Uw foto is opgeslagen.');
    setBezig(false);
  };

  const verwijder = async () => {
    if (bezig) {
      return;
    }

    setBezig(true);
    setFout('');
    setMelding('');

    const res = await verwijderProfielFoto({ oudPad: fotoPad });

    if (res.fout) {
      setFout(res.fout);
      setBezig(false);

      return;
    }

    if (onGewijzigd) {
      await onGewijzigd();
    }

    setMelding('Uw foto is verwijderd.');
    setBezig(false);
  };

  return (
    <div>
      <div style={css('margin: 0 auto 16px; width: 120px;')}>
        <ProfielAvatar pad={fotoPad} voorbeeldUrl={voorbeeld ? voorbeeld.url : null} initialen={initialen} grootte={120} alt={naam ? `Profielfoto van ${naam}` : 'Profielfoto'} />
      </div>

      {magBewerken && (
        <div data-profielfoto-beheer>
          <input
            ref={invoer}
            type="file"
            accept={Object.keys(FOTO_TYPES).join(',')}
            onChange={bijKeuze}
            aria-label="Profielfoto kiezen"
            style={{ display: 'none' }}
          />

          {!voorbeeld && (
            <div style={css('display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 4px;')}>
              <button type="button" onClick={kies} disabled={bezig} style={{ ...knop(!fotoPad), ...(bezig ? knopUit : null) }}>
                {fotoPad ? 'Foto wijzigen' : 'Foto toevoegen'}
              </button>
              {fotoPad && (
                <button type="button" onClick={verwijder} disabled={bezig} style={{ ...knop(false), ...(bezig ? knopUit : null) }}>
                  Foto verwijderen
                </button>
              )}
            </div>
          )}

          {voorbeeld && (
            <div>
              <div style={css('font-size: 13.5px; color: #4B5C58; margin-bottom: 10px;')}>Zo ziet uw nieuwe foto eruit.</div>
              <div style={css('display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;')}>
                <button type="button" onClick={opslaan} disabled={bezig} style={{ ...knop(true), ...(bezig ? knopUit : null) }}>
                  {bezig ? 'Bezig met opslaan…' : 'Foto opslaan'}
                </button>
                <button type="button" onClick={annuleer} disabled={bezig} style={{ ...knop(false), ...(bezig ? knopUit : null) }}>
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {!voorbeeld && !fotoPad && !fout && !melding && (
            <div style={css('font-size: 12.5px; color: #7B8985; margin-top: 8px;')}>JPEG, PNG of WebP, maximaal 5 MB.</div>
          )}
          {fout && (
            <div role="alert" style={foutStijl}>
              {fout}
            </div>
          )}
          {melding && (
            <div role="status" style={okStijl}>
              {melding}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// "Over mij": de beschrijving van het lid. Eén vrij tekstveld voor alle
// professionele context.
export function LedenProfielBio({ bio, magBewerken, onGewijzigd }) {
  const huidig = normaliseerBio(bio);
  const [bewerk, setBewerk] = useState(false);
  const [tekst, setTekst] = useState(huidig);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');

  const start = () => {
    setTekst(huidig);
    setFout('');
    setMelding('');
    setBewerk(true);
  };

  const opslaan = async () => {
    if (bezig) {
      return;
    }

    setBezig(true);
    setFout('');

    const res = await slaBioOp(tekst);

    if (res.fout) {
      setFout(res.fout);
      setBezig(false);

      return;
    }

    if (onGewijzigd) {
      await onGewijzigd();
    }

    setBewerk(false);
    setMelding('Uw beschrijving is opgeslagen.');
    setBezig(false);
  };

  const lengte = tekst.length;

  return (
    <div style={css('margin-bottom: 28px; max-width: 560px;')}>
      {!bewerk && (
        <>
          {huidig ? (
            <div
              data-profiel-bio
              style={css('font-size: 15px; line-height: 1.65; color: #4B5C58; white-space: pre-line; overflow-wrap: anywhere;')}
            >
              {huidig}
            </div>
          ) : (
            <div data-profiel-bio-leeg style={css('font-size: 15px; line-height: 1.65; color: #7B8985;')}>
              {magBewerken
                ? 'Vertel vakgenoten waar u werkt en wat u doet: uw rol (bijvoorbeeld zelfstandig fondsenwerver, adviseur of relatiemanager), voor welke organisaties u werkt of werkte, welke opdrachten u doet en welke thema’s of sectoren u kent.'
                : 'Zodra uw lidmaatschap is goedgekeurd kunt u hier uw beschrijving toevoegen.'}
            </div>
          )}

          {magBewerken && (
            <div style={css('margin-top: 14px;')}>
              <button type="button" onClick={start} style={knop(false)}>
                {huidig ? 'Beschrijving bewerken' : 'Beschrijving toevoegen'}
              </button>
            </div>
          )}

          {melding && (
            <div role="status" style={okStijl}>
              {melding}
            </div>
          )}
        </>
      )}

      {bewerk && (
        <div>
          <textarea
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            rows={7}
            maxLength={MAX_BIO_TEKENS}
            aria-label="Over mij"
            placeholder="Bijvoorbeeld: Werkzaam als zelfstandig fondsenwerver voor culturele en maatschappelijke organisaties. Ervaring met vermogensfondsen, corporate partnerships en subsidieaanvragen."
            style={css(
              "width: 100%; box-sizing: border-box; padding: 13px 15px; border: 1px solid #D5E0D9; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 15px; line-height: 1.6; color: #2E3A38; resize: vertical; outline: none;",
            )}
          />
          <div style={css(`font-size: 12.5px; color: ${lengte >= MAX_BIO_TEKENS ? '#B3412F' : '#7B8985'}; margin: 6px 0 12px; text-align: right;`)}>
            {lengte} / {MAX_BIO_TEKENS} tekens
          </div>
          <div style={css('display: flex; flex-wrap: wrap; gap: 8px;')}>
            <button type="button" onClick={opslaan} disabled={bezig} style={{ ...knop(true), ...(bezig ? knopUit : null) }}>
              {bezig ? 'Bezig met opslaan…' : 'Opslaan'}
            </button>
            <button
              type="button"
              onClick={() => {
                setBewerk(false);
                setFout('');
              }}
              disabled={bezig}
              style={{ ...knop(false), ...(bezig ? knopUit : null) }}
            >
              Annuleren
            </button>
          </div>
          {fout && (
            <div role="alert" style={foutStijl}>
              {fout}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
