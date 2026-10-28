// "Slimme associatie" + "Overig, anders namelijk" onder de projectomschrijving.
// - Het lid typt eigen woorden die in geen lijst staan; die blijven bij het project staan en zichtbaar.
// - Op verzoek (knop, nooit automatisch) stelt de slimme associatie (AI) disciplines, doelgroepen en werkgebieden voor uit de omschrijving en koppelt de eigen
//   woorden op betekenis aan bestaande waarden. Elk voorstel noemt waarom. Niets wordt toegepast zonder dat het lid het kiest.
import React, { useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { veldStijl } from '../../../shared/ui/index.js';
import { haalTrefwoordVoorstellen } from '../../../data/services/trefwoorden.js';
import { legKoppeling, leesEigenTermen, verwijderWoord, voegWoordenToe } from './eigenTermen.js';
import { voegRegioToe } from './trefwoorden.js';

const alsLijst = (w) => (Array.isArray(w) ? w : w ? [w] : []);
const LABEL = { discipline: 'Discipline', doelgroep: 'Doelgroep', regio: 'Werkgebied' };
const sleutel = (t) => String(t || '').toLowerCase().trim();

const MELDING = {
  daglimiet: 'De slimme associatie is vandaag al veel gebruikt. Morgen kan het weer; uw woorden blijven bewaard.',
  storing: 'De slimme associatie is nu even niet beschikbaar. Uw woorden blijven bewaard; probeer het straks opnieuw.',
};

export default function SlimmeHerkenning({ form, setVeld, onDenk = haalTrefwoordVoorstellen }) {
  const eigen = useMemo(() => leesEigenTermen(form.eigenTermen), [form.eigenTermen]);
  const [concept, setConcept] = useState('');
  const [stand, setStand] = useState({ status: 'rust', voorstellen: [], reden: null });
  const [genegeerd, setGenegeerd] = useState({});
  const tekst = `${form.naam || ''}. ${form.omschrijving || ''}`;
  const genoegTekst = String(form.omschrijving || '').trim().length >= 20;
  const kanDenken = genoegTekst || eigen.length > 0;
  const gekozen = { discipline: alsLijst(form.discipline), doelgroep: alsLijst(form.doelgroep), regio: String(form.regio || '').split(/[,;]| en /).map((x) => x.trim()).filter(Boolean) };

  const voegToe = () => {
    if (!concept.trim()) return;

    setVeld('eigenTermen', voegWoordenToe(eigen, concept));
    setConcept('');
  };

  const denk = async () => {
    setStand({ status: 'bezig', voorstellen: [], reden: null });

    const antwoord = await onDenk({ tekst, eigenTermen: eigen, gekozen });

    setGenegeerd({});
    setStand({ status: antwoord.beschikbaar ? 'klaar' : 'niet-beschikbaar', voorstellen: antwoord.voorstellen || [], reden: antwoord.reden || null });
  };

  // Zichtbaar: alleen wat nog niet gekozen is (het lid kan intussen zelf iets gekozen hebben) en niet weggeklikt.
  const zichtbaar = stand.voorstellen.filter((v) => {
    const al = v.categorie === 'regio' ? gekozen.regio.map(sleutel).includes(sleutel(v.naam)) : alsLijst(form[v.categorie]).map(sleutel).includes(sleutel(v.naam));

    return !al && !genegeerd[`${v.categorie}:${v.naam}`];
  });

  const kies = (v) => {
    if (v.categorie === 'regio') setVeld('regio', voegRegioToe(form.regio, v.naam));
    else setVeld(v.categorie, [...alsLijst(form[v.categorie]), v.naam]);

    if (v.eigenWoord) setVeld('eigenTermen', legKoppeling(eigen, v.eigenWoord, v.categorie, v.naam));
  };

  const chip = css('display: inline-flex; align-items: stretch; border: 1px solid #BFD4C6; border-radius: 999px; background: #EAF4EE; overflow: hidden;');
  const chipEigen = css('display: inline-flex; align-items: center; gap: 4px; border: 1px solid #D7DEDA; border-radius: 999px; background: #F7FAF8; padding-left: 12px; font-size: 13px; font-weight: 700; color: #2C4A5E;');
  const kruis = css("cursor: pointer; min-width: 32px; min-height: 32px; padding: 0 10px 0 4px; border: none; background: none; font-size: 15px; font-weight: 700; line-height: 1; color: #7B8985;");

  return (
    <div data-testid="np-slim" style={css('display: grid; gap: 10px; padding: 14px 16px; border: 1px solid #D7E6DC; border-radius: 14px; background: #F7FBF8;')}>
      <div style={css('font-size: 14px; font-weight: 800; color: #2C4A5E;')}>Past uw project niet precies in de lijsten?</div>

      <label style={css('display: grid; gap: 6px; font-size: 12.5px; font-weight: 700; color: #7B8985;')}>
        Overig, anders namelijk
        <span style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
          <input
            data-testid="np-overig-invoer"
            value={concept}
            onChange={(ev) => setConcept(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                voegToe();
              }
            }}
            placeholder="Bijvoorbeeld: drummen, buurtwerk (meerdere met een komma)"
            style={{ ...veldStijl, flex: '1 1 220px' }}
            autoComplete="off"
          />
          <button type="button" data-testid="np-overig-toevoegen" onClick={voegToe} disabled={!concept.trim()} style={css("cursor: pointer; min-height: 40px; padding: 0 16px; border: 1px solid #BFD4C6; border-radius: 10px; background: #fff; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #2F6D47;")}>
            Toevoegen
          </button>
        </span>
      </label>

      {eigen.length > 0 && (
        <div data-testid="np-overig-lijst" style={css('display: flex; flex-wrap: wrap; gap: 6px 8px;')}>
          {eigen.map((x) => (
            <span key={x.woord} data-testid="np-overig-woord" data-woord={x.woord} style={chipEigen} title={x.koppelingen.length ? `Gekoppeld aan ${x.koppelingen.map((k) => k.naam).join(', ')}` : 'Blijft bij uw project staan'}>
              {x.woord}
              <span style={css('font-size: 12px; font-weight: 700; color: #7B8985;')}>{x.koppelingen.length ? `→ ${x.koppelingen.map((k) => k.naam).join(', ')}` : '(blijft bij uw project staan)'}</span>
              <button type="button" data-testid="np-overig-verwijder" aria-label={`${x.woord} verwijderen`} onClick={() => setVeld('eigenTermen', verwijderWoord(eigen, x.woord))} style={kruis}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
        <button
          type="button"
          data-testid="np-denk-mee"
          onClick={denk}
          disabled={!kanDenken || stand.status === 'bezig'}
          style={css("cursor: pointer; min-height: 40px; padding: 0 18px; border: none; border-radius: 10px; background: #4E9A6C; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #fff;")}
        >
          {stand.status === 'bezig' ? 'Bezig met associëren…' : 'Slimme associatie'}
        </button>
        {!kanDenken && <span style={css('font-size: 12.5px; font-weight: 600; color: #7B8985;')}>Vul eerst een omschrijving in (of een eigen woord).</span>}
      </div>

      {stand.status === 'niet-beschikbaar' && (
        <div data-testid="np-denk-melding" role="status" style={css('font-size: 13px; font-weight: 700; color: #7B6A3A;')}>
          {MELDING[stand.reden] || MELDING.storing}
        </div>
      )}

      {stand.status === 'klaar' && zichtbaar.length === 0 && (
        <div data-testid="np-denk-niets" role="status" style={css('font-size: 13px; font-weight: 700; color: #7B8985;')}>
          Geen nieuwe suggesties meer: wat uit uw tekst volgt, staat al bij uw project of is al aangeboden.
        </div>
      )}

      {zichtbaar.length > 0 && (
        <div data-testid="np-denk-voorstellen" style={css('display: grid; gap: 6px;')}>
          <span style={css('font-size: 12.5px; font-weight: 700; color: #7B8985;')}>Voorgesteld op basis van uw tekst en woorden (u kiest zelf):</span>
          {zichtbaar.map((v) => (
            <span key={`${v.categorie}:${v.naam}`} style={css('display: flex; align-items: center; gap: 8px; flex-wrap: wrap;')}>
              <span style={chip}>
                <button
                  type="button"
                  data-testid="np-denk-kies"
                  data-categorie={v.categorie}
                  data-naam={v.naam}
                  onClick={() => kies(v)}
                  style={css("cursor: pointer; min-height: 32px; padding: 4px 6px 4px 12px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800; color: #2F6D47;")}
                >
                  + {LABEL[v.categorie]}: {v.naam}
                </button>
                <button type="button" data-testid="np-denk-negeer" aria-label={`${v.naam} niet voorstellen`} onClick={() => setGenegeerd((g) => ({ ...g, [`${v.categorie}:${v.naam}`]: true }))} style={kruis}>
                  ×
                </button>
              </span>
              <span style={css('font-size: 12.5px; font-weight: 600; color: #7B8985;')}>{v.eigenWoord ? `Uw woord "${v.eigenWoord}" hoort hierbij.` : `Uit uw tekst: "${v.bewijs}"`}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
