// "Projectdossier uit een document": het lid kiest een Word-, PDF-, Excel- of tekstbestand; de browser leest de tekst, en op verzoek (knop, nooit
// automatisch) stelt Claude per onderdeel van het projectdossier een tekst voor, uitsluitend uit het document. Het lid kiest zelf wat overgenomen wordt.
// - Een onderdeel dat nog leeg is staat voorgevinkt; een onderdeel met eigen tekst nooit: daar staat de huidige tekst naast het voorstel en een duidelijke
//   waarschuwing dat overnemen die tekst vervangt.
// - Overnemen vult alleen het formulier; bewaren gaat met "Projectdocumentatie opslaan", met herkomst "uit een document".
import React, { useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { extraheerTekst } from '../../../data/services/documentExtractie.js';
import { haalDossierVoorstellen } from '../../../data/services/dossierUitlezen.js';
import { PI_VELDEN } from './projectinformatie.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;";
const KLEIN = 'font-size: 13px; line-height: 1.5; font-weight: 600; color: #7B8985;';
export const MAX_DOSSIER_BYTES = 10 * 1024 * 1024;
export const MAX_DOSSIER_TEKENS = 60000;
const BESTANDSTYPEN = '.docx,.pdf,.xlsx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain';
const TOEGESTAAN = /\.(docx|pdf|xlsx|txt|md|csv)$/i;

export const MELDINGEN = {
  daglimiet: 'Claude heeft vandaag al veel documenten gelezen. Morgen kan het weer; uw formulier blijft zoals het is.',
  storing: 'Claude kan het document nu even niet lezen. Er is niets gewijzigd; probeer het straks opnieuw.',
  'te-weinig-tekst': 'In dit document staat te weinig tekst om het projectdossier uit in te vullen.',
  'niets-gevonden': 'Claude vond in dit document geen onderdelen die het met zekerheid kan overnemen. Er is niets gewijzigd.',
  'alleen-pro': 'Een projectdossier laten invullen uit een document is er met Pro en Premium.',
  'geen-tekst': 'In dit bestand is geen tekst gevonden. Dat gebeurt bij een gescande PDF (een foto van papier) of een beveiligd bestand. Upload het opnieuw als Word-bestand, of als PDF waarin u tekst kunt selecteren.',
  type: 'Dit bestandstype kan niet worden gelezen. Kies een Word-bestand (.docx), PDF, Excel-bestand (.xlsx) of tekstbestand.',
  groot: 'Dit bestand is te groot (maximaal 10 MB). Sla het op zonder afbeeldingen, of upload alleen de pagina’s met het projectplan.',
};

const labelVan = (key) => (PI_VELDEN.find((v) => v.key === key) || {}).label || key;
const kort = (t, n = 220) => (String(t).length > n ? `${String(t).slice(0, n).trim()}…` : String(t));

// waarden: de huidige tekst per sleutel in het formulier; onNeem(key, tekst): zet het voorstel in het formulier.
export default function DossierUitDocument({ waarden, onNeem, lees = extraheerTekst, denk = haalDossierVoorstellen }) {
  const invoer = useRef(null);
  const [fase, setFase] = useState('rust'); // rust | lezen | denken | klaar | melding
  const [bestand, setBestand] = useState('');
  const [melding, setMelding] = useState('');
  const [afgekapt, setAfgekapt] = useState(false);
  const [voorstellen, setVoorstellen] = useState([]);
  const [keuze, setKeuze] = useState({}); // key -> boolean
  const [genomen, setGenomen] = useState(0);

  const huidig = (key) => String((waarden && waarden[key]) || '').trim();

  const kies = async (f) => {
    setMelding('');
    setVoorstellen([]);
    setGenomen(0);
    setAfgekapt(false);

    if (!f) return;

    if (!TOEGESTAAN.test(String(f.name || ''))) {
      setMelding(MELDINGEN.type);
      setFase('melding');

      return;
    }

    if (f.size > MAX_DOSSIER_BYTES) {
      setMelding(MELDINGEN.groot);
      setFase('melding');

      return;
    }

    setBestand(f.name);
    setFase('lezen');

    // Eén tekens meer dan de grens, zodat we weten of het document is afgekapt.
    const tekst = String((await lees(f, MAX_DOSSIER_TEKENS + 1)) || '').trim();

    if (!tekst) {
      setMelding(MELDINGEN['geen-tekst']);
      setFase('melding');

      return;
    }

    setAfgekapt(tekst.length > MAX_DOSSIER_TEKENS);
    setFase('denken');

    const gevuld = PI_VELDEN.map((v) => v.key).filter((k) => huidig(k));
    const antwoord = await denk({ tekst: tekst.slice(0, MAX_DOSSIER_TEKENS), huidig: gevuld });

    if (!antwoord.beschikbaar || !antwoord.voorstellen.length) {
      setMelding(MELDINGEN[antwoord.reden] || MELDINGEN['niets-gevonden']);
      setFase('melding');

      return;
    }

    const start = {};

    antwoord.voorstellen.forEach((v) => {
      start[v.key] = !huidig(v.key); // alleen lege onderdelen staan voorgevinkt
    });

    setKeuze(start);
    setVoorstellen(antwoord.voorstellen);
    setFase('klaar');
  };

  const aantalGekozen = voorstellen.filter((v) => keuze[v.key]).length;

  const neemOver = () => {
    let n = 0;

    voorstellen.forEach((v) => {
      if (keuze[v.key]) {
        onNeem(v.key, v.tekst);
        n += 1;
      }
    });

    setGenomen(n);
    setVoorstellen([]);
    setFase('rust');
    setBestand('');
  };

  const sluit = () => {
    setVoorstellen([]);
    setFase('rust');
    setBestand('');
    setMelding('');
  };

  const bezig = fase === 'lezen' || fase === 'denken';

  return (
    <section data-testid="dossier-uit-document" style={css('box-sizing: border-box; margin: 0 0 22px; padding: 18px 20px; border: 1px solid #D5E0D9; border-radius: 16px; background: #F7FAF8;')}>
      <h3 style={css(`${LABEL} margin: 0 0 6px;`)}>Projectdossier uit een document</h3>
      <p style={css(`${TEKST} margin: 0 0 12px; max-width: 680px;`)}>
        Heeft u al een projectplan of aanvraag? Kies het bestand (Word, PDF of Excel). Claude leest het en stelt per onderdeel een tekst voor, alleen uit wat erin staat. U kiest zelf wat u overneemt.
      </p>

      <input
        ref={invoer}
        type="file"
        accept={BESTANDSTYPEN}
        data-testid="dossier-bestand"
        aria-label="Document met het projectplan"
        style={css('position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;')}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];

          e.target.value = '';
          kies(f);
        }}
      />

      {fase !== 'klaar' && (
        <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;')}>
          <Button type="button" variant="outline" size="s" disabled={bezig} onClick={() => invoer.current && invoer.current.click()}>
            Document kiezen
          </Button>
          {fase === 'lezen' && <span role="status" style={css(KLEIN)}>{bestand} wordt gelezen…</span>}
          {fase === 'denken' && <span role="status" data-testid="dossier-bezig" style={css(KLEIN)}>Claude leest {bestand} en zoekt de onderdelen. Dit duurt even.</span>}
          {genomen > 0 && fase === 'rust' && (
            <span role="status" data-testid="dossier-genomen" style={css('font-size: 14px; font-weight: 700; color: #4E9A6C;')}>
              {genomen} {genomen === 1 ? 'onderdeel' : 'onderdelen'} overgenomen. Controleer ze hieronder en kies Projectdocumentatie opslaan.
            </span>
          )}
        </div>
      )}

      {fase === 'melding' && (
        <div role="alert" data-testid="dossier-melding" style={css('margin-top: 12px; padding: 12px 16px; border: 1px solid #E9C46A; border-radius: 12px; background: #FFF9EA; font-size: 14px; font-weight: 700; color: #7A5B10;')}>
          {melding}
        </div>
      )}

      {fase === 'klaar' && (
        <div data-testid="dossier-voorstellen">
          <p style={css(`${TEKST} margin: 0 0 12px; font-weight: 700;`)}>
            Claude vond {voorstellen.length} {voorstellen.length === 1 ? 'onderdeel' : 'onderdelen'} in {bestand}. Vink aan wat u wilt overnemen.
          </p>
          {afgekapt && (
            <p data-testid="dossier-afgekapt" style={css(`${KLEIN} margin: 0 0 12px;`)}>
              Het document is erg lang; Claude heeft het begin gelezen. Is er meer, upload dan de rest apart.
            </p>
          )}

          <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;')}>
            {voorstellen.map((v) => {
              const bestaand = huidig(v.key);

              return (
                <li key={v.key} data-testid={`dossier-voorstel-${v.key}`} style={css('box-sizing: border-box; padding: 12px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF;')}>
                  <label style={css('display: flex; gap: 10px; align-items: flex-start; cursor: pointer;')}>
                    <input type="checkbox" data-testid={`dossier-kies-${v.key}`} checked={Boolean(keuze[v.key])} onChange={(e) => setKeuze((cur) => ({ ...cur, [v.key]: e.target.checked }))} style={css('margin-top: 4px;')} />
                    <span style={css('min-width: 0;')}>
                      <b style={css('font-size: 14.5px; color: #2C4A5E;')}>{labelVan(v.key)}</b>
                      <span style={css(`${TEKST} display: block; white-space: pre-wrap;`)}>{v.tekst}</span>
                      <span style={css(`${KLEIN} display: block; margin-top: 4px;`)}>Uit het document: “{kort(v.bewijs, 160)}”</span>
                      {bestaand && (
                        <span data-testid={`dossier-vervangt-${v.key}`} style={css('display: block; margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #FFF9EA; font-size: 13px; font-weight: 700; color: #7A5B10;')}>
                          Dit onderdeel heeft u al ingevuld. Overnemen vervangt uw tekst: “{kort(bestaand)}”
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div style={css('display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px;')}>
            <Button type="button" testid="dossier-neem-over" disabled={!aantalGekozen} onClick={neemOver}>
              {aantalGekozen ? `${aantalGekozen} ${aantalGekozen === 1 ? 'onderdeel' : 'onderdelen'} overnemen` : 'Kies eerst een onderdeel'}
            </Button>
            <Button type="button" variant="outline" onClick={sluit}>
              Niets overnemen
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
