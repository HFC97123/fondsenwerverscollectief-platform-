// Authenticatie, profiel en abonnementsrechten.
// De logica komt uit de bestaande AppContext en is niet gewijzigd; alleen
// losgemaakt van de rest zodat de rechten één bron hebben.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../../data/client.js';
import {
  PLAN_PERMISSIONS,
  haalProfiel,
  inloggen,
  proefActiefVan,
  startProefperiode as startProefperiodeService,
  tierVan,
  uitloggen,
} from '../../data/services/profile.js';


const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth moet binnen AuthProvider worden gebruikt.');
  }

  return ctx;
}

function naamVan(user) {
  if (!user) {
    return '';
  }

  const m = user.user_metadata || {};
  const voor = m.first_name || m.firstName || '';
  const achter = m.last_name || m.lastName || '';

  return `${voor} ${achter}`.trim() || m.full_name || m.name || (user.email || '').split('@')[0] || '';
}

// Supabase-fouten omgezet naar begrijpelijk Nederlands.
export function authFoutTekst(error, actie = 'login') {
  const m = String((error && error.message) || '').toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Het e-mailadres of wachtwoord is niet juist.';
  }

  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return 'Bevestig eerst uw e-mailadres via de e-mail die wij hebben verstuurd.';
  }

  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Er bestaat al een account met dit e-mailadres. Probeer in te loggen.';
  }

  if (m.includes('password should be at least') || m.includes('weak password')) {
    return 'Kies een sterker wachtwoord van minimaal 8 tekens.';
  }

  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'Vul een geldig e-mailadres in.';
  }

  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Er zijn te veel pogingen gedaan. Wacht even en probeer het daarna opnieuw.';
  }

  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Er kon geen verbinding worden gemaakt. Controleer uw internetverbinding.';
  }

  if (actie === 'register') {
    return 'De aanvraag kon niet worden verstuurd. Probeer het later opnieuw.';
  }

  if (actie === 'logout') {
    return 'Uitloggen is niet gelukt. Probeer het opnieuw.';
  }

  return 'Inloggen is niet gelukt. Controleer uw gegevens en probeer het opnieuw.';
}

export function AuthProvider({ children }) {
  const [st, set] = useState({
    laden: true,
    session: null,
    user: null,
    profile: null,
    profielLaden: false,
    profielFout: '',
    naam: '',
  });

  const stRef = useRef(st);
  stRef.current = st;

  // Zie de toelichting bij `devActief` verderop: alleen-lokale test-state,
  // nooit een databaseveld en nooit aanwezig in een productiebuild.
  const [devRolOverride, setDevRolOverride] = useState(null);

  const update = (patch) => set((prev) => ({ ...prev, ...patch }));

  const laadProfiel = async (userId, opties) => {
    if (!userId || !supabase) {
      update({ profile: null, profielLaden: false, profielFout: '' });

      return null;
    }

    update({ profielLaden: true, profielFout: '' });

    const data = await haalProfiel(userId, opties);

    if (!data) {
      update({
        profile: null,
        profielLaden: false,
        profielFout: 'Uw profielgegevens konden niet worden geladen.',
      });

      return null;
    }

    update({
      profile: data,
      profielLaden: false,
      profielFout: '',
      naam: `${data.first_name || ''} ${data.last_name || ''}`.trim() || naamVan(stRef.current.user),
    });

    return data;
  };

  useEffect(() => {
    if (!supabase) {
      update({ laden: false });

      return undefined;
    }

    let actief = true;

    const start = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!actief) {
          return;
        }

        const session = data.session;

        update({ session, user: (session && session.user) || null, naam: naamVan(session && session.user) });

        if (session && session.user && session.user.id) {
          await laadProfiel(session.user.id);
        }

        if (actief) {
          update({ laden: false });
        }
      } catch (e) {
        if (actief) {
          update({ session: null, user: null, profile: null, laden: false });
        }
      }
    };

    start();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!actief) {
        return;
      }

      update({
        session,
        user: (session && session.user) || null,
        naam: naamVan(session && session.user),
        laden: false,
      });

      if (session && session.user && session.user.id) {
        setTimeout(() => laadProfiel(session.user.id), 0);
      } else {
        update({ profile: null, profielLaden: false, profielFout: '' });
      }
    });

    return () => {
      actief = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isIngelogd = Boolean(st.user);
  const profiel = st.profile || {};

  // Pro en Premium gelden alleen bij een actief abonnement. Eén regel, in
  // data/services/profile.js, gedeeld met de rest van de app.
  const werkelijkeTier = tierVan(st.profile);
  const werkelijkBeheerder = profiel.role === 'admin';

  // Alleen-lokale, alleen-ontwikkel test-functie: een Free/Pro/Premium/Admin
  // rolwissel om schermen te bekijken zonder vier losse testaccounts nodig te
  // hebben. Bestaat uitsluitend client-side (React state), schrijft nooit
  // naar de database en de setter wordt hieronder alleen toegevoegd aan
  // `waarden` wanneer import.meta.env.DEV waar is — in een productiebuild
  // valt deze hele tak weg (Vite vervangt import.meta.env.DEV door `false`
  // en elimineert de dode code), dus devRolOverride is in productie nooit
  // aanwezig en nooit bereikbaar.
  const devActief = Boolean(import.meta.env.DEV);
  const tier = devActief && devRolOverride
    ? (devRolOverride === 'admin' ? 'premium' : devRolOverride)
    : werkelijkeTier;
  const isBeheerderEffectief = devActief && devRolOverride
    ? devRolOverride === 'admin'
    : werkelijkBeheerder;

  const actief = profiel.subscription_active === true;
  const rechten = PLAN_PERMISSIONS[tier] || PLAN_PERMISSIONS.free;
  const mag = (sleutel) => isIngelogd && Boolean(rechten[sleutel]);

  const waarden = {
    laden: st.laden,
    session: st.session,
    user: st.user,
    profile: st.profile,
    profielLaden: st.profielLaden,
    profielFout: st.profielFout,

    isIngelogd,
    naam: st.naam || naamVan(st.user) || 'Uw profiel',

    isBeheerder: isBeheerderEffectief,
    isGoedgekeurd: profiel.status === 'approved',
    isInBehandeling: profiel.status === 'pending',
    isAfgewezen: profiel.status === 'rejected',

    tier,
    abonnementActief: actief,
    rechten,
    isFree: tier === 'free',
    isPro: tier === 'pro',
    isPremium: tier === 'premium',

    proefActief: proefActiefVan(st.profile),
    proefStart: profiel.trial_started_at || null,
    proefEind: profiel.trial_ends_at || null,
    abonnementStart: profiel.subscription_started_at || null,
    abonnementEind: profiel.subscription_ends_at || null,

    magGeschiedenis: mag('history'),
    magWord: mag('word'),
    magPdf: mag('pdf'),
    magExcel: mag('excel'),
    magUploaden: mag('uploads'),
    magKennisbank: mag('knowledgeBase'),
    magPrivedatabase: mag('privateDatabase'),
    magOrganisatiegeheugen: mag('organizationMemory'),
    magEigenHuisstijl: mag('customBranding'),

    // Eén implementatie, in data/services/profile.js; hier alleen de toestand.
    login: async (email, wachtwoord) => {
      const { data, fout } = await inloggen(email, wachtwoord);

      if (fout) {
        return { fout };
      }

      update({ session: data.session, user: data.user, naam: naamVan(data.user) });
      await laadProfiel(data.user.id);

      return { fout: null };
    },

    registreer: async (form) => {
      if (!supabase) {
        return { fout: 'Aanmelden is nu niet beschikbaar.' };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email: String(form.email || '').trim().toLowerCase(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: form.firstName,
              last_name: form.lastName,
              full_name: `${form.firstName} ${form.lastName}`.trim(),
              member_type: form.type,
              motivation: form.motivation,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session && data.user) {
          update({ session: data.session, user: data.user, naam: naamVan(data.user) });
          await laadProfiel(data.user.id);
        }

        return { fout: null };
      } catch (e) {
        return { fout: authFoutTekst(e, 'register') };
      }
    },

    logout: async () => {
      await uitloggen();

      update({ session: null, user: null, profile: null, naam: '' });
    },

    herlaadProfiel: () =>
      laadProfiel(stRef.current.user && stRef.current.user.id, { vers: true }),

    // Proefperiode starten (7 dagen Pro / 24 uur Premium). De duur en de
    // eenmaligheid worden uitsluitend server-side afgedwongen (RPC
    // start_trial); hier alleen aanroepen en daarna het profiel verversen
    // zodat tier/rechten meteen overal kloppen.
    startProefperiode: async (gewensteTier) => {
      const { fout } = await startProefperiodeService(gewensteTier);

      if (fout) {
        return { fout };
      }

      await laadProfiel(stRef.current.user && stRef.current.user.id, { vers: true });

      return { fout: null };
    },

    // Alleen in ontwikkeling aanwezig (zie toelichting hierboven). In een
    // productiebuild bestaan devRolOverride/setDevRolOverride niet op dit
    // object, dus is er niets om aan te roepen.
    ...(devActief
      ? {
          devRolOverride,
          setDevRolOverride,
        }
      : {}),
  };

  return <AuthContext.Provider value={waarden}>{children}</AuthContext.Provider>;
}
