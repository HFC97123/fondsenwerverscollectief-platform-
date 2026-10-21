// FASE5 — Gesprek hervatten via een veilige URL: #/kompas?conversation=<uuid>[&focus=<uuid>] of
// #/kompas?project=<uuid>[&focus=<uuid>] (nieuw gesprek met dat project als startpunt).
//
// De URL is alleen een AANWIJZING. De pagina valideert het gesprek server-side (rij moet van de ingelogde gebruiker
// zijn), neemt active_program_id uit die rij (nooit uit de URL of uit localStorage) en gebruikt 'focus' alleen als
// verzoekveld: de Edge Function controleert eigenaar, project en rechten opnieuw. Er staan geen namen, bedragen of
// andere gegevens in de URL, alleen uuid's.
import { isEchtId } from '../../../data/services/projecten.js';

export const CHAT_PAD = '/kompas';

const schoon = (v) => (isEchtId(String(v || '')) ? String(v) : null);

// hash: bijvoorbeeld window.location.hash -> { conversation, project, focus } (alleen geldige uuid's, anders null)
export function leesChatUrl(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const [pad, query = ''] = h.split('?');

  if (pad.replace(/\/+$/, '') !== CHAT_PAD) {
    return { conversation: null, project: null, focus: null };
  }

  const q = new URLSearchParams(query);

  return { conversation: schoon(q.get('conversation')), project: schoon(q.get('project')), focus: schoon(q.get('focus')) };
}

// -> '#/kompas' | '#/kompas?conversation=..&focus=..' | '#/kompas?project=..&focus=..'
export function chatHref({ conversationId = null, projectId = null, fundingId = null } = {}) {
  const q = [];
  const gesprek = schoon(conversationId);
  const project = schoon(projectId);
  const focus = schoon(fundingId);

  if (gesprek) q.push(`conversation=${gesprek}`);
  else if (project) q.push(`project=${project}`);

  if (focus && (gesprek || project)) q.push(`focus=${focus}`);

  return `#${CHAT_PAD}${q.length ? `?${q.join('&')}` : ''}`;
}

// Een vaste startcode voor een nieuw gesprek: #/kompas?project=<uuid>&start=begroting. Alleen codes uit deze lijst tellen; er gaat nooit vrije
// tekst in een adres. De chat zet dan de modus en vult een vaste openingsvraag in (het lid verstuurt die zelf).
export const CHAT_STARTS = ['begroting'];

export function leesChatStart(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const [pad, query = ''] = h.split('?');

  if (pad.replace(/\/+$/, '') !== CHAT_PAD) return null;

  const start = new URLSearchParams(query).get('start');

  return CHAT_STARTS.includes(start) ? start : null;
}

// -> '#/kompas?project=<uuid>&start=begroting'; zonder geldig project of onbekende code: gewoon '#/kompas'.
export function chatStartHref({ projectId, start }) {
  const project = schoon(projectId);

  return project && CHAT_STARTS.includes(start) ? `#${CHAT_PAD}?project=${project}&start=${start}` : `#${CHAT_PAD}`;
}

// Houdt de adresbalk in sync met het actieve gesprek zonder een extra geschiedenisstap (replaceState) en zonder
// hashchange-gebeurtenis. Alleen op de chatroute zelf; elders doet dit niets.
export function zetChatUrl(conversationId, win = typeof window === 'undefined' ? null : window) {
  if (!win) return false;

  const nu = String(win.location.hash || '').replace(/^#/, '').split('?')[0].replace(/\/+$/, '');

  if (nu !== CHAT_PAD) return false;

  const doel = chatHref({ conversationId });

  if (win.location.hash !== doel) {
    win.history.replaceState(win.history.state, '', doel);
  }

  return true;
}

export function wisChatUrl(win = typeof window === 'undefined' ? null : window) {
  return zetChatUrl(null, win);
}
