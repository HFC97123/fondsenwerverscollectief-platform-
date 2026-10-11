// Actief project in de chat: één plek die bepaalt welk project bij een gesprek hoort.
//
// Regels (Fase 4):
// - Voor een BESTAAND gesprek is de projectkoppeling van het gesprek zelf leidend
//   (subsidie_kompas_conversations.active_program_id, in de frontend: gesprek.projectId).
//   Een Dashboard-keuze, een verouderd chatverzoek of een andere "standaardkeuze" overschrijft die nooit.
// - Voor een NIEUW gesprek mag een gekozen project als startcontext dienen.
// - Alleen een project dat nog bestaat en niet gearchiveerd is, blijft actief.
//
// Pure functies (geen React, geen netwerk, geen opslag): ze lezen alleen de meegegeven lijsten,
// zodat er nergens een tweede actief-project-mechaniek ontstaat.

// Geeft het id terug als het een bestaand, niet-gearchiveerd project is; anders null.
export function geldigProjectId(projectId, projecten) {
  if (!projectId) {
    return null;
  }

  const bekend = (projecten || []).find((p) => p && p.id === projectId);

  return bekend && !bekend.gearchiveerd ? projectId : null;
}

// Bestaand gesprek: het project van de gesprekrij is leidend.
export function projectVoorBestaandGesprek(gesprek, projecten) {
  return geldigProjectId(gesprek ? gesprek.projectId : null, projecten);
}

// Gesprek zoeken in de gesprekkenlijst op id (de lijst komt uit subsidie_kompas_conversations).
export function vindGesprek(gesprekken, gesprekId) {
  return (gesprekken || []).find((g) => g && g.id === gesprekId) || null;
}

// Eenmalig chatverzoek (Dashboard/projectdossier) -> welk project hoort bij het te openen gesprek?
// De gesprekrij in de lijst gaat voor het project dat het verzoek meegeeft; alleen als het gesprek
// (nog) niet in de lijst staat valt dit terug op het project uit het verzoek zelf.
export function projectVoorChatVerzoek({ verzoek, gesprekken, projecten }) {
  if (!verzoek) {
    return null;
  }

  if (verzoek.type === 'gesprek' && verzoek.gesprekId) {
    const rij = vindGesprek(gesprekken, verzoek.gesprekId);

    return geldigProjectId(rij ? rij.projectId : verzoek.projectId, projecten);
  }

  return geldigProjectId(verzoek.projectId, projecten);
}

// Het project waarvoor het paneel (links "Dit project", rechts de context, koptekst) wordt getoond:
// altijd het gevalideerde actieve project van het geopende gesprek (of de startkeuze van een nieuw gesprek).
export function projectVoorWeergave({ gekoppeldProjectId, projecten }) {
  const id = geldigProjectId(gekoppeldProjectId, projecten);

  return id ? (projecten || []).find((p) => p.id === id) || null : null;
}
