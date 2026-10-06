// Eén plek voor de communicatie over Pro en Premium op de abonneren-pagina:
// naam, prijs en de duur van de gratis proefperiode. Uitsluitend weergave.
//
// Spelregels:
//  - prijzen staan altijd EXCLUSIEF btw en worden zo ook getoond;
//  - dit bestand beslist nooit of iemand een proefperiode krijgt, betaald
//    heeft of toegang heeft. Dat bepaalt later de server (Stripe), niet de
//    frontend;
//  - de werkelijke prijs en proefperiode in Stripe moeten hiermee
//    overeenkomen; de server blijft de bron van waarheid.
export const ABONNEMENTEN = {
  pro: {
    tier: 'pro',
    naam: 'Pro',
    prijsTekst: '€12 per maand excl. btw',
    proefDuur: '7 dagen',
  },
  premium: {
    tier: 'premium',
    naam: 'Premium',
    prijsTekst: '€39 per maand excl. btw',
    proefDuur: '24 uur',
  },
};
