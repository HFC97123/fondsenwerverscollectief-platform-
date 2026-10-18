// Of de volledige flow "Maak dekkingsplan en actieplan met Subsidie Kompas" werkt. De startknop op de projectpagina is pas
// actief als deze functie true geeft; tot die tijd staat er een duidelijke melding. De vlag gaat pas aan als ALLE stappen
// bestaan en getest zijn: project lezen, uitvragen, financiers onderzoeken (server), voorstel tonen, aanpassen, opslaan.
// Een omgevingsvariabele kan hem niet te vroeg aanzetten zonder dat de server-stap (VITE_SUBSIDIEKOMPAS_VOORSTEL_SERVER) er is.
export function voorstelGeneratieBeschikbaar(env = (typeof import.meta !== 'undefined' && import.meta.env) || {}) {
  return env.VITE_SUBSIDIEKOMPAS_VOORSTEL === 'aan' && env.VITE_SUBSIDIEKOMPAS_VOORSTEL_SERVER === 'aan';
}

export const VOORSTEL_STAPPEN = [
  'Project lezen',
  'Ontbrekende informatie uitvragen',
  'Financiers onderzoeken',
  'Dekkingsplan en actieplan voorstellen',
  'Bekijken en aanpassen',
  'Opslaan na uw klik',
];

export const ONTBREKEND_LABEL = {
  doel: 'het doel van het project (omschrijving of doelstellingen)',
  regio: 'het uitvoeringsgebied',
  doelgroep: 'de doelgroep',
  looptijd: 'de looptijd',
  begroting: 'de projectbegroting',
};
