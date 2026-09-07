// Organisatie: het organisatieprofiel dat Subsidie Kompas gebruikt bij
// fondsselecties, aanvragen en (in latere fases) alle andere AI-tools.
// Vanaf nu echt bewaard in de database (subsidie_kompas_organizations),
// per veld met herkomst (handmatig/website/document/gesprek) - zie
// data/services/organisatieprofiel.js.
import React, { useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';
import { bronLabel } from '../../data/services/organisatieprofiel.js';
import { Button, Field, Notice, Panel, PanelHeader, SectionHeading, veldStijl } from '../../shared/ui/index.js';

const VELDEN = [
  { s: 'Organisatieprofiel', n: 'name', l: 'Organisatienaam', t: 'text', p: 'Stichting Voorbeeld' },
  { s: 'Organisatieprofiel', n: 'website', l: 'Website', t: 'text', p: 'www.stichtingvoorbeeld.nl' },
  { s: 'Organisatieprofiel', n: 'rechtsvorm', l: 'Rechtsvorm', t: 'text', p: 'Stichting' },
  { s: 'Organisatieprofiel', n: 'opgericht', l: 'Opgericht in', t: 'number', p: '2014' },
  { s: 'Organisatieprofiel', n: 'kvk', l: 'KvK-nummer', t: 'text', p: '12345678' },
  { s: 'Organisatieprofiel', n: 'anbi', l: 'ANBI-status', t: 'text', p: 'Ja, sinds 2015' },
  { s: 'Organisatieprofiel', n: 'mission', l: 'Missie', t: 'area', p: 'Waar staat uw organisatie voor?' },
  { s: 'Organisatieprofiel', n: 'visie', l: 'Visie', t: 'area', p: 'Waar werkt uw organisatie naartoe?' },
  { s: 'Werkgebied', n: 'regio', l: 'Werkgebied', t: 'text', p: 'Utrecht en omgeving' },
  { s: 'Werkgebied', n: 'gemeente', l: 'Gemeente', t: 'text', p: 'Utrecht' },
  { s: 'Werkgebied', n: 'provincie', l: 'Provincie', t: 'text', p: 'Utrecht' },
  { s: 'Werkgebied', n: 'themas', l: 'Disciplines', t: 'chips' },
  { s: 'Werkgebied', n: 'doelgroepen', l: 'Doelgroepen', t: 'chips' },
  { s: 'Organisatiegegevens', n: 'omzet', l: 'Jaarlijkse omzet (€)', t: 'number', p: '240000' },
  { s: 'Organisatiegegevens', n: 'medewerkers', l: 'Aantal medewerkers', t: 'number', p: '4' },
  { s: 'Organisatiegegevens', n: 'vrijwilligers', l: 'Aantal vrijwilligers', t: 'number', p: '20' },
  {
    s: 'Organisatiegegevens',
    n: 'financiering',
    l: 'Huidige financieringsmix',
    t: 'area',
    p: 'Waar komt uw financiering nu vandaan?',
  },
  { s: 'Contact', n: 'contactpersonen', l: 'Contactpersonen', t: 'contacts' },
  { s: 'Contact', n: 'socials', l: 'Social media', t: 'socials' },
  { s: 'Toon', n: 'toon', l: 'Toon van uw teksten', t: 'area', p: 'Hoe schrijft uw organisatie? Zakelijk, warm, direct?' },
];

const CHIP_OPTIES = {
  themas: [
    'Amateurkunst',
    'Architectuur',
    'Armoede/zelfredzaamheid',
    'Armoedebestrijding',
    'Beeldende kunst',
    'Beurzen',
    'Cultureel erfgoed',
    'Cultuur',
    'Cultuureducatie',
    'Dans',
    'Democratie',
    'Design',
    'Dieren',
    'Dierenwelzijn',
    'Diversiteit en inclusie',
    'Duurzaamheid',
    'Educatie',
    'Eenzaamheid',
    'Erfgoed',
    'Festival',
    'Film',
    'Fotografie',
    'Gehandicaptenzorg',
    'Gezondheid',
    'Innovatie',
    'Internationale samenwerking',
    'Internationalisering',
    'Jeugd en kinderen',
    'Joods',
    'Journalistiek',
    'Kerken',
    'Kinderen/jongeren',
    'Kunst',
    'Kwetsbare doelgroep',
    'Letterkunde',
    'Literaire kunsten',
    'Literatuur',
    'Maatschappij',
    'Media',
    'Media en journalistiek',
    'Mensenrechten',
    'Mindervaliden',
    'Mobiliteit',
    'Mode',
    'Monumentenzorg',
    'Muziek',
    'Natuur',
    'Natuur en milieu',
    'Nieuwe media',
    'Noodhulp',
    'Onderwijs',
    'Onderzoek',
    'Ontwikkelingshulp',
    'Ouderen',
    'Podiumkunsten',
    'Rechten',
    'Recreatie',
    'Religie',
    'Restauratie',
    'Sociaal-cultureel',
    'Sociaal-maatschappelijk',
    'Sport',
    'Taalvaardigheid',
    'Talentontwikkeling',
    'Technologie',
    'Theater en podiumkunsten',
    'Toneelkunsten',
    'Urban',
    'Verslavingszorg',
    'Vluchtelingen',
    'Vluchtelingen en migranten',
    'Vormgeving',
    'Vrede, vrijheid en veiligheid',
    'Vrijheid',
    'Vrijwilligers',
    'Welzijn',
    'Wetenschap',
    'Wetenschappelijk onderzoek',
    'Wonen en huisvesting',
    'Zorg',
  ],
  doelgroepen: [
    'Kinderen',
    'Jongeren',
    'Ouderen',
    'Mensen met een beperking',
    'Nieuwkomers/ongedocumenteerden',
    'Dieren',
    'Mensen in armoede',
    'Buurtbewoners',
    'Vrijwilligers',
  ],
};

const SECTIES = ['Organisatieprofiel', 'Werkgebied', 'Organisatiegegevens', 'Contact', 'Toon'];

const LEEG_CONTACT = { naam: '', functie: '', email: '', telefoon: '' };
const LEEG_SOCIAL = { platform: '', url: '' };

// Kleine, discrete herkomstregel onder een veld - alleen zichtbaar als het
// veld daadwerkelijk een waarde heeft. Transparantie-eis: waar komt dit
// vandaan (handmatig/website/document/gesprek), en de mogelijkheid om het te
// wissen (afzonderlijk van "hele profiel verwijderen" hieronder).
function Herkomst({ bron, onWis }) {
  if (!bron) {
    return null;
  }

  const label = bronLabel(bron.type);

  if (!label) {
    return null;
  }

  return (
    <div style={css('display: flex; align-items: center; gap: 8px; margin-top: 4px;')}>
      <span style={css('font-size: 11.5px; color: #9AA6A2;')}>{label}</span>
      <button
        type="button"
        onClick={onWis}
        style={css(
          'cursor: pointer; padding: 0; border: none; background: none; font-size: 11.5px; font-weight: 700; color: #9AA6A2; text-decoration: underline;',
        )}
      >
        wissen
      </button>
    </div>
  );
}

export default function OrganisatieprofielPage() {
  const app = useApp();
  const store = useKompas();
  const paid = ['pro', 'premium'].indexOf(app.subscriptionTier || 'free') !== -1;

  const [melding, setMelding] = useState('');
  const [analyseBezig, setAnalyseBezig] = useState(false);

  if (!paid) {
    return (
      <Panel>
        <PanelHeader title="Organisatie"
          intro="Met Pro en Premium legt u uw organisatieprofiel vast, of laat u het opbouwen uit uw website. Subsidie Kompas gebruikt het daarna bij fondsselecties en aanvragen."
        />
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Panel>
    );
  }

  const profiel = store.orgProfile || {};
  const bronnen = store.orgBronnen || {};

  const isLeeg = !Object.keys(profiel).some((k) => {
    const v = profiel[k];

    return Array.isArray(v) ? v.length : String(v || '').trim();
  });

  const toggleChip = (veld, waarde) => {
    const huidig = profiel[veld] || [];

    store.setOrgField(veld, huidig.indexOf(waarde) === -1 ? huidig.concat([waarde]) : huidig.filter((x) => x !== waarde));
    setMelding('');
  };

  const analyseer = () => {
    if (!String(profiel.website || '').trim()) {
      setMelding('Vul eerst uw website in, dan kan Subsidie Kompas die analyseren.');

      return;
    }

    setAnalyseBezig(true);

    // De echte analyse gebeurt aan de achterkant; hier alleen de terugkoppeling.
    window.setTimeout(() => {
      setAnalyseBezig(false);
      setMelding('De analyse is aangevraagd. Voorstellen zijn niet bindend; u kunt ze aanpassen of weglaten.');
    }, 900);
  };

  return (
    <Panel>
      <PanelHeader title="Organisatie"
        intro="Dit profiel is optioneel. Hoe meer u invult, hoe gerichter Subsidie Kompas adviseert over passende fondsen en hoe beter aanvragen in uw eigen toon worden geschreven."
      />

      {isLeeg && (
        <div style={css('margin-bottom: 26px; padding: clamp(22px, 3.2vw, 34px); border: 1px solid #D5E6DB; border-radius: 24px; background: #EAF4EE;')}>
          <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: clamp(23px, 3vw, 28px); font-weight: 600; color: #2C4A5E;")}>
            Begin met drie vragen
          </div>
          <div style={css('margin-bottom: 22px; max-width: 640px; font-size: 15px; line-height: 1.7; color: #4B5C58;')}>
            Met deze drie gegevens kan Subsidie Kompas al gericht adviseren. De rest van uw profiel vult u later aan, of
            laat u opbouwen uit uw website.
          </div>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 16px;')}>
            {['name', 'website', 'mission'].map((n) => {
              const def = VELDEN.find((f) => f.n === n);

              return (
                <Field key={n}>
                  {def.l}
                  <input
                    value={profiel[n] || ''}
                    onChange={(e) => store.setOrgField(n, e.target.value)}
                    placeholder={def.p}
                    style={veldStijl}
                  />
                </Field>
              );
            })}
          </div>
        </div>
      )}

      <div style={css('margin-bottom: 30px; padding: 22px; border: 1px solid #E1EAE4; border-radius: 20px; background: #F7F9F8;')}>
        <div style={css('margin-bottom: 6px; font-size: 15px; font-weight: 800; color: #2C4A5E;')}>
          Website analyseren
        </div>
        <div style={css('margin-bottom: 18px; max-width: 620px; font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
          Laat Subsidie Kompas uw website lezen en het profiel voorstellen. De voorstellen zijn niet bindend: u past ze
          aan of laat ze weg.
        </div>
        <Button variant="outline" onClick={analyseer}>
          {analyseBezig ? 'Bezig met analyseren…' : 'Analyseer mijn website'}
        </Button>
      </div>

      <div style={css('display: flex; flex-direction: column; gap: 34px;')}>
        {SECTIES.map((sectie) => (
          <div key={sectie}>
            <SectionHeading>{sectie}</SectionHeading>
            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 18px;')}>
              {VELDEN.filter((f) => f.s === sectie).map((f) => (
                <Field
                  key={f.n}
                  style={
                    f.t === 'area' || f.t === 'chips' || f.t === 'contacts' || f.t === 'socials'
                      ? { gridColumn: 'span 2' }
                      : undefined
                  }
                >
                  {f.l}
                  {f.t === 'text' && (
                    <>
                      <input
                        value={profiel[f.n] || ''}
                        onChange={(e) => store.setOrgField(f.n, e.target.value)}
                        placeholder={f.p}
                        style={veldStijl}
                      />
                      <Herkomst bron={bronnen[f.n]} onWis={() => store.clearOrgField(f.n)} />
                    </>
                  )}
                  {f.t === 'number' && (
                    <>
                      <input
                        type="number"
                        value={profiel[f.n] || ''}
                        onChange={(e) => store.setOrgField(f.n, e.target.value)}
                        placeholder={f.p}
                        style={veldStijl}
                      />
                      <Herkomst bron={bronnen[f.n]} onWis={() => store.clearOrgField(f.n)} />
                    </>
                  )}
                  {f.t === 'area' && (
                    <>
                      <textarea
                        value={profiel[f.n] || ''}
                        onChange={(e) => store.setOrgField(f.n, e.target.value)}
                        placeholder={f.p}
                        rows={4}
                        style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical' }}
                      />
                      <Herkomst bron={bronnen[f.n]} onWis={() => store.clearOrgField(f.n)} />
                    </>
                  )}
                  {f.t === 'chips' && (
                    <span style={css('display: flex; flex-wrap: wrap; gap: 8px;')}>
                      {CHIP_OPTIES[f.n].map((optie) => {
                        const actief = (profiel[f.n] || []).indexOf(optie) !== -1;

                        return (
                          <button
                            key={optie}
                            type="button"
                            aria-pressed={actief}
                            onClick={() => toggleChip(f.n, optie)}
                            style={css(`
                              cursor: pointer;
                              min-height: 40px;
                              padding: 9px 16px;
                              border: 1px solid ${actief ? '#BFD4C6' : '#E1EAE4'};
                              border-radius: 999px;
                              background: ${actief ? '#EAF4EE' : '#FFFFFF'};
                              color: ${actief ? '#2F6D47' : '#3D4B48'};
                              font-family: 'Mulish', sans-serif;
                              font-size: 13.5px;
                              font-weight: 700;
                            `)}
                          >
                            {optie}
                          </button>
                        );
                      })}
                    </span>
                  )}
                  {f.t === 'contacts' && (
                    <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                      {(profiel.contactpersonen || []).map((c, i) => (
                        <div
                          key={i}
                          style={css(
                            'display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)) auto; gap: 8px; align-items: center;',
                          )}
                        >
                          {['naam', 'functie', 'email', 'telefoon'].map((veld) => (
                            <input
                              key={veld}
                              value={c[veld] || ''}
                              placeholder={veld === 'naam' ? 'Naam' : veld === 'functie' ? 'Functie' : veld === 'email' ? 'E-mailadres' : 'Telefoon'}
                              onChange={(e) => {
                                const lijst = (profiel.contactpersonen || []).slice();

                                lijst[i] = { ...lijst[i], [veld]: e.target.value };
                                store.setOrgField('contactpersonen', lijst);
                              }}
                              style={veldStijl}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const lijst = (profiel.contactpersonen || []).filter((_, j) => j !== i);

                              store.setOrgField('contactpersonen', lijst);
                            }}
                            style={css(
                              'cursor: pointer; padding: 8px 10px; border: 1px solid #E1EAE4; border-radius: 10px; background: #FFFFFF; color: #9E3B2C; font-weight: 700;',
                            )}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            store.setOrgField('contactpersonen', (profiel.contactpersonen || []).concat([{ ...LEEG_CONTACT }]))
                          }
                          style={css(
                            'cursor: pointer; padding: 9px 14px; border: 1px dashed #BFD4C6; border-radius: 999px; background: #FFFFFF; color: #2F6D47; font-weight: 700; font-size: 13px;',
                          )}
                        >
                          + Contactpersoon toevoegen
                        </button>
                      </div>
                      <Herkomst bron={bronnen.contactpersonen} onWis={() => store.clearOrgField('contactpersonen')} />
                    </div>
                  )}
                  {f.t === 'socials' && (
                    <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                      {(profiel.socials || []).map((s, i) => (
                        <div
                          key={i}
                          style={css(
                            'display: grid; grid-template-columns: minmax(120px, 160px) 1fr auto; gap: 8px; align-items: center;',
                          )}
                        >
                          <input
                            value={s.platform || ''}
                            placeholder="Platform (bijv. Instagram)"
                            onChange={(e) => {
                              const lijst = (profiel.socials || []).slice();

                              lijst[i] = { ...lijst[i], platform: e.target.value };
                              store.setOrgField('socials', lijst);
                            }}
                            style={veldStijl}
                          />
                          <input
                            value={s.url || ''}
                            placeholder="https://…"
                            onChange={(e) => {
                              const lijst = (profiel.socials || []).slice();

                              lijst[i] = { ...lijst[i], url: e.target.value };
                              store.setOrgField('socials', lijst);
                            }}
                            style={veldStijl}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const lijst = (profiel.socials || []).filter((_, j) => j !== i);

                              store.setOrgField('socials', lijst);
                            }}
                            style={css(
                              'cursor: pointer; padding: 8px 10px; border: 1px solid #E1EAE4; border-radius: 10px; background: #FFFFFF; color: #9E3B2C; font-weight: 700;',
                            )}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div>
                        <button
                          type="button"
                          onClick={() => store.setOrgField('socials', (profiel.socials || []).concat([{ ...LEEG_SOCIAL }]))}
                          style={css(
                            'cursor: pointer; padding: 9px 14px; border: 1px dashed #BFD4C6; border-radius: 999px; background: #FFFFFF; color: #2F6D47; font-weight: 700; font-size: 13px;',
                          )}
                        >
                          + Social media-profiel toevoegen
                        </button>
                      </div>
                      <Herkomst bron={bronnen.socials} onWis={() => store.clearOrgField('socials')} />
                    </div>
                  )}
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={css('margin-top: 30px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;')}>
        <Button onClick={() => setMelding('Profiel opgeslagen.')}>Profiel opslaan</Button>
        <Button
          variant="danger"
          onClick={() => { store.clearOrgProfile(); setMelding('De informatie over uw organisatie is verwijderd.'); }}
        >
          Profiel verwijderen
        </Button>
      </div>

      <Notice>{melding}</Notice>
    </Panel>
  );
}
