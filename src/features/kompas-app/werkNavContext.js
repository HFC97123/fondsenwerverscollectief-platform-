// Vlag voor de Pro/Premium-werkruimte. KompasApp zet deze op true zodra de
// nieuwe hoofdnavigatie (KompasWerkNav) bovenaan staat; de gedeelde
// KompasSubnav toont zich dan niet nogmaals (geen dubbele navigatie). Buiten
// KompasApp (website, marketingpagina's) en voor Free is de waarde false, dus
// daar verandert er niets.
import { createContext } from 'react';

export const WerkNavContext = createContext(false);
