// Onder het werkgebiedveld: "We herkennen Kumasi in je beschrijving. Wil je Kumasi toevoegen als specifieker werkgebied?"
// Het gekozen werkgebied blijft leidend en wordt hier NOOIT aangepast. De AI doet alleen een voorstel (met GeoNames-controle binnen het gekozen
// land); pas na een klik op "Ja, toevoegen" komt de plaats in het project (form.werkgebied.verfijningen). Zonder bevestiging gebeurt er niets.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { haalVerfijningsvoorstellen } from '../../data/services/werkgebied.js';
import { isoCodesUitWerkgebied, landNaamVoorIso, MAX_VERFIJNINGEN } from '../../shared/werkgebied/werkgebied.js';

const KNOP = "cursor: pointer; min-height: 32px; padding: 4px 12px; border-radius: 999px; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800;";
const KNOP_JA = `${KNOP} border: 1px solid #4E9A6C; background: #EAF4EE; color: #2F6D47;`;
const KNOP_NEE = `${KNOP} border: 1px solid #D7E0DB; background: #fff; color: #5C6B66;`;
const KAART = 'display: grid; gap: 8px; margin-top: 6px; padding: 10px 12px; border: 1px solid #BFD4C6; border-radius: 12px; background: #F4FAF6; font-size: 13.5px; font-weight: 600; color: #2E3A38;';
const WAARSCHUWING = 'display: grid; gap: 8px; margin-top: 6px; padding: 10px 12px; border: 1px solid #E6D3A3; border-radius: 12px; background: #FDF9EE; font-size: 13.5px; font-weight: 600; color: #6B5313;';

const beschrijf = (k) => [k.naam, k.regio && k.regio !== k.naam ? k.regio : '', k.landnaam].filter(Boolean).join(', ');

// `controleSleutel` verandert wanneer het lid de omschrijving of het werkgebied heeft verlaten (onBlur): alleen dan vragen we voorstellen op, zodat er
// niet bij elke toetsaanslag een modelaanroep plaatsvindt.
export default function WerkgebiedVerfijning({ regio, omschrijving, werkgebied, setWerkgebied, controleSleutel, haal = haalVerfijningsvoorstellen }) {
  const [voorstellen, setVoorstellen] = useState([]);
  const [genegeerd, setGenegeerd] = useState({});
  const laatste = useRef('');
  const landen = isoCodesUitWerkgebied(regio);
  const bevestigd = (werkgebied && Array.isArray(werkgebied.verfijningen) ? werkgebied.verfijningen : []).filter((v) => landen.includes(String(v.landcode).toUpperCase()));
  const landenSleutel = landen.join(',');

  useEffect(() => {
    const tekst = String(omschrijving || '').trim();
    const sleutel = `${landenSleutel}|${tekst}`;

    if (!controleSleutel || !landenSleutel || tekst.length < 20 || laatste.current === sleutel) {
      return undefined;
    }

    laatste.current = sleutel;

    let actief = true;

    haal({ tekst, landen: landenSleutel.split(',') }).then((res) => {
      if (actief) setVoorstellen(res.suggesties || []);
    });

    return () => {
      actief = false;
    };
    // De omschrijving zelf staat bewust niet in de afhankelijkheden: de controle loopt alleen na onBlur (controleSleutel).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controleSleutel, landenSleutel]);

  // Zonder gekozen land is er niets om te verfijnen; voorstellen die niet meer bij het gekozen land horen verdwijnen.
  if (!landen.length && !bevestigd.length) {
    return null;
  }

  const voegToe = (k) => {
    if (bevestigd.some((v) => Number(v.geonamesId) === k.geonamesId) || bevestigd.length >= MAX_VERFIJNINGEN) return;

    setWerkgebied({ landen, verfijningen: [...bevestigd, { geonamesId: k.geonamesId, naam: k.naam, landcode: k.landcode, lat: k.lat, lng: k.lng }] });
  };
  const verwijder = (id) => setWerkgebied({ landen, verfijningen: bevestigd.filter((v) => Number(v.geonamesId) !== id) });
  const negeer = (s) => setGenegeerd((cur) => ({ ...cur, [s.naam]: true }));
  const zichtbaar = voorstellen.filter((s) => !genegeerd[s.naam] && !(s.status !== 'buiten-land' && s.kandidaten.every((k) => bevestigd.some((v) => Number(v.geonamesId) === k.geonamesId))));

  return (
    // preventDefault: het veld staat in een <label>; een klik hier mag het veld erboven niet openen.
    <span data-testid="np-verfijning" onClick={(e) => e.preventDefault()} style={css('display: grid; gap: 4px;')}>
      {bevestigd.length > 0 && (
        <span data-testid="np-verfijning-bevestigd" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: 2px;')}>
          <span style={css('font-size: 12.5px; font-weight: 700; color: #7B8985;')}>Specifieker werkgebied:</span>
          {bevestigd.map((v) => (
            <span key={v.geonamesId} style={css('display: inline-flex; align-items: stretch; border: 1px solid #BFD4C6; border-radius: 999px; background: #EAF4EE; overflow: hidden;')}>
              <span style={css("padding: 5px 6px 5px 12px; font-size: 13px; font-weight: 800; color: #2F6D47;")}>
                {v.naam} <span style={css('font-weight: 600; color: #5C6B66;')}>({landNaamVoorIso(v.landcode)})</span>
              </span>
              <button type="button" data-testid="np-verfijning-verwijder" aria-label={`${v.naam} verwijderen als specifieker werkgebied`} onClick={() => verwijder(Number(v.geonamesId))} style={css("cursor: pointer; min-width: 32px; padding: 0 10px 0 4px; border: none; background: none; font-size: 15px; font-weight: 700; color: #7B8985;")}>
                ×
              </button>
            </span>
          ))}
        </span>
      )}

      {zichtbaar.map((s) => {
        if (s.status === 'buiten-land') {
          const k = s.kandidaten[0];

          return (
            <span key={s.naam} data-testid="np-verfijning-buiten" role="status" style={css(WAARSCHUWING)}>
              <span>
                In je beschrijving staat {s.naam}, maar dat lijkt in {k.landnaam} te liggen en niet in je gekozen werkgebied. Controleer de locatie of het werkgebied. Er is niets gewijzigd.
              </span>
              <span>
                <button type="button" data-testid="np-verfijning-negeer" onClick={() => negeer(s)} style={css(KNOP_NEE)}>Begrepen</button>
              </span>
            </span>
          );
        }

        if (s.status === 'kies') {
          return (
            <span key={s.naam} data-testid="np-verfijning-kies" style={css(KAART)}>
              <span>Welke plaats bedoel je met {s.naam}? Kies er één om die toe te voegen als specifieker werkgebied.</span>
              <span style={css('display: flex; flex-wrap: wrap; gap: 6px;')}>
                {s.kandidaten.map((k) => (
                  <button key={k.geonamesId} type="button" data-testid="np-verfijning-optie" data-geonames-id={k.geonamesId} onClick={() => { voegToe(k); negeer(s); }} style={css(KNOP_JA)}>
                    {beschrijf(k)}
                  </button>
                ))}
                <button type="button" data-testid="np-verfijning-negeer" onClick={() => negeer(s)} style={css(KNOP_NEE)}>Geen van deze</button>
              </span>
            </span>
          );
        }

        const k = s.kandidaten[0];

        return (
          <span key={s.naam} data-testid="np-verfijning-uniek" style={css(KAART)}>
            <span>
              We herkennen {s.naam} in je beschrijving. Wil je {beschrijf(k)} toevoegen als specifieker werkgebied?
            </span>
            <span style={css('display: flex; flex-wrap: wrap; gap: 6px;')}>
              <button type="button" data-testid="np-verfijning-ja" onClick={() => { voegToe(k); negeer(s); }} style={css(KNOP_JA)}>Ja, toevoegen</button>
              <button type="button" data-testid="np-verfijning-nee" onClick={() => negeer(s)} style={css(KNOP_NEE)}>Nee</button>
            </span>
          </span>
        );
      })}
    </span>
  );
}
