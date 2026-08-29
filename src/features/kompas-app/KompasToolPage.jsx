import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { supabase } from '../../data/client.js';
import { useApp } from './useKompasApp.js';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import { useFaqSections } from '../kompas-marketing/useMarketingContent.js';
import { askKompas } from '../../data/services/chat.js';
import { PLAN_PERMISSIONS } from '../../data/services/profile.js';

const EUROS = [
  {
    left: '8%',
    top: '62%',
    size: 46,
    color: '#4E9A6C',
    animation: 'sk-euro-a 22s ease-in-out infinite',
  },
  {
    left: '22%',
    top: '40%',
    size: 30,
    color: '#A9C9DE',
    animation: 'sk-euro-b 26s ease-in-out infinite 3s',
  },
  {
    left: '15%',
    top: '20%',
    size: 38,
    color: '#4E9A6C',
    animation: 'sk-euro-a 25s ease-in-out infinite 6s',
  },
  {
    left: '46%',
    top: '78%',
    size: 26,
    color: '#A9C9DE',
    animation: 'sk-euro-b 23s ease-in-out infinite 4.4s',
  },
  {
    left: '62%',
    top: '30%',
    size: 34,
    color: '#4E9A6C',
    animation: 'sk-euro-a 28s ease-in-out infinite 8s',
  },
  {
    left: '78%',
    top: '66%',
    size: 42,
    color: '#A9C9DE',
    animation: 'sk-euro-b 24s ease-in-out infinite 1.6s',
  },
];

const STARTERS = [
  'Maak een fondsenscan voor mijn project',
  'Beoordeel mijn subsidieaanvraag',
  'Werk een fondsenwervende strategie uit',
  'Verbeter mijn projectplan voor een fonds',
];


function makeConversationTitle(message) {
  const cleaned = message.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= 55) {
    return cleaned;
  }

  return `${cleaned.slice(0, 52)}...`;
}

export default function SubsidieKompas() {
  const app = useApp();

  const FAQ_SECTIONS = useFaqSections();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const hasStarted = messages.length > 0;

  const subscriptionTier =
    profile?.subscription_tier || 'free';

  const subscriptionActive =
    profile?.subscription_active === true;

  const effectiveSubscriptionTier =
    subscriptionActive &&
    ['pro', 'premium'].includes(subscriptionTier)
      ? subscriptionTier
      : 'free';

  const permissions =
    PLAN_PERMISSIONS[effectiveSubscriptionTier] ||
    PLAN_PERMISSIONS.free;

  const canUseHistory =
    !!user &&
    permissions.history;

  const canGenerateFiles =
    !!user &&
    (
      permissions.word ||
      permissions.pdf ||
      permissions.excel
    );

  const canUploadFiles =
    !!user &&
    permissions.uploads;

  const canUseKnowledgeBase =
    !!user &&
    permissions.knowledgeBase;

  const canUseFundDatabase =
    !!user &&
    permissions.fundDatabase;

  const canUseOrganizationMemory =
    !!user &&
    permissions.organizationMemory;

  /*
    Het invoerveld groeit mee met de hoeveelheid tekst.
  */
  useEffect(() => {
    const element = inputRef.current;

    if (!element) return;

    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [draft]);

  /*
    AUTH + PROFIEL
  */
  useEffect(() => {
    let mounted = true;

    const loadAuth = async () => {
      // Zonder configuratie is er geen sessie; de pagina blijft werken als
      // niet-ingelogde bezoeker.
      if (!supabase) {
        setUser(null);
        setProfile(null);
        setAuthLoading(false);

        return;
      }

      setAuthLoading(true);

      try {
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        if (!mounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setProfile(null);
          setAuthLoading(false);
          return;
        }

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'subscription_tier, subscription_active, trial_started_at, trial_ends_at, subscription_started_at, subscription_ends_at',
          )
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            'Profiel ophalen mislukt:',
            profileError,
          );
        }

        if (!mounted) return;

        setProfile(
          profileData || {
            subscription_tier: 'free',
            subscription_active: false,
          },
        );
      } catch (error) {
        console.error(
          'Auth laden mislukt:',
          error,
        );

        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    loadAuth();

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser =
          session?.user || null;

        setUser(currentUser);

        if (!currentUser) {
          setProfile(null);
          setConversations([]);
          setConversationId(null);
          setMessages([]);
          return;
        }

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'subscription_tier, subscription_active, trial_started_at, trial_ends_at, subscription_started_at, subscription_ends_at',
          )
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            'Profiel ophalen na login mislukt:',
            profileError,
          );
          return;
        }

        setProfile(
          profileData || {
            subscription_tier: 'free',
            subscription_active: false,
          },
        );
      },
    );

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  /*
    GESPREKKEN OPHALEN
  */
  useEffect(() => {
    if (!canUseHistory || !user) {
      setConversations([]);
      return;
    }

    loadConversations();
  }, [
    canUseHistory,
    user?.id,
  ]);

  /*
    AUTOMATISCH NAAR LAATSTE BERICHT
  */
  useEffect(() => {
    if (!hasStarted && !loading) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [
    messages,
    loading,
    hasStarted,
  ]);

  const loadConversations = async () => {
    if (!user || !canUseHistory) return;

    setHistoryLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          'subsidie_kompas_conversations',
        )
        .select(
          'id, title, created_at, updated_at',
        )
        .eq('user_id', user.id)
        .order(
          'updated_at',
          { ascending: false },
        );

      if (error) {
        throw error;
      }

      setConversations(
        data || [],
      );
    } catch (error) {
      console.error(
        'Gesprekken ophalen mislukt:',
        error,
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const openConversation = async (
    selectedConversationId,
  ) => {
    if (
      !user ||
      !canUseHistory ||
      loading
    ) {
      return;
    }

    setHistoryLoading(true);
    setErrorMessage('');

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          'subsidie_kompas_messages',
        )
        .select(
          'id, role, content, created_at',
        )
        .eq(
          'conversation_id',
          selectedConversationId,
        )
        .eq(
          'user_id',
          user.id,
        )
        .order(
          'created_at',
          { ascending: true },
        );

      if (error) {
        throw error;
      }

      setConversationId(
        selectedConversationId,
      );

      setMessages(
        (data || []).map(
          (item) => ({
            role: item.role,
            content: item.content,
          }),
        ),
      );

      setHistoryOpen(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error(
        'Gesprek openen mislukt:',
        error,
      );

      setErrorMessage(
        'Het eerdere gesprek kon niet worden geopend.',
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const startNewChat = () => {
    if (loading) return;

    setMessages([]);
    setDraft('');
    setConversationId(null);
    setErrorMessage('');
    setHistoryOpen(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const createConversation = async (
    firstMessage,
  ) => {
    if (
      !user ||
      !canUseHistory
    ) {
      return null;
    }

    const title =
      makeConversationTitle(
        firstMessage,
      );

    const {
      data,
      error,
    } = await supabase
      .from(
        'subsidie_kompas_conversations',
      )
      .insert({
        user_id: user.id,
        title,
      })
      .select(
        'id, title, created_at, updated_at',
      )
      .single();

    if (error) {
      throw error;
    }

    setConversationId(
      data.id,
    );

    setConversations(
      (current) => [
        data,
        ...current.filter(
          (item) =>
            item.id !== data.id,
        ),
      ],
    );

    return data.id;
  };

  const saveMessage = async (
    activeConversationId,
    role,
    content,
  ) => {
    if (
      !user ||
      !canUseHistory ||
      !activeConversationId
    ) {
      return;
    }

    const {
      error,
    } = await supabase
      .from(
        'subsidie_kompas_messages',
      )
      .insert({
        conversation_id:
          activeConversationId,
        user_id:
          user.id,
        role,
        content,
      });

    if (error) {
      throw error;
    }
  };

  const touchConversation = async (
    activeConversationId,
  ) => {
    if (
      !user ||
      !canUseHistory ||
      !activeConversationId
    ) {
      return;
    }

    const now =
      new Date().toISOString();

    const {
      error,
    } = await supabase
      .from(
        'subsidie_kompas_conversations',
      )
      .update({
        updated_at: now,
      })
      .eq(
        'id',
        activeConversationId,
      )
      .eq(
        'user_id',
        user.id,
      );

    if (error) {
      console.error(
        'Gesprekdatum bijwerken mislukt:',
        error,
      );
    }

    setConversations(
      (current) => {
        const updated =
          current.map(
            (conversation) =>
              conversation.id ===
              activeConversationId
                ? {
                    ...conversation,
                    updated_at: now,
                  }
                : conversation,
          );

        return updated.sort(
          (a, b) =>
            new Date(
              b.updated_at ||
                b.created_at,
            ).getTime() -
            new Date(
              a.updated_at ||
                a.created_at,
            ).getTime(),
        );
      },
    );
  };

  const chooseStarter = (
    starter,
  ) => {
    setDraft(starter);
    setErrorMessage('');

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const sendMessage = async () => {
    const message =
      draft.trim();

    if (
      !message ||
      loading
    ) {
      return;
    }

    const userMessage = {
      role: 'user',
      content: message,
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    setErrorMessage('');

    let activeConversationId =
      conversationId;

    try {
      /*
        Alleen Pro/Premium:
        gesprek aanmaken en bewaren.
      */
      if (canUseHistory) {
        if (
          !activeConversationId
        ) {
          activeConversationId =
            await createConversation(
              message,
            );
        }

        if (
          activeConversationId
        ) {
          try {
            await saveMessage(
              activeConversationId,
              'user',
              message,
            );
          } catch (saveError) {
            console.error(
              'Gebruikersbericht bewaren mislukt:',
              saveError,
            );
          }
        }
      }

      /*
        AI AANROEPEN
        Bestaande Edge Function 'subsidie-kompas'. Dezelfde aanroep staat als
        service in data/services/chat.js; in deel 7 gaat deze plek daarlangs,
        zodat de streaming- en contextuitbreiding op één plek landt.
      */
      const {
        answer,
        sources,
        error,
      } = await askKompas({
        messages: nextMessages,
        tier: effectiveSubscriptionTier,
        permissions: {
          canGenerateFiles,
          canUploadFiles,
          canUseKnowledgeBase,
          canUseFundDatabase,
          canUseOrganizationMemory,
        },
      });

      if (error) {
        throw new Error(error);
      }


      if (!answer) {
        throw new Error(
          'Geen antwoord ontvangen.',
        );
      }

      const assistantMessage = {
        role: 'assistant',
        content: answer,
        sources: sources || [],
      };

      setMessages(
        (current) => [
          ...current,
          assistantMessage,
        ],
      );

      /*
        BOTANTWOORD BEWAREN
      */
      if (
        canUseHistory &&
        activeConversationId
      ) {
        try {
          await saveMessage(
            activeConversationId,
            'assistant',
            answer,
          );

          await touchConversation(
            activeConversationId,
          );
        } catch (saveError) {
          console.error(
            'Botantwoord bewaren mislukt:',
            saveError,
          );
        }
      }
    } catch (error) {
      console.error(
        'Subsidie Kompas fout:',
        error,
      );

      setErrorMessage(
        'Subsidie Kompas kon uw vraag op dit moment niet beantwoorden. Probeer het opnieuw.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (
    event,
  ) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (
    event,
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={css(`
        position: relative;
        min-height: 100vh;
        background: #F7F9F8;
        color: #2E3A38;
        font-family: 'Mulish', sans-serif;
      `)}
    >
      <style>{`
        @keyframes sk-float {
          0% {
            transform: translate3d(0, 0, 0) rotate(-2deg);
          }

          50% {
            transform: translate3d(-18px, 14px, 0) rotate(3deg);
          }

          100% {
            transform: translate3d(0, 0, 0) rotate(-2deg);
          }
        }

        @keyframes sk-think-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes sk-think-sweep {
          0% {
            transform: rotate(-38deg);
          }

          50% {
            transform: rotate(38deg);
          }

          100% {
            transform: rotate(-38deg);
          }
        }

        @keyframes sk-think-fade {
          0%, 100% {
            opacity: 0.45;
          }

          50% {
            opacity: 1;
          }
        }

        @keyframes sk-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes sk-spin-rev {
          from {
            transform: rotate(360deg);
          }

          to {
            transform: rotate(0deg);
          }
        }

        @keyframes sk-euro-a {
          0% {
            opacity: 0;
            transform: translate3d(0, 25px, 0) rotate(-8deg);
          }

          15% {
            opacity: 0.10;
          }

          50% {
            opacity: 0.16;
            transform: translate3d(22px, -20px, 0) rotate(8deg);
          }

          85% {
            opacity: 0.10;
          }

          100% {
            opacity: 0;
            transform: translate3d(0, 25px, 0) rotate(-8deg);
          }
        }

        @keyframes sk-euro-b {
          0% {
            opacity: 0;
            transform: translate3d(0, -18px, 0) rotate(6deg);
          }

          15% {
            opacity: 0.10;
          }

          50% {
            opacity: 0.14;
            transform: translate3d(-18px, 24px, 0) rotate(-7deg);
          }

          85% {
            opacity: 0.10;
          }

          100% {
            opacity: 0;
            transform: translate3d(0, -18px, 0) rotate(6deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sk-bg-compass,
          .sk-compass-ring,
          .sk-compass-needle,
          .sk-think-ring,
          .sk-think-needle,
          .sk-think-text,
          .sk-euro {
            animation: none !important;
          }
        }

        .sk-history-list::-webkit-scrollbar {
          width: 6px;
        }

        .sk-history-list::-webkit-scrollbar-thumb {
          background: #D3DEDA;
          border-radius: 99px;
        }

        @media (max-width: 720px) {
          .sk-topnav {
            gap: 12px !important;
          }

          .sk-topnav a {
            font-size: 13px !important;
          }

          .sk-starters {
            grid-template-columns: 1fr !important;
          }

          .sk-chat-body,
          .sk-chat-input {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          .sk-chat {
            border-radius: 22px !important;
          }

          .sk-user,
          .sk-assistant {
            max-width: 92% !important;
          }

          .sk-history-actions {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .sk-history-menu {
            left: 0 !important;
            right: 0 !important;
            width: auto !important;
          }

          .sk-subscription-footer {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .sk-subscription-footer button {
            width: 100% !important;
          }

          .sk-chat-plan {
            margin-left: auto !important;
          }
        }
      `}</style>

      {/* ACHTERGROND */}
      <div
        aria-hidden="true"
        style={css(`
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        `)}
      >
        <div
          className="sk-bg-compass"
          style={css(`
            position: absolute;
            right: -6vw;
            top: 90px;
            width: clamp(300px, 58vw, 620px);
            height: clamp(300px, 58vw, 620px);
            animation: sk-float 20s ease-in-out infinite;
          `)}
        >
          <svg
            viewBox="0 0 200 200"
            width="100%"
            height="100%"
            style={{
              opacity: 0.12,
            }}
          >
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke="#2C4A5E"
              strokeWidth="1.4"
              strokeDasharray="3 6"
              strokeLinecap="round"
            />

            <circle
              cx="100"
              cy="100"
              r="72"
              fill="none"
              stroke="#2C4A5E"
              strokeWidth="1"
              strokeDasharray="2 7"
              strokeLinecap="round"
            />

            <g
              className="sk-compass-ring"
              style={{
                transformBox:
                  'view-box',
                transformOrigin:
                  '100px 100px',
                animation:
                  'sk-spin-rev 100s linear infinite',
              }}
            >
              <line
                x1="100"
                y1="8"
                x2="100"
                y2="22"
                stroke="#2C4A5E"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <line
                x1="192"
                y1="100"
                x2="178"
                y2="100"
                stroke="#2C4A5E"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <line
                x1="100"
                y1="192"
                x2="100"
                y2="178"
                stroke="#2C4A5E"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <line
                x1="8"
                y1="100"
                x2="22"
                y2="100"
                stroke="#2C4A5E"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            <g
              className="sk-compass-needle"
              style={{
                transformBox:
                  'view-box',
                transformOrigin:
                  '100px 100px',
                animation:
                  'sk-spin 44s linear infinite',
              }}
            >
              <polygon
                points="100,32 109,100 100,108 91,100"
                fill="#4E9A6C"
              />

              <polygon
                points="100,168 109,100 100,92 91,100"
                fill="#A9C9DE"
              />

              <circle
                cx="100"
                cy="100"
                r="5"
                fill="#2C4A5E"
              />
            </g>
          </svg>
        </div>

        {EUROS.map(
          (euro, index) => (
            <div
              key={index}
              className="sk-euro"
              style={css(`
                position: absolute;
                left: ${euro.left};
                top: ${euro.top};
                font-family: 'Newsreader', serif;
                font-size: ${euro.size}px;
                font-weight: 600;
                color: ${euro.color};
                opacity: 0;
                animation: ${euro.animation};
              `)}
            >
              €
            </div>
          ),
        )}
      </div>

      {/* TOPBAR */}
      <header
        style={css(`
          position: relative;
          z-index: 1;
          border-bottom: 1px solid #E1EAE4;
          background: rgba(247,249,248,0.94);
        `)}
      >
        <div
          style={css(`
            max-width: 1120px;
            margin: 0 auto;
            padding: 14px clamp(16px, 4vw, 24px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
          `)}
        >
          <div
            style={css(`
              display: flex;
              align-items: center;
              gap: 10px;
            `)}
          >
            <Logo size={30} />

            <span
              style={css(`
                font-family: 'Newsreader', serif;
                font-size: 18px;
                font-weight: 600;
                color: #2C4A5E;
              `)}
            >
              Subsidie Kompas
            </span>
          </div>

          <nav
            className="sk-topnav"
            style={css(`
              display: flex;
              align-items: center;
              gap: 22px;
              flex-wrap: wrap;
            `)}
          >
            <a
              href="#/"
              onClick={(event) => {
                event.preventDefault();
                app.goAbonnementen();
              }}
              style={topNavLinkStyle}
            >
              Abonnementen
            </a>

            <a href="#/hoe-het-werkt" style={topNavLinkStyle}>
              Hoe het werkt
            </a>

            <a href="#/deadlines" style={topNavLinkStyle}>
              Deadlines
            </a>

            <a href="#/organisatie" style={topNavLinkStyle}>
              Organisatie
            </a>

            <a href="#/projecten" style={topNavLinkStyle}>
              Projecten
            </a>

            <a href="#/documentatie" style={topNavLinkStyle}>
              Documentatie
            </a>

            <a href="#sk-faq" style={topNavLinkStyle}>
              FAQ
            </a>

            <a href="#/" style={topNavLinkStyle}>
              Het Collectief
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section
        style={css(`
          position: relative;
          z-index: 1;
          max-width: 850px;
          margin: 72px auto 0;
          padding: 0 24px;
          text-align: center;
        `)}
      >
        <Logo size={78} />

        <div
          style={css(`
            margin-top: 18px;
            font-family: 'Newsreader', serif;
            font-size: 21px;
            font-weight: 600;
            color: #4E9A6C;
          `)}
        >
          Subsidie Kompas
        </div>

        <h1
          style={css(`
            margin: 12px 0 22px;
            font-family: 'Newsreader', serif;
            font-size: clamp(42px, 5.5vw, 60px);
            font-weight: 600;
            line-height: 1.08;
            color: #2C4A5E;
          `)}
        >
          Uw gids bij fondsenwerving
        </h1>

        <p
          style={css(`
            max-width: 710px;
            margin: 0 auto;
            font-size: 18px;
            line-height: 1.65;
            color: #4B5C58;
          `)}
        >
          Subsidie Kompas helpt u aan projectfinanciering:
          passende fondsen, een concrete strategie en
          begeleiding bij de aanvraag.
        </p>
      </section>

      {/* CHAT */}
      <section
        style={css(`
          position: relative;
          z-index: 1;
          max-width: 1040px;
          margin: 54px auto 80px;
          padding: 0 24px;
        `)}
      >
        {!authLoading && canUseHistory ? (
          <div
            className="sk-history-actions"
            style={css(`
              position: relative;
              margin-bottom: 14px;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              gap: 12px;
            `)}
          >
            <button
              type="button"
              onClick={startNewChat}
              style={historyActionButtonStyle}
            >
              + Nieuwe chat
            </button>

            <div
              style={css(`
                position: relative;
              `)}
            >
              <button
                type="button"
                onClick={() =>
                  setHistoryOpen(
                    (current) =>
                      !current,
                  )
                }
                style={historyActionButtonStyle}
              >
                Eerdere gesprekken
                {conversations.length > 0
                  ? ` (${conversations.length})`
                  : ''}
              </button>

              {historyOpen ? (
                <div
                  className="sk-history-menu"
                  style={css(`
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    z-index: 20;
                    width: min(360px, 86vw);
                    padding: 10px;
                    border: 1px solid #DCE5E1;
                    border-radius: 16px;
                    background: #FFFFFF;
                    box-shadow: 0 16px 40px rgba(44,74,94,0.14);
                  `)}
                >
                  <div
                    style={css(`
                      padding: 6px 8px 10px;
                      color: #2C4A5E;
                      font-size: 13px;
                      font-weight: 800;
                    `)}
                  >
                    Eerdere gesprekken
                  </div>

                  <div
                    className="sk-history-list"
                    style={css(`
                      max-height: 300px;
                      overflow-y: auto;
                    `)}
                  >
                    {historyLoading ? (
                      <div
                        style={historyEmptyStyle}
                      >
                        Gesprekken laden...
                      </div>
                    ) : conversations.length === 0 ? (
                      <div
                        style={historyEmptyStyle}
                      >
                        Nog geen opgeslagen gesprekken.
                      </div>
                    ) : (
                      conversations.map(
                        (conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() =>
                              openConversation(
                                conversation.id,
                              )
                            }
                            style={css(`
                              width: 100%;
                              padding: 11px 12px;
                              display: block;
                              border: none;
                              border-radius: 11px;
                              background: ${
                                conversation.id ===
                                conversationId
                                  ? '#EDF4F0'
                                  : 'transparent'
                              };
                              color: #2E3A38;
                              font-family: inherit;
                              font-size: 13px;
                              font-weight: 700;
                              line-height: 1.4;
                              text-align: left;
                              cursor: pointer;
                            `)}
                          >
                            {conversation.title ||
                              'Nieuw gesprek'}
                          </button>
                        ),
                      )
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          className="sk-chat"
          style={css(`
            overflow: hidden;
            border-radius: 30px;
            background: #EAF1F6;
            box-shadow: 0 15px 45px rgba(44,74,94,0.08);
          `)}
        >
          {/* CHATHEADER */}
          <div
            style={css(`
              padding: 14px 22px;
              display: flex;
              align-items: center;
              gap: 11px;
              border-bottom: 1px solid #D6E3E9;
              background: #FFFFFF;
            `)}
          >
            <Logo size={38} />

            <div>
              <div
                style={css(`
                  color: #2C4A5E;
                  font-size: 15px;
                  font-weight: 800;
                `)}
              >
                Subsidie Kompas
              </div>

              <div
                style={css(`
                  margin-top: 2px;
                  color: #6B7B77;
                  font-size: 11.5px;
                `)}
              >
                Adviseur voor subsidies en fondsenwerving
              </div>
            </div>

            <div
              style={css(`
                margin-left: auto;
                display: flex;
                align-items: center;
                gap: 10px;
              `)}
            >
              <div
                style={css(`
                  display: flex;
                  align-items: center;
                  gap: 6px;
                `)}
              >
                <span
                  style={css(`
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #4E9A6C;
                  `)}
                />

                <span
                  style={css(`
                    color: #667873;
                    font-size: 12px;
                  `)}
                >
                  online
                </span>
              </div>

              <button
                className="sk-chat-plan"
                type="button"
                onClick={app.goAbonnementen}
                style={css(`
                  padding: 6px 10px;
                  border: 1px solid ${
                    effectiveSubscriptionTier === 'premium'
                      ? '#A9C9DE'
                      : effectiveSubscriptionTier === 'pro'
                        ? '#BBDAC6'
                        : '#DCE5E1'
                  };
                  border-radius: 999px;
                  background: ${
                    effectiveSubscriptionTier === 'premium'
                      ? '#EAF1F6'
                      : effectiveSubscriptionTier === 'pro'
                        ? '#EAF4EE'
                        : '#F7F9F8'
                  };
                  color: ${
                    effectiveSubscriptionTier === 'premium'
                      ? '#2C4A5E'
                      : effectiveSubscriptionTier === 'pro'
                        ? '#34734C'
                        : '#6B7B77'
                  };
                  font-family: inherit;
                  font-size: 10.5px;
                  font-weight: 900;
                  letter-spacing: 0.05em;
                  text-transform: uppercase;
                  cursor: pointer;
                `)}
              >
                {effectiveSubscriptionTier}
              </button>
            </div>
          </div>

          {!hasStarted ? (
            <div
              className="sk-chat-body"
              style={css(`
                padding: clamp(20px, 3.4vw, 34px);
              `)}
            >
              <div
                style={css(`
                  display: flex;
                  justify-content: flex-start;
                  margin-bottom: 28px;
                `)}
              >
                <div
                  className="sk-assistant"
                  style={css(`
                    max-width: 72%;
                    padding: 20px 22px;
                    border-radius: 24px 24px 24px 5px;
                    background: #FFFFFF;
                    color: #2E3A38;
                    box-shadow: 0 2px 10px rgba(44,74,94,0.035);
                    font-family: 'Mulish', sans-serif;
                    font-size: 15px;
                    font-weight: 400;
                    line-height: 1.68;
                  `)}
                >
                  Goedendag, ik ben Subsidie Kompas. Waarmee kan ik u
                  vandaag helpen?
                </div>
              </div>

              <div
                className="sk-starters"
                style={css(`
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(max(240px, calc(50% - 7px)), 1fr));
                  gap: 14px;
                `)}
              >
                {STARTERS.map(
                  (starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() =>
                        chooseStarter(starter)
                      }
                      style={starterButtonStyle}
                    >
                      <span>{starter}</span>
                      <span>→</span>
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : null}

          {hasStarted || loading ? (
            <div
              className="sk-chat-body"
              style={css(`
                min-height: 500px;
                max-height: 660px;
                overflow-y: auto;
                padding: 30px 34px 24px;
                display: flex;
                flex-direction: column;
                gap: 18px;
              `)}
            >
              {messages.map(
                (message, index) => (
                  <ChatMessage
                    key={`${message.role}-${index}`}
                    message={message}
                  />
                ),
              )}

              {loading ? (
                <div
                  className="sk-assistant"
                  style={css(`
                    align-self: flex-start;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 20px;
                    border-radius: 24px 24px 24px 5px;
                    background: #FFFFFF;
                    box-shadow: 0 2px 10px rgba(44,74,94,0.035);
                  `)}
                >
                  <ThinkingCompass />

                  <span
                    className="sk-think-text"
                    style={css(`
                      color: #6B7B77;
                      font-size: 14.5px;
                      font-weight: 600;
                      animation: sk-think-fade 1.6s ease-in-out infinite;
                    `)}
                  >
                    Kompas zoekt het uit
                  </span>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          ) : null}

          {errorMessage ? (
            <div
              style={css(`
                margin: 0 28px 14px;
                padding: 12px 15px;
                border-radius: 12px;
                background: #FFF1EF;
                color: #A13B2F;
                font-size: 13px;
              `)}
            >
              {errorMessage}
            </div>
          ) : null}

          <div
            className="sk-chat-input"
            style={css(`
              padding: ${
                hasStarted
                  ? '6px 28px 30px'
                  : '0 34px 34px'
              };
            `)}
          >
            <form
              onSubmit={handleSubmit}
              style={css(`
                display: flex;
                align-items: flex-end;
                gap: 10px;
                padding: 10px 10px 10px 20px;
                border-radius: 26px;
                background: #FFFFFF;
              `)}
            >
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value)
                }
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={loading}
                placeholder="Typ uw vraag..."
                style={css(`
                  flex: 1;
                  min-width: 0;
                  min-height: 48px;
                  max-height: 220px;
                  overflow-y: auto;
                  padding: 13px 0 10px;
                  border: none;
                  outline: none;
                  resize: none;
                  background: transparent;
                  color: #2E3A38;
                  font-family: inherit;
                  font-size: 15.5px;
                  line-height: 1.5;
                `)}
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !draft.trim()
                }
                aria-label="Verstuur vraag"
                style={css(`
                  width: 46px;
                  height: 46px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-shrink: 0;
                  border: none;
                  border-radius: 50%;
                  background: ${
                    loading ||
                    !draft.trim()
                      ? '#C8D4CE'
                      : '#4E9A6C'
                  };
                  cursor: ${
                    loading ||
                    !draft.trim()
                      ? 'default'
                      : 'pointer'
                  };
                `)}
              >
                <span
                  style={css(`
                    width: 0;
                    height: 0;
                    margin-left: 3px;
                    border-top: 7px solid transparent;
                    border-bottom: 7px solid transparent;
                    border-left: 10px solid #FFFFFF;
                  `)}
                />
              </button>
            </form>

            <SubscriptionFooter
              tier={effectiveSubscriptionTier}
              goAbonnementen={app.goAbonnementen}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="sk-faq"
        style={css(`
          position: relative;
          z-index: 1;
          max-width: 900px;
          margin: 0 auto;
          padding: clamp(56px, 8vw, 96px) clamp(16px, 4vw, 24px) clamp(64px, 9vw, 110px);
        `)}
      >
        <div
          style={css(`
            font-family: 'Newsreader', serif;
            font-size: 21px;
            font-weight: 600;
            color: #4E9A6C;
            text-align: center;
          `)}
        >
          FAQ
        </div>

        <h2
          style={css(`
            margin: 10px 0 14px;
            font-family: 'Newsreader', serif;
            font-size: clamp(28px, 5.5vw, 42px);
            font-weight: 600;
            line-height: 1.12;
            color: #2C4A5E;
            text-align: center;
          `)}
        >
          Vragen en voorwaarden
        </h2>

        <p
          style={css(`
            margin: 0 auto clamp(28px, 4vw, 40px);
            max-width: 620px;
            color: #55635F;
            font-size: 16.5px;
            line-height: 1.65;
            text-align: center;
          `)}
        >
          Wat Subsidie Kompas doet, wat het kost en waar u rekening mee houdt.
        </p>

        <div style={css(`display: grid; gap: clamp(28px, 4vw, 40px);`)}>
          {FAQ_SECTIONS.map((section) => (
            <div key={section.title}>
              <div
                style={css(`
                  margin-bottom: 14px;
                  color: #4E9A6C;
                  font-size: 12.5px;
                  font-weight: 800;
                  letter-spacing: 0.09em;
                  text-transform: uppercase;
                `)}
              >
                {section.title}
              </div>

              <div style={css(`display: grid; gap: 12px;`)}>
                {section.items.map((item) => (
                  <details
                    key={item.q}
                    style={css(`
                      padding: clamp(18px, 3vw, 24px) clamp(18px, 3vw, 26px);
                      border: 1px solid #E1EAE4;
                      border-radius: 18px;
                      background: #FFFFFF;
                    `)}
                  >
                    <summary
                      style={css(`
                        cursor: pointer;
                        color: #2C4A5E;
                        font-size: 16.5px;
                        font-weight: 700;
                        line-height: 1.45;
                      `)}
                    >
                      {item.q}
                    </summary>

                    <div
                      style={css(`
                        margin-top: 12px;
                        display: grid;
                        gap: 12px;
                        color: #55635F;
                        font-size: 15.5px;
                        line-height: 1.7;
                      `)}
                    >
                      {item.blocks.map((block, index) =>
                        typeof block === 'string' ? (
                          <p key={index} style={css(`margin: 0;`)}>
                            {block}
                          </p>
                        ) : block && block.list ? (
                          <ul
                            key={index}
                            style={css(`
                              margin: 0;
                              padding-left: 20px;
                              display: grid;
                              gap: 5px;
                            `)}
                          >
                            {block.list.map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        ) : (
                          <p key={index} style={css(`margin: 0;`)}>
                            {block}
                          </p>
                        ),
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          style={css(`
            margin-top: clamp(28px, 4vw, 40px);
            padding: clamp(24px, 4vw, 36px);
            border-radius: 22px;
            background: #2C4A5E;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            flex-wrap: wrap;
          `)}
        >
          <div style={css(`max-width: 460px;`)}>
            <div
              style={css(`
                color: #A9C9DE;
                font-size: 12.5px;
                font-weight: 700;
                letter-spacing: 0.06em;
                text-transform: uppercase;
              `)}
            >
              Abonnementen
            </div>

            <div
              style={css(`
                margin-top: 10px;
                font-family: 'Newsreader', serif;
                font-size: clamp(20px, 3.4vw, 26px);
                font-weight: 600;
                line-height: 1.35;
                color: #FFFFFF;
              `)}
            >
              Bekijk wat Free, Pro en Premium voor u doen.
            </div>
          </div>

          <button
            type="button"
            onClick={app.goAbonnementen}
            style={css(`
              padding: 14px 26px;
              border: none;
              border-radius: 999px;
              background: #A8D5BA;
              color: #2C4A5E;
              font-family: inherit;
              font-size: 15px;
              font-weight: 700;
              cursor: pointer;
            `)}
          >
            Zo werkt het
          </button>
        </div>
      </section>
    </div>
  );
}

function ThinkingCompass() {
  return (
    <span
      aria-hidden="true"
      style={css(`
        position: relative;
        width: 26px;
        height: 26px;
        flex-shrink: 0;
        display: inline-block;
      `)}
    >
      <span
        className="sk-think-ring"
        style={css(`
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #E1EAE4;
          border-top-color: #4E9A6C;
          animation: sk-think-spin 1.1s linear infinite;
        `)}
      />

      <span
        className="sk-think-needle"
        style={css(`
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2px;
          height: 15px;
          margin: -7.5px 0 0 -1px;
          border-radius: 2px;
          background: linear-gradient(180deg, #2C4A5E 0%, #2C4A5E 48%, #A8D5BA 52%, #A8D5BA 100%);
          transform-origin: 50% 50%;
          animation: sk-think-sweep 1.9s ease-in-out infinite;
        `)}
      />
    </span>
  );
}

const topNavLinkStyle = css(`
  color: #2C4A5E;
  font-size: 14.5px;
  font-weight: 700;
  text-decoration: none;
`);


function ChatMessage({
  message,
}) {
  const isUser =
    message.role === 'user';

  return (
    <div
      className={
        isUser
          ? 'sk-user'
          : 'sk-assistant'
      }
      style={
        isUser
          ? userBubbleStyle
          : assistantBubbleStyle
      }
    >
      <div
        style={css(`
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        `)}
      >
        {message.content}
      </div>

      {!isUser &&
      Array.isArray(message.sources) &&
      message.sources.length > 0 ? (
        <div
          style={css(`
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #E2EAE6;
          `)}
        >
          <div
            style={css(`
              margin-bottom: 8px;
              color: #71817D;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
            `)}
          >
            Bronnen
          </div>

          {message.sources.map(
            (source, index) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                style={css(`
                  display: block;
                  margin-top: 5px;
                  color: #2F6D47;
                  font-size: 13px;
                  font-weight: 700;
                  text-decoration: none;
                `)}
              >
                {source.title ||
                  source.url}
              </a>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function HowItWorksRow({ goAbonnementen }) {
  return (
    <div
      style={css(`
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      `)}
    >
      <span
        style={css(`
          color: #687974;
          font-size: 11.5px;
          font-weight: 700;
        `)}
      >
        Benieuwd wat Pro en Premium precies doen?
      </span>

      <button
        type="button"
        onClick={goAbonnementen}
        style={css(`
          min-height: 32px;
          padding: 7px 14px;
          border: none;
          border-radius: 999px;
          background: #4E9A6C;
          color: #FFFFFF;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
        `)}
      >
        Bekijk de abonnementen →
      </button>
    </div>
  );
}

function SubscriptionFooter({
  tier,
  goAbonnementen,
}) {
  if (tier === 'premium') {
    return (
      <div
        style={css(`
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #61766E;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
        `)}
      >
        <span
          style={css(`
            width: 7px;
            height: 7px;
            flex-shrink: 0;
            border-radius: 50%;
            background: #4E9A6C;
          `)}
        />

        Premium actief
      </div>
    );
  }

  if (tier === 'pro') {
    return (
      <>
      <div
        className="sk-subscription-footer"
        style={css(`
          margin-top: 13px;
          padding: 13px 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid #D8E5DD;
          border-radius: 15px;
          background: rgba(255,255,255,0.58);
        `)}
      >
        <div
          style={css(`
            min-width: 0;
          `)}
        >
          <div
            style={css(`
              color: #34734C;
              font-size: 11px;
              font-weight: 900;
            `)}
          >
            Pro actief
          </div>

          <div
            style={css(`
              margin-top: 3px;
              color: #687974;
              font-size: 11.5px;
              line-height: 1.45;
            `)}
          >
            Upgrade naar Premium voor de privédatabase, eigen kennisbank,
            organisatiegeheugen en tone of voice.
          </div>
        </div>

        <button
          type="button"
          onClick={goAbonnementen}
          style={subscriptionUpgradeButtonStyle}
        >
          Bekijk Premium
        </button>
      </div>

      <HowItWorksRow goAbonnementen={goAbonnementen} />
      </>
    );
  }

  return (
    <>
    <div
      className="sk-subscription-footer"
      style={css(`
        margin-top: 13px;
        padding: 13px 15px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border: 1px solid #DCE5E1;
        border-radius: 15px;
        background: rgba(255,255,255,0.58);
      `)}
    >
      <div
        style={css(`
          min-width: 0;
        `)}
      >
        <div
          style={css(`
            color: #2C4A5E;
            font-size: 11px;
            font-weight: 900;
          `)}
        >
          Meer uit Subsidie Kompas halen?
        </div>

        <div
          style={css(`
            margin-top: 3px;
            color: #687974;
            font-size: 11.5px;
            line-height: 1.45;
          `)}
        >
          Genereer Word- en PDF-documenten, bewaar gesprekken en werk met uw
          eigen huisstijl.
        </div>
      </div>

      <button
        type="button"
        onClick={goAbonnementen}
        style={subscriptionUpgradeButtonStyle}
      >
        Bekijk Pro & Premium
      </button>
    </div>

    <HowItWorksRow goAbonnementen={goAbonnementen} />
    </>
  );
}

function Logo({ size }) {
  return (
    <img
      src="/uploads/kompas-logo.png"
      alt="Subsidie Kompas"
      style={css(`
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        object-fit: contain;
      `)}
    />
  );
}

const starterButtonStyle =
  css(`
    min-height: 78px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border: 1px solid #D7E2DC;
    border-radius: 18px;
    background: #FFFFFF;
    color: #2C4A5E;
    font-family: inherit;
    font-size: 14.5px;
    font-weight: 700;
    line-height: 1.4;
    text-align: left;
    cursor: pointer;
  `);

const historyActionButtonStyle =
  css(`
    min-height: 38px;
    padding: 9px 14px;
    border: 1px solid #D7E2DC;
    border-radius: 999px;
    background: rgba(255,255,255,0.88);
    color: #2C4A5E;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  `);

const historyEmptyStyle =
  css(`
    padding: 18px 12px;
    color: #7A8984;
    font-size: 12.5px;
    line-height: 1.5;
  `);

const subscriptionUpgradeButtonStyle =
  css(`
    flex-shrink: 0;
    min-height: 36px;
    padding: 8px 13px;
    border: none;
    border-radius: 999px;
    background: #4E9A6C;
    color: #FFFFFF;
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 900;
    white-space: nowrap;
    cursor: pointer;
  `);

const userBubbleStyle =
  css(`
    align-self: flex-end;
    max-width: 72%;
    padding: 17px 22px;
    border-radius: 24px 24px 5px 24px;
    background: #2C4A5E;
    color: #FFFFFF;
    font-size: 15px;
    line-height: 1.65;
  `);

const assistantBubbleStyle =
  css(`
    align-self: flex-start;
    max-width: 78%;
    padding: 20px 22px;
    border-radius: 24px 24px 24px 5px;
    background: #FFFFFF;
    color: #2E3A38;
    box-shadow: 0 2px 10px rgba(44,74,94,0.035);
    font-size: 15px;
    line-height: 1.68;
  `);
