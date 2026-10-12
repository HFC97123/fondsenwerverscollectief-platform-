// Gedeelde validatie en voorbereiding voor het opslaan van de basisgegevens van een project. Gebruikt door het
// aanmaakformulier (Projecten) en het bewerkformulier (projectdossier), zodat er één regelset is:
// naam verplicht, einddatum niet voor de startdatum, bedragen strikt, en het te financieren bedrag altijd afgeleid
// met teFinancieren() (begroting min eigen bijdrage, nooit negatief). Geen React, geen database.
import { bedragenVoorOpslaan, teFinancieren } from './financiering/dekkingsplan.js';

export const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

// Geeft { ok: true, project } met bedragen en gevraagd ingevuld, of { ok: false, fout } met een leesbare melding.
export function valideerEnBereidOp(form) {
  if (!String((form && form.naam) || '').trim()) {
    return { ok: false, fout: 'Vul in ieder geval de naam van het project in.' };
  }

  if (form.periodeVan && form.periodeTot && ISO_DATUM.test(form.periodeVan) && ISO_DATUM.test(form.periodeTot) && form.periodeTot < form.periodeVan) {
    return { ok: false, fout: 'De einddatum van de looptijd ligt voor de startdatum.' };
  }

  const bedragen = bedragenVoorOpslaan(form);

  if (!bedragen.ok) {
    return { ok: false, fout: bedragen.fout };
  }

  return {
    ok: true,
    project: {
      ...form,
      begroting: bedragen.begroting,
      eigenBijdrage: bedragen.eigenBijdrage,
      gevraagd: bedragen.begroting === '' ? '' : teFinancieren(bedragen.begroting, bedragen.eigenBijdrage),
    },
  };
}
