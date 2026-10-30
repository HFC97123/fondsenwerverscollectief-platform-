// Het eigen ledenprofiel op de Netwerk-pagina: profielfoto (toevoegen, wijzigen,
// verwijderen) en de beschrijving ("Over mij"). Leden kunnen alleen hun eigen
// profiel wijzigen (RPC's zet_mijn_avatar / zet_mijn_bio, zie
// data/services/profielFoto.js). Daarnaast: organisatie, functie en website (LedenGegevens) en de
// schakelaar "zichtbaar in de ledenlijst" (ZichtbaarheidSchakelaar), zie data/services/ledenlijst.js.
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
import { haalOnboarding, bewaarOnboarding } from '../../data/services/onboarding.js';
import { MAX_WEBSITE_TEKENS, veiligeWebsite, websiteLabel, zetMijnLedengegevens } from '../../data/services/ledenlijst.js';

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
              <button type="button" onClick={kies} disabled={bezig} title="JPG of PNG" style={{ ...knop(!fotoPad), ...(bezig ? knopUit : null) }}>
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

const veld = css(
  "width: 100%; box-sizing: border-box; padding: 11px 14px; border: 1px solid #D5E0D9; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 15px; color: #2E3A38; outline: none;",
);
const veldLabel = css('font-size: 12.5px; font-weight: 700; color: #2C4A5E; margin-bottom: 6px;');
const gegevenRij = css('display: grid; grid-template-columns: 110px 1fr; gap: 10px; font-size: 14.5px; line-height: 1.5; padding: 6px 0; border-bottom: 1px solid #EEF2EF;');
const gegevenNaam = css('color: #7B8985; font-weight: 600;');
const gegevenWaarde = css('color: #2C4A5E; font-weight: 600; overflow-wrap: anywhere;');

// Organisatie, functie, website en of het e-mailadres zichtbaar is voor andere leden.
export function LedenGegevens({ profile, magBewerken, onGewijzigd }) {
  const userId = profile && profile.id;
  const [onboarding, setOnboarding] = useState(null);
  const [bewerk, setBewerk] = useState(false);
  const [form, setForm] = useState({ organisatie: '', functie: '', website: '', emailZichtbaar: false });
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');

  useEffect(() => {
    let actief = true;

    if (userId) {
      haalOnboarding(userId).then((data) => {
        if (actief) setOnboarding(data || {});
      });
    }

    return () => {
      actief = false;
    };
  }, [userId]);

  if (!profile) return null;

  const org = (onboarding && onboarding.organisatie) || '';
  const functie = (onboarding && onboarding.functie) || '';
  const site = profile.website || '';

  const start = () => {
    setForm({ organisatie: org, functie, website: websiteLabel(site), emailZichtbaar: Boolean(profile.email_zichtbaar) });
    setFout('');
    setMelding('');
    setBewerk(true);
  };

  const opslaan = async () => {
    if (bezig) return;

    setBezig(true);
    setFout('');

    const r1 = await zetMijnLedengegevens({
      website: form.website,
      profielZichtbaar: Boolean(profile.profiel_zichtbaar),
      emailZichtbaar: form.emailZichtbaar,
    });

    if (r1.fout) {
      setFout(r1.fout);
      setBezig(false);

      return;
    }

    const r2 = await bewaarOnboarding(userId, {
      organisatie: form.organisatie.trim(),
      functie: form.functie.trim(),
      waarNaarOpZoek: onboarding && onboarding.waar_naar_op_zoek,
      doel: onboarding && onboarding.doel,
      overgeslagen: false,
    });

    if (r2.fout) {
      setFout('Organisatie en functie konden niet worden opgeslagen. Probeer het later opnieuw.');
      setBezig(false);

      return;
    }

    setOnboarding((o) => ({ ...(o || {}), organisatie: form.organisatie.trim(), functie: form.functie.trim() }));

    if (onGewijzigd) await onGewijzigd();

    setBewerk(false);
    setBezig(false);
    setMelding('Uw gegevens zijn opgeslagen.');
  };

  const zet = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div data-testid="leden-gegevens" style={css('margin-bottom: 28px; max-width: 560px;')}>
      <div style={css('font-size: 12.5px; font-weight: 700; color: #4E9A6C; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;')}>
        Mijn gegevens
      </div>

      {!bewerk && (
        <>
          <div style={gegevenRij}>
            <span style={gegevenNaam}>Organisatie</span>
            <span style={gegevenWaarde}>{org || '—'}</span>
          </div>
          <div style={gegevenRij}>
            <span style={gegevenNaam}>Functie</span>
            <span style={gegevenWaarde}>{functie || '—'}</span>
          </div>
          <div style={gegevenRij}>
            <span style={gegevenNaam}>Website</span>
            <span style={gegevenWaarde}>
              {veiligeWebsite(site) ? (
                <a href={veiligeWebsite(site)} target="_blank" rel="noopener noreferrer" style={css('color: #4E9A6C;')}>
                  {websiteLabel(site)}
                </a>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div style={gegevenRij}>
            <span style={gegevenNaam}>E-mailadres</span>
            <span style={gegevenWaarde}>
              {profile.email || '—'}{' '}
              <span style={css('font-weight: 600; color: #7B8985; font-size: 13px;')}>
                ({profile.email_zichtbaar ? 'zichtbaar voor leden' : 'alleen voor u'})
              </span>
            </span>
          </div>

          {magBewerken && (
            <div style={css('margin-top: 14px;')}>
              <button type="button" onClick={start} style={knop(false)} data-testid="leden-gegevens-bewerken">
                Gegevens bewerken
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
        <div style={css('display: grid; gap: 12px;')}>
          <label>
            <div style={veldLabel}>Organisatie</div>
            <input value={form.organisatie} onChange={zet('organisatie')} maxLength={200} style={veld} placeholder="Waar werkt u?" />
          </label>
          <label>
            <div style={veldLabel}>Functie</div>
            <input value={form.functie} onChange={zet('functie')} maxLength={200} style={veld} placeholder="Bijvoorbeeld: zelfstandig fondsenwerver" />
          </label>
          <label>
            <div style={veldLabel}>Website</div>
            <input value={form.website} onChange={zet('website')} maxLength={MAX_WEBSITE_TEKENS} style={veld} placeholder="www.mijnwebsite.nl" data-testid="leden-website" />
          </label>
          <label style={css('display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; color: #2C4A5E; cursor: pointer;')}>
            <input type="checkbox" checked={form.emailZichtbaar} onChange={zet('emailZichtbaar')} style={css('margin-top: 4px;')} data-testid="leden-email-zichtbaar" />
            <span>Andere leden mogen mijn e-mailadres zien ({profile.email})</span>
          </label>
          <div style={css('display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;')}>
            <button type="button" onClick={opslaan} disabled={bezig} style={{ ...knop(true), ...(bezig ? knopUit : null) }}>
              {bezig ? 'Bezig met opslaan…' : 'Opslaan'}
            </button>
            <button type="button" onClick={() => setBewerk(false)} disabled={bezig} style={knop(false)}>
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

// Schakelaar rechtsboven in het profiel: staat u in de ledenlijst of niet?
export function ZichtbaarheidSchakelaar({ profile, magBewerken, onGewijzigd }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  if (!profile || !magBewerken) return null;

  const aan = Boolean(profile.profiel_zichtbaar);

  const wissel = async () => {
    if (bezig) return;

    setBezig(true);
    setFout('');

    const r = await zetMijnLedengegevens({ website: profile.website, profielZichtbaar: !aan, emailZichtbaar: profile.email_zichtbaar });

    if (r.fout) setFout(r.fout);
    else if (onGewijzigd) await onGewijzigd();

    setBezig(false);
  };

  return (
    <div style={css('display: flex; flex-direction: column; align-items: flex-end; gap: 4px;')}>
      <button
        type="button"
        role="switch"
        aria-checked={aan}
        onClick={wissel}
        disabled={bezig}
        data-testid="profiel-zichtbaar"
        style={css(
          `display: inline-flex; align-items: center; gap: 10px; cursor: pointer; padding: 7px 14px 7px 8px; border-radius: 999px; border: 1.5px solid ${aan ? '#4E9A6C' : '#E1EAE4'}; background: #FFFFFF; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #2C4A5E;${bezig ? ' opacity: 0.6;' : ''}`,
        )}
      >
        <span
          aria-hidden="true"
          style={css(`width: 36px; height: 20px; border-radius: 999px; background: ${aan ? '#4E9A6C' : '#C9D3CE'}; position: relative; flex-shrink: 0;`)}
        >
          <span style={css(`position: absolute; top: 2px; left: ${aan ? '18px' : '2px'}; width: 16px; height: 16px; border-radius: 50%; background: #FFFFFF;`)} />
        </span>
        {aan ? 'Zichtbaar in de ledenlijst' : 'Niet zichtbaar in de ledenlijst'}
      </button>
      {fout && <div role="alert" style={css('font-size: 12.5px; color: #B3412F;')}>{fout}</div>}
    </div>
  );
}
