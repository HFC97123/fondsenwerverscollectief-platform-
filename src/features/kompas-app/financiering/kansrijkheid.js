// Of een regeling of fonds bij de organisatie past: een eenvoudige, regelgebaseerde vergelijking met het organisatieprofiel
// (disciplines, werkgebied, status, bedrag). Gedeeld door Deadlines (detailpaneel) en het dekkingsplan (uitklapregel).
// Zuiver: geen netwerk, geen opslag. Er wordt niets verzonnen; ontbreekt het profiel, dan zegt de uitkomst dat.
export function kansrijkheid(regeling, orgProfile, projects) {
  const themas = [].concat(orgProfile.themes || [], orgProfile.themas || []).map((x) => String(x).toLowerCase());
  const werkgebied = String(orgProfile.region || orgProfile.regio || '').toLowerCase();
  const punten = [];
  const minpunten = [];

  // Voorkeur voor de centrale, gestructureerde koppelingen (themasNamen/
  // werkgebiedenNamen, uit dezelfde disciplines/werkgebieden-tabellen als
  // Beheer); valt terug op de losse thema/regio-strings voor regelingen die
  // nog niet aan de centrale lijsten gekoppeld zijn.
  const regelingThemas = regeling.themasNamen && regeling.themasNamen.length ? regeling.themasNamen : regeling.thema ? [regeling.thema] : [];
  const aansluitendeThemas = regelingThemas.filter(
    (rt) => rt && themas.some((t) => t && (t.indexOf(rt.toLowerCase()) !== -1 || rt.toLowerCase().indexOf(t) !== -1)),
  );

  if (regelingThemas.length && aansluitendeThemas.length) {
    punten.push(`de disciplines ${aansluitendeThemas.join(', ')} sluiten aan bij uw profiel`);
  } else if (regelingThemas.length && themas.length) {
    minpunten.push(`de disciplines ${regelingThemas.join(', ')} sluiten niet aan bij uw profiel`);
  }

  const regelingWerkgebieden =
    regeling.werkgebiedenNamen && regeling.werkgebiedenNamen.length
      ? regeling.werkgebiedenNamen
      : regeling.regio
        ? [regeling.regio]
        : [];

  if (werkgebied && regelingWerkgebieden.length) {
    const sluitAan = regelingWerkgebieden.some((rw) => {
      const r = rw.toLowerCase();

      return r === 'nederland' || r === 'landelijk' || werkgebied.indexOf(r) !== -1 || r.indexOf(werkgebied) !== -1;
    });

    if (sluitAan) {
      punten.push('het werkgebied sluit aan');
    } else {
      minpunten.push(`het werkgebied ${regelingWerkgebieden.join(', ')} wijkt af van uw werkgebied`);
    }
  }

  if (regeling.status === 'Open') punten.push('de regeling is nu open');
  if (regeling.status === 'Budget uitgeput') minpunten.push('het budget is voor deze ronde uitgeput');
  if (regeling.status === 'Aangekondigd') minpunten.push('de openingsdatum is nog niet bekend');

  const gevraagd = (projects || [])
    .map((p) => Number(String(p.gevraagd || '').replace(/[^0-9]/g, '')))
    .filter(Boolean)[0];

  if (gevraagd && regeling.bedragMax && gevraagd > regeling.bedragMax) {
    minpunten.push('uw gevraagde bedrag ligt boven het maximum van deze regeling');
  }

  const label = !themas.length && !werkgebied
    ? 'Vul uw organisatieprofiel'
    : minpunten.length === 0 && punten.length
      ? 'Goede match'
      : punten.length >= minpunten.length
        ? 'Mogelijk passend'
        : 'Waarschijnlijk niet passend';

  const kleuren = {
    'Goede match': { bg: '#EAF4EE', color: '#2F6D47', border: '#CFE4D7' },
    'Mogelijk passend': { bg: '#EAF1F6', color: '#2C4A5E', border: '#CFDFEA' },
    'Waarschijnlijk niet passend': { bg: '#FBF1E3', color: '#8A5A16', border: '#EEDCC0' },
    'Vul uw organisatieprofiel': { bg: '#EEF1F0', color: '#5A6A66', border: '#DDE4E1' },
  };

  const tekst = label === 'Vul uw organisatieprofiel'
    ? 'Zodra uw discipline en werkgebied in het profiel staan, kan Subsidie Kompas beoordelen of deze regeling bij u past.'
    : `${punten.length ? `Wat aansluit: ${punten.join(', ')}.` : ''}${minpunten.length ? `${punten.length ? ' ' : ''}Let op: ${minpunten.join(', ')}.` : ''}`;

  return { label, tekst, ...kleuren[label] };
}
