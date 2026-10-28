// Stukken voor fondsenwerving: wat vrijwel elk fonds vraagt, ÉÉN keer (niet bij elk fonds opnieuw). Staat in het actieplan
// (organisatie- én projectstukken) en op de pagina Organisatie (alleen de organisatiestukken).
// - Organisatie: basis (jaarrekening, ANBI, statuten, KvK) en aanvullend (jaarverslag, bestuur, IBAN).
// - Per project: projectplan en begroting; bij kunst en cultuur ook communicatie-, publieksbereikplan, cv's en beeldmateriaal;
//   intentieverklaringen als er partners zijn; aanbevelingsbrief (nodig bij kleine aanvragen); offertes optioneel.
// - Klein of groot (niet op bedrag; een klein fonds kan ook € 50.000 geven): subsidieregelingen van de overheid en de grote
//   (Pro-)fondsen met een aanvraagformulier (Mondriaan Fonds, Oranje Fonds, Fonds21, VSBfonds) zijn groot: de volledige lijst uit
//   het aanvraagformulier, bij Indienen. De kleine fondsen buiten beeld (Premium) vragen meestal alleen de basisset.
// Een stuk is klaar als het in Documenten staat (op naam of soort) of als het lid het zelf heeft afgevinkt. Afvinken is alleen
// een kennisgeving voor het lid ("mijn aanvraag is compleet"); Subsidie Kompas controleert de stukken daarmee niet.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { haalOrganisatieDocumentenOp } from '../../../data/services/organisatiedocumenten.js';
import { haalAfgevinkt, sleutelAfgevinkt, zetAfgevinkt } from '../../../data/services/stukkenAfgevinkt.js';
import { haalOmvang } from '../../../data/services/fondsOmvang.js';
import { documentenLijst } from '../aanvraag/aanvraagModel.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #2C4A5E;";
const KOPJE = `${TEKST} font-size: 12px; font-weight: 800; padding: 8px 14px; background: #F6F8F7; color: #4B5C58;`;


// Organisatie: één keer voor alle fondsen.
export const ORGANISATIE_STUKKEN = [
  // Basis: vraagt vrijwel elk fonds.
  { id: 'jaarrekening', basis: true, tekst: 'Jaarrekening van het afgelopen jaar', woorden: ['jaarrekening', 'jaarcijfers'], maxMaanden: 12 },
  { id: 'anbi', basis: true, tekst: 'ANBI-beschikking', woorden: ['anbi'] },
  { id: 'statuten', basis: true, tekst: 'Statuten', woorden: ['statuten'] },
  { id: 'kvk', basis: true, tekst: 'Uittreksel KvK (niet ouder dan 3 maanden)', woorden: ['kvk', 'kamer van koophandel', 'uittreksel'], maxMaanden: 3 },
  // Aanvullend: vragen veel fondsen erbij.
  { id: 'jaarverslag', tekst: 'Jaarverslag van het afgelopen jaar', woorden: ['jaarverslag', 'bestuursverslag'], maxMaanden: 12 },
  { id: 'bestuur', tekst: 'Bestuurssamenstelling', woorden: ['bestuur'] },
  { id: 'iban', tekst: 'Bankafschrift of IBAN op naam van de organisatie', woorden: ['bankafschrift', 'iban', 'bankgegevens'] },
];

// Per project.
const PROJECT_STUKKEN = [
  { id: 'projectplan', tekst: 'Projectplan (met monitoring, evaluatie en effectmeting)', woorden: ['projectplan'] },
  { id: 'begroting', tekst: 'Begroting en dekkingsplan', woorden: ['begroting', 'dekkingsplan'] },
];

// Extra bij kunst- en cultuurprojecten.
const CULTUUR_STUKKEN = [
  { cultuur: true, id: 'communicatieplan', tekst: 'Communicatieplan', woorden: ['communicatieplan', 'communicatie'] },
  { cultuur: true, id: 'publieksbereik', tekst: 'Publieksbereik- of marketingplan', woorden: ['publieksbereik', 'marketing'] },
  { cultuur: true, id: 'cv', tekst: "Cv's of biografie van de makers", woorden: ['cv', 'biografie'] },
  { cultuur: true, id: 'beeld', tekst: "Beeldmateriaal (foto's, schetsen, eerder werk)", woorden: ['beeld', 'foto', 'schets', 'portfolio'] },
];

const PARTNER_STUK = { id: 'intentie', tekst: 'Intentieverklaringen van partners', woorden: ['intentieverklaring', 'samenwerkingsverklaring', 'intentie'], wanneer: 'U werkt samen met partners' };
const AANBEVELING = { id: 'aanbevelingsbrief', tekst: 'Aanbevelingsbrief', woorden: ['aanbeveling', 'steunbrief'] };
const OFFERTES = { id: 'offertes', tekst: 'Offertes', woorden: ['offerte'], wanneer: 'Optioneel: check de aanvraagvoorwaarden en criteria van het fonds', optioneel: true };

const CULTUUR = /kunst|cultuur|muziek|theater|dans|film|literatuur|erfgoed|podium|beeldend|festival|design|fotografie/i;

function maandenGeleden(iso, nu) {
  const d = iso ? new Date(iso) : null;

  if (!d || Number.isNaN(d.getTime())) return null;

  return (nu.getFullYear() - d.getFullYear()) * 12 + (nu.getMonth() - d.getMonth());
}

// In Documenten? -> { status: 'klaar' | 'te-oud' | 'nodig', doc }
export function zoekStuk(stuk, docs, nu = new Date()) {
  const doc = (docs || []).find((d) => stuk.woorden.some((w) => `${d.naam} ${d.soort}`.toLowerCase().includes(w)));

  if (!doc) return { status: 'nodig', doc: null };

  const oud = stuk.maxMaanden ? maandenGeleden(doc.datum, nu) : null;

  return { status: oud !== null && oud > stuk.maxMaanden ? 'te-oud' : 'klaar', doc };
}

// Met de eigen vinkjes erbij: een zelf afgevinkt stuk telt als klaar (ook als het bestand te oud lijkt).
export function stukUitkomst(stuk, docs, afgevinkt, nu = new Date()) {
  const u = zoekStuk(stuk, docs, nu);

  if (u.status !== 'klaar' && afgevinkt) return { status: 'klaar', doc: null, zelf: true };

  return u;
}

// Klein of groot komt van de server (kompas_bron_omvang): automatisch (overheid/EU of Pro = groot, Premium = klein) of zoals in
// Beheer per fonds gekozen. Een eigen financier of een bron zonder antwoord: onbekend (geen gok).
export function grootteVan(regel, omvang) {
  if (!regel || regel.bronStatus !== 'zichtbaar' || (regel.bronType !== 'regeling' && regel.bronType !== 'fonds')) return 'onbekend';

  return omvang === 'groot' || omvang === 'klein' ? omvang : 'onbekend';
}

const detailVan = (details, r) => (r.bronType === 'regeling' ? details.perRegeling[r.schemeId] : details.perFonds[r.funderId]) || null; // = 'groot' | 'klein' | ...

// De eigen vinkjes van het lid, met afvinken en weghalen.
export function useAfgevinkt() {
  const [set, setSet] = useState(() => new Set());

  useEffect(() => {
    let weg = false;

    haalAfgevinkt().then((s) => {
      if (!weg) setSet(s);
    });

    return () => {
      weg = true;
    };
  }, []);

  const wissel = useCallback(
    async (programId, stukId) => {
      const sleutel = sleutelAfgevinkt(programId, stukId);
      const aan = !set.has(sleutel);
      const zet = (erbij) =>
        setSet((cur) => {
          const n = new Set(cur);

          if (erbij) n.add(sleutel);
          else n.delete(sleutel);

          return n;
        });

      zet(aan);

      const res = await zetAfgevinkt({ programId, stukId, aan });

      // Mislukt: het vinkje terugzetten.
      if (!res.ok) zet(!aan);
    },
    [set],
  );

  return { isAf: (programId, stukId) => set.has(sleutelAfgevinkt(programId, stukId)), wissel };
}

function Regel({ stuk, uitkomst, voor, onToevoegen, onVink }) {
  const { doc, zelf } = uitkomst;
  const status = stuk.optioneel && uitkomst.status === 'nodig' ? 'optioneel' : uitkomst.status;
  const kleur = status === 'klaar' ? '#2F6D47' : status === 'te-oud' ? '#8A5A16' : '#2C4A5E';
  const teken = status === 'klaar' ? '✓' : status === 'te-oud' ? '!' : '';
  // Een stuk dat in Documenten staat, vinkt vanzelf af; alle andere kan het lid zelf (de)afvinken.
  const kanVinken = Boolean(onVink) && !(status === 'klaar' && !zelf);
  const vakStijl = `box-sizing: border-box; flex: none; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border-radius: 5px; font-size: 12px; font-weight: 800; ${
    status === 'klaar'
      ? 'background: #4E9A6C; color: #FFFFFF; border: none;'
      : status === 'te-oud'
        ? 'background: #FBF1E3; color: #8A5A16; border: 1px solid #EEDCC0;'
        : status === 'optioneel'
          ? 'background: #FFFFFF; border: 1.5px dashed #CFD9D4;'
          : 'background: #FFFFFF; border: 1.5px solid #B9C7C0;'
  }`;

  return (
    <li data-testid="stuk" data-stuk={stuk.id} data-status={status} data-zelf={zelf ? '1' : '0'} style={css('display: flex; gap: 12px; align-items: center; padding: 9px 14px; border-bottom: 1px solid #EEF2EF;')}>
      {kanVinken ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={status === 'klaar'}
          aria-label={`${status === 'klaar' ? 'Vinkje weghalen' : 'Zelf afvinken'}: ${stuk.tekst}`}
          data-testid="stuk-vink"
          title={status === 'klaar' ? 'Vinkje weghalen' : 'Heeft u dit stuk? Vink het zelf af'}
          onClick={onVink}
          style={css(`${vakStijl} cursor: pointer;`)}
        >
          {teken}
        </button>
      ) : (
        <span aria-hidden="true" style={css(vakStijl)}>
          {teken}
        </span>
      )}
      <div style={css('flex: 1; min-width: 0;')}>
        <div style={css(`${TEKST} font-size: 14.5px; color: ${status === 'optioneel' ? '#4B5C58' : kleur}; ${status === 'klaar' || status === 'optioneel' ? '' : 'font-weight: 800;'}`)}>{stuk.tekst}</div>
        <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>
          {status === 'klaar' && zelf
            ? 'Door u afgevinkt'
            : status === 'klaar' && doc
              ? `In Documenten: ${doc.naam}`
              : status === 'te-oud' && doc
                ? `${doc.naam} is ouder dan ${stuk.maxMaanden} maanden; voeg de nieuwste toe of vink af als dit de nieuwste is`
                : voor}
        </div>
      </div>
      {status !== 'klaar' &&
        status !== 'optioneel' &&
        (onToevoegen ? (
          <button type="button" data-testid="stuk-toevoegen" onClick={onToevoegen} style={css(`${TEKST} cursor: pointer; padding: 0; border: none; background: none; font-size: 13.5px; font-weight: 800; color: #4E9A6C; white-space: nowrap;`)}>
            Toevoegen
          </button>
        ) : (
          <a href="#/kompas/documentatie?tab=bestanden" data-testid="stuk-toevoegen" style={css(`${TEKST} font-size: 13.5px; font-weight: 800; color: #4E9A6C; text-decoration: none; white-space: nowrap;`)}>
            Toevoegen
          </a>
        ))}
    </li>
  );
}

const telKlaar = (regels) => regels.filter((r) => !r.stuk.optioneel && r.uitkomst.status === 'klaar').length;
const telNodig = (regels) => regels.filter((r) => !r.stuk.optioneel).length;

// De organisatiestukken in twee groepjes: basis en aanvullend.
function OrganisatieGroepen({ regels, voor, onToevoegen, onVink, kop = 'Organisatie' }) {
  const regel = (r, v) => <Regel key={r.stuk.id} stuk={r.stuk} uitkomst={r.uitkomst} voor={v} onToevoegen={onToevoegen} onVink={onVink ? () => onVink(null, r.stuk.id) : null} />;

  return (
    <>
      <div style={css(KOPJE)}>{kop} · basis</div>
      <ul style={css('list-style: none; margin: 0; padding: 0;')}>{regels.filter((r) => r.stuk.basis).map((r) => regel(r, voor))}</ul>
      <div style={css(KOPJE)}>{kop} · aanvullend</div>
      <ul style={css('list-style: none; margin: 0; padding: 0;')}>{regels.filter((r) => !r.stuk.basis).map((r) => regel(r, 'Vragen veel fondsen erbij'))}</ul>
    </>
  );
}

const organisatieRegels = (docs, afgevinkt, nu) => ORGANISATIE_STUKKEN.map((s) => ({ stuk: s, uitkomst: stukUitkomst(s, docs, afgevinkt.isAf(null, s.id), nu) }));

// Op de pagina Organisatie: alleen de organisatiestukken, met de documenten die daar al geladen zijn.
export function OrganisatieStukken({ documenten, onToevoegen, nu = new Date() }) {
  const afgevinkt = useAfgevinkt();
  const docs = documentenLijst([], documenten || []);
  const regels = organisatieRegels(docs, afgevinkt, nu);

  return (
    <section data-testid="org-stukken" style={css('display: flex; flex-direction: column; gap: 8px;')}>
      <div style={css('display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;')}>
        <span style={css("font-family: 'Newsreader', serif; font-size: clamp(21px, 2.6vw, 25px); font-weight: 600; color: #2C4A5E;")}>Stukken voor fondsenwerving</span>
        <span data-testid="org-stukken-teller" style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>
          {telKlaar(regels)} van {telNodig(regels)} klaar
        </span>
      </div>
      <div style={css(`${TEKST} font-size: 13.5px; color: #687974;`)}>
        Deze stukken vragen fondsen bij bijna elke aanvraag. Upload ze één keer bij Relevante documenten hieronder, of vink ze zelf af als u ze al heeft. Ze vinken dan ook af in uw actieplan.
      </div>
      <div style={css('border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; overflow: hidden;')}>
        <OrganisatieGroepen regels={regels} voor="Vraagt vrijwel elk fonds" onToevoegen={onToevoegen} onVink={afgevinkt.wissel} kop="Stukken" />
      </div>
    </section>
  );
}

const lijstNamen = (namen) => (namen.length <= 1 ? namen.join('') : `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`);

// Per project: welke aanvragen zijn klein (basisset volstaat meestal) en welke groot (volledige lijst bij Indienen)?
function KleinGroot({ project, regels, details }) {
  const zichtbaar = (regels || []).filter((r) => r.bronStatus === 'zichtbaar' && r.naam && r.status !== 'rejected');
  const klein = zichtbaar.filter((r) => grootteVan(r, detailVan(details, r)) === 'klein').map((r) => r.naam);
  const groot = zichtbaar.filter((r) => grootteVan(r, detailVan(details, r)) === 'groot').map((r) => r.naam);

  if (!klein.length && !groot.length) return null;

  return (
    <div data-testid="stukken-klein-groot" style={css(`${TEKST} font-size: 13px; padding: 10px 14px; border-bottom: 1px solid #EEF2EF; background: #FBFCFB; display: flex; flex-direction: column; gap: 6px;`)}>
      {klein.length > 0 && (
        <div data-testid="stukken-klein">
          <b style={css('color: #2C4A5E;')}>Kleine fondsen</b>: {lijstNamen(klein)}. Meestal volstaan ANBI, statuten, KvK, projectplan, begroting en een aanbevelingsbrief.
        </div>
      )}
      {groot.length > 0 && (
        <div data-testid="stukken-groot">
          <b style={css('color: #2C4A5E;')}>Subsidieregelingen en grote fondsen</b>: {lijstNamen(groot)}. Deze vragen de volledige lijst uit hun aanvraagformulier;{' '}
          <a href={`#/kompas/documentatie?project=${encodeURIComponent(project.id)}&tab=aanvragen`} style={css('color: #4E9A6C; font-weight: 800; text-decoration: none;')}>
            bekijk die bij Indienen
          </a>
          .
        </div>
      )}
    </div>
  );
}

// projecten: de actieve projecten (met docs, discipline en partners). regelsPerProject: het dekkingsplan per project.
export function StukkenVoorFondsenwerving({ projecten, regelsPerProject = {}, aantalFondsen = 0, nu = new Date() }) {
  const [orgDocs, setOrgDocs] = useState([]);
  const [details, setDetails] = useState({ perRegeling: {}, perFonds: {} });
  const afgevinkt = useAfgevinkt();
  const alleRegels = useMemo(() => Object.values(regelsPerProject || {}).flat().filter((r) => r && r.bronStatus === 'zichtbaar'), [regelsPerProject]);
  const detailSleutel = alleRegels.map((r) => r.schemeId || r.funderId || '').sort().join(',');

  useEffect(() => {
    let weg = false;
    const schemeIds = alleRegels.filter((r) => r.bronType === 'regeling').map((r) => r.schemeId);
    const funderIds = alleRegels.filter((r) => r.bronType === 'fonds').map((r) => r.funderId);

    if (!schemeIds.length && !funderIds.length) return undefined;

    haalOmvang({ schemeIds, funderIds })
      .then((res) => {
        if (!weg && res) setDetails({ perRegeling: res.perRegeling || {}, perFonds: res.perFonds || {} });
      })
      .catch(() => undefined);

    return () => {
      weg = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSleutel]);

  useEffect(() => {
    let weg = false;

    Promise.resolve()
      .then(() => haalOrganisatieDocumentenOp())
      .then((l) => {
        if (!weg && Array.isArray(l)) setOrgDocs(l);
      })
      .catch(() => undefined);

    return () => {
      weg = true;
    };
  }, []);

  const alleDocs = useMemo(() => documentenLijst((projecten || []).flatMap((p) => p.docs || []), orgDocs), [projecten, orgDocs]);
  const organisatie = organisatieRegels(alleDocs, afgevinkt, nu);
  const perProject = (projecten || []).map((p) => {
    const docs = documentenLijst(p.docs, []);
    const dekking = regelsPerProject[p.id] || [];
    const cultuur = CULTUUR.test([].concat(p.discipline || []).join(' '));
    const partners = String(p.partners || '').trim() !== '';
    const heeftKlein = dekking.some((r) => grootteVan(r, detailVan(details, r)) === 'klein');
    const aanbeveling = heeftKlein ? { ...AANBEVELING, wanneer: 'Vragen kleine fondsen vaak' } : { ...AANBEVELING, wanneer: 'Als het fonds erom vraagt', optioneel: true };
    const stukken = [...PROJECT_STUKKEN, ...(cultuur ? CULTUUR_STUKKEN : []), ...(partners ? [PARTNER_STUK] : []), aanbeveling, OFFERTES];

    return { project: p, dekking, regels: stukken.map((s) => ({ stuk: s, uitkomst: stukUitkomst(s, docs, afgevinkt.isAf(p.id, s.id), nu) })) };
  });
  const alle = [...organisatie, ...perProject.flatMap((x) => x.regels)];
  const voorAlle = aantalFondsen > 1 ? `Nodig voor alle ${aantalFondsen} fondsen in uw plannen` : 'Vraagt vrijwel elk fonds';
  const [open, setOpen] = useState(true);

  return (
    <section data-testid="stukken-fondsenwerving" style={css('display: flex; flex-direction: column; gap: 8px;')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={css('display: flex; align-items: baseline; gap: 10px; padding: 0; border: none; background: none; cursor: pointer; text-align: left;')}
      >
        <span style={css(LABEL)}>Stukken voor fondsenwerving</span>
        <span data-testid="stukken-teller" style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>
          {telKlaar(alle)} van {telNodig(alle)} klaar
        </span>
        <span aria-hidden="true" style={css('color: #7B8985;')}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <div style={css(`${TEKST} font-size: 13px; color: #687974;`)}>
            Eén keer verzamelen, voor al uw aanvragen. Staat een stuk in Documenten, dan vinkt het vanzelf af; heeft u het al, vink het dan zelf af.
          </div>
          <div style={css('border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; overflow: hidden;')}>
            <OrganisatieGroepen regels={organisatie} voor={voorAlle} onVink={afgevinkt.wissel} />
            {perProject.map(({ project, dekking, regels }) => (
              <div key={project.id}>
                <div style={css(KOPJE)}>Project: {project.naam || 'Naamloos project'}</div>
                <KleinGroot project={project} regels={dekking} details={details} />
                <ul style={css('list-style: none; margin: 0; padding: 0;')}>
                  {regels.map((r) => (
                    <Regel
                      key={r.stuk.id}
                      stuk={r.stuk}
                      uitkomst={r.uitkomst}
                      voor={r.stuk.wanneer || (r.stuk.cultuur ? 'Belangrijk bij kunst- en cultuuraanvragen' : 'Voor de aanvragen van dit project')}
                      onVink={() => afgevinkt.wissel(project.id, r.stuk.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
