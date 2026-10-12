// Documenten bij één project beheren in het projectdossier (tab Documenten): uploaden, soort wijzigen, verwijderen.
// Elke wijziging wordt direct opgeslagen via store.saveProject (zelfde pad als het voormalige bewerkformulier):
// bestaande documenten blijven staan, nieuwe worden toegevoegd en alleen wat het lid hier expliciet verwijdert, gaat weg.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { DOC_SOORTEN } from '../KompasStore.jsx';
import { selectStijl } from '../../../shared/ui/index.js';

const raadSoort = (naam) => {
  const l = naam.toLowerCase();

  if (l.indexOf('begroting') !== -1) return 'Begroting';
  if (l.indexOf('dekking') !== -1) return 'Concept-dekkingsplan';
  if (l.indexOf('plan') !== -1) return 'Projectplan';

  return 'Overig';
};

const leesbaar = (f) => /^text\/|\.(txt|md|csv)$/i.test(`${f.type} ${f.name}`);

// Tekstbestanden worden uitgelezen zodat de chat de inhoud kan meenemen.
const leesTekst = (f) =>
  new Promise((klaar) => {
    if (!leesbaar(f)) {
      klaar('');

      return;
    }

    const reader = new FileReader();

    reader.onload = () => klaar(String(reader.result || '').slice(0, 4000));
    reader.onerror = () => klaar('');
    reader.readAsText(f);
  });

export function useDocumentenBeheer(project, store) {
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState('');
  const [fout, setFout] = useState('');

  const bewaar = (docs, verwijderdeDocIds, tekst) => {
    setBezig(true);
    setFout('');
    setMelding('');

    return Promise.resolve(store.saveProject({ ...project, docs, verwijderdeDocIds: verwijderdeDocIds || [] })).then((id) => {
      setBezig(false);

      if (id === null) {
        setFout('De wijziging kon niet worden opgeslagen. Probeer het opnieuw.');

        return;
      }

      setMelding(tekst);
    });
  };

  return {
    bezig,
    melding,
    fout,
    uploaden: async (bestanden) => {
      const files = Array.prototype.slice.call(bestanden || []);

      if (!files.length) {
        return;
      }

      const nieuw = await Promise.all(
        files.map(async (f) => ({
          naam: f.name,
          soort: raadSoort(f.name),
          grootte: `${Math.max(1, Math.round(f.size / 1024))} kB`,
          tekst: await leesTekst(f),
        })),
      );

      await bewaar((project.docs || []).concat(nieuw), [], nieuw.length === 1 ? 'Document toegevoegd.' : `${nieuw.length} documenten toegevoegd.`);
    },
    wijzigSoort: (doc, soort) => bewaar((project.docs || []).map((d) => (d === doc || (d.id && d.id === doc.id) ? { ...d, soort } : d)), [], 'Soort document opgeslagen.'),
    verwijder: (doc) =>
      bewaar(
        (project.docs || []).filter((d) => !(d === doc || (d.id && d.id === doc.id))),
        doc.id ? [doc.id] : [],
        'Document verwijderd.',
      ),
  };
}

const UPLOAD_LABEL = `
  cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center;
  padding: 12px 20px; border: 1px solid #D6E3E9; border-radius: 999px; background: #FFFFFF; color: #2C4A5E;
  font-size: 13.5px; font-weight: 800;
`;

export function DocumentSoortKiezer({ doc, beheer }) {
  return (
    <select
      value={doc.soort || 'Overig'}
      disabled={beheer.bezig}
      onChange={(e) => beheer.wijzigSoort(doc, e.target.value)}
      aria-label={`Soort document voor ${doc.naam}`}
      data-testid="detail-document-soort"
      style={{ ...selectStijl, maxWidth: 220 }}
    >
      {(DOC_SOORTEN.indexOf(doc.soort) === -1 && doc.soort ? [doc.soort] : []).concat(DOC_SOORTEN).map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export function DocumentVerwijderKnop({ doc, beheer }) {
  const [vraag, setVraag] = useState(false);
  const stijl = css("cursor: pointer; min-height: 44px; display: inline-flex; align-items: center; padding: 0 8px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700;");

  if (!vraag) {
    return (
      <button type="button" data-testid="detail-document-verwijder" onClick={() => setVraag(true)} style={{ ...stijl, color: '#9E3B2C' }}>
        Verwijderen
      </button>
    );
  }

  return (
    <span data-testid="detail-document-verwijder-bevestig" role="group" aria-label="Verwijderen bevestigen" style={css('display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap;')}>
      <span style={css("font-family: 'Mulish', sans-serif; font-size: 13px; color: #4B5C58;")}>Dit document definitief verwijderen?</span>
      <button type="button" autoFocus data-testid="detail-document-verwijder-ja" disabled={beheer.bezig} onClick={() => { setVraag(false); beheer.verwijder(doc); }} style={{ ...stijl, color: '#9E3B2C', fontWeight: 800 }}>
        Ja, verwijderen
      </button>
      <button type="button" data-testid="detail-document-verwijder-nee" onClick={() => setVraag(false)} style={{ ...stijl, color: '#2C4A5E' }}>
        Annuleren
      </button>
    </span>
  );
}

export function DocumentUploadKnop({ beheer }) {
  return (
    <label style={css(UPLOAD_LABEL)}>
      + Documenten uploaden
      <input
        type="file"
        multiple
        data-testid="detail-document-upload"
        disabled={beheer.bezig}
        onChange={(e) => {
          beheer.uploaden(e.target.files);
          e.target.value = '';
        }}
        style={css('position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden;')}
      />
    </label>
  );
}
