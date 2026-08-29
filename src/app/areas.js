// Registratie van de vier gebieden. Elk gebied heeft één ingang, zodat
// App.jsx niets van de binnenkant van een gebied hoeft te weten.
import { AREA } from './routes.js';
import WebsitePages from '../features/website/WebsitePages.jsx';
import MarketingPages from '../features/kompas-marketing/MarketingPages.jsx';
import KompasApp from '../features/kompas-app/KompasApp.jsx';
import AdminPortal from '../features/admin/AdminPortal.jsx';

export const areaComponents = {
  [AREA.website]: WebsitePages,
  [AREA.marketing]: MarketingPages,
  [AREA.app]: KompasApp,
  [AREA.admin]: AdminPortal,
};

export function areaComponent(area) {
  return areaComponents[area] || null;
}
