import React from 'react';
import { css } from '../../shared/lib/css.js';

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  applicationsCount,
  membersCount,
  counts = {},
  goHome,
}) {
  const sections = [
    {
      title: 'Algemeen',
      items: [{ key: 'dashboard', label: 'Dashboard' }],
    },
    {
      title: 'Content',
      items: [
        { key: 'website', label: 'Website' },
        { key: 'news', label: 'Nieuws', count: counts.news },
        { key: 'blog', label: 'Blog', count: counts.blog },
        { key: 'videos', label: "Video's", count: counts.videos },
        { key: 'resources', label: 'Templates', count: counts.resources },
        { key: 'sessions', label: 'Agenda', count: counts.sessions },
        { key: 'media', label: 'Media' },
        { key: 'paginas', label: "Pagina's en SEO", count: counts.paginas },
      ],
    },
    {
      title: 'Opleidingen',
      items: [
        { key: 'courses', label: 'Basiscursus', count: counts.courses },
        { key: 'masterclasses', label: 'Masterclasses', count: counts.masterclasses },
      ],
    },
    {
      title: 'Community',
      items: [
        { key: 'applications', label: 'Aanvragen', count: applicationsCount },
        { key: 'members', label: 'Leden', count: membersCount },
        { key: 'abonnementen', label: 'Abonnementen' },
      ],
    },
    {
      title: 'Platform',
      items: [
        { key: 'vacancies', label: 'Vacatures', count: counts.vacancies },
        { key: 'deadlines', label: 'Deadlines', count: counts.deadlines },
        { key: 'subsidie-kompas', label: 'Subsidie Kompas' },
        { key: 'faq', label: 'Veelgestelde vragen', count: counts.faq },
        { key: 'stappen', label: 'Stappen', count: counts.stappen },
        { key: 'startsuggesties', label: 'Startsuggesties', count: counts.startsuggesties },
      ],
    },
    {
      title: 'Systeem',
      items: [
        { key: 'settings', label: 'Instellingen' },
        { key: 'prompts', label: 'AI-teksten' },
        { key: 'flags', label: 'Onderdelen' },
        { key: 'analytics', label: 'Analytics en logboek' },
      ],
    },
  ];

  const allItems = sections.flatMap((section) => section.items);

  return (
    <>
      {/* Smalle schermen: één keuzelijst in plaats van een zijbalk */}
      <div
        className="fw-admin-mobile-nav"
        style={css(`
          display: none;
          width: 100%;
          margin-bottom: 8px;
        `)}
      >
        <select
          value={activeTab}
          onChange={(event) => setActiveTab(event.target.value)}
          style={css(`
            width: 100%;
            box-sizing: border-box;
            padding: 13px 14px;
            border: 1px solid #D5E0D9;
            border-radius: 12px;
            background: #FFFFFF;
            font-family: inherit;
            font-size: 15px;
            font-weight: 700;
            color: #2C4A5E;
          `)}
        >
          {allItems.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
              {typeof item.count === 'number' ? ` (${item.count})` : ''}
            </option>
          ))}
        </select>
      </div>

      <aside
        className="fw-admin-sidebar"
        style={css(`
          width: 250px;
          flex: 0 0 250px;
          padding: 28px 20px;
          box-sizing: border-box;
          border: 1px solid #E1EAE4;
          border-radius: 22px;
          background: #FFFFFF;
        `)}
      >
        <button
          type="button"
          onClick={goHome}
          style={css(`
            padding: 0;
            border: none;
            background: transparent;
            text-align: left;
            cursor: pointer;
          `)}
        >
          <div
            style={css(`
              color: #4E9A6C;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.1em;
              text-transform: uppercase;
            `)}
          >
            Het Fondsenwervers
          </div>

          <div
            style={css(`
              margin-top: 4px;
              font-family: 'Newsreader', serif;
              font-size: 25px;
              font-weight: 600;
              color: #2C4A5E;
            `)}
          >
            Collectief
          </div>
        </button>

        <div style={css(`margin: 24px 0; height: 1px; background: #E6ECE8;`)} />

        <nav>
          {sections.map((section) => (
            <div key={section.title} style={css(`margin-bottom: 22px;`)}>
              <div
                style={css(`
                  margin: 0 10px 8px;
                  color: #91A09A;
                  font-size: 10px;
                  font-weight: 800;
                  letter-spacing: 0.1em;
                  text-transform: uppercase;
                `)}
              >
                {section.title}
              </div>

              <div style={css(`display: grid; gap: 4px;`)}>
                {section.items.map((item) => {
                  const active = activeTab === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      style={css(`
                        width: 100%;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 10px;
                        padding: 10px 12px;
                        border: none;
                        border-radius: 10px;
                        background: ${active ? '#EAF4EE' : 'transparent'};
                        color: ${active ? '#2F6D47' : '#536460'};
                        font-family: inherit;
                        font-size: 13px;
                        font-weight: ${active ? '800' : '600'};
                        text-align: left;
                        cursor: pointer;
                      `)}
                    >
                      <span>{item.label}</span>

                      {typeof item.count === 'number' ? (
                        <span
                          style={css(`
                            min-width: 24px;
                            padding: 3px 7px;
                            box-sizing: border-box;
                            border-radius: 999px;
                            background: #F0F4F2;
                            font-size: 11px;
                            font-weight: 800;
                            text-align: center;
                          `)}
                        >
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          type="button"
          onClick={goHome}
          style={css(`
            margin-top: 12px;
            padding: 10px 12px;
            border: none;
            background: transparent;
            color: #4E9A6C;
            font-family: inherit;
            font-weight: 700;
            cursor: pointer;
          `)}
        >
          ← Naar website
        </button>
      </aside>
    </>
  );
}
