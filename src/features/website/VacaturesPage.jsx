import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { supabase } from '../../data/client.js';
import { useApp } from './WebsiteProvider.jsx';

export default function VacaturesPage() {
  const app = useApp();

  const {
    isVacatures,
    isLoggedIn,
    goNetwerk,
    hideContact,
    vacForm,
    memberVacancies,
    hasMemberVacancies,
    vacPosted,
    onVacTitle,
    onVacOrg,
    onVacLocation,
    onVacTag,
    submitVacancy,
  } = app;

  const [sectorVacancies, setSectorVacancies] = useState([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(false);
  const [vacanciesError, setVacanciesError] = useState('');

  useEffect(() => {
    if (!isVacatures) return;

    let isMounted = true;

    const loadVacancies = async () => {
      setVacanciesLoading(true);
      setVacanciesError('');

      const { data, error } = await supabase
        .from('vacancies')
        .select(`
          id,
          title,
          organisation,
          location,
          hours,
          salary,
          deadline,
          summary,
          source_url,
          source_name,
          source_type,
          status,
          published_at,
          created_at
        `)
        .eq('status', 'published')
        .order('published_at', {
          ascending: false,
          nullsFirst: false,
        });

      if (!isMounted) return;

      if (error) {
        console.error(
          'Vacatures konden niet worden geladen:',
          error,
        );

        setSectorVacancies([]);
        setVacanciesError(
          'De vacatures konden op dit moment niet worden geladen.',
        );
        setVacanciesLoading(false);
        return;
      }

      const formattedVacancies = (data || []).map((vacancy) => {
        const tags = [];

        if (vacancy.hours) {
          tags.push(vacancy.hours);
        }

        if (vacancy.salary) {
          tags.push(vacancy.salary);
        }

        if (vacancy.deadline) {
          tags.push(
            `Sluit ${formatDate(vacancy.deadline)}`,
          );
        }

        return {
          id: vacancy.id,
          title: vacancy.title,
          org: vacancy.organisation,
          location: vacancy.location || 'Nederland',
          type: vacancy.source_name || 'Vacature',
          tags,
          url: vacancy.source_url,
          summary: vacancy.summary,
        };
      });

      setSectorVacancies(formattedVacancies);
      setVacanciesLoading(false);
    };

    loadVacancies();

    return () => {
      isMounted = false;
    };
  }, [isVacatures]);

  return (
    <>
      {isVacatures ? (
        <>
          <div data-screen-label="Vacatures">
            <div
              style={css(`
                max-width: 980px;
                margin: 0 auto;
                padding: 60px 32px 40px;
                text-align: center;
              `)}
            >
              <div
                style={css(`
                  display: inline-block;
                  padding: 7px 16px;
                  border-radius: 999px;
                  background: #EAF4EE;
                  color: #2C4A5E;
                  font-size: 14px;
                  font-weight: 700;
                  margin-bottom: 26px;
                `)}
              >
                Vacatures & oproepen
              </div>

              <div
                style={css(`
                  font-family: 'Newsreader', serif;
                  font-size: clamp(27px, 5.5vw, 44px);
                  font-weight: 600;
                  color: #2C4A5E;
                  line-height: 1.2;
                  margin-bottom: 20px;
                `)}
              >
                Werk in fondsenwerving
              </div>

              <div
                style={css(`
                  font-size: 18px;
                  line-height: 1.6;
                  color: #4B5C58;
                  max-width: 640px;
                  margin: 0 auto;
                `)}
              >
                Alle actuele functies voor relatiemanagers,
                fondsenwervers en development-functies bij ngo's en
                goede doelen op één plek. Leden van het Collectief
                plaatsen hier zelf ook vacatures en oproepen voor de
                sector.
              </div>
            </div>

            <div
              style={css(`
                max-width: 1180px;
                margin: 0 auto;
                padding: 0 32px 40px;
              `)}
            >
              {isLoggedIn ? (
                <>
                  <div
                    style={css(`
                      background: #EAF4EE;
                      border-radius: 24px;
                      padding: 40px clamp(20px, 4vw, 44px);
                    `)}
                  >
                    <div
                      style={css(`
                        display: flex;
                        align-items: baseline;
                        justify-content: space-between;
                        gap: 16px;
                        flex-wrap: wrap;
                        margin-bottom: 6px;
                      `)}
                    >
                      <div
                        style={css(`
                          font-family: 'Newsreader', serif;
                          font-size: 22px;
                          font-weight: 600;
                          color: #2C4A5E;
                        `)}
                      >
                        Plaats zelf een vacature of oproep
                      </div>

                      <div
                        style={css(`
                          font-size: 13px;
                          color: #4B5C58;
                        `)}
                      >
                        Zichtbaar voor alle leden van het Collectief
                      </div>
                    </div>

                    <div
                      style={css(`
                        font-size: 14.5px;
                        color: #4B5C58;
                        margin-bottom: 24px;
                      `)}
                    >
                      Zoekt uw organisatie een fondsenwerver, of doet u
                      een oproep aan vakgenoten? Vul de gegevens in.
                    </div>

                    <div
                      style={css(`
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 14px;
                        margin-bottom: 16px;
                      `)}
                    >
                      <input
                        type="text"
                        placeholder="Functie of oproep"
                        value={vacForm.title}
                        onChange={onVacTitle}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder="Organisatie"
                        value={vacForm.org}
                        onChange={onVacOrg}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder="Locatie"
                        value={vacForm.location}
                        onChange={onVacLocation}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder="Thema of trefwoord (bijv. natuur, jeugd)"
                        value={vacForm.tag}
                        onChange={onVacTag}
                        style={inputStyle}
                      />
                    </div>

                    <div
                      style={css(`
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        flex-wrap: wrap;
                      `)}
                    >
                      <div
                        onClick={submitVacancy}
                        style={css(`
                          cursor: pointer;
                          padding: 13px 28px;
                          background: #4E9A6C;
                          color: #FFFFFF;
                          border-radius: 999px;
                          font-weight: 700;
                          font-size: 15px;
                        `)}
                      >
                        Plaatsen
                      </div>

                      {vacPosted ? (
                        <div
                          style={css(`
                            font-size: 14px;
                            color: #4E9A6C;
                            font-weight: 700;
                          `)}
                        >
                          Geplaatst, te zien in de lijst hieronder.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}

              {hideContact ? (
                <>
                  <div
                    style={css(`
                      background: #EAF4EE;
                      border-radius: 24px;
                      padding: 40px clamp(20px, 4vw, 44px);
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      gap: 24px;
                      flex-wrap: wrap;
                    `)}
                  >
                    <div>
                      <div
                        style={css(`
                          font-family: 'Newsreader', serif;
                          font-size: 22px;
                          font-weight: 600;
                          color: #2C4A5E;
                          margin-bottom: 6px;
                        `)}
                      >
                        Zelf een vacature of oproep plaatsen?
                      </div>

                      <div
                        style={css(`
                          font-size: 14.5px;
                          color: #4B5C58;
                          max-width: 560px;
                        `)}
                      >
                        Alleen leden van het Collectief kunnen vacatures
                        en oproepen plaatsen. Log in of registreer u om
                        uw vacature te delen met de sector.
                      </div>
                    </div>

                    <div
                      onClick={goNetwerk}
                      style={css(`
                        cursor: pointer;
                        padding: 13px 28px;
                        background: #4E9A6C;
                        color: #FFFFFF;
                        border-radius: 999px;
                        font-weight: 700;
                        font-size: 15px;
                        white-space: nowrap;
                      `)}
                    >
                      Log in bij het Collectief →
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {hasMemberVacancies ? (
              <>
                <div
                  style={css(`
                    max-width: 1180px;
                    margin: 0 auto;
                    padding: 0 32px 40px;
                  `)}
                >
                  <div
                    style={css(`
                      font-family: 'Newsreader', serif;
                      font-size: 22px;
                      font-weight: 600;
                      color: #2C4A5E;
                      margin-bottom: 20px;
                    `)}
                  >
                    Geplaatst door leden
                  </div>

                  <div
                    style={css(`
                      display: grid;
                      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                      gap: 16px;
                    `)}
                  >
                    {(memberVacancies || []).map(
                      (v, index) => (
                        <React.Fragment key={index}>
                          <div
                            style={css(`
                              background: #FFFFFF;
                              border: 1.5px solid #DCEDE3;
                              border-radius: 14px;
                              padding: 20px 22px;
                              display: flex;
                              flex-direction: column;
                              gap: 10px;
                            `)}
                          >
                            <div
                              style={css(`
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                gap: 12px;
                              `)}
                            >
                              <div
                                style={css(`
                                  font-weight: 700;
                                  color: #2C4A5E;
                                  font-size: 15.5px;
                                `)}
                              >
                                {v.title}
                              </div>

                              <div
                                style={css(`
                                  font-size: 11.5px;
                                  color: #4E9A6C;
                                  background: #EAF4EE;
                                  padding: 3px 10px;
                                  border-radius: 999px;
                                  font-weight: 700;
                                  white-space: nowrap;
                                `)}
                              >
                                Lid
                              </div>
                            </div>

                            <div
                              style={css(`
                                font-size: 13.5px;
                                color: #4B5C58;
                              `)}
                            >
                              {v.org} · {v.location}
                            </div>

                            <div
                              style={css(`
                                display: flex;
                                flex-wrap: wrap;
                                gap: 6px;
                              `)}
                            >
                              {(v.tags || []).map(
                                (tag, tagIndex) => (
                                  <React.Fragment key={tagIndex}>
                                    <div
                                      style={css(`
                                        font-size: 11.5px;
                                        font-weight: 700;
                                        color: #2C4A5E;
                                        background: #EAF1F6;
                                        padding: 3px 10px;
                                        border-radius: 999px;
                                      `)}
                                    >
                                      {tag}
                                    </div>
                                  </React.Fragment>
                                ),
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      ),
                    )}
                  </div>
                </div>
              </>
            ) : null}

            <div
              style={css(`
                max-width: 1180px;
                margin: 0 auto;
                padding: 0 32px clamp(34px, 6vw, 76px);
              `)}
            >
              <div
                style={css(`
                  font-family: 'Newsreader', serif;
                  font-size: 22px;
                  font-weight: 600;
                  color: #2C4A5E;
                  margin-bottom: 20px;
                `)}
              >
                Actuele vacatures uit de sector
              </div>

              {vacanciesLoading ? (
                <div
                  style={css(`
                    font-size: 14px;
                    color: #4B5C58;
                    margin-bottom: 18px;
                  `)}
                >
                  Vacatures laden...
                </div>
              ) : null}

              {vacanciesError ? (
                <div
                  style={css(`
                    font-size: 14px;
                    color: #A13B2F;
                    margin-bottom: 18px;
                  `)}
                >
                  {vacanciesError}
                </div>
              ) : null}

              {!vacanciesLoading &&
              !vacanciesError &&
              sectorVacancies.length === 0 ? (
                <div
                  style={css(`
                    font-size: 14px;
                    color: #4B5C58;
                    margin-bottom: 18px;
                  `)}
                >
                  Er zijn momenteel geen gepubliceerde vacatures.
                </div>
              ) : null}

              <div
                style={css(`
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                  gap: 16px;
                `)}
              >
                {(sectorVacancies || []).map((v) => (
                  <React.Fragment key={v.id}>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={css(`
                        background: #FFFFFF;
                        border: 1.5px solid #E1EAE4;
                        border-radius: 14px;
                        padding: 20px 22px;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                      `)}
                    >
                      <div
                        style={css(`
                          display: flex;
                          align-items: center;
                          justify-content: space-between;
                          gap: 12px;
                        `)}
                      >
                        <div
                          style={css(`
                            font-weight: 700;
                            color: #2C4A5E;
                            font-size: 15.5px;
                          `)}
                        >
                          {v.title}
                        </div>

                        <div
                          style={css(`
                            font-size: 12px;
                            color: #FFFFFF;
                            background: #4E9A6C;
                            padding: 3px 10px;
                            border-radius: 999px;
                            font-weight: 700;
                            white-space: nowrap;
                          `)}
                        >
                          {v.type}
                        </div>
                      </div>

                      <div
                        style={css(`
                          font-size: 13.5px;
                          color: #4B5C58;
                        `)}
                      >
                        {v.org} · {v.location}
                      </div>

                      <div
                        style={css(`
                          display: flex;
                          flex-wrap: wrap;
                          gap: 6px;
                        `)}
                      >
                        {(v.tags || []).map(
                          (tag, tagIndex) => (
                            <React.Fragment key={tagIndex}>
                              <div
                                style={css(`
                                  font-size: 11.5px;
                                  font-weight: 700;
                                  color: #2C4A5E;
                                  background: #EAF1F6;
                                  padding: 3px 10px;
                                  border-radius: 999px;
                                `)}
                              >
                                {tag}
                              </div>
                            </React.Fragment>
                          ),
                        )}
                      </div>
                    </a>
                  </React.Fragment>
                ))}
              </div>

              <div
                style={css(`
                  font-size: 12.5px;
                  color: #8FA09B;
                  margin-top: 18px;
                `)}
              >
                Vacatures kunnen inmiddels zijn vervuld, controleer de
                actuele status via de link.
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function formatDate(date) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(date));
  } catch {
    return date;
  }
}

const inputStyle = css(`
  padding: 12px 16px;
  border-radius: 12px;
  border: 1.5px solid #DCEDE3;
  font-size: 14.5px;
  font-family: 'Mulish', sans-serif;
  outline: none;
  background: #FFFFFF;
`);
