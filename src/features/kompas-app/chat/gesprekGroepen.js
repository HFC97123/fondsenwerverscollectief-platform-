// Groepering en zoekfilter van de gesprekkenlijst (Dit project / Eerder).
// Eén definitie voor alle plekken waar gesprekken getoond worden: de linkerkolom, de lade/bottom sheet en
// de projecttab Gesprekken.
//
// "Dit project" betekent: gesprek.projectId === het actieve project van het geopende gesprek
// (of de startkeuze van een nieuw gesprek). Zonder actief project bestaat die groep niet.
// Pure functie: geen React, geen netwerk, geen opslag.

function opTijdAflopend(a, b) {
  return String(b.tijd || '').localeCompare(String(a.tijd || ''));
}

export function normaliseerZoek(tekst) {
  return String(tekst == null ? '' : tekst).trim().toLowerCase();
}

// -> { ditProject: [], eerder: [], totaal, gefilterd }
//   projectFilter: alleen gesprekken van dit project (projecttab); dan staat alles in 'ditProject'.
export function groepeerGesprekken({ gesprekken, actiefProjectId, zoek, projectFilter }) {
  const alle = (gesprekken || []).filter((g) => g && g.id);
  const q = normaliseerZoek(zoek);
  const gefilterd = q ? alle.filter((g) => String(g.titel || 'Gesprek').toLowerCase().indexOf(q) !== -1) : alle;

  if (projectFilter) {
    const metFilter = gefilterd.filter((g) => g.projectId === projectFilter).sort(opTijdAflopend);

    return { ditProject: metFilter, eerder: [], totaal: alle.length, gefilterd: Boolean(q) };
  }

  const dit = actiefProjectId ? gefilterd.filter((g) => g.projectId === actiefProjectId) : [];
  const ditIds = new Set(dit.map((g) => g.id));
  const rest = gefilterd.filter((g) => !ditIds.has(g.id));

  return { ditProject: dit.sort(opTijdAflopend), eerder: rest.sort(opTijdAflopend), totaal: alle.length, gefilterd: Boolean(q) };
}
