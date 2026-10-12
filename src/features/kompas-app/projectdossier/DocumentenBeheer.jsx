// Documenten bij één project beheren in het projectdossier (tab Documenten): uploaden, soort wijzigen, verwijderen.
// Elke wijziging wordt direct opgeslagen via store.saveProject (zelfde pad als het voormalige bewerkformulier):
// bestaande documenten blijven staan, nieuwe worden toegevoegd en alleen wat het lid hier expliciet verwijdert, gaat weg.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { DOC_SOORTEN } from '../KompasStore.jsx';
import { selectStijl } from '../../../shared/ui/index.js';
import { extraheerTekst } from '../../../data/services/documentExtractie.js';
import { projectBestandLink, uploadProjectBestand, MAX_PROJECT_BESTAND } from '../../../data/services/projecten.js';

const raadSoort = (naam) => {
  const l = naam.toLowerCase();

  if (l.indexOf('begroting') !== -1) return 'Begroting';
  if (l.indexOf('dekking') !== -1) return 'Concept-dekkingsplan';
  if (l.indexOf('plan') !== -1) return 'Projectplan';

  return 'Overig';
};

// Alle ondersteunde bestandstypen (pdf, docx, xlsx, txt, md, csv) worden uitgelezen met dezelfde functie als in de chat
// en het organisatieprofiel, zodat de chat en "Projectgegevens aanvullen" de inhoud kunnen gebruiken (maximaal 20.000 tekens).
const leesTekst = (f) => extraheerTekst(f);

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

      // Eerst het origineel bewaren (zodat het later te openen is), dan de tekst uitlezen voor de chat.
      const nieuw = await Promise.all(
        files.map(async (f) => {
          const [tekst, opslag] = await Promise.all([leesTekst(f), uploadProjectBestand(f)]);

          return {
            naam: f.name,
            soort: raadSoort(f.name),
            grootte: `${Math.max(1, Math.round(f.size / 1024))} kB`,
            tekst,
            pad: opslag.pad || '',
            mime: f.type || '',
            opslagFout: opslag.error || '',
          };
        }),
      );

      // Kon van een bestand geen tekst worden gelezen (scan, afbeelding, niet-ondersteund type) of het origineel niet worden
      // bewaard, dan zeggen we dat meteen.
      const zonderTekst = nieuw.filter((d) => !String(d.tekst || '').trim()).map((d) => d.naam);
      const basis = nieuw.length === 1 ? 'Document toegevoegd.' : `${nieuw.length} documenten toegevoegd.`;
      const nietBewaard = nieuw.filter((d) => d.opslagFout).map((d) => d.naam);
      const teGroot = nieuw.filter((d) => d.opslagFout === 'te-groot').map((d) => d.naam);
      const bewaardWaarschuwing = nietBewaard.length
        ? teGroot.length
          ? ` ${teGroot.join(', ')} is groter dan ${Math.round(MAX_PROJECT_BESTAND / 1048576)} MB: het bestand zelf is niet bewaard en kan hier niet worden geopend.`
          : ` Het originele bestand van ${nietBewaard.join(', ')} kon niet worden bewaard en kan hier niet worden geopend.`
        : '';
      const waarschuwing = zonderTekst.length
        ? ` Let op: uit ${zonderTekst.join(', ')} kon geen tekst worden gelezen (bijvoorbeeld een gescande PDF of afbeelding). Subsidie Kompas kan dit document daarom nog niet gebruiken; upload het als Word-bestand of als PDF met selecteerbare tekst.`
        : '';

      // opslagFout hoort niet in het document zelf
      const teBewaren = nieuw.map(({ opslagFout, ...doc }) => doc);

      await bewaar((project.docs || []).concat(teBewaren), [], basis + bewaardWaarschuwing + waarschuwing);
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

// Opent het originele bestand in een nieuw tabblad. Het tabblad wordt synchroon geopend (anders blokkeert de browser het)
// en daarna naar de tijdelijke, privé-link gestuurd. Geeft true terug als het gelukt is.
export async function openProjectBestand(pad) {
  const venster = window.open('', '_blank');

  try {
    const url = await projectBestandLink(pad);

    if (!url) {
      if (venster) venster.close();

      return false;
    }

    if (venster) {
      venster.opener = null;
      venster.location.href = url;
    } else {
      window.location.href = url;
    }

    return true;
  } catch (e) {
    if (venster) venster.close();

    return false;
  }
}

// Documentnaam als klikbaar: met origineel opent het bestand; zonder origineel (eerder geüpload, alleen tekst bewaard)
// opent de uitgelezen tekst, met uitleg. Zonder beide is het gewoon de naam.
export function DocumentNaam({ doc }) {
  const [fout, setFout] = useState('');
  const [toonTekst, setToonTekst] = useState(false);
  const stijl = css("cursor: pointer; border: none; background: none; padding: 0; text-align: left; font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; font-weight: 800; color: #2C4A5E; text-decoration: underline; text-decoration-color: #A8D5BA; text-underline-offset: 3px; overflow-wrap: anywhere;");
  const hulp = css("font-family: 'Mulish', sans-serif; font-size: 12.5px; line-height: 1.5; color: #7B8985;");
  const tekst = String(doc.tekst || '').trim();

  if (doc.pad) {
    return (
      <>
        <button
          type="button"
          data-testid="detail-document-open"
          onClick={async () => {
            setFout('');

            if (!(await openProjectBestand(doc.pad))) {
              setFout('Het bestand kon niet worden geopend. Probeer het opnieuw.');
            }
          }}
          style={stijl}
        >
          {doc.naam}
        </button>
        {fout && <div role="alert" style={css(`${hulp} color: #9E3B2C; font-weight: 700;`)}>{fout}</div>}
      </>
    );
  }

  if (tekst) {
    return (
      <>
        <button type="button" data-testid="detail-document-open-tekst" aria-expanded={toonTekst} onClick={() => setToonTekst((v) => !v)} style={stijl}>
          {doc.naam}
        </button>
        <div style={css(hulp)}>Het originele bestand is niet bewaard; klik om de uitgelezen tekst te bekijken. Upload het bestand opnieuw om het te kunnen openen.</div>
        {toonTekst && (
          <pre data-testid="detail-document-tekst" style={css("margin: 8px 0 0; max-height: 280px; overflow: auto; padding: 12px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #F7F9F8; white-space: pre-wrap; overflow-wrap: anywhere; font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.55; color: #4B5C58;")}>
            {tekst}
          </pre>
        )}
      </>
    );
  }

  return <span style={{ ...stijl, cursor: 'default', textDecoration: 'none' }}>{doc.naam}</span>;
}

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
