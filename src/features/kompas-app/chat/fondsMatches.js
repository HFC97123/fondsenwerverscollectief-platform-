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
import { regelUitRpc } from '../financiering/dekkingsplan.js';
import { voegToeAanProjectfinanciering } from '../financiering/toevoegen.js';

export const MAX_ITEMS = 12;

export const ITEM_STATUS = {
  KLAAR: 'klaar',
  BEZIG: 'bezig',
  TOEGEVOEGD: 'toegevoegd',
  STAAT_AL: 'staat-al',
  MISLUKT: 'mislukt',
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
    if (!i || (i.type !== 'regeling' && i.type !== 'fonds') || !isEchtId(String(i.id || '')) || items.length >= MAX_ITEMS) {
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
// -> ITEM_STATUS.TOEGEVOEGD | STAAT_AL | MISLUKT
export async function voegItemToe({ item, projectId, projecten, voegToe = voegToeAanProjectfinanciering }) {
  const res = await voegToe({ projectId, bron: { type: item.type, id: item.id }, bedragTekst: '', projecten });

  if (res && res.ok) {
    return ITEM_STATUS.TOEGEVOEGD;
  }

  return res && res.reden === 'bestaat-al' ? ITEM_STATUS.STAAT_AL : ITEM_STATUS.MISLUKT;
}

// Meerdere items na elkaar (geen parallelle inserts: voorspelbaar, en de unieke index blijft leidend).
// onStatus(sleutel, status) per item. Items die al "toegevoegd" of "staat-al" zijn worden overgeslagen.
export async function voegItemsToe({ items, projectId, projecten, huidig = {}, onStatus, voegToe }) {
  const uit = { toegevoegd: 0, staatAl: 0, mislukt: 0 };

  for (const item of items) {
    const sleutel = itemSleutel(item);
    const nu = huidig[sleutel];

    if (nu === ITEM_STATUS.TOEGEVOEGD || nu === ITEM_STATUS.STAAT_AL || nu === ITEM_STATUS.BEZIG) {
      continue;
    }

    if (onStatus) onStatus(sleutel, ITEM_STATUS.BEZIG);

    const status = await voegItemToe({ item, projectId, projecten, voegToe });

    if (onStatus) onStatus(sleutel, status);

    if (status === ITEM_STATUS.TOEGEVOEGD) uit.toegevoegd += 1;
    else if (status === ITEM_STATUS.STAAT_AL) uit.staatAl += 1;
    else uit.mislukt += 1;
  }

  return uit;
}

export function telStatussen(statussen) {
  const uit = { toegevoegd: 0, staatAl: 0, mislukt: 0, bezig: 0, klaar: 0 };

  Object.values(statussen || {}).forEach((s) => {
    if (s === ITEM_STATUS.TOEGEVOEGD) uit.toegevoegd += 1;
    else if (s === ITEM_STATUS.STAAT_AL) uit.staatAl += 1;
    else if (s === ITEM_STATUS.MISLUKT) uit.mislukt += 1;
    else if (s === ITEM_STATUS.BEZIG) uit.bezig += 1;
    else uit.klaar += 1;
  });

  return uit;
}

// Kop boven de kaart: "4 kansrijke financiers gevonden".
export function kopTekst(aantal) {
  return aantal === 1 ? '1 kansrijke financier gevonden' : `${aantal} kansrijke financiers gevonden`;
}

// Samenvatting na toevoegen, ook voor schermlezers (aria-live).
export function samenvattingTekst(uit) {
  const delen = [];

  if (uit.toegevoegd) delen.push(uit.toegevoegd === 1 ? '1 toegevoegd aan projectfinanciering' : `${uit.toegevoegd} toegevoegd aan projectfinanciering`);
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
