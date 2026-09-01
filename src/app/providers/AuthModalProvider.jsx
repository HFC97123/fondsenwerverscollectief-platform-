// Centrale login/registratie-overlay voor Subsidie Kompas.
//
// Uitgangspunt: SubsidieKompas heeft geen verplicht inlogscherm. Een
// bezoeker gebruikt Free gewoon direct. Deze overlay verschijnt alleen op
// het moment dat iemand zelf voor Pro/Premium of een persoonlijke functie
// kiest (of een pagina bezoekt die een account vereist) — en na een
// geslaagde login/registratie sluit hij vanzelf en gaat de oorspronkelijke
// actie alsnog door. De gebruiker verlaat daarbij nooit de pagina waar hij
// was: dit is een overlay, geen aparte omgeving.
//
// Bewust hier en niet in AuthProvider.jsx: AuthProvider gaat over de
// toestand (wie ben ik, welk pakket), deze provider gaat over wanneer en hoe
// om inloggen wordt gevraagd. Twee losse verantwoordelijkheden.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import { bewaarOnboarding } from '../../data/services/onboarding.js';
import { css } from '../../shared/lib/css.js';
import { color, font, radius, type } from '../../shared/tokens.js';
import { Button, Field, Input, Notice, Select, Textarea } from '../../shared/ui/index.js';

const AuthModalContext = createContext(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);

  if (!ctx) {
    throw new Error('useAuthModal moet binnen AuthModalProvider worden gebruikt.');
  }

  return ctx;
}

const LEEG_REGISTER = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  type: '',
  motivation: '',
  organisatie: '',
  functie: '',
  waarNaarOpZoek: '',
  doel: '',
};

export function AuthModalProvider({ children }) {
  const auth = useAuth();
  const wasIngelogd = useRef(auth.isIngelogd);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [reden, setReden] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState(LEEG_REGISTER);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const pendingActie = useRef(null);

  const dicht = () => {
    setOpen(false);
    setFout('');
    setBezig(false);
    pendingActie.current = null;
  };

  const openLogin = (redenTekst) => {
    setMode('login');
    setReden(redenTekst || '');
    setFout('');
    setOpen(true);
  };

  const openRegister = (redenTekst) => {
    setMode('register');
    setReden(redenTekst || '');
    setFout('');
    setOpen(true);
  };

  // Voert actie() direct uit als de gebruiker al is ingelogd; anders opent
  // dit de login/registratie-overlay en voert de actie pas uit zodra dat is
  // gelukt. Zo voelt "eerst inloggen, dan verder" als één ononderbroken stap.
  const requireAuth = (actie, redenTekst) => {
    if (auth.isIngelogd) {
      return actie && actie();
    }

    pendingActie.current = actie || null;
    openLogin(redenTekst);

    return undefined;
  };

  // Zodra het inloggen/registreren binnen deze overlay is gelukt: overlay
  // sluiten en de eventueel wachtende actie alsnog uitvoeren. De gebruiker
  // komt terug op precies dezelfde plek — er wordt nergens genavigeerd.
  useEffect(() => {
    if (!wasIngelogd.current && auth.isIngelogd && open) {
      const actie = pendingActie.current;

      dicht();

      if (actie) {
        actie();
      }
    }

    wasIngelogd.current = auth.isIngelogd;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isIngelogd]);

  const submitLogin = async () => {
    const email = loginForm.email.trim().toLowerCase();
    const wachtwoord = loginForm.password;

    if (!email || !wachtwoord) {
      setFout('Vul uw e-mailadres en wachtwoord in.');

      return;
    }

    setBezig(true);
    setFout('');

    const { fout: loginFout } = await auth.login(email, wachtwoord);

    setBezig(false);

    if (loginFout) {
      setFout(loginFout);

      return;
    }

    setLoginForm({ email: '', password: '' });
    // De overlay sluit via de useEffect hierboven, zodra auth.isIngelogd
    // overschakelt — dat voorkomt dat we hier tweemaal dezelfde afronding
    // doen (open.login en de auth-state-listener kunnen anders om voorrang
    // wedijveren).
  };

  const submitRegister = async () => {
    const f = registerForm;

    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim() || !f.password) {
      setFout('Vul in elk geval naam, e-mailadres en wachtwoord in.');

      return;
    }

    if (f.password.length < 8) {
      setFout('Kies een wachtwoord van minimaal 8 tekens.');

      return;
    }

    setBezig(true);
    setFout('');

    const { fout: registerFout } = await auth.registreer({
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim().toLowerCase(),
      password: f.password,
      type: f.type,
      motivation: f.motivation.trim(),
    });

    if (registerFout) {
      setBezig(false);
      setFout(registerFout);

      return;
    }

    // Onboardingantwoorden zijn nooit een toegangscriterium — het account
    // staat al vast, dit is puur aanvullende profielinformatie. Alleen
    // bewaren als er meteen een sessie is (geen e-mailbevestiging vereist);
    // is die er niet, dan kan de gebruiker dit later alsnog invullen vanaf
    // de accountpagina.
    const ingelogdeGebruiker = auth.user;
    const heeftOnboardingAntwoord =
      f.organisatie.trim() || f.functie.trim() || f.waarNaarOpZoek.trim() || f.doel.trim();

    if (ingelogdeGebruiker && ingelogdeGebruiker.id) {
      await bewaarOnboarding(ingelogdeGebruiker.id, {
        organisatie: f.organisatie.trim(),
        functie: f.functie.trim(),
        waarNaarOpZoek: f.waarNaarOpZoek.trim(),
        doel: f.doel.trim(),
        overgeslagen: !heeftOnboardingAntwoord,
      });
    }

    setBezig(false);
    setRegisterForm(LEEG_REGISTER);
    // Overlay sluit via de useEffect zodra auth.isIngelogd overschakelt.
  };

  const waarden = { open, mode, openLogin, openRegister, close: dicht, requireAuth };

  return (
    <AuthModalContext.Provider value={waarden}>
      {children}
      {open && (
        <AuthModalOverlay
          mode={mode}
          reden={reden}
          onKiesModus={setMode}
          onSluiten={dicht}
          bezig={bezig}
          fout={fout}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          onLogin={submitLogin}
          registerForm={registerForm}
          setRegisterForm={setRegisterForm}
          onRegister={submitRegister}
        />
      )}
    </AuthModalContext.Provider>
  );
}

function AuthModalOverlay({
  mode,
  reden,
  onKiesModus,
  onSluiten,
  bezig,
  fout,
  loginForm,
  setLoginForm,
  onLogin,
  registerForm,
  setRegisterForm,
  onRegister,
}) {
  const veld = (patch) => setRegisterForm((prev) => ({ ...prev, ...patch }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onSluiten}
      style={css(`
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(44,74,94,0.45);
        display: flex; align-items: flex-start; justify-content: center;
        overflow-y: auto; padding: clamp(16px, 5vw, 60px) 16px;
      `)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={css(`
          width: 100%; max-width: 480px; background: ${color.wit};
          border-radius: ${radius.l}; padding: clamp(22px, 4vw, 34px);
          box-shadow: 0 24px 60px rgba(44,74,94,0.28);
        `)}
      >
        <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px;')}>
          <div style={css(`font-family: ${font.kop}; font-size: 22px; font-weight: 600; color: ${color.donkerblauw};`)}>
            {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
          </div>
          <button
            type="button"
            onClick={onSluiten}
            aria-label="Sluiten"
            style={css(`cursor: pointer; border: none; background: none; font-size: 20px; color: ${color.tekstLicht}; line-height: 1;`)}
          >
            ×
          </button>
        </div>

        {reden && (
          <div style={css(`margin-bottom: 16px; font-size: ${type.klein}; line-height: 1.55; color: ${color.tekstZacht};`)}>
            {reden}
          </div>
        )}

        {!reden && (
          <div style={css(`margin-bottom: 16px; font-size: ${type.klein}; line-height: 1.55; color: ${color.tekstZacht};`)}>
            {mode === 'login'
              ? 'Eén account voor Het Fondsenwervers Collectief en Subsidie Kompas.'
              : 'Direct toegang na aanmaken — geen wachttijd of aparte beoordeling.'}
          </div>
        )}

        <Notice tone="fout">{fout}</Notice>

        {mode === 'login' ? (
          <div style={css('display: grid; gap: 12px;')}>
            <Field label="E-mailadres">
              <Input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="naam@organisatie.nl"
              />
            </Field>
            <Field label="Wachtwoord">
              <Input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
              />
            </Field>
            <Button block disabled={bezig} onClick={onLogin}>
              {bezig ? 'Bezig…' : 'Inloggen'}
            </Button>
            <div style={css(`text-align: center; font-size: ${type.klein}; color: ${color.tekstZacht};`)}>
              Nog geen account?{' '}
              <span
                onClick={() => onKiesModus('register')}
                style={css(`cursor: pointer; font-weight: 700; color: ${color.donkerblauw};`)}
              >
                Account aanmaken
              </span>
            </div>
          </div>
        ) : (
          <div style={css('display: grid; gap: 12px;')}>
            <div style={css('display: grid; grid-template-columns: 1fr 1fr; gap: 10px;')}>
              <Field label="Voornaam">
                <Input value={registerForm.firstName} onChange={(e) => veld({ firstName: e.target.value })} />
              </Field>
              <Field label="Achternaam">
                <Input value={registerForm.lastName} onChange={(e) => veld({ lastName: e.target.value })} />
              </Field>
            </div>
            <Field label="E-mailadres">
              <Input type="email" value={registerForm.email} onChange={(e) => veld({ email: e.target.value })} placeholder="naam@organisatie.nl" />
            </Field>
            <Field label="Wachtwoord">
              <Input type="password" value={registerForm.password} onChange={(e) => veld({ password: e.target.value })} placeholder="Minimaal 8 tekens" />
            </Field>

            <div style={css(`margin-top: 6px; padding-top: 14px; border-top: 1px solid ${color.lijn};`)}>
              <div style={css(`margin-bottom: 10px; font-size: ${type.klein}; font-weight: 800; color: ${color.donkerblauw};`)}>
                Laten we kennismaken <span style={css(`font-weight: 600; color: ${color.tekstLicht};`)}>(optioneel)</span>
              </div>
              <div style={css('display: grid; gap: 10px;')}>
                <Field label="Organisatie">
                  <Input value={registerForm.organisatie} onChange={(e) => veld({ organisatie: e.target.value })} />
                </Field>
                <Field label="Functie">
                  <Input value={registerForm.functie} onChange={(e) => veld({ functie: e.target.value })} />
                </Field>
                <Field label="Ik ben vooral op zoek naar">
                  <Select
                    value={registerForm.type}
                    onChange={(e) => veld({ type: e.target.value })}
                    options={[
                      { value: '', label: 'Kies…' },
                      { value: 'zzp', label: 'Zelfstandig fondsenwerver' },
                      { value: 'org', label: 'Organisatie / non-profit' },
                      { value: 'orient', label: 'Oriënterend' },
                    ]}
                  />
                </Field>
                <Field label="Wat hoopt u te bereiken met Subsidie Kompas?">
                  <Textarea
                    value={registerForm.doel}
                    onChange={(e) => veld({ doel: e.target.value })}
                    rows={3}
                  />
                </Field>
              </div>
              <div style={css(`margin-top: 8px; font-size: 12.5px; color: ${color.tekstLicht};`)}>
                Deze antwoorden bepalen nooit of u toegang krijgt — u kunt ze ook later of nooit invullen.
              </div>
            </div>

            <Button block disabled={bezig} onClick={onRegister}>
              {bezig ? 'Bezig…' : 'Account aanmaken'}
            </Button>
            <div style={css(`text-align: center; font-size: ${type.klein}; color: ${color.tekstZacht};`)}>
              Al een account?{' '}
              <span
                onClick={() => onKiesModus('login')}
                style={css(`cursor: pointer; font-weight: 700; color: ${color.donkerblauw};`)}
              >
                Inloggen
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
