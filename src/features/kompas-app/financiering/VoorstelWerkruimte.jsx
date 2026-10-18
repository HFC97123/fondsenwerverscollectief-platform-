// "Maak dekkingsplan en actieplan met Subsidiekompas": de startknop, de voortgang, het voorstel dat het lid kan bekijken en aanpassen, en het opslaan.
// De server maakt het voorstel (Pro: database + korte online oriëntatie, 120%; Premium: ruimere oriëntatie, gericht aanvullen, 140%); deze component
// toont en past aan. Er wordt NIETS opgeslagen vóór de klik "Opslaan in dit project". De logica staat in voorstelWerk.js (zuiver, getest).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { leesOpenActieplan, vraagActieplanHerstel, vraagBronControle, vraagVoorstelAanvullen, vraagVoorstelGenereren, vraagVoorstelOpslaan, vraagVoorstelStartpunt, vraagZoekprofiel } from '../../../data/services/voorstelGenereren.js';
import { haalClassificatiesOp } from '../../../data/services/classificaties.js';
import BespreekLink from './BespreekLink.jsx';
import FinancieringsRegel from './FinancieringsRegel.jsx';
import VoorstelStart from './VoorstelStart.jsx';
import { VoorstelRegelDetail } from './VoorstelPreview.jsx';
import { BEDRAG_OVERLEG_TEKST } from './voorstelPreviewModel.js';
import { formatDatum, formatEuro, leesBedragInvoer } from './dekkingsplan.js';
import {
  STAP,
  beginBedragen,
  beginControles,
  beginSelectie,
  beginSelectieChat,
  berekenSelectieTotaal,
  bouwOpslagVerzoek,
  bouwRegelWeergaven,
  bufferUitleg,
  controleerRegel,
  dekkingTekst,
  draaiBronControles,
  draaiVoorstelFlow,
  herstelActieplan,
  herstelOpenActieplan,
  leesOpenTaken,
  maakWerkModel,
  teControleren,
  voerOpslagUit,
} from './voorstelWerk.js';
import { BRON_CONTROLEREN } from './bronStatus.js';
import { bewaarConcept, bouwZoekprofielVerzoek, controleerProfiel, heeftWijzigingen, maakProfielState, voegSamen, wisConcept } from './zoekprofielModel.js';
import { VOORSTEL_STAPPEN } from './voorstelFlow.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const KAART = 'box-sizing: border-box; padding: 20px 22px; border: 1px solid #CFE4D7; border-radius: 20px; background: #FFFFFF; display: flex; flex-direction: column; gap: 14px;';
const KNOP_PRIMAIR = "min-height: 44px; padding: 0 20px; border: none; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;";
const KNOP_STIL = "min-height: 44px; padding: 0 18px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;";
const INVOER = "box-sizing: border-box; width: 150px; max-width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2C4A5E; text-align: right;";

const STAPPEN_ACTIEF = { [STAP.ONDERZOEKEN]: 2, [STAP.AANVULLEN]: 2, [STAP.VOORBEREIDEN]: 3 };
const STAP_TEKST = {
  [STAP.ONDERZOEKEN]: 'Subsidiekompas doorzoekt de database en zoekt kort online. Dit kan een halve minuut duren.',
  [STAP.AANVULLEN]: 'Subsidiekompas zoekt gericht verder naar wat er nog ontbreekt (Premium).',
  [STAP.VOORBEREIDEN]: 'De gekozen financiers worden voorbereid. De bronnen worden daarna een voor een gecontroleerd.',
};

const STANDAARD_DIENSTEN = {
  // Het zoekprofiel (beide routes): dezelfde service en hetzelfde eindpunt als de rest van de keten. Zonder deze dienst (of met een startpunt vanuit de chat)
  // slaat de werkruimte de profielstap over en werkt zoals voorheen.
  zoekprofiel: vraagZoekprofiel,
  classificaties: haalClassificatiesOp,
  genereer: vraagVoorstelGenereren,
  aanvullen: vraagVoorstelAanvullen,
  startpunt: vraagVoorstelStartpunt,
  controleer: vraagBronControle,
  opslaan: vraagVoorstelOpslaan,
  leesOpen: leesOpenActieplan,
  herstelOpen: vraagActieplanHerstel,
};

const projectprofielLink = (id) => `#/kompas/projecten/${encodeURIComponent(id || '')}?bewerk=1`;

function Voortgang({ stap }) {
  const actief = STAPPEN_ACTIEF[stap] ?? 2;

  return (
    <section data-testid="voorstel-voortgang" data-stap={stap} aria-live="polite" style={css(KAART)}>
      <h2 style={css(`${LABEL} margin: 0;`)}>Subsidiekompas is aan het werk</h2>
      <ol style={css(`${TEKST} margin: 0; padding-left: 20px;`)}>
        {VOORSTEL_STAPPEN.slice(0, 4).map((s, i) => (
          <li key={s} data-status={i < actief ? 'klaar' : i === actief ? 'bezig' : 'wacht'} style={css(`font-weight: ${i === actief ? '800' : '500'}; color: ${i < actief ? '#2F7A4D' : i === actief ? '#2C4A5E' : '#7B8985'};`)}>
            {i < actief ? '✓ ' : ''}
            {s}
          </li>
        ))}
      </ol>
      <div style={css(`${TEKST} font-size: 13px;`)}>{STAP_TEKST[stap] || STAP_TEKST[STAP.ONDERZOEKEN]}</div>
    </section>
  );
}

const OPSLAG_STATUS_TEKST = { opgeslagen: 'toegevoegd aan het dekkingsplan (status Interessant)', 'bestaat-al': 'stond al in het dekkingsplan en is niet opnieuw toegevoegd', mislukt: 'kon niet worden toegevoegd' };
const REDEN_OPSLAAN = { 'niet-toegestaan': 'niet toegestaan met uw abonnement', ongeldig: 'ongeldige gegevens', fout: 'onbekende fout' };

function BronChip({ bron }) {
  if (!bron) return null;

  const kleur = { gecontroleerd: '#2F7A4D', onzeker: '#8A5A16', mislukt: '#A3382B', controleren: '#2C4A5E', niet_gecontroleerd: '#5D6B67' }[bron.status] || '#5D6B67';

  return (
    <span data-testid="samenvatting-bron" data-status={bron.status} style={css(`font-weight: 800; color: ${kleur};`)}>
      Bron: {bron.label}
    </span>
  );
}

function Samenvatting({ uit, projectId, onSluiten, onActieplanOpnieuw, actieplanBezig, actieplanFout }) {
  const opgeslagen = uit.regels.filter((r) => r.status === 'opgeslagen').length;
  const suggestiesOpgeslagen = uit.suggesties.filter((x) => x.status === 'opgeslagen').length;
  const ap = uit.actieplan;
  const probleem = ap.status === 'mislukt' || ap.status === 'deels';

  return (
    <section data-testid="voorstel-opgeslagen" style={css(KAART)}>
      <h2 style={css(`${LABEL} margin: 0;`)}>Opgeslagen</h2>

      {uit.regels.length > 0 || uit.suggesties.length > 0 ? (
        <ul data-testid="voorstel-opgeslagen-regels" style={css(`${TEKST} margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px;`)}>
          {uit.regels.map((r) => (
            <li key={r.sleutel} data-testid="voorstel-opgeslagen-regel" data-status={r.status}>
              <strong>{r.naam}</strong>: {OPSLAG_STATUS_TEKST[r.status]}
              {r.status === 'mislukt' ? ` (${REDEN_OPSLAAN[r.reden] || REDEN_OPSLAAN.fout})` : ''}
              {r.status !== 'mislukt' && (
                <>
                  {' · '}
                  <BronChip bron={r.bron} />
                </>
              )}
              {r.fundingId && r.status !== 'mislukt' && (
                <>
                  {' · '}
                  <BespreekLink projectId={projectId} fundingId={r.fundingId} naam={r.naam} stijl="min-height: 28px; font-size: 13px;" />
                </>
              )}
            </li>
          ))}
          {uit.suggesties.map((x) => (
            <li key={x.naam} data-testid="voorstel-opgeslagen-suggestie" data-status={x.status}>
              <strong>{x.naam}</strong>: {x.status === 'opgeslagen' ? 'op uw lijst gezet, zonder bedrag. Online gevonden en niet gecontroleerd. Er staan stappen klaar om te beoordelen: eerst beoordelen of het past, dan voorwaarden, deadline en bijdrage nagaan, daarna beslissen of het in uw dekkingsplan komt' : x.status === 'bestaat-al' ? 'stond al op uw lijst' : 'kon niet worden toegevoegd'}
              {x.fundingId && x.status !== 'mislukt' && (
                <>
                  {' · '}
                  <BespreekLink projectId={projectId} fundingId={x.fundingId} naam={x.naam} stijl="min-height: 28px; font-size: 13px;" />
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div style={css(TEKST)}>Er is niets nieuws opgeslagen.</div>
      )}

      {(opgeslagen > 0 || suggestiesOpgeslagen > 0) && (
        <div data-testid="voorstel-opgeslagen-uitleg" style={css(`${TEKST} font-size: 13px; color: #6D7C77;`)}>
          Opgeslagen regels hebben de status Interessant: het zijn mogelijkheden, geen toekenningen. De bronstatus (gecontroleerd of niet) blijft zichtbaar bij elke regel in het dekkingsplan.
        </div>
      )}

      <div data-testid="voorstel-actieplan" data-status={actieplanBezig ? 'bezig' : ap.status} style={css(`${TEKST} padding: 10px 14px; border-radius: 12px; background: ${probleem ? '#FBF1E3' : '#F3F9F5'}; color: ${probleem ? '#8A5A16' : '#2C4A5E'};`)}>
        {actieplanBezig && <strong>Actieplan wordt aangemaakt…</strong>}
        {!actieplanBezig && ap.status === 'klaar' && <strong>Actieplan klaar: {ap.aangemaakt + ap.bestond} {ap.aangemaakt + ap.bestond === 1 ? 'taak' : 'taken'} bij de opgeslagen financiers.</strong>}
        {!actieplanBezig && ap.status === 'geen' && <span>Er zijn geen taken aangemaakt.</span>}
        {!actieplanBezig && probleem && (
          <span>
            <strong>Het actieplan is {ap.status === 'deels' ? 'maar deels' : 'niet'} aangemaakt.</strong> Uw dekkingsplan is opgeslagen en blijft zoals het is
            {ap.status === 'deels' ? ` (${ap.aangemaakt + ap.bestond} taken staan er, ${ap.mislukt} ontbreken nog)` : ''}. U kunt alleen het actieplan opnieuw laten aanmaken; er komen geen dubbele taken.
          </span>
        )}
        {actieplanFout && (
          <div role="alert" data-testid="voorstel-actieplan-fout" style={css('margin-top: 6px; color: #9E3B2C;')}>
            {actieplanFout}
          </div>
        )}
        {!actieplanBezig && probleem && (
          <div style={css('margin-top: 8px;')}>
            <button type="button" data-testid="actieplan-opnieuw" onClick={onActieplanOpnieuw} style={css(KNOP_STIL)}>
              Actieplan opnieuw proberen
            </button>
          </div>
        )}
      </div>

      <div>
        <button type="button" data-testid="voorstel-sluiten" onClick={onSluiten} style={css(KNOP_STIL)}>
          Sluiten
        </button>
      </div>
    </section>
  );
}

// Het bewaren van het concept-zoekprofiel mag falen of ontbreken (privémodus, geblokkeerde opslag): dan werkt alles gewoon zonder.
function standaardOpslag() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch (e) {
    return null;
  }
}

// De lijsten waaruit het lid kiest (dezelfde tabellen als de matching). -> { lijsten, fout } of null als er geen dienst is.
async function haalLijsten(diensten) {
  if (!diensten || typeof diensten.classificaties !== 'function') return null;

  try {
    const r = await diensten.classificaties();

    if (!r || typeof r !== 'object') return { lijsten: null, fout: true };

    return { lijsten: { themas: r.themas || [], doelgroepen: r.doelgroepen || [], regios: r.regios || [] }, fout: Boolean(r.error) };
  } catch (e) {
    return { lijsten: null, fout: true };
  }
}

export default function VoorstelWerkruimte({
  project,
  onOpgeslagen,
  onSluit,
  beschikbaar,
  opgeslagen = true,
  diensten = STANDAARD_DIENSTEN,
  startpunt = null,
  autoStart = false,
  profielRoute = 'project', // 'project' (Projectfinanciering) | 'chat' (het zoekprofiel uit het gesprek)
  profielBerichten = null, // chat: de berichten van het lid (alleen role 'user' wordt door de server gebruikt)
  metStartknop = null, // standaard: de startknop staat er, behalve bij een startpunt vanuit de chat
  opslag = undefined,
}) {
  const [fase, setFase] = useState('idle'); // idle | profiel-laden | profiel | bezig | klaar | fout | opslaan | opgeslagen
  const [profiel, setProfiel] = useState(null); // de bewerkbare toestand van het zoekprofiel (zoekprofielModel)
  const [profielFout, setProfielFout] = useState('');
  const [profielMelding, setProfielMelding] = useState('');
  const [lijsten, setLijsten] = useState(null);
  const [lijstenFout, setLijstenFout] = useState(false);
  const [opnieuwBezig, setOpnieuwBezig] = useState(false);
  const [stap, setStap] = useState(STAP.ONDERZOEKEN);
  const [melding, setMelding] = useState('');
  const [model, setModel] = useState(null);
  const [selectie, setSelectie] = useState(null);
  const [bedragen, setBedragen] = useState({});
  const [controles, setControles] = useState({});
  const [uitkomst, setUitkomst] = useState(null);
  const [verzoek, setVerzoek] = useState(null);
  const [opslagFouten, setOpslagFouten] = useState(null); // { regelFouten, algemeen, melding }
  const [actieplanBezig, setActieplanBezig] = useState(false);
  const [actieplanFout, setActieplanFout] = useState('');
  const [openAantal, setOpenAantal] = useState(0); // taken die de server voor opnieuw proberen heeft bewaard (blijft na verversen)
  const [openBezig, setOpenBezig] = useState(false);
  const [openFout, setOpenFout] = useState('');
  const [openKlaar, setOpenKlaar] = useState('');
  const dienstenRef = useRef(diensten);
  const profielRef = useRef(null);
  const draaiRef = useRef(null);
  const opslagRef = useRef(opslag === undefined ? standaardOpslag() : opslag);
  const openRef = useRef(false);
  const bezigRef = useRef(false);
  const actieplanRef = useRef(false);
  const generatieRef = useRef(0);
  const projectId = project && project.id;
  // Bij Projectfinanciering is het project zelf het zoekprofiel (discipline, doelgroep en werkgebied die u bij het project invulde): er is geen aparte
  // profielstap. Alleen het zoekprofiel uit een chatgesprek wordt nog eerst opgesteld.
  const profielStap = !startpunt && profielRoute === 'chat' && typeof diensten.zoekprofiel === 'function';
  const toonStartknop = metStartknop === null ? !startpunt : metStartknop;

  dienstenRef.current = diensten;
  profielRef.current = profiel;

  // Wijzigingen van het lid blijven bewaard (per project en route) zodat een fout of verversen ze niet kost.
  useEffect(() => {
    if (profiel && projectId && heeftWijzigingen(profiel)) bewaarConcept(opslagRef.current, projectId, profiel);
  }, [profiel, projectId]);

  // Na verversen: staan er taken van een eerder, niet afgemaakt actieplan klaar bij de server? Dan blijft "Actieplan opnieuw proberen" beschikbaar.
  // Niet tijdens een lopende flow en niet vanuit de chat; in de samenvatting na opslaan staat dezelfde knop al.
  useEffect(() => {
    if (startpunt || !projectId || fase === 'opslaan' || fase === 'opgeslagen' || fase === 'bezig') return undefined;

    let actief = true;

    leesOpenTaken({ projectId, diensten: dienstenRef.current }).then((n) => {
      if (actief) setOpenAantal(n);
    });

    return () => {
      actief = false;
    };
  }, [projectId, fase, startpunt]);

  // Broncontroles: aparte aanroepen NA het tonen van het voorstel. Een nieuwe start of sluiten maakt late antwoorden ongeldig.
  const startControles = useCallback(
    (m, generatie) => {
      const regels = teControleren(m);

      if (!regels.length) return;

      draaiBronControles({
        projectId,
        regels,
        diensten,
        geannuleerd: () => generatieRef.current !== generatie,
        onUpdate: (sleutel, res) => setControles((cur) => ({ ...cur, [sleutel]: res })),
      });
    },
    [projectId, diensten],
  );

  // Het voorstel maken. `zoekprofiel` = het door het lid bevestigde profiel (of null: de server leest het project zelf). Gaat er iets mis terwijl het
  // lid een profiel bevestigd had, dan keert hij terug naar het profiel met alle wijzigingen nog erin; er gaat niets verloren.
  const draai = useCallback(
    async (zoekprofiel = null) => {
      if (bezigRef.current || !projectId) return;

      bezigRef.current = true;
      generatieRef.current += 1;

      const generatie = generatieRef.current;

      setFase('bezig');
      setMelding('');
      setProfielFout('');
      setProfielMelding('');
      setOpslagFouten(null);
      setControles({});
      setStap(startpunt ? STAP.VOORBEREIDEN : STAP.ONDERZOEKEN);

      const terugNaarProfiel = (tekstFout, tekstMelding) => {
        // Een technische fout krijgt een vaste, begrijpelijke tekst; een inhoudelijke uitleg (bijv. geen passende fondsen) blijft staan.
        setMelding(tekstMelding || (tekstFout ? 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen. Probeer het opnieuw.' : 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen.'));
        setFase('fout');
      };

      try {
        const res = await draaiVoorstelFlow({ projectId, diensten, onStap: setStap, startpunt, zoekprofiel });

        if (generatieRef.current !== generatie) return;

        if (!res.ok) {
          if (zoekprofiel) {
            terugNaarProfiel(res.melding, '');

            return;
          }

          setMelding(res.melding);
          setFase('fout');

          return;
        }

        const m = maakWerkModel(res);

        if (!m || !m.regels.length) {
          // Gedekt, of niets sterks gevonden: geen leeg voorstel tonen maar de uitleg van de server.
          const uitleg = (res.genereer && res.genereer.melding) || (res.genereer && res.genereer.uitkomst === 'geen-gat' ? 'De begroting van dit project is al volledig gedekt; er is niets voor te stellen.' : 'Er zijn geen sterke, passende financiers gevonden.');

          if (zoekprofiel && !(m && m.suggesties.length)) {
            // Met een profiel kan het lid het meteen aanpassen en opnieuw zoeken.
            terugNaarProfiel('', uitleg);

            return;
          }

          setModel(m);
          setMelding(uitleg);
          setFase(m && m.suggesties.length ? 'klaar' : 'fout');

          if (m && m.suggesties.length) {
            setSelectie(m.bedragOnbekend ? beginSelectieChat(m) : beginSelectie(m));
            setBedragen(beginBedragen(m));
          }

          return;
        }

        setModel(m);
        // Vanuit de chat, of zonder bekend bedrag, kiest het lid zelf wat meegaat: alles staat aan, zonder bedrag.
        setSelectie(startpunt || m.bedragOnbekend ? beginSelectieChat(m) : beginSelectie(m));
        setBedragen(beginBedragen(m));
        setControles(beginControles(m));
        setFase('klaar');
        startControles(m, generatie);
      } catch (e) {
        if (zoekprofiel) {
          terugNaarProfiel('Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen. Probeer het later opnieuw.', '');
        } else {
          setMelding('Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen. Probeer het later opnieuw.');
          setFase('fout');
        }
      } finally {
        bezigRef.current = false;
      }
    },
    [projectId, diensten, startpunt, startControles],
  );

  // Het zoekprofiel laden (of opnieuw laten opstellen) via de zoekprofielservice. `opnieuw`: de wijzigingen van het lid blijven staan; wat de server nu
  // méér voorstelt komt er apart bij en het lid kiest zelf.
  const laadProfiel = useCallback(
    async ({ opnieuw = false } = {}) => {
      if (bezigRef.current || !projectId) return;

      bezigRef.current = true;
      generatieRef.current += 1;

      const generatie = generatieRef.current;

      if (opnieuw) setOpnieuwBezig(true);
      else {
        setFase('profiel-laden');
        setMelding('');
        setProfielMelding('');
      }

      setProfielFout('');

      let volgende = null;

      try {
        const [res, cls] = await Promise.all([diensten.zoekprofiel({ projectId, berichten: profielBerichten }), haalLijsten(diensten)]);

        if (generatieRef.current !== generatie) return;

        if (cls) {
          setLijsten(cls.lijsten);
          setLijstenFout(cls.fout);
        }

        const ruw = res && res.ok && res.antwoord && typeof res.antwoord.profiel === 'object' ? res.antwoord.profiel : null;

        if (!ruw) {
          const tekstFout = (res && res.melding) || 'Het zoekprofiel kon nu niet worden opgesteld. Er is niets opgeslagen en niets gezocht.';

          if (opnieuw) setProfielFout(tekstFout);
          else {
            setMelding(tekstFout);
            setFase('fout');
          }

          return;
        }

        const vers = maakProfielState(ruw, { route: profielRoute });

        // Het projectprofiel IS het zoekprofiel: geen tweede formulier. Is het profiel bruikbaar, dan zoekt Subsidiekompas meteen;
        // zo niet, dan gaat het lid naar het Projectprofiel om aan te vullen.
        if (!opnieuw) {
          setProfiel(vers);
          volgende = controleerProfiel(vers, cls && !cls.fout ? cls.lijsten : null).ok ? { zoek: bouwZoekprofielVerzoek(vers) } : { aanvullen: true };
        } else if (profielRef.current) {
          setProfiel(voegSamen(profielRef.current, vers));
        }
      } catch (e) {
        if (generatieRef.current !== generatie) return;

        if (opnieuw) setProfielFout('Het zoekprofiel kon nu niet opnieuw worden opgesteld. Uw wijzigingen zijn behouden.');
        else {
          setMelding('Het zoekprofiel kon nu niet worden opgesteld. Er is niets opgeslagen en niets gezocht.');
          setFase('fout');
        }
      } finally {
        bezigRef.current = false;
        setOpnieuwBezig(false);
      }

      if (volgende && volgende.zoek && generatieRef.current === generatie) draaiRef.current(volgende.zoek);
      else if (volgende && volgende.aanvullen && generatieRef.current === generatie) setFase('aanvullen');
    },
    [projectId, diensten, profielBerichten, profielRoute],
  );

  draaiRef.current = draai;

  // Eén startpunt voor de knop en voor "Opnieuw proberen": met profielstap eerst het profiel, anders direct zoeken zoals voorheen.
  const start = useCallback(() => (profielStap ? laadProfiel() : draai(null)), [profielStap, laadProfiel, draai]);

  // Vanuit de chat start het voorbereiden meteen (het lid heeft daar al op de knop geklikt).
  useEffect(() => {
    if (autoStart && projectId && fase === 'idle') {
      if (startpunt) draai(null);
      else if (profielStap) laadProfiel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      generatieRef.current += 1;
    },
    [],
  );

  const sluit = useCallback(() => {
    generatieRef.current += 1;
    setFase('idle');
    setModel(null);
    setSelectie(null);
    setUitkomst(null);
    setVerzoek(null);
    setOpslagFouten(null);
    setControles({});
    setMelding('');
    setProfielFout('');
    setProfielMelding('');
    setActieplanFout('');

    if (typeof onSluit === 'function') onSluit();
  }, [onSluit]);

  const controleerOpnieuw = useCallback(
    async (regel) => {
      const generatie = generatieRef.current;

      setControles((cur) => ({ ...cur, [regel.sleutel]: { bron: BRON_CONTROLEREN, antwoord: null } }));

      const res = await controleerRegel({ projectId, regel, diensten, opnieuw: true });

      if (generatieRef.current !== generatie) return;

      setControles((cur) => ({ ...cur, [regel.sleutel]: { bron: res.bron, antwoord: res.antwoord } }));
    },
    [projectId, diensten],
  );

  const totaal = useMemo(() => (model && selectie ? berekenSelectieTotaal(model, selectie, bedragen) : null), [model, selectie, bedragen]);
  const weergaven = useMemo(() => (model ? bouwRegelWeergaven(model, controles) : []), [model, controles]);
  const detailVan = useMemo(() => new Map(weergaven.map((r) => [r.sleutel, r])), [weergaven]);
  const nogBezigMetControles = Object.values(controles).some((c) => c && c.bron && c.bron.status === 'controleren');

  const wissel = (soort, sleutel) =>
    setSelectie((cur) => {
      const volgende = new Set(cur[soort]);

      if (volgende.has(sleutel)) volgende.delete(sleutel);
      else volgende.add(sleutel);

      return { ...cur, [soort]: volgende };
    });

  const opslaan = async () => {
    if (bezigRef.current || !model || !selectie) return;

    const v = bouwOpslagVerzoek(model, selectie, bedragen);

    if (v.ongeldig.length) return;

    bezigRef.current = true;
    setFase('opslaan');
    setOpslagFouten(null);

    try {
      const uit = await voerOpslagUit({ projectId, verzoek: v, diensten });

      if (!uit.ok) {
        // De server heeft NIETS opgeslagen. De invoer blijft staan; de fouten staan bij de regel waar ze bij horen.
        setOpslagFouten(uit.soort === 'validatie' ? { regelFouten: uit.regelFouten, algemeen: uit.algemeen, melding: '' } : { regelFouten: {}, algemeen: null, melding: uit.melding });
        setFase('klaar');

        return;
      }

      // Controles die nog liepen zijn niet meer van belang voor dit scherm; de server heeft de status van dit moment vastgelegd.
      generatieRef.current += 1;
      setUitkomst(uit);
      setVerzoek(v);
      setFase('opgeslagen');
      // Het voorstel is opgeslagen: het concept van het zoekprofiel is niet meer nodig.
      wisConcept(opslagRef.current, projectId, profielRoute);

      if (typeof onOpgeslagen === 'function') onOpgeslagen(uit);
    } finally {
      bezigRef.current = false;
    }
  };

  const actieplanOpnieuw = async () => {
    if (actieplanRef.current || !uitkomst || !verzoek || !model) return;

    actieplanRef.current = true;
    setActieplanBezig(true);
    setActieplanFout('');

    try {
      const res = await herstelActieplan({ projectId, model, uitkomst, verzoek, diensten });

      if (res.ok) {
        setUitkomst((cur) => ({ ...cur, actieplan: res.actieplan }));

        if (typeof onOpgeslagen === 'function') onOpgeslagen({ actieplan: res.actieplan });
      } else {
        setActieplanFout(res.melding);
      }
    } finally {
      actieplanRef.current = false;
      setActieplanBezig(false);
    }
  };

  const openOpnieuw = async () => {
    if (openRef.current || !projectId) return;

    openRef.current = true;
    setOpenBezig(true);
    setOpenFout('');
    setOpenKlaar('');

    try {
      const res = await herstelOpenActieplan({ projectId, diensten: dienstenRef.current });

      if (res.ok) {
        setOpenAantal(res.openstaand);

        if (res.openstaand === 0) {
          const n = res.aangemaakt + res.bestond;

          setOpenKlaar(`Het actieplan is aangevuld: ${n} ${n === 1 ? 'taak staat' : 'taken staan'} nu bij uw financiers.`);
        } else {
          setOpenFout(`Niet alles is gelukt: ${res.openstaand} ${res.openstaand === 1 ? 'taak ontbreekt' : 'taken ontbreken'} nog. Probeer het opnieuw.`);
        }

        if (typeof onOpgeslagen === 'function') onOpgeslagen({ actieplan: { status: res.status, aangemaakt: res.aangemaakt, bestond: res.bestond, mislukt: res.openstaand } });
      } else {
        setOpenFout(res.melding);
      }
    } finally {
      openRef.current = false;
      setOpenBezig(false);
    }
  };

  const nietsGekozen = selectie ? selectie.regels.size === 0 && selectie.suggesties.size === 0 : true;
  const heeftFout = totaal ? Object.values(totaal.fouten).includes('ongeldig') : false;
  const fouten = opslagFouten || { regelFouten: {}, algemeen: null, melding: '' };

  return (
    <div data-testid="voorstel-werkruimte" data-fase={fase} data-ingang={startpunt ? 'chat' : profielRoute} style={css('display: flex; flex-direction: column; gap: 18px;')}>
      {toonStartknop && fase !== 'profiel' && <VoorstelStart project={project} beschikbaar={beschikbaar} opgeslagen={opgeslagen} metProfielStap={profielStap} bezig={fase === 'bezig' || fase === 'opslaan' || fase === 'profiel-laden'} onStart={start} />}

      {fase === 'profiel-laden' && <Voortgang stap={STAP.ONDERZOEKEN} />}

      {fase === 'aanvullen' && (
        <section role="status" data-testid="voorstel-profiel-aanvullen" style={css(`${TEKST} padding: 14px 18px; border: 1px solid #EEDCC0; border-radius: 16px; background: #FBF1E3; color: #8A5A16; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;`)}>
          <span>Vul in het projectprofiel minstens één discipline of doelgroep in.</span>
          <a href={projectprofielLink(projectId)} data-testid="voorstel-naar-projectprofiel" style={css('color: #4E9A6C; font-weight: 800;')}>
            Projectprofiel aanvullen
          </a>
        </section>
      )}

      {!startpunt && fase !== 'opgeslagen' && (openAantal > 0 || openKlaar) && (
        <section data-testid="actieplan-open" data-aantal={openAantal} style={css(`${TEKST} padding: 12px 16px; border-radius: 14px; background: ${openAantal > 0 ? '#FBF1E3' : '#F3F9F5'}; color: ${openAantal > 0 ? '#8A5A16' : '#2C4A5E'}; display: flex; flex-direction: column; gap: 8px;`)}>
          {openAantal > 0 && (
            <div>
              <strong>Het actieplan van Subsidiekompas is nog niet compleet:</strong> {openAantal} {openAantal === 1 ? 'taak is' : 'taken zijn'} nog niet aangemaakt. Uw dekkingsplan is opgeslagen en blijft zoals het is. U kunt alleen het actieplan opnieuw laten aanmaken; er komen geen dubbele taken.
            </div>
          )}
          {openKlaar && openAantal === 0 && (
            <div data-testid="actieplan-open-klaar" role="status">
              <strong>{openKlaar}</strong>
            </div>
          )}
          {openFout && (
            <div role="alert" data-testid="actieplan-open-fout" style={css('color: #9E3B2C;')}>
              {openFout}
            </div>
          )}
          {openAantal > 0 && (
            <div>
              <button type="button" data-testid="actieplan-open-opnieuw" disabled={openBezig} onClick={openOpnieuw} style={css(KNOP_STIL)}>
                {openBezig ? 'Actieplan wordt aangemaakt…' : 'Actieplan opnieuw proberen'}
              </button>
            </div>
          )}
        </section>
      )}

      {fase === 'bezig' && <Voortgang stap={stap} />}

      {fase === 'fout' && (
        <section role="alert" data-testid="voorstel-fout" style={css(`${TEKST} padding: 14px 18px; border: 1px solid #EEDCC0; border-radius: 16px; background: #FBF1E3; color: #8A5A16;`)}>
          {melding || 'Het voorstel kon nu niet worden gemaakt. Er is niets opgeslagen.'}
          <div style={css('margin-top: 8px; display: flex; flex-wrap: wrap; gap: 10px;')}>
            <button type="button" data-testid="voorstel-opnieuw" onClick={start} style={css(KNOP_STIL)}>
              Opnieuw proberen
            </button>
            {!startpunt && (
              <a href={projectprofielLink(projectId)} data-testid="voorstel-terug-profiel" style={css(`${KNOP_STIL} display: inline-flex; align-items: center; text-decoration: none;`)}>
                Projectprofiel aanpassen
              </a>
            )}
          </div>
        </section>
      )}

      {fase === 'opgeslagen' && uitkomst && <Samenvatting uit={uitkomst} projectId={projectId} onSluiten={sluit} onActieplanOpnieuw={actieplanOpnieuw} actieplanBezig={actieplanBezig} actieplanFout={actieplanFout} />}

      {(fase === 'klaar' || fase === 'opslaan') && model && selectie && totaal && (
        <section data-testid="voorstel-resultaat" data-controles={nogBezigMetControles ? 'bezig' : 'klaar'} style={css(KAART)}>
          <div>
            <h2 style={css(`${LABEL} margin: 0 0 4px;`)}>{startpunt ? 'Dekkingsplan voorbereiden' : 'Voorstel van Subsidiekompas'}</h2>
            <div data-testid="voorstel-niet-opgeslagen" style={css(`${TEKST} font-weight: 700; color: #2C4A5E;`)}>
              Er is nog niets opgeslagen. Vink af wat u niet wilt, pas bedragen aan en klik daarna op Opslaan.
            </div>
          </div>

          {nogBezigMetControles ? (
            <div data-testid="voorstel-controles-bezig" role="status" style={css(`${TEKST} font-size: 13px; padding: 10px 14px; border-radius: 12px; background: #E6EFF6; color: #2C4A5E;`)}>
              De bronnen worden een voor een gecontroleerd. U kunt ondertussen verder. Slaat u nu op, dan worden regels die nog niet zijn gecontroleerd opgeslagen als Niet gecontroleerd.
            </div>
          ) : (
            teControleren(model).length > 0 && (
              <div data-testid="voorstel-controles-klaar" style={css(`${TEKST} font-size: 13px; color: #6D7C77;`)}>
                De bronstatus gaat over de controle van de website van de financier. Gecontroleerd betekent niet dat de financiering is toegekend of dat u in aanmerking komt.
              </div>
            )
          )}

          {model.zoekprofiel === 'bevestigd-profiel' && fase === 'klaar' && (
            <div data-testid="voorstel-zoekprofiel-gebruikt" style={css(`${TEKST} font-size: 13px;`)}>
              <a href={projectprofielLink(projectId)} data-testid="voorstel-profiel-aanpassen" style={css('color: #4E9A6C; font-weight: 800;')}>
                Projectprofiel aanpassen
              </a>
            </div>
          )}

          {model.profielAfgevallen.length > 0 && (
            <div data-testid="voorstel-profiel-afgevallen" role="status" style={css(`${TEKST} font-size: 13px; padding: 10px 14px; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
              Deze termen uit uw projectprofiel staan niet als categorie in de database en zijn daarom niet gebruikt bij het zoeken: {model.profielAfgevallen.map((x) => x.term).join(', ')}.
            </div>
          )}

          {model.bedragOnbekend && (
            <div data-testid="voorstel-bedrag-onbekend" role="status" style={css(`${TEKST} font-size: 13.5px; padding: 10px 14px; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
              <strong>Het bedrag dat u zoekt is nog niet bekend.</strong> De matching op bedrag is daarom beperkt: de financiers zijn gekozen op inhoud, doelgroep en werkgebied, zonder voorgesteld bedrag. U kunt ze zonder bedrag opslaan en het bedrag later bij de regel invullen, of eerst de projectbegroting aanvullen en opnieuw zoeken.
            </div>
          )}

          {model.documenten > 0 && (
            <div data-testid="voorstel-documenten" style={css(`${TEKST} font-size: 13px; color: #6D7C77;`)}>
              Subsidiekompas gebruikte {model.documenten === 1 ? '1 geüpload projectdocument' : `${model.documenten} geüploade projectdocumenten`} als context bij het online zoeken. De fondsen uit de database zijn gekozen op uw projectgegevens.
            </div>
          )}

          {fouten.melding && (
            <div role="alert" data-testid="voorstel-opslaan-fout" style={css(`${TEKST} font-size: 13.5px; padding: 10px 14px; border-radius: 12px; background: #FBE9E7; color: #9E3B2C;`)}>
              {fouten.melding}
            </div>
          )}

          {fouten.algemeen && (
            <div role="alert" data-testid="voorstel-opslaan-algemeen" data-code={fouten.algemeen.code} style={css(`${TEKST} font-size: 13.5px; padding: 10px 14px; border-radius: 12px; background: #FBE9E7; color: #9E3B2C;`)}>
              {fouten.algemeen.melding} Er is niets opgeslagen en uw invoer is behouden.
            </div>
          )}

          {model.melding && !model.bedragOnbekend && (
            <div data-testid="voorstel-melding" style={css(`${TEKST} font-size: 13.5px; padding: 10px 14px; border-radius: 12px; background: #EEF4F8; color: #2C4A5E;`)}>
              {model.melding}
            </div>
          )}

          {model.regels.length > 0 && !model.bedragOnbekend && (
            <div data-testid="voorstel-totalen" aria-live="polite" style={css(`${TEKST} display: flex; flex-direction: column; gap: 2px;`)}>
              <div>
                Voorgesteld: <strong data-testid="voorstel-som">{formatEuro(totaal.voorgesteld)}</strong> · Nog te financieren: {formatEuro(model.gat)}
              </div>
              <div data-testid="voorstel-dekking" style={css('font-size: 13px; color: #2C4A5E; font-weight: 700;')}>{dekkingTekst(totaal, model)}</div>
              <div data-testid="voorstel-buffer" style={css('font-size: 12.5px; color: #7B8985;')}>{bufferUitleg(model)}</div>
              {totaal.bovenDoel && (
                <div role="status" data-testid="voorstel-boven-doel" style={css('font-size: 13px; color: #8A5A16;')}>
                  U zit boven de buffer van {Math.round(model.dekkingsdoel * 100)}% ({formatEuro(model.doelBedrag)}). Dat kan niet worden opgeslagen: verlaag een of meer bedragen.
                </div>
              )}
            </div>
          )}

          {model.regels.length > 0 && (
            <div data-testid="voorstel-bedrag-overleg" role="note" style={css(`${TEKST} font-size: 13.5px; padding: 10px 14px; border-radius: 12px; background: #EEF4F8; color: #2C4A5E;`)}>
              {BEDRAG_OVERLEG_TEKST}
            </div>
          )}

          <div data-testid="voorstel-regels" style={css('display: flex; flex-direction: column; gap: 10px;')}>
            {model.regels.map((r) => {
              const d = detailVan.get(r.sleutel);
              const gekozen = selectie.regels.has(r.sleutel);
              const fout = totaal.fouten[r.sleutel];
              const serverFout = fouten.regelFouten[r.sleutel];
              const b = leesBedragInvoer(bedragen[r.sleutel]);

              return (
                <div key={r.sleutel} data-testid="voorstel-rij" data-sleutel={r.sleutel} data-gekozen={gekozen ? 'ja' : 'nee'} style={css('display: flex; flex-direction: column; gap: 6px;')}>
                  <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;')}>
                    <label style={css(`${TEKST} display: inline-flex; align-items: center; gap: 8px; min-height: 40px; font-weight: 700; color: #2C4A5E;`)}>
                      <input type="checkbox" data-testid="voorstel-kies" checked={gekozen} disabled={!r.selecteerbaar} onChange={() => wissel('regels', r.sleutel)} style={css('width: 18px; height: 18px;')} />
                      {r.reserve ? 'Reserve (telt niet mee, nu geen bedrag)' : r.selecteerbaar ? 'Opnemen in dekkingsplan' : 'Staat al in uw dekkingsplan'}
                    </label>
                    {!model.bedragOnbekend && (
                    <label style={css(`${TEKST} display: inline-flex; align-items: center; gap: 8px;`)}>
                      Bedrag (€)
                      <input
                        type="text"
                        inputMode="decimal"
                        data-testid="voorstel-bedrag"
                        aria-label={`Bedrag voor ${r.naam}`}
                        aria-invalid={fout === 'ongeldig' || serverFout ? 'true' : undefined}
                        value={bedragen[r.sleutel] ?? ''}
                        disabled={!gekozen}
                        onChange={(e) => setBedragen((cur) => ({ ...cur, [r.sleutel]: e.target.value }))}
                        style={css(INVOER)}
                      />
                    </label>
                    )}
                  </div>
                  {fout === 'ongeldig' && (
                    <div role="alert" style={css(`${TEKST} font-size: 12.5px; color: #9E3B2C;`)}>
                      Vul een bedrag in als getal, bijvoorbeeld 12.500.
                    </div>
                  )}
                  {(fout === 'onder-minimum' || fout === 'boven-maximum') && (
                    <div data-testid="voorstel-grens-waarschuwing" style={css(`${TEKST} font-size: 12.5px; color: #8A5A16;`)}>
                      Dit bedrag valt buiten de bijdragegrenzen van de financier ({r.grenzen.min != null ? formatEuro(r.grenzen.min) : '?'} – {r.grenzen.max != null ? formatEuro(r.grenzen.max) : '?'}). Opslaan wordt dan geweigerd.
                    </div>
                  )}
                  {serverFout && (
                    <div role="alert" data-testid="voorstel-regel-fout" data-code={serverFout.code} style={css(`${TEKST} font-size: 12.5px; color: #9E3B2C; font-weight: 700;`)}>
                      {serverFout.melding}
                    </div>
                  )}
                  {d ? (
                    <FinancieringsRegel
                      testId="voorstel-regel"
                      titel={d.naam}
                      bedrag={b.ok && b.waarde != null ? formatEuro(b.waarde) : null}
                      bedragLeeg="Geen bedrag"
                      status={d.kop.status}
                      samenvatting={d.kop.samenvatting}
                    >
                      <VoorstelRegelDetail r={d} bron={d.bron} toonVerificatie={d.toonVerificatie} onOpnieuw={r.selecteerbaar ? () => controleerOpnieuw(r) : null} bezig={nogBezigMetControles && d.bron && d.bron.status === 'controleren'} />
                    </FinancieringsRegel>
                  ) : (
                    <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E;`)}>{r.naam}</div>
                  )}
                </div>
              );
            })}
          </div>

          {model.acties.length > 0 && (
            <details data-testid="voorstel-acties" style={css('border: 1px solid #E1EAE4; border-radius: 14px; padding: 10px 14px;')}>
              <summary style={css(`${TEKST} font-weight: 800; color: #2C4A5E; cursor: pointer;`)}>
                Voorgestelde taken ({[...selectie.acties].filter((s) => model.acties.some((a) => a.sleutel === s && (!a.regelSleutel || selectie.regels.has(a.regelSleutel)))).length})
              </summary>
              <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985; margin-top: 6px;`)}>
                De taken zijn terugberekend vanaf de deadline uit onze database. Bij regels zonder geverifieerde deadline staat een taak om de deadline eerst te controleren. Na het opslaan maakt de server de taken zelf aan.
              </div>
              <ul style={css('list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px;')}>
                {model.acties.map((a) => {
                  const regelGekozen = !a.regelSleutel || selectie.regels.has(a.regelSleutel);

                  return (
                    <li key={a.sleutel} data-testid="voorstel-actie" style={css(`${TEKST} font-size: 13.5px; opacity: ${regelGekozen ? '1' : '0.5'};`)}>
                      <label style={css('display: inline-flex; align-items: flex-start; gap: 8px;')}>
                        <input type="checkbox" checked={regelGekozen && selectie.acties.has(a.sleutel)} disabled={!regelGekozen} onChange={() => wissel('acties', a.sleutel)} style={css('width: 18px; height: 18px; margin-top: 2px;')} />
                        <span>
                          {a.datum ? <strong>{formatDatum(a.datum)} · </strong> : null}
                          {a.titel}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          {model.suggesties.length > 0 && (
            <section data-testid="voorstel-online" style={css('border: 1px dashed #CFDDD5; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;')}>
              <div>
                <div style={css(`${TEKST} font-weight: 800; color: #2C4A5E;`)}>Online gevonden: nog niet gecontroleerd</div>
                <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>
                  Deze financiers staan niet in onze database. Ze tellen niet mee in de dekking hierboven{model.onlineIndicatief > 0 ? ` (samen ongeveer ${formatEuro(model.onlineIndicatief)}, een schatting)` : ''}. U kunt ze op uw lijst zetten (Interessant, zonder bedrag) en zelf controleren.
                </div>
              </div>
              {model.suggesties.map((s) => (
                <label key={s.sleutel} data-testid="voorstel-suggestie" style={css(`${TEKST} display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px;`)}>
                  <input type="checkbox" checked={selectie.suggesties.has(s.sleutel)} onChange={() => wissel('suggesties', s.sleutel)} style={css('width: 18px; height: 18px; margin-top: 2px;')} />
                  <span style={css('min-width: 0; overflow-wrap: anywhere;')}>
                    <strong>{s.gever}</strong>
                    {s.naam && s.naam !== s.gever ? ` – ${s.naam}` : ''}
                    {s.indicatiefBedrag != null ? ` · indicatie ongeveer ${formatEuro(s.indicatiefBedrag)} (schatting)` : ''}
                    {s.deadline ? ` · deadline volgens de bron ${formatDatum(s.deadline)}` : ''}
                    {s.url && (
                      <>
                        {' · '}
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={css('color: #4E9A6C; font-weight: 800;')}>
                          bron
                        </a>
                      </>
                    )}
                  </span>
                </label>
              ))}
            </section>
          )}

          {model.premiumHint > 0 && (
            <aside data-testid="voorstel-premium-hint" style={css(`${TEKST} padding: 12px 16px; border: 1px solid #CFE4D7; border-radius: 14px; background: #F3F9F5; color: #2C4A5E;`)}>
              <strong>
                Er {model.premiumHint === 1 ? 'is nog 1 fonds' : `zijn nog ${model.premiumHint} fondsen`}
              </strong>{' '}
              die bij dit project {model.premiumHint === 1 ? 'past' : 'passen'} en alleen met Premium te zien {model.premiumHint === 1 ? 'is' : 'zijn'}. Dat zijn minder bekende fondsen die lastig te vinden zijn.{' '}
              <a href="#/kompas/abonneren?intent=PREMIUM" data-testid="voorstel-premium-link" style={css('color: #4E9A6C; font-weight: 800;')}>
                Bekijk Premium
              </a>
            </aside>
          )}

          <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px;')}>
            <button type="button" data-testid="voorstel-opslaan" disabled={fase === 'opslaan' || nietsGekozen || heeftFout} onClick={opslaan} style={css(`${KNOP_PRIMAIR}${fase === 'opslaan' || nietsGekozen || heeftFout ? ' opacity: 0.55; cursor: not-allowed;' : ''}`)}>
              {fase === 'opslaan' ? 'Bezig met opslaan…' : 'Opslaan in dit project'}
            </button>
            <button type="button" data-testid="voorstel-verwerp" disabled={fase === 'opslaan'} onClick={sluit} style={css(KNOP_STIL)}>
              Sluiten zonder opslaan
            </button>
            {fase === 'opslaan' && (
              <span role="status" data-testid="voorstel-opslaan-bezig" style={css(`${TEKST} font-size: 13px;`)}>
                Dekkingsplan wordt opgeslagen en het actieplan aangemaakt…
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
