// FASE5 — Kansrijke financiers uit de chat -> Projectfinanciering. Pure hulpfuncties (geen React, geen opslag).
//
// De matching zelf gebeurt uitsluitend server-side in de bestaande engine; de server stuurt per beurt alleen een
// compacte lijst terug (type, id, naam, gever, live deadline, korte redenen, "staat al"). Deze module:
//   - valideert die lijst (nooit blind vertrouwen op vorm en id's);
//   - voegt items toe via de GEDEELDE fundingservice (voegToeAanProjectfinanciering): één insert-pad, geen
//     bedrag gokken, startstatus 'interesting', dubbele regels door de database geweigerd -> "staat al";
//   - houdt GEEN eigen opslag bij: de lijst leeft alleen in het gesprek op het scherm (geen AI-shortlisttabel,
//     geen localStorage). De waarheid over wat er in de projectfinanciering staat blijft de database.
import { isEchtId } from '../../../data/services/projecten.js';
import { haalDekkingsplan } from '../../../data/services/projectFinanciering.js';
import { vraagVoorstelOpslaan } from '../../../data/services/voorstelGenereren.js';
import { regelUitRpc } from '../financiering/dekkingsplan.js';
import { voegOnlineToeAanProjectfinanciering, voegToeAanProjectfinanciering } from '../financiering/toevoegen.js';

export const MAX_ITEMS = 12;

export const ITEM_STATUS = {
  KLAAR: 'klaar',
  BEZIG: 'bezig',
  TOEGEVOEGD: 'toegevoegd',
  STAAT_AL: 'staat-al',
  MISLUKT: 'mislukt',
  NIET: 'niet', // het lid koos "Niet": uit beeld, niets opgeslagen
};

export const itemSleutel = (item) => `${item.type}:${item.id}`;

const tekst = (v, max) => String(v == null ? '' : v).slice(0, max);

// Zet de ruwe serverlijst om in een veilige vorm, of null als er niets bruikbaars in zit.
export function leesFondsMatches(raw) {
  if (!raw || typeof raw !== 'object' || !isEchtId(String(raw.projectId || '')) || !Array.isArray(raw.items)) {
    return null;
  }

  const intentie = ['scan', 'scan_en_toevoegen', 'toevoegen', 'advies'].includes(raw.intentie) ? raw.intentie : 'advies';
  const gezien = new Set();
  const items = [];

  raw.items.forEach((i) => {
    const online = i && i.type === 'online' && /^online-\d{1,2}$/.test(String(i.id || ''));

    if (!i || (!online && ((i.type !== 'regeling' && i.type !== 'fonds') || !isEchtId(String(i.id || '')))) || items.length >= MAX_ITEMS) {
      return;
    }

    const naam = tekst(i.naam, 200).trim();
    const sleutel = `${i.type}:${i.id}`;

    if (!naam || gezien.has(sleutel)) {
      return;
    }

    gezien.add(sleutel);
    items.push({
      type: i.type,
      id: String(i.id),
      naam,
      funder: tekst(i.funder, 200),
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(i.deadline || '')) ? String(i.deadline) : null,
      waarom: (Array.isArray(i.waarom) ? i.waarom : []).map((w) => tekst(w, 160)).filter(Boolean).slice(0, 2),
      staatAl: i.staatAl === true,
      ...(online ? { url: /^https:\/\/[^\s]+$/i.test(String(i.url || '')) ? String(i.url).slice(0, 500) : null } : {}),
    });
  });

  if (!items.length && intentie !== 'toevoegen') {
    return null;
  }

  return { intentie, projectId: String(raw.projectId), items };
}

export function beginStatussen(items) {
  const uit = {};

  (items || []).forEach((i) => {
    uit[itemSleutel(i)] = i.staatAl ? ITEM_STATUS.STAAT_AL : ITEM_STATUS.KLAAR;
  });

  return uit;
}

// Eén item toevoegen. Altijd via de gedeelde service; nooit een bedrag (alleen op expliciete invoer van de gebruiker).
// Een fonds zonder database-id (type 'online') gaat op naam het dekkingsplan in.
// -> ITEM_STATUS.TOEGEVOEGD | STAAT_AL | MISLUKT
export async function voegItemToe({ item, projectId, projecten, voegToe = voegToeAanProjectfinanciering, voegOnlineToe = voegOnlineToeAanProjectfinanciering }) {
  const res =
    item.type === 'online'
      ? await voegOnlineToe({ projectId, bron: { naam: item.naam, funder: item.funder, deadline: item.deadline, url: item.url || null }, projecten })
      : await voegToe({ projectId, bron: { type: item.type, id: item.id }, bedragTekst: '', projecten });

  if (res && res.ok) {
    return ITEM_STATUS.TOEGEVOEGD;
  }

  return res && res.reden === 'bestaat-al' ? ITEM_STATUS.STAAT_AL : ITEM_STATUS.MISLUKT;
}

// Meerdere items na elkaar (geen parallelle inserts: voorspelbaar, en de unieke index blijft leidend).
// onStatus(sleutel, status) per item. Items die al "toegevoegd" of "staat-al" zijn worden overgeslagen.
export async function voegItemsToe({ items, projectId, projecten, huidig = {}, onStatus, voegToe, voegOnlineToe }) {
  const uit = { toegevoegd: 0, staatAl: 0, mislukt: 0 };

  for (const item of items) {
    const sleutel = itemSleutel(item);
    const nu = huidig[sleutel];

    if (nu === ITEM_STATUS.TOEGEVOEGD || nu === ITEM_STATUS.STAAT_AL || nu === ITEM_STATUS.BEZIG || nu === ITEM_STATUS.NIET) {
      continue;
    }

    if (onStatus) onStatus(sleutel, ITEM_STATUS.BEZIG);

    const status = await voegItemToe({ item, projectId, projecten, ...(voegToe ? { voegToe } : {}), ...(voegOnlineToe ? { voegOnlineToe } : {}) });

    if (onStatus) onStatus(sleutel, status);

    if (status === ITEM_STATUS.TOEGEVOEGD) uit.toegevoegd += 1;
    else if (status === ITEM_STATUS.STAAT_AL) uit.staatAl += 1;
    else uit.mislukt += 1;
  }

  return uit;
}

export function telStatussen(statussen) {
  const uit = { toegevoegd: 0, staatAl: 0, mislukt: 0, bezig: 0, klaar: 0, niet: 0 };

  Object.values(statussen || {}).forEach((s) => {
    if (s === ITEM_STATUS.TOEGEVOEGD) uit.toegevoegd += 1;
    else if (s === ITEM_STATUS.STAAT_AL) uit.staatAl += 1;
    else if (s === ITEM_STATUS.MISLUKT) uit.mislukt += 1;
    else if (s === ITEM_STATUS.BEZIG) uit.bezig += 1;
    else if (s === ITEM_STATUS.NIET) uit.niet += 1;
    else uit.klaar += 1;
  });

  return uit;
}

// Kop boven de kaart: "4 kansrijke financiers gevonden".
export function kopTekst(aantal) {
  return aantal === 1 ? '1 passend fonds' : `${aantal} passende fondsen`;
}

// Samenvatting na toevoegen, ook voor schermlezers (aria-live).
export function samenvattingTekst(uit) {
  const delen = [];

  if (uit.toegevoegd) delen.push(uit.toegevoegd === 1 ? '1 toegevoegd aan het dekkingsplan' : `${uit.toegevoegd} toegevoegd aan het dekkingsplan`);
  if (uit.staatAl) delen.push(uit.staatAl === 1 ? '1 stond er al in' : `${uit.staatAl} stonden er al in`);
  if (uit.mislukt) delen.push(uit.mislukt === 1 ? '1 is niet gelukt' : `${uit.mislukt} zijn niet gelukt`);

  return delen.join(' · ');
}

// Bij "Zet deze vier in mijn dekkingsplan": de laatste eerdere lijst van HETZELFDE project in dit gesprek.
// berichten: [{ role, fondsMatches?: { projectId, items } }]
export function laatsteLijst(berichten, projectId) {
  for (let i = (berichten || []).length - 1; i >= 0; i -= 1) {
    const m = berichten[i];
    const lijst = m && m.role === 'assistant' ? m.fondsMatches : null;

    if (lijst && lijst.projectId === projectId && Array.isArray(lijst.items) && lijst.items.length) {
      return lijst;
    }
  }

  return null;
}

// Staat dit item al als regel in het dekkingsplan (rijen uit regelUitRpc)? -> de regel of null.
// Gebruikt om "Bespreek" voor een bestaand item te laten focussen op die regel (focusFundingId).
export function vindRegelVoorItem(item, regels) {
  if (item.type === 'online') {
    const n = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const namen = [item.naam, item.funder && item.funder !== item.naam ? `${item.funder} - ${item.naam}` : ''].map(n).filter(Boolean);

    return (regels || []).find((r) => !r.schemeId && !r.funderId && namen.includes(n(r.naam))) || null;
  }

  return (regels || []).find((r) => (item.type === 'fonds' ? r.funderId === item.id : r.schemeId === item.id)) || null;
}

// Het id van de fundingregel bij een item dat al in het dekkingsplan staat (één RPC, dezelfde bron als de UI).
// Alleen voor focusFundingId: de server valideert dat id opnieuw (eigenaar, project, rechten). -> id of null
export async function zoekFundingId(item, projectId, haal = haalDekkingsplan) {
  try {
    const res = await haal(projectId);

    if (res.error || !Array.isArray(res.regels)) {
      return null;
    }

    const regel = vindRegelVoorItem(item, res.regels.map(regelUitRpc));

    return regel && isEchtId(String(regel.id || '')) ? regel.id : null;
  } catch (e) {
    return null;
  }
}

// De kaart voor het nieuwe antwoord, of null. Alleen voor het actieve project van dit gesprek; bij "Zet deze vier in mijn
// dekkingsplan" (intentie 'toevoegen') worden de items van de laatste eerdere lijst van dit project genomen, en de kaart
// vraagt eerst om bevestiging (geen blinde schrijfactie op een dubbelzinnige verwijzing).
export function kaartVoorBericht(raw, vorigeBerichten, gekoppeldProjectId) {
  const lijst = leesFondsMatches(raw);

  if (!lijst || !gekoppeldProjectId || lijst.projectId !== gekoppeldProjectId) {
    return null;
  }

  if (lijst.intentie === 'toevoegen') {
    const eerder = laatsteLijst(vorigeBerichten, gekoppeldProjectId);

    return eerder ? { ...lijst, items: eerder.items.map((i) => ({ ...i, staatAl: false })) } : null;
  }

  return lijst;
}

// Tweede stap, pas na het toevoegen en alleen op verzoek van het lid: acties in het actieplan voor fondsen die nu in het dekkingsplan staan.
// Loopt via de bestaande server-opslag in de modus "alleen acties" (de server valideert opnieuw, plant de stappen en voorkomt dubbele taken).
// -> { ok: true, aangemaakt } | { ok: false, melding }
export async function maakActiesVoor({ items, projectId, opslaan = vraagVoorstelOpslaan }) {
  const lijst = (items || []).filter(Boolean);
  const regels = lijst.filter((i) => i.type === 'regeling' || i.type === 'fonds').map((i) => ({ type: i.type, id: i.id, bedrag: null }));
  const suggesties = lijst
    .filter((i) => i.type === 'online')
    .map((i) => ({ gever: i.funder || i.naam, naam: i.funder ? i.naam : '', url: i.url || null }));

  if (!isEchtId(String(projectId || '')) || (!regels.length && !suggesties.length)) {
    return { ok: false, melding: 'Er is niets om in het actieplan te zetten.' };
  }

  try {
    const res = await opslaan({ projectId, regels, suggesties, alleenActies: true });

    if (res && res.ok) {
      const plan = res.antwoord && res.antwoord.actieplan;

      return { ok: true, aangemaakt: plan && Number.isFinite(plan.aangemaakt) ? plan.aangemaakt : 0 };
    }

    return { ok: false, melding: 'De acties konden nu niet worden aangemaakt. Probeer het later opnieuw of open het actieplan.' };
  } catch (e) {
    return { ok: false, melding: 'De acties konden nu niet worden aangemaakt. Probeer het later opnieuw of open het actieplan.' };
  }
}
