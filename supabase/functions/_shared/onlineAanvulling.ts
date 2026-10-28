// DATABASE EERST, ONLINE ALLEEN AANVULLEND (Free, Pro en Premium). Zuivere functies, geen netwerk en geen database.
//
// Eerst wordt in onze eigen database gezocht. Pas als die het doel niet haalt, wordt er online aanvullend gezocht, en dat is bij Free en Pro
// veel korter dan bij Premium. Zo wordt er geen online zoekactie betaald als de database al genoeg levert.
//
//   Free     : de chat toont maximaal 3 fondsen; levert de database er 3 of meer, dan is er geen online zoekactie nodig.
//   Pro      : de database is genoeg als de korte lijst de financieringsbehoefte dekt (uitkomst "voldoende"); zonder bekende behoefte als er minstens 3 sterke
//              matches zijn.
//   Premium  : na de database altijd een online ronde, in de chat en in het voorstel (minstens `minTonen` online suggesties, zie tierConfig).
//   Beheer   : onveranderd, zoekt altijd online mee (zodat het hele pad te testen blijft).

export const FREE_MAX_FONDSEN = 3;
export const MIN_STERKE_MATCHES_ZONDER_BEHOEFTE = 3;

export type ProUitkomst = 'voldoende' | 'tekort' | 'zonder-begroting' | 'geen-geschikt';

// Chat: is online aanvullen nodig, nadat de database al is doorzocht?
export function onlineNodigInChat(inv: {
  tier: string;
  isAdmin: boolean;
  aantalGetoond: number; // wat de database het lid in de chat laat zien (Free: maximaal 3)
  proUitkomst?: ProUitkomst | null; // alleen Pro en Premium: uitkomst van de korte lijst op de database alleen
  proRegels?: number;
}): boolean {
  if (inv.isAdmin) return true;

  // Premium: na de database altijd een ruime online ronde (Premium krijgt meer en breder); de database blijft de eerste stap.
  if (inv.tier === 'premium') return true;

  if (inv.tier === 'pro') {
    if (!inv.proUitkomst) return true; // kon niet worden vastgesteld: liever aanvullen dan een te korte lijst

    if (inv.proUitkomst === 'voldoende') return false;

    if (inv.proUitkomst === 'zonder-begroting') return (inv.proRegels ?? 0) < MIN_STERKE_MATCHES_ZONDER_BEHOEFTE;

    return true; // 'tekort' of 'geen-geschikt'
  }

  // Free (en onbekende tiers, voorzichtig behandeld als Free)
  return inv.aantalGetoond < FREE_MAX_FONDSEN;
}

// Voorstel (Pro en Premium): is online aanvullen nodig, nadat het voorstel uit de database is opgebouwd?
export function onlineNodigInVoorstel(inv: {
  heeftOnlineConfig: boolean;
  minTonen?: number | null; // Premium: minstens zoveel online suggesties, ook als de database het doel al haalt
  zonderBedrag: boolean;
  restNodig: number; // wat na de database nog aan dekking ontbreekt (0 = gedekt)
  aantalRegels: number; // aantal regels in het voorstel uit de database
}): boolean {
  if (!inv.heeftOnlineConfig) return false;

  if (inv.minTonen != null && inv.minTonen > 0) return true;

  if (inv.zonderBedrag) return inv.aantalRegels < MIN_STERKE_MATCHES_ZONDER_BEHOEFTE;

  return inv.restNodig > 0;
}

// Beknopte online zoekruimte voor de chat. Pro krijgt de ruimte uit de tierconfig (kort), Free nog korter en alleen om tot 3 te komen,
// Premium en beheer de bestaande ruimte van de chat (geen profiel).
export function chatOnlineProfiel(
  tier: string,
  isAdmin: boolean,
  proConfig: { maxKandidaten: number; maxZoekopdrachten: number; timeoutMs: number } | null,
  nodigVoorFree = FREE_MAX_FONDSEN,
): { maxKandidaten: number; maxZoekopdrachten: number; timeoutMs: number; maxOutputTokens: number } | undefined {
  if (isAdmin || tier === 'premium') return undefined;

  if (tier === 'pro') {
    const c = proConfig ?? { maxKandidaten: 2, maxZoekopdrachten: 2, timeoutMs: 40_000 };

    return { ...c, maxOutputTokens: 3000 + 800 * c.maxKandidaten };
  }

  const n = Math.max(1, Math.min(FREE_MAX_FONDSEN, nodigVoorFree));

  return { maxKandidaten: n, maxZoekopdrachten: n, timeoutMs: 40_000, maxOutputTokens: 3000 + 800 * n };
}
