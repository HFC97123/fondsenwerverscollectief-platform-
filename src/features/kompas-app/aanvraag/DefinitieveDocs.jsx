// Knoppen bij de geschreven documenten in Projectdocumentatie: "Maak definitief" (een vaste kopie van het concept), de Excel van begroting en dekkingsplan, en verwijderen van een definitieve versie.
// Alles met een korte bevestiging in de regel zelf; er verschijnt geen pop-up.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { haalDekkingsplan } from '../../../data/services/projectFinanciering.js';
import { haalDefinitiefDocument, maakDefinitief, verwijderDefinitief } from '../../../data/services/definitieveDocumenten.js';
import { downloadBegrotingConcept, downloadBegrotingDefinitief } from '../begroting/begrotingExport.js';
import { regelUitRpc } from '../financiering/dekkingsplan.js';
import { aantalAanvullenInPlan, begrotingMomentopname, DEFINITIEF_NAAM, definitiefSoortVan, planMomentopname } from './aanvraagModel.js';
import { leesPlan } from './GeschrevenDocs.jsx';

const FOUT_TEKST = {
  'niet-toegestaan': 'Definitief maken hoort bij Pro en Premium.',
  'geen-sessie': 'U bent niet meer ingelogd. Log opnieuw in en probeer het nog eens.',
  ongeldig: 'Dit document kon niet worden bewaard. Probeer het opnieuw.',
  fout: 'Het lukte niet om de definitieve versie te bewaren. Probeer het opnieuw.',
};

const orgNaam = (store) => (store && store.orgProfile && store.orgProfile.name) || null;
const meldingStijl = "font-family: 'Mulish', sans-serif; font-size: 12.5px; color: #4B5C58;";

// De vaste kopie van het concept: plan -> het plan zelf, begroting en dekkingsplan -> het project met zijn financieringsregels van dit moment.
async function maakInhoud({ doc, project }) {
  const soort = definitiefSoortVan(doc);

  if (soort === 'projectplan') {
    const plan = await leesPlan(doc.aanvraagId);

    return plan ? { soort, inhoud: planMomentopname({ plan, projectNaam: doc.projectNaam }), aanvullen: aantalAanvullenInPlan(plan) } : null;
  }

  if (!project) return null;

  const res = await haalDekkingsplan(project.id);
  const finRegels = res && !res.error && Array.isArray(res.regels) ? res.regels.map(regelUitRpc) : [];

  return { soort, inhoud: begrotingMomentopname({ soort, project, finRegels }), aanvullen: 0 };
}

export function MaakDefinitiefKnop({ doc, project, onKlaar, onMelding }) {
  const [stap, setStap] = useState('rust'); // rust | laden | vragen | bewaren
  const [klaar, setKlaar] = useState(null);
  const [nog, setNog] = useState(0);
  const soort = definitiefSoortVan(doc);

  if (!soort) return null;

  const begin = async () => {
    setStap('laden');
    onMelding('');

    try {
      const k = await maakInhoud({ doc, project });

      if (!k) {
        onMelding('Dit document kon niet worden gelezen. Probeer het opnieuw.');
        setStap('rust');

        return;
      }

      setKlaar(k);
      setNog(k.aanvullen);
      setStap('vragen');
    } catch (e) {
      onMelding('Dit document kon niet worden gelezen. Probeer het opnieuw.');
      setStap('rust');
    }
  };

  const bewaar = async () => {
    setStap('bewaren');

    const r = await maakDefinitief({ projectId: doc.projectId, soort: klaar.soort, naam: DEFINITIEF_NAAM[klaar.soort], inhoud: klaar.inhoud });

    if (r.ok) {
      onMelding(`${DEFINITIEF_NAAM[klaar.soort]} is definitief gemaakt (versie ${r.versie}). U vindt het bovenaan de lijst.`);
      setStap('rust');
      setKlaar(null);
      onKlaar();
    } else {
      onMelding(FOUT_TEKST[r.reden] || FOUT_TEKST.fout);
      setStap('vragen');
    }
  };

  if (stap === 'vragen' || stap === 'bewaren') {
    return (
      <span data-testid="maak-definitief-vraag" style={css('display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;')}>
        <span style={css(meldingStijl)}>
          {nog > 0 ? `Er ${nog === 1 ? 'staat nog 1 plek' : `staan nog ${nog} plekken`} met [aanvullen] in. ` : ''}
          Een vaste kopie bewaren? Wijzigingen daarna veranderen deze kopie niet.
        </span>
        <Button variant="dark" size="s" onClick={bewaar} disabled={stap === 'bewaren'} testid="maak-definitief-ja">
          {stap === 'bewaren' ? 'Bezig…' : 'Ja, maak definitief'}
        </Button>
        <Button variant="outline" size="s" onClick={() => setStap('rust')} disabled={stap === 'bewaren'} testid="maak-definitief-nee">
          Annuleren
        </Button>
      </span>
    );
  }

  return (
    <Button variant="outline" size="s" onClick={begin} disabled={stap === 'laden'} testid="maak-definitief" ariaLabel={`${doc.naam} definitief maken`}>
      {stap === 'laden' ? 'Even geduld…' : 'Maak definitief'}
    </Button>
  );
}

// Excel van het concept (begroting en dekkingsplan, vers uit het project) of van een definitieve versie (uit de vaste kopie).
export function ExcelKnop({ doc, project, store, onMelding }) {
  const [bezig, setBezig] = useState(false);

  const klik = async () => {
    setBezig(true);
    onMelding('');

    try {
      if (doc.definitief) {
        const d = await haalDefinitiefDocument(doc.definitiefId);

        if (!d || !d.inhoud || !d.inhoud.project) throw new Error('leeg');

        await downloadBegrotingDefinitief({ inhoud: d.inhoud, organisatieNaam: orgNaam(store) });
      } else {
        if (!project) throw new Error('leeg');

        await downloadBegrotingConcept({ project, organisatieNaam: orgNaam(store) });
      }
    } catch (e) {
      onMelding('Het Excel-bestand kon niet worden gemaakt. Probeer het opnieuw.');
    }

    setBezig(false);
  };

  return (
    <Button variant="outline" size="s" onClick={klik} disabled={bezig} testid="document-excel" ariaLabel={`${doc.naam} downloaden als Excel`}>
      {bezig ? 'Bezig…' : 'Excel'}
    </Button>
  );
}

export function DefinitiefVerwijderKnop({ doc, onKlaar, onMelding }) {
  const [vraag, setVraag] = useState(false);
  const [bezig, setBezig] = useState(false);

  const weg = async () => {
    setBezig(true);

    const r = await verwijderDefinitief(doc.definitiefId);

    setBezig(false);
    setVraag(false);

    if (r.ok) {
      onMelding(`${doc.naam} (versie ${doc.versie}) is verwijderd. Het concept blijft staan.`);
      onKlaar();
    } else onMelding('Verwijderen lukte niet. Probeer het opnieuw.');
  };

  if (vraag) {
    return (
      <span data-testid="definitief-verwijder-vraag" style={css('display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;')}>
        <span style={css(meldingStijl)}>Deze definitieve versie verwijderen?</span>
        <Button variant="dark" size="s" onClick={weg} disabled={bezig} testid="definitief-verwijder-ja">
          Ja, verwijderen
        </Button>
        <Button variant="outline" size="s" onClick={() => setVraag(false)} disabled={bezig}>
          Annuleren
        </Button>
      </span>
    );
  }

  return (
    <Button variant="outline" size="s" onClick={() => setVraag(true)} testid="definitief-verwijder" ariaLabel={`${doc.naam} versie ${doc.versie} verwijderen`}>
      Verwijderen
    </Button>
  );
}
