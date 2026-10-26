// Of een regeling of fonds bij de organisatie past: een eenvoudige, regelgebaseerde vergelijking met het organisatieprofiel
// (disciplines, werkgebied, status, bedrag). Gedeeld door Deadlines (detailpaneel) en het dekkingsplan (uitklapregel).
// Zuiver: geen netwerk, geen opslag. Er wordt niets verzonnen; ontbreekt het profiel, dan zegt de uitkomst dat.
//
// opties.aanbevolen = true: het fonds staat al in de lijst van dit project, want de matching (op de discipline, doelgroep en het werkgebied van het
// PROJECT) heeft het gekozen. Dan vergelijken we met dat project en nooit met het organisatieprofiel, en is de uitkomst nooit negatief:
// wat aansluit staat vooraan, en alleen echte aandachtspunten (budget uitgeput, nog niet open, bedrag boven het maximum) staan onder "Let op".
function alsLijst(x) {
  return [].concat(x || []).filter(Boolean).map((t) => String(t).trim()).filter(Boolean);
}

const rakenAan = (a, b) => Boolean(a) && Boolean(b) && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1);

function kansVoorAanbevolen(regeling, project, projects) {
  const p = project || {};
  const projectThemas = alsLijst(p.discipline).map((t) => t.toLowerCase());
  const projectDoelgroepen = alsLijst(p.doelgroep).map((t) => t.toLowerCase());
  const projectRegio = String(p.regio || '').toLowerCase();
  const punten = [];
  const aandacht = [];

  const regelingThemas = regeling.themasNamen && regeling.themasNamen.length ? regeling.themasNamen : regeling.thema ? [regeling.thema] : [];
  const themaMatch = regelingThemas.filter((rt) => rt && projectThemas.some((t) => rakenAan(t, rt.toLowerCase())));

  if (themaMatch.length) punten.push(`de disciplines ${themaMatch.join(', ')} sluiten aan bij uw project`);

  const regelingDoelgroepen = alsLijst(regeling.doelgroepenNamen);
  const doelgroepMatch = regelingDoelgroepen.filter((rd) => projectDoelgroepen.some((d) => rakenAan(d, rd.toLowerCase())));

  if (doelgroepMatch.length) punten.push(`de doelgroepen ${doelgroepMatch.join(', ')} sluiten aan bij uw project`);

  const regelingWerkgebieden = regeling.werkgebiedenNamen && regeling.werkgebiedenNamen.length ? regeling.werkgebiedenNamen : regeling.regio ? [regeling.regio] : [];
  const gebiedMatch = regelingWerkgebieden.some((rw) => {
    const r = String(rw).toLowerCase();

    return r === 'nederland' || r === 'landelijk' || rakenAan(r, projectRegio);
  });

  // Een afwijkend werkgebied melden we hier niet: het project zegt bijvoorbeeld "Zaandam" en het fonds "Noord-Holland". Die koppeling maakt de matching al.
  if (gebiedMatch) punten.push('het werkgebied sluit aan');

  if (regeling.status === 'Open') punten.push('de regeling is nu open');
  if (regeling.status === 'Budget uitgeput') aandacht.push('het budget is voor deze ronde uitgeput');
  if (regeling.status === 'Aangekondigd') aandacht.push('de openingsdatum is nog niet bekend');

  const gevraagd = Number(String(p.gevraagd || '').replace(/[^0-9]/g, '')) || (projects || []).map((x) => Number(String(x.gevraagd || '').replace(/[^0-9]/g, ''))).filter(Boolean)[0];

  if (gevraagd && regeling.bedragMax && gevraagd > regeling.bedragMax) aandacht.push('uw gevraagde bedrag ligt boven het maximum van deze regeling');

  const goed = themaMatch.length > 0 || doelgroepMatch.length > 0;
  const label = goed ? 'Goede match' : 'Past bij uw project';
  const tekst = `${punten.length ? `Wat aansluit: ${punten.join(', ')}.` : 'Dit fonds staat in uw lijst op basis van de gegevens van uw project.'}${aandacht.length ? ` Let op: ${aandacht.join(', ')}.` : ''}`;

  return { label, tekst, ...KLEUREN[label] };
}

const KLEUREN = {
  'Goede match': { bg: '#EAF4EE', color: '#2F6D47', border: '#CFE4D7' },
  'Past bij uw project': { bg: '#EAF1F6', color: '#2C4A5E', border: '#CFDFEA' },
  'Mogelijk passend': { bg: '#EAF1F6', color: '#2C4A5E', border: '#CFDFEA' },
  'Waarschijnlijk niet passend': { bg: '#FBF1E3', color: '#8A5A16', border: '#EEDCC0' },
  'Vul uw organisatieprofiel': { bg: '#EEF1F0', color: '#5A6A66', border: '#DDE4E1' },
};

export function kansrijkheid(regeling, orgProfile, projects, opties = {}) {
  if (opties && opties.aanbevolen) return kansVoorAanbevolen(regeling, opties.project, projects);

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

  const tekst = label === 'Vul uw organisatieprofiel'
    ? 'Zodra uw discipline en werkgebied in het profiel staan, kan Subsidie Kompas beoordelen of deze regeling bij u past.'
    : `${punten.length ? `Wat aansluit: ${punten.join(', ')}.` : ''}${minpunten.length ? `${punten.length ? ' ' : ''}Let op: ${minpunten.join(', ')}.` : ''}`;

  return { label, tekst, ...KLEUREN[label] };
}
