import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { supabase } from '../../data/client.js';
import {
  PLAN_PERMISSIONS,
  haalProfiel,
  proefActiefVan,
  startProefperiode as startProefperiodeService,
  tierVan,
  uitloggen,
} from '../../data/services/profile.js';
import { collections, siteTextBlocks } from '../../data/collections.js';
import { naar } from '../../app/routes.js';
import { useAuthModal } from '../../app/providers/AuthModalProvider.jsx';

import {
  allNewsItems,
  resources,
  sessions,
  blogPosts,
  vacancies,
  newsItems,
  videos,
  CHAT_SYSTEM_PROMPT,
} from './defaultContent.js';

const CHAT_STORAGE_KEY = 'fwc_vraagbaak_chat_v1';
const CHAT_MIN_INTERVAL_MS = 2500;
const CHAT_MAX_MESSAGES = 40;

const INITIAL_BOT_MSG =
  'Hoi! Ik ben Collie, de assistent van Het Fondsenwervers Collectief. Ik help je graag verder met vragen over het Collectief of over Subsidie Kompas. Waar kan ik je mee helpen?';

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

// Koppelt een routepad (uit src/app/routes.js) aan de interne paginanaam
// van dit gebied. Alleen paden met een eigen, eenduidige pagina staan hier;
// /beheer hoort bij een ander gebied, en 'fellow'/'org' delen bewust het
// pad /lidmaatschap met 'orient' (zie toelichting in het rapport).
const PAD_TO_PAGE = {
  '/': 'home',
  '/actueel': 'actueel',
  '/artikel': 'article',
  '/vacatures': 'vacatures',
  '/cursussen': 'cursussen',
  '/netwerk': 'netwerk',
  '/lidmaatschap': 'orient',
  '/contact': 'contact',
  '/privacy': 'privacy',
  '/voorwaarden': 'voorwaarden',
  // AdminPortal.jsx hergebruikt deze provider voor zijn eigen sessie-/
  // profielstatus (zie useApp() in AdminPage.jsx: isAdminPage/isAdmin).
  // Zonder deze regel bleef st.page altijd op 'home' staan zodra
  // AdminPortal route/param doorgaf, waardoor AdminPage.jsx zichzelf
  // (isAdminPage === false) altijd verborg.
  '/beheer': 'admin',
};

export function WebsiteProvider({ children, route, param }) {
  // Eén centrale login/registratie van Het Fondsenwervers Collectief
  // (AuthModalProvider). Deze provider heeft zelf geen aanmeld- of
  // registratieformulieren meer.
  const authModal = useAuthModal();
  const initialPad = route && route.pad;
  const initialPage = (initialPad && PAD_TO_PAGE[initialPad]) || 'home';

  const [st, set] = useState({
    page: initialPage,
    activeArticleId: initialPage === 'article' ? param || null : null,

    // Vensterbreedte en mobiel menu, gelijk aan het goedgekeurde ontwerp.
    viewportW: typeof window !== 'undefined' ? window.innerWidth : 1200,
    mobileMenuOpen: false,

    authView: 'buttons',
    authLoading: true,
    session: null,
    user: null,
    profile: null,
    profileLoading: false,
    profileError: '',

    contactForm: INITIAL_CONTACT_FORM,
    contactSent: false,

    memberName: '',

    // Bijeenkomsten en vraag & antwoord. memberVisible blijft bestaan als bewaarde
    // voorkeur (zie workspace.js); er is nu geen ledenlijst waarop het werkt.
    memberVisible: true,
    sessionDraftOpen: false,
    sessionDraft: { title: '', day: '', month: '', time: '', mode: 'Online', note: '' },
    sessionProposed: false,
    memberSessions: [],
    qDraftOpen: false,
    qDraft: { title: '', body: '' },
    qOpenId: null,
    replyDrafts: {},
    memberQuestions: [],

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

  // De centrale route (App.jsx/useRoute.js) is de bron van waarheid voor
  // welke pagina getoond wordt. Dit zorgt dat een directe link, een refresh
  // en de terug/vooruit-knoppen van de browser de juiste pagina tonen; de
  // bestaande interne kliknavigatie (goHome/goActueel/...) blijft daarnaast
  // gewoon werken.
  useEffect(() => {
    const pad = route && route.pad;
    const mapped = pad && PAD_TO_PAGE[pad];

    if (!mapped) {
      return;
    }

    update({
      page: mapped,
      ...(mapped === 'article' ? { activeArticleId: param || null } : {}),
    });
  }, [route && route.pad, param]);

  // Vensterbreedte volgen; boven 860px sluit het mobiele menu, net als in het
  // goedgekeurde ontwerp.
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;

      set((prev) =>
        prev.viewportW === w
          ? prev
          : { ...prev, viewportW: w, mobileMenuOpen: w >= 860 ? false : prev.mobileMenuOpen },
      );
    };

    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  /* ---- Collectief: bijeenkomsten, vraag & antwoord ----
     Er is bewust geen ledenlijst (smoelenboek) meer. */

  // Bijeenkomsten: gepubliceerd uit de database, plus eigen voorstellen.
  const alleSessies = st.memberSessions.concat(
    siteSessions.map((s) => ({ ...s, status: s.status || 'Geaccepteerd' })),
  );

  // Vragen: alleen wat leden zelf plaatsen. Geen voorbeeldvragen meer —
  // een lege lijst toont de lege staat (hasQuestions) in plaats van
  // verzonnen forumvragen.
  const zichtbareVragen = st.memberQuestions.map((q, i) => {
    const id = q.id || `q${i}`;

    return {
      id,
      title: q.title,
      body: q.body || '',
      hasBody: Boolean(q.body),
      author: q.author || 'Een lid',
      role: q.role || '',
      answers: (q.replies || []).length,
      isOpen: st.qOpenId === id,
      toggle: () => update({ qOpenId: st.qOpenId === id ? null : id }),
      replies: q.replies || [],
      hasReplies: (q.replies || []).length > 0,
      replyValue: st.replyDrafts[id] || '',
      onReplyChange: (e) =>
        update({ replyDrafts: { ...stRef.current.replyDrafts, [id]: e.target.value } }),
      submitReply: () => submitReply(id),
    };
  });

  const siteExperiences = fromDatabase('experiences', []);

  // Alleen leden mogen plaatsen; anders naar het inlogscherm.
  const vereistLid = (fn) => () => {
    if (!stRef.current.user) {
      authModal.openLogin();

      return;
    }

    fn();
  };

  function submitReply(id) {
    if (!stRef.current.user) {
      authModal.openLogin();

      return;
    }

    const tekst = (stRef.current.replyDrafts[id] || '').trim();

    if (!tekst) return;

    update({
      memberQuestions: stRef.current.memberQuestions.map((q) =>
        q.id === id
          ? {
              ...q,
              replies: [
                ...(q.replies || []),
                { author: stRef.current.memberName || 'Lid van het Collectief', text: tekst },
              ],
            }
          : q,
      ),
      replyDrafts: { ...stRef.current.replyDrafts, [id]: '' },
    });
  }

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
      naar(`/artikel/${item.id}`);
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

  const trialActive = proefActiefVan(st.profile);
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
    isPrivacy: st.page === 'privacy',
    isVoorwaarden: st.page === 'voorwaarden',

    // De website is een eigen gebied; header, footer en chat horen erbij.
    isCollectief: true,

    // Breekpunt van de navigatie, gelijk aan het goedgekeurde ontwerp.
    isWideNav: st.viewportW >= 860,
    isNarrowNav: st.viewportW < 860,
    mobileMenuOpen: st.mobileMenuOpen,
    mobileMenuClosed: !st.mobileMenuOpen,
    toggleMobileMenu: () => update({ mobileMenuOpen: !stRef.current.mobileMenuOpen }),

    goVoorWie: () => {
      update({ mobileMenuOpen: false });
    },
    isAdminPage: st.page === 'admin',
    isAbonnementen: st.page === 'abonnementen',

    isSubpage: st.page !== 'home',

    article,

    openArticle: (id) => {
      update({ activeArticleId: id });
      goPage('article');
      naar(`/artikel/${id}`);
    },

    // Fellow/Org blijven bewust intern (geen eigen pad in routes.js; ze
    // delen het pad /lidmaatschap met 'orient' hieronder). De overige
    // paginas hebben wel een eigen, eenduidig pad en zetten dat nu ook in
    // de hash, zodat delen/verversen/terug-vooruit werken.
    goHome: () => {
      goPage('home');
      naar('/');
    },
    goFellow: () => goPage('fellow'),
    goOrg: () => goPage('org'),
    goOrient: () => {
      goPage('orient');
      naar('/lidmaatschap');
    },
    goCursussen: () => {
      goPage('cursussen');
      naar('/cursussen');
    },
    goActueel: () => {
      goPage('actueel');
      naar('/actueel');
    },
    goNetwerk: () => {
      goPage('netwerk');
      naar('/netwerk');
    },
    goVacatures: () => {
      goPage('vacatures');
      naar('/vacatures');
    },
    goContact: () => {
      goPage('contact');
      naar('/contact');
    },
    goPrivacy: () => {
      goPage('privacy');
      naar('/privacy');
    },
    goVoorwaarden: () => {
      goPage('voorwaarden');
      naar('/voorwaarden');
    },

    // Naar de Subsidie Kompas-omgeving. Dat is een ander gebied, dus via de hash.
    goKompas: (event) => {
      if (event && event.preventDefault) event.preventDefault();

      window.location.hash = '#/kompas';
    },

    goAbonnementen: () => {
      update({ page: 'abonnementen' });

      if (window.location.hash.startsWith('#/subsidie-kompas')) {
        window.location.hash = '#/';
      }

      window.scrollTo(0, 0);
    },

    // goPage('admin') zette voorheen alleen de lokale paginastatus van dít
    // WebsiteProvider-exemplaar (het website-gebied) — maar de beheerconsole
    // rendert via een heel andere, aparte WebsiteProvider-instantie binnen
    // AdminPortal.jsx, bereikt via de echte route /beheer. Zonder naar()
    // veranderde de hash dus nooit en gebeurde er bij een klik op "Beheer"
    // in de navigatie zichtbaar niets. naar('/beheer') laat de centrale
    // router (App.jsx/useRoute.js) daadwerkelijk naar het admin-gebied
    // navigeren, exact zoals goHome/goNetwerk/etc. hierboven al doen.
    goAdmin: () => {
      if (stRef.current.profile?.role === 'admin') {
        goPage('admin');
        naar('/beheer');
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

    trialActive,
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

    // Aanmelden en account aanmaken gebruiken de centrale overlay van Het
    // Fondsenwervers Collectief; er is geen tweede formulier of signUp meer.
    showLogin: () => {
      authModal.openLogin();
    },

    showRegister: () => {
      authModal.openRegister();
    },

    logout: async () => {
      try {
        // Eén implementatie, in data/services/profile.js.
        await uitloggen();

        update({
          session: null,
          user: null,
          profile: null,
          profileLoading: false,
          profileError: '',
          memberName: '',
          authView: 'buttons',
        });
      } catch (error) {
        console.error('Uitloggen is mislukt:', error);
      }
    },

    requireLogin: () => {
      if (!stRef.current.user) {
        authModal.openLogin('Log eerst in om dit onderdeel te bekijken.');
      }
    },

    // Proefperiode starten (7 dagen Pro / 24 uur Premium). Duur en
    // eenmaligheid zijn uitsluitend server-side afgedwongen (RPC
    // start_trial, zie data/services/profile.js); hier alleen aanroepen en
    // het profiel verversen zodat tier/rechten meteen overal kloppen.
    startTrial: async (gewensteTier) => {
      // Zonder profiel geen proefperiode (de RPC weigert dat ook server-side).
      const userId = stRef.current.user && stRef.current.user.id;
      const bestaandProfiel = stRef.current.profile || (await loadProfile(userId));

      if (!bestaandProfiel) {
        return { fout: 'Uw profielgegevens konden niet worden geladen. Er kan nu geen proefperiode worden gestart. Probeer het later opnieuw of neem contact met ons op.' };
      }

      const { fout } = await startProefperiodeService(gewensteTier);

      if (fout) {
        return { fout };
      }

      await loadProfile(stRef.current.user && stRef.current.user.id);

      return { fout: null };
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
    sessions: alleSessies.filter((s) => s.status !== 'Voorstel'),
    hasSessions: alleSessies.some((s) => s.status !== 'Voorstel'),
    blogPosts: siteBlogPosts,
    hasBlogPosts: siteBlogPosts.length > 0,
    noBlogPosts: siteBlogPosts.length === 0,
    questions: zichtbareVragen,
    hasQuestions: zichtbareVragen.length > 0,
    experiences: siteExperiences,
    hasExperiences: siteExperiences.length > 0,
    vacancies: siteVacancies,

    /* ---- Bijeenkomst voorstellen ---- */
    sessionDraftOpen: st.sessionDraftOpen,
    openSessionDraft: vereistLid(() =>
      update({ sessionDraftOpen: !stRef.current.sessionDraftOpen, sessionProposed: false }),
    ),
    sessionProposed: st.sessionProposed,
    sessionFields: [
      { label: 'Titel', key: 'title', placeholder: 'Intervisie: lastige casussen bespreken', wide: true },
      { label: 'Dag', key: 'day', placeholder: '18' },
      { label: 'Maand', key: 'month', placeholder: 'sep' },
      { label: 'Tijd', key: 'time', placeholder: '10:00' },
    ].map((f) => ({
      label: f.label,
      placeholder: f.placeholder,
      span: f.wide ? '1 / -1' : 'auto',
      value: st.sessionDraft[f.key] || '',
      onChange: (e) =>
        update({ sessionDraft: { ...stRef.current.sessionDraft, [f.key]: e.target.value } }),
    })),
    sessionNote: st.sessionDraft.note,
    setSessionNote: (e) =>
      update({ sessionDraft: { ...stRef.current.sessionDraft, note: e.target.value } }),
    proposeSession: vereistLid(() => {
      const d = stRef.current.sessionDraft;

      if (!(d.title || '').trim()) return;

      update({
        memberSessions: [
          {
            id: `s${Date.now()}`,
            title: d.title.trim(),
            day: d.day || '',
            month: d.month || '',
            time: d.time || '',
            host: `voorgesteld door ${stRef.current.memberName || 'een lid'}`,
            mode: d.mode || 'Online',
            note: d.note || '',
            status: 'Voorstel',
          },
          ...stRef.current.memberSessions,
        ],
        sessionDraft: { title: '', day: '', month: '', time: '', mode: 'Online', note: '' },
        sessionDraftOpen: false,
        sessionProposed: true,
      });
    }),

    /* ---- Vraag & antwoord ---- */
    qDraftOpen: st.qDraftOpen,
    openQDraft: vereistLid(() => update({ qDraftOpen: !stRef.current.qDraftOpen })),
    qDraftTitle: st.qDraft.title,
    qDraftBody: st.qDraft.body,
    setQDraftTitle: (e) => update({ qDraft: { ...stRef.current.qDraft, title: e.target.value } }),
    setQDraftBody: (e) => update({ qDraft: { ...stRef.current.qDraft, body: e.target.value } }),
    submitQuestion: vereistLid(() => {
      const titel = (stRef.current.qDraft.title || '').trim();

      if (!titel) return;

      const id = `q${Date.now()}`;

      update({
        memberQuestions: [
          {
            id,
            title: titel,
            body: (stRef.current.qDraft.body || '').trim(),
            author: stRef.current.memberName || 'Lid van het Collectief',
            role: 'Lid',
            replies: [],
          },
          ...stRef.current.memberQuestions,
        ],
        qDraft: { title: '', body: '' },
        qDraftOpen: false,
        qOpenId: id,
      });
    }),

    newsItems: siteNews.slice(0, 3),

    allNewsItems: siteNews.map(withOpen),
    homeNews: siteNews.slice(0, 3).map(withOpen),

    courseModules: siteCourseModules,
    hasCourseModules: siteCourseModules.length > 0,
    masterclasses: siteMasterclasses,
    hasMasterclasses: siteMasterclasses.length > 0,

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
