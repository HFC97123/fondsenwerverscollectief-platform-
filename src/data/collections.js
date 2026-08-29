// Declaratieve definities van alle beheerbare onderdelen.
// De beheeromgeving bouwt hier haar formulieren en lijsten uit op; de website
// gebruikt de mapper-functies om gepubliceerde items in de bestaande
// paginaopmaak te tonen.

export const MEDIA_BUCKET = 'media';

const MONTHS = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

const MONTHS_FULL = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

export function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatLongDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return `${date.getDate()} ${MONTHS_FULL[date.getMonth()]} ${date.getFullYear()}`;
}

export function createSlug(title) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Artikeltekst -> blokken zoals de artikelpagina ze verwacht.
// Een regel die met # begint wordt een tussenkop.
export function parseArticleBody(content) {
  const sections = [];

  let current = { h: '', paras: [] };

  String(content || '')
    .split(/\n{2,}/)
    .forEach((block) => {
      const text = block.trim();

      if (!text) return;

      if (/^#{1,3}\s+/.test(text)) {
        if (current.h || current.paras.length) {
          sections.push(current);
        }

        current = {
          h: text.replace(/^#{1,3}\s+/, ''),
          paras: [],
        };

        return;
      }

      current.paras.push(text);
    });

  if (current.h || current.paras.length) {
    sections.push(current);
  }

  return sections.length ? sections : [{ h: '', paras: [] }];
}

function splitTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export const STATUS_LABELS = {
  draft: 'Concept',
  published: 'Gepubliceerd',
};

// ---------------------------------------------------------------------------
// Collecties
// ---------------------------------------------------------------------------

export const collections = [
  {
    key: 'news',
    table: 'news_articles',
    label: 'Nieuws',
    singular: 'artikel',
    newLabel: '+ Nieuw artikel',
    intro: 'Schrijf, bewerk en publiceer nieuwsartikelen. Gepubliceerde artikelen staan direct op Actueel en op de homepage.',
    order: { column: 'created_at', ascending: false },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      { name: 'tag', label: 'Categorie', type: 'text', placeholder: 'Subsidies, Regelgeving, Onderzoek...' },
      { name: 'intro', label: 'Intro', type: 'textarea', rows: 3, help: 'Korte samenvatting op de overzichtspagina.' },
      {
        name: 'content',
        label: 'Artikeltekst',
        type: 'textarea',
        rows: 14,
        help: 'Laat een lege regel tussen alinea\'s. Begin een regel met # voor een tussenkop.',
      },
      { name: 'author', label: 'Auteur', type: 'text' },
      { name: 'cover_image', label: 'Afbeelding', type: 'image' },
    ],
    title: (row) => row.title,
    subtitle: (row) => row.intro || 'Geen intro ingevuld.',
    meta: (row) => [row.tag, formatDate(row.published_at || row.created_at)],
    mapForSite: (row) => ({
      id: row.slug || row.id,
      tag: row.tag || 'Nieuws',
      date: formatDate(row.published_at || row.created_at),
      title: row.title,
      excerpt: row.intro || '',
      cover: row.cover_image || '',
      author: row.author || 'Het Fondsenwervers Collectief',
      body: parseArticleBody(row.content),
    }),
  },

  {
    key: 'videos',
    table: 'videos',
    label: "Video's",
    singular: 'video',
    newLabel: '+ Nieuwe video',
    intro: "Video's voor de oriëntatiepagina. Upload een videobestand of gebruik een YouTube- of Vimeo-link. Cursusvideo's horen bij Basiscursus.",
    order: { column: 'sort_order', ascending: true },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      { name: 'description', label: 'Korte omschrijving', type: 'textarea', rows: 3 },
      { name: 'duration', label: 'Duur', type: 'text', placeholder: '6:12' },
      {
        name: 'level',
        label: 'Niveau',
        type: 'select',
        options: ['Introductie', 'Basis', 'Verdieping'],
      },
      {
        name: 'url',
        label: 'Videolink of videobestand',
        type: 'file',
        help: 'Plak een YouTube- of Vimeo-link, of upload een MP4 met "Bestand kiezen".',
      },
      { name: 'sort_order', label: 'Volgorde', type: 'number' },
    ],
    title: (row) => row.title,
    subtitle: (row) => row.description || '',
    meta: (row) => [row.level, row.duration],
    mapForSite: (row) => ({
      title: row.title,
      duration: row.duration || '',
      level: row.level || 'Introductie',
      url: row.url || '',
      description: row.description || '',
    }),
  },

  {
    key: 'resources',
    table: 'resources',
    label: 'Templates',
    singular: 'template',
    newLabel: '+ Nieuwe template',
    intro: 'Praktijkgidsen en templates die leden kunnen downloaden op de netwerkpagina.',
    order: { column: 'sort_order', ascending: true },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      {
        name: 'type',
        label: 'Soort',
        type: 'select',
        options: ['Template', 'Praktijkgids', 'Checklist', 'Voorbeeld'],
      },
      {
        name: 'format',
        label: 'Bestandstype',
        type: 'select',
        options: ['DOCX', 'XLSX', 'PDF', 'PPTX', 'ZIP'],
      },
      { name: 'description', label: 'Omschrijving', type: 'textarea', rows: 3 },
      { name: 'file_url', label: 'Bestand', type: 'file', required: true },
      { name: 'sort_order', label: 'Volgorde', type: 'number' },
    ],
    title: (row) => row.title,
    subtitle: (row) => row.description || '',
    meta: (row) => [row.type, row.format],
    mapForSite: (row) => ({
      type: row.type || 'Template',
      format: row.format || '',
      title: row.title,
      url: row.file_url || '',
      description: row.description || '',
    }),
  },

  {
    key: 'sessions',
    table: 'sessions',
    label: 'Agenda',
    singular: 'bijeenkomst',
    newLabel: '+ Nieuwe bijeenkomst',
    intro: 'Intervisies en werksessies op de netwerkpagina.',
    order: { column: 'session_date', ascending: true },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      { name: 'session_date', label: 'Datum', type: 'date', required: true },
      { name: 'session_time', label: 'Tijd', type: 'text', placeholder: '10:00' },
      { name: 'host', label: 'Onder leiding van', type: 'text', placeholder: 'o.l.v. ...' },
      { name: 'mode', label: 'Vorm', type: 'select', options: ['Online', 'Utrecht', 'Amsterdam', 'Hybride'] },
      { name: 'signup_url', label: 'Aanmeldlink', type: 'text', placeholder: 'https://...' },
    ],
    title: (row) => row.title,
    subtitle: (row) => [row.session_time, row.host].filter(Boolean).join(' · '),
    meta: (row) => [formatDate(row.session_date), row.mode],
    mapForSite: (row) => {
      const date = row.session_date ? new Date(row.session_date) : null;

      return {
        day: date ? String(date.getDate()).padStart(2, '0') : '',
        month: date ? MONTHS[date.getMonth()] : '',
        title: row.title,
        time: row.session_time || '',
        host: row.host || '',
        mode: row.mode || 'Online',
        url: row.signup_url || '',
      };
    },
  },

  {
    key: 'blog',
    table: 'blog_posts',
    label: 'Blog',
    singular: 'blog',
    newLabel: '+ Nieuwe blog',
    intro: 'Kennisdeling en praktijkverhalen op de netwerkpagina.',
    order: { column: 'created_at', ascending: false },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      { name: 'tag', label: 'Categorie', type: 'text', placeholder: 'Kennisdeling, Praktijk...' },
      { name: 'excerpt', label: 'Samenvatting', type: 'textarea', rows: 3 },
      { name: 'content', label: 'Tekst', type: 'textarea', rows: 12 },
      { name: 'author', label: 'Auteur', type: 'text' },
      { name: 'author_role', label: 'Functie auteur', type: 'text', placeholder: 'Fondsenwerver' },
    ],
    title: (row) => row.title,
    subtitle: (row) => row.excerpt || '',
    meta: (row) => [row.tag, row.author],
    mapForSite: (row) => ({
      tag: row.tag || 'Kennisdeling',
      title: row.title,
      excerpt: row.excerpt || '',
      author: row.author || 'Redactie',
      role: row.author_role || '',
    }),
  },

  {
    key: 'vacancies',
    table: 'vacancies',
    label: 'Vacatures',
    singular: 'vacature',
    newLabel: '+ Nieuwe vacature',
    intro: 'Vacatures uit de sector. Publiceer een vacature om die op de vacaturepagina te laten zien; concepten blijven onzichtbaar voor bezoekers.',
    order: { column: 'created_at', ascending: false },
    fields: [
      { name: 'title', label: 'Functietitel', type: 'text', required: true },
      { name: 'organisation', label: 'Organisatie', type: 'text', required: true },
      { name: 'location', label: 'Locatie', type: 'text', placeholder: 'Utrecht' },
      { name: 'hours', label: 'Uren', type: 'text', placeholder: '32 uur' },
      { name: 'salary', label: 'Salarisindicatie', type: 'text' },
      { name: 'deadline', label: 'Sluitingsdatum', type: 'date' },
      { name: 'summary', label: 'Korte omschrijving', type: 'textarea', rows: 4 },
      { name: 'source_url', label: 'Link naar de vacature', type: 'text', placeholder: 'https://...' },
      { name: 'source_name', label: 'Bron of dienstverband', type: 'text', placeholder: 'Parttime' },
    ],
    title: (row) => row.title,
    subtitle: (row) => [row.organisation, row.location].filter(Boolean).join(' · '),
    meta: (row) => [row.hours, row.deadline ? `sluit ${formatDate(row.deadline)}` : ''],
    mapForSite: (row) => ({
      id: row.id,
      title: row.title,
      org: row.organisation,
      location: row.location || 'Nederland',
      type: row.source_name || 'Vacature',
      tags: [row.hours, row.salary].filter(Boolean),
      url: row.source_url || '',
      summary: row.summary || '',
    }),
  },

  {
    key: 'courses',
    table: 'course_modules',
    label: 'Basiscursus',
    singular: 'module',
    newLabel: '+ Nieuwe module',
    intro: 'De modules van de Basiscursus Fondsenwerving. Per module uploadt u hier de video en het lesmateriaal. Gepubliceerde modules staan op de cursuspagina.',
    order: { column: 'sort_order', ascending: true },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      { name: 'description', label: 'Omschrijving', type: 'textarea', rows: 4 },
      { name: 'level', label: 'Niveau', type: 'select', options: ['Beginner', 'Basis', 'Gevorderd'] },
      { name: 'duration', label: 'Duur', type: 'text', placeholder: '45 min' },
      {
        name: 'video_url',
        label: 'Video van de module',
        type: 'file',
        help: 'Upload hier het videobestand (MP4) met "Bestand kiezen", of plak een YouTube- of Vimeo-link.',
      },
      {
        name: 'material_url',
        label: 'Lesmateriaal (PDF, Word of Excel)',
        type: 'file',
        help: 'Upload hier het werkboek, de hand-out of het invulformulier bij deze module. Meerdere bestanden? Upload ze onder Media en verwijs in de omschrijving naar de links.',
      },
      { name: 'sort_order', label: 'Volgorde', type: 'number' },
    ],
    title: (row) => row.title,
    subtitle: (row) => row.description || '',
    meta: (row) => [row.level, row.duration],
    mapForSite: (row) => ({
      title: row.title,
      description: row.description || '',
      level: row.level || 'Basis',
      duration: row.duration || '',
      videoUrl: row.video_url || '',
      materialUrl: row.material_url || '',
    }),
  },

  {
    key: 'masterclasses',
    table: 'masterclasses',
    label: 'Masterclasses',
    singular: 'masterclass',
    newLabel: '+ Nieuwe masterclass',
    intro: 'Verdiepende masterclasses rond een actueel thema. Gepubliceerde masterclasses staan op de cursuspagina.',
    order: { column: 'session_date', ascending: true },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      { name: 'theme', label: 'Thema', type: 'text' },
      { name: 'speaker', label: 'Gastspreker', type: 'text' },
      { name: 'session_date', label: 'Datum', type: 'date' },
      { name: 'location', label: 'Locatie', type: 'text', placeholder: 'Online of Utrecht' },
      { name: 'description', label: 'Omschrijving', type: 'textarea', rows: 4 },
      { name: 'price', label: 'Prijs', type: 'text', placeholder: '€ 145' },
      { name: 'signup_url', label: 'Aanmeldlink', type: 'text', placeholder: 'https://...' },
    ],
    title: (row) => row.title,
    subtitle: (row) => row.description || '',
    meta: (row) => [row.speaker, formatDate(row.session_date)],
    mapForSite: (row) => ({
      title: row.title,
      theme: row.theme || '',
      speaker: row.speaker || '',
      date: formatLongDate(row.session_date),
      location: row.location || '',
      description: row.description || '',
      price: row.price || '',
      url: row.signup_url || '',
    }),
  },
  {
    key: 'faq',
    table: 'kompas_faq',
    label: 'Veelgestelde vragen',
    singular: 'vraag',
    newLabel: '+ Nieuwe vraag',
    intro: 'De vragen en antwoorden onderaan de Subsidie Kompas-pagina. Staat hier niets gepubliceerd, dan blijft de goedgekeurde tekst staan.',
    order: { column: 'sortering', ascending: true },
    fields: [
      { name: 'vraag', label: 'Vraag', type: 'text', required: true },
      { name: 'antwoord', label: 'Antwoord', type: 'textarea', rows: 8 },
      { name: 'sectie', label: 'Onderdeel', type: 'text', placeholder: 'Algemeen, Abonnementen, Privacy...' },
      { name: 'sortering', label: 'Positie', type: 'text', help: 'Lager getal staat hoger in de lijst.' },
    ],
    title: (row) => row.vraag,
    subtitle: (row) => row.antwoord || 'Nog geen antwoord ingevuld.',
    meta: (row) => [row.sectie || 'Algemeen'],
    mapForSite: (row) => ({ title: row.sectie || 'Algemeen', q: row.vraag, a: row.antwoord || '' }),
  },

  {
    key: 'stappen',
    table: 'kompas_stappen',
    label: 'Stappen',
    singular: 'stap',
    newLabel: '+ Nieuwe stap',
    intro: 'De stappen op de pagina Hoe het werkt.',
    order: { column: 'sortering', ascending: true },
    fields: [
      { name: 'titel', label: 'Titel', type: 'text', required: true },
      { name: 'tekst', label: 'Toelichting', type: 'textarea', rows: 5 },
      { name: 'nummer', label: 'Nummer', type: 'text', placeholder: '01' },
      { name: 'sortering', label: 'Positie', type: 'text' },
    ],
    title: (row) => row.titel,
    subtitle: (row) => row.tekst || 'Nog geen toelichting.',
    meta: (row) => [row.nummer || ''],
    mapForSite: (row) => ({ n: row.nummer || '', title: row.titel, body: row.tekst || '' }),
  },

  {
    key: 'startsuggesties',
    table: 'ai_startsuggesties',
    label: 'Startsuggesties',
    singular: 'suggestie',
    newLabel: '+ Nieuwe suggestie',
    intro: 'De voorbeeldvragen die een lid onder het chatvenster ziet.',
    order: { column: 'sortering', ascending: true },
    fields: [
      { name: 'tekst', label: 'Suggestie', type: 'text', required: true },
      { name: 'sortering', label: 'Positie', type: 'text' },
    ],
    title: (row) => row.tekst,
    subtitle: () => '',
    meta: () => [],
    mapForSite: (row) => row.tekst,
  },

  {
    key: 'paginas',
    table: 'paginas',
    label: "Pagina's en SEO",
    singular: 'pagina',
    newLabel: '+ Nieuwe pagina',
    intro: 'Titel, SEO en plaats in de navigatie per pagina. Het pad is het adres zonder voorloopteken, bijvoorbeeld /actueel.',
    order: { column: 'navigatie_sortering', ascending: true },
    fields: [
      { name: 'slug', label: 'Pad', type: 'text', required: true, placeholder: '/actueel' },
      { name: 'titel', label: 'Paginatitel', type: 'text' },
      { name: 'seo_titel', label: 'SEO-titel', type: 'text', help: 'Wat in het tabblad en in Google staat.' },
      { name: 'seo_omschrijving', label: 'SEO-omschrijving', type: 'textarea', rows: 3 },
      { name: 'seo_afbeelding', label: 'Deelafbeelding', type: 'image' },
      { name: 'navigatie_label', label: 'Label in het menu', type: 'text' },
      { name: 'navigatie_sortering', label: 'Positie in het menu', type: 'text' },
    ],
    title: (row) => row.titel || row.slug,
    subtitle: (row) => row.seo_omschrijving || 'Nog geen SEO-omschrijving.',
    meta: (row) => [row.slug],
    mapForSite: (row) => row,
  },
];

export function getCollection(key) {
  return collections.find((collection) => collection.key === key) || null;
}

// Welke contextsleutel op de website hoort bij welke collectie
export const SITE_KEYS = {
  news: 'newsFromDatabase',
  videos: 'videosFromDatabase',
  resources: 'resourcesFromDatabase',
  sessions: 'sessionsFromDatabase',
  blog: 'blogFromDatabase',
  vacancies: 'vacanciesFromDatabase',
  courses: 'courseModules',
  masterclasses: 'masterclasses',
};

// ---------------------------------------------------------------------------
// Website-teksten die via de Website-tab te wijzigen zijn
// ---------------------------------------------------------------------------

// Systeemteksten van de assistent. Tabel ai_prompts, sleutel-waarde.
export const aiPromptBlocks = [
  {
    page: 'Subsidie Kompas',
    description: 'De systeemtekst die de assistent meekrijgt bij elke vraag.',
    items: [
      { key: 'kompas.system', label: 'Systeemtekst Subsidie Kompas', type: 'textarea' },
      { key: 'kompas.premium_addendum', label: 'Aanvulling voor Premium-leden', type: 'textarea' },
    ],
  },
  {
    page: 'Collie',
    description: 'De assistent op de publieke website.',
    items: [{ key: 'collie.system', label: 'Systeemtekst Collie', type: 'textarea' }],
  },
];

// Onderdelen aan of uit zetten zonder code te wijzigen. Tabel feature_flags.
export const featureFlagBlocks = [
  {
    page: 'Onderdelen',
    description: 'Zet een onderdeel uit als het nog niet klaar is om te tonen.',
    items: [
      { key: 'deadlines.zichtbaar', label: 'Deadlines-pagina zichtbaar', type: 'select', options: ['ja', 'nee'] },
      { key: 'ledenlijst.zichtbaar', label: 'Ledenlijst zichtbaar', type: 'select', options: ['ja', 'nee'] },
      { key: 'documentatie.zichtbaar', label: 'Documentatie zichtbaar', type: 'select', options: ['ja', 'nee'] },
      { key: 'chat.website', label: 'Chat op de website', type: 'select', options: ['ja', 'nee'] },
      { key: 'registratie.open', label: 'Aanmelden mogelijk', type: 'select', options: ['ja', 'nee'] },
    ],
  },
];

export const siteTextBlocks = [
  {
    page: 'Actueel',
    items: [
      { key: 'actueel.eyebrow', label: 'Label boven de titel', type: 'text', fallback: 'Actueel' },
      { key: 'actueel.title', label: 'Titel', type: 'text', fallback: 'Nieuws uit subsidieland' },
      {
        key: 'actueel.intro',
        label: 'Introductietekst',
        type: 'textarea',
        fallback:
          'Actuele ontwikkelingen, regelgeving en verdiepende artikelen uit de wereld van fondsen en subsidies.',
      },
    ],
  },
  {
    page: 'Cursussen',
    items: [
      {
        key: 'cursussen.notice',
        label: 'Melding bovenaan de pagina',
        type: 'textarea',
        fallback:
          'Dit is een voorbeeldpagina. De Basiscursus Fondsenwerving en de verdiepende masterclass zijn nog in ontwikkeling en komen binnenkort beschikbaar.',
      },
      { key: 'cursussen.notice_label', label: 'Labeltekst bij de melding', type: 'text', fallback: 'In ontwikkeling' },
    ],
  },
  {
    page: 'Contact',
    items: [
      { key: 'contact.email', label: 'E-mailadres', type: 'text', fallback: 'info@fondsenwerverscollectief.nl' },
      { key: 'contact.phone', label: 'Telefoonnummer', type: 'text', fallback: '' },
    ],
  },
];

export const settingBlocks = [
  {
    title: 'Subsidie Kompas',
    description: 'Koppeling met de Subsidie Kompas-omgeving.',
    items: [
      { key: 'kompas.api_url', label: 'API-adres', type: 'text', placeholder: 'https://...' },
      { key: 'kompas.api_key', label: 'API-sleutel', type: 'password' },
      { key: 'kompas.model', label: 'Model', type: 'text', placeholder: 'claude-sonnet-4-5' },
      {
        key: 'kompas.enabled',
        label: 'Koppeling actief',
        type: 'select',
        options: ['ja', 'nee'],
      },
    ],
  },
  {
    title: 'Aanmeldingen',
    description: 'Hoe nieuwe lidmaatschapsaanvragen worden behandeld.',
    items: [
      {
        key: 'members.auto_approve',
        label: 'Aanvragen automatisch goedkeuren',
        type: 'select',
        options: ['nee', 'ja'],
      },
      { key: 'members.notify_email', label: 'Meldingen naar e-mailadres', type: 'text' },
    ],
  },
  {
    title: 'Formulieren',
    description: 'Waar het contactformulier en de nieuwsbrief naartoe sturen.',
    items: [
      { key: 'forms.contact_endpoint', label: 'Contactformulier-endpoint', type: 'text', placeholder: 'https://formspree.io/f/...' },
      { key: 'forms.newsletter_endpoint', label: 'Nieuwsbrief-endpoint', type: 'text' },
    ],
  },
];

export { splitTags };
