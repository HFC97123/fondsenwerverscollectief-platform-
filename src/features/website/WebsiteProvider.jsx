import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { supabase } from '../../data/client.js';
import { PLAN_PERMISSIONS, haalProfiel, tierVan, wisProfielCache } from '../../data/services/profile.js';
import { collections, siteTextBlocks } from '../../data/collections.js';

import {
  allNewsItems,
  resources,
  sessions,
  blogPosts,
  questions,
  members,
  vacancies,
  newsItems,
  testimonials,
  videos,
  CHAT_SYSTEM_PROMPT,
} from './defaultContent.js';

const CHAT_STORAGE_KEY = 'fwc_vraagbaak_chat_v1';
const CHAT_MIN_INTERVAL_MS = 2500;
const CHAT_MAX_MESSAGES = 40;

const INITIAL_BOT_MSG =
  'Hoi! Ik ben Collie, de assistent van Het Fondsenwervers Collectief. Ik help je graag verder met vragen over het Collectief of over Subsidie Kompas. Waar kan ik je mee helpen?';

const INITIAL_REGISTER_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  type: '',
  motivation: '',
};

const INITIAL_LOGIN_FORM = {
  email: '',
  password: '',
};

const INITIAL_CONTACT_FORM = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

const INITIAL_VACANCY_FORM = {
  title: '',
  org: '',
  location: '',
  tag: '',
};


const AppContext = createContext(null);

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp moet binnen AppProvider worden gebruikt.');
  }

  return context;
}

function getMemberName(user) {
  if (!user) return '';

  const metadata = user.user_metadata || {};
  const firstName = metadata.first_name || metadata.firstName || '';
  const lastName = metadata.last_name || metadata.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    metadata.full_name ||
    metadata.name ||
    user.email?.split('@')[0] ||
    ''
  );
}

function getInitials(name) {
  const cleanName = name?.trim();

  if (!cleanName) return 'FC';

  return cleanName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAuthErrorMessage(error, action = 'login') {
  const message = error?.message?.toLowerCase() || '';

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return 'Het e-mailadres of wachtwoord is niet juist.';
  }

  if (
    message.includes('email not confirmed') ||
    message.includes('email_not_confirmed')
  ) {
    return 'Bevestig eerst uw e-mailadres via de e-mail die wij hebben verstuurd.';
  }

  if (
    message.includes('user already registered') ||
    message.includes('already been registered')
  ) {
    return 'Er bestaat al een account met dit e-mailadres. Probeer in te loggen.';
  }

  if (
    message.includes('password should be at least') ||
    message.includes('weak password')
  ) {
    return 'Kies een sterker wachtwoord van minimaal 8 tekens.';
  }

  if (
    message.includes('unable to validate email') ||
    message.includes('invalid email')
  ) {
    return 'Vul een geldig e-mailadres in.';
  }

  if (
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'Er zijn te veel pogingen gedaan. Wacht even en probeer het daarna opnieuw.';
  }

  if (message.includes('network') || message.includes('failed to fetch')) {
    return 'Er kon geen verbinding worden gemaakt. Controleer uw internetverbinding.';
  }

  if (action === 'register') {
    return 'De aanvraag kon niet worden verstuurd. Probeer het later opnieuw.';
  }

  if (action === 'logout') {
    return 'Uitloggen is niet gelukt. Probeer het opnieuw.';
  }

  return 'Inloggen is niet gelukt. Controleer uw gegevens en probeer het opnieuw.';
}

export function WebsiteProvider({ children }) {
  const [st, set] = useState({
    page: 'home',
    activeArticleId: null,

    authView: 'buttons',
    authLoading: true,
    session: null,
    user: null,
    profile: null,
    profileLoading: false,
    profileError: '',

    loginForm: INITIAL_LOGIN_FORM,
    loginLoading: false,
    loginError: '',

    regForm: INITIAL_REGISTER_FORM,
    applicationSent: false,
    applicationLoading: false,
    applicationError: '',

    contactForm: INITIAL_CONTACT_FORM,
    contactSent: false,

    memberName: '',

    vacForm: INITIAL_VACANCY_FORM,
    memberVacancies: [],
    vacPosted: false,

    emailDraft: '',

    chatOpen: false,
    chatMessages: [
      {
        fromUser: false,
        text: INITIAL_BOT_MSG,
      },
    ],
    chatDraft: '',
    chatLoading: false,
    chatErrorMsg: null,
    isListening: false,
    isSpeaking: false,
    micSupported: false,
    lastSendAt: 0,

    heroAnimationOn: true,

    content: {},
    contentLoaded: false,
    siteText: {},
  });

  const update = (patch) => {
    set((previousState) => ({
      ...previousState,
      ...(typeof patch === 'function' ? patch(previousState) : patch),
    }));
  };

  const chatScrollRef = useRef(null);
  const recognition = useRef(null);
  const stRef = useRef(st);

  stRef.current = st;

  const persistChat = (messages) => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.warn('Chat kon niet worden opgeslagen:', error);
    }
  };

  const speak = (text) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'nl-NL';
    utterance.onstart = () => update({ isSpeaking: true });
    utterance.onend = () => update({ isSpeaking: false });
    utterance.onerror = () => update({ isSpeaking: false });

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    update({ isSpeaking: false });
  };

  const goPage = (page) => {
    update({ page });
    window.scrollTo(0, 0);
  };

  const sendChatMessage = async () => {
    const currentState = stRef.current;
    const text = currentState.chatDraft.trim();

    if (!text || currentState.chatLoading) return;

    const now = Date.now();

    if (now - currentState.lastSendAt < CHAT_MIN_INTERVAL_MS) {
      update({
        chatErrorMsg:
          'Een moment rust alsjeblieft voordat je de volgende vraag stelt.',
      });
      return;
    }

    if (currentState.chatMessages.length >= CHAT_MAX_MESSAGES) {
      update({
        chatErrorMsg:
          'Dit gesprek is aan de lange kant geworden. Start gerust een nieuw gesprek via het pijltje hierboven.',
      });
      return;
    }

    const nextMessages = [
      ...currentState.chatMessages,
      {
        fromUser: true,
        text,
      },
    ];

    update({
      chatMessages: nextMessages,
      chatDraft: '',
      chatLoading: true,
      chatErrorMsg: null,
      lastSendAt: now,
    });

    persistChat(nextMessages);

    try {
      if (!window.claude || !window.claude.complete) {
        throw new Error('claude-unavailable');
      }

      const apiMessages = nextMessages.map((message) => ({
        role: message.fromUser ? 'user' : 'assistant',
        content: message.text,
      }));

      const reply = await window.claude.complete({
        system: CHAT_SYSTEM_PROMPT,
        messages: apiMessages,
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
      });

      const messagesWithReply = [
        ...nextMessages,
        {
          fromUser: false,
          text: reply,
        },
      ];

      update({
        chatMessages: messagesWithReply,
        chatLoading: false,
      });

      persistChat(messagesWithReply);
      speak(reply);
    } catch (error) {
      console.error('Chatfout:', error);

      update({
        chatLoading: false,
        chatErrorMsg:
          'Het antwoord kon nu niet worden geladen. Probeer het zo nog eens.',
      });
    }
  };

  const toggleListening = () => {
    const speechRecognition = recognition.current;

    if (!speechRecognition) return;

    if (stRef.current.isListening) {
      speechRecognition.stop();
      update({ isListening: false });
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    update({
      isListening: true,
      chatErrorMsg: null,
    });

    try {
      speechRecognition.start();
    } catch (error) {
      console.warn('Spraakherkenning kon niet starten:', error);

      update({
        isListening: false,
        chatErrorMsg:
          'De microfoon kon niet worden gestart. Typ uw vraag hieronder.',
      });
    }
  };

  const clearChat = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const initialMessages = [
      {
        fromUser: false,
        text: 'Gesprek gewist. Waar kan ik mee helpen?',
      },
    ];

    update({
      chatMessages: initialMessages,
      chatErrorMsg: null,
      chatDraft: '',
      isSpeaking: false,
    });

    persistChat(initialMessages);
  };

  const loadProfile = async (userId) => {
    if (!userId) {
      update({
        profile: null,
        profileLoading: false,
        profileError: '',
      });
      return null;
    }

    update({
      profileLoading: true,
      profileError: '',
    });

    // Eén gedeelde aanroep; AuthProvider gebruikt dezelfde cache.
    const data = await haalProfiel(userId);

    if (!data) {
      update({
        profile: null,
        profileLoading: false,
        profileError: 'Uw profielgegevens konden niet worden geladen.',
      });

      return null;
    }

    update({
      profile: data,
      profileLoading: false,
      profileError: '',
      memberName:
        `${data.first_name || ''} ${data.last_name || ''}`.trim() ||
        getMemberName(stRef.current.user),
    });

   return data;
};

useEffect(() => {
    let isMounted = true;

    // Zonder configuratie is er geen sessie. De website rendert dan volledig,
    // als niet-ingelogde bezoeker.
    if (!supabase) {
      update({ loading: false });

      return () => {
        isMounted = false;
      };
    }

    const loadSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!isMounted) return;

        update({
          session,
          user: session?.user || null,
          memberName: getMemberName(session?.user),
        });

        if (session?.user?.id) {
          await loadProfile(session.user.id);
        } else {
          update({
            profile: null,
            profileLoading: false,
            profileError: '',
          });
        }

        if (!isMounted) return;

        update({ authLoading: false });
      } catch (error) {
        console.error('Supabase-sessie kon niet worden geladen:', error);

        if (!isMounted) return;

        update({
          session: null,
          user: null,
          profile: null,
          profileLoading: false,
          profileError: '',
          memberName: '',
          authLoading: false,
        });
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      update({
        session,
        user: session?.user || null,
        memberName: getMemberName(session?.user),
        authLoading: false,
        loginLoading: false,
      });

      if (session?.user?.id) {
        setTimeout(() => {
          loadProfile(session.user.id);
        }, 0);
      } else {
        update({
          profile: null,
          profileLoading: false,
          profileError: '',
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const savedChat = sessionStorage.getItem(CHAT_STORAGE_KEY);

      if (savedChat) {
        const parsedChat = JSON.parse(savedChat);

        if (Array.isArray(parsedChat) && parsedChat.length > 0) {
          update({ chatMessages: parsedChat });
        }
      }
    } catch (error) {
      console.warn('Opgeslagen chat kon niet worden geladen:', error);
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return undefined;

    update({ micSupported: true });

    const speechRecognition = new SpeechRecognition();

    speechRecognition.lang = 'nl-NL';
    speechRecognition.interimResults = false;
    speechRecognition.maxAlternatives = 1;

    speechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      update({
        chatDraft: transcript,
        isListening: false,
      });

      setTimeout(() => {
        sendChatMessage();
      }, 0);
    };

    speechRecognition.onerror = () => {
      update({
        isListening: false,
        chatErrorMsg:
          'Microfoontoegang is niet beschikbaar. Typ uw vraag hieronder.',
      });
    };

    speechRecognition.onend = () => {
      update({ isListening: false });
    };

    recognition.current = speechRecognition;

    return () => {
      try {
        speechRecognition.abort();
      } catch (error) {
        console.warn('Spraakherkenning kon niet worden afgesloten:', error);
      }

      recognition.current = null;
    };
  }, []);

  // Gepubliceerde content en websiteteksten uit de database halen.
  const loadContent = async () => {
    try {
      const results = await Promise.all(
        collections.map(async (collection) => {
          const { data, error } = await supabase
            .from(collection.table)
            .select('*')
            .eq('status', 'published')
            .order(collection.order.column, {
              ascending: collection.order.ascending,
              nullsFirst: false,
            });

          if (error) {
            console.warn(
              `${collection.label} kon niet worden geladen:`,
              error.message,
            );

            return [collection.key, []];
          }

          return [
            collection.key,
            (data || []).map((row) => collection.mapForSite(row)),
          ];
        }),
      );

      const { data: textRows } = await supabase
        .from('site_content')
        .select('key, value');

      const siteText = Object.fromEntries(
        (textRows || [])
          .filter((row) => row.value)
          .map((row) => [row.key, row.value]),
      );

      update({
        content: Object.fromEntries(results),
        contentLoaded: true,
        siteText,
      });
    } catch (error) {
      console.warn('Content kon niet worden geladen:', error);
      update({ contentLoaded: true });
    }
  };

  useEffect(() => {
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [st.chatMessages, st.chatLoading, st.chatOpen]);

  // Database gaat voor; is er niets gepubliceerd, dan blijft de
  // voorbeeldinhoud uit data.js staan.
  const fromDatabase = (key, fallback) => {
    const rows = st.content?.[key];

    return rows && rows.length ? rows : fallback;
  };

  const siteNews = fromDatabase('news', allNewsItems);
  const siteVideos = fromDatabase('videos', videos);
  const siteResources = fromDatabase('resources', resources);
  const siteSessions = fromDatabase('sessions', sessions);
  const siteBlogPosts = fromDatabase('blog', blogPosts);
  const siteVacancies = fromDatabase('vacancies', vacancies);
  const siteCourseModules = fromDatabase('courses', []);
  const siteMasterclasses = fromDatabase('masterclasses', []);

  const textDefaults = Object.fromEntries(
    siteTextBlocks
      .flatMap((block) => block.items)
      .map((item) => [item.key, item.fallback || '']),
  );

  const text = (key) => st.siteText?.[key] || textDefaults[key] || '';

  const withOpen = (item) => ({
    ...item,
    open: () => {
      update({ activeArticleId: item.id });
      goPage('article');
    },
  });

  const article = (() => {
    const selectedArticle = siteNews.find(
      (item) => item.id === st.activeArticleId,
    );

    if (!selectedArticle) return null;

    const blocks = [];

    selectedArticle.body.forEach((section) => {
      if (section.h) {
        blocks.push({
          isHeading: true,
          isParagraph: false,
          text: section.h,
        });
      }

      section.paras.forEach((paragraph) => {
        blocks.push({
          isHeading: false,
          isParagraph: true,
          text: paragraph,
        });
      });
    });

    return {
      ...selectedArticle,
      blocks,
    };
  })();

  const isLoggedIn = Boolean(st.user);

  const memberDisplayName =
    st.memberName || getMemberName(st.user) || 'Uw profiel';

  const subscriptionActive =
    st.profile?.subscription_active === true;

  // Eén regel, in data/services/profile.js, gedeeld met de rest van de app.
  const subscriptionTier = tierVan(st.profile);

  const subscriptionPermissions =
    PLAN_PERMISSIONS[subscriptionTier] || PLAN_PERMISSIONS.free;

  const isFree = subscriptionTier === 'free';
  const isPro = subscriptionTier === 'pro';
  const isPremium = subscriptionTier === 'premium';

  const trialStartedAt = st.profile?.trial_started_at || null;
  const trialEndsAt = st.profile?.trial_ends_at || null;
  const subscriptionStartedAt =
    st.profile?.subscription_started_at || null;
  const subscriptionEndsAt =
    st.profile?.subscription_ends_at || null;

  const canUseHistory =
    isLoggedIn && subscriptionPermissions.history;

  const canGenerateWord =
    isLoggedIn && subscriptionPermissions.word;

  const canGeneratePdf =
    isLoggedIn && subscriptionPermissions.pdf;

  const canGenerateExcel =
    isLoggedIn && subscriptionPermissions.excel;

  const canUploadFiles =
    isLoggedIn && subscriptionPermissions.uploads;

  const canUseKnowledgeBase =
    isLoggedIn && subscriptionPermissions.knowledgeBase;

  const canUsePrivateDatabase =
    isLoggedIn && subscriptionPermissions.privateDatabase;

  const canUseOrganizationMemory =
    isLoggedIn && subscriptionPermissions.organizationMemory;

  const canUseCustomBranding =
    isLoggedIn && subscriptionPermissions.customBranding;

  const vals = {
    page: st.page,

    isHome: st.page === 'home',
    isFellow: st.page === 'fellow',
    isOrg: st.page === 'org',
    isOrient: st.page === 'orient',
    isCursussen: st.page === 'cursussen',
    isActueel: st.page === 'actueel',
    isArticle: st.page === 'article',
    isNetwerk: st.page === 'netwerk',
    isVacatures: st.page === 'vacatures',
    isContact: st.page === 'contact',
    isAdminPage: st.page === 'admin',
    isAbonnementen: st.page === 'abonnementen',

    isSubpage: st.page !== 'home',

    article,

    openArticle: (id) => {
      update({ activeArticleId: id });
      goPage('article');
    },

    goHome: () => goPage('home'),
    goFellow: () => goPage('fellow'),
    goOrg: () => goPage('org'),
    goOrient: () => goPage('orient'),
    goCursussen: () => goPage('cursussen'),
    goActueel: () => goPage('actueel'),
    goNetwerk: () => goPage('netwerk'),
    goVacatures: () => goPage('vacatures'),
    goContact: () => goPage('contact'),

    goAbonnementen: () => {
      update({ page: 'abonnementen' });

      if (window.location.hash.startsWith('#/subsidie-kompas')) {
        window.location.hash = '#/';
      }

      window.scrollTo(0, 0);
    },

    goAdmin: () => {
      if (stRef.current.profile?.role === 'admin') {
        goPage('admin');
      }
    },

    authLoading: st.authLoading,
    session: st.session,
    user: st.user,
    isLoggedIn,
    profile: st.profile,
    profileLoading: st.profileLoading,
    profileError: st.profileError,

    isAdmin: st.profile?.role === 'admin',
    isApproved: st.profile?.status === 'approved',
    isPending: st.profile?.status === 'pending',
    isRejected: st.profile?.status === 'rejected',

    subscriptionTier,
    subscriptionActive,
    subscriptionPermissions,

    isFree,
    isPro,
    isPremium,

    trialStartedAt,
    trialEndsAt,
    subscriptionStartedAt,
    subscriptionEndsAt,

    canUseHistory,
    canGenerateWord,
    canGeneratePdf,
    canGenerateExcel,
    canUploadFiles,
    canUseKnowledgeBase,
    canUsePrivateDatabase,
    canUseOrganizationMemory,
    canUseCustomBranding,

    showAuthCta:
      !isLoggedIn && !st.authLoading && st.authView === 'buttons',

    isAuthLogin:
      !isLoggedIn && !st.authLoading && st.authView === 'login',

    isAuthRegister:
      !isLoggedIn && !st.authLoading && st.authView === 'register',

    showLogin: () => {
      update({
        authView: 'login',
        loginError: '',
        applicationError: '',
      });
    },

    showRegister: () => {
      update({
        authView: 'register',
        loginError: '',
        applicationError: '',
        applicationSent: false,
      });
    },

    loginForm: st.loginForm,
    loginLoading: st.loginLoading,
    loginError: st.loginError,

    onLoginEmail: (event) => {
      update((previousState) => ({
        loginForm: {
          ...previousState.loginForm,
          email: event.target.value,
        },
        loginError: '',
      }));
    },

    onLoginPassword: (event) => {
      update((previousState) => ({
        loginForm: {
          ...previousState.loginForm,
          password: event.target.value,
        },
        loginError: '',
      }));
    },

    login: async () => {
      const form = stRef.current.loginForm;
      const email = form.email.trim().toLowerCase();
      const password = form.password;

      if (!email || !password) {
        update({
          loginError: 'Vul uw e-mailadres en wachtwoord in.',
        });
        return;
      }

      update({
        loginLoading: true,
        loginError: '',
      });

      if (!supabase) {
        return { error: 'Inloggen is nu niet beschikbaar.' };
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        update({
          session: data.session,
          user: data.user,
          memberName: getMemberName(data.user),
          loginForm: INITIAL_LOGIN_FORM,
          loginLoading: false,
          loginError: '',
          authView: 'buttons',
        });

        await loadProfile(data.user.id);
      } catch (error) {
        console.error('Inloggen is mislukt:', error);

        update({
          loginLoading: false,
          loginError: getAuthErrorMessage(error, 'login'),
        });
      }
    },

    logout: async () => {
      try {
        wisProfielCache();

        if (!supabase) {
          throw new Error('geen client');
        }

        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        update({
          session: null,
          user: null,
          profile: null,
          profileLoading: false,
          profileError: '',
          memberName: '',
          authView: 'buttons',
          loginForm: INITIAL_LOGIN_FORM,
          loginError: '',
        });
      } catch (error) {
        console.error('Uitloggen is mislukt:', error);

        update({
          loginError: getAuthErrorMessage(error, 'logout'),
        });
      }
    },

    requireLogin: () => {
      if (!stRef.current.user) {
        update({
          authView: 'login',
          loginError: 'Log eerst in om dit onderdeel te bekijken.',
        });
      }
    },

    regForm: st.regForm,
    applicationSent: st.applicationSent,
    applicationOpen: !st.applicationSent,
    applicationLoading: st.applicationLoading,
    applicationError: st.applicationError,

    onRegFirstName: (event) => {
      update((previousState) => ({
        regForm: {
          ...previousState.regForm,
          firstName: event.target.value,
        },
        applicationError: '',
      }));
    },

    onRegLastName: (event) => {
      update((previousState) => ({
        regForm: {
          ...previousState.regForm,
          lastName: event.target.value,
        },
        applicationError: '',
      }));
    },

    onRegEmail: (event) => {
      update((previousState) => ({
        regForm: {
          ...previousState.regForm,
          email: event.target.value,
        },
        applicationError: '',
      }));
    },

    onRegPassword: (event) => {
      update((previousState) => ({
        regForm: {
          ...previousState.regForm,
          password: event.target.value,
        },
        applicationError: '',
      }));
    },

    onRegType: (event) => {
      update((previousState) => ({
        regForm: {
          ...previousState.regForm,
          type: event.target.value,
        },
        applicationError: '',
      }));
    },

    onRegMotivation: (event) => {
      update((previousState) => ({
        regForm: {
          ...previousState.regForm,
          motivation: event.target.value,
        },
        applicationError: '',
      }));
    },

    typeZzp: st.regForm.type === 'zzp',
    typeOrg: st.regForm.type === 'org',
    typeOrient: st.regForm.type === 'orient',

    submitApplication: async () => {
      const form = stRef.current.regForm;

      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const email = form.email.trim().toLowerCase();
      const password = form.password;
      const memberType = form.type;
      const motivation = form.motivation.trim();

      if (
        !firstName ||
        !lastName ||
        !email ||
        !password ||
        !memberType ||
        !motivation
      ) {
        update({
          applicationError: 'Vul eerst alle velden in.',
        });
        return;
      }

      if (password.length < 8) {
        update({
          applicationError: 'Kies een wachtwoord van minimaal 8 tekens.',
        });
        return;
      }

      update({
        applicationLoading: true,
        applicationError: '',
      });

      if (!supabase) {
        return { error: 'Aanmelden is nu niet beschikbaar.' };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`,
              member_type: memberType,
              motivation,
              application_status: 'pending',
            },
          },
        });

        if (error) throw error;

        update({
          applicationSent: true,
          applicationLoading: false,
          applicationError: '',
          regForm: INITIAL_REGISTER_FORM,
        });

        if (data.session && data.user) {
          update({
            session: data.session,
            user: data.user,
            memberName: getMemberName(data.user),
          });

          await loadProfile(data.user.id);
        }
      } catch (error) {
        console.error('Lidmaatschapsaanvraag is mislukt:', error);

        update({
          applicationLoading: false,
          applicationError: getAuthErrorMessage(error, 'register'),
        });
      }
    },

    contactForm: st.contactForm,
    contactSent: st.contactSent,
    contactFormOpen: !st.contactSent,

    onContactName: (event) => {
      update((previousState) => ({
        contactForm: {
          ...previousState.contactForm,
          name: event.target.value,
        },
      }));
    },

    onContactEmail: (event) => {
      update((previousState) => ({
        contactForm: {
          ...previousState.contactForm,
          email: event.target.value,
        },
      }));
    },

    onContactSubject: (event) => {
      update((previousState) => ({
        contactForm: {
          ...previousState.contactForm,
          subject: event.target.value,
        },
      }));
    },

    onContactMessage: (event) => {
      update((previousState) => ({
        contactForm: {
          ...previousState.contactForm,
          message: event.target.value,
        },
      }));
    },

    sendContact: async () => {
      const form = stRef.current.contactForm;

      if (
        !form.name.trim() ||
        !form.email.trim() ||
        !form.subject.trim() ||
        !form.message.trim()
      ) {
        window.alert('Vul eerst alle velden in.');
        return;
      }

      try {
        const response = await fetch('https://formspree.io/f/mzdnejpz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            subject: form.subject.trim(),
            message: form.message.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error('Versturen mislukt');
        }

        update({
          contactSent: true,
          contactForm: INITIAL_CONTACT_FORM,
        });
      } catch (error) {
        console.error(
          'Contactformulier kon niet worden verstuurd:',
          error,
        );

        window.alert('Het bericht kon niet worden verstuurd.');
      }
    },

    profileFullName: memberDisplayName,
    profileInitials: getInitials(memberDisplayName),
    profileName: memberDisplayName,
    hideContact: !isLoggedIn,

    chatOpen: st.chatOpen,

    toggleChat: () => {
      update((previousState) => ({
        chatOpen: !previousState.chatOpen,
      }));
    },

    clearChat,

    chatMessages: st.chatMessages.map((message) => ({
      ...message,
      fromBot: !message.fromUser,
    })),

    chatDraft: st.chatDraft,

    onChatDraftChange: (event) => {
      update({
        chatDraft: event.target.value,
      });
    },

    onChatKeyDown: (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
      }
    },

    sendChatMessage,
    chatLoading: st.chatLoading,
    chatErrorMsg: st.chatErrorMsg,
    chatScrollRef,
    micSupported: st.micSupported,
    micButtonBg: st.isListening ? '#A8D5BA' : '#EAF4EE',
    toggleListening,
    isListening: st.isListening,
    isSpeaking: st.isSpeaking,
    stopSpeaking,

    heroAnimationOn: st.heroAnimationOn,

    emailDraft: st.emailDraft,

    onEmailChange: (event) => {
      update({
        emailDraft: event.target.value,
      });
    },

    vacForm: st.vacForm,
    memberVacancies: st.memberVacancies,
    hasMemberVacancies: st.memberVacancies.length > 0,
    vacPosted: st.vacPosted,

    onVacTitle: (event) => {
      update((previousState) => ({
        vacForm: {
          ...previousState.vacForm,
          title: event.target.value,
        },
      }));
    },

    onVacOrg: (event) => {
      update((previousState) => ({
        vacForm: {
          ...previousState.vacForm,
          org: event.target.value,
        },
      }));
    },

    onVacLocation: (event) => {
      update((previousState) => ({
        vacForm: {
          ...previousState.vacForm,
          location: event.target.value,
        },
      }));
    },

    onVacTag: (event) => {
      update((previousState) => ({
        vacForm: {
          ...previousState.vacForm,
          tag: event.target.value,
        },
      }));
    },

    submitVacancy: () => {
      const form = stRef.current.vacForm;

      if (!form.title.trim()) return;

      const vacancy = {
        title: form.title.trim(),
        org: form.org.trim() || 'Organisatie onbekend',
        location: form.location.trim() || 'Nederland',
        tags: form.tag.trim() ? [form.tag.trim()] : [],
      };

      update((previousState) => ({
        memberVacancies: [vacancy, ...previousState.memberVacancies],
        vacForm: INITIAL_VACANCY_FORM,
        vacPosted: true,
      }));
    },

    resources: siteResources,
    sessions: siteSessions,
    blogPosts: siteBlogPosts,
    questions,
    members,
    vacancies: siteVacancies,
    newsItems: siteNews.slice(0, 3),

    allNewsItems: siteNews.map(withOpen),
    homeNews: siteNews.slice(0, 3).map(withOpen),

    courseModules: siteCourseModules,
    hasCourseModules: siteCourseModules.length > 0,
    masterclasses: siteMasterclasses,
    hasMasterclasses: siteMasterclasses.length > 0,

    testimonials,
    videos: siteVideos,

    contentLoaded: st.contentLoaded,
    reloadContent: loadContent,

    siteText: st.siteText,
    text,

    actueelEyebrow: text('actueel.eyebrow'),
    actueelTitle: text('actueel.title'),
    actueelIntro: text('actueel.intro'),
    cursussenNotice: text('cursussen.notice'),
    cursussenNoticeLabel: text('cursussen.notice_label'),
    contactEmail: text('contact.email'),
    contactPhone: text('contact.phone'),
  };

  return (
    <AppContext.Provider value={vals}>
      {children}
    </AppContext.Provider>
  );
}
