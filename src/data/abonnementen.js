// Eén plek voor de communicatie over Pro en Premium op de website: naam, prijzen per
// looptijd en de duur van de gratis proefperiode. Uitsluitend weergave.
//
// Prijsmodel (Aisya, 15-10-2026):
//  - De MAANDprijs is de gewone prijs en loopt gewoon door, per maand opzegbaar.
//  - Wie een kwartaal, half jaar of jaar VOORUIT betaalt, krijgt korting. Na die
//    vooruitbetaalde periode gaat het abonnement automatisch over op de gewone
//    maandprijs, tenzij het is opgezegd.
//  - Een gratis proefperiode bestaat alleen bij de maandkeuze.
//
// Spelregels:
//  - prijzen staan altijd EXCLUSIEF btw en worden zo ook getoond. De app rekent
//    NOOIT btw uit; dat doet Stripe bij het afrekenen;
//  - dit bestand beslist nooit of iemand een proefperiode krijgt, betaald heeft
//    of toegang heeft. Dat bepaalt de server (Stripe), niet de frontend;
//  - de werkelijke prijzen in Stripe moeten hiermee overeenkomen; de server blijft
//    de bron van waarheid en controleert het bedrag zelf. De prijzen die de server
//    verwacht staan in supabase/functions/create-checkout-session/index.ts.
//  - alle bedragen zijn in euro-CENTEN en per MAAND. Alleen hier aanpassen.

export const LOOPTIJDEN = ['MAAND', 'KWARTAAL', 'HALFJAAR', 'JAAR'];

// Looptijd die de prijsvergelijking op de website standaard toont (meeste besparing).
export const STANDAARD_LOOPTIJD = 'JAAR';

// Looptijd als er niets gekozen is op de abonneren-pagina (oude links, geen bewaarde keuze):
// de gewone maandkeuze, zodat niemand onverwacht een groot bedrag vooruit ziet staan.
export const BASIS_LOOPTIJD = 'MAAND';

export const LOOPTIJD_INFO = {
  MAAND: { code: 'MAAND', maanden: 1, label: 'Maandelijks', periode: 'per maand', duur: '1 maand' },
  KWARTAAL: { code: 'KWARTAAL', maanden: 3, label: 'Per kwartaal', periode: 'per kwartaal', duur: '3 maanden' },
  HALFJAAR: { code: 'HALFJAAR', maanden: 6, label: 'Per half jaar', periode: 'per half jaar', duur: '6 maanden' },
  JAAR: { code: 'JAAR', maanden: 12, label: 'Per jaar', periode: 'per jaar', duur: '12 maanden' },
};

// Prijs PER MAAND in centen, per tier en looptijd.
const PRIJS_PER_MAAND_CENT = {
  pro: { MAAND: 4000, KWARTAAL: 3500, HALFJAAR: 3200, JAAR: 3000 },
  premium: { MAAND: 7500, KWARTAAL: 6500, HALFJAAR: 6000, JAAR: 5500 },
};

export function isGeldigeLooptijd(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(LOOPTIJD_INFO, code);
}

function geldig(tier, looptijd) {
  return (tier === 'pro' || tier === 'premium') && isGeldigeLooptijd(looptijd);
}

// "€40", "€32,50": hele euro's zonder decimalen, anders twee decimalen met komma.
export function formatEuro(cent) {
  const n = Number(cent);

  if (!Number.isFinite(n)) {
    return '';
  }

  const euro = n / 100;

  return `€${Number.isInteger(euro) ? String(euro) : euro.toFixed(2).replace('.', ',')}`;
}

export function prijsPerMaandCent(tier, looptijd) {
  return geldig(tier, looptijd) ? PRIJS_PER_MAAND_CENT[tier][looptijd] : null;
}

// De gewone maandprijs: ook wat er na een vooruitbetaalde periode per maand wordt afgeschreven.
export function maandPrijsCent(tier) {
  return prijsPerMaandCent(tier, 'MAAND');
}

// Wat er aan het begin van de periode in één keer wordt afgeschreven.
export function totaalCent(tier, looptijd) {
  return geldig(tier, looptijd) ? PRIJS_PER_MAAND_CENT[tier][looptijd] * LOOPTIJD_INFO[looptijd].maanden : null;
}

// Besparing in centen ten opzichte van maandelijks betalen over dezelfde periode.
export function besparingCent(tier, looptijd) {
  return geldig(tier, looptijd) ? PRIJS_PER_MAAND_CENT[tier].MAAND * LOOPTIJD_INFO[looptijd].maanden - totaalCent(tier, looptijd) : null;
}

// Besparing in hele procenten, naar BENEDEN afgerond (nooit meer beloven dan er is).
export function besparingPercentage(tier, looptijd) {
  if (!geldig(tier, looptijd)) {
    return null;
  }

  const maand = PRIJS_PER_MAAND_CENT[tier].MAAND;

  return Math.floor(((maand - PRIJS_PER_MAAND_CENT[tier][looptijd]) / maand) * 100);
}

// Hoogste besparing over beide betaalde tiers voor een looptijd, voor één algemene vermelding.
export function maxBesparingPercentage(looptijd) {
  return Math.max(besparingPercentage('pro', looptijd) ?? 0, besparingPercentage('premium', looptijd) ?? 0);
}

// Alleen bij de maandkeuze bestaat een gratis proefperiode. Of een lid er recht op heeft, bepaalt de server.
export function proefMogelijk(looptijd) {
  return looptijd === 'MAAND';
}

// Alle weergaveteksten voor één combinatie, uit dezelfde bron.
export function prijsInfo(tier, looptijd) {
  if (!geldig(tier, looptijd)) {
    return null;
  }

  const info = LOOPTIJD_INFO[looptijd];
  const vooruit = looptijd !== 'MAAND';

  return {
    tier,
    looptijd,
    label: info.label,
    periode: info.periode,
    duur: info.duur,
    maanden: info.maanden,
    vooruit,
    perMaand: formatEuro(prijsPerMaandCent(tier, looptijd)),
    totaal: formatEuro(totaalCent(tier, looptijd)),
    maandPrijs: formatEuro(maandPrijsCent(tier)),
    besparing: vooruit ? formatEuro(besparingCent(tier, looptijd)) : '',
    besparingPercentage: vooruit ? besparingPercentage(tier, looptijd) : 0,
    proef: proefMogelijk(looptijd),
  };
}

export const ABONNEMENTEN = {
  pro: {
    tier: 'pro',
    naam: 'Pro',
    prijsTekst: `${formatEuro(maandPrijsCent('pro'))} per maand excl. btw`,
    proefDuur: '7 dagen',
  },
  premium: {
    tier: 'premium',
    naam: 'Premium',
    prijsTekst: `${formatEuro(maandPrijsCent('premium'))} per maand excl. btw`,
    proefDuur: '24 uur',
  },
};
