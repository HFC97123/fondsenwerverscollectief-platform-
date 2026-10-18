// Genereert src/shared/werkgebied/landen.generated.js uit de landentabel van de Edge Function (supabase/functions/_shared/werkgebied.ts),
// zodat het formulier en de server dezelfde landen, schrijfwijzen en ISO-codes gebruiken. Draai: node --experimental-strip-types scripts/genereer-landen.mjs
// Een test (tests/werkgebied-verfijning) controleert dat het gegenereerde bestand actueel is.
import { writeFileSync } from 'node:fs';
import { LAND_REGELS } from '../supabase/functions/_shared/werkgebied.ts';

export function bouwInhoud() {
  const regels = [{ naam: 'Nederland', iso: 'NL', termen: ['nederland', 'the netherlands', 'netherlands', 'holland'] }, ...LAND_REGELS];

  return `// GEGENEREERD door scripts/genereer-landen.mjs uit supabase/functions/_shared/werkgebied.ts. Niet met de hand aanpassen.
export const LAND_REGELS = ${JSON.stringify(regels, null, 1).replace(/\n\s+/g, ' ').replace(/\[ \{/, '[\n{').replace(/\}, \{/g, '},\n{').replace(/\} \]/, '}\n]')};
`;
}

if (process.argv[1] && process.argv[1].endsWith('genereer-landen.mjs')) {
  writeFileSync(new URL('../src/shared/werkgebied/landen.generated.js', import.meta.url), bouwInhoud());
}
