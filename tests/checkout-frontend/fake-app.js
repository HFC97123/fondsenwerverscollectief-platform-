// Vervangt useKompasApp.js: de test bepaalt wat de app-context teruggeeft.
export const aanroepen = [];
let huidig = {};

export function __zetApp(app) {
  aanroepen.length = 0;
  const noop = (naam) => (...args) => { aanroepen.push([naam, ...args]); };

  huidig = {
    isLoggedIn: false,
    profile: null,
    profielProbleem: false,
    goAbonnementen: noop('goAbonnementen'),
    goHome: noop('goHome'),
    goKompas: noop('goKompas'),
    goDeadlines: noop('goDeadlines'),
    goOrganisatie: noop('goOrganisatie'),
    goProjecten: noop('goProjecten'),
    goDocumentatie: noop('goDocumentatie'),
    goAccount: noop('goAccount'),
    openAuth: noop('openAuth'),
    openRegister: noop('openRegister'),
    requireAuth: noop('requireAuth'),
    logout: noop('logout'),
    ...app,
  };
}

export function useApp() {
  return huidig;
}
