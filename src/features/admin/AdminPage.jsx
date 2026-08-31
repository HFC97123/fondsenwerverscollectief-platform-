import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { supabase } from '../../data/client.js';
import { useApp } from '../website/WebsiteProvider.jsx';
import AdminSidebar from './AdminSidebar.jsx';
import AdminDeadlines from './AdminDeadlines.jsx';
import AdminAbonnementen from './AdminAbonnementen.jsx';
import AdminAnalytics from './AdminAnalytics.jsx';
import AdminFunders from './AdminFunders.jsx';
import { fetchAdminDashboardCounts } from '../../data/services/adminDashboard.js';
import { setRole, setStatus } from '../../data/services/adminGebruikers.js';
import {
  cardGridInner,
  cardGridStyle,
  dangerButtonStyle,
  inputStyle,
  panelCss,
  panelStyle,
  plainButtonStyle,
  primaryButtonNoMarginCss,
  primaryButtonNoMarginStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  sectionIntroStyle,
  sectionTitleStyle,
  smallButtonStyle,
  smallDangerStyle,
  subsectionTitleStyle,
  textareaStyle,
  uploadButtonStyle,
} from './shared/adminStyles.js';
import {
  MEDIA_BUCKET,
  collections,
  createSlug,
  formatDate,
  getCollection,
  settingBlocks,
  siteTextBlocks,
  aiPromptBlocks,
  featureFlagBlocks,
} from '../../data/collections.js';

async function uploadToMedia(file, folder) {
  const safeName = file.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-');

  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export default function AdminPage() {

  const { isAdminPage, isAdmin, goHome, user, reloadContent } = useApp();

  const [activeTab, setActiveTab] = useState('dashboard');

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [counts, setCounts] = useState({});

  // Bredere dashboardtellers (funders/regelingen per data tier, gebruikers
  // per abonnement, beheerders) — via de admin-only RPC admin_dashboard_counts.
  const [adminCounts, setAdminCounts] = useState(null);

  const notify = (type, text) => {
    if (type === 'error') {
      setErrorMessage(text);
      setSuccessMessage('');
    } else {
      setSuccessMessage(text);
      setErrorMessage('');
    }
  };

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  useEffect(() => {
    if (!isAdminPage || !isAdmin) return undefined;

    let isMounted = true;

    const loadProfiles = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          member_type,
          motivation,
          status,
          role,
          created_at,
          approved_at,
          approved_by
        `)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error('Profielen konden niet worden geladen:', error);
        setProfiles([]);
        setErrorMessage('De ledengegevens konden niet worden geladen.');
      } else {
        setProfiles(data || []);
      }

      setLoading(false);
    };

    const loadCounts = async () => {
      const results = await Promise.all(
        collections.map(async (collection) => {
          const { count, error } = await supabase
            .from(collection.table)
            .select('id', { count: 'exact', head: true });

          return [collection.key, error ? 0 : count || 0];
        }),
      );

      if (!isMounted) return;

      setCounts(Object.fromEntries(results));
    };

    const loadAdminCounts = async () => {
      const res = await fetchAdminDashboardCounts();

      if (!isMounted) return;

      if (!res.error && res.data) {
        setAdminCounts(res.data);
      }
    };

    loadProfiles();
    loadCounts();
    loadAdminCounts();

    return () => {
      isMounted = false;
    };
  }, [isAdminPage, isAdmin]);

  const applications = useMemo(
    () => profiles.filter((profile) => profile.status === 'pending'),
    [profiles],
  );

  const approvedMembers = useMemo(
    () => profiles.filter((profile) => profile.status === 'approved'),
    [profiles],
  );

  const rejectedApplications = useMemo(
    () => profiles.filter((profile) => profile.status === 'rejected'),
    [profiles],
  );

  const filteredMembers = useMemo(() => {
    const search = memberSearch.trim().toLowerCase();

    if (!search) return approvedMembers;

    return approvedMembers.filter((member) => {
      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();

      return (
        fullName.includes(search) ||
        member.email?.toLowerCase().includes(search) ||
        member.member_type?.toLowerCase().includes(search)
      );
    });
  }, [approvedMembers, memberSearch]);

  const reviewApplication = async (application, newStatus) => {
    const displayName =
      `${application.first_name || ''} ${application.last_name || ''}`.trim() ||
      application.email;

    const actionText = newStatus === 'approved' ? 'goedkeuren' : 'afwijzen';

    if (!window.confirm(`Weet u zeker dat u de aanvraag van ${displayName} wilt ${actionText}?`)) {
      return;
    }

    setProcessingId(application.id);
    clearMessages();

    // Schrijft sinds Fase 2 via de SECURITY DEFINER RPC admin_set_status,
    // nooit meer via een rechtstreekse update op profiles. approved_at en
    // approved_by worden server-side gezet (approved_by = e-mailadres van de
    // handelende beheerder).
    const { error } = await setStatus(application.id, newStatus);

    if (error) {
      console.error('Aanvraag kon niet worden beoordeeld:', error);
      setErrorMessage('De aanvraag kon niet worden aangepast. Probeer het opnieuw.');
      setProcessingId(null);
      return;
    }

    const patch = {
      status: newStatus,
      approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
      approved_by: newStatus === 'approved' ? user?.email || 'admin' : application.approved_by,
    };

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === application.id ? { ...profile, ...patch } : profile,
      ),
    );

    notify(
      'success',
      newStatus === 'approved'
        ? `${displayName} is goedgekeurd.`
        : `${displayName} is afgewezen.`,
    );

    setProcessingId(null);
  };

  const updateMember = async (member, patch, message) => {
    setProcessingId(member.id);
    clearMessages();

    // Schrijft sinds Fase 2 via de SECURITY DEFINER RPC's admin_set_role en
    // admin_set_status — nooit meer via een rechtstreekse update op profiles.
    // admin_set_role weigert bovendien server-side dat een beheerder zijn
    // eigen rol intrekt.
    let error = null;

    if ('role' in patch) {
      ({ error } = await setRole(member.id, patch.role));
    } else if ('status' in patch) {
      ({ error } = await setStatus(member.id, patch.status));
    }

    if (error) {
      console.error('Lid kon niet worden bijgewerkt:', error);
      setErrorMessage(
        error.message && error.message.includes('eigen beheerdersrol')
          ? error.message
          : 'Het lid kon niet worden bijgewerkt.',
      );
      setProcessingId(null);
      return;
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === member.id ? { ...profile, ...patch } : profile,
      ),
    );

    notify('success', message);
    setProcessingId(null);
  };

  if (!isAdminPage) return null;

  // Beheer werkt alleen met een verbinding. Zonder client geen crash, maar een
  // duidelijke melding. Staat na de hooks, zodat de hookvolgorde gelijk blijft.
  if (!supabase) {
    return (
      <div style={css('max-width: 720px; margin: 0 auto; padding: 80px 24px;')}>
        <div style={css("margin-bottom: 10px; font-family: 'Newsreader', serif; font-size: clamp(25px, 3.8vw, 34px); color: #2C4A5E;")}>
          Beheer is niet beschikbaar
        </div>
        <div style={css('font-size: 15px; line-height: 1.65; color: #4B5C58;')}>
          Er is geen verbinding met de database. Controleer of VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY zijn
          ingesteld.
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main style={css(`max-width: 900px; margin: 0 auto; padding: 80px 32px;`)}>
        <h1 style={sectionTitleStyle}>Geen toegang</h1>

        <p style={sectionIntroStyle}>
          U heeft geen toegang tot deze beheeromgeving.
        </p>

        <button type="button" onClick={goHome} style={primaryButtonStyle}>
          Terug naar home
        </button>
      </main>
    );
  }

  const activeCollection = getCollection(activeTab);

  return (
    <main
      style={css(`
        max-width: 1440px;
        margin: 0 auto;
        padding: clamp(16px, 3vw, 32px);
      `)}
    >
      <div
        style={css(`
          display: flex;
          align-items: flex-start;
          gap: clamp(16px, 2.5vw, 32px);
          flex-wrap: wrap;
        `)}
      >
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            clearMessages();
          }}
          applicationsCount={applications.length}
          membersCount={approvedMembers.length}
          counts={{
            ...counts,
            deadlines: adminCounts ? adminCounts.regelingen_total : undefined,
            funders: adminCounts ? adminCounts.funders_total : undefined,
          }}
          goHome={goHome}
        />

        <div style={css(`flex: 1; min-width: 320px; padding: 8px 0 80px;`)}>
          <div style={css(`margin-bottom: 32px;`)}>
            <p
              style={css(`
                margin: 0 0 8px;
                color: #4E9A6C;
                font-size: 13px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.1em;
              `)}
            >
              Het Fondsenwervers Collectief
            </p>

            <h1
              style={css(`
                margin: 0;
                font-family: 'Newsreader', serif;
                font-size: clamp(30px, 5.5vw, 46px);
                color: #2C4A5E;
              `)}
            >
              Beheeromgeving
            </h1>
          </div>

          {successMessage ? (
            <div
              style={css(`
                margin-bottom: 24px;
                padding: 16px 18px;
                border-radius: 14px;
                background: #EAF4EE;
                color: #2F6D47;
                font-weight: 700;
              `)}
            >
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div
              style={css(`
                margin-bottom: 24px;
                padding: 16px 18px;
                border-radius: 14px;
                background: #FFF1EF;
                color: #A13B2F;
                font-weight: 600;
              `)}
            >
              {errorMessage}
            </div>
          ) : null}

          {activeTab === 'dashboard' ? (
            <DashboardSection
              applications={applications.length}
              members={approvedMembers.length}
              rejected={rejectedApplications.length}
              counts={counts}
              adminCounts={adminCounts}
              setActiveTab={setActiveTab}
              goHome={goHome}
            />
          ) : null}

          {activeTab === 'applications' ? (
            loading ? (
              <div style={panelStyle}>Aanvragen laden...</div>
            ) : (
              <ApplicationsSection
                applications={applications}
                processingId={processingId}
                reviewApplication={reviewApplication}
              />
            )
          ) : null}

          {activeTab === 'members' ? (
            loading ? (
              <div style={panelStyle}>Leden laden...</div>
            ) : (
              <MembersSection
                memberSearch={memberSearch}
                setMemberSearch={setMemberSearch}
                members={filteredMembers}
                processingId={processingId}
                updateMember={updateMember}
                currentUserId={user?.id}
              />
            )
          ) : null}

          {activeTab === 'deadlines' ? (
            <div style={panelStyle}>
              <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: clamp(23px, 3.2vw, 28px); color: #2C4A5E;")}>
                Deadlines
              </div>
              <div style={css('margin-bottom: 26px; max-width: 700px; font-size: 15px; line-height: 1.65; color: #536460;')}>
                Beheer de subsidieregelingen en deadlines die op de Deadlines-pagina staan. Upload een CSV-bestand of
                voeg regelingen los toe.
              </div>
              <AdminDeadlines notify={notify} />
            </div>
          ) : null}

          {activeCollection ? (
            <CollectionSection
              key={activeCollection.key}
              collection={activeCollection}
              user={user}
              notify={notify}
              clearMessages={clearMessages}
              reloadContent={reloadContent}
              onCountChange={(count) =>
                setCounts((current) => ({
                  ...current,
                  [activeCollection.key]: count,
                }))
              }
            />
          ) : null}

          {activeTab === 'funders' ? <AdminFunders notify={notify} /> : null}

          {activeTab === 'abonnementen' ? <AdminAbonnementen notify={notify} /> : null}

          {activeTab === 'analytics' ? <AdminAnalytics /> : null}

          {activeTab === 'prompts' ? (
            <KeyValueSection
              table="ai_prompts"
              valueColumn="prompt"
              blocks={aiPromptBlocks.map((block) => ({
                title: block.page,
                description: block.description || '',
                items: block.items,
              }))}
              title="AI-teksten"
              intro="De systeemteksten die de assistent meekrijgt. Leeg laten betekent: de ingebouwde tekst blijft gelden."
              user={user}
              notify={notify}
              clearMessages={clearMessages}
            />
          ) : null}

          {activeTab === 'flags' ? (
            <KeyValueSection
              table="feature_flags"
              valueColumn="aan"
              blocks={featureFlagBlocks.map((block) => ({
                title: block.page,
                description: block.description || '',
                items: block.items,
              }))}
              title="Onderdelen"
              intro="Zet een onderdeel van het platform aan of uit zonder de code te wijzigen."
              user={user}
              notify={notify}
              clearMessages={clearMessages}
            />
          ) : null}

          {activeTab === 'media' ? (
            <MediaSection notify={notify} clearMessages={clearMessages} />
          ) : null}

          {activeTab === 'website' ? (
            <KeyValueSection
              table="site_content"
              blocks={siteTextBlocks.map((block) => ({
                title: block.page,
                description: '',
                items: block.items,
              }))}
              title="Website"
              intro="Pas de teksten aan die op de publieke website staan. Leeg laten betekent: de standaardtekst blijft staan."
              user={user}
              notify={notify}
              clearMessages={clearMessages}
              reloadContent={reloadContent}
            />
          ) : null}

          {activeTab === 'settings' ? (
            <KeyValueSection
              table="site_settings"
              blocks={settingBlocks}
              title="Instellingen"
              intro="Instellingen voor het platform en de koppelingen."
              user={user}
              notify={notify}
              clearMessages={clearMessages}
            />
          ) : null}

          {activeTab === 'subsidie-kompas' ? (
            <KeyValueSection
              table="site_settings"
              blocks={settingBlocks.filter(
                (block) => block.title === 'Subsidie Kompas',
              )}
              title="Subsidie Kompas"
              intro="Beheer de koppeling met de Subsidie Kompas-omgeving."
              user={user}
              notify={notify}
              clearMessages={clearMessages}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function DashboardSection({
  applications,
  members,
  rejected,
  counts,
  adminCounts,
  setActiveTab,
  goHome,
}) {
  return (
    <section>
      <div
        style={css(`
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          margin-bottom: 28px;
        `)}
      >
        <div>
          <h2 style={sectionTitleStyle}>Dashboard</h2>

          <p style={sectionIntroStyle}>
            Beheer het Collectief vanuit één centrale omgeving.
          </p>
        </div>

        <button type="button" onClick={goHome} style={secondaryButtonStyle}>
          Website bekijken
        </button>
      </div>

      <div style={cardGridStyle}>
        <DashboardCard
          number={applications}
          label="Open aanvragen"
          helper="Nog te beoordelen"
          onClick={() => setActiveTab('applications')}
        />

        <DashboardCard
          number={members}
          label="Goedgekeurde leden"
          helper="Actieve community"
          onClick={() => setActiveTab('members')}
        />

        <DashboardCard
          number={counts.news ?? 0}
          label="Nieuwsartikelen"
          helper="Concepten en publicaties"
          onClick={() => setActiveTab('news')}
        />

        <DashboardCard
          number={rejected}
          label="Afgewezen aanvragen"
          helper="Historisch overzicht"
        />
      </div>

      <div style={css(`margin-top: 34px;`)}>
        <h3 style={subsectionTitleStyle}>Funders, subsidieregelingen en gebruikers</h3>

        {adminCounts ? (
          <div style={css(`${cardGridInner} margin-top: 16px;`)}>
            <DashboardCard
              number={adminCounts.funders_total}
              label="Funders totaal"
              helper={`${adminCounts.funders_public} public · ${adminCounts.funders_premium} premium`}
              onClick={() => setActiveTab('funders')}
            />

            <DashboardCard
              number={adminCounts.funders_unreviewed}
              label="Funders niet beoordeeld"
              helper="classification_reviewed = false"
              onClick={() => setActiveTab('funders')}
            />

            <DashboardCard
              number={adminCounts.regelingen_total}
              label="Subsidieregelingen totaal"
              helper={`${adminCounts.regelingen_public} public · ${adminCounts.regelingen_premium} premium`}
              onClick={() => setActiveTab('deadlines')}
            />

            <DashboardCard
              number={adminCounts.regelingen_unreviewed}
              label="Regelingen niet beoordeeld"
              helper="classification_reviewed = false"
              onClick={() => setActiveTab('deadlines')}
            />

            <DashboardCard number={adminCounts.users_free} label="Gebruikers · Free" onClick={() => setActiveTab('members')} />
            <DashboardCard number={adminCounts.users_pro} label="Gebruikers · Pro" onClick={() => setActiveTab('members')} />
            <DashboardCard
              number={adminCounts.users_premium}
              label="Gebruikers · Premium"
              onClick={() => setActiveTab('members')}
            />
            <DashboardCard number={adminCounts.users_admin} label="Beheerders" onClick={() => setActiveTab('members')} />
          </div>
        ) : (
          <div style={css('margin-top: 16px; color: #82918B; font-size: 13.5px;')}>Tellers laden…</div>
        )}
      </div>

      <div style={css(`margin-top: 34px;`)}>
        <h3 style={subsectionTitleStyle}>Content op de website</h3>

        <div style={css(`${cardGridInner} margin-top: 16px;`)}>
          {collections.map((collection) => (
            <QuickActionCard
              key={collection.key}
              title={collection.label}
              description={`${counts[collection.key] ?? 0} item(s) in beheer`}
              onClick={() => setActiveTab(collection.key)}
            />
          ))}

          <QuickActionCard
            title="Media"
            description="Afbeeldingen, templates en documenten uploaden."
            onClick={() => setActiveTab('media')}
          />

          <QuickActionCard
            title="Website"
            description="Teksten op de publieke pagina's aanpassen."
            onClick={() => setActiveTab('website')}
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Generieke sectie voor alle contentcollecties
// ---------------------------------------------------------------------------

function emptyForm(collection) {
  const form = { id: null };

  collection.fields.forEach((field) => {
    form[field.name] = '';
  });

  return form;
}

function CollectionSection({
  collection,
  user,
  notify,
  clearMessages,
  reloadContent,
  onCountChange,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(collection));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from(collection.table)
      .select('*')
      .order(collection.order.column, {
        ascending: collection.order.ascending,
        nullsFirst: false,
      });

    if (error) {
      console.error(`${collection.label} kon niet worden geladen:`, error);
      notify('error', `${collection.label} kon niet worden geladen. ${error.message || ''}`);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);

    if (onCountChange) onCountChange((data || []).length);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.key]);

  const openNew = () => {
    const next = emptyForm(collection);

    if (collection.fields.some((field) => field.name === 'author')) {
      next.author = user?.email || '';
    }

    setForm(next);
    setFormOpen(true);
    clearMessages();
  };

  const openEdit = (row) => {
    const next = { id: row.id };

    collection.fields.forEach((field) => {
      next[field.name] = row[field.name] ?? '';
    });

    setForm(next);
    setFormOpen(true);
    clearMessages();
  };

  const closeForm = () => {
    setForm(emptyForm(collection));
    setFormOpen(false);
  };

  const buildPayload = (status) => {
    const now = new Date().toISOString();
    const payload = { status, updated_at: now };

    collection.fields.forEach((field) => {
      const raw = form[field.name];

      if (field.type === 'number') {
        payload[field.name] = raw === '' || raw === null ? 0 : Number(raw);
        return;
      }

      const value = typeof raw === 'string' ? raw.trim() : raw;

      payload[field.name] = value === '' ? null : value;
    });

    if (collection.key === 'news') {
      payload.slug = createSlug(form.title);
      payload.author =
        payload.author || user?.email || 'Het Fondsenwervers Collectief';
    }

    if (collection.key === 'vacancies' && !payload.source_type) {
      payload.source_type = 'handmatig';
    }

    payload.published_at = status === 'published' ? now : null;

    return payload;
  };

  const save = async (status) => {
    const missing = collection.fields
      .filter((field) => field.required && !String(form[field.name] || '').trim())
      .map((field) => field.label);

    if (missing.length) {
      notify('error', `Vul eerst in: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    clearMessages();

    const payload = buildPayload(status);

    const response = form.id
      ? await supabase.from(collection.table).update(payload).eq('id', form.id)
      : await supabase
          .from(collection.table)
          .insert({ ...payload, created_at: new Date().toISOString() });

    if (response.error) {
      console.error(`${collection.label} kon niet worden opgeslagen:`, response.error);
      notify('error', `Dit ${collection.singular} kon niet worden opgeslagen. ${response.error.message || ''}`);
      setSaving(false);
      return;
    }

    notify(
      'success',
      status === 'published'
        ? `Het ${collection.singular} staat nu op de website.`
        : 'Het concept is opgeslagen.',
    );

    setSaving(false);
    closeForm();
    await load();

    if (status === 'published' && reloadContent) reloadContent();
  };

  const toggleStatus = async (row) => {
    const nextStatus = row.status === 'published' ? 'draft' : 'published';

    setBusyId(row.id);
    clearMessages();

    const { error } = await supabase
      .from(collection.table)
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
        published_at: nextStatus === 'published' ? new Date().toISOString() : null,
      })
      .eq('id', row.id);

    if (error) {
      console.error('Status kon niet worden gewijzigd:', error);
      notify('error', `De status kon niet worden gewijzigd. ${error.message || ''}`);
      setBusyId(null);
      return;
    }

    notify(
      'success',
      nextStatus === 'published'
        ? 'Het item staat nu op de website.'
        : 'Het item is van de website gehaald.',
    );

    setBusyId(null);
    await load();

    if (reloadContent) reloadContent();
  };

  const remove = async (row) => {
    if (!window.confirm(`Weet u zeker dat u "${collection.title(row)}" wilt verwijderen?`)) {
      return;
    }

    setBusyId(row.id);
    clearMessages();

    const { error } = await supabase
      .from(collection.table)
      .delete()
      .eq('id', row.id);

    if (error) {
      console.error('Item kon niet worden verwijderd:', error);
      notify('error', `Het item kon niet worden verwijderd. ${error.message || ''}`);
      setBusyId(null);
      return;
    }

    notify('success', 'Het item is verwijderd.');
    setBusyId(null);
    await load();

    if (reloadContent) reloadContent();
  };

  const visibleRows =
    filter === 'all' ? rows : rows.filter((row) => row.status === filter);

  return (
    <section>
      <div
        style={css(`
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        `)}
      >
        <div style={css(`max-width: 620px;`)}>
          <h2 style={sectionTitleStyle}>{collection.label}</h2>
          <p style={sectionIntroStyle}>{collection.intro}</p>
        </div>

        <button type="button" onClick={openNew} style={primaryButtonNoMarginStyle}>
          {collection.newLabel}
        </button>
      </div>

      <div style={css(`display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;`)}>
        {[
          { key: 'all', label: `Alles (${rows.length})` },
          {
            key: 'published',
            label: `Op de website (${rows.filter((row) => row.status === 'published').length})`,
          },
          {
            key: 'draft',
            label: `Concepten (${rows.filter((row) => row.status !== 'published').length})`,
          },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            style={css(`
              padding: 8px 14px;
              border: 1px solid ${filter === option.key ? '#4E9A6C' : '#D5E0D9'};
              border-radius: 999px;
              background: ${filter === option.key ? '#EAF4EE' : '#FFFFFF'};
              color: ${filter === option.key ? '#2F6D47' : '#536460'};
              font-family: inherit;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
            `)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {formOpen ? (
        <CollectionForm
          collection={collection}
          form={form}
          setForm={setForm}
          saving={saving}
          onCancel={closeForm}
          onSaveDraft={() => save('draft')}
          onPublish={() => save('published')}
          notify={notify}
        />
      ) : null}

      {loading ? <div style={panelStyle}>{collection.label} laden...</div> : null}

      {!loading && visibleRows.length === 0 ? (
        <EmptyState>
          {rows.length === 0
            ? `Er is nog geen ${collection.singular} aangemaakt.`
            : 'Geen items in deze weergave.'}
        </EmptyState>
      ) : null}

      {!loading && visibleRows.length > 0 ? (
        <div style={css(`display: grid; gap: 14px;`)}>
          {visibleRows.map((row) => {
            const published = row.status === 'published';
            const meta = (collection.meta ? collection.meta(row) : []).filter(Boolean);

            return (
              <article key={row.id} style={panelStyle}>
                <div
                  style={css(`
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    flex-wrap: wrap;
                  `)}
                >
                  <div style={css(`min-width: 240px; flex: 1;`)}>
                    <h3
                      style={css(`
                        margin: 0 0 6px;
                        font-family: 'Newsreader', serif;
                        font-size: 24px;
                        color: #2C4A5E;
                      `)}
                    >
                      {collection.title(row)}
                    </h3>

                    <p style={css(`margin: 0; color: #536460; line-height: 1.6;`)}>
                      {collection.subtitle(row) || '—'}
                    </p>

                    {meta.length ? (
                      <p
                        style={css(`
                          margin: 10px 0 0;
                          color: #82918B;
                          font-size: 13px;
                          font-weight: 600;
                        `)}
                      >
                        {meta.join(' · ')}
                      </p>
                    ) : null}
                  </div>

                  <span
                    style={css(`
                      padding: 6px 10px;
                      border-radius: 999px;
                      background: ${published ? '#EAF4EE' : '#FFF4D6'};
                      color: ${published ? '#2F6D47' : '#8A6514'};
                      font-size: 12px;
                      font-weight: 700;
                      height: fit-content;
                      white-space: nowrap;
                    `)}
                  >
                    {published ? 'Op de website' : 'Concept'}
                  </span>
                </div>

                <div
                  style={css(`
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                    flex-wrap: wrap;
                  `)}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    style={secondaryButtonStyle}
                  >
                    Bewerken
                  </button>

                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => toggleStatus(row)}
                    style={published ? secondaryButtonStyle : primaryButtonNoMarginStyle}
                  >
                    {published ? 'Van website halen' : 'Publiceren'}
                  </button>

                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => remove(row)}
                    style={dangerButtonStyle}
                  >
                    Verwijderen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function CollectionForm({
  collection,
  form,
  setForm,
  saving,
  onCancel,
  onSaveDraft,
  onPublish,
  notify,
}) {
  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  return (
    <div
      style={css(`
        margin-bottom: 28px;
        padding: clamp(20px, 3vw, 28px);
        border: 1px solid #D5E0D9;
        border-radius: 20px;
        background: #FFFFFF;
      `)}
    >
      <h3
        style={css(`
          margin: 0 0 24px;
          font-family: 'Newsreader', serif;
          font-size: 26px;
          color: #2C4A5E;
        `)}
      >
        {form.id
          ? `${collection.singular.charAt(0).toUpperCase()}${collection.singular.slice(1)} bewerken`
          : collection.newLabel.replace('+ ', '')}
      </h3>

      <div style={css(`display: grid; gap: 18px;`)}>
        {collection.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={form[field.name]}
            onChange={(value) => updateField(field.name, value)}
            notify={notify}
            folder={collection.key}
          />
        ))}
      </div>

      <div
        style={css(`
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 26px;
        `)}
      >
        <button type="button" disabled={saving} onClick={onSaveDraft} style={secondaryButtonStyle}>
          Concept opslaan
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={onPublish}
          style={primaryButtonNoMarginStyle}
        >
          {saving ? 'Opslaan...' : 'Publiceren'}
        </button>

        <button type="button" disabled={saving} onClick={onCancel} style={plainButtonStyle}>
          Annuleren
        </button>
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange, notify, folder }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadToMedia(file, folder);

      onChange(url);
      notify('success', 'Het bestand is geüpload.');
    } catch (error) {
      console.error('Upload mislukt:', error);
      notify('error', `Het bestand kon niet worden geüpload. ${error?.message || ''}`);
    }

    setUploading(false);
    event.target.value = '';
  };

  return (
    <div
      style={css(`
        display: grid;
        gap: 7px;
        font-size: 14px;
        font-weight: 700;
        color: #2C4A5E;
      `)}
    >
      <span>{field.label}</span>

      {field.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={field.rows || 4}
          placeholder={field.placeholder || ''}
          style={textareaStyle}
        />
      ) : null}

      {field.type === 'select' ? (
        <select
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          style={inputStyle}
        >
          <option value="">Kies...</option>

          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : null}

      {['text', 'number', 'date', 'password'].includes(field.type) ? (
        <input
          type={field.type === 'password' ? 'password' : field.type}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || ''}
          style={inputStyle}
        />
      ) : null}

      {field.type === 'image' || field.type === 'file' ? (
        <div style={css(`display: grid; gap: 10px;`)}>
          <input
            type="text"
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://... of upload een bestand"
            style={inputStyle}
          />

          <div style={css(`display: flex; align-items: center; gap: 12px; flex-wrap: wrap;`)}>
            <label style={uploadButtonStyle}>
              {uploading ? 'Uploaden...' : 'Bestand kiezen'}

              <input
                type="file"
                accept={field.type === 'image' ? 'image/*' : undefined}
                onChange={handleUpload}
                style={css(`display: none;`)}
              />
            </label>

            {value && field.type === 'image' ? (
              <img
                src={value}
                alt=""
                style={css(`
                  height: 46px;
                  width: 68px;
                  object-fit: cover;
                  border-radius: 9px;
                  border: 1px solid #E1EAE4;
                `)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {field.help ? (
        <span
          style={css(`
            color: #82918B;
            font-size: 12.5px;
            font-weight: 600;
            line-height: 1.5;
          `)}
        >
          {field.help}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

function MediaSection({ notify, clearMessages }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);

    const folders = ['news', 'resources', 'videos', 'courses', 'media'];

    const results = await Promise.all(
      folders.map(async (folder) => {
        const { data, error } = await supabase.storage
          .from(MEDIA_BUCKET)
          .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        if (error) return [];

        return (data || [])
          .filter((item) => item.id)
          .map((item) => ({
            ...item,
            path: `${folder}/${item.name}`,
            url: supabase.storage
              .from(MEDIA_BUCKET)
              .getPublicUrl(`${folder}/${item.name}`).data.publicUrl,
          }));
      }),
    );

    setFiles(results.flat());
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (event) => {
    const selected = Array.from(event.target.files || []);

    if (!selected.length) return;

    setUploading(true);
    clearMessages();

    try {
      await Promise.all(selected.map((file) => uploadToMedia(file, 'media')));

      notify('success', `${selected.length} bestand(en) geüpload.`);
      await load();
    } catch (error) {
      console.error('Upload mislukt:', error);
      notify('error', `Uploaden is niet gelukt. ${error?.message || ''} Controleer of de bucket "media" bestaat en of u beheerder bent.`);
    }

    setUploading(false);
    event.target.value = '';
  };

  const remove = async (file) => {
    if (!window.confirm(`"${file.name}" verwijderen?`)) return;

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([file.path]);

    if (error) {
      notify('error', 'Het bestand kon niet worden verwijderd.');
      return;
    }

    notify('success', 'Het bestand is verwijderd.');
    await load();
  };

  const isImage = (name) => /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name);

  return (
    <section>
      <div
        style={css(`
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        `)}
      >
        <div style={css(`max-width: 620px;`)}>
          <h2 style={sectionTitleStyle}>Media</h2>

          <p style={sectionIntroStyle}>
            Afbeeldingen, templates en documenten. Kopieer de link en gebruik die
            in een artikel, template of video.
          </p>
        </div>

        <label style={css(`${primaryButtonNoMarginCss} cursor: pointer;`)}>
          {uploading ? 'Uploaden...' : '+ Bestand uploaden'}

          <input type="file" multiple onChange={handleUpload} style={css(`display: none;`)} />
        </label>
      </div>

      {loading ? <div style={panelStyle}>Media laden...</div> : null}

      {!loading && files.length === 0 ? (
        <EmptyState>Er zijn nog geen bestanden geüpload.</EmptyState>
      ) : null}

      {!loading && files.length > 0 ? (
        <div
          style={css(`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 16px;
          `)}
        >
          {files.map((file) => (
            <div
              key={file.path}
              style={css(`
                padding: 14px;
                border: 1px solid #E1EAE4;
                border-radius: 16px;
                background: #FFFFFF;
                display: grid;
                gap: 10px;
              `)}
            >
              <div
                style={css(`
                  height: 108px;
                  border-radius: 10px;
                  background: #F1F5F3;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  overflow: hidden;
                `)}
              >
                {isImage(file.name) ? (
                  <img
                    src={file.url}
                    alt=""
                    style={css(`width: 100%; height: 100%; object-fit: cover;`)}
                  />
                ) : (
                  <span
                    style={css(`
                      color: #687973;
                      font-size: 13px;
                      font-weight: 800;
                      text-transform: uppercase;
                    `)}
                  >
                    {file.name.split('.').pop()}
                  </span>
                )}
              </div>

              <div
                style={css(`
                  color: #2C4A5E;
                  font-size: 13px;
                  font-weight: 700;
                  overflow-wrap: anywhere;
                `)}
              >
                {file.name}
              </div>

              <div style={css(`display: flex; gap: 8px; flex-wrap: wrap;`)}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(file.url);
                    notify('success', 'De link staat op het klembord.');
                  }}
                  style={smallButtonStyle}
                >
                  Link kopiëren
                </button>

                <button type="button" onClick={() => remove(file)} style={smallDangerStyle}>
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sleutel/waarde-secties: website-teksten en instellingen
// ---------------------------------------------------------------------------

function KeyValueSection({
  table,
  blocks,
  title,
  intro,
  user,
  notify,
  clearMessages,
  reloadContent,
  // Sommige tabellen bewaren de waarde in een andere kolom dan 'value'.
  valueColumn = 'value',
}) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase.from(table).select(`key, ${valueColumn}`);

      if (!isMounted) return;

      if (error) {
        console.error('Instellingen konden niet worden geladen:', error);
        notify('error', `De gegevens konden niet worden geladen. ${error.message || ''}`);
        setLoading(false);
        return;
      }

      setValues(
        Object.fromEntries(
          (data || []).map((row) => {
            const ruw = row[valueColumn];
            // Een booleaanse vlag tonen we als ja/nee in het keuzeveld.
            const waarde = typeof ruw === 'boolean' ? (ruw ? 'ja' : 'nee') : ruw ?? '';

            return [row.key, waarde];
          }),
        ),
      );

      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, valueColumn]);

  const save = async () => {
    setSaving(true);
    clearMessages();

    const rows = blocks
      .flatMap((block) => block.items)
      .map((item) => {
        const row = {
          key: item.key,
          [valueColumn]: valueColumn === 'aan' ? values[item.key] === 'ja' : values[item.key] ?? '',
          updated_at: new Date().toISOString(),
        };

        // Alleen de sleutel-waardetabellen van de website houden bij wie wijzigde.
        if (valueColumn === 'value') {
          row.updated_by = user?.email || 'admin';
        }

        return row;
      });

    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error('Opslaan mislukt:', error);
      notify('error', `De wijzigingen konden niet worden opgeslagen. ${error.message || ''}`);
      setSaving(false);
      return;
    }

    notify('success', 'De wijzigingen zijn opgeslagen.');
    setSaving(false);

    if (reloadContent) reloadContent();
  };

  return (
    <section>
      <div style={css(`margin-bottom: 24px; max-width: 660px;`)}>
        <h2 style={sectionTitleStyle}>{title}</h2>
        <p style={sectionIntroStyle}>{intro}</p>
      </div>

      {loading ? (
        <div style={panelStyle}>Gegevens laden...</div>
      ) : (
        <div style={css(`display: grid; gap: 18px;`)}>
          {blocks.map((block) => (
            <div key={block.title} style={panelStyle}>
              <h3 style={subsectionTitleStyle}>{block.title}</h3>

              {block.description ? (
                <p
                  style={css(`
                    margin: 6px 0 0;
                    color: #536460;
                    font-size: 14px;
                    line-height: 1.6;
                  `)}
                >
                  {block.description}
                </p>
              ) : null}

              <div style={css(`display: grid; gap: 16px; margin-top: 20px;`)}>
                {block.items.map((item) => (
                  <FieldInput
                    key={item.key}
                    field={{
                      name: item.key,
                      label: item.label,
                      type: item.type || 'text',
                      options: item.options,
                      placeholder: item.placeholder || item.fallback || '',
                      rows: 3,
                    }}
                    value={values[item.key] ?? ''}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, [item.key]: value }))
                    }
                    notify={notify}
                    folder="media"
                  />
                ))}
              </div>
            </div>
          ))}

          <div>
            <button type="button" disabled={saving} onClick={save} style={primaryButtonNoMarginStyle}>
              {saving ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Aanvragen en leden
// ---------------------------------------------------------------------------

function ApplicationsSection({ applications, processingId, reviewApplication }) {
  return (
    <section>
      <h2 style={sectionTitleStyle}>Lidmaatschapsaanvragen</h2>

      <p style={sectionIntroStyle}>
        Bekijk, keur goed of wijs openstaande aanvragen af.
      </p>

      {applications.length === 0 ? (
        <EmptyState>Er zijn momenteel geen openstaande aanvragen.</EmptyState>
      ) : (
        <div style={css(`display: grid; gap: 16px; margin-top: 28px;`)}>
          {applications.map((application) => {
            const fullName =
              `${application.first_name || ''} ${application.last_name || ''}`.trim() ||
              'Naam onbekend';

            const isProcessing = processingId === application.id;

            return (
              <article key={application.id} style={panelStyle}>
                <h3
                  style={css(`
                    margin: 0 0 4px;
                    font-family: 'Newsreader', serif;
                    font-size: 24px;
                    color: #2C4A5E;
                  `)}
                >
                  {fullName}
                </h3>

                <p style={css(`margin: 0 0 14px; color: #536460;`)}>
                  {application.email} · {formatMemberType(application.member_type)} ·
                  aangemeld {formatDate(application.created_at)}
                </p>

                <p style={css(`margin: 0; color: #536460; line-height: 1.65;`)}>
                  {application.motivation || 'Geen motivatie ingevuld.'}
                </p>

                <div style={css(`display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap;`)}>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => reviewApplication(application, 'approved')}
                    style={primaryButtonNoMarginStyle}
                  >
                    Goedkeuren
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => reviewApplication(application, 'rejected')}
                    style={dangerButtonStyle}
                  >
                    Afwijzen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MembersSection({
  memberSearch,
  setMemberSearch,
  members,
  processingId,
  updateMember,
  currentUserId,
}) {
  return (
    <section>
      <h2 style={sectionTitleStyle}>Leden</h2>

      <p style={sectionIntroStyle}>
        Overzicht van alle goedgekeurde leden. Hier wijst u ook beheerders aan.
      </p>

      <input
        type="search"
        value={memberSearch}
        onChange={(event) => setMemberSearch(event.target.value)}
        placeholder="Zoek op naam, e-mail of type..."
        style={css(`
          width: 100%;
          max-width: 520px;
          margin: 24px 0;
          padding: 14px 16px;
          border: 1px solid #D5E0D9;
          border-radius: 12px;
          font-family: inherit;
        `)}
      />

      {members.length === 0 ? (
        <EmptyState>Geen leden gevonden.</EmptyState>
      ) : (
        <div style={css(`display: grid; gap: 12px;`)}>
          {members.map((member) => {
            const isAdminMember = member.role === 'admin';
            const isSelf = member.id === currentUserId;

            return (
              <div
                key={member.id}
                style={css(`
                  ${panelCss}
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 18px;
                  flex-wrap: wrap;
                `)}
              >
                <div style={css(`min-width: 220px;`)}>
                  <div style={css(`color: #2C4A5E; font-weight: 800;`)}>
                    {`${member.first_name || ''} ${member.last_name || ''}`.trim() ||
                      'Naam onbekend'}
                  </div>

                  <div style={css(`color: #536460; font-size: 14px; margin-top: 3px;`)}>
                    {member.email} · {formatMemberType(member.member_type)}
                    {isAdminMember ? ' · beheerder' : ''}
                  </div>
                </div>

                <div style={css(`display: flex; gap: 10px; flex-wrap: wrap;`)}>
                  <button
                    type="button"
                    disabled={processingId === member.id || isSelf}
                    onClick={() =>
                      updateMember(
                        member,
                        { role: isAdminMember ? 'member' : 'admin' },
                        isAdminMember
                          ? 'De beheerdersrechten zijn ingetrokken.'
                          : 'Dit lid is nu beheerder.',
                      )
                    }
                    style={secondaryButtonStyle}
                  >
                    {isAdminMember ? 'Beheerder af' : 'Maak beheerder'}
                  </button>

                  <button
                    type="button"
                    disabled={processingId === member.id || isSelf}
                    onClick={() =>
                      updateMember(
                        member,
                        { status: 'rejected', approved_at: null },
                        'Het lidmaatschap is ingetrokken.',
                      )
                    }
                    style={dangerButtonStyle}
                  >
                    Lidmaatschap intrekken
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Kleine bouwstenen
// ---------------------------------------------------------------------------

function QuickActionCard({ title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={css(`
        padding: 20px;
        border: 1px solid #E1EAE4;
        border-radius: 16px;
        background: #FFFFFF;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
      `)}
    >
      <div style={css(`color: #2C4A5E; font-size: 15px; font-weight: 800;`)}>
        {title}
      </div>

      <div
        style={css(`
          margin-top: 6px;
          color: #687973;
          font-size: 13px;
          line-height: 1.5;
        `)}
      >
        {description}
      </div>
    </button>
  );
}

function DashboardCard({ number, label, helper, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={css(`
        text-align: left;
        padding: 24px;
        border: 1px solid #E1EAE4;
        border-radius: 18px;
        background: #FFFFFF;
        font-family: inherit;
        cursor: ${onClick ? 'pointer' : 'default'};
      `)}
    >
      <div
        style={css(`
          margin-bottom: 8px;
          font-family: 'Newsreader', serif;
          font-size: clamp(28px, 4.6vw, 40px);
          font-weight: 600;
          color: #2C4A5E;
        `)}
      >
        {number}
      </div>

      <div style={css(`color: #2C4A5E; font-size: 14px; font-weight: 800;`)}>
        {label}
      </div>

      {helper ? (
        <div
          style={css(`
            margin-top: 5px;
            color: #82918B;
            font-size: 12px;
            font-weight: 600;
          `)}
        >
          {helper}
        </div>
      ) : null}
    </button>
  );
}

function EmptyState({ children }) {
  return (
    <div
      style={css(`
        margin-top: 8px;
        padding: 26px;
        border-radius: 16px;
        background: #F1F5F3;
        color: #536460;
      `)}
    >
      {children}
    </div>
  );
}

function formatMemberType(type) {
  if (type === 'zzp') return 'Zelfstandig fondsenwerver';
  if (type === 'org') return 'Organisatie';
  if (type === 'orient') return 'Oriënterend';

  return type || 'Niet ingevuld';
}

// De gedeelde paneel-/knop-/veldstijlen (panelStyle, primaryButtonNoMarginStyle,
// secondaryButtonStyle, dangerButtonStyle, smallButtonStyle, inputStyle,
// textareaStyle, enzovoort) staan sinds Fase 2 in ./shared/adminStyles.js —
// dezelfde waarden, nu op één plek zodat AdminFunders/AdminDeadlines ze kunnen
// hergebruiken zonder duplicatie.
