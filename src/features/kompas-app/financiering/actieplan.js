// Actieplan per project: de OPGESLAGEN taken (tabel subsidie_kompas_program_actions) en de logica eromheen.
// Pure functies (geen React, geen netwerk, geen opslag). Naast deze taken bestaan de AFGELEIDE acties (acties.js):
// die worden berekend uit de stand van het dekkingsplan en niet opgeslagen. De twee worden naast elkaar getoond;
// een afgeleide actie kan met één klik een opgeslagen taak worden (afgeleidNaarTaak).
// Bedragen staan hier nooit: het dekkingsplan (subsidie_kompas_program_funding) blijft de enige bron voor geld.
import { dagenTot, dagenTekst, formatDatum } from './dekkingsplan.js';
import { DREMPEL_MAAND, DREMPEL_WEEK } from './acties.js';

export const ACTIE_STATUSSEN = ['todo', 'doing', 'done'];
export const ACTIE_STATUS_LABEL = { todo: 'Te doen', doing: 'Bezig', done: 'Klaar' };
export const ACTIE_PRIORITEITEN = ['high', 'normal', 'low'];
export const ACTIE_PRIORITEIT_LABEL = { high: 'Hoog', normal: 'Normaal', low: 'Laag' };
export const MAX_TITEL = 200;
export const MAX_FINANCIER = 200;
export const MAX_NOTITIE = 4000;

export const ACTIE_GROEPEN = ['te-laat', 'week', 'maand', 'later', 'zonder', 'klaar'];
export const ACTIE_GROEP_LABEL = {
  'te-laat': 'Te laat',
  week: 'Deze week',
  maand: 'Deze maand',
  later: 'Later',
  zonder: 'Zonder deadline',
  klaar: 'Afgerond',
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const tekst = (v) => (v == null ? '' : String(v));

export function isEchteDatum(iso) {
  if (!ISO.test(tekst(iso))) {
    return false;
  }

  const [j, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(j, m - 1, d));

  return x.getUTCFullYear() === j && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
}

// Rij uit de database -> object voor de interface.
export function actieUitRij(r) {
  return {
    id: r.id,
    projectId: r.program_id,
    fundingId: r.funding_id || null,
    titel: tekst(r.title),
    financier: tekst(r.financier_label),
    deadline: r.due_date ? tekst(r.due_date).slice(0, 10) : '',
    status: ACTIE_STATUSSEN.indexOf(r.status) !== -1 ? r.status : 'todo',
    prioriteit: ACTIE_PRIORITEITEN.indexOf(r.priority) !== -1 ? r.priority : 'normal',
    notitie: tekst(r.notes),
    bron: r.source === 'chat' ? 'chat' : 'user',
    voorgesteldOp: r.proposed_at || null,
    gemaakt: r.created_at || '',
  };
}

// Invoer uit het formulier -> geldige waarde of een nette fout. Alles wat niet klopt wordt geweigerd, niets wordt geraden.
export function valideerActie({ titel, financier, deadline, prioriteit, notitie }) {
  const t = tekst(titel).trim();

  if (!t) {
    return { ok: false, fout: 'Vul in wat er moet gebeuren.' };
  }

  if (t.length > MAX_TITEL) {
    return { ok: false, fout: `De actie mag maximaal ${MAX_TITEL} tekens zijn.` };
  }

  const f = tekst(financier).trim();

  if (f.length > MAX_FINANCIER) {
    return { ok: false, fout: `De naam van de financier mag maximaal ${MAX_FINANCIER} tekens zijn.` };
  }

  const d = tekst(deadline).trim();

  if (d && !isEchteDatum(d)) {
    return { ok: false, fout: 'Kies een geldige deadline.' };
  }

  const p = ACTIE_PRIORITEITEN.indexOf(prioriteit) !== -1 ? prioriteit : 'normal';
  const n = tekst(notitie).trim();

  if (n.length > MAX_NOTITIE) {
    return { ok: false, fout: `De notitie mag maximaal ${MAX_NOTITIE} tekens zijn.` };
  }

  return { ok: true, waarde: { titel: t, financier: f, deadline: d, prioriteit: p, notitie: n } };
}

// Wijziging { titel, financier, deadline, status, prioriteit, notitie } (alleen wat verandert) -> patch voor de database.
export function patchVoorActie(w) {
  const patch = {};
  const heeft = (k) => Object.prototype.hasOwnProperty.call(w || {}, k);

  if (heeft('titel')) patch.title = tekst(w.titel).trim();
  if (heeft('financier')) patch.financier_label = tekst(w.financier).trim() || null;
  if (heeft('deadline')) patch.due_date = isEchteDatum(w.deadline) ? w.deadline : null;
  if (heeft('status') && ACTIE_STATUSSEN.indexOf(w.status) !== -1) patch.status = w.status;
  if (heeft('prioriteit') && ACTIE_PRIORITEITEN.indexOf(w.prioriteit) !== -1) patch.priority = w.prioriteit;
  if (heeft('notitie')) patch.notes = tekst(w.notitie).trim() || null;

  return patch;
}

export function pasActieWijzigingToe(actie, w) {
  const uit = { ...actie };
  const heeft = (k) => Object.prototype.hasOwnProperty.call(w || {}, k);

  if (heeft('titel')) uit.titel = tekst(w.titel).trim();
  if (heeft('financier')) uit.financier = tekst(w.financier).trim();
  if (heeft('deadline')) uit.deadline = isEchteDatum(w.deadline) ? w.deadline : '';
  if (heeft('status') && ACTIE_STATUSSEN.indexOf(w.status) !== -1) uit.status = w.status;
  if (heeft('prioriteit') && ACTIE_PRIORITEITEN.indexOf(w.prioriteit) !== -1) uit.prioriteit = w.prioriteit;
  if (heeft('notitie')) uit.notitie = tekst(w.notitie).trim();

  return uit;
}

// In welke groep valt een opgeslagen taak? Afgerond gaat altijd naar "Afgerond"; zonder deadline naar "Zonder deadline".
export function actieGroep(actie, nu) {
  if (actie.status === 'done') return 'klaar';

  const dagen = actie.deadline ? dagenTot(actie.deadline, nu) : null;

  if (dagen == null) return 'zonder';
  if (dagen < 0) return 'te-laat';
  if (dagen <= DREMPEL_WEEK) return 'week';
  if (dagen <= DREMPEL_MAAND) return 'maand';

  return 'later';
}

const PRIO_RANG = { high: 0, normal: 1, low: 2 };

// Eerst de deadline (eerst), dan prioriteit, dan titel.
export function sorteerTaken(taken) {
  return (taken || []).slice().sort(
    (a, b) =>
      String(a.deadline || '9999-12-31').localeCompare(String(b.deadline || '9999-12-31')) ||
      PRIO_RANG[a.prioriteit] - PRIO_RANG[b.prioriteit] ||
      a.titel.localeCompare(b.titel, 'nl') ||
      String(a.gemaakt).localeCompare(String(b.gemaakt)),
  );
}

// { 'te-laat': [], week: [], ..., klaar: [] }
export function groepeerTaken(taken, nu) {
  const groepen = {};

  ACTIE_GROEPEN.forEach((g) => {
    groepen[g] = [];
  });
  sorteerTaken(taken).forEach((t) => groepen[actieGroep(t, nu)].push(t));

  return groepen;
}

// Weergave van de deadline van een taak: "25 okt 2026 (over 3 dagen)".
export function deadlineTekst(actie, nu) {
  if (!actie.deadline) return '';

  const dagen = dagenTot(actie.deadline, nu);
  const rest = actie.status === 'done' || dagen == null ? '' : ` (${dagenTekst(dagen)})`;

  return `${formatDatum(actie.deadline)}${rest}`;
}

// Een afgeleide actie (acties.js) -> invoer voor een opgeslagen taak. Alleen de actie zelf, de financier en de datum.
export function afgeleidNaarTaak(afgeleid) {
  return {
    projectId: afgeleid.projectId,
    fundingId: afgeleid.regelId || null,
    titel: afgeleid.tekst,
    financier: afgeleid.regelNaam || '',
    deadline: afgeleid.datum || '',
    prioriteit: afgeleid.prioriteit === 'hoog' ? 'high' : 'normal',
    notitie: afgeleid.reden ? `Aanleiding: ${afgeleid.reden}.` : '',
  };
}

// Verberg afgeleide acties waarvoor al een openstaande opgeslagen taak bestaat (zelfde regel en zelfde titel).
export function verbergAlOpgeslagen(afgeleid, opgeslagen) {
  const open = (opgeslagen || []).filter((t) => t.status !== 'done');

  return (afgeleid || []).filter((a) => !open.some((t) => t.titel === a.tekst && (t.fundingId || null) === (a.regelId || null)));
}

export const telOpenTaken = (taken) => (taken || []).filter((t) => t.status !== 'done').length;
