// Organisatie: het organisatieprofiel dat Subsidie Kompas gebruikt bij
// fondsselecties, aanvragen en (in latere fases) alle andere AI-tools.
// Vanaf nu echt bewaard in de database (subsidie_kompas_organizations),
// per veld met herkomst (handmatig/website/document/gesprek) - zie
// data/services/organisatieprofiel.js.
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';
import { bronLabel } from '../../data/services/organisatieprofiel.js';
import { extraheerTekst } from '../../data/services/documentExtractie.js';
import {
  haalOrganisatieDocumentenOp,
  uploadOrganisatieDocument,
  verwijderOrganisatieDocument,
} from '../../data/services/organisatiedocumenten.js';
import { analyseerWebsite, extractOrganisatieVelden } from '../../data/services/chat.js';
import { Button, Field, Notice, Panel, PanelHeader, veldStijl } from '../../shared/ui/index.js';

// Ook gebruikt door KompasToolPage.jsx (fase 6, veldlabels voor de
// goedkeuring van AI-voorstellen die tijdens een gesprek naar voren komen).
export const VELDEN = [
  { s: 'Organisatieprofiel', n: 'name', l: 'Organisatienaam', t: 'text', p: 'Stichting Voorbeeld' },
  { s: 'Organisatieprofiel', n: 'website', l: 'Website', t: 'text', p: 'www.stichtingvoorbeeld.nl' },
  { s: 'Organisatieprofiel', n: 'rechtsvorm', l: 'Rechtsvorm', t: 'text', p: 'Stichting' },
  { s: 'Organisatieprofiel', n: 'opgericht', l: 'Opgericht in', t: 'number', p: '2014' },
  { s: 'Organisatieprofiel', n: 'kvk', l: 'KvK-nummer', t: 'text', p: '12345678' },
  { s: 'Organisatieprofiel', n: 'anbi', l: 'ANBI-status', t: 'text', p: 'Ja, sinds 2015' },
  { s: 'Organisatieprofiel', n: 'mission', l: 'Doelstelling of missie (volgens beleidsplan)', t: 'area', p: 'Wat wil uw organisatie bereiken?' },
  { s: 'Organisatieprofiel', n: 'visie', l: 'Visie', t: 'area', p: 'Waar werkt uw organisatie naartoe?' },
  { s: 'Werkgebied', n: 'regio', l: 'Werkgebied', t: 'text', p: 'Utrecht en omgeving' },
  { s: 'Werkgebied', n: 'gemeente', l: 'Gemeente', t: 'text', p: 'Utrecht' },
  { s: 'Werkgebied', n: 'provincie', l: 'Provincie', t: 'text', p: 'Utrecht' },
  { s: 'Werkgebied', n: 'themas', l: 'Disciplines', t: 'chips' },
  { s: 'Werkgebied', n: 'doelgroepen', l: 'Doelgroepen', t: 'chips' },
  { s: 'Organisatiegegevens', n: 'omzet', l: 'Jaarlijkse omzet (€)', t: 'number', p: '240000' },
  { s: 'Organisatiegegevens', n: 'medewerkers', l: 'Aantal beroepskrachten', t: 'number', p: '4' },
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

// Alleen de noodzakelijke gegevens staan op de pagina. Overige velden in het profiel (visie, werkgebied, contact, toon, enzovoort) blijven bewaard
// en blijven werken waar ze al worden gebruikt, maar worden hier niet meer gevraagd of door een analyse voorgesteld.
const ZICHTBAAR = ['name', 'rechtsvorm', 'opgericht', 'kvk', 'anbi', 'mission', 'medewerkers', 'vrijwilligers'];

function zichtbareVelden(velden) {
  return Object.fromEntries(Object.entries(velden || {}).filter(([k]) => ZICHTBAAR.indexOf(k) !== -1));
}

// Documenten die het organisatieprofiel kunnen aanvullen (fase 3). Ander
// concept dan de documenten per project (ProjectenPage.jsx) of de
// AI-gegenereerde documenten op de Documentatie-pagina.
const ORG_DOC_SOORTEN = ['Beleidsplan', 'Jaarverslag', 'ANBI-status', 'Statuten', 'Overig'];

function raadDocSoort(naam) {
  const l = (naam || '').toLowerCase();

  if (l.indexOf('beleidsplan') !== -1) return 'Beleidsplan';
  if (l.indexOf('jaarverslag') !== -1) return 'Jaarverslag';
  if (l.indexOf('anbi') !== -1) return 'ANBI-status';
  if (l.indexOf('statuten') !== -1 || l.indexOf('statuut') !== -1) return 'Statuten';

  return 'Overig';
}

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

export default function OrganisatieprofielPage({ embedded = false } = {}) {
  const app = useApp();
  const store = useKompas();
  const paid = ['pro', 'premium'].indexOf(app.subscriptionTier || 'free') !== -1;

  const [melding, setMelding] = useState('');
  const [analyseBezig, setAnalyseBezig] = useState(false);

  // Organisatiedocumenten (fase 3): los van het organisatieprofiel zelf, dus
  // eigen state hier in plaats van in KompasStore - een lijst bestanden met
  // signed-url-achtige opslag hoeft niet in het gedeelde profiel te zitten.
  const [documenten, setDocumenten] = useState(null);
  const [documentBezig, setDocumentBezig] = useState(false);
  const [analyseVoorstel, setAnalyseVoorstel] = useState(null);
  const [analyseFout, setAnalyseFout] = useState('');

  useEffect(() => {
    let actief = true;

    haalOrganisatieDocumentenOp().then((lijst) => {
      if (actief) {
        setDocumenten(lijst || []);
      }
    });

    return () => {
      actief = false;
    };
  }, []);

  if (!paid) {
    return (
      <Panel embedded={embedded}>
        {!embedded && (
          <PanelHeader title="Organisatie"
            intro="Met Pro en Premium legt u uw organisatieprofiel vast, of laat u het opbouwen uit uw website. Subsidie Kompas gebruikt het daarna bij fondsselecties en aanvragen."
          />
        )}
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Panel>
    );
  }

  const profiel = store.orgProfile || {};
  const bronnen = store.orgBronnen || {};

  // Laat de eigen website lezen (fase 4): homepage plus, indien gevonden, een
  // paar voor de hand liggende pagina's (over ons/missie/contact) - geen
  // diepere crawl. Net als bij documenten: alleen voorstellen, nooit
  // automatisch opslaan.
  const analyseer = async () => {
    if (!String(profiel.website || '').trim()) {
      setMelding('Vul eerst uw website in, dan kan Subsidie Kompas die analyseren.');

      return;
    }

    setAnalyseBezig(true);
    setAnalyseFout('');
    setMelding('');
    setAnalyseVoorstel({ bronType: 'website', bronRef: profiel.website, bronLabel: `uw website (${profiel.website})`, velden: null, gekozen: {} });

    const { velden: ruweVelden, paginas, error } = await analyseerWebsite({ url: profiel.website });
    const velden = zichtbareVelden(ruweVelden);

    setAnalyseBezig(false);

    if (error) {
      setAnalyseFout(error);
      setAnalyseVoorstel(null);

      return;
    }

    if (!Object.keys(velden).length) {
      setAnalyseFout('Er zijn geen bruikbare gegevens op uw website gevonden.');
      setAnalyseVoorstel(null);

      return;
    }

    const gelezenPaginas = (paginas || []).map((p) => p.titel || p.url).join(', ');

    setAnalyseVoorstel({
      bronType: 'website',
      bronRef: profiel.website,
      bronLabel: gelezenPaginas ? `uw website — gelezen: ${gelezenPaginas}` : `uw website (${profiel.website})`,
      velden,
      gekozen: Object.fromEntries(Object.keys(velden).map((k) => [k, true])),
    });
  };

  // Upload + lokale tekst-extractie (mammoth/pdfjs voor .docx/.pdf, gewone
  // tekst voor .txt/.md/.csv). Het bestand zelf wordt niet automatisch
  // geanalyseerd - dat is een aparte, expliciete stap per document hieronder.
  const uploadDocument = async (e) => {
    const files = Array.prototype.slice.call(e.target.files || []);

    e.target.value = '';

    if (!files.length) {
      return;
    }

    setDocumentBezig(true);
    setAnalyseFout('');

    for (const file of files) {
      const tekst = await extraheerTekst(file);
      const soort = raadDocSoort(file.name);
      const res = await uploadOrganisatieDocument({ file, soort, tekst });

      if (res.id) {
        setDocumenten((cur) => [
          { id: res.id, naam: file.name, soort, mimeType: file.type, pad: res.pad, tekst, aangemaakt: new Date().toISOString() },
          ...(cur || []),
        ]);
      }
    }

    setDocumentBezig(false);
  };

  const verwijderDocument = async (doc) => {
    setDocumenten((cur) => (cur || []).filter((d) => d.id !== doc.id));

    if (analyseVoorstel && analyseVoorstel.bronType === 'document' && analyseVoorstel.bronRef === doc.id) {
      setAnalyseVoorstel(null);
    }

    await verwijderOrganisatieDocument(doc.id, doc.pad);
  };

  // Laat de AI het document lezen en veldwaarden voorstellen. Nooit
  // automatisch opgeslagen: het lid kiest hieronder per veld of het wordt
  // overgenomen. Zelfde voorstel-vorm (bronType/bronRef/bronLabel/velden/
  // gekozen) als de website-analyse hierboven, zodat één goedkeurscherm
  // (onder aan de pagina) beide kan tonen.
  const analyseerDocument = async (doc) => {
    if (!doc.tekst || !doc.tekst.trim()) {
      setAnalyseFout('Van dit document kon geen tekst worden gelezen om te laten analyseren.');

      return;
    }

    setAnalyseFout('');
    setAnalyseVoorstel({ bronType: 'document', bronRef: doc.id, bronLabel: `"${doc.naam}"`, velden: null, gekozen: {} });

    const { velden: ruweVelden, error } = await extractOrganisatieVelden({ text: doc.tekst, fileName: doc.naam });
    const velden = zichtbareVelden(ruweVelden);

    if (error) {
      setAnalyseFout(error);
      setAnalyseVoorstel(null);

      return;
    }

    if (!Object.keys(velden).length) {
      setAnalyseFout('Er zijn geen bruikbare gegevens in dit document gevonden.');
      setAnalyseVoorstel(null);

      return;
    }

    setAnalyseVoorstel({
      bronType: 'document',
      bronRef: doc.id,
      bronLabel: `"${doc.naam}"`,
      velden,
      gekozen: Object.fromEntries(Object.keys(velden).map((k) => [k, true])),
    });
  };

  const overnemenVoorstel = () => {
    if (!analyseVoorstel || !analyseVoorstel.velden) {
      return;
    }

    const gekozenVelden = Object.fromEntries(
      Object.entries(analyseVoorstel.velden).filter(([k]) => analyseVoorstel.gekozen[k]),
    );

    store.overnemenOrgVelden(gekozenVelden, analyseVoorstel.bronType, analyseVoorstel.bronRef);
    setAnalyseVoorstel(null);
    setMelding('De gekozen gegevens zijn overgenomen in het profiel.');
  };

  const velden = ZICHTBAAR.map((n) => VELDEN.find((f) => f.n === n)).filter(Boolean);

  return (
    <Panel embedded={embedded}>
      {!embedded && <PanelHeader title="Organisatieprofiel" />}

      <div style={css('margin-top: 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px 18px;')}>
        {velden.map((f) => (
          <Field key={f.n}>
            {f.l}
            <input
              type={f.t === 'number' ? 'number' : 'text'}
              min={f.t === 'number' ? 0 : undefined}
              value={profiel[f.n] || ''}
              onChange={(e) => store.setOrgField(f.n, e.target.value)}
              placeholder={f.p}
              style={veldStijl}
            />
            <Herkomst bron={bronnen[f.n]} onWis={() => store.clearOrgField(f.n)} />
          </Field>
        ))}
      </div>

      <div style={css('margin-top: 22px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;')}>
        <Button onClick={() => setMelding('Profiel opgeslagen.')}>Profiel opslaan</Button>
        <Button
          variant="outline"
          onClick={() => { store.clearOrgProfile(); setMelding('De informatie over uw organisatie is verwijderd.'); }}
        >
          Profiel verwijderen
        </Button>
      </div>

      <Notice>{melding}</Notice>

      <div style={css('margin-top: 30px; padding: clamp(16px, 2.4vw, 24px); border: 1px solid #D5E6DB; border-radius: 24px; background: #F3F8F5;')}>
        <div style={css("margin-bottom: 16px; font-family: 'Newsreader', serif; font-size: clamp(21px, 2.6vw, 25px); font-weight: 600; color: #2C4A5E;")}>
          Wilt u dit makkelijk invullen?
        </div>

        <div style={css('font-size: 14px; font-weight: 800; color: #2C4A5E; margin-bottom: 8px;')}>Website analyseren</div>
        <div style={css('display: flex; flex-wrap: wrap; gap: 10px; align-items: center;')}>
          <input
            value={profiel.website || ''}
            onChange={(e) => store.setOrgField('website', e.target.value)}
            placeholder="www.stichtingvoorbeeld.nl"
            aria-label="Website"
            style={{ ...veldStijl, flex: '1 1 260px', minWidth: 0, background: '#FFFFFF' }}
          />
          <Button variant="outline" onClick={analyseer}>
            {analyseBezig ? 'Bezig…' : 'Analyseer'}
          </Button>
        </div>
        <Herkomst bron={bronnen.website} onWis={() => store.clearOrgField('website')} />

      <div style={css('margin-top: 20px; padding-top: 20px; border-top: 1px solid #E1EAE4;')}>
        <div style={css('margin-bottom: 8px; font-size: 14px; font-weight: 800; color: #2C4A5E;')}>
          Relevante documenten
        </div>
        <details style={css('margin-bottom: 12px; font-size: 14px; color: #4B5C58;')}>
          <summary style={css('cursor: pointer; font-weight: 700; color: #4B5C58;')}>Welke documenten?</summary>
          <div style={css('margin-top: 6px; line-height: 1.6;')}>{ORG_DOC_SOORTEN.filter((x) => x !== 'Overig').join(', ')}</div>
        </details>

        <label
          style={css(
            'position: relative; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; min-height: 44px; padding: 0 18px; border: 1px solid #2C4A5E; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-weight: 700; font-size: 13.5px;',
          )}
        >
          {documentBezig ? 'Bezig met uploaden…' : '+ Document uploaden'}
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv"
            onChange={uploadDocument}
            disabled={documentBezig}
            style={css('position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden;')}
          />
        </label>

        {documenten === null && (
          <div style={css('margin-top: 16px; font-size: 14px; color: #7B8985;')}>Documenten laden…</div>
        )}

        {documenten && documenten.length === 0 && (
          <div style={css('margin-top: 16px; font-size: 14px; color: #7B8985;')}>Nog geen documenten geüpload.</div>
        )}

        {documenten && documenten.length > 0 && (
          <div style={css('margin-top: 14px; display: flex; flex-direction: column; gap: 10px;')}>
            {documenten.map((doc) => (
              <div
                key={doc.id}
                style={css(
                  'display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 14px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF;',
                )}
              >
                <div style={css('flex: 1 1 220px; min-width: 0;')}>
                  <div style={css('font-size: 14px; font-weight: 700; color: #2C4A5E; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>
                    {doc.naam}
                  </div>
                  <div style={css('font-size: 12.5px; color: #7B8985;')}>
                    {doc.soort}
                    {!doc.tekst && ' · geen tekst kunnen lezen'}
                  </div>
                </div>
                <Button variant="outline" onClick={() => analyseerDocument(doc)} disabled={!doc.tekst}>
                  Laten analyseren
                </Button>
                <button
                  type="button"
                  onClick={() => verwijderDocument(doc)}
                  style={css(
                    'cursor: pointer; min-height: 40px; padding: 0 10px; border: 1px solid #E1EAE4; border-radius: 10px; background: #FFFFFF; color: #9E3B2C; font-weight: 700; font-size: 13px;',
                  )}
                >
                  Verwijderen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

        {analyseFout && <div style={css('margin-top: 14px; font-size: 13.5px; color: #9E3B2C;')}>{analyseFout}</div>}

        {analyseVoorstel && (
          <div style={css('margin-top: 14px; padding: 14px; border: 1px solid #BFD4C6; border-radius: 16px; background: #EAF4EE;')}>
            <div style={css('margin-bottom: 10px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
              Voorstellen uit {analyseVoorstel.bronLabel}
            </div>

            {!analyseVoorstel.velden && (
              <div style={css('font-size: 14px; color: #4B5C58;')}>Bezig met analyseren…</div>
            )}

            {analyseVoorstel.velden && (
              <>
                <div style={css('display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;')}>
                  {Object.entries(analyseVoorstel.velden).map(([veld, waarde]) => {
                    const def = VELDEN.find((f) => f.n === veld);

                    return (
                      <label key={veld} style={css('display: flex; align-items: flex-start; gap: 10px; cursor: pointer;')}>
                        <input
                          type="checkbox"
                          checked={!!analyseVoorstel.gekozen[veld]}
                          onChange={(e) =>
                            setAnalyseVoorstel((cur) => ({
                              ...cur,
                              gekozen: { ...cur.gekozen, [veld]: e.target.checked },
                            }))
                          }
                          style={css('margin-top: 3px;')}
                        />
                        <span style={css('font-size: 14px; color: #3D4B48;')}>
                          <strong>{def ? def.l : veld}:</strong> {waarde}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
                  <Button onClick={overnemenVoorstel}>Overnemen in profiel</Button>
                  <Button variant="outline" onClick={() => setAnalyseVoorstel(null)}>
                    Annuleren
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
