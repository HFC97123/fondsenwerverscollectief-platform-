// Organisatieprofiel › Huisstijl voor uw documenten. Alle documenten die u exporteert (Word, PDF, Excel) hebben een huisstijl:
//   - Pro: de Subsidie Kompas-huisstijl.
//   - Premium: de Subsidie Kompas-huisstijl, of uw eigen: logo, twee kleuren en de naam op het voorblad en in de voettekst.
// Lettertype en marges blijven gelijk, zodat het document op elke computer hetzelfde eruitziet.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { Button } from '../../shared/ui/index.js';
import { SubsidieKompasTheme, normaliseerHuisstijl } from '../../shared/document-theme/index.js';
import { bewaarHuisstijl, haalHuisstijl, verkleinLogo } from '../../data/services/huisstijl.js';
import { HUISSTIJL_BESTAND_ACCEPT, leesHuisstijlUitBestand } from './huisstijlUitDocument.js';

const KOP = "margin: 0 0 4px; font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E;";
const KLEIN = "margin: 0; font-family: 'Mulish', sans-serif; font-size: 13.5px; line-height: 1.55; color: #4B5C58;";
const LABEL = "display: grid; gap: 6px; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #2C4A5E;";
const VELD = "box-sizing: border-box; min-height: 40px; padding: 8px 12px; border: 1px solid #D5E0D9; border-radius: 10px; font-family: 'Mulish', sans-serif; font-size: 14px; color: #2E3A38; background: #FFFFFF;";

const LEEG = { naam: '', primair: SubsidieKompasTheme.colors.primary, accent: SubsidieKompasTheme.colors.accent, logo: '', logoBreedte: 0, logoHoogte: 0 };

// Een klein voorbeeld van een voorblad en een tabelkop in de gekozen huisstijl.
function Voorbeeld({ h, naamTerugval }) {
  const naam = h.naam || naamTerugval;

  return (
    <div data-testid="huisstijl-voorbeeld" aria-label="Voorbeeld van een document" style={css('box-sizing: border-box; width: 100%; max-width: 300px; padding: 18px 18px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF; box-shadow: 0 2px 10px rgba(44,74,94,0.06);')}>
      <div style={css('min-height: 52px; display: flex; align-items: center;')}>
        {h.logo ? <img src={h.logo} alt="" data-testid="huisstijl-voorbeeld-logo" style={{ maxWidth: 160, maxHeight: 48, objectFit: 'contain' }} /> : <span style={css("font-family: 'Mulish', sans-serif; font-size: 12px; color: #9AA6A2;")}>geen logo</span>}
      </div>
      <div style={css(`margin-top: 10px; font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; color: ${h.primair};`)}>Projectplan</div>
      <div style={css(`height: 3px; width: 56px; margin: 6px 0 10px; background: ${h.accent};`)} />
      <div style={css(`padding: 5px 8px; background: ${h.primair}; color: #FFFFFF; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700;`)}>Onderdeel</div>
      <div style={css('padding: 5px 8px; border: 1px solid #D8DEDC; border-top: none; font-family: Arial, sans-serif; font-size: 11px; color: #2E3A38;')}>Aanleiding en doel</div>
      <div style={css('margin-top: 12px; font-family: Arial, sans-serif; font-size: 10px; color: #4B5C58;')}>{naam}</div>
    </div>
  );
}

// compact: dezelfde invoer, maar kleiner en zonder eigen kop, om hem op de plek zelf te tonen (bij het schrijven van het projectplan of bij het samenvoegen).
// onBewaard(huisstijl | null): meldt wat er is bewaard (null = terug naar Subsidie Kompas), zodat de plek ervoor de keuze kan bijwerken.
export default function HuisstijlPaneel({ premium, organisatieNaam = '', laad = haalHuisstijl, bewaar = bewaarHuisstijl, lees = verkleinLogo, uitDocument = leesHuisstijlUitBestand, compact = false, onBewaard = null }) {
  const [h, setH] = useState(LEEG);
  const [eigen, setEigen] = useState(false); // staat er een eigen huisstijl opgeslagen?
  const [geladen, setGeladen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null); // { tekst, fout }
  const bestandRef = useRef(null);
  const documentRef = useRef(null);
  const [gevonden, setGevonden] = useState([]); // kleuren uit het laatst gelezen document

  useEffect(() => {
    if (!premium) return undefined;

    let weg = false;

    Promise.resolve(laad()).then((opgeslagen) => {
      if (weg) return;

      if (opgeslagen) {
        setH({ ...LEEG, ...opgeslagen });
        setEigen(true);
      }

      setGeladen(true);
    });

    return () => {
      weg = true;
    };
  }, [premium, laad]);

  const zet = (v) => {
    setH((cur) => ({ ...cur, ...v }));
    setMelding(null);
  };

  const kiesLogo = async (e) => {
    const f = e.target.files && e.target.files[0];

    e.target.value = '';

    if (!f) return;

    setBezig(true);

    const r = await lees(f);

    setBezig(false);

    if (r.fout) setMelding({ tekst: r.fout, fout: true });
    else zet({ logo: r.logo, logoBreedte: r.logoBreedte, logoHoogte: r.logoHoogte });
  };

  const kiesDocument = async (e) => {
    const f = e.target.files && e.target.files[0];

    e.target.value = '';

    if (!f) return;

    setBezig(true);
    setMelding(null);

    const r = await uitDocument(f);

    setBezig(false);

    if (r.fout) {
      setMelding({ tekst: r.fout, fout: true });

      return;
    }

    setGevonden(r.kleuren);
    setH((cur) => ({
      ...cur,
      ...(r.logo ? { logo: r.logo.logo, logoBreedte: r.logo.logoBreedte, logoHoogte: r.logo.logoHoogte } : {}),
      ...(r.kleuren[0] ? { primair: r.kleuren[0] } : {}),
      ...(r.kleuren[1] ? { accent: r.kleuren[1] } : {}),
    }));
    setMelding({ tekst: `Gevonden: ${[r.logo ? 'logo' : '', r.kleuren.length ? `${r.kleuren.length} ${r.kleuren.length === 1 ? 'kleur' : 'kleuren'}` : ''].filter(Boolean).join(' en ')}. Controleer en bewaar.`, fout: false });
  };

  const opslaan = async () => {
    const schoon = normaliseerHuisstijl(h);
    // Zonder logo, naam of andere kleuren is het gewoon de Subsidie Kompas-huisstijl: daar hoeft niets voor bewaard te worden.
    const standaard = !h.logo && !h.naam.trim() && h.primair.toUpperCase() === LEEG.primair.toUpperCase() && h.accent.toUpperCase() === LEEG.accent.toUpperCase();

    if (!schoon || standaard) {
      setMelding({ tekst: 'Kies een logo, een naam of een kleur.', fout: true });

      return;
    }

    setBezig(true);

    const r = await bewaar(schoon);

    setBezig(false);

    if (r.ok) {
      setH({ ...LEEG, ...r.huisstijl });
      setEigen(true);
      setMelding({ tekst: 'Uw huisstijl is bewaard. Uw volgende exports gebruiken hem.', fout: false });

      if (onBewaard) onBewaard(r.huisstijl);
    } else {
      setMelding({ tekst: 'Bewaren lukte niet. Probeer het opnieuw.', fout: true });
    }
  };

  const terug = async () => {
    setBezig(true);

    const r = await bewaar(null);

    setBezig(false);

    if (r.ok) {
      setH(LEEG);
      setEigen(false);
      setMelding({ tekst: 'Uw documenten hebben weer de Subsidie Kompas-huisstijl.', fout: false });

      if (onBewaard) onBewaard(null);
    } else {
      setMelding({ tekst: 'Terugzetten lukte niet. Probeer het opnieuw.', fout: true });
    }
  };

  return (
    <section data-testid="huisstijl" style={css(compact ? 'margin-top: 10px; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FBFDFC;' : 'margin-top: 28px; padding-top: 22px; border-top: 1px solid #E1EAE4;')}>
      <h2 style={css(compact ? KOP.replace('20px', '16px') : KOP)}>{compact ? 'Uw eigen huisstijl' : 'Huisstijl voor uw documenten'}</h2>

      {!premium && (
        <div data-testid="huisstijl-pro">
          <p style={css(KLEIN)}>Uw documenten (Word, PDF en Excel) hebben de Subsidie Kompas-huisstijl. Met Premium zet u er uw eigen logo en kleuren op.</p>
          <div style={css('margin-top: 10px;')}>
            <a className="fwk-wp-link" href="#/kompas/account" data-testid="huisstijl-premium-link">
              Bekijk Premium
            </a>
          </div>
        </div>
      )}

      {premium && (
        <div data-testid="huisstijl-premium">
          <p style={css(KLEIN)}>
            {eigen ? 'Uw documenten hebben uw eigen huisstijl.' : 'Uw documenten hebben nu de Subsidie Kompas-huisstijl. Voeg uw eigen logo en kleuren toe, dan gebruiken uw exports die.'}
          </p>

          <div style={css('display: flex; flex-wrap: wrap; gap: 22px; margin-top: 16px; align-items: flex-start;')}>
            <div style={css('flex: 1 1 300px; display: grid; gap: 14px; min-width: 0;')}>
              <div style={css('display: grid; gap: 6px;')}>
                <span style={css(LABEL)}>Uit een document halen</span>
                <div style={css('display: flex; flex-wrap: wrap; gap: 10px; align-items: center;')}>
                  <input ref={documentRef} type="file" accept={HUISSTIJL_BESTAND_ACCEPT} data-testid="huisstijl-document" onChange={kiesDocument} style={css('display: none;')} />
                  <Button variant="outline" onClick={() => documentRef.current && documentRef.current.click()} disabled={bezig || !geladen} testid="huisstijl-document-kies">
                    {bezig ? 'Bezig…' : 'Document uploaden'}
                  </Button>
                  <span style={css(KLEIN)}>Word, Excel, PDF of afbeelding</span>
                </div>
                {gevonden.length > 0 && (
                  <div data-testid="huisstijl-gevonden" style={css('display: flex; flex-wrap: wrap; gap: 8px; align-items: center;')}>
                    <span style={css(KLEIN)}>Gevonden kleuren, klik voor hoofdkleur:</span>
                    {gevonden.map((k) => (
                      <button key={k} type="button" data-testid="huisstijl-gevonden-kleur" title={k} aria-label={`Hoofdkleur ${k}`} onClick={() => zet({ primair: k })} style={css(`cursor: pointer; width: 28px; height: 28px; border-radius: 8px; border: 2px solid ${h.primair === k ? '#2C4A5E' : '#D5E0D9'}; background: ${k};`)} />
                    ))}
                  </div>
                )}
              </div>

              <div style={css('display: grid; gap: 6px;')}>
                <span style={css(LABEL)}>Logo</span>
                <div style={css('display: flex; flex-wrap: wrap; gap: 10px; align-items: center;')}>
                  <input ref={bestandRef} type="file" accept="image/png,image/jpeg" data-testid="huisstijl-bestand" onChange={kiesLogo} style={css('display: none;')} />
                  <Button variant="outline" onClick={() => bestandRef.current && bestandRef.current.click()} disabled={bezig || !geladen} testid="huisstijl-logo-kies">
                    {h.logo ? 'Ander logo kiezen' : 'Logo uploaden'}
                  </Button>
                  {h.logo && (
                    <button type="button" className="fwk-wp-link" data-testid="huisstijl-logo-weg" onClick={() => zet({ logo: '', logoBreedte: 0, logoHoogte: 0 })}>
                      Logo weghalen
                    </button>
                  )}
                  <span style={css(KLEIN)}>PNG of JPG</span>
                </div>
              </div>

              <label style={css(LABEL)}>
                Naam op het voorblad en in de voettekst
                <input type="text" data-testid="huisstijl-naam" value={h.naam} maxLength={80} placeholder={organisatieNaam || 'Stichting Voorbeeld'} onChange={(e) => zet({ naam: e.target.value })} style={css(VELD)} />
              </label>

              <div style={css('display: flex; flex-wrap: wrap; gap: 16px;')}>
                <label style={css(LABEL)}>
                  Hoofdkleur (titels en tabelkoppen)
                  <input type="color" data-testid="huisstijl-primair" value={h.primair} onChange={(e) => zet({ primair: e.target.value.toUpperCase() })} style={css('width: 72px; height: 40px; padding: 2px; border: 1px solid #D5E0D9; border-radius: 10px; background: #FFFFFF; cursor: pointer;')} />
                </label>
                <label style={css(LABEL)}>
                  Accentkleur (lijnen en accenten)
                  <input type="color" data-testid="huisstijl-accent" value={h.accent} onChange={(e) => zet({ accent: e.target.value.toUpperCase() })} style={css('width: 72px; height: 40px; padding: 2px; border: 1px solid #D5E0D9; border-radius: 10px; background: #FFFFFF; cursor: pointer;')} />
                </label>
              </div>

              <p style={css(KLEIN)}>Het lettertype en de marges blijven gelijk, zodat uw document op elke computer hetzelfde eruitziet.</p>

              <div style={css('display: flex; flex-wrap: wrap; gap: 10px; align-items: center;')}>
                <Button variant="dark" onClick={opslaan} disabled={bezig || !geladen} testid="huisstijl-bewaar">
                  Huisstijl bewaren
                </Button>
                {eigen && (
                  <Button variant="outline" onClick={terug} disabled={bezig} testid="huisstijl-terug">
                    Terug naar Subsidie Kompas-huisstijl
                  </Button>
                )}
              </div>

              {melding && (
                <div role={melding.fout ? 'alert' : 'status'} data-testid="huisstijl-melding" style={css(`font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700; color: ${melding.fout ? '#9E3B2C' : '#2F6D47'};`)}>
                  {melding.tekst}
                </div>
              )}
            </div>

            <Voorbeeld h={h} naamTerugval={organisatieNaam || SubsidieKompasTheme.branding.organizationName} />
          </div>
        </div>
      )}
    </section>
  );
}
