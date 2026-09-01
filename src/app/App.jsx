// De schil: providers, routering en het gebied dat bij de route hoort.
// Kent de binnenkant van geen enkel gebied.
import React from 'react';
import { AuthProvider, useAuth } from './providers/AuthProvider.jsx';
import { AuthModalProvider, useAuthModal } from './providers/AuthModalProvider.jsx';
import { ContentProvider } from './providers/ContentProvider.jsx';
import DevRoleSwitcher from './dev/DevRoleSwitcher.jsx';
import { areaComponent } from './areas.js';
import { useRoute } from './useRoute.js';
import { css } from '../shared/lib/css.js';
import { color, font, type } from '../shared/tokens.js';
import { Button, Container, ErrorBoundary, Lead, PageTitle } from '../shared/ui/index.js';

// Toegangspoort: een route voor leden of beheerders wordt niet gerenderd
// zolang het profiel dat niet toestaat.
//
// Een bezoeker die niet is ingelogd, krijgt hier NOOIT een doodlopende
// pagina: in plaats daarvan opent de centrale login/registratie-overlay
// (AuthModalProvider). Zodra het inloggen lukt, flipt auth.isIngelogd en
// rendert Poort vanzelf dezelfde route met zijn children — er wordt nergens
// genavigeerd, dus de gebruiker keert terug naar precies de plek waar hij
// was. Alleen "wel ingelogd, maar geen beheerder" blijft een echte,
// blijvende weigering (daar helpt inloggen niet bij).
function Poort({ route, children }) {
  const auth = useAuth();
  const authModal = useAuthModal();

  if (auth.laden) {
    return (
      <Container style={css('padding-top: 90px; padding-bottom: 90px;')}>
        <div
          style={css(`
            font-family: ${font.tekst};
            font-size: ${type.klein};
            font-weight: 700;
            color: ${color.tekstLicht};
          `)}
        >
          Een moment…
        </div>
      </Container>
    );
  }

  const vereistInloggen = route.toegang === 'lid' || route.toegang === 'beheerder';

  if (vereistInloggen && !auth.isIngelogd) {
    return (
      <Container style={css('padding-top: 90px; padding-bottom: 110px;')}>
        <PageTitle size={type.paginaKop}>Log in om verder te gaan</PageTitle>
        <Lead>
          Dit onderdeel is onderdeel van uw account. Log in of maak een account aan — u komt daarna
          direct terug op deze pagina.
        </Lead>
        <div style={css('margin-top: 26px; display: flex; gap: 12px; flex-wrap: wrap;')}>
          <Button onClick={() => authModal.openLogin()}>Inloggen</Button>
          <Button variant="outline" onClick={() => authModal.openRegister()}>Account aanmaken</Button>
        </div>
      </Container>
    );
  }

  if (route.toegang === 'beheerder' && !auth.isBeheerder) {
    return (
      <Container style={css('padding-top: 90px; padding-bottom: 110px;')}>
        <PageTitle size={type.paginaKop}>Alleen voor beheerders</PageTitle>
        <Lead>Dit onderdeel is beschikbaar voor beheerders van het platform.</Lead>
        <div style={css('margin-top: 26px;')}>
          <Button onClick={() => { window.location.hash = '#/'; }}>Naar de homepage</Button>
        </div>
      </Container>
    );
  }

  return children;
}

function Routed() {
  const { route, param, ga } = useRoute();
  const Area = areaComponent(route.area);

  return (
    <Poort route={route}>
      <ErrorBoundary text="Deze pagina kon niet worden geladen. Probeer het opnieuw.">
        {Area ? (
          <Area route={route} param={param} ga={ga} />
        ) : (
          <Container style={css('padding-top: 90px; padding-bottom: 110px;')}>
            <PageTitle size={type.paginaKop}>{route.titel}</PageTitle>
            <Lead>Dit onderdeel wordt in de volgende stap van de herbouw geplaatst.</Lead>
          </Container>
        )}
      </ErrorBoundary>
    </Poort>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthModalProvider>
        <ContentProvider>
          <Routed />
        </ContentProvider>
        {/* Alleen-ontwikkel test-functie (Free/Pro/Premium/Admin rolwissel).
            import.meta.env.DEV is een build-time constante: Vite vervangt dit
            in een productiebuild door `false` en elimineert de hele tak, dus
            DevRoleSwitcher wordt in productie niet eens meegebouwd. */}
        {import.meta.env.DEV && <DevRoleSwitcher />}
      </AuthModalProvider>
    </AuthProvider>
  );
}
