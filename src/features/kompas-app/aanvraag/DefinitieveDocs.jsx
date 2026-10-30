// Knoppen bij de geschreven documenten in Projectdocumentatie: "Maak definitief" (een vaste kopie van het concept), de Excel van begroting en dekkingsplan, en verwijderen van een definitieve versie.
// Alles met een korte bevestiging in de regel zelf; er verschijnt geen pop-up.
import React, { useEffect, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import ExportMenu from '../../../shared/ui/ExportMenu.jsx';
import { haalHuisstijl } from '../../../data/services/huisstijl.js';
import { haalDekkingsplan } from '../../../data/services/projectFinanciering.js';
import { haalDefinitiefDocument, maakDefinitief, verwijderDefinitief } from '../../../data/services/definitieveDocumenten.js';
import { downloadBegrotingConcept, downloadBegrotingDefinitief } from '../begroting/begrotingExport.js';
import { regelUitRpc } from '../financiering/dekkingsplan.js';
import { aantalAanvullenInPlan, begrotingMomentopname, DEFINITIEF_NAAM, definitiefSoortVan, planMomentopname } from './aanvraagModel.js';
import { leesPlanActueel } from './planLezen.js';
import { SAMENGEVOEGD_NAAM, bouwSamengevoegdModel, samengevoegdMomentopname } from './samengevoegd.js';

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
    const plan = await leesPlanActueel(doc.aanvraagId);

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

// ── Eén samengevoegd document: het projectplan met begroting en dekkingsplan als bijlagen ─────────────────────────────────────────────────

// Het blok boven de lijst met documenten van één project: één knop die een vaste kopie maakt van het plan, de begroting en het dekkingsplan samen.
// planDoc: de regel van het concept projectplan (met aanvraagId); zonder plan is er nog niets om samen te voegen.
export function SamengevoegdBlok({ project, planDoc, onKlaar, onMelding }) {
  const [stap, setStap] = useState('rust'); // rust | laden | vragen | bewaren
  const [klaar, setKlaar] = useState(null);

  const begin = async () => {
    setStap('laden');
    onMelding('');

    try {
      const plan = await leesPlanActueel(planDoc.aanvraagId);

      if (!plan) throw new Error('plan');

      const res = await haalDekkingsplan(project.id);
      const finRegels = res && !res.error && Array.isArray(res.regels) ? res.regels.map(regelUitRpc) : [];

      setKlaar({ inhoud: samengevoegdMomentopname({ plan, project, finRegels, projectNaam: project.naam }), aanvullen: aantalAanvullenInPlan(plan) });
      setStap('vragen');
    } catch (e) {
      onMelding('Het samengevoegde document kon niet worden gemaakt. Probeer het opnieuw.');
      setStap('rust');
    }
  };

  const bewaar = async () => {
    setStap('bewaren');

    const r = await maakDefinitief({ projectId: project.id, soort: 'samengevoegd', naam: SAMENGEVOEGD_NAAM, inhoud: klaar.inhoud });

    if (r.ok) {
      onMelding(`${SAMENGEVOEGD_NAAM} is gemaakt (versie ${r.versie}). U vindt het bovenaan de lijst: kies daar de huisstijl en download het als Word of PDF.`);
      setKlaar(null);
      setStap('rust');
      onKlaar();
    } else {
      onMelding(FOUT_TEKST[r.reden] || FOUT_TEKST.fout);
      setStap('vragen');
    }
  };

  const nog = klaar ? klaar.aanvullen : 0;

  return (
    <div data-testid="samengevoegd-blok" style={css('box-sizing: border-box; margin: 0 0 14px; padding: 14px 16px; border: 1px solid #D5E0D9; border-radius: 14px; background: #F4F8F5; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px;')}>
      <div style={css('flex: 1 1 320px; min-width: 0;')}>
        <strong style={css("display: block; font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E;")}>Projectplan, begroting en dekkingsplan samenvoegen</strong>
        <span style={css("display: block; margin-top: 2px; font-family: 'Mulish', sans-serif; font-size: 13.5px; line-height: 1.5; color: #4B5C58;")}>
          Sommige fondsen vragen om één bestand. Voeg dan het projectplan samen met de begroting en het dekkingsplan, die als bijlagen achter het plan komen. Ze blijven daarnaast ook los bestaan, net als uw aanbevelingsbrief en andere stukken.
        </span>
      </div>
      {!planDoc ? (
        <span data-testid="samengevoegd-geen-plan" style={css(meldingStijl)}>Schrijf eerst een projectplan.</span>
      ) : stap === 'vragen' || stap === 'bewaren' ? (
        <span data-testid="samengevoegd-vraag" style={css('display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;')}>
          <span style={css(meldingStijl)}>
            {nog > 0 ? `Er ${nog === 1 ? 'staat nog 1 plek' : `staan nog ${nog} plekken`} met [aanvullen] in het plan. ` : ''}
            Een vaste kopie bewaren van plan, begroting en dekkingsplan?
          </span>
          <Button variant="dark" size="s" onClick={bewaar} disabled={stap === 'bewaren'} testid="samengevoegd-ja">
            {stap === 'bewaren' ? 'Bezig…' : 'Ja, maak het document'}
          </Button>
          <Button variant="outline" size="s" onClick={() => setStap('rust')} disabled={stap === 'bewaren'} testid="samengevoegd-nee">
            Annuleren
          </Button>
        </span>
      ) : (
        <Button variant="dark" size="s" onClick={begin} disabled={stap === 'laden'} testid="samengevoegd-maak" ariaLabel="Projectplan, begroting en dekkingsplan samenvoegen tot één document">
          {stap === 'laden' ? 'Even geduld…' : 'Samenvoegen tot één document'}
        </Button>
      )}
    </div>
  );
}

// De laatste keuze blijft in het geheugen van deze sessie; er wordt niets in de browser bewaard.
let onthoudenKeuze = null;
const leesKeuze = () => onthoudenKeuze;
const bewaarKeuze = (k) => {
  onthoudenKeuze = k === 'standaard' || k === 'geen' || k === 'eigen' ? k : null;
};

// Word en PDF van het samengevoegde document, met de huisstijl. Pro: altijd Subsidie Kompas (verplicht). Premium kiest: Subsidie Kompas, geen huisstijl of de eigen huisstijl.
export function SamengevoegdExport({ doc, store, premium, paid, onMelding, laadHuisstijl = haalHuisstijl }) {
  const [keuze, setKeuze] = useState(() => leesKeuze() || 'standaard');
  const [eigen, setEigen] = useState(null); // null = nog laden; false = geen eigen huisstijl; anders het object

  useEffect(() => {
    if (!premium) return undefined;

    let weg = false;

    Promise.resolve(laadHuisstijl()).then((h) => {
      if (weg) return;

      setEigen(h || false);

      // Heeft het lid een eigen huisstijl en nog nooit gekozen, dan is dat de vanzelfsprekende keuze.
      if (h && !leesKeuze()) setKeuze('eigen');
    });

    return () => {
      weg = true;
    };
  }, [premium, laadHuisstijl]);

  const bouw = async () => {
    const d = await haalDefinitiefDocument(doc.definitiefId);

    if (!d || !d.inhoud) return null;

    return bouwSamengevoegdModel({ inhoud: d.inhoud, organisatieNaam: orgNaam(store) });
  };

  const gebruikt = premium ? (keuze === 'eigen' && eigen === false ? 'standaard' : keuze) : 'standaard';

  return (
    <span data-testid="samengevoegd-export" style={css('display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;')}>
      {premium ? (
        <label style={css(`display: inline-flex; align-items: center; gap: 6px; ${meldingStijl}`)}>
          Huisstijl
          <select
            data-testid="samengevoegd-huisstijl"
            aria-label="Huisstijl voor dit document"
            value={keuze}
            onChange={(e) => {
              setKeuze(e.target.value);
              bewaarKeuze(e.target.value);
            }}
            style={css("cursor: pointer; box-sizing: border-box; min-height: 34px; padding: 4px 10px; border: 1px solid #D5E0D9; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #2C4A5E;")}
          >
            <option value="standaard">Subsidie Kompas</option>
            <option value="geen">Geen huisstijl</option>
            <option value="eigen">{eigen === false ? 'Mijn huisstijl (nog niet ingesteld)' : 'Mijn huisstijl'}</option>
          </select>
        </label>
      ) : (
        <span data-testid="samengevoegd-huisstijl-vast" title="Bij Pro krijgen uw documenten de Subsidie Kompas-huisstijl. Met Premium kunt u ook zonder huisstijl of in uw eigen huisstijl." style={css(meldingStijl)}>
          Huisstijl: Subsidie Kompas
        </span>
      )}
      {premium && keuze === 'eigen' && eigen === false && (
        <a className="fwk-wp-link" data-testid="samengevoegd-huisstijl-instellen" href="#/kompas/organisatie" style={css('font-size: 12.5px;')}>
          Eigen huisstijl uploaden
        </a>
      )}
      <ExportMenu toegestaan={paid} uitlijnen="rechts" formaten={['docx', 'pdf']} onMelding={onMelding} ariaLabel={`${doc.naam} exporteren`} bouwModel={bouw} huisstijl={gebruikt} />
    </span>
  );
}
