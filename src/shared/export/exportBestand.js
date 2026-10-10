// src/shared/export/exportBestand.js
//
// Gedeelde hulpjes voor ALLE Subsidie Kompas-exports (Word, PDF, Excel):
// bestandsnamen en de download zelf. Vervangt de op twee plekken
// gedupliceerde `veiligeBestandsnaam` + anchor-download uit
// KompasToolPage.jsx (exporteerAlsWord/-Excel) en DocumentatiePage.jsx
// (downloadDocument/downloadExcelDocument). De download werkt exact zoals
// voorheen: een tijdelijke object-URL + <a download>, geen nieuwe tab.

const ONGELDIGE_TEKENS = /[\\/:*?"<>|\u0000-\u001F]/g;

/**
 * Maakt van een vrije tekst (project-/organisatienaam, documentsoort) een
 * veilig bestandsnaamdeel: geen verboden tekens, geen dubbele spaties,
 * spaties worden underscores, geen punt/underscore aan de rand, maximaal
 * 60 tekens. Geeft '' terug als er niets bruikbaars overblijft.
 */
export function veiligeBestandsnaam(tekst, maxLengte = 60) {
  return String(tekst == null ? '' : tekst)
    .replace(ONGELDIGE_TEKENS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLengte)
    .trim()
    .replace(/ /g, '_')
    .replace(/^[._]+|[._]+$/g, '');
}

/**
 * Netjes opgebouwde bestandsnaam: `Deel1_Deel2.ext`, bijvoorbeeld
 * `Buurtkeuken_De_Brug_Projectplan.docx` of `Stichting_Voorbeeld_Organisatieprofiel.pdf`.
 * Lege delen vervallen; zonder enig bruikbaar deel is de naam
 * `Subsidie_Kompas.ext`. Nooit een id of UUID.
 */
export function bouwBestandsnaam(delen, extensie) {
  const schoon = (delen || []).map((d) => veiligeBestandsnaam(d)).filter(Boolean);
  const basis = schoon.length ? schoon.join('_') : 'Subsidie_Kompas';

  return `${basis}.${extensie}`;
}

/**
 * Biedt een Blob aan als download - dezelfde techniek als de bestaande
 * Word-/Excel-exports (anchor + object-URL).
 */
export function downloadBlob(blob, bestandsnaam) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
