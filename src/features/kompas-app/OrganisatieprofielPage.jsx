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
import { haalClassificatiesOp } from '../../data/services/classificaties.js';
import { Button, ClassificatieSelect, Field, Notice, Panel, PanelHeader, SectionHeading, veldStijl } from '../../shared/ui/index.js';

// Ook gebruikt door KompasToolPage.jsx (fase 6, veldlabels voor de
// goedkeuring van AI-voorstellen die tijdens een gesprek naar voren komen).
export const VELDEN = [
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

const SECTIES = ['Organisatieprofiel', 'Werkgebied', 'Organisatiegegevens', 'Contact', 'Toon'];

const LEEG_CONTACT = { naam: '', functie: '', email: '', telefoon: '' };
const LEEG_SOCIAL = { platform: '', url: '' };

// Documenten die het organisatieprofiel kunnen aanvullen (fase 3). Ander
// concept dan de documenten per project (ProjectenPage.jsx) of de
// AI-gegenereerde documenten op de Documentatie-pagina.
const ORG_DOC_SOORTEN = [
  'Beleidsplan',
  'Jaarverslag',
  'Projectplan',
  'Meerjarenstrategie',
  'Begroting',
  'Impactrapport',
  'Evaluatie',
  'Overig',
];

function raadDocSoort(naam) {
  const l = (naam || '').toLowerCase();

  if (l.indexOf('beleidsplan') !== -1) return 'Beleidsplan';
  if (l.indexOf('jaarverslag') !== -1) return 'Jaarverslag';
  if (l.indexOf('meerjaren') !== -1) return 'Meerjarenstrategie';
  if (l.indexOf('projectplan') !== -1) return 'Projectplan';
  if (l.indexOf('begroting') !== -1) return 'Begroting';
  if (l.indexOf('impact') !== -1) return 'Impactrapport';
  if (l.indexOf('evaluatie') !== -1) return 'Evaluatie';

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

export default function OrganisatieprofielPage() {
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

  // Disciplines/doelgroepen komen niet meer uit een hardgecodeerde lijst in
  // deze pagina, maar live uit de centrale classificatietabellen (themas,
  // doelgroepen) - zie data/services/classificaties.js. Zo hoeft een nieuwe
  // discipline maar op één plek (de database) te worden toegevoegd.
  const [classificaties, setClassificaties] = useState({ themas: [], doelgroepen: [] });

  useEffect(() => {
    let actief = true;

    haalOrganisatieDocumentenOp().then((lijst) => {
      if (actief) {
        setDocumenten(lijst || []);
      }
    });

    haalClassificatiesOp().then((lijst) => {
      if (actief) {
        setClassificaties(lijst);
      }
    });

    return () => {
      actief = false;
    };
  }, []);

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

    const { velden, paginas, error } = await analyseerWebsite({ url: profiel.website });

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

    const { velden, error } = await extractOrganisatieVelden({ text: doc.tekst, fileName: doc.naam });

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

  return (
    <Panel>
      <PanelHeader title="Organisatie"
        intro="Dit profiel is optioneel. Hoe meer u invult, hoe gerichter Subsidie Kompas adviseert over passende fondsen en hoe beter aanvragen in uw eigen toon worden geschreven."
      />

      {isLeeg && (
        <div style={css('margin-bottom: 18px; padding: clamp(16px, 2.4vw, 26px); border: 1px solid #D5E6DB; border-radius: 24px; background: #EAF4EE;')}>
          <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: clamp(23px, 3vw, 28px); font-weight: 600; color: #2C4A5E;")}>
            Begin met drie vragen
          </div>
          <div style={css('margin-bottom: 16px; max-width: 640px; font-size: 15px; line-height: 1.7; color: #4B5C58;')}>
            Met deze drie gegevens kan Subsidie Kompas al gericht adviseren. De rest van uw profiel vult u later aan, of
            laat u opbouwen uit uw website.
          </div>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 12px;')}>
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

      <div style={css('margin-bottom: 20px; padding: 16px; border: 1px solid #E1EAE4; border-radius: 20px; background: #F7F9F8;')}>
        <div style={css('margin-bottom: 6px; font-size: 15px; font-weight: 800; color: #2C4A5E;')}>
          Website analyseren
        </div>
        <div style={css('margin-bottom: 14px; max-width: 620px; font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
          Laat Subsidie Kompas uw website lezen en het profiel voorstellen. De voorstellen zijn niet bindend: u past ze
          aan of laat ze weg.
        </div>
        <Button variant="outline" onClick={analyseer}>
          {analyseBezig ? 'Bezig met analyseren…' : 'Analyseer mijn website'}
        </Button>
      </div>

      <div style={css('margin-bottom: 20px; padding: 16px; border: 1px solid #E1EAE4; border-radius: 20px; background: #F7F9F8;')}>
        <div style={css('margin-bottom: 6px; font-size: 15px; font-weight: 800; color: #2C4A5E;')}>
          Documenten uploaden
        </div>
        <div style={css('margin-bottom: 14px; max-width: 620px; font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
          Upload een beleidsplan, jaarverslag, projectplan, meerjarenstrategie, begroting, impactrapport of evaluatie.
          Subsidie Kompas kan zo'n document laten uitlezen en velden voorstellen - u kiest zelf welke worden overgenomen.
        </div>

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

      <div style={css('display: flex; flex-direction: column; gap: 22px;')}>
        {SECTIES.map((sectie) => (
          <div key={sectie}>
            <SectionHeading>{sectie}</SectionHeading>
            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 14px;')}>
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
                    <>
                      <ClassificatieSelect
                        opties={classificaties[f.n] || []}
                        waarde={profiel[f.n] || []}
                        onChange={(nieuw) => { store.setOrgField(f.n, nieuw); setMelding(''); }}
                        multi
                        metAnders
                        placeholder={`${f.l} selecteren…`}
                        ariaLabel={f.l}
                      />
                      <Herkomst bron={bronnen[f.n]} onWis={() => store.clearOrgField(f.n)} />
                    </>
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

      <div style={css('margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;')}>
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
