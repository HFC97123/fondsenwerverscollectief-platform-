// Stukken voor fondsenwerving: wat vrijwel elk fonds vraagt, ÉÉN keer in het actieplan (niet bij elk fonds opnieuw).
// Organisatiestukken gelden voor alle projecten; projectstukken per project (cultuurprojecten krijgen er een paar bij).
// Of een stuk er is, leest dit blok uit de documenten (organisatie en project), op de naam of de soort van het bestand.
// Alleen lezen: er wordt niets opgeslagen.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { haalOrganisatieDocumentenOp } from '../../../data/services/organisatiedocumenten.js';
import { documentenLijst } from '../aanvraag/aanvraagModel.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #2C4A5E;";

// Organisatie: één keer voor alle fondsen.
export const ORGANISATIE_STUKKEN = [
  { id: 'jaarrekening', tekst: 'Jaarrekening van het afgelopen jaar', woorden: ['jaarrekening', 'jaarcijfers'], maxMaanden: 12 },
  { id: 'jaarverslag', tekst: 'Jaarverslag van het afgelopen jaar', woorden: ['jaarverslag', 'bestuursverslag'], maxMaanden: 12 },
  { id: 'anbi', tekst: 'ANBI-beschikking', woorden: ['anbi'] },
  { id: 'statuten', tekst: 'Statuten', woorden: ['statuten'] },
  { id: 'kvk', tekst: 'Uittreksel KvK (niet ouder dan 3 maanden)', woorden: ['kvk', 'kamer van koophandel', 'uittreksel'], maxMaanden: 3 },
  { id: 'bestuur', tekst: 'Bestuurssamenstelling', woorden: ['bestuur'] },
  { id: 'iban', tekst: 'Bankafschrift of IBAN op naam van de organisatie', woorden: ['bankafschrift', 'iban', 'bankgegevens'] },
];

// Per project.
const PROJECT_STUKKEN = [
  { id: 'projectplan', tekst: 'Projectplan (met monitoring, evaluatie en effectmeting)', woorden: ['projectplan'] },
  { id: 'begroting', tekst: 'Begroting en dekkingsplan', woorden: ['begroting', 'dekkingsplan'] },
];

// Alleen als het van toepassing is: telt niet mee in 'x van y klaar'.
const PARTNER_STUK = { id: 'intentie', tekst: 'Intentieverklaringen van partners', woorden: ['intentieverklaring', 'samenwerkingsverklaring', 'intentie'], wanneer: 'U werkt samen met partners' };
const OPTIONELE_STUKKEN = [
  { id: 'offertes', tekst: 'Offertes', woorden: ['offerte'], wanneer: 'Optioneel: check de aanvraagvoorwaarden en criteria van het fonds', optioneel: true },
  { id: 'aanbevelingen', tekst: 'Aanbevelingen', woorden: ['aanbeveling', 'steunbrief'], wanneer: 'Alleen als het fonds erom vraagt', optioneel: true },
];

// Extra bij kunst- en cultuurprojecten.
const CULTUUR_STUKKEN = [
  { cultuur: true, id: 'communicatieplan', tekst: 'Communicatieplan', woorden: ['communicatieplan', 'communicatie'] },
  { cultuur: true, id: 'publieksbereik', tekst: 'Publieksbereik- of marketingplan', woorden: ['publieksbereik', 'marketing'] },
  { cultuur: true, id: 'cv', tekst: "Cv's of biografie van de makers", woorden: ['cv', 'biografie'] },
  { cultuur: true, id: 'beeld', tekst: "Beeldmateriaal (foto's, schetsen, eerder werk)", woorden: ['beeld', 'foto', 'schets', 'portfolio'] },
];

const CULTUUR = /kunst|cultuur|muziek|theater|dans|film|literatuur|erfgoed|podium|beeldend|festival|design|fotografie/i;

function maandenGeleden(iso, nu) {
  const d = iso ? new Date(iso) : null;

  if (!d || Number.isNaN(d.getTime())) return null;

  return (nu.getFullYear() - d.getFullYear()) * 12 + (nu.getMonth() - d.getMonth());
}

export function zoekStuk(stuk, docs, nu = new Date()) {
  const doc = (docs || []).find((d) => stuk.woorden.some((w) => `${d.naam} ${d.soort}`.toLowerCase().includes(w)));

  if (!doc) return { status: 'nodig', doc: null };

  const oud = stuk.maxMaanden ? maandenGeleden(doc.datum, nu) : null;

  return { status: oud !== null && oud > stuk.maxMaanden ? 'te-oud' : 'klaar', doc };
}

function Regel({ stuk, uitkomst, voor }) {
  const { doc } = uitkomst;
  const status = stuk.optioneel && uitkomst.status === 'nodig' ? 'optioneel' : uitkomst.status;
  const kleur = status === 'klaar' ? '#2F6D47' : status === 'te-oud' ? '#8A5A16' : '#2C4A5E';
  const teken = status === 'klaar' ? '✓' : status === 'te-oud' ? '!' : '';

  return (
    <li data-testid="stuk" data-stuk={stuk.id} data-status={status} style={css('display: flex; gap: 12px; align-items: center; padding: 9px 14px; border-bottom: 1px solid #EEF2EF;')}>
      <span
        aria-hidden="true"
        style={css(`box-sizing: border-box; flex: none; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 5px; font-size: 12px; font-weight: 800; ${
          status === 'klaar' ? 'background: #4E9A6C; color: #FFFFFF;' : status === 'te-oud' ? 'background: #FBF1E3; color: #8A5A16; border: 1px solid #EEDCC0;' : status === 'optioneel' ? 'border: 1.5px dashed #CFD9D4;' : 'border: 1.5px solid #B9C7C0;'
        }`)}
      >
        {teken}
      </span>
      <div style={css('flex: 1; min-width: 0;')}>
        <div style={css(`${TEKST} font-size: 14.5px; color: ${status === 'optioneel' ? '#4B5C58' : kleur}; ${status === 'klaar' || status === 'optioneel' ? '' : 'font-weight: 800;'}`)}>{stuk.tekst}</div>
        <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>
          {status === 'klaar' && doc ? `In Documenten: ${doc.naam}` : status === 'te-oud' && doc ? `${doc.naam} is ouder dan ${stuk.maxMaanden} maanden; voeg de nieuwste toe` : voor}
        </div>
      </div>
      {status !== 'klaar' && status !== 'optioneel' && (
        <a href="#/kompas/documentatie?tab=bestanden" data-testid="stuk-toevoegen" style={css(`${TEKST} font-size: 13.5px; font-weight: 800; color: #4E9A6C; text-decoration: none; white-space: nowrap;`)}>
          Toevoegen
        </a>
      )}
    </li>
  );
}

// projecten: de actieve projecten (met docs en discipline). aantalFondsen: hoeveel fondsen er in de plannen staan.
export function StukkenVoorFondsenwerving({ projecten, aantalFondsen = 0, nu = new Date() }) {
  const [orgDocs, setOrgDocs] = useState([]);

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
  const organisatie = ORGANISATIE_STUKKEN.map((s) => ({ stuk: s, uitkomst: zoekStuk(s, alleDocs, nu) }));
  const perProject = (projecten || []).map((p) => {
    const docs = documentenLijst(p.docs, []);
    const cultuur = CULTUUR.test([].concat(p.discipline || []).join(' '));
    const partners = String(p.partners || '').trim() !== '';
    const stukken = [...PROJECT_STUKKEN, ...(cultuur ? CULTUUR_STUKKEN : []), ...(partners ? [PARTNER_STUK] : []), ...OPTIONELE_STUKKEN];

    return { project: p, regels: stukken.map((s) => ({ stuk: s, uitkomst: zoekStuk(s, docs, nu) })) };
  });
  const alle = [...organisatie, ...perProject.flatMap((x) => x.regels)].filter((r) => !r.stuk.optioneel);
  const klaar = alle.filter((r) => r.uitkomst.status === 'klaar').length;
  const voorAlle = aantalFondsen > 1 ? `Nodig voor alle ${aantalFondsen} fondsen in uw plannen` : 'Vraagt vrijwel elk fonds';
  const [open, setOpen] = useState(klaar < alle.length);

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
          {klaar} van {alle.length} klaar
        </span>
        <span aria-hidden="true" style={css('color: #7B8985;')}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <div style={css(`${TEKST} font-size: 13px; color: #687974;`)}>
            Eén keer verzamelen, voor al uw aanvragen. Zet een stuk in Documenten en het vinkt hier vanzelf af.
          </div>
          <div style={css('border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; overflow: hidden;')}>
            <div style={css(`${TEKST} font-size: 12px; font-weight: 800; padding: 8px 14px; background: #F6F8F7; color: #4B5C58;`)}>Organisatie</div>
            <ul style={css('list-style: none; margin: 0; padding: 0;')}>
              {organisatie.map((r) => (
                <Regel key={r.stuk.id} stuk={r.stuk} uitkomst={r.uitkomst} voor={voorAlle} />
              ))}
            </ul>
            {perProject.map(({ project, regels }) => (
              <div key={project.id}>
                <div style={css(`${TEKST} font-size: 12px; font-weight: 800; padding: 8px 14px; background: #F6F8F7; color: #4B5C58;`)}>Project: {project.naam || 'Naamloos project'}</div>
                <ul style={css('list-style: none; margin: 0; padding: 0;')}>
                  {regels.map((r) => (
                    <Regel key={r.stuk.id} stuk={r.stuk} uitkomst={r.uitkomst} voor={r.stuk.wanneer || (r.stuk.cultuur ? 'Belangrijk bij kunst- en cultuuraanvragen' : 'Voor de aanvragen van dit project')} />
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
