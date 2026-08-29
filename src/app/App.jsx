// De schil: providers, routering en het gebied dat bij de route hoort.
// Kent de binnenkant van geen enkel gebied.
import React from 'react';
import { AuthProvider, useAuth } from './providers/AuthProvider.jsx';
import { ContentProvider } from './providers/ContentProvider.jsx';
import { areaComponent } from './areas.js';
import { useRoute } from './useRoute.js';
import { css } from '../shared/lib/css.js';
import { color, font, type } from '../shared/tokens.js';
import { Button, Container, ErrorBoundary, Lead, PageTitle } from '../shared/ui/index.js';

// Toegangspoort: een route voor leden of beheerders wordt niet gerenderd
// zolang het profiel dat niet toestaat.
function Poort({ route, children }) {
  const auth = useAuth();

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

  const magNiet =
    (route.toegang === 'lid' && !auth.isIngelogd) ||
    (route.toegang === 'beheerder' && !auth.isBeheerder);

  if (magNiet) {
    return (
      <Container style={css('padding-top: 90px; padding-bottom: 110px;')}>
        <PageTitle size={type.paginaKop}>
          {route.toegang === 'beheerder' ? 'Alleen voor beheerders' : 'Alleen voor leden'}
        </PageTitle>
        <Lead>
          {route.toegang === 'beheerder'
            ? 'Dit onderdeel is beschikbaar voor beheerders van het platform.'
            : 'Log in met uw lidmaatschap van Het Fondsenwervers Collectief om dit onderdeel te bekijken.'}
        </Lead>
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
      <ContentProvider>
        <Routed />
      </ContentProvider>
    </AuthProvider>
  );
}
