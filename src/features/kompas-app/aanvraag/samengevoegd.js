// Eén samengevoegd document: het projectplan met daarachter, als bijlagen, de begroting en het dekkingsplan.
// Zuivere functies: geen netwerk, geen opslag. De vaste kopie (momentopname) wordt bewaard als definitief document van het soort 'samengevoegd';
// de begroting en het dekkingsplan blijven daarnaast ook los bestaan, net als de aanbevelingsbrief en de andere stukken.
import { bouwDocumentModel } from '../../../shared/export/exportModel.js';
import { berekenBegroting, leesBudgetRegels } from '../begroting/begrotingModel.js';
import { STATUS_LABEL, dekkingVanProject, teFinancieren } from '../financiering/dekkingsplan.js';
import { planNaarTekst } from './aanvraagModel.js';

export const SAMENGEVOEGD_NAAM = 'Projectplan met begroting en dekkingsplan';

const getal = (v) => {
  const cijfers = String(v == null ? '' : v).replace(/[^0-9]/g, '');

  return cijfers ? Number(cijfers) : null;
};
const euro = (n) => (n == null || !Number.isFinite(Number(n)) ? '' : `€ ${Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
const tekst = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

// Wat er vast wordt bewaard. Het project gaat mee zonder zijn documenten (te groot, en niet nodig).
export function samengevoegdMomentopname({ plan, project, finRegels, projectNaam }) {
  const { docs, ...rest } = project || {};

  return { type: 'samengevoegd', plan: plan || null, projectNaam: projectNaam || (project && project.naam) || '', project: rest, finRegels: Array.isArray(finRegels) ? finRegels : [] };
}

// Bijlage 1: de begroting per kopje, met subtotalen en het totaal.
export function begrotingBlokken(project) {
  const regels = leesBudgetRegels(project && project.budgetRegels);
  const b = berekenBegroting(regels);
  const blokken = [{ type: 'heading', level: 1, text: 'Bijlage 1: Begroting' }];

  if (!b.perCategorie.length) {
    return [...blokken, { type: 'paragraph', text: 'Er zijn nog geen begrotingsregels ingevuld.' }];
  }

  b.perCategorie.forEach((c) => {
    blokken.push({ type: 'heading', level: 2, text: c.label });
    blokken.push({
      type: 'table',
      headers: ['Omschrijving', 'Aantal', 'Eenheid', 'Tarief', 'Bedrag'],
      rows: [
        ...c.rijen.map(({ regel, bedrag }) => [
          `${tekst(regel.omschrijving) || 'Regel'}${regel.schatting === true ? ' (schatting)' : ''}`,
          tekst(regel.aantal),
          tekst(regel.eenheid),
          regel.tarief !== '' && regel.tarief != null ? euro(Number(String(regel.tarief).replace(',', '.'))) : '',
          bedrag == null ? 'nog in te vullen' : euro(bedrag),
        ]),
        ['Subtotaal', '', '', '', euro(c.subtotaal)],
      ],
    });
  });

  const eigen = getal(project && project.eigenBijdrage);
  const totaalRijen = [['Totale kosten', euro(b.totaalGeld)]];

  if (eigen != null) {
    totaalRijen.push(['Eigen bijdrage', euro(eigen)]);
    totaalRijen.push(['Te financieren', euro(teFinancieren(Math.round(b.totaalGeld), eigen))]);
  }

  blokken.push({ type: 'heading', level: 2, text: 'Totaal' });
  blokken.push({ type: 'table', headers: ['Onderdeel', 'Bedrag'], rows: totaalRijen });

  if (b.aantalSchattingen > 0) {
    blokken.push({ type: 'paragraph', text: `Let op: ${b.aantalSchattingen === 1 ? 'een bedrag is' : `${b.aantalSchattingen} bedragen zijn`} nog een schatting (samen ${euro(b.totaalSchatting)}).` });
  }

  return blokken;
}

// Bijlage 2: het dekkingsplan: hoe de begroting wordt gedekt, met per fonds of financier wat is aangevraagd en toegekend.
export function dekkingsplanBlokken(project, finRegels) {
  const p = project || {};
  const regels = Array.isArray(finRegels) ? finRegels.filter(Boolean) : [];
  const totaal = berekenBegroting(leesBudgetRegels(p.budgetRegels)).totaalGeld;
  const metTotaal = { ...p, begroting: totaal > 0 ? Math.round(totaal) : p.begroting };
  const dekking = dekkingVanProject(metTotaal, regels);
  const begroting = getal(metTotaal.begroting);
  const eigen = getal(p.eigenBijdrage);
  const blokken = [{ type: 'heading', level: 1, text: 'Bijlage 2: Dekkingsplan' }];
  const overzicht = [
    ['Totale projectbegroting', begroting],
    ['Eigen bijdrage', eigen],
    ['Te financieren bedrag', begroting != null ? teFinancieren(begroting, eigen) : null],
    ['Toegekend', dekking ? dekking.toegekend : null],
    ['Aangevraagd', dekking ? dekking.aangevraagd : null],
    [dekking && dekking.volledigGedekt ? 'Nog te financieren (volledig gedekt)' : 'Nog te financieren', dekking ? dekking.nogNodig : null],
  ].filter(([, w]) => w != null && !(w === 0 && !(dekking && dekking.heeftBegroting)));

  if (!overzicht.length && !regels.length) {
    return [...blokken, { type: 'paragraph', text: 'Er zijn nog geen fondsen of andere financiering opgenomen.' }];
  }

  if (overzicht.length) blokken.push({ type: 'table', headers: ['Onderdeel', 'Bedrag'], rows: overzicht.map(([k, w]) => [k, euro(w)]) });

  if (regels.length) {
    blokken.push({ type: 'heading', level: 2, text: 'Fondsen en andere financiering' });
    blokken.push({
      type: 'table',
      headers: ['Fonds of financier', 'Status', 'Aangevraagd', 'Toegekend'],
      rows: regels.map((r) => [tekst(r.naam) || 'Fonds', STATUS_LABEL[r.status] || '', euro(r.requested), euro(r.awarded)]),
    });
  }

  return blokken;
}

// Het exportmodel (Word en PDF): het plan, een nieuwe pagina voor elke bijlage. inhoud = de momentopname.
export function bouwSamengevoegdModel({ inhoud, organisatieNaam = null }) {
  const i = inhoud || {};
  const naam = tekst(i.projectNaam) || 'dit project';
  const titel = `${SAMENGEVOEGD_NAAM} ${i.projectNaam || ''}`.trim();
  const planBlokken = i.plan ? bouwDocumentModel({ tekst: planNaarTekst(i.plan, `Projectplan ${naam}`), soort: 'Projectplan', organisatieNaam, projectNaam: i.projectNaam, titel }).blocks : [];
  const blocks = [
    ...planBlokken,
    { type: 'pagebreak' },
    ...begrotingBlokken(i.project),
    { type: 'pagebreak' },
    ...dekkingsplanBlokken(i.project, i.finRegels),
  ];

  return {
    kind: 'samengevoegd',
    titel,
    documentType: 'Projectplan met bijlagen',
    organisatieNaam: organisatieNaam || null,
    projectNaam: i.projectNaam || null,
    bestandsDelen: [i.projectNaam || 'project', 'Projectplan met begroting en dekkingsplan'],
    blocks,
    sheets: [],
    budgetBron: null,
  };
}
