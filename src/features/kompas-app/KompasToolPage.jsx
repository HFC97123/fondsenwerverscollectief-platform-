// Subsidie Kompas — de tool.
// Opmaak letterlijk uit het goedgekeurde ontwerp
// (data-screen-label="Subsidie Kompas"). De panelen voor documentatie,
// projecten en organisatie zijn in het ontwerp inline op deze pagina; ze worden
// hier gerenderd door de bestaande componenten, die al gelijk zijn aan het
// ontwerp.
//
// Behouden functionaliteit: de Edge Function via askKompas(), de plan-gates uit
// useKompasApp (Free/Pro/Premium), en de gesprekken uit KompasStore.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';
import { useKompas, DOC_SOORTEN } from './KompasStore.jsx';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';
import { askKompasStream, buildContext, buildMatchSignalen, haalBudgetUitTekst } from '../../data/services/chat.js';
import { isEchtId } from '../../data/services/projecten.js';
import {
  bepaalProjectActie,
  bepaalVeldUpdates,
  dossierNaarProjectVelden,
  filterOrganisatieVoorstel,
  veldenOpLijst,
} from './projectKoppeling.js';
// RC1 stap 3B (2026-10-01): echte .docx-generatie voor "Exporteren naar
// Word", via de bestaande Document Theme Engine (src/shared/document-theme/) -
// geen tweede huisstijl-/opmaaksysteem, uitsluitend deze twee, daarvoor
// gebouwde functies hergebruikt.
import { normalizeDocumentContent } from '../../shared/document-theme/normalizeDocumentContent.js';
import { generateWordDocument } from '../../shared/document-theme/generateWordDocument.js';
// RC1 stap 3D-4 (2026-10-01): echte .xlsx-generatie voor "Exporteren naar
// Excel" in de begrotingsworkflow - zelfde architectuur als Word hierboven.
// berekenBudget() is de enige rekenkundige waarheid (RC1 stap 3D);
// generateExcelDocument() ontvangt uitsluitend het al berekende resultaat en
// doet zelf geen AI-aanroep en geen eigen rekenwerk.
import { berekenBudget } from '../../shared/budget/berekenBudget.js';
import { generateExcelDocument, bepaalExcelBestandsnaam } from '../../shared/budget/generateExcelDocument.js';
import { extraheerTekst } from '../../data/services/documentExtractie.js';
import {
  bijwerkenGesprekModusEnDossier,
  haalBerichtenOp,
  haalGesprekModusEnDossier,
  koppelGesprekAanProject,
  maakGesprekAan,
  voegBerichtToe,
} from '../../data/services/gesprekken.js';
import OrganisatieprofielPage, { VELDEN } from './OrganisatieprofielPage.jsx';
import ProjectenPage from './ProjectenPage.jsx';
import DocumentatiePage from './DocumentatiePage.jsx';
import KompasContextDrawer from './KompasContextDrawer.jsx';

// RC1-acceptatietest, bevinding K3 (2026-10-01): vóór deze aanpassing
// activeerde de frontend de 'projectplan'-modus (en daarmee het
// Projectdossier-verificatiemechanisme in de Edge Function) uitsluitend via
// de ene starterchip "Help mij een projectplan opzetten" (zie verstuur()
// hieronder). Een lid dat zelf typt - "Kun je mij helpen met een
// projectplan?", "Werk dit project uit tot een projectplan" - bleef in
// 'algemeen' hangen, waardoor het Projectdossier nooit werd opgebouwd.
//
// Dit is een klein, deterministisch regelsysteem (geen extra taalmodel-
// aanroep) dat herkent of het lid daadwerkelijk om een projectplan vraagt.
// Bewust terughoudend: een kale vermelding van het woord "project" (bijv.
// "Welke fondsen passen bij mijn project?", "Maak een begroting voor mijn
// project") mag dit NOOIT activeren - alleen het woord "projectplan" zelf in
// combinatie met een duidelijke vraag/actie, of een expliciete "project
// (verder) uitwerken/beschrijven voor een aanvraag"-formulering.
//
// De Edge Function herkent dezelfde intentie server-side nogmaals als
// vangnet (zie vraagtOmProjectplan() in
// supabase/functions/subsidie-kompas/index.ts, bewust dezelfde regels maar
// in een los TypeScript/Deno-bestand dat niet door deze frontend kan worden
// geïmporteerd) - deze front-end-detectie is uitsluitend voor snellere/
// correcte UX (runtimecontext al vanaf het eerste bericht correct), de
// backend blijft altijd leidend. Houd beide bij wijziging synchroon.
const PROJECTPLAN_ACTIECUE_PATROON =
  /\b(help|helpt|helpen|hulp|wil|wilt|graag|kun je|kan je|kunt u|maak|gemaakt|schrijf|schrijven|zet[\s\S]{0,10}om|omzetten|opzetten|opstellen|opstel|verbeter|verbeteren|werk[\s\S]{0,40}uit|uitwerken|aanvullen|uitbreiden)\b/i;

const PROJECTPLAN_WOORD_PATROON = /project\s*plan/i;

const PROJECTPLAN_UITWERKEN_PATRONEN = [
  /\bproject(?:idee)?\b[\s\S]{0,50}\b(?:uit\s*te\s*werken|uitwerken|uit\s*werken)\b/i,
  /\b(?:uit\s*te\s*werken|uitwerken|uit\s*werken)\b[\s\S]{0,50}\bproject(?:idee)?\b/i,
];

const PROJECTPLAN_BESCHRIJVEN_PATRONEN = [
  /\bproject\b[\s\S]{0,60}\bbeschrijven\b[\s\S]{0,40}\b(?:subsidie)?aanvraag\b/i,
  /\b(?:subsidie)?aanvraag\b[\s\S]{0,40}\bproject\b[\s\S]{0,60}\bbeschrijven\b/i,
];

function detecteerProjectplanIntentie(tekst) {
  if (!tekst) {
    return false;
  }

  if (PROJECTPLAN_WOORD_PATROON.test(tekst) && PROJECTPLAN_ACTIECUE_PATROON.test(tekst)) {
    return true;
  }

  return (
    PROJECTPLAN_UITWERKEN_PATRONEN.some((r) => r.test(tekst)) ||
    PROJECTPLAN_BESCHRIJVEN_PATRONEN.some((r) => r.test(tekst))
  );
}

// RC1 stap 3D (2026-10-01): zelfde architectuurpatroon als
// detecteerProjectplanIntentie() hierboven, voor begroting - bewust geen
// nieuwe, algemene intent-engine, maar een eigen, even kleine en
// deterministische regelset. Ook hier: de Edge Function herkent dezelfde
// intentie server-side nogmaals als vangnet (vraagtOmBegroting() in
// supabase/functions/subsidie-kompas/index.ts, bewust dezelfde regels maar in
// een los TypeScript/Deno-bestand) - deze front-end-detectie is uitsluitend
// voor snellere/correcte UX, de backend blijft leidend. Houd beide bij
// wijziging synchroon.
//
// Bewust terughoudend: het woord "begroting"/"budget" alleen is niet
// voldoende (dat zou "Wat is de maximale begroting van dit fonds?" ten
// onrechte activeren) - er moet ook een duidelijke actie-/hulpcue bij staan.
// Daarnaast een kleine, expliciete uitzonderingslijst voor de evidente
// false-positives uit de opdracht: een VRAAG over de begroting(sgrens) van
// een fonds/regeling is nooit een verzoek om zelf een begroting op te
// stellen, ook niet als er toevallig een actiecue in dezelfde zin staat.
const BEGROTING_WOORD_PATROON = /begroting|budget/i;

const BEGROTING_ACTIECUE_PATROON =
  /\b(help|helpt|helpen|hulp|wil|wilt|graag|kun je|kan je|kunt u|maak|gemaakt|schrijf|schrijven|opstel|opstellen|stel[\s\S]{0,10}op|werk[\s\S]{0,40}uit|uitwerken|aanvullen|uitbreiden|controleer|controleren|check|checken|doorreken|doorrekenen|onderbouw|onderbouwen)\b/i;

// Evidente false-positives (vragen OVER een begroting, geen verzoek om er
// zelf een op te stellen) - exact de drie voorbeelden uit de opdracht plus
// de meest voor de hand liggende variaties daarop.
const BEGROTING_FONDS_VRAAG_PATRONEN = [
  /\b(maximale|maximum)\s+begroting\b/i,
  /\bpercentage\b[\s\S]{0,40}\bbegroting\b/i,
  /\bbegroting\b[\s\S]{0,20}\btot\b[\s\S]{0,10}(€|\d)/i,
  /\bbegroting\b[\s\S]{0,40}\b(van|die|dat)\b[\s\S]{0,25}\b(dit|het|deze|die)\s+(fonds|regeling)\b/i,
];

function detecteerBegrotingIntentie(tekst) {
  if (!tekst) {
    return false;
  }

  if (BEGROTING_FONDS_VRAAG_PATRONEN.some((r) => r.test(tekst))) {
    return false;
  }

  return BEGROTING_WOORD_PATROON.test(tekst) && BEGROTING_ACTIECUE_PATROON.test(tekst);
}

function formatDatum(iso) {
  if (!iso) {
    return '';
  }

  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

const STARTERS = [
  'Ik zoek financiering voor een nieuw project',
  'Welke fondsen passen bij mijn organisatie?',
  'Help mij een projectplan opzetten',
  'Hoe onderbouw ik mijn begroting?',
];

// Vervolgopdracht, prioriteit 7 (Export): kleine, gedempte actieknopjes
// onder een AI-resultaat - bewust geen "pil" (die suggereert een filter/
// keuze) en geen primaire knop (dit is een secundaire actie na het antwoord).
const actieKnopStijl = css(`
  cursor: pointer;
  box-sizing: border-box;
  min-height: 30px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid #D6E3E9;
  background: #F7F9F8;
  color: #2C4A5E;
  font-size: 12.5px;
  font-weight: 700;
`);

// Vervolgopdracht, prioriteit 4 (Contexttabs): alleen-lezen chip, bewust géén
// cursor/hover-styling - dit zijn statusindicatoren, geen knoppen (in
// tegenstelling tot actieKnopStijl hierboven, dat wél aanklikbare acties is).
const contextChipStijl = css(`
  box-sizing: border-box;
  min-height: 26px;
  padding: 3px 11px;
  border-radius: 999px;
  border: 1px solid #E4EAE8;
  background: #FFFFFF;
  color: #5B6E69;
  font-size: 12.5px;
  font-weight: 600;
`);

const pil = (actief) =>
  css(`
    cursor: pointer;
    box-sizing: border-box;
    min-height: 38px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    padding: 9px 20px;
    border-radius: 999px;
    border: 1px solid ${actief ? '#BFD4C6' : '#D6E3E9'};
    background: ${actief ? '#EAF4EE' : '#FFFFFF'};
    color: ${actief ? '#2F6D47' : '#2C4A5E'};
    font-family: 'Mulish', sans-serif;
    font-size: 13.5px;
    font-weight: 800;
  `);

function DenkKompas() {
  return (
    <div style={css('align-self: flex-start; padding: 2px 0 2px 4px;')}>
      <svg viewBox="0 0 48 48" width="38" height="38" style={{ display: 'block' }} aria-label="Subsidie Kompas denkt na" role="img">
        <circle cx="24" cy="24" r="21" fill="none" stroke="#DCE7E1" strokeWidth="2" />
        <circle
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke="#4E9A6C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="34 98"
          style={{ transformBox: 'view-box', transformOrigin: '24px 24px', animation: 'sk-spin 1.5s linear infinite' }}
        />
        <g style={{ transformBox: 'view-box', transformOrigin: '24px 24px', animation: 'sk-needle 2.6s cubic-bezier(0.45, 0, 0.25, 1) infinite' }}>
          <polygon points="24,8 27.4,24 24,27 20.6,24" fill="#4E9A6C" />
          <polygon points="24,40 27.4,24 24,21 20.6,24" fill="#A9C9DE" />
        </g>
        <circle cx="24" cy="24" r="2.6" fill="#2C4A5E" />
      </svg>
    </div>
  );
}

export default function KompasToolPage() {
  const app = useApp();
  const store = useKompas();

  const tier = app.subscriptionTier || 'free';
  // Admin heeft hier altijd toegang, ongeacht subscription_tier - net als bij
  // toonStatusBadge/toonPlanLabel hieronder en in KompasSubnav.jsx. Zo staat
  // de Admin-uitzondering overal op dezelfde, ene voorwaarde in plaats van
  // los per plek opnieuw te worden bedacht.
  const hasPlanTools = app.isAdmin || tier === 'pro' || tier === 'premium';
  const isFreePlan = tier === 'free';
  const isProPlan = tier === 'pro';
  const isPremiumPlan = tier === 'premium';

  // Admin overschrijft de pakketnaam: een beheerder heeft volledige toegang,
  // los van welk pakket er toevallig op het profiel staat.
  const planLabel = app.isAdmin ? 'Admin' : { free: 'Free', pro: 'Pro', premium: 'Premium' }[tier];
  // Zichtbaar zodra er echt iets te tonen is: Admin (bestaand gedrag), of
  // een account met een actief Subsidie Kompas Pro/Premium-abonnement. Een
  // FWC-account zonder actief abonnement gedraagt zich hier zichtbaar als
  // Free, dus zonder badge - net als een anonieme bezoeker.
  const toonStatusBadge = app.isAdmin || tier === 'pro' || tier === 'premium';
  const statusIndicator = `${app.naam || 'Mijn account'} \u00b7 ${planLabel}`;

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paneel, setPaneel] = useState(null);
  const [accountMsg, setAccountMsg] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Fase 5: welk gesprek (rij in subsidie_kompas_conversations) er nu
  // actief is - null zolang er nog geen bericht is verstuurd, want een
  // gesprek wordt pas aangemaakt bij het eerste bericht (zie verstuur()).
  const [conversationId, setConversationId] = useState(null);
  const [gekoppeldProjectId, setGekoppeldProjectId] = useState(null);
  // Verbetering Projectplan-workflow: welke Subsidie Kompas-modus dit gesprek
  // gebruikt (zie KOMPAS_MODES/resolveerModus() in de Edge Function - dat
  // mechanisme bestond al langer, maar werd tot nu toe nooit vanuit de
  // frontend gevuld). Bewust minimaal gehouden: alleen de projectplan-
  // starterchip hieronder zet dit expliciet op 'projectplan'; voor elk ander
  // gesprek blijft dit 'algemeen', exact het bestaande gedrag.
  const [kompasMode, setKompasMode] = useState('algemeen');
  // Verstevigen Projectplan-runtime, punten 1 + 2/3: kompasMode hierboven
  // leefde tot nu toe alleen in het geheugen van deze paginasessie - bij het
  // heropenen van een eerder gesprek (openGesprek() hieronder) werd hij nooit
  // hersteld, waardoor een Projectplan-gesprek ongemerkt terugviel op
  // 'algemeen'. projectDossier is nieuw: een compact, intern bijgehouden
  // overzicht (nooit aan de gebruiker getoond) dat de Edge Function na elk
  // antwoord bijwerkt zodat belangrijke projectinformatie niet verloren gaat
  // wanneer het gesprek langer wordt dan het berichtenvenster dat naar het
  // model gaat. Beide worden nu, samen met de berichten, bij het gesprek
  // opgeslagen (zie gesprekken.js) en bij het heropenen hersteld.
  const [projectDossier, setProjectDossier] = useState(null);
  const [historieLaadId, setHistorieLaadId] = useState(null);
  // Fase 6: voorstel dat uit het lopende gesprek zelf naar voren kwam (nooit
  // automatisch opgeslagen - zelfde goedkeurpatroon als document-/website-
  // analyse op de Organisatie-pagina, hier alleen inline in de chat zelf).
  const [chatVoorstel, setChatVoorstel] = useState(null);
  // Organisatie <-> project: wat er met de projectgegevens uit dit gesprek is
  // gebeurd (melding), een keuze bij een bestaand project met dezelfde naam
  // (projectKeuze) of een afwijkende waarde in een al ingevuld projectveld
  // (projectConflicten). De herkomst per dossierveld (lid/bevestigd/profiel)
  // komt van de server en wordt hier bijgehouden zodat de herkomst per
  // projectveld klopt.
  const [projectMelding, setProjectMelding] = useState('');
  const [projectKeuze, setProjectKeuze] = useState(null);
  const [projectConflicten, setProjectConflicten] = useState(null);
  const dossierBronnenRef = useRef({});
  const negeerProjectOpslaanRef = useRef(false);
  const verwerkBezigRef = useRef(false);
  const gezienProjectenRef = useRef(new Set());
  // Aanvraagbeoordeling (prioriteit 5): een lid kan een document (aanvraag,
  // projectplan, tekst) aan zijn bericht hangen. Hergebruikt bewust dezelfde
  // client-side extractie (mammoth/pdfjs) als de documentupload bij
  // Organisatie/Projecten - geen tweede extractiepad. Alleen de tekst
  // verlaat de browser, ingevoegd in het bericht zelf; er is geen apart
  // eindpunt of aparte opslag voor nodig.
  const [attachBezig, setAttachBezig] = useState(false);
  const [attachFout, setAttachFout] = useState('');
  const bestandRef = useRef(null);

  const scrollRef = useRef(null);
  const taRef = useRef(null);

  const gesprekken = store.conversations || [];
  // RC1 stap 3C (2026-10-01): niet langer store.genDocs (altijd leeg, zie
  // DocumentatiePage.jsx) - dezelfde telling als die pagina nu zelf gebruikt:
  // echte, bewaarde projectdocumenten met daadwerkelijke inhoud.
  const documenten = (store.projects || []).flatMap((p) =>
    (p.docs || []).filter((d) => d.tekst && String(d.tekst).trim().length > 0),
  );
  const [actiefDoc, setActiefDoc] = useState(null);
  // Vervolgopdracht, prioriteit 7 ("Later verder bewerken"): per AI-resultaat
  // gekozen documentsoort (DOC_SOORTEN), en een korte bevestiging na
  // kopiëren/opslaan/exporteren. Puur lokale UI-state, geen opslag.
  const [resultaatSoort, setResultaatSoort] = useState({});
  const [resultaatMelding, setResultaatMelding] = useState('');

  // STAP 5 (streaming): houdt de nog in opbouw zijnde tekst van het lopende
  // antwoord vast. Blijft leeg totdat de eerste delta binnenkomt, zodat het
  // bestaande DenkKompas-laadicoon gewoon zichtbaar blijft tot er echt tekst is.
  const [streamingAntwoord, setStreamingAntwoord] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, streamingAntwoord]);

  // Fixt een bestaande koppeling die tot nu toe niets deed: Documentatie's
  // "openen in de chat" (DocumentatiePage.jsx, openInChat) zet al langer
  // store.activeDoc, maar deze pagina las tot nu toe alleen zijn eigen,
  // nooit bijgewerkte lokale actiefDoc-state. Nu overgenomen zodra het
  // verandert, en meteen weer gewist uit de gedeelde store (dit is puur een
  // eenmalig "startsein", geen blijvende gedeelde toestand).
  useEffect(() => {
    if (store.activeDoc) {
      setActiefDoc(store.activeDoc);
      koppelProject(store.activeDoc.projectId || null);
      store.patch({ activeDoc: null });
    }
  }, [store.activeDoc]);

  const groeiMee = () => {
    const el = taRef.current;

    if (!el) return;

    el.style.height = '48px';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  // Leest het gekozen bestand client-side uit (extraheerTekst regelt zelf
  // .pdf/.docx/.txt, en geeft nooit een uitzondering) en zet de tekst, met
  // een duidelijk label, vóór wat het lid al had getypt - zodat in het
  // gesprek altijd zichtbaar blijft wat een bijlage was en wat eigen tekst.
  // Geen aparte opslag/upload: dit is puur tekst die met het eerstvolgende
  // bericht wordt meegestuurd, net als geplakte tekst.
  const voegDocumentToe = async (e) => {
    const file = (e.target.files || [])[0];

    e.target.value = '';

    if (!file) return;

    setAttachFout('');
    setAttachBezig(true);

    const tekst = await extraheerTekst(file);

    setAttachBezig(false);

    if (!tekst.trim()) {
      setAttachFout(`Van "${file.name}" kon geen tekst worden gelezen.`);

      return;
    }

    setDraft((huidig) => `Bijgevoegd document "${file.name}":\n${tekst}\n\n${huidig}`.trim());

    if (taRef.current) {
      taRef.current.focus();
      groeiMee();
    }
  };

  // Bewaart een gesprek pas op het eerste bericht (niet vooraf) zodat er geen
  // lege gesprekken ontstaan; alleen voor wie de "Eerdere gesprekken"-lijst
  // ook ziet (hasPlanTools) - voor Free blijft een gesprek puur lokaal, zoals
  // voorheen.
  const verstuur = async (tekst, modusOverride) => {
    const vraag = (tekst != null ? tekst : draft).trim();

    if (!vraag || loading) return;

    // Verbetering Projectplan-workflow: modusOverride komt van de
    // projectplan-starterchip hieronder. React's setKompasMode() hierbeneden
    // is asynchroon, dus deze aanroep van askKompasStream() verderop mag niet
    // op de (nog niet bijgewerkte) kompasMode-state uit de closure vertrouwen
    // - vandaar deze losse, direct beschikbare waarde.
    //
    // RC1-acceptatietest, bevinding K3 (2026-10-01): naast de starterchip
    // (modusOverride) herkent detecteerProjectplanIntentie() hierboven ook
    // vrij getypte projectplanverzoeken. Dit geldt alleen zolang het gesprek
    // nog in 'algemeen' staat (kompasMode === 'algemeen') - zodra de modus
    // al 'projectplan' is, via de chip of een eerdere detectie verderop in
    // hetzelfde gesprek, blijft dat vanzelf zo voor elk vervolgbericht, ook
    // als dat zelf niet meer het woord "projectplan" bevat (bijv. "De
    // doelgroep bestaat uit jongeren tussen 12 en 18 jaar."), omdat dan
    // alleen de bestaande kompasMode-state wordt gebruikt en er geen nieuwe
    // detectie meer plaatsvindt.
    // RC1 stap 3D (2026-10-01): begroting krijgt dezelfde sticky-architectuur
    // als projectplan hierboven - detectie vindt alleen plaats zolang het
    // gesprek nog in 'algemeen' staat; zodra de modus eenmaal 'begroting' is
    // (via detectie hier of de bestaande backend-fallback), blijft die zo
    // voor elk vervolgbericht in hetzelfde gesprek, ook voor berichten die
    // zelf geen "begroting"/"budget" meer bevatten (bijv. "Voeg €2.000
    // communicatiekosten toe."), omdat dan alleen de bestaande kompasMode-
    // state wordt gebruikt en er geen nieuwe detectie meer plaatsvindt.
    // Projectplan-detectie gaat voor bij een zin die toevallig aan beide
    // zou voldoen (geen van de aangeleverde testzinnen doet dat).
    const autoModus =
      kompasMode === 'algemeen'
        ? detecteerProjectplanIntentie(vraag)
          ? 'projectplan'
          : detecteerBegrotingIntentie(vraag)
            ? 'begroting'
            : null
        : null;
    const actieveModus = modusOverride || autoModus || kompasMode;

    if (modusOverride || autoModus) setKompasMode(actieveModus);

    const nieuw = messages.concat([{ role: 'user', content: vraag, fromUser: true }]);

    setMessages(nieuw);
    setDraft('');
    setError('');
    setLoading(true);
    setStreamingAntwoord('');

    if (taRef.current) taRef.current.style.height = '48px';

    let actiefGesprekId = conversationId;

    if (hasPlanTools) {
      if (!actiefGesprekId) {
        const aangemaakt = await maakGesprekAan({
          titel: vraag.slice(0, 60),
          projectId: gekoppeldProjectId,
          // Verstevigen Projectplan-runtime, punt 1: modus meteen vanaf het
          // eerste bericht vastleggen, zodat een later heropend gesprek hem
          // kan herstellen (zie openGesprek() hieronder).
          kompasMode: actieveModus,
        });

        if (aangemaakt.id) {
          actiefGesprekId = aangemaakt.id;
          setConversationId(actiefGesprekId);
          store.upsertGesprekInLijst({
            id: actiefGesprekId,
            titel: vraag.slice(0, 60),
            tijd: new Date().toISOString(),
            projectId: gekoppeldProjectId,
          });
        }
      }

      if (actiefGesprekId) {
        voegBerichtToe({ conversationId: actiefGesprekId, role: 'user', content: vraag, projectId: gekoppeldProjectId });
      }
    }

    const res = await askKompasStream({
      messages: nieuw,
      tier,
      permissions: {
        canUploadFiles: app.canUploadFiles,
        canUseKnowledgeBase: app.canUseKnowledgeBase,
        canUseFundDatabase: app.canUsePrivateDatabase,
        canUseOrganizationMemory: app.canUseOrganizationMemory,
      },
      // Verbeterpunten Projectplan + Free/Pro/Premium, punt 1 (2026-10-01):
      // buildContext() bevat het organisatieprofiel, de projectenlijst en het
      // actieve document van dit lid - exact de "verborgen organisatiecontext"
      // die Free nooit mag meekrijgen (zie orgProfile/project/matchSignalen
      // hieronder, die al wel op hasPlanTools gated waren). Dit veld was tot nu
      // toe de enige uitzondering: ongeacht tier altijd meegestuurd. De Edge
      // Function negeert body.context voor Free inmiddels ook zelf (server-side,
      // onomzeilbaar), maar deze front-end-gate voorkomt bovendien dat het veld
      // voor Free hier al onnodig wordt opgebouwd en verstuurd.
      context: hasPlanTools && buildContext ? buildContext({ ...store, activeDoc: actiefDoc, linkedProjectId: gekoppeldProjectId }) : null,
      conversationId: actiefGesprekId,
      // Welk project actief is: de server leest dat project (en de
      // organisatie) zelf uit de database, voor de ingelogde gebruiker.
      // Zonder actief project: geen projectcontext.
      activeProgramId: hasPlanTools && isEchtId(gekoppeldProjectId) ? gekoppeldProjectId : null,
      // AI Fundraising Assistant, fase 1: alleen zinvol voor leden met een
      // organisatieprofiel/project (Pro/Premium) - zelfde voorwaarde als
      // orgProfile hierboven, want Free heeft deze gegevens structureel niet.
      matchSignalen: hasPlanTools
        ? buildMatchSignalen({ orgProfile: store.orgProfile, projects: store.projects, linkedProjectId: gekoppeldProjectId })
        : null,
      // Verbetering Projectplan-workflow: geeft de Edge Function eindelijk
      // een betrouwbare, server-side gevalideerde modus door (zie toelichting
      // bij de kompasMode-state hierboven).
      kompasMode: actieveModus,
      // Verstevigen Projectplan-runtime, punten 2/3: het laatst bekende
      // Projectdossier meesturen zodat de Edge Function het kan aanvullen/
      // corrigeren in plaats van het steeds opnieuw te moeten afleiden.
      projectDossier,
      // STAP 5 (streaming): elk woord/fragment dat binnenkomt direct tonen,
      // zodat het lid niet naar een leeg scherm hoeft te staren tijdens een
      // lang antwoord.
      onDelta: (stukje) => setStreamingAntwoord((huidig) => huidig + stukje),
    });

    setLoading(false);
    setStreamingAntwoord('');

    if (res.error) {
      setError(res.error);

      return;
    }

    // STAP 5: bij partial (de verbinding viel onderweg weg, bijv. door een
    // platform-timeout bij een zeer zwaar verzoek) is res.answer de tekst die
    // al binnenkwam vóórdat het misging - nooit stilzwijgend als volledig
    // antwoord tonen, altijd duidelijk gemarkeerd, zowel op het scherm als in
    // de bewaarde gespreksgeschiedenis.
    const inhoud = res.partial
      ? `${res.answer}\n\n_Dit antwoord werd onderbroken door een verbindings- of tijdslimietprobleem. Stel gerust een vervolgvraag om verder te gaan._`
      : res.answer;

    // STAP 3 (websearch): res.sources kwam al langer terug van askKompas()
    // (chat.js gaf data.sources al door), maar werd tot nu toe nergens
    // vastgehouden of getoond. Alleen meegeven aan het berichtobject hier -
    // de weergave zelf staat verderop, direct onder de tekstballon.
    setMessages(nieuw.concat([{ role: 'assistant', content: inhoud, sources: res.sources || [], fromUser: false }]));

    // Verstevigen Projectplan-runtime, punten 2/3: alleen wanneer de Edge
    // Function daadwerkelijk een (nieuw of bijgewerkt) Projectdossier
    // teruggaf - ontbreekt dat (bijv. andere modus, of de extractie leverde
    // niets op), dan blijft het vorige dossier gewoon staan in plaats van dat
    // het hier wordt leeggemaakt.
    if (res.projectDossier) {
      setProjectDossier(res.projectDossier);
      dossierBronnenRef.current = { ...dossierBronnenRef.current, ...(res.projectDossierBronnen || {}) };
    }

    if (hasPlanTools && actiefGesprekId) {
      voegBerichtToe({ conversationId: actiefGesprekId, role: 'assistant', content: inhoud, projectId: gekoppeldProjectId });
      store.upsertGesprekInLijst({ id: actiefGesprekId, tijd: new Date().toISOString() });

      // Verstevigen Projectplan-runtime, punten 1 + 2/3: modus en (indien
      // bijgewerkt) Projectdossier samen met het gesprek opslaan, zodat een
      // latere heropening (openGesprek() hieronder) ze kan herstellen. Best
      // effort, net als de berichten hierboven - mag dit gesprek nooit
      // blokkeren.
      bijwerkenGesprekModusEnDossier({
        conversationId: actiefGesprekId,
        kompasMode: actieveModus,
        projectDossier: res.projectDossier || null,
      });
    }

    // Fase 6: kwam er tijdens dit gesprek een voorstel uit voort (het lid
    // noemde zelf iets dat nog in het profiel ontbrak), toon dat dan ter
    // goedkeuring - nooit automatisch overnemen.
    if (hasPlanTools && res.veldVoorstellen) {
      // Alleen organisatiebrede voorstellen (de server filtert ook; dit is het
      // vangnet aan de clientkant).
      const orgVelden = filterOrganisatieVoorstel(res.veldVoorstellen, {
        projectActief: Boolean(gekoppeldProjectId) || actieveModus === 'projectplan' || actieveModus === 'begroting',
      });

      if (Object.keys(orgVelden).length) {
        setChatVoorstel({
          velden: orgVelden,
          gekozen: Object.fromEntries(Object.keys(orgVelden).map((k) => [k, true])),
        });
      }
    }

    // Projectgegevens uit het gesprek gaan naar het PROJECT (niet naar het
    // organisatieprofiel), met alle waarborgen uit projectKoppeling.js.
    if (hasPlanTools && res.projectDossier) {
      await verwerkProjectDossier({
        dossier: res.projectDossier,
        berichtenLijst: nieuw,
        gesprekId: actiefGesprekId,
      });
    }
  };

  const linkHuidigGesprekAanProject = async (projectId, gesprekId) => {
    setGekoppeldProjectId(projectId);

    if (gesprekId) {
      const ok = await koppelGesprekAanProject(gesprekId, projectId);

      if (ok) {
        store.upsertGesprekInLijst({ id: gesprekId, projectId, tijd: new Date().toISOString() });
      }
    }
  };

  // Beslist wat er met het dossier van dit gesprek gebeurt. Zie
  // bepaalProjectActie() voor de regels: alleen bij een duidelijk signaal,
  // nooit een stil duplicaat, het actieve project is leidend en een door het
  // lid zelf ingevuld veld wordt nooit stilzwijgend overschreven.
  const verwerkProjectDossier = async ({ dossier, berichtenLijst, gesprekId }) => {
    if (verwerkBezigRef.current) return;

    verwerkBezigRef.current = true;

    try {
      const besluit = bepaalProjectActie({
        dossier,
        berichten: berichtenLijst,
        gekoppeldProjectId,
        projecten: store.projects,
        genegeerd: negeerProjectOpslaanRef.current,
      });
      const afgebeeld = dossierNaarProjectVelden(dossier, dossierBronnenRef.current);

      if (besluit.actie === 'bijwerken') {
        const project = (store.projects || []).find((p) => p.id === besluit.projectId);
        const updates = bepaalVeldUpdates(project, afgebeeld);
        const gewijzigd = { ...updates.vulling, ...updates.bijwerking };

        if (Object.keys(gewijzigd).length) {
          const id = await store.werkProjectBij(project.id, updates);

          setProjectMelding(
            id
              ? `Opgeslagen in project "${project.naam || 'Naamloos project'}": ${veldenOpLijst(gewijzigd)}.`
              : `Opslaan in project "${project.naam || 'Naamloos project'}" is niet gelukt.`,
          );
        }

        if (Object.keys(updates.conflicten).length) {
          setProjectConflicten({ projectId: project.id, naam: project.naam, updates });
        }
      } else if (besluit.actie === 'aanmaken') {
        const id = await store.maakProject({ naam: besluit.naam, velden: afgebeeld.velden, bronnen: afgebeeld.bronnen });

        if (id) {
          await linkHuidigGesprekAanProject(id, gesprekId);
          setProjectMelding(
            `Nieuw project "${besluit.naam}" aangemaakt met: ${veldenOpLijst(afgebeeld.velden)}. Dit gesprek hoort nu bij dit project; u vindt het onder Projecten.`,
          );
        } else {
          setProjectMelding('Het project kon niet worden aangemaakt. De gegevens staan nog wel in dit gesprek.');
        }
      } else if (besluit.actie === 'kiezen') {
        setProjectKeuze({ naam: besluit.naam, kandidaten: besluit.kandidaten, afgebeeld, gesprekId });
      }
    } finally {
      verwerkBezigRef.current = false;
    }
  };

  const kiesBestaandProject = async (kandidaat) => {
    if (!projectKeuze) return;

    const { afgebeeld, gesprekId } = projectKeuze;
    const project = (store.projects || []).find((p) => p.id === kandidaat.id);

    setProjectKeuze(null);

    if (!project) return;

    if (project.gearchiveerd) {
      store.archiveProject(project.id, false);
    }

    const updates = bepaalVeldUpdates(project, afgebeeld);

    await store.werkProjectBij(project.id, updates);
    await linkHuidigGesprekAanProject(project.id, gesprekId);

    setProjectMelding(`Opgeslagen in bestaand project "${project.naam || 'Naamloos project'}".`);

    if (Object.keys(updates.conflicten).length) {
      setProjectConflicten({ projectId: project.id, naam: project.naam, updates });
    }
  };

  const maakToch = async () => {
    if (!projectKeuze) return;

    const { naam, afgebeeld, gesprekId } = projectKeuze;

    setProjectKeuze(null);

    const id = await store.maakProject({ naam, velden: afgebeeld.velden, bronnen: afgebeeld.bronnen });

    if (id) {
      await linkHuidigGesprekAanProject(id, gesprekId);
      setProjectMelding(`Nieuw project "${naam}" aangemaakt.`);
    }
  };

  const nietOpslaanInProject = () => {
    negeerProjectOpslaanRef.current = true;
    setProjectKeuze(null);
    setProjectMelding('Prima, de projectgegevens uit dit gesprek worden niet opgeslagen.');
  };

  const overnemenConflicten = async () => {
    if (!projectConflicten) return;

    const { projectId, updates } = projectConflicten;

    setProjectConflicten(null);

    const id = await store.werkProjectBij(projectId, updates, { metConflicten: true });

    setProjectMelding(id ? 'Wijzigingen overgenomen in het project.' : 'Overnemen in het project is niet gelukt.');
  };

  const togglePaneel = (naam) => () => setPaneel(paneel === naam ? null : naam);

  const nieuweChat = () => {
    setMessages([]);
    setDraft('');
    setError('');
    setConversationId(null);
    setGekoppeldProjectId(null);
    setChatVoorstel(null);
    setKompasMode('algemeen');
    // Verstevigen Projectplan-runtime, punten 2/3: een nieuw gesprek begint
    // met een leeg Projectdossier - anders zou het dossier van het vorige
    // gesprek onbedoeld blijven meelopen.
    setProjectDossier(null);
    dossierBronnenRef.current = {};
    negeerProjectOpslaanRef.current = false;
    setProjectMelding('');
    setProjectKeuze(null);
    setProjectConflicten(null);
  };

  // Haalt de berichten van een eerder gesprek op (lazy - de lijst zelf bevat
  // ze niet, zie gesprekken.js) en maakt dat gesprek weer actief, inclusief
  // de eventuele projectkoppeling.
  const openGesprek = async (h) => {
    if (historieLaadId) return;

    setHistorieLaadId(h.id);

    const berichten = await haalBerichtenOp(h.id);
    // Verstevigen Projectplan-runtime, punt 1 (het eigenlijke lek): tot nu
    // toe herstelde het heropenen van een gesprek alleen de berichten, nooit
    // de modus - een Projectplan-gesprek viel zo ongemerkt terug op
    // 'algemeen' zodra het lid het later weer opende. Nu wordt, samen met de
    // berichten, ook de laatst opgeslagen modus en het Projectdossier
    // hersteld (zie gesprekken.js).
    const { kompasMode: opgeslagenModus, projectDossier: opgeslagenDossier } = await haalGesprekModusEnDossier(h.id);

    setMessages(berichten);
    setConversationId(h.id);
    // Alleen een project dat nog bestaat en niet gearchiveerd is blijft actief.
    const bekend = (store.projects || []).find((p) => p.id === h.projectId);

    setGekoppeldProjectId(h.projectId && bekend && !bekend.gearchiveerd ? h.projectId : null);
    setKompasMode(opgeslagenModus);
    setProjectDossier(opgeslagenDossier);
    dossierBronnenRef.current = {};
    negeerProjectOpslaanRef.current = false;
    setProjectMelding('');
    setProjectKeuze(null);
    setProjectConflicten(null);
    setDraft('');
    setError('');
    setChatVoorstel(null);
    setHistorieLaadId(null);
  };

  // Koppelt (of ontkoppelt) het actieve gesprek aan een project - punt 6/7
  // uit het oorspronkelijke verzoek. Bij een nog niet bewaard gesprek
  // (conversationId is null) wordt alleen de lokale keuze onthouden; die gaat
  // dan mee zodra verstuur() het gesprek aanmaakt.
  const koppelProject = async (projectId) => {
    const genormaliseerd = projectId || null;

    if (genormaliseerd === gekoppeldProjectId) return;

    // Wissel van project = echt wisselen van context. Staat er al een gesprek,
    // dan begint er een NIEUW gesprek voor het gekozen project (of zonder
    // project): berichten, dossier en eerdere extracties van het vorige project
    // lopen zo nooit mee. Het vorige gesprek blijft bewaard onder "Eerdere
    // gesprekken".
    if (messages.length > 0 || conversationId) {
      const naam = genormaliseerd ? (store.projects || []).find((p) => p.id === genormaliseerd)?.naam || 'Naamloos project' : null;

      nieuweChat();
      setGekoppeldProjectId(genormaliseerd);
      setProjectMelding(
        naam
          ? `Nieuw gesprek gestart voor project "${naam}". Het vorige gesprek vindt u terug onder Eerdere gesprekken.`
          : 'Nieuw gesprek gestart zonder actief project. Het vorige gesprek vindt u terug onder Eerdere gesprekken.',
      );

      return;
    }

    setGekoppeldProjectId(genormaliseerd);
    setProjectDossier(null);
    dossierBronnenRef.current = {};
    setProjectKeuze(null);
    setProjectConflicten(null);
    setProjectMelding('');
  };

  // Is het gekoppelde project verwijderd of gearchiveerd (bijv. via het
  // Projecten-paneel), dan heeft dit gesprek geen actief project meer.
  useEffect(() => {
    (store.projects || []).forEach((p) => gezienProjectenRef.current.add(p.id));

    if (gekoppeldProjectId && gezienProjectenRef.current.has(gekoppeldProjectId)) {
      const p = (store.projects || []).find((x) => x.id === gekoppeldProjectId);

      if (!p || p.gearchiveerd) {
        setGekoppeldProjectId(null);
        setProjectDossier(null);
        dossierBronnenRef.current = {};
        setProjectMelding('Het gekoppelde project is verwijderd of gearchiveerd; dit gesprek heeft nu geen actief project.');

        if (conversationId) {
          koppelGesprekAanProject(conversationId, null);
        }
      }
    }
  }, [store.projects, gekoppeldProjectId]);

  // Vervolgopdracht, prioriteit 7 (Export). Vier acties onder een "groot"
  // AI-resultaat - hergebruikt bestaande mechanismen, geen nieuwe opslag:
  // - Kopiëren: alleen het klembord.
  // - Opslaan bij project: hangt de tekst als documenten aan het gekoppelde
  //   project (addGeneratedDocToProject -> project.docs -> dezelfde
  //   subsidie_kompas_knowledge_items-opslag als een geüpload document).
  // - Exporteren naar Word: puur client-side, geen nieuwe bibliotheek - een
  //   .doc-bestand is hier een HTML-document met de klassieke Word-headers,
  //   dat Word/LibreOffice/Google Docs als Word-document herkent en opent.
  // - Later verder bewerken: zet actiefDoc lokaal, zelfde vorm als
  //   Documentatie's openInChat hierboven, zodat buildContext() dit gesprek
  //   automatisch weer als "verder werken aan ..." aanmerkt.
  const kopieerBericht = async (tekst) => {
    try {
      await navigator.clipboard.writeText(tekst);
      setResultaatMelding('Gekopieerd naar het klembord.');
    } catch (e) {
      setResultaatMelding('Kopiëren is niet gelukt in deze browser.');
    }
  };

  // RC1 stap 3B (2026-10-01): vervangt de vorige HTML-als-".doc"-truc door een
  // echte .docx (OOXML), opgebouwd via de bestaande Document Theme Engine.
  // Knop, zichtbaarheid (hasPlanTools) en de aanroep hiervan blijven exact
  // ongewijzigd - uitsluitend de implementatie van deze ene functie verandert.
  // Bevat UITSLUITEND de tekst van het aangeklikte chatbericht (`tekst`, exact
  // zoals het lid dat al zag) plus, indien beschikbaar, de organisatienaam uit
  // het al bestaande organisatieprofiel (`store.orgProfile?.name`, dezelfde
  // bron als de contextchip "Organisatie: ..." verderop op deze pagina) - geen
  // system prompt, runtimecontext, Projectdossier-bronnen, matchscores of
  // andere interne/server-side gegevens worden hier ooit aan meegegeven.
  const exporteerAlsWord = async (tekst, naam) => {
    try {
      const organisatieNaam = store.orgProfile?.name || null;
      const content = normalizeDocumentContent(tekst);
      const blob = await generateWordDocument({
        title: naam || 'Subsidie Kompas',
        documentType: naam || undefined,
        organizationName: organisatieNaam,
        content,
      });

      const veiligeBestandsnaam = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim();
      const documentNaam = veiligeBestandsnaam(naam) || 'Projectplan';
      const bestandsnaam = organisatieNaam
        ? `${documentNaam} - ${veiligeBestandsnaam(organisatieNaam)}.docx`
        : `Subsidie Kompas - ${documentNaam}.docx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = bestandsnaam;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setResultaatMelding('Word-bestand wordt gedownload.');
    } catch (e) {
      // Geen stille failure: de gebruiker krijgt dezelfde zichtbare melding
      // als bij de andere export-/opslagacties op deze pagina (zie
      // kopieerBericht hierboven) in plaats van dat er niets gebeurt.
      setResultaatMelding('Het genereren van het Word-bestand is niet gelukt. Probeer het opnieuw.');
    }
  };

  // RC1 stap 3D-4 (2026-10-01): "Exporteren naar Excel" - uitsluitend
  // zichtbaar tijdens een echte begrotingsworkflow (zie de knop verderop,
  // additioneel gated op kompasMode === 'begroting'). Flow exact zoals
  // opgedragen: begrotingstekst -> haalBudgetUitTekst() (Edge Function, pure
  // transcriptie, geen rekenwerk) -> berekenBudget() (hier, client-side, de
  // enige rekenkundige waarheid) -> bij een blokkerende fout (geen bruikbare
  // kostenregels) een duidelijke melding en GEEN leeg/fictief Excelbestand;
  // anders een echte .xlsx-download, ook wanneer de begroting nog niet
  // sluit (dat verschil wordt dan juist expliciet getoond, nooit verborgen).
  // Geen tweede validator: berekenBudget() en de eigen defensieve controle
  // in generateExcelDocument() gebruiken hetzelfde waarschuwingen-resultaat.
  const exporteerAlsExcel = async (tekst) => {
    setResultaatMelding('Begroting wordt geanalyseerd...');

    try {
      const { budget: ruwBudget, error: extractieFout } = await haalBudgetUitTekst({ tekst });

      if (extractieFout || !ruwBudget) {
        setResultaatMelding(extractieFout || 'De begroting kon niet worden geanalyseerd. Probeer het opnieuw.');

        return;
      }

      const project = (store.projects || []).find((p) => p.id === gekoppeldProjectId) || null;
      const budget = berekenBudget(ruwBudget.expenseLines, project, ruwBudget.meta);
      const bruikbareRegels = budget.expenseLines.filter((r) => r.bedrag != null).length;

      if (bruikbareRegels === 0) {
        setResultaatMelding(
          'Er is geen enkele bruikbare kostenregel gevonden in deze begroting. Werk de begroting verder uit in het gesprek en probeer het daarna opnieuw.',
        );

        return;
      }

      const organisatieNaam = store.orgProfile?.name || null;
      const blob = await generateExcelDocument({ budget, project, organizationName: organisatieNaam });
      const bestandsnaam = bepaalExcelBestandsnaam({ project, organizationName: organisatieNaam });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = bestandsnaam;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResultaatMelding(
        budget.totals.isSluitend
          ? 'Excel-bestand wordt gedownload.'
          : 'Excel-bestand wordt gedownload. Let op: deze begroting is nog niet sluitend - het verschil staat duidelijk op het tabblad Dekkingsplan.',
      );
    } catch (e) {
      setResultaatMelding('Het genereren van het Excel-bestand is niet gelukt. Probeer het opnieuw.');
    }
  };

  const bewaarBijProject = (tekst, soort) => {
    if (!gekoppeldProjectId) {
      setResultaatMelding('Koppel eerst een project aan dit gesprek om te kunnen opslaan.');

      return;
    }

    // Documentniveau: een fonds en documentspecifieke instructies horen bij
    // dit ene document en veranderen het project nooit. Een nieuwe generatie
    // voor hetzelfde fonds wordt een nieuwe versie; de vorige blijft bestaan.
    const fondsRuw = String((projectDossier && projectDossier.fondsKeuze) || '').trim();
    const fonds = /^(generiek|algemeen|geen|nvt|n\.v\.t\.?)$/i.test(fondsRuw) ? '' : fondsRuw;
    const instructies = String((projectDossier && projectDossier.documentinstructies) || '').trim();
    const context = {};

    if (fonds) context.fonds = fonds;
    if (instructies) context.instructies = instructies;

    const naam = `${soort}${fonds ? ` voor ${fonds}` : ''} — concept van ${new Date().toLocaleDateString('nl-NL')}`;

    store.addGeneratedDocToProject(gekoppeldProjectId, { naam, soort, grootte: '', tekst, context });
    setResultaatMelding(`Opgeslagen als "${naam}" bij het project (als nieuwe versie; eerdere versies blijven bewaard).`);
  };

  const bewerkVerder = (soort) => {
    const naam = `${soort} — concept van ${new Date().toLocaleDateString('nl-NL')}`;

    setActiefDoc({ id: null, naam, soort, projectId: gekoppeldProjectId || '' });
    setResultaatMelding(`U werkt nu verder aan "${naam}".`);
  };

  // Neemt de aangevinkte velden uit het gespreksvoorstel over in het profiel,
  // met herkomst 'gesprek' (zie organisatieprofiel.js's bronLabel) en het
  // gesprek zelf als referentie.
  const overnemenChatVoorstel = () => {
    if (!chatVoorstel) return;

    const gekozenVelden = Object.fromEntries(
      Object.entries(chatVoorstel.velden).filter(([k]) => chatVoorstel.gekozen[k]),
    );

    store.overnemenOrgVelden(gekozenVelden, 'gesprek', conversationId);
    setChatVoorstel(null);
  };

  return (
    <div data-screen-label="Subsidie Kompas" style={css('min-height: 100vh; position: relative; z-index: 1;')}>
      {/* SUBNAVIGATIE: gedeelde Subsidie Kompas-kop (met de Subsidie Kompas-knop rechtsboven) */}
      <KompasSubnav terugNaarKompas={false} toonPlan />

      {/* HERO */}
      <div style={css('position: relative; z-index: 1; max-width: 850px; margin: 72px auto 0; padding: 0 clamp(16px, 4vw, 24px); text-align: center;')}>
        <img
          src="/uploads/kompas-logo.png"
          alt="Subsidie Kompas"
          style={css('width: 78px; height: 78px; border-radius: 50%; object-fit: contain; display: inline-block;')}
        />
        <div style={css("margin-top: 18px; font-family: 'Newsreader', serif; font-size: 21px; font-weight: 600; color: #4E9A6C;")}>
          Subsidie Kompas
        </div>
        <div
          style={css(
            "margin: 12px 0 22px; font-family: 'Newsreader', serif; font-size: clamp(34px, 7vw, 56px); font-weight: 600; line-height: 1.08; color: #2C4A5E;",
          )}
        >
          Uw gids bij fondsenwerving
        </div>
        <div style={css('max-width: 710px; margin: 0 auto; font-size: 18px; line-height: 1.65; color: #4B5C58;')}>
          Subsidie Kompas helpt u aan projectfinanciering: passende fondsen, een concrete strategie en begeleiding bij
          de aanvraag.
        </div>
      </div>

      <div style={css('position: relative; z-index: 1; max-width: 1040px; margin: 54px auto 80px; padding: 0 clamp(16px, 4vw, 24px);')}>
        {/* PILLEN */}
        <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;')}>
          {hasPlanTools && (
            <>
              <button type="button" onClick={nieuweChat} style={pil(false)}>
                + Nieuwe chat
              </button>
              <button type="button" onClick={togglePaneel('historie')} style={pil(paneel === 'historie')}>
                Eerdere gesprekken ({gesprekken.length})
              </button>
              <button type="button" onClick={togglePaneel('org')} style={pil(paneel === 'org')}>
                Organisatie
              </button>
              <button type="button" onClick={togglePaneel('proj')} style={pil(paneel === 'proj')}>
                Projecten
              </button>
              <button type="button" onClick={togglePaneel('doc')} style={{ ...pil(paneel === 'doc'), gap: '8px' }}>
                Documenten
                <span style={css('font-size: 12px; font-weight: 700; opacity: 0.7;')}>{documenten.length}</span>
              </button>

              {(store.projects || []).filter((p) => !p.gearchiveerd).length > 0 && (
                <select
                  value={gekoppeldProjectId || ''}
                  onChange={(e) => koppelProject(e.target.value || null)}
                  aria-label="Koppel dit gesprek aan een project"
                  style={css(
                    'cursor: pointer; box-sizing: border-box; min-height: 38px; padding: 8px 16px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-size: 13.5px; font-weight: 800;',
                  )}
                >
                  <option value="">Geen actief project</option>
                  {store.projects.filter((p) => !p.gearchiveerd).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.naam || 'Naamloos project'}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        {/* Vervolgopdracht, prioriteit 4 (Contexttabs): compact, alleen-lezen
            overzicht van welke context de AI op dit moment heeft - geen
            groot paneel, alleen de chips die de opdracht zelf noemt en die
            vandaag ook echt bepaald kunnen worden (Fonds/Regeling ontbreken
            bewust: er bestaat nog geen fonds-/regelingselector in de chat -
            zie het architectuuroverzicht). */}
        {hasPlanTools && (
          <div style={css('display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: -6px 0 16px; font-size: 12.5px; color: #7B8985;')}>
            <span style={css('font-weight: 700; color: #9CA9A5;')}>Context:</span>
            <span style={contextChipStijl}>
              Actief project: {(store.projects || []).find((p) => p.id === gekoppeldProjectId)?.naam || 'geen'}
            </span>
            <span style={contextChipStijl}>Organisatie: {store.orgProfile?.name || 'niet ingevuld'}</span>
            <span style={contextChipStijl}>
              Documenten: {((store.projects || []).find((p) => p.id === gekoppeldProjectId)?.docs || []).length}
            </span>
          </div>
        )}

        {/* CONTEXTPANEEL (Organisatie/Projecten/Documenten/Context): Vervolgopdracht
            "Verbeter UX contextpanelen rondom Subsidie Kompas chat" (2026-10-01).
            De vier vroegere losse, boven de chat gerenderde blokken (Eerdere
            gesprekken, Documentatie, Projecten, Organisatie) zijn hier
            samengevoegd tot één compact, uitschuifbaar paneel met tabbladen
            (KompasContextDrawer), zodat de chat altijd direct zichtbaar blijft
            en niet meer naar beneden wordt geduwd. De inhoud van elk tabblad
            is ongewijzigd - dezelfde componenten, dezelfde state, dezelfde
            data - alleen de lay-out eromheen is veranderd. */}
        {hasPlanTools && (
          <KompasContextDrawer
            active={paneel}
            onSelect={setPaneel}
            onClose={() => setPaneel(null)}
            tabs={{
              org: { label: 'Organisatie', content: <OrganisatieprofielPage embedded /> },
              proj: { label: 'Projecten', content: <ProjectenPage embedded /> },
              doc: { label: 'Documenten', badge: documenten.length, content: <DocumentatiePage embedded /> },
              historie: {
                label: 'Context',
                content: (
                  <>
                    <div style={css("margin-bottom: 18px; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E;")}>
                      Eerdere gesprekken
                    </div>

                    <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                      {gesprekken.map((h) => (
                        <div
                          key={h.id}
                          style={css(
                            'display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; min-height: 44px; padding: 13px 16px; border: 1px solid #E1EAE4; border-radius: 14px;',
                          )}
                        >
                          <span
                            onClick={() => openGesprek(h)}
                            role="button"
                            tabIndex={0}
                            style={css('cursor: pointer; flex: 1 1 220px; min-width: 0; color: #2C4A5E; font-size: 14.5px; font-weight: 700;')}
                          >
                            {h.titel}
                          </span>
                          <span style={css('display: flex; align-items: center; gap: 16px;')}>
                            <span style={css('color: #7B8985; font-size: 13px;')}>{historieLaadId === h.id ? 'Laden…' : formatDatum(h.tijd)}</span>
                            <span
                              onClick={() => {
                                store.deleteConversation(h.id);

                                if (h.id === conversationId) {
                                  nieuweChat();
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              style={css('cursor: pointer; min-height: 44px; display: flex; align-items: center; color: #9E3B2C; font-size: 13px; font-weight: 700;')}
                            >
                              Verwijderen
                            </span>
                          </span>
                        </div>
                      ))}

                      {gesprekken.length === 0 && (
                        <div style={css('padding: 20px 16px; border: 1px dashed #D5E0D9; border-radius: 14px; font-size: 14.5px; line-height: 1.6; color: #7B8985;')}>
                          Nog geen bewaarde gesprekken. Zodra u een vraag stelt, bewaart Subsidie Kompas het gesprek hier zodat
                          u er later op terug kunt komen.
                        </div>
                      )}

                      <div
                        onClick={nieuweChat}
                        role="button"
                        tabIndex={0}
                        style={css(
                          'cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center; padding: 12px 20px; border: 1px solid #D6E3E9; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-size: 13.5px; font-weight: 800;',
                        )}
                      >
                        + Nieuw gesprek
                      </div>
                    </div>

                    <div style={css('margin-top: 16px; padding-top: 16px; border-top: 1px solid #E1EAE4;')}>
                      <div style={css('margin-bottom: 6px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>Gegevens verwijderen</div>
                      <div style={css('margin-bottom: 16px; font-size: 14px; line-height: 1.65; color: #536460;')}>
                        U bepaalt zelf wat Subsidie Kompas van u bewaart. Verwijderen kan niet worden teruggedraaid; wat u
                        weghaalt gebruikt Subsidie Kompas niet meer in adviezen en aanvragen.
                      </div>
                      <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
                        <div
                          onClick={() => {
                            store.clearConversations();
                            nieuweChat();
                            setAccountMsg('Alle gesprekken zijn verwijderd.');
                          }}
                          role="button"
                          style={css(
                            'cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center; padding: 12px 20px; border: 1px solid #E1D3D0; border-radius: 999px; background: #FFFFFF; color: #9E3B2C; font-size: 14px; font-weight: 700;',
                          )}
                        >
                          Alle gesprekken verwijderen
                        </div>
                        <div
                          onClick={() => {
                            store.clearOrgProfile();
                            setAccountMsg('De informatie over uw organisatie is verwijderd.');
                          }}
                          role="button"
                          style={css(
                            'cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center; padding: 12px 20px; border: 1px solid #E1D3D0; border-radius: 999px; background: #FFFFFF; color: #9E3B2C; font-size: 14px; font-weight: 700;',
                          )}
                        >
                          Informatie over mijn organisatie verwijderen
                        </div>
                      </div>

                      {accountMsg && (
                        <div
                          style={css(
                            'margin-top: 16px; padding: 13px 16px; border: 1px solid #BFD4C6; border-radius: 12px; background: #EAF4EE; font-size: 14.5px; font-weight: 700; color: #2F6D47;',
                          )}
                        >
                          {accountMsg}
                        </div>
                      )}
                    </div>
                  </>
                ),
              },
            }}
          />
        )}

        {/* UPGRADE */}
        {upgradeOpen && (
          <div
            style={css(
              'position: fixed; inset: 0; z-index: 300; background: rgba(33,56,74,0.5); display: flex; align-items: center; justify-content: center; padding: 20px;',
            )}
          >
            <div style={css('max-width: 460px; width: 100%; padding: clamp(24px, 3vw, 34px); border-radius: 22px; background: #FFFFFF;')}>
              <div style={css("margin-bottom: 10px; font-family: 'Newsreader', serif; font-size: 24px; font-weight: 600; color: #2C4A5E;")}>
                Automatisch uw organisatieprofiel laten opbouwen?
              </div>
              <div style={css('margin-bottom: 18px; font-size: 15px; line-height: 1.7; color: #4B5C58;')}>
                Met Pro en Premium analyseert Subsidie Kompas uw website en bouwt automatisch een organisatieprofiel op.
                Dit bespaart tijd en zorgt voor betere fondsselecties en nauwkeurigere AI-adviezen.
              </div>
              <div style={css('display: flex; gap: 12px; flex-wrap: wrap;')}>
                <a
                  href="#/hoe-het-werkt"
                  onClick={() => setUpgradeOpen(false)}
                  style={css(
                    'box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 22px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-size: 14.5px; font-weight: 800;',
                  )}
                >
                  Bekijk Pro
                </a>
                <div
                  onClick={() => setUpgradeOpen(false)}
                  role="button"
                  style={css(
                    'cursor: pointer; box-sizing: border-box; min-height: 44px; display: flex; align-items: center; padding: 12px 22px; border-radius: 999px; border: 1px solid #E1EAE4; background: #FFFFFF; color: #2C4A5E; font-size: 14.5px; font-weight: 700;',
                  )}
                >
                  Misschien later
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHATVENSTER */}
        <div style={css('overflow: hidden; border-radius: 30px; background: #EAF1F6; box-shadow: 0 15px 45px rgba(44,74,94,0.08);')}>
          <div style={css('padding: 14px 22px; display: flex; align-items: center; gap: 11px; border-bottom: 1px solid #D6E3E9; background: #FFFFFF;')}>
            <img
              src="/uploads/kompas-logo.png"
              alt="Subsidie Kompas"
              style={css('width: 38px; height: 38px; border-radius: 50%; object-fit: contain; display: block;')}
            />
            <div>
              <div style={css('color: #2C4A5E; font-size: 15px; font-weight: 800;')}>Subsidie Kompas</div>
              <div style={css('margin-top: 2px; color: #6B7B77; font-size: 11.5px;')}>Adviseur voor subsidies en fondsenwerving</div>
            </div>
            <div style={css('margin-left: auto; display: flex; align-items: center; gap: 10px;')}>
              <span style={css('width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C;')} />
              <span style={css('color: #667873; font-size: 12px;')}>online</span>
              {toonStatusBadge && (
                <div
                  style={css(
                    'padding: 6px 10px; border: 1px solid #DCE5E1; border-radius: 999px; background: #F7F9F8; color: #6B7B77; font-size: 10.5px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;',
                  )}
                >
                  {planLabel}
                </div>
              )}
            </div>
          </div>

          {messages.length === 0 && (
            <div style={css('padding: clamp(20px, 3.4vw, 34px);')}>
              <div style={css('display: flex; justify-content: flex-start; margin-bottom: 28px;')}>
                <div
                  style={css(
                    'max-width: 72%; padding: 20px 22px; border-radius: 24px 24px 24px 5px; background: #FFFFFF; color: #2E3A38; box-shadow: 0 2px 10px rgba(44,74,94,0.035); font-size: 15px; line-height: 1.68;',
                  )}
                >
                  Goedendag, ik ben Subsidie Kompas. Waarmee kan ik u vandaag helpen?
                </div>
              </div>
              <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(max(240px, calc(50% - 7px)), 1fr)); gap: 14px;')}>
                {STARTERS.map((s) => (
                  <div
                    key={s}
                    onClick={() => {
                      // Verbetering Projectplan-workflow: alleen deze ene
                      // starter geeft een modus mee - de andere drie
                      // starters/vrije berichten blijven ongewijzigd op
                      // 'algemeen', zoals nu al het geval is.
                      verstuur(s, s === 'Help mij een projectplan opzetten' ? 'projectplan' : undefined);
                    }}
                    style={css(
                      'cursor: pointer; min-height: 78px; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border: 1px solid #D7E2DC; border-radius: 18px; background: #FFFFFF; color: #2C4A5E; font-size: 14.5px; font-weight: 700; line-height: 1.4;',
                    )}
                  >
                    <span>{s}</span>
                    <span>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div
              ref={scrollRef}
              style={css(
                'min-height: min(500px, 58vh); max-height: 660px; overflow-y: auto; padding: clamp(20px, 3vw, 30px) clamp(18px, 3.4vw, 34px) 24px; display: flex; flex-direction: column; gap: 18px;',
              )}
            >
              {messages.map((m, i) =>
                m.fromUser ? (
                  <div
                    key={i}
                    style={css(
                      'align-self: flex-end; max-width: 72%; padding: 17px 22px; border-radius: 24px 24px 5px 24px; background: #2C4A5E; color: #FFFFFF; font-size: 15px; line-height: 1.65; white-space: pre-wrap;',
                    )}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div key={i} style={css('align-self: flex-start; max-width: 78%; display: flex; flex-direction: column; gap: 8px;')}>
                    <div
                      style={css(
                        'padding: 20px 22px; border-radius: 24px 24px 24px 5px; background: #FFFFFF; color: #2E3A38; box-shadow: 0 2px 10px rgba(44,74,94,0.035); font-size: 15px; line-height: 1.68; white-space: pre-wrap;',
                      )}
                    >
                      {m.content}
                    </div>

                    {/* STAP 3 (websearch): alleen zichtbaar als het antwoord
                        daadwerkelijk op websearch-bronnen steunt - geen
                        nieuw scherm, alleen een compact lijstje onder de
                        bestaande tekstballon. */}
                    {Array.isArray(m.sources) && m.sources.length > 0 && (
                      <div
                        style={css(
                          'padding-left: 6px; font-size: 12.5px; line-height: 1.6; color: #5B6D74;',
                        )}
                      >
                        Bronnen:
                        <ul style={css('margin: 4px 0 0; padding-left: 18px;')}>
                          {m.sources.map((bron, j) => (
                            <li key={j}>
                              <a
                                href={bron.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={css('color: #2C4A5E; text-decoration: underline;')}
                              >
                                {bron.title || bron.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Vervolgopdracht, prioriteit 7 (Export): alleen onder een
                        "groot" AI-resultaat, en alleen voor Pro/Premium/Admin -
                        Free heeft toch geen projecten/documentatie om iets bij
                        op te slaan. */}
                    {hasPlanTools && m.content.length > 350 && (
                      <div style={css('display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-left: 6px;')}>
                        <button type="button" onClick={() => kopieerBericht(m.content)} style={actieKnopStijl}>
                          Kopiëren
                        </button>
                        <select
                          value={resultaatSoort[i] || DOC_SOORTEN[0]}
                          onChange={(e) => setResultaatSoort((cur) => ({ ...cur, [i]: e.target.value }))}
                          aria-label="Soort document"
                          style={css(
                            'cursor: pointer; box-sizing: border-box; min-height: 30px; padding: 4px 10px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-size: 12.5px; font-weight: 700;',
                          )}
                        >
                          {DOC_SOORTEN.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => bewaarBijProject(m.content, resultaatSoort[i] || DOC_SOORTEN[0])}
                          style={actieKnopStijl}
                        >
                          Opslaan bij project
                        </button>
                        <button
                          type="button"
                          onClick={() => exporteerAlsWord(m.content, resultaatSoort[i] || DOC_SOORTEN[0])}
                          style={actieKnopStijl}
                        >
                          Exporteren naar Word
                        </button>
                        {kompasMode === 'begroting' && (
                          <button type="button" onClick={() => exporteerAlsExcel(m.content)} style={actieKnopStijl}>
                            Exporteren naar Excel
                          </button>
                        )}
                        <button type="button" onClick={() => bewerkVerder(resultaatSoort[i] || DOC_SOORTEN[0])} style={actieKnopStijl}>
                          Later verder bewerken
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}

              {loading && (streamingAntwoord ? (
                <div style={css('align-self: flex-start; max-width: 78%; display: flex; flex-direction: column; gap: 8px;')}>
                  <div
                    style={css(
                      'padding: 20px 22px; border-radius: 24px 24px 24px 5px; background: #FFFFFF; color: #2E3A38; box-shadow: 0 2px 10px rgba(44,74,94,0.035); font-size: 15px; line-height: 1.68; white-space: pre-wrap;',
                    )}
                  >
                    {streamingAntwoord}
                  </div>
                </div>
              ) : (
                <DenkKompas />
              ))}
            </div>
          )}

          {error && (
            <div style={css('margin: 0 clamp(14px, 3vw, 28px) 14px; padding: 12px 15px; border-radius: 12px; background: #FFF1EF; color: #A13B2F; font-size: 13px;')}>
              {error}
            </div>
          )}

          <div style={css('padding: 6px clamp(14px, 3vw, 28px) 30px;')}>
            {/* Vervolgopdracht, prioriteit 7 (Export): korte bevestiging na
                Kopiëren/Opslaan bij project/Exporteren/Later verder bewerken -
                zelfde compacte, gedempte stijl als accountMsg hierboven. */}
            {resultaatMelding && (
              <div
                style={css(
                  'margin-bottom: 10px; padding: 10px 14px; border: 1px solid #BFD4C6; border-radius: 12px; background: #EAF4EE; font-size: 13px; font-weight: 700; color: #2F6D47;',
                )}
              >
                {resultaatMelding}
              </div>
            )}

            {projectMelding && (
              <div
                style={css(
                  'margin-bottom: 10px; padding: 10px 14px; border: 1px solid #BFD4C6; border-radius: 12px; background: #EAF4EE; font-size: 13px; font-weight: 700; color: #2F6D47; display: flex; align-items: center; justify-content: space-between; gap: 12px;',
                )}
              >
                <span>{projectMelding}</span>
                <span
                  onClick={() => setProjectMelding('')}
                  role="button"
                  tabIndex={0}
                  aria-label="Melding sluiten"
                  style={css('cursor: pointer; color: #2F6D47; font-size: 16px; font-weight: 700;')}
                >
                  ×
                </span>
              </div>
            )}

            {projectKeuze && (
              <div style={css('margin-bottom: 14px; padding: 18px; border: 1px solid #D6E3E9; border-radius: 16px; background: #EAF1F6;')}>
                <div style={css('margin-bottom: 10px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
                  U heeft al een project met een vergelijkbare naam. Waar moeten de projectgegevens uit dit gesprek heen?
                </div>
                <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
                  {projectKeuze.kandidaten.map((k) => (
                    <div
                      key={k.id}
                      onClick={() => kiesBestaandProject(k)}
                      role="button"
                      tabIndex={0}
                      style={css(
                        'cursor: pointer; box-sizing: border-box; min-height: 40px; display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 13.5px; font-weight: 800;',
                      )}
                    >
                      Opslaan in "{k.naam || 'Naamloos project'}"{k.gearchiveerd ? ' (terugzetten)' : ''}
                    </div>
                  ))}
                  <div
                    onClick={maakToch}
                    role="button"
                    tabIndex={0}
                    style={css(
                      'cursor: pointer; box-sizing: border-box; min-height: 40px; display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-size: 13.5px; font-weight: 700;',
                    )}
                  >
                    Nieuw project aanmaken
                  </div>
                  <div
                    onClick={nietOpslaanInProject}
                    role="button"
                    tabIndex={0}
                    style={css(
                      'cursor: pointer; box-sizing: border-box; min-height: 40px; display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-size: 13.5px; font-weight: 700;',
                    )}
                  >
                    Niet opslaan
                  </div>
                </div>
              </div>
            )}

            {projectConflicten && (
              <div style={css('margin-bottom: 14px; padding: 18px; border: 1px solid #E9D9A8; border-radius: 16px; background: #FBF6E4;')}>
                <div style={css('margin-bottom: 10px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
                  In dit gesprek staat iets anders dan in uw project "{projectConflicten.naam || 'Naamloos project'}". Uw eigen invoer is niet overschreven.
                </div>
                <div style={css('display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 13.5px; color: #3D4B48;')}>
                  {Object.entries(projectConflicten.updates.conflicten).map(([veld, c]) => (
                    <div key={veld}>
                      <strong>{veldenOpLijst({ [veld]: 1 })}:</strong> nu "{Array.isArray(c.huidig) ? c.huidig.join(', ') : c.huidig}" — in gesprek "{c.nieuw}"
                    </div>
                  ))}
                </div>
                <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
                  <div
                    onClick={overnemenConflicten}
                    role="button"
                    tabIndex={0}
                    style={css(
                      'cursor: pointer; box-sizing: border-box; min-height: 40px; display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 13.5px; font-weight: 800;',
                    )}
                  >
                    Overnemen in het project
                  </div>
                  <div
                    onClick={() => setProjectConflicten(null)}
                    role="button"
                    tabIndex={0}
                    style={css(
                      'cursor: pointer; box-sizing: border-box; min-height: 40px; display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-size: 13.5px; font-weight: 700;',
                    )}
                  >
                    Huidige waarde houden
                  </div>
                </div>
              </div>
            )}

            {actiefDoc && (
              <div
                style={css(
                  'margin-bottom: 10px; display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px; border: 1px solid #D6E3E9; border-radius: 999px; background: #FFFFFF;',
                )}
              >
                <span style={css('font-size: 12.5px; font-weight: 700; color: #2C4A5E;')}>Werkt verder aan: {actiefDoc.naam}</span>
                <span
                  onClick={() => setActiefDoc(null)}
                  role="button"
                  tabIndex={0}
                  aria-label="Document losmaken"
                  style={css('cursor: pointer; color: #7B8985; font-size: 14px; font-weight: 700;')}
                >
                  ×
                </span>
              </div>
            )}

            {chatVoorstel && (
              <div
                style={css(
                  'margin-bottom: 14px; padding: 18px; border: 1px solid #BFD4C6; border-radius: 16px; background: #EAF4EE;',
                )}
              >
                <div style={css('margin-bottom: 10px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
                  Dit lijkt organisatiebrede informatie. Toevoegen aan uw organisatieprofiel?
                </div>
                <div style={css('margin: -4px 0 12px; font-size: 12.5px; color: #4B5C58;')}>
                  Gegevens over één project slaan we niet hier op, maar in het project zelf.
                </div>
                <div style={css('display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;')}>
                  {Object.entries(chatVoorstel.velden).map(([veld, waarde]) => {
                    const def = VELDEN.find((f) => f.n === veld);

                    return (
                      <label key={veld} style={css('display: flex; align-items: flex-start; gap: 10px; cursor: pointer;')}>
                        <input
                          type="checkbox"
                          checked={!!chatVoorstel.gekozen[veld]}
                          onChange={(e) =>
                            setChatVoorstel((cur) => ({
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
                  <div
                    onClick={overnemenChatVoorstel}
                    role="button"
                    tabIndex={0}
                    style={css(
                      'cursor: pointer; box-sizing: border-box; min-height: 40px; display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 13.5px; font-weight: 800;',
                    )}
                  >
                    Overnemen in organisatieprofiel
                  </div>
                  <div
                    onClick={() => setChatVoorstel(null)}
                    role="button"
                    tabIndex={0}
                    style={css(
                      'cursor: pointer; box-sizing: border-box; min-height: 40px; display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; border: 1px solid #D6E3E9; background: #FFFFFF; color: #2C4A5E; font-size: 13.5px; font-weight: 700;',
                    )}
                  >
                    Niet overnemen
                  </div>
                </div>
              </div>
            )}

            <div style={css('display: flex; align-items: flex-end; gap: 10px; padding: 10px 10px 10px 20px; border-radius: 26px; background: #FFFFFF;')}>
              {app.canUploadFiles && (
                <>
                  <input
                    ref={bestandRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv"
                    onChange={voegDocumentToe}
                    style={css('display: none;')}
                  />
                  <div
                    onClick={() => !attachBezig && bestandRef.current?.click()}
                    role="button"
                    aria-label="Document toevoegen aan bericht"
                    title="Aanvraag, projectplan of andere tekst toevoegen (pdf/docx/tekst)"
                    style={css(
                      `width: 40px; height: 40px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; border: 1px solid #D6E3E9; background: #FFFFFF; cursor: ${attachBezig ? 'wait' : 'pointer'};`,
                    )}
                  >
                    <span style={css('font-size: 18px; line-height: 1; color: #2C4A5E;')}>{attachBezig ? '…' : '📎'}</span>
                  </div>
                </>
              )}
              <textarea
                ref={taRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  groeiMee();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    verstuur();
                  }
                }}
                rows="1"
                placeholder="Typ uw vraag..."
                style={css(
                  "flex: 1; min-width: 0; height: 48px; min-height: 48px; max-height: 180px; overflow-y: auto; padding: 13px 0 10px; border: none; outline: none; resize: none; background: transparent; color: #2E3A38; font-family: 'Mulish', sans-serif; font-size: 15.5px; line-height: 1.5;",
                )}
              />
              <div
                onClick={() => verstuur()}
                role="button"
                aria-label="Verstuur vraag"
                style={css(
                  'width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; background: #4E9A6C; cursor: pointer;',
                )}
              >
                <span
                  style={css(
                    'width: 0; height: 0; margin-left: 3px; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid #FFFFFF;',
                  )}
                />
              </div>
            </div>

            {attachFout && (
              <p style={css('margin: 8px 0 0; font-size: 12.5px; color: #B23B3B;')}>{attachFout}</p>
            )}

            {isFreePlan && (
              <div style={css('margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;')}>
                <span style={css('flex: 1 1 300px; min-width: 0; color: #687974; font-size: 12px; font-weight: 700; text-wrap: pretty;')}>
                  Pro levert uw projectplannen, begrotingen en aanvragen als afgeronde documenten in uw eigen huisstijl,
                  en onthoudt uw organisatie. Premium zoekt daarnaast in <FundingDatabaseCount /> fondsen die online
                  nauwelijks te vinden zijn.
                </span>
                <a
                  href="#/hoe-het-werkt"
                  style={css(
                    'flex-shrink: 0; padding: 8px 16px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 12px; font-weight: 800; white-space: nowrap;',
                  )}
                >
                  Ontdek Pro en Premium →
                </a>
              </div>
            )}

            {isProPlan && (
              <div style={css('margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;')}>
                <span style={css('color: #687974; font-size: 12px; font-weight: 700;')}>
                  Met Premium zoekt Subsidie Kompas naast internet ook in de exclusieve fondsendatabase met{' '}
                  <FundingDatabaseCount /> fondsen en regelingen.
                </span>
                <a
                  href="#/hoe-het-werkt"
                  style={css('padding: 8px 16px; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-size: 12px; font-weight: 800; white-space: nowrap;')}
                >
                  Upgrade naar Premium →
                </a>
              </div>
            )}

            {isPremiumPlan && (
              <div style={css('margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;')}>
                <span style={css('width: 8px; height: 8px; border-radius: 50%; background: #4E9A6C;')} />
                <span style={css('color: #2F6D47; font-size: 12px; font-weight: 800;')}>Premium actief</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
