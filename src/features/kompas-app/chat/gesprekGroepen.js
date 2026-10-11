// Groepering en zoekfilter van de gesprekkenlijst.
// Eén definitie voor alle plekken waar gesprekken getoond worden: de linkerkolom, de lade/bottom sheet en
// de projecttab Gesprekken.
//
// Linkerkolom/lade (groepeerPerProject): PROJECTEN (automatisch, uitsluitend op basis van
// gesprek.projectId = subsidie_kompas_conversations.active_program_id) en LOSSE GESPREKKEN
// (active_program_id leeg, of een project dat niet (meer) tot deze gebruiker behoort). Er wordt niets extra
// opgeslagen: de groepering is een weergave van bestaande data.
// Projecttab (groepeerGesprekken met projectFilter): alleen de gesprekken van dat ene project.
// Pure functies: geen React, geen netwerk, geen opslag.

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


// -> { groepen: [{ project: { id, naam, gearchiveerd }, gesprekken }], los: [], totaal, gefilterd }
//   projecten: de eigen projecten van de gebruiker (store). Een gesprek dat naar een onbekend project verwijst
//   (bijvoorbeeld verwijderd) telt als los gesprek; nooit als groep met andermans projectnaam.
//   Het actieve project is altijd een groep (ook als het nog geen gesprekken heeft, zodat daar "+ Nieuw gesprek"
//   staat), behalve tijdens zoeken. Volgorde: actief project eerst, daarna laatste activiteit.
export function groepeerPerProject({ gesprekken, projecten, actiefProjectId, zoek }) {
  const alle = (gesprekken || []).filter((g) => g && g.id);
  const q = normaliseerZoek(zoek);
  const gefilterd = q ? alle.filter((g) => String(g.titel || 'Gesprek').toLowerCase().indexOf(q) !== -1) : alle;
  const bekend = new Map((projecten || []).filter((p) => p && p.id).map((p) => [p.id, p]));
  const perProject = new Map();
  const los = [];

  gefilterd.forEach((g) => {
    if (g.projectId && bekend.has(g.projectId)) {
      if (!perProject.has(g.projectId)) {
        perProject.set(g.projectId, []);
      }

      perProject.get(g.projectId).push(g);
    } else {
      los.push(g);
    }
  });

  if (!q && actiefProjectId && bekend.has(actiefProjectId) && !perProject.has(actiefProjectId)) {
    perProject.set(actiefProjectId, []);
  }

  const groepen = Array.from(perProject.entries())
    .map(([id, lijst]) => {
      const p = bekend.get(id);
      const gesorteerd = lijst.slice().sort(opTijdAflopend);

      return {
        project: { id, naam: p.naam || 'Naamloos project', gearchiveerd: Boolean(p.gearchiveerd) },
        gesprekken: gesorteerd,
        laatste: gesorteerd.length ? String(gesorteerd[0].tijd || '') : '',
      };
    })
    .sort((a, b) => {
      const aActief = a.project.id === actiefProjectId ? 0 : 1;
      const bActief = b.project.id === actiefProjectId ? 0 : 1;

      return aActief - bActief || b.laatste.localeCompare(a.laatste) || a.project.naam.localeCompare(b.project.naam, 'nl');
    });

  return { groepen, los: los.sort(opTijdAflopend), totaal: alle.length, gefilterd: Boolean(q) };
}
