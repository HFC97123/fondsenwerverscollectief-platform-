// Klikbare kaarten: de hele kaart is de primaire navigatie ("stretched link"). De titel is een gewone <a>; zijn
// ::after bedekt de kaart. Daardoor werkt de kaart met muis, toetsenbord (Tab + Enter), scherm­lezers (één link met
// de projectnaam) en "open in nieuw tabblad", zonder JavaScript-klikafhandeling en zonder dat een geneste knop
// per ongeluk ook de kaart activeert: aanvullende acties staan in .fwk-kk-boven en liggen boven de bedekking.
//
// Ontwerpregel (primaire navigatie / één aanvullende actie / secundair in een ⋯-menu / destructief pas in dat menu):
//   - klik op de kaart zelf opent het item
//   - maximaal één aanvullende actie zichtbaar (bijvoorbeeld "Bespreek met Subsidie Kompas")
//   - Archiveren, Verwijderen en dergelijke staan in <KaartMenu> (⋯)
export const CSS_KLIKKAART = `
.fwk-kk { position: relative; transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease; }
.fwk-kk.fwk-kk-klikbaar:hover { border-color: #A8D5BA; background: #FFFFFF; box-shadow: 0 6px 20px rgba(44, 74, 94, 0.09); }
.fwk-kk-link { color: inherit; text-decoration: none; }
.fwk-kk-link::after { content: ''; position: absolute; inset: 0; z-index: 1; border-radius: var(--kk-r, 16px); cursor: pointer; }
.fwk-kk-link:focus-visible { outline: none; }
.fwk-kk-link:focus-visible::after { outline: 3px solid #4E9A6C; outline-offset: 2px; }
.fwk-kk-boven { position: relative; z-index: 2; }
/* Een geopend ⋯-menu (focus staat erin) moet boven de volgende kaart liggen. */
.fwk-kk:focus-within { z-index: 3; }
@media (prefers-reduced-motion: reduce) { .fwk-kk { transition: none; } }
`;
