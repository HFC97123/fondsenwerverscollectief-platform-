// Landingsplek voor de wachtwoord-resetlink uit de e-mail. AuthProvider.jsx
// stuurt de gebruiker hier automatisch naartoe zodra Supabase het
// PASSWORD_RECOVERY-event meldt (geslaagde link) of een ongeldige/verlopen
// link herkent (foutmelding via auth.wachtwoordResetFout). Deze pagina zelf
// doet niets anders dan het laatste stapje van die al bestaande flow: het
// nieuwe wachtwoord opslaan via de bestaande profielservice.
import React, { useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { stelNieuwWachtwoordIn } from '../../data/services/profile.js';
import { naar } from '../../app/routes.js';
import { css } from '../../shared/lib/css.js';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';
import { Button, Container, Field, Input, Notice, Panel, PanelHeader } from '../../shared/ui/index.js';

export default function WachtwoordInstellenPage() {
  const auth = useAuth();
  const [wachtwoord, setWachtwoord] = useState('');
  const [herhaal, setHerhaal] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [gelukt, setGelukt] = useState(false);

  const versturen = async () => {
    setFout('');

    if (wachtwoord !== herhaal) {
      setFout('De wachtwoorden komen niet overeen.');

      return;
    }

    setBezig(true);

    const { fout: foutmelding } = await stelNieuwWachtwoordIn(wachtwoord);

    setBezig(false);

    if (foutmelding) {
      setFout(foutmelding);

      return;
    }

    setGelukt(true);
  };

  // Geen geldige herstelsessie: ofwel een expliciete Supabase-foutmelding
  // (ongeldige/verlopen link, opgevangen in AuthProvider), ofwel simpelweg
  // geen sessie omdat iemand hier zonder link is beland.
  const kanWachtwoordInstellen = auth.isIngelogd && !gelukt;

  return (
    <div data-screen-label="Nieuw wachtwoord instellen" style={css('min-height: 100vh; position: relative; z-index: 1;')}>
      <KompasSubnav terugNaarKompas={false} />

      <Container style={css('max-width: 520px; padding-top: 60px; padding-bottom: 100px;')}>
        <Panel>
          <PanelHeader
            title="Nieuw wachtwoord instellen"
            intro={
              gelukt
                ? undefined
                : kanWachtwoordInstellen
                  ? 'Kies hieronder een nieuw wachtwoord voor uw account.'
                  : auth.wachtwoordResetFout ||
                    'Deze link is niet (meer) geldig. Vraag via "Wachtwoord vergeten?" bij het inloggen een nieuwe aan.'
            }
          />

          {kanWachtwoordInstellen && (
            <div style={css('display: grid; gap: 14px;')}>
              <Field label="Nieuw wachtwoord">
                <Input
                  type="password"
                  value={wachtwoord}
                  onChange={(e) => setWachtwoord(e.target.value)}
                  placeholder="Minimaal 8 tekens"
                />
              </Field>
              <Field label="Herhaal nieuw wachtwoord">
                <Input
                  type="password"
                  value={herhaal}
                  onChange={(e) => setHerhaal(e.target.value)}
                  placeholder="Minimaal 8 tekens"
                />
              </Field>
              <Notice tone="fout">{fout}</Notice>
              <Button disabled={bezig} onClick={versturen}>
                {bezig ? 'Bezig…' : 'Wachtwoord opslaan'}
              </Button>
            </div>
          )}

          {gelukt && (
            <div style={css('display: grid; gap: 14px;')}>
              <Notice>Uw wachtwoord is bijgewerkt. U kunt hiermee direct inloggen.</Notice>
              <Button onClick={() => naar('/netwerk')}>Naar inloggen</Button>
            </div>
          )}

          {!kanWachtwoordInstellen && !gelukt && (
            <Button variant="outline" onClick={() => naar('/netwerk')}>
              Naar inloggen
            </Button>
          )}
        </Panel>
      </Container>
    </div>
  );
}
