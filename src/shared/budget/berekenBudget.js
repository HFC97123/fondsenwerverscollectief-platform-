// src/shared/budget/berekenBudget.js
//
// RC1 stap 3D: de deterministische "waarheid" voor een begroting - nooit het
// taalmodel. budgetUitTekst() (Edge Function, supabase/functions/subsidie-
// kompas/index.ts) leest alleen letterlijk wat in de chattekst staat
// (aantal/tarief/vermeld bedrag per kostenpost, nooit zelf berekend - zie de
// toelichting daar); alle rekenwerk en alle controles gebeuren hier, in
// gewone, synchroon testbare JS - geen tweede implementatie van bestaande
// financiële logica: de dekkingskant hergebruikt rechtstreeks de al
// bestaande, geteste berekenDekking() (KompasStore.jsx).
//
// Nog GEEN Excel, nog GEEN opslag: dit is uitsluitend tekst -> structuur ->
// validatie (zie claude/rc1-stap3-analyse-begrotingsflow-excel.md).
import { berekenDekking } from '../../features/kompas-app/KompasStore.jsx';

const AFRONDING_TOLERANTIE = 0.01; // euro - voorkomt valse "afwijking" door drijvendekomma-afronding

// Nederlandse (en, waar ondubbelzinnig, Amerikaanse) bedragnotatie correct
// interpreteren - bewust een NIEUWE, eigen parser, niet de bestaande
// getal()-helper uit data/services/projecten.js: die strip alle
// niet-cijfers (dus ook decimaaltekens) en zou "€ 1.250,50" verminken tot
// 125050 - prima voor de daar al bestaande, altijd hele-euro-velden, maar
// niet geschikt voor itemized kostenregels met centen.
export function parseEuroDutch(waarde) {
  if (waarde == null) {
    return null;
  }

  if (typeof waarde === 'number') {
    return Number.isFinite(waarde) ? waarde : null;
  }

  let s = String(waarde).trim();

  if (!s) {
    return null;
  }

  // Euroteken, spaties, letters e.d. eruit - cijfers, '.', ',' en een
  // eventueel voorteken blijven staan.
  s = s.replace(/[^0-9.,-]/g, '');

  if (!s) {
    return null;
  }

  const laatsteKomma = s.lastIndexOf(',');
  const laatstePunt = s.lastIndexOf('.');

  if (laatsteKomma > laatstePunt) {
    // Nederlandse notatie: '.' is duizendtalscheiding, ',' is decimaal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Amerikaanse notatie (',' als duizendtal) of geen decimaalteken.
    s = s.replace(/,/g, '');
  }

  const n = Number(s);

  return Number.isFinite(n) ? n : null;
}

function rond(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Eén kostenregel zoals budgetUitTekst() die letterlijk las. Bepaalt hier,
// in code, wat het echte bedrag is - nooit het eventueel door de AI zelf in
// de brontekst genoemde bedrag zonder controle overnemen.
export function berekenKostenregel(regel) {
  const quantity = parseEuroDutch(regel?.quantity);
  const unitPrice = parseEuroDutch(regel?.unitPrice);
  const statedAmount = parseEuroDutch(regel?.statedAmount);

  const quantityOngeldig = regel?.quantity != null && (quantity == null || quantity < 0);
  const unitPriceOngeldig = regel?.unitPrice != null && (unitPrice == null || unitPrice < 0);
  const statedAmountOngeldig = regel?.statedAmount != null && (statedAmount == null || statedAmount < 0);

  const heeftAantalTarief = quantity != null && unitPrice != null && quantity >= 0 && unitPrice >= 0;
  const berekendBedrag = heeftAantalTarief ? rond(quantity * unitPrice) : null;

  let bedrag = null;
  let bron = 'onbekend'; // 'berekend' | 'vast' | 'onbekend'
  let afwijking = false;
  let afwijkingDetail = null;

  if (heeftAantalTarief) {
    bedrag = berekendBedrag;
    bron = 'berekend';

    if (statedAmount != null && statedAmount >= 0 && Math.abs(statedAmount - berekendBedrag) > AFRONDING_TOLERANTIE) {
      afwijking = true;
      afwijkingDetail = `Brontekst noemt €${statedAmount.toLocaleString('nl-NL')}, maar ${quantity} × €${unitPrice.toLocaleString('nl-NL')} = €${berekendBedrag.toLocaleString('nl-NL')}.`;
    }
  } else if (statedAmount != null && statedAmount >= 0) {
    // Vaste kostenpost (bijv. "Vergunningen: €750") - geen aantal/tarief
    // beschikbaar of verzonnen, het genoemde bedrag is hier de enige
    // betrouwbare waarde.
    bedrag = statedAmount;
    bron = 'vast';
  }

  return {
    categorie: regel?.category || 'overig',
    omschrijving: regel?.description || '',
    toelichting: regel?.notes || null,
    aantal: quantity,
    tarief: unitPrice,
    vermeldBedrag: statedAmount,
    bedrag,
    bron,
    afwijking,
    afwijkingDetail,
    ongeldig: Boolean(quantityOngeldig || unitPriceOngeldig || statedAmountOngeldig),
  };
}

// Combineert de itemized kostenregels (uit budgetUitTekst(), via
// berekenKostenregel hierboven) met de al bestaande, structured
// projectfinanciering (project.begroting/gevraagd/eigenBijdrage/cofin/
// eerder/regelingen - subsidie_kompas_programs, zie data/services/
// projecten.js) tot één canonical, gevalideerd Budget.
//
// Bronprioriteit (opdrachtpunt "bestaande projectdata", DEEL 8): voor het
// gevraagde bedrag geldt hetzelfde patroon als het al bestaande Projectdossier
// (projectdossierUitGesprek() in de Edge Function: "noemt het lid een eerder
// genoemd gegeven opnieuw, maar dan anders, dan vervangt die nieuwe waarde de
// oude") - een bedrag dat het actieve gesprek zelf expliciet noemt
// (budgetMeta.requestedAmountStated) weegt zwaarder dan het oudere,
// opgeslagen projectveld, maar VERVANGT dat opgeslagen veld nooit stilzwijgend
// (er wordt in deze stap sowieso niets opgeslagen - zie DEEL 9) en wordt
// alleen gebruikt wanneer de brontekst dat bedrag daadwerkelijk noemt, nooit
// geraden.
export function berekenBudget(expenseLines, project, budgetMeta) {
  const regels = (Array.isArray(expenseLines) ? expenseLines : []).map(berekenKostenregel);

  const totaalPerCategorie = {};

  regels.forEach((r) => {
    if (r.bedrag == null) {
      return;
    }

    totaalPerCategorie[r.categorie] = rond((totaalPerCategorie[r.categorie] || 0) + r.bedrag);
  });

  const totaalKosten = rond(Object.values(totaalPerCategorie).reduce((t, n) => t + n, 0));

  const onbekendeRegels = regels.filter((r) => r.bedrag == null && !r.ongeldig);
  const afwijkendeRegels = regels.filter((r) => r.afwijking);
  const ongeldigeRegels = regels.filter((r) => r.ongeldig);

  // Dekking: rechtstreeks hergebruikt uit de al bestaande, geteste
  // berekenDekking() - geen tweede implementatie van dezelfde financiële
  // logica (DEEL 6). berekenDekking() leest project.begroting/eigenBijdrage/
  // eerder/regelingen/cofin rechtstreeks.
  const dekking = berekenDekking(project || {});
  const totaalDekking = rond((dekking?.toegekend || 0) + (dekking?.inAanvraag || 0));

  const meta = budgetMeta || {};
  const gevraagdUitGesprek = parseEuroDutch(meta.requestedAmountStated);
  const gevraagdUitProject = parseEuroDutch(project?.gevraagd);
  const gevraagdBedrag =
    gevraagdUitGesprek != null
      ? { waarde: gevraagdUitGesprek, bron: 'gesprek' }
      : gevraagdUitProject != null
        ? { waarde: gevraagdUitProject, bron: 'project' }
        : null;

  const verschil = rond(totaalKosten - totaalDekking);
  const isConcept = meta.isConceptStated === true;

  return {
    expenseLines: regels,
    projectFinanciering: {
      begroting: parseEuroDutch(project?.begroting),
      eigenBijdrage: parseEuroDutch(project?.eigenBijdrage),
      cofinanciers: Array.isArray(project?.cofin) ? project.cofin : [],
      dekking,
    },
    totals: {
      totaalPerCategorie,
      totaalKosten,
      totaalDekking,
      verschil,
      gevraagdBedrag,
      // STAP 6 (kompas.system): "een sluitende begroting is verplicht tenzij
      // de gebruiker expliciet om een conceptscenario vraagt" - alleen bij
      // een expliciet conceptscenario (meta.isConceptStated) telt een
      // niet-sluitend verschil niet als probleem.
      isSluitend: Math.abs(verschil) <= AFRONDING_TOLERANTIE,
      isConcept,
    },
    waarschuwingen: {
      aantalOnbekendeRegels: onbekendeRegels.length,
      onbekendeRegels: onbekendeRegels.map((r) => r.omschrijving),
      afwijkendeRegels: afwijkendeRegels.map((r) => ({ omschrijving: r.omschrijving, detail: r.afwijkingDetail })),
      ongeldigeRegels: ongeldigeRegels.map((r) => r.omschrijving),
    },
  };
}
