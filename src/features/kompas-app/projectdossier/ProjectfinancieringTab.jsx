// Tab "Projectfinanciering / Dekkingsplan": het dekkingsplan van één project, met de startknop van Subsidie Kompas en,
// op dezelfde pagina, de Acties & deadlines van dat project. Bovenaan de dekking van de begroting
// (zelfde rekenmodule als Dashboard en projectdossier), daaronder de regels uit
// subsidie_kompas_program_funding. Bronnen buiten het abonnement blijven gemaskeerd; de eigen
// velden van het lid (bedragen, status, eigen deadline, herinnering, notitie) altijd zichtbaar.
// Toevoegen van regels gebeurt vanuit Deadlines (Fase 3); hier wijzig of verwijder je alleen.
import React, { useEffect, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import BespreekLink from '../financiering/BespreekLink.jsx'; // FASE5
import { DeadlineWeergave, HerinneringKnop, KLEUR, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { Blok, HelpKnop, Leeg, Melding } from '../../../shared/ui/werkplek.jsx';
import { ActieplanVoorProject } from '../financiering/ActieplanBlok.jsx';
import VoorstelWerkruimte from '../financiering/VoorstelWerkruimte.jsx';
import { bronVoorRegel, datumTekst } from '../financiering/bronStatus.js';
import { leesBronControles } from '../../../data/services/voorstelGenereren.js';
import FinancierFormulier from '../financiering/FinancierFormulier.jsx';
import FinancieringsRegel from '../financiering/FinancieringsRegel.jsx';
import { kansrijkheid } from '../financiering/kansrijkheid.js';
import { haalBronDetails } from '../../../data/services/deadlines.js';
import { useKompas } from '../KompasStore.jsx';
import { useApp } from '../useKompasApp.js';
import PremiumTeasers from './PremiumTeasers.jsx';
import {
  STATUSSEN,
  STATUS_LABEL,
  bedragVoorInvoer,
  formatDatum,
  formatEuro,
  leesBedragInvoer,
  projectBedrag,
} from '../financiering/dekkingsplan.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";
const INVOER =
  "box-sizing: border-box; width: 100%; min-height: 38px; padding: 7px 10px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2C4A5E;";

const CSS_TAB = `
.fwk-pf-nieuwbalk { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; margin-bottom: 12px; padding: 12px 16px; border: 1px solid #CFDFEA; border-radius: 14px; background: #EAF1F6; font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.5; color: #2C4A5E; }
.fwk-pf-nieuwtekst { flex: 1 1 360px; min-width: 0; }
.fwk-pf-nieuwlijst { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.fwk-pf-nieuwlijst li { display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 11px; border: 1px solid #CFDFEA; border-radius: 999px; background: #FFFFFF; font-size: 13px; font-weight: 700; color: #2C4A5E; }
.fwk-pf-nieuwlijst button { cursor: pointer; width: 24px; height: 24px; border: none; border-radius: 50%; background: none; font-size: 16px; line-height: 1; color: #7B8985; }
.fwk-pf-nieuwlijst button:hover { background: #F9ECEA; color: #9E3B2C; }
.fwk-pf-akkoord { cursor: pointer; min-height: 42px; padding: 0 22px; border: 1px solid #4E9A6C; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; align-self: center; }
.fwk-pf-akkoord:hover { background: #3E7F59; }
.fwk-pf-akkoordmelding { margin-bottom: 12px; padding: 12px 16px; border: 1px solid #BFD9C8; border-radius: 14px; background: #EAF4EE; font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.5; font-weight: 700; color: #2F6D47; }
.fwk-pf-rij { display: grid; gap: 12px 14px; align-items: start; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: 12px; padding-top: 12px; border-top: 1px solid #EEF2EF; }
.fwk-pf-label { display: block; margin-bottom: 4px; }
.fwk-pf-notitie { grid-column: 1 / 4; }
.fwk-pf-acties { grid-column: 4 / 6; justify-self: end; align-self: end; display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px 14px; }
.fwk-pf-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 10px 22px; }
.fwk-pf-rij input:focus-visible, .fwk-pf-rij select:focus-visible, .fwk-pf-rij textarea:focus-visible, .fwk-pf-rij button:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 1px; }
@media (max-width: 899px) {
  .fwk-pf-rij { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .fwk-pf-deadline, .fwk-pf-notitie, .fwk-pf-acties { grid-column: 1 / -1; }
  .fwk-pf-acties { justify-self: stretch; justify-content: flex-start; }
}
`;

function Legenda({ dekking }) {
  const items = [
    ['Totale begroting', dekking.heeftBegroting ? formatEuro(dekking.begroting) : '—', '#C5D2CB'],
    ['Toegekend', formatEuro(dekking.toegekend), KLEUR.toegekend],
    ['Aangevraagd', formatEuro(dekking.aangevraagd), KLEUR.aangevraagd],
    ['Gepland', formatEuro(dekking.gepland), KLEUR.gepland],
    ['Eigen bijdrage', formatEuro(dekking.overige), KLEUR.overige],
    ['Nog te financieren', dekking.heeftBegroting ? formatEuro(dekking.nogNodig) : '—', '#E1EAE4'],
  ];

  return (
    <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px 16px; margin-top: 14px;')}>
      {items.map(([naam, waarde, kleur]) => (
        <div key={naam} data-testid="pf-kpi" style={css('min-width: 0;')}>
          <div style={css(`display: flex; align-items: center; gap: 6px; ${TEKST} font-size: 12.5px; font-weight: 700; color: #7B8985;`)}>
            <span aria-hidden="true" style={css(`display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${kleur}; border: 1px solid #CFDDD5;`)} />
            {naam}
          </div>
          <div style={css("font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; white-space: nowrap;")}>{waarde}</div>
        </div>
      ))}
    </div>
  );
}


// De bandbreedte van de bijdrage rechts in de kopregel: de bandbreedte uit de database, anders de bijdragegrenzen.
// Een eigen financier (cofinancier) heeft geen bandbreedte; een verborgen of onbekende bron ook niet.
function bijdrageTekst(regel, details) {
  if (regel.bronType === 'financier' || regel.bronStatus !== 'zichtbaar') return null;
  if (!details) return <span data-testid="pf-regel-bijdrage">bijdrage niet bekend</span>;

  const { bandbreedteBijdrage: band, bedragMin: min, bedragMax: max } = details;
  const tekst = band
    ? band
    : min != null && max != null
      ? `${formatEuro(min)} – ${formatEuro(max)}`
      : max != null
        ? `tot ${formatEuro(max)}`
        : min != null
          ? `vanaf ${formatEuro(min)}`
          : 'niet bekend';

  return <span data-testid="pf-regel-bijdrage">bijdrage {tekst}</span>;
}

function InfoVeld({ label, children, testid, leeg }) {
  return (
    <div data-testid={testid} style={css('min-width: 0;')}>
      <div style={css(LABEL)}>{label}</div>
      <div style={css(`${TEKST} margin-top: 3px; white-space: pre-wrap; overflow-wrap: anywhere; color: ${leeg ? '#9AA6A2' : '#4B5C58'};`)}>{children}</div>
    </div>
  );
}

// Meer informatie in de uitklapregel: wat het fonds ondersteunt, waarom het past, voor wie en waar, voorwaarden en de bron.
// Uitsluitend bestaande gegevens; wat ontbreekt staat er als "nog niet bekend", niet verzonnen.
// Aanvraagdetails uit kompas_bron_details; alleen wat gevuld is, wordt getoond.
const AANVRAAG_VELDEN = [
  ['typeProjecten', 'Type projecten'],
  ['beoordelingscriteria', 'Beoordelingscriteria'],
  ['eigenBijdrage', 'Eigen bijdrage'],
  ['cofinanciering', 'Cofinanciering'],
  ['begrotingseisen', 'Begrotingseisen'],
  ['behandeltermijn', 'Behandeltermijn'],
  ['aanvraagprocedure', 'Aanvraagprocedure'],
  ['bijdrageToelichting', 'Over de bijdrage'],
];

function RegelInfo({ regel, bron, details, kans, heeftBron }) {
  if (!heeftBron) {
    return (
      <div style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>
        {regel.bronStatus === 'verborgen' ? 'Deze bron valt buiten uw abonnement; uw eigen gegevens hieronder blijven bewerkbaar.' : 'Deze bron bestaat niet meer; uw eigen gegevens hieronder blijven bewerkbaar.'}
      </div>
    );
  }

  const voorWieWaar = details
    ? [
        details.themasNamen && details.themasNamen.length ? `Disciplines: ${details.themasNamen.join(', ')}` : null,
        details.doelgroepenNamen && details.doelgroepenNamen.length ? `Doelgroepen: ${details.doelgroepenNamen.join(', ')}` : null,
        details.werkgebiedenNamen && details.werkgebiedenNamen.length ? `Werkgebied: ${details.werkgebiedenNamen.join(', ')}` : null,
      ].filter(Boolean)
    : [];
  const website = regel.website || (details && details.url) || '';

  return (
    <div data-testid="pf-regel-info" className="fwk-pf-info">
      {regel.bronType !== 'financier' && (
        <>
          <InfoVeld label={regel.bronType === 'fonds' ? 'Wat dit fonds ondersteunt' : 'Wat deze regeling ondersteunt'} leeg={!(details && details.omschrijving)}>
            {(details && details.omschrijving) || 'Nog niet bekend.'}
          </InfoVeld>
          {kans && (
            <InfoVeld label="Waarom het past" testid="pf-regel-match">
              <strong style={css(`color: ${kans.color};`)}>{kans.label}.</strong> {kans.tekst}
            </InfoVeld>
          )}
          {voorWieWaar.length > 0 && <InfoVeld label="Voor wie en waar">{voorWieWaar.join('\n')}</InfoVeld>}
          <InfoVeld label={regel.bronType === 'fonds' ? 'Toelichting' : 'Voorwaarden om te controleren'} leeg={!(details && details.voorwaarden)}>
            {(details && details.voorwaarden) || 'Nog niet bekend; controleer ze bij de officiële bron.'}
          </InfoVeld>
          {details && details.aanvraag &&
            AANVRAAG_VELDEN.filter(([k]) => details.aanvraag[k]).map(([k, label]) => (
              <InfoVeld key={k} label={label} testid="pf-regel-aanvraag">
                {details.aanvraag[k]}
              </InfoVeld>
            ))}
        </>
      )}
      <InfoVeld label="Bron">
        {details && details.aanvraag && details.aanvraag.aanvraaglink && details.aanvraag.aanvraaglink !== website && (
          <div style={css('margin-bottom: 4px;')}>
            <a href={details.aanvraag.aanvraaglink} target="_blank" rel="noopener noreferrer" style={css('color: #4E9A6C; font-weight: 800;')}>
              Aanvraagformulier →
            </a>
          </div>
        )}
        {website ? (
          <a href={website} target="_blank" rel="noopener noreferrer" style={css('color: #4E9A6C; font-weight: 800;')}>
            Officiële website →
          </a>
        ) : (
          <span style={css('color: #9AA6A2;')}>Geen website bekend</span>
        )}
        {/* De bronstatus is los van de financieringsstatus: gecontroleerd betekent alleen dat de bron is gecontroleerd, niet dat er is toegekend. */}
        {bron && (
          <div data-testid="pf-regel-bron" data-bron-status={bron.status} title={bron.uitleg} style={css(`margin-top: 4px; font-size: 12.5px; font-weight: 700; color: ${{ gecontroleerd: '#2F7A4D', onzeker: '#8A5A16', mislukt: '#A3382B' }[bron.status] || '#5D6B67'};`)}>
            Bron: {bron.label}
            {bron.gecontroleerdOp && bron.status === 'gecontroleerd' ? ` op ${datumTekst(bron.gecontroleerdOp)}` : ''}
            {bron.verouderd ? ' (gegevens veranderd of controle te oud)' : ''}
          </div>
        )}
      </InfoVeld>
    </div>
  );
}

function Regel({ regel, bron = null, details = null, kans = null, nieuw = false, open = false, onToggle, onWijzig, onVerwijder }) {
  const [aangevraagd, setAangevraagd] = useState(bedragVoorInvoer(regel.requested));
  const [toegekend, setToegekend] = useState(bedragVoorInvoer(regel.awarded));
  const [notitie, setNotitie] = useState(regel.notitie || '');
  const [fout, setFout] = useState('');
  const [bevestig, setBevestig] = useState(false);

  // Na een herlaad (of een wijziging elders) de velden gelijktrekken met de bron.
  useEffect(() => setAangevraagd(bedragVoorInvoer(regel.requested)), [regel.requested]);
  useEffect(() => setToegekend(bedragVoorInvoer(regel.awarded)), [regel.awarded]);
  useEffect(() => setNotitie(regel.notitie || ''), [regel.notitie]);

  const bewaar = async (wijziging) => {
    setFout('');

    const res = await onWijzig(regel.id, wijziging);

    if (!res || !res.ok) {
      setFout('Opslaan is niet gelukt. Probeer het opnieuw.');
    }
  };

  const bewaarBedrag = (veld, tekst, huidig) => {
    const gelezen = leesBedragInvoer(tekst);

    if (!gelezen.ok) {
      setFout('Vul een bedrag in, bijvoorbeeld 12.500.');

      return;
    }

    if (gelezen.waarde !== huidig) {
      bewaar({ [veld]: gelezen.waarde });
    } else {
      setFout('');
    }
  };

  const naam = regel.naam;
  const heeftBron = regel.bronStatus === 'zichtbaar';
  const toegekendHint = regel.status === 'awarded' && regel.awarded == null && regel.requested != null ? 'Leeg: het aangevraagde bedrag telt als toegekend.' : '';

  const soort = regel.bronType === 'financier' ? 'Cofinancier of andere financiering' : regel.bronType === 'fonds' ? 'Fonds' : 'Regeling';
  const bedragLabel = (() => {
    if (regel.status === 'awarded') {
      const w = regel.awarded != null ? regel.awarded : regel.requested;

      return w != null ? `toegekend ${formatEuro(w)}` : null;
    }

    if (regel.requested == null) return null;
    if (regel.status === 'submitted') return `aangevraagd ${formatEuro(regel.requested)}`;
    if (regel.status === 'rejected' || regel.status === 'withdrawn') return `${STATUS_LABEL[regel.status].toLowerCase()}: ${formatEuro(regel.requested)}`;

    return `advies ${formatEuro(regel.requested)}`;
  })();
  const deadlineKort = regel.deadline ? formatDatum(regel.deadline) : null;
  const samenvatting = [
    STATUS_LABEL[regel.status] || regel.status,
    deadlineKort ? `deadline ${deadlineKort}` : null,
    heeftBron ? soort : null,
    heeftBron && regel.funder && regel.bronType !== 'fonds' && regel.bronType !== 'financier' ? regel.funder : null,
    bron ? `Bron: ${bron.label}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <FinancieringsRegel
      testId="pf-regel"
      data-regel-id={regel.id}
      data-bron-status={regel.bronStatus}
      data-status={regel.status}
      open={open}
      onToggle={onToggle}
      titel={
        <>
          <span data-testid="pf-regel-naam" style={heeftBron ? undefined : { color: '#7B8985', fontStyle: 'italic' }}>
            {naam}
          </span>
          {nieuw && (
            <span data-testid="pf-regel-nieuw" style={css("margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: #EAF1F6; font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #2C4A5E; vertical-align: 1px;")}>
              Nieuw van Subsidie Kompas
            </span>
          )}
          {heeftBron && details && details.accessTier === 'premium' && (
            <span data-testid="pf-regel-premium" style={css("margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: #EAF4EE; font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #2F6D47; vertical-align: 1px;")}>
              Premium
            </span>
          )}
        </>
      }
      bedrag={bedragLabel}
      bedragLeeg="bedrag nog niet ingevuld"
      extra={bijdrageTekst(regel, details)}
      samenvatting={samenvatting}
    >
      <RegelInfo regel={regel} bron={bron} details={details} kans={kans} heeftBron={heeftBron} />
      <div className="fwk-pf-rij">
        <div>
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Aangevraagd</span>
            <input
              aria-label={`Aangevraagd bedrag, ${naam}`}
              inputMode="decimal"
              value={aangevraagd}
              placeholder="€"
              onChange={(e) => setAangevraagd(e.target.value)}
              onBlur={() => bewaarBedrag('requested', aangevraagd, regel.requested)}
              style={css(INVOER)}
            />
          </label>
        </div>

        <div>
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Toegekend</span>
            <input
              aria-label={`Toegekend bedrag, ${naam}`}
              inputMode="decimal"
              value={toegekend}
              placeholder="€"
              onChange={(e) => setToegekend(e.target.value)}
              onBlur={() => bewaarBedrag('awarded', toegekend, regel.awarded)}
              style={css(INVOER)}
            />
          </label>
          {toegekendHint && <div style={css(`${TEKST} margin-top: 4px; font-size: 12px; color: #7B8985;`)}>{toegekendHint}</div>}
        </div>

        <div>
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Status</span>
            <select
              aria-label={`Status, ${naam}`}
              value={regel.status}
              onChange={(e) => bewaar({ status: e.target.value })}
              style={css(INVOER)}
            >
              {STATUSSEN.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="fwk-pf-deadline">
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Deadline</span>
            <input
              type="date"
              aria-label={`Eigen deadline, ${naam}`}
              value={regel.eigenDeadline || ''}
              onChange={(e) => bewaar({ eigenDeadline: e.target.value || null })}
              style={css(INVOER)}
            />
          </label>
          <div data-testid="pf-regel-deadline" style={css(`${TEKST} margin-top: 4px; font-size: 12.5px; color: #4B5C58;`)}>
            <DeadlineWeergave regel={regel} nu={new Date()} />
          </div>
        </div>

        <div>
          <span className="fwk-pf-label" style={css(LABEL)}>Herinnering</span>
          <HerinneringKnop aan={regel.reminder} naam={naam} onWissel={() => bewaar({ reminder: !regel.reminder })} />
        </div>

        <div className="fwk-pf-notitie">
          <label>
            <span className="fwk-pf-label" style={css(LABEL)}>Notitie</span>
            <textarea
              aria-label={`Notitie, ${naam}`}
              rows={1}
              maxLength={4000}
              value={notitie}
              placeholder="Notitie (bijvoorbeeld contactpersoon of voorwaarden)"
              onChange={(e) => setNotitie(e.target.value)}
              onBlur={() => {
                if ((notitie || '') !== (regel.notitie || '')) bewaar({ notitie });
              }}
              style={css(`${INVOER} resize: vertical; line-height: 1.5;`)}
            />
          </label>
        </div>

        <div className="fwk-pf-acties">
          {/* FASE5 */}
          <BespreekLink projectId={regel.projectId} fundingId={regel.id} naam={naam} stijl="min-height: 36px;" />
          {bevestig ? (
            <span style={css('display: inline-flex; gap: 8px; flex-wrap: wrap;')}>
              <button
                type="button"
                onClick={() => onVerwijder(regel.id)}
                style={css("cursor: pointer; min-height: 40px; padding: 0 14px; border: 1px solid #E3B8B1; border-radius: 999px; background: #F9ECEA; color: #9E3B2C; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
              >
                Ja, verwijderen
              </button>
              <button
                type="button"
                onClick={() => setBevestig(false)}
                style={css("cursor: pointer; min-height: 40px; padding: 0 14px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
              >
                Annuleren
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Verwijderen uit dekkingsplan, ${naam}`}
              onClick={() => setBevestig(true)}
              style={css("cursor: pointer; min-height: 40px; padding: 0 6px; border: none; background: none; color: #9E3B2C; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700;")}
            >
              Verwijderen
            </button>
          )}
        </div>
      </div>
      {fout && (
        <div role="alert" data-testid="pf-regel-fout" style={css(`${TEKST} margin-top: 8px; font-size: 13px; font-weight: 700; color: #9E3B2C;`)}>
          {fout}
        </div>
      )}
    </FinancieringsRegel>
  );
}

function leesNieuw(sleutel) {
  try {
    const ruw = sleutel && window.localStorage ? JSON.parse(window.localStorage.getItem(sleutel) || '[]') : [];

    return Array.isArray(ruw) ? ruw.filter((x) => typeof x === 'string') : [];
  } catch (e) {
    return [];
  }
}

function bewaarNieuw(sleutel, ids) {
  try {
    if (!sleutel || !window.localStorage) return;
    if (ids.length) window.localStorage.setItem(sleutel, JSON.stringify(ids));
    else window.localStorage.removeItem(sleutel);
  } catch (e) {
    // Geen opslag beschikbaar: het label verdwijnt dan na verversen; verder werkt alles.
  }
}

export default function ProjectfinancieringTab({ project, financiering, dekking, toonActieplan = true }) {
  const { status, fout, regels, wijzig: wijzigRegel, verwijder: verwijderRegelUitPlan, laad } = financiering;
  const store = useKompas();
  const app = useApp();
  // Regels die Subsidie Kompas net aan het plan toevoegde: herkenbaar met een label tot het lid er iets aan verandert, en in één keer terug te draaien.
  const nieuwSleutel = project && project.id ? `sk-nieuw-${project.id}` : '';
  const [nieuweIds, setNieuweIds] = useState(() => leesNieuw(nieuwSleutel));
  const zetNieuw = (ids) => {
    setNieuweIds(ids);
    bewaarNieuw(nieuwSleutel, ids);
  };
  const haalUitNieuw = (id) => {
    if (nieuweIds.includes(id)) zetNieuw(nieuweIds.filter((x) => x !== id));
  };
  const wijzig = (id, wijziging) => {
    haalUitNieuw(id);

    return wijzigRegel(id, wijziging);
  };
  const verwijder = (id) => {
    haalUitNieuw(id);

    return verwijderRegelUitPlan(id);
  };
  const nieuwInPlan = status === 'klaar' ? regels.filter((r) => nieuweIds.includes(r.id)) : [];
  const nieuwSamen = nieuwInPlan.reduce((t, r) => t + (Number(r.requested) || 0), 0);
  // Akkoord: het lid bevestigt wat Subsidie Kompas voorstelde. De regels staan al in het dekkingsplan (en tellen mee als Gepland); akkoord haalt alleen
  // het label "Nieuw van Subsidie Kompas" weg, zodat duidelijk is dat deze fondsen door het lid zijn goedgekeurd.
  const [akkoord, setAkkoord] = useState(null); // { aantal, bedrag }
  const eigenBijdrage = projectBedrag(project && project.eigenBijdrage);
  const [eigenOpen, setEigenOpen] = useState(0);
  const keurGoed = () => {
    setAkkoord({ aantal: nieuwInPlan.length, bedrag: nieuwSamen });
    zetNieuw([]);
  };
  const [actieVersie, setActieVersie] = useState(0);
  const [openRegels, setOpenRegels] = useState({});
  const [bronDetails, setBronDetails] = useState({ perRegeling: {}, perFonds: {} });
  const detailSleutel = regels.map((r) => `${r.schemeId || ''}:${r.funderId || ''}`).join(',');

  // Bandbreedte, omschrijving en voorwaarden van de regelingen en fondsen in dit plan (alleen lezen, zelfde views als Deadlines).
  useEffect(() => {
    let actief = true;
    const schemeIds = regels.filter((r) => r.schemeId).map((r) => r.schemeId);
    const funderIds = regels.filter((r) => r.funderId && !r.schemeId).map((r) => r.funderId);

    if (!schemeIds.length && !funderIds.length) return undefined;

    haalBronDetails({ schemeIds, funderIds }).then((res) => {
      if (actief) setBronDetails({ perRegeling: res.perRegeling || {}, perFonds: res.perFonds || {} });
    });

    return () => {
      actief = false;
    };
  }, [detailSleutel]);

  const detailsVan = (r) => (r.schemeId ? bronDetails.perRegeling[r.schemeId] : r.funderId ? bronDetails.perFonds[r.funderId] : null) || null;
  const allesOpen = regels.length > 0 && regels.every((r) => openRegels[r.id]);
  const [bronRijen, setBronRijen] = useState([]);

  // De bronstatus per regel komt uit de tabel die de SERVER bijhoudt: ze blijft dus staan na verversen en na opslaan.
  const aantalRegels = regels.length;

  useEffect(() => {
    let actief = true;

    if (project && project.id && status === 'klaar') {
      leesBronControles(project.id).then((res) => {
        if (actief) setBronRijen(res.rijen);
      });
    }

    return () => {
      actief = false;
    };
  }, [project && project.id, status, aantalRegels, actieVersie]);

  return (
    <div data-testid="tab-projectfinanciering" style={css('display: flex; flex-direction: column; gap: 18px;')}>
      <style>{CSS_TAB}</style>

      {status === 'geen-database' && <Melding toon="waarschuwing">Dit project is nog niet opgeslagen in uw account. Sla het project op om een dekkingsplan op te bouwen.</Melding>}
      {status === 'fout' && (
        <Melding toon="waarschuwing" testid="pf-fout" rol="alert">
          {fout === 'niet-beschikbaar'
            ? 'Projectfinanciering is nog niet beschikbaar in uw omgeving. Uw projectgegevens zijn niet aangetast.'
            : 'Het dekkingsplan kon niet worden geladen. Ververs de pagina of probeer het later opnieuw.'}
        </Melding>
      )}

      <VoorstelWerkruimte
        project={project}
        opgeslagen={status !== 'geen-database' && Boolean(project && project.id)}
        onOpgeslagen={(uit) => {
          const ids = uit ? [...(uit.regels || []), ...(uit.suggesties || [])].filter((r) => r.status === 'opgeslagen' && r.fundingId).map((r) => r.fundingId) : [];

          if (ids.length) zetNieuw(ids);
          laad();
          setActieVersie((v) => v + 1);
        }}
      />

      <Blok
        testid="pf-dekking"
        titel="Dekking van de begroting"
        actie={
          <HelpKnop label="Hoe telt dit?">
            <p>Toegekend telt het toegekende bedrag (is dat leeg, dan het aangevraagde bedrag). Aangevraagd telt regels met status Aangevraagd.</p>
            <p>Gepland telt het bedrag van regels met status Interessant of In voorbereiding. Eigen bijdrage staat bij de projectgegevens.</p>
          </HelpKnop>
        }
      >
        {dekking.heeftBegroting ? (
          <>
            <Voortgangsbalk dekking={dekking} projectNaam={project.naam || 'dit project'} hoogte={10} metPlan />
            <div data-testid="pf-samenvatting" style={css(`${TEKST} margin-top: 8px; font-weight: 700; color: ${dekking.volledigGedekt ? '#2F6D47' : '#2C4A5E'};`)}>
              {dekking.volledigGedekt ? 'Volledig gedekt' : `Nog te financieren: ${formatEuro(dekking.nogNodig)}`}
            </div>
            {!dekking.volledigGedekt && dekking.planVolledig && (
              <div data-testid="pf-sluitend" style={css(`${TEKST} margin-top: 2px; font-size: 13.5px; color: #2F6D47;`)}>
                Met wat gepland staat is de begroting sluitend
                {dekking.overgedekt > 0 ? `, plus ca. ${Math.round((dekking.overgedekt / dekking.begroting) * 100)}% buffer voor afwijzingen` : ''}.
              </div>
            )}
          </>
        ) : (
          <Leeg>
            Nog geen begroting.{' '}
            <a href={`#/kompas/projecten/${project.id}?bewerk=1`} className="fwk-wp-link">
              Begroting invullen
            </a>
          </Leeg>
        )}
        <Legenda dekking={dekking} />
        {dekking.heeftBegroting && (
          <div data-testid="pf-nog-te-plannen" style={css(`${TEKST} margin-top: 10px; font-size: 13px; color: #4B5C58;`)}>
            Waarvan nog niet gepland: <strong>{formatEuro(dekking.nogTePlannen)}</strong>
          </div>
        )}
      </Blok>

      <Blok
        testid="pf-regels"
        titel="Regelingen in het dekkingsplan"
        aantal={status === 'klaar' ? regels.length : null}
        actie={
          <a href="#/kompas/deadlines" className="fwk-wp-link" data-testid="pf-zoek-regelingen">
            Regelingen zoeken
          </a>
        }
        kaal
      >
        {status === 'laden' && <Leeg>Dekkingsplan wordt geladen…</Leeg>}

        {status === 'klaar' && regels.length === 0 && (
          <div data-testid="pf-leeg" style={css(`${TEKST} padding: 16px 18px; border: 1px dashed #CFDDD5; border-radius: 12px; color: #687974;`)}>
            Nog geen financiering in het dekkingsplan.{' '}
            <a href="#/kompas/deadlines" className="fwk-wp-link">
              Regelingen zoeken
            </a>
          </div>
        )}

        {nieuwInPlan.length > 0 && (
          <div data-testid="pf-nieuw-balk" role="status" className="fwk-pf-nieuwbalk">
            <div className="fwk-pf-nieuwtekst">
              <div>
                <strong>
                  Subsidie Kompas stelt {nieuwInPlan.length} {nieuwInPlan.length === 1 ? 'fonds' : 'fondsen'} voor
                </strong>
                {nieuwSamen > 0 ? `, samen ${formatEuro(nieuwSamen)} geadviseerd` : ''}. Ze staan al in uw dekking als Gepland. Haal weg wat niet past en klik daarna op Akkoord.
              </div>
              <ul className="fwk-pf-nieuwlijst" data-testid="pf-nieuw-lijst">
                {nieuwInPlan.map((r) => {
                  const naam = r.naam || 'Financier';

                  return (
                    <li key={r.id} data-testid="pf-nieuw-fonds">
                      <span>{naam}</span>
                      <button type="button" aria-label={`${naam} weghalen uit het dekkingsplan`} title="Weghalen" onClick={() => verwijder(r.id)} data-testid="pf-nieuw-weg">
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <button type="button" data-testid="pf-akkoord" onClick={keurGoed} className="fwk-pf-akkoord">
              ✓ Akkoord
            </button>
          </div>
        )}

        {nieuwInPlan.length === 0 && akkoord && (
          <div data-testid="pf-akkoord-melding" role="status" className="fwk-pf-akkoordmelding">
            ✓ Akkoord. {akkoord.aantal === 1 ? 'Dit fonds staat' : `Deze ${akkoord.aantal} fondsen staan`} in uw dekkingsplan{akkoord.bedrag > 0 ? ` (${formatEuro(akkoord.bedrag)} gepland)` : ''}, tellen mee in de dekking van de begroting en staan in uw actieplan.
          </div>
        )}

        {regels.length > 0 && (
          <>
            <div style={css('display: flex; justify-content: flex-end; margin: -4px 0 8px;')}>
              <button
                type="button"
                className="fwk-wp-link"
                data-testid="pf-alles-uitklappen"
                onClick={() => setOpenRegels(allesOpen ? {} : Object.fromEntries(regels.map((r) => [r.id, true])))}
              >
                {allesOpen ? 'Alles inklappen' : 'Alles uitklappen'}
              </button>
            </div>
            <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
              {regels.map((r) => {
                const details = detailsVan(r);

                return (
                  <Regel
                    key={r.id}
                    regel={r}
                    bron={bronVoorRegel(r, bronRijen)}
                    details={details}
                    kans={r.bronType !== 'financier' && r.bronStatus === 'zichtbaar' && details ? kansrijkheid(details, store.orgProfile || {}, store.projects) : null}
                    nieuw={nieuweIds.includes(r.id)}
                    open={Boolean(openRegels[r.id])}
                    onToggle={(v) => setOpenRegels((cur) => ({ ...cur, [r.id]: v }))}
                    onWijzig={wijzig}
                    onVerwijder={verwijder}
                  />
                );
              })}
            </div>
            {eigenBijdrage > 0 && (
              <div data-testid="pf-eigen-regel" style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 8px; padding: 12px 16px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF;')}>
                <div>
                  <div style={css("font-family: 'Mulish', sans-serif; font-size: 15px; font-weight: 800; color: #2C4A5E;")}>Eigen bijdrage</div>
                  <div style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>Financier · telt mee in de dekking</div>
                </div>
                <div style={css('display: flex; align-items: center; gap: 14px;')}>
                  <strong style={css(`${TEKST} color: #2C4A5E;`)}>{formatEuro(eigenBijdrage)}</strong>
                  <button type="button" className="fwk-wp-link" data-testid="pf-eigen-aanpassen" onClick={() => setEigenOpen((n) => n + 1)}>
                    Aanpassen
                  </button>
                </div>
              </div>
            )}
            <div data-testid="pf-totaal" style={css(`${TEKST} margin-top: 10px; padding: 10px 14px; border-radius: 12px; background: #F3F9F5; font-weight: 700; color: #2C4A5E;`)}>
              Samen: toegekend {formatEuro(dekking.toegekend)}{eigenBijdrage > 0 ? ` · eigen bijdrage ${formatEuro(eigenBijdrage)}` : ''} · aangevraagd {formatEuro(dekking.aangevraagd)} · gepland {formatEuro(dekking.gepland)}
              {dekking.heeftBegroting && <> · {dekking.volledigGedekt ? 'volledig gedekt' : `nog te financieren ${formatEuro(dekking.nogNodig)}`}</>}
            </div>
          </>
        )}
        {status === 'klaar' && project && project.id && (
          <div style={css('margin-top: 12px;')}>
            <FinancierFormulier
              projectId={project.id}
              onKlaar={laad}
              eigenBijdrage={eigenBijdrage}
              openEigen={eigenOpen}
              onEigenBijdrage={async (bedrag) => {
                const id = await store.saveProject({ ...project, eigenBijdrage: bedrag });

                return Boolean(id);
              }}
            />
          </div>
        )}
      </Blok>

      {/* Alleen Pro: passende Premium-fondsen zonder naam of bedrag, los van het dekkingsplan (telt niet mee in de dekking). */}
      {status === 'klaar' && project && project.id && app.subscriptionTier === 'pro' && (
        <PremiumTeasers projectId={project.id} versie={aantalRegels} onUpgrade={app.goAbonnementen} />
      )}

      {toonActieplan && status === 'klaar' && project && project.id && (
        <section id="pf-acties" data-testid="pf-acties" style={css('box-sizing: border-box; padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}>
          <ActieplanVoorProject key={actieVersie} project={project} regels={regels} />
        </section>
      )}
    </div>
  );
}
