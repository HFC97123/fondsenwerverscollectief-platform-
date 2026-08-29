// Organisatieprofiel: optioneel, handmatig in te vullen of op te bouwen uit
// de website. Subsidie Kompas gebruikt het bij fondsselecties en aanvragen.
import React, { useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';
import { Button, Field, Notice, Panel, PanelHeader, SectionHeading, veldStijl } from '../../shared/ui/index.js';

const VELDEN = [
  { s: 'Organisatieprofiel', n: 'name', l: 'Organisatienaam', t: 'text', p: 'Stichting Voorbeeld' },
  { s: 'Organisatieprofiel', n: 'website', l: 'Website', t: 'text', p: 'www.stichtingvoorbeeld.nl' },
  { s: 'Organisatieprofiel', n: 'rechtsvorm', l: 'Rechtsvorm', t: 'text', p: 'Stichting met ANBI-status' },
  { s: 'Organisatieprofiel', n: 'opgericht', l: 'Opgericht in', t: 'text', p: '2014' },
  { s: 'Organisatieprofiel', n: 'mission', l: 'Missie', t: 'area', p: 'Waar staat uw organisatie voor?' },
  { s: 'Werkgebied', n: 'regio', l: 'Werkgebied', t: 'text', p: 'Utrecht en omgeving' },
  { s: 'Werkgebied', n: 'themas', l: 'Thema’s', t: 'chips' },
  { s: 'Werkgebied', n: 'doelgroepen', l: 'Doelgroepen', t: 'chips' },
  { s: 'Financiering', n: 'omzet', l: 'Jaarlijkse omzet', t: 'text', p: '€ 240.000' },
  { s: 'Financiering', n: 'financiering', l: 'Huidige financieringsmix', t: 'area', p: 'Waar komt uw financiering nu vandaan?' },
  { s: 'Toon', n: 'toon', l: 'Toon van uw teksten', t: 'area', p: 'Hoe schrijft uw organisatie? Zakelijk, warm, direct?' },
];

const CHIP_OPTIES = {
  themas: [
    'Cultuur en erfgoed',
    'Zorg en welzijn',
    'Jeugd en onderwijs',
    'Sport en bewegen',
    'Natuur en duurzaamheid',
    'Armoede en inclusie',
    'Participatie en wijkinitiatieven',
    'Internationale samenwerking',
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

const SECTIES = ['Organisatieprofiel', 'Werkgebied', 'Financiering', 'Toon'];

export default function OrganisatieprofielPage() {
  const app = useApp();
  const store = useKompas();
  const paid = ['pro', 'premium'].indexOf(app.subscriptionTier || 'free') !== -1;

  const [melding, setMelding] = useState('');
  const [analyseBezig, setAnalyseBezig] = useState(false);

  if (!paid) {
    return (
      <Panel>
        <PanelHeader title="Informatie over uw organisatie"
          intro="Met Pro en Premium legt u uw organisatieprofiel vast, of laat u het opbouwen uit uw website. Subsidie Kompas gebruikt het daarna bij fondsselecties en aanvragen."
        />
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Panel>
    );
  }

  const profiel = store.orgProfile || {};

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
      <PanelHeader title="Informatie over uw organisatie"
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
                <Field key={f.n} style={f.t === 'area' || f.t === 'chips' ? { gridColumn: 'span 2' } : undefined}>
                  {f.l}
                  {f.t === 'text' && (
                    <input
                      value={profiel[f.n] || ''}
                      onChange={(e) => store.setOrgField(f.n, e.target.value)}
                      placeholder={f.p}
                      style={veldStijl}
                    />
                  )}
                  {f.t === 'area' && (
                    <textarea
                      value={profiel[f.n] || ''}
                      onChange={(e) => store.setOrgField(f.n, e.target.value)}
                      placeholder={f.p}
                      rows={4}
                      style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical' }}
                    />
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
