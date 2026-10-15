// De bronstatus van een financieringsmogelijkheid, zoals de SERVER die heeft vastgelegd (tabel subsidie_kompas_bron_controles). ZUIVER.
//
// Twee dingen die nooit door elkaar mogen lopen:
//   - de FINANCIERINGSSTATUS van een regel (Interessant, In voorbereiding, Aangevraagd, Toegekend, ...): wat het lid ermee doet;
//   - de BRONSTATUS: of de bron (website van de financier) is gecontroleerd. "Gecontroleerd" betekent alleen dat naam en deadline in de bron
//     zijn teruggevonden. Het zegt niets over toekenning of over de kans daarop.
// De client bepaalt hier nooit een bronstatus: hij vertaalt alleen wat de server teruggaf naar een label.

// Moet gelijk zijn aan BRON_MAX_LEEFTIJD_DAGEN in supabase/functions/_shared/bronControle.ts (de server beslist; dit is alleen voor de weergave).
export const BRON_MAX_LEEFTIJD_DAGEN = 14;

export const BRON = {
  CONTROLEREN: 'controleren',
  GECONTROLEERD: 'gecontroleerd',
  ONZEKER: 'onzeker',
  MISLUKT: 'mislukt',
  NIET: 'niet_gecontroleerd',
};

export const BRON_LABEL = {
  [BRON.CONTROLEREN]: 'Controleren…',
  [BRON.GECONTROLEERD]: 'Gecontroleerd',
  [BRON.ONZEKER]: 'Onzeker',
  [BRON.MISLUKT]: 'Controle mislukt',
  [BRON.NIET]: 'Niet gecontroleerd',
};

// Uitleg bij het label, in gewone taal. De eerste en laatste zijn bewust nuchter over wat "gecontroleerd" wel en niet betekent.
export const BRON_UITLEG = {
  [BRON.CONTROLEREN]: 'De bron wordt nu gecontroleerd. U kunt ondertussen verder.',
  [BRON.GECONTROLEERD]: 'De naam en de deadline zijn teruggevonden op de website van de financier. Dit zegt niets over de kans op toekenning.',
  [BRON.ONZEKER]: 'De bron kon niet volledig worden bevestigd. Controleer de deadline en de voorwaarden zelf bij de financier.',
  [BRON.MISLUKT]: 'De bron kon nu niet worden gecontroleerd. U kunt het opnieuw proberen of de gegevens zelf controleren bij de financier.',
  [BRON.NIET]: 'De bron is niet gecontroleerd. Controleer de deadline en de voorwaarden zelf bij de financier.',
};

export const VEROUDERD_UITLEG = 'Deze bron is eerder gecontroleerd, maar de gegevens zijn sindsdien veranderd of de controle is ouder dan 14 dagen. Controleer opnieuw.';

const REDEN_TEKST = {
  geen_bron_url: 'Er is geen website bekend waarmee deze financier automatisch kan worden gecontroleerd.',
  geen_toegang_tot_details: 'Van deze financier zijn alleen basisgegevens beschikbaar.',
};

// Server-antwoord ('gecontroleerd' | 'onzeker' | 'mislukt' | 'verouderd' | 'niet-gecontroleerd') -> sleutel van deze module. Alles wat onbekend is
// wordt "niet gecontroleerd" (nooit opgewaardeerd).
export function bronSleutelUitServer(status) {
  if (status === 'gecontroleerd') return BRON.GECONTROLEERD;
  if (status === 'onzeker') return BRON.ONZEKER;
  if (status === 'mislukt') return BRON.MISLUKT;

  return BRON.NIET;
}

// -> { status: sleutel, label, uitleg, verouderd: bool, gecontroleerdOp: iso|null, hergebruikt: bool, redenTekst: string }
export function bronModel(controle) {
  const c = controle && typeof controle === 'object' ? controle : {};
  const verouderd = c.status === 'verouderd';
  const status = bronSleutelUitServer(c.status);

  return {
    status,
    label: BRON_LABEL[status],
    uitleg: verouderd ? VEROUDERD_UITLEG : BRON_UITLEG[status],
    verouderd,
    gecontroleerdOp: typeof c.gecontroleerdOp === 'string' ? c.gecontroleerdOp : null,
    hergebruikt: c.hergebruikt === true,
    redenTekst: typeof c.reden === 'string' && REDEN_TEKST[c.reden] ? REDEN_TEKST[c.reden] : '',
  };
}

export const BRON_CONTROLEREN = { status: BRON.CONTROLEREN, label: BRON_LABEL[BRON.CONTROLEREN], uitleg: BRON_UITLEG[BRON.CONTROLEREN], verouderd: false, gecontroleerdOp: null, hergebruikt: false, redenTekst: '' };

export function datumTekst(iso) {
  const t = Date.parse(iso || '');

  if (!Number.isFinite(t)) return '';

  return new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Voor een OPGESLAGEN regel in het dekkingsplan: de rij uit de tabel (via leesBronControles) -> bronmodel, of null als dit geen database-financier is.
// Een rij ouder dan BRON_MAX_LEEFTIJD_DAGEN telt als verouderd (de server zet bij opslaan ook zelf 'verouderd' als de gegevens veranderden).
export function bronVoorRegel(regel, rijen, nu = new Date()) {
  if (!regel) return null;

  const isDatabase = regel.bronStatus === 'zichtbaar' && (regel.bronType === 'regeling' || regel.bronType === 'fonds');

  if (!isDatabase) {
    // Online gevonden of handmatig toegevoegd: nooit door ons gecontroleerd.
    return regel.bronType === 'financier' && /online gevonden door subsidiekompas/i.test(regel.notitie || '')
      ? { ...bronModel({ status: 'niet-gecontroleerd' }), label: 'Online gevonden: niet gecontroleerd', uitleg: 'Deze financier is online gevonden en staat niet in onze database. Controleer de voorwaarden en de deadline zelf bij de financier.' }
      : null;
  }

  const id = regel.bronType === 'regeling' ? regel.schemeId : regel.funderId;
  const rij = (Array.isArray(rijen) ? rijen : []).find((x) => x && x.record_type === regel.bronType && String(x.record_id).toLowerCase() === String(id || '').toLowerCase());

  if (!rij) return bronModel({ status: 'niet-gecontroleerd' });

  const leeftijd = (nu.getTime() - Date.parse(rij.gecontroleerd_op)) / 86400000;
  const te_oud = !Number.isFinite(leeftijd) || leeftijd > BRON_MAX_LEEFTIJD_DAGEN;

  return bronModel({ status: te_oud ? 'verouderd' : rij.status, gecontroleerdOp: rij.gecontroleerd_op, reden: rij.reden });
}
