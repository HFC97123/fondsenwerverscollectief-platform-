// Documenten › Begroting: de projectbegroting, schoon en leeg om mee te beginnen. Het lid voegt zelf een kopje (tussenregel) toe en daaronder
// regels: omschrijving en bedrag, eventueel met aantal x tarief. Daaronder staat het dekkingsplan: toegekend,
// uitstaand en in planning, het totaal (dat gelijk moet zijn aan de begroting) en wat nog te dekken is. Het totaal van de kosten wordt de
// projectbegroting (project.begroting), waarmee de rest van Subsidie Kompas al rekent. Bedragen verzint niemand: een lege regel telt niet mee.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { color } from '../../../shared/tokens.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding } from '../../../shared/ui/werkplek.jsx';
import { AanvraagStijl, ProjectKeuze } from '../aanvraag/Bouwstenen.jsx';
import { dekkingVanProject, formatEuro } from '../financiering/dekkingsplan.js';
import { KLEUR, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { haalFinancieringVoorExport } from '../financiering/exportFinanciering.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { chatStartHref } from '../chat/gesprekUrl.js';
import { leesBegrotingUpload } from '../../../data/services/aanvraagAssistent.js';
import { leesBegrotingBestand } from './begrotingBestand.js';
import { valideerEnBereidOp } from '../projectOpslaan.js';
import { CATEGORIEEN, GEEN_KOPJE, berekenBegroting, categorieLabel, eigenKopjeSleutel, expenseLinesVoorExcel, kopjeDef, kopjeSlug, kopjeVolgorde, leesBudgetRegels, nieuweRegel, regelBedrag, regelHerkomst, regelsVoorOpslag, samenvoegVoorstel, schuifKopje, schuifRegel, verplaatsKopje, verplaatsRegel, verwijderKopje, voorstelNaarRegels } from './begrotingModel.js';

const euro = (n) => `€ ${Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function BegrotingStijl() {
  return (
    <style>{`
.fwk-bg-rij { display: grid; grid-template-columns: 18px minmax(0, 1fr) 132px auto; gap: 8px; align-items: center; margin: 0 0 8px; }
.fwk-bg-greep { cursor: grab; text-align: center; font-size: 15px; line-height: 1; color: ${color.tekstLicht}; user-select: none; }
.fwk-bg-greep:active { cursor: grabbing; }
.fwk-bg-blok[data-sleep="ja"] { opacity: 0.45; }
.fwk-bg-blok[data-over="voor"] { box-shadow: 0 -2px 0 0 ${color.groen}; }
.fwk-bg-blok[data-over="na"] { box-shadow: 0 2px 0 0 ${color.groen}; }
.fwk-bg-sec[data-over="voor"] { box-shadow: 0 -3px 0 0 ${color.groen}; }
.fwk-bg-sec[data-over="na"] { box-shadow: 0 3px 0 0 ${color.groen}; }
.fwk-bg-sec[data-sleep="ja"] { opacity: 0.5; }
.fwk-bg-sec[data-doel="ja"] { box-shadow: inset 0 0 0 2px ${color.groen}; border-radius: 12px; }
.fwk-bg-sec { margin: 0 0 22px; }
.fwk-bg-kophoofd { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 10px; padding: 8px 12px; border-radius: 12px; background: #E8F0EC; border-left: 4px solid ${color.groen}; }
.fwk-bg-kophoofd h3 { font-size: 17px; }
.fwk-bg-sec[data-kop="ja"] > .fwk-bg-blok, .fwk-bg-sec[data-kop="ja"] > .fwk-bg-lijn, .fwk-bg-sec[data-kop="ja"] > .fwk-bg-chips { margin-left: 14px; padding-left: 12px; border-left: 2px solid #D5E3DB; }
.fwk-bg-kopkant { display: flex; align-items: center; gap: 4px; min-width: 0; position: relative; }
.fwk-bg-schuif { display: inline-flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.fwk-bg-kophoofd:hover .fwk-bg-schuif, .fwk-bg-kophoofd:focus-within .fwk-bg-schuif { opacity: 1; }
@media (hover: none) { .fwk-bg-schuif { opacity: 1; } }
.fwk-bg-wrap { position: relative; display: inline-flex; align-items: center; gap: 2px; }
.fwk-bg-eigen { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 4px 0 6px; }
.fwk-bg-eigen .fwk-bg-veld { width: 240px; max-width: 100%; }
.fwk-bg-info { cursor: pointer; border: none; background: none; width: 26px; height: 26px; border-radius: 999px; font-size: 15px; line-height: 1; color: ${color.tekstLicht}; }
.fwk-bg-info:hover, .fwk-bg-info[aria-expanded="true"] { color: ${color.groen}; }
.fwk-bg-tip { position: absolute; z-index: 20; top: 100%; left: 0; margin-top: 6px; width: 300px; max-width: 78vw; box-sizing: border-box; padding: 10px 14px 10px 12px; border: 1px solid ${color.lijn}; border-radius: 12px; background: ${color.wit}; box-shadow: 0 8px 24px rgba(44,74,94,0.14); font-size: 13.5px; line-height: 1.5; font-weight: 600; color: ${color.tekst}; text-align: left; }
.fwk-bg-tip ul { margin: 0; padding-left: 18px; }
.fwk-bg-tip li + li { margin-top: 4px; }
.fwk-bg-schat { cursor: pointer; border: 1px solid #E8C98A; background: #FFF6E3; color: #8A5A00; border-radius: 999px; padding: 3px 9px; font-family: inherit; font-size: 11.5px; font-weight: 800; }
.fwk-bg-schat:hover { background: #FFEFC9; }
.fwk-bg-balk { box-sizing: border-box; border: 1px solid ${color.lijn}; border-radius: 16px; background: ${color.vlakGrijs}; padding: 16px 20px 14px; margin-bottom: 18px; }
.fwk-bg-balk-kop { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; font-size: 15px; font-weight: 800; color: ${color.donkerblauw}; }
.fwk-bg-balk-leg { display: flex; flex-wrap: wrap; gap: 6px 22px; margin-top: 10px; font-size: 14px; color: ${color.tekst}; }
.fwk-bg-balk-leg span { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.fwk-bg-balk-leg i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 1px solid #CFDDD5; }
.fwk-bg-kopjesbalk { position: sticky; top: 8px; z-index: 6; margin: 6px 0 10px; padding: 8px 0 4px; background: ${color.wit}; }
.fwk-bg-kopjes-label { margin-bottom: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.04em; color: ${color.tekstLicht}; }
.fwk-bg-klaar { display: flex; justify-content: flex-end; margin: 12px 0 0; }
.fwk-bg-volgende { cursor: pointer; border: 1px solid ${color.groen}; background: ${color.wit}; color: ${color.groen}; border-radius: 999px; padding: 8px 18px; font-family: inherit; font-size: 13.5px; font-weight: 800; }
.fwk-bg-volgende:hover { background: ${color.vlakGroen}; }
.fwk-bg-volgendekeuze { margin: 14px 0 0; padding: 12px 14px; border-radius: 12px; background: #F3F8F5; border: 1px dashed #CFDDD5; }
.fwk-bg-chip-plus { padding-left: 14px; padding-right: 14px; font-size: 16px; line-height: 1; }
.fwk-bg-bedragcel { position: relative; min-width: 0; }
.fwk-bg-stip { position: absolute; z-index: 2; left: 2px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; padding: 0; border: none; background: none; cursor: pointer; border-radius: 999px; }
.fwk-bg-stip::before { content: ''; position: absolute; left: 6px; top: 6px; width: 8px; height: 8px; border-radius: 999px; background: #7C9BB0; }
.fwk-bg-stip[data-schatting="ja"]::before { background: #D9A441; }
.fwk-bg-stip:hover::before, .fwk-bg-stip:focus-visible::before { background: ${color.groen}; }
.fwk-bg-herkomst { position: absolute; z-index: 20; top: 100%; right: 0; margin-top: 6px; width: 290px; max-width: 78vw; box-sizing: border-box; padding: 10px 14px; border: 1px solid ${color.lijn}; border-radius: 12px; background: ${color.wit}; box-shadow: 0 8px 24px rgba(44,74,94,0.14); font-size: 13px; line-height: 1.45; color: ${color.tekst}; text-align: left; }
.fwk-bg-herkomst dl { margin: 0; display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 6px 10px; }
.fwk-bg-herkomst dt { font-weight: 800; color: ${color.tekstLicht}; }
.fwk-bg-herkomst dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.fwk-bg-sub { text-align: right; font-weight: 800; color: ${color.donkerblauw}; font-size: 15px; white-space: nowrap; padding-right: 4px; }
.fwk-bg-veld { width: 100%; box-sizing: border-box; min-height: 40px; padding: 8px 10px; border: 1px solid ${color.lijnInput}; border-radius: 10px; background: ${color.wit}; font-family: inherit; font-size: 14.5px; color: ${color.tekst}; }
.fwk-bg-veld:focus { outline: 2px solid ${color.groen}; outline-offset: 1px; }
.fwk-bg-acties { display: flex; gap: 4px; align-items: center; }
.fwk-bg-icoon { cursor: pointer; width: 32px; height: 32px; border: none; background: none; border-radius: 999px; font-size: 16px; line-height: 1; color: ${color.tekstLicht}; }
.fwk-bg-icoon:hover { background: ${color.vlakGrijs}; color: ${color.donkerblauw}; }
.fwk-bg-detail { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: flex-end; margin: -2px 0 10px; padding: 8px 10px; border-radius: 10px; background: ${color.vlakGrijs}; }
.fwk-bg-detail label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: ${color.tekstLicht}; }
.fwk-bg-detail .fwk-bg-veld { width: 110px; min-height: 36px; }
.fwk-bg-plus { cursor: pointer; border: none; background: none; padding: 2px 8px; font-family: inherit; font-size: 22px; line-height: 1; font-weight: 600; color: ${color.groen}; border-radius: 999px; }
.fwk-bg-plus:hover { background: ${color.vlakGrijs}; }
.fwk-bg-lijn { display: flex; align-items: center; gap: 10px; margin: 2px 0 0; }
.fwk-bg-lijn::after { content: ''; flex: 1; height: 1px; background: ${color.lijn}; }
.fwk-bg-chip { cursor: pointer; border: 1px dashed ${color.lijnInput}; background: ${color.wit}; border-radius: 999px; padding: 5px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: ${color.donkerblauw}; }
.fwk-bg-chip:hover { border-color: ${color.groen}; }
.fwk-bg-chipgroep { display: inline-flex; align-items: center; border: 1px dashed ${color.lijnInput}; background: ${color.wit}; border-radius: 999px; }
.fwk-bg-chipgroep:hover { border-color: ${color.groen}; }
.fwk-bg-chipgroep .fwk-bg-chip { border: none; background: none; padding-right: 6px; }
.fwk-bg-chipx { cursor: pointer; border: none; background: none; padding: 5px 10px 5px 2px; font-size: 12px; line-height: 1; color: ${color.tekstLicht}; border-radius: 999px; }
.fwk-bg-chipx:hover { color: ${color.donkerblauw}; }
.fwk-bg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 6px; }
@media (max-width: 560px) { .fwk-bg-rij { grid-template-columns: 14px minmax(0, 1fr) 104px auto; } }
`}</style>
  );
}

// Toelichting bij een kopje: een paar bullets bij overheen gaan (muis), focus of klikken op ⓘ; Escape sluit.
function Toelichting({ kopje, children, knop = true }) {
  const [hover, setHover] = useState(false);
  const [vast, setVast] = useState(false);
  const open = (hover || vast) && kopje.toelichting.length > 0;

  if (kopje.toelichting.length === 0) return <span className="fwk-bg-wrap">{children}</span>;

  return (
    <span
      className="fwk-bg-wrap"
      data-testid={`bg-toelichting-${kopjeSlug(kopje.id)}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setHover(false);
          setVast(false);
        }
      }}
    >
      {children}
      {knop && (
        <button type="button" className="fwk-bg-info" aria-label={`Toelichting bij ${kopje.label}`} aria-expanded={open} data-testid={`bg-info-${kopjeSlug(kopje.id)}`} onClick={() => setVast((v) => !v)}>
          ⓘ
        </button>
      )}
      {open && (
        <div className="fwk-bg-tip" role="tooltip" data-testid={`bg-tip-${kopjeSlug(kopje.id)}`}>
          <ul>
            {kopje.toelichting.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}

// De dekking van de begroting als balk bovenaan: toegekend, eigen bijdrage, uitstaand en in planning, en wat er nog te dekken is (of te veel gedekt).
// Rekent met dezelfde dekkingsmodule als het Dekkingsplan hieronder en volgt de regels die nu op het scherm staan.
function DekkingBalk({ dek, projectNaam }) {
  if (!dek.heeftBegroting) return null;

  const delen = [
    [dek.toegekend, 'toegekend', KLEUR.toegekend, 'toegekend'],
    [dek.overige, 'eigen bijdrage', KLEUR.overige, 'eigen'],
    [dek.aangevraagd, 'uitstaand', KLEUR.aangevraagd, 'uitstaand'],
    [dek.gepland, 'in planning', KLEUR.gepland, 'planning'],
  ].filter(([n]) => n > 0);

  return (
    <div className="fwk-bg-balk" data-testid="bg-balk">
      <div className="fwk-bg-balk-kop">
        <span>Dekking van de begroting</span>
        <span data-testid="bg-balk-begroting">{euro(dek.begroting)}</span>
      </div>
      <Voortgangsbalk dekking={dek} projectNaam={projectNaam || 'dit project'} hoogte={10} metPlan />
      <div className="fwk-bg-balk-leg">
        {delen.map(([n, naam, kleur, sleutel]) => (
          <span key={sleutel} data-testid={`bg-balk-${sleutel}`}>
            <i style={{ background: kleur }} />
            {euro(n)} {naam}
          </span>
        ))}
        {dek.overgedekt > 0 ? (
          <span data-testid="bg-balk-over">
            <i style={{ background: '#E9EFEB' }} />
            {euro(dek.overgedekt)} overdekking
          </span>
        ) : dek.nogTePlannen > 0 ? (
          <span data-testid="bg-balk-nog">
            <i style={{ background: '#E9EFEB' }} />
            {euro(dek.nogTePlannen)} nog te dekken
          </span>
        ) : (
          <span data-testid="bg-balk-sluitend">
            <i style={{ background: '#E9EFEB' }} />
            volledig gedekt
          </span>
        )}
      </div>
    </div>
  );
}

// Het bedrag van een regel met, als er iets over de herkomst te zeggen valt (upload, chat, schatting, toelichting), een klein stipje.
// Met de muis erover (of focus op het stipje, of tikken) komt een pop-up met de herkomst in vaste rijen; Escape sluit.
function BedragCel({ herkomst, children }) {
  const [hover, setHover] = useState(false);
  const [vast, setVast] = useState(false);

  if (!herkomst.heeft) return <div className="fwk-bg-bedragcel">{children}</div>;

  const open = hover || vast;

  return (
    <div
      className="fwk-bg-bedragcel"
      data-testid="bg-bedragcel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setHover(false);
          setVast(false);
        }
      }}
    >
      {children}
      <button
        type="button"
        className="fwk-bg-stip"
        data-testid="bg-herkomst-stip"
        data-schatting={herkomst.schatting ? 'ja' : undefined}
        aria-label="Waar komt dit bedrag vandaan?"
        aria-expanded={open}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => setVast((v) => !v)}
      />
      {open && (
        <div className="fwk-bg-herkomst" role="tooltip" data-testid="bg-herkomst">
          <dl>
            {herkomst.rijen.map((x) => (
              <React.Fragment key={x.label}>
                <dt>{x.label}</dt>
                <dd>{x.waarde}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function Regel({ r, focus, onVolgende, sleep, over, onWijzig, onWeg, onSleepStart, onSleepEinde, onSleepOver, onDrop, onSchuif, kanOmhoog, kanOmlaag }) {
  const b = regelBedrag(r);
  const berekend = b.bron === 'berekend';
  const herkomst = regelHerkomst(r);
  const [meer, setMeer] = useState(false); // aantal, tarief en eenheid staan achter ⋯, zodat de regel zelf schoon blijft

  return (
    <div data-testid="bg-regel" className="fwk-bg-blok" data-sleep={sleep ? 'ja' : undefined} data-over={over || undefined} onDragOver={onSleepOver} onDrop={onDrop}>
      <div className="fwk-bg-rij">
        <span className="fwk-bg-greep" data-testid="bg-greep" draggable aria-hidden="true" title="Verslepen" onDragStart={onSleepStart} onDragEnd={onSleepEinde}>
          ⠿
        </span>
        <input className="fwk-bg-veld" aria-label="Omschrijving" data-testid="bg-omschrijving" value={r.omschrijving} maxLength={200} autoFocus={focus === 'omschrijving'} onChange={(e) => onWijzig({ omschrijving: e.target.value })} placeholder="Omschrijving" />
        <BedragCel herkomst={herkomst}>
          {berekend ? (
            <div className="fwk-bg-sub" data-testid="bg-bedrag-berekend">
              {euro(b.bedrag)}
            </div>
          ) : (
            <input className="fwk-bg-veld" aria-label="Bedrag in euro" data-testid="bg-bedrag" inputMode="decimal" value={r.bedrag} autoFocus={focus === 'bedrag'} onChange={(e) => onWijzig({ bedrag: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && onVolgende) onVolgende(); }} placeholder="€" style={css('text-align: right;')} />
          )}
        </BedragCel>
        <div className="fwk-bg-acties">
          {r.schatting && (
            <button type="button" className="fwk-bg-schat" data-testid="bg-schatting" title="Dit bedrag is een schatting. Klik als u het hebt gecontroleerd." aria-label="Schatting bevestigen" onClick={() => onWijzig({ schatting: false })}>
              schatting
            </button>
          )}
          <button type="button" className="fwk-bg-icoon" aria-label="Meer opties" aria-expanded={meer} data-testid="bg-meer" onClick={() => setMeer((v) => !v)}>
            ⋯
          </button>
          <button type="button" className="fwk-bg-icoon" aria-label="Regel verwijderen" data-testid="bg-weg" onClick={onWeg}>
            ✕
          </button>
        </div>
      </div>
      {meer && (
        <div className="fwk-bg-detail" data-testid="bg-detail">
          <label>
            Aantal
            <input className="fwk-bg-veld" aria-label="Aantal" data-testid="bg-aantal" inputMode="decimal" value={r.aantal} onChange={(e) => onWijzig({ aantal: e.target.value })} />
          </label>
          <label>
            Eenheid
            <input className="fwk-bg-veld" aria-label="Eenheid" data-testid="bg-eenheid" value={r.eenheid} maxLength={40} onChange={(e) => onWijzig({ eenheid: e.target.value })} />
          </label>
          <label>
            Tarief €
            <input className="fwk-bg-veld" aria-label="Tarief in euro" data-testid="bg-tarief" inputMode="decimal" value={r.tarief} onChange={(e) => onWijzig({ tarief: e.target.value })} />
          </label>
          <span style={css('display: inline-flex; gap: 4px; margin-left: auto;')}>
            <button type="button" className="fwk-bg-icoon" aria-label="Regel omhoog" data-testid="bg-regel-omhoog" disabled={!kanOmhoog} onClick={() => onSchuif('omhoog')}>
              ↑
            </button>
            <button type="button" className="fwk-bg-icoon" aria-label="Regel omlaag" data-testid="bg-regel-omlaag" disabled={!kanOmlaag} onClick={() => onSchuif('omlaag')}>
              ↓
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function DekkingRij({ naam, bedrag }) {
  return (
    <div className="fwk-aa-regel" style={css('padding: 4px 0;')}>
      <span>{naam}</span>
      <b>{bedrag == null ? 'bedrag volgt' : euro(bedrag)}</b>
    </div>
  );
}

const KOP = "margin: 14px 0 2px; font-size: 15px; font-weight: 800; color: #2C4A5E;";

export default function BegrotingTab({ project, projecten, onKiesProject, store }) {
  const projectId = project ? project.id : '';
  const beginRegels = leesBudgetRegels(project && project.budgetRegels);
  const [regels, setRegels] = useState(beginRegels);
  const [basis, setBasis] = useState(() => JSON.stringify(beginRegels));
  const [extra, setExtra] = useState([]); // kopjes zonder regels die het lid zelf heeft toegevoegd
  const [plusOpen, setPlusOpen] = useState(null); // kopje-id waarbij de suggesties openstaan
  const [afgewezen, setAfgewezen] = useState([]); // voorgestelde kopjes die het lid met het kruisje heeft weggeklikt
  const [volgendeOpen, setVolgendeOpen] = useState(false); // na Opslaan onder de laatste hoofdkop: kies de volgende
  const [volgendeEigen, setVolgendeEigen] = useState(false);
  const [eigenOpen, setEigenOpen] = useState(false); // het lid bedenkt zelf een kopje
  const [eigenNaam, setEigenNaam] = useState('');
  const [focusId, setFocusId] = useState('');
  const [focusVeld, setFocusVeld] = useState('omschrijving'); // welk veld van de nieuwe regel de cursor krijgt: bij een suggestie meteen het bedrag
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fin, setFin] = useState(null); // { regels, dekking, beschikbaar }
  const [drag, setDrag] = useState(null); // { soort: 'regel' | 'kopje', id } terwijl er versleept wordt
  const [over, setOver] = useState(null); // { soort: 'regel' | 'kopje' | 'doel', id, plek: 'voor' | 'na' }
  const [uploadBezig, setUploadBezig] = useState(false);
  const [upload, setUpload] = useState(null); // { bestand, aantal, waarschuwingen, vorigeRegels, vorigeBegroting, resterend } na een geslaagde upload
  const bestandRef = useRef(null);

  // Een ander project: de regels van dat project laden.
  useEffect(() => {
    const r = leesBudgetRegels(project && project.budgetRegels);

    setRegels(r);
    setBasis(JSON.stringify(r));
    setExtra([]);
    setPlusOpen(null);
    setAfgewezen([]);
    setEigenOpen(false);
    setEigenNaam('');
    setFout('');
    setMelding('');
    setUpload(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const laadFin = useCallback(async () => {
    if (!project) return;

    setFin(await haalFinancieringVoorExport(project));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    setFin(null);
    laadFin();
  }, [laadFin]);

  const gewijzigd = JSON.stringify(regels) !== basis;

  // Een vernieuwde of gesloten pagina met niet-opgeslagen regels: de browser vraagt eerst om bevestiging.
  useEffect(() => {
    if (!gewijzigd) return undefined;

    const w = (ev) => {
      ev.preventDefault();
      ev.returnValue = '';
    };

    window.addEventListener('beforeunload', w);

    return () => window.removeEventListener('beforeunload', w);
  }, [gewijzigd]);

  const totalen = useMemo(() => berekenBegroting(regels), [regels]);
  const totaal = totalen.totaalGeld;
  const begrotingVoorDekking = totaal > 0 ? Math.round(totaal) : project ? project.begroting : 0;
  const dek = useMemo(() => dekkingVanProject({ ...(project || {}), begroting: begrotingVoorDekking }, fin ? fin.regels : []), [project, begrotingVoorDekking, fin]);

  const zichtbaar = kopjeVolgorde(regels, extra).map(kopjeDef);
  const nietZichtbaar = CATEGORIEEN.filter((c) => !zichtbaar.some((z) => z.id === c.id) && !afgewezen.includes(c.id));
  const kopjesMetRegels = kopjeVolgorde(regels);

  const wijzig = (id, wijz) => {
    // Past het lid zelf een bedrag, aantal of tarief aan, dan is het geen schatting van de AI meer.
    const eigenBedrag = 'bedrag' in wijz || 'aantal' in wijz || 'tarief' in wijz;

    setRegels((cur) => cur.map((r) => (r.id === id ? { ...r, ...wijz, ...(eigenBedrag && !('schatting' in wijz) ? { schatting: false } : {}) } : r)));
    setMelding('');
    setFout('');
  };
  const voegToe = (categorie, basisRegel = {}) => {
    const n = nieuweRegel(categorie, basisRegel);

    setRegels((cur) => [...cur, n]);
    setFocusId(n.id);
    setFocusVeld(basisRegel.omschrijving ? 'bedrag' : 'omschrijving');
    setPlusOpen(null);
    setMelding('');
  };
  const weg = (id) => {
    setRegels((cur) => cur.filter((r) => r.id !== id));
    setMelding('');
  };
  const naOpslaanVerder = async () => {
    const gelukt = gewijzigd ? await opslaan() : true;

    if (gelukt) setVolgendeOpen(true);
  };
  const kiesKopje = (id) => {
    setExtra((cur) => (cur.includes(id) ? cur : [...cur, id]));
    setEigenOpen(false);
    setVolgendeOpen(false);
    setVolgendeEigen(false);
    setPlusOpen(id);

    // Het nieuwe kopje komt onderaan: breng het in beeld, zodat het lid meteen verder kan.
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        const el = document.querySelector(`[data-testid="bg-kopje-${kopjeSlug(id)}"]`);

        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };
  const voegEigenKopjeToe = () => {
    const gekozen = eigenKopjeSleutel(eigenNaam);

    if (!gekozen) return;

    // Dezelfde naam (ook met andere hoofdletters) als een kopje dat er al staat: geen tweede kopje, maar dat kopje.
    const bestaand = zichtbaar.find((c) => c.id !== GEEN_KOPJE && c.label.toLowerCase() === categorieLabel(gekozen).toLowerCase());

    kiesKopje(bestaand ? bestaand.id : gekozen);
    setEigenNaam('');
  };
  // Kopje weghalen: de regels erin blijven staan, zonder kopje.
  const haalKopjeWeg = (id) => {
    setRegels((cur) => verwijderKopje(cur, id));
    setExtra((cur) => cur.filter((x) => x !== id));
    setPlusOpen(null);
    setMelding('');
  };

  // Verslepen: de greep start het slepen, de rij of het kopje waar je overheen gaat toont een groene lijn, loslaten zet de regel of het kopje neer.
  // Voor aanraking en toetsenbord zijn er pijltjes (hieronder), zodat verplaatsen niet van een muis afhangt.
  const plekIn = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();

    return ev.clientY < rect.top + rect.height / 2 ? 'voor' : 'na';
  };
  const startSleep = (soort, id) => (ev) => {
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';

      try {
        ev.dataTransfer.setData('text/plain', id);
        const blok = ev.currentTarget.closest(soort === 'regel' ? '.fwk-bg-blok' : '.fwk-bg-sec');

        if (blok && ev.dataTransfer.setDragImage) ev.dataTransfer.setDragImage(blok, 12, 12);
      } catch (e) {
        // sommige browsers laten dit niet toe; slepen werkt dan zonder het mooie plaatje
      }
    }

    setDrag({ soort, id });
  };
  const eindeSleep = () => {
    setDrag(null);
    setOver(null);
  };
  const zetRegelNeer = (doelRegel, plek) => {
    if (!drag || drag.soort !== 'regel' || drag.id === doelRegel.id) return;

    const broers = regels.filter((x) => x.categorie === doelRegel.categorie && x.id !== drag.id);
    const i = broers.findIndex((x) => x.id === doelRegel.id);
    const voor = plek === 'voor' ? doelRegel.id : (broers[i + 1] || {}).id || null;

    setRegels((cur) => verplaatsRegel(cur, drag.id, doelRegel.categorie, voor));
    setMelding('');
  };
  const zetKopjeNeer = (doelId, plek) => {
    if (!drag || drag.soort !== 'kopje' || drag.id === doelId) return;

    const rest = kopjesMetRegels.filter((id) => id !== drag.id);
    const i = rest.indexOf(doelId);
    const voor = plek === 'voor' ? doelId : rest[i + 1] || null;

    setRegels((cur) => verplaatsKopje(cur, drag.id, voor));
    setMelding('');
  };
  const regelOver = (r) => (ev) => {
    if (!drag || drag.soort !== 'regel' || drag.id === r.id) return;

    ev.preventDefault();
    ev.stopPropagation();
    setOver({ soort: 'regel', id: r.id, plek: plekIn(ev) });
  };
  const regelDrop = (r) => (ev) => {
    if (!drag || drag.soort !== 'regel') return;

    ev.preventDefault();
    ev.stopPropagation();
    zetRegelNeer(r, over && over.soort === 'regel' && over.id === r.id ? over.plek : plekIn(ev));
    eindeSleep();
  };
  const kopjeOver = (c) => (ev) => {
    if (!drag) return;

    if (drag.soort === 'regel') {
      ev.preventDefault();
      setOver({ soort: 'doel', id: c.id });
    } else if (drag.id !== c.id && kopjesMetRegels.includes(c.id)) {
      ev.preventDefault();
      setOver({ soort: 'kopje', id: c.id, plek: plekIn(ev) });
    }
  };
  const kopjeDrop = (c) => (ev) => {
    if (!drag) return;

    ev.preventDefault();

    if (drag.soort === 'regel') {
      setRegels((cur) => verplaatsRegel(cur, drag.id, c.id, null));
      setMelding('');
    } else {
      zetKopjeNeer(c.id, over && over.soort === 'kopje' && over.id === c.id ? over.plek : plekIn(ev));
    }

    eindeSleep();
  };
  const schuifRegelKnop = (id, richting) => {
    setRegels((cur) => schuifRegel(cur, id, richting));
    setMelding('');
  };
  const schuifKopjeKnop = (id, richting) => {
    setRegels((cur) => schuifKopje(cur, id, richting));
    setMelding('');
  };

  const opslaan = async () => {
    const klaar = regelsVoorOpslag(regels);

    if (!klaar.ok) {
      setFout(klaar.fout);

      return false;
    }

    setBezig(true);
    setFout('');

    const nieuweBegroting = totaal > 0 ? Math.round(totaal) : project.begroting;
    const check = valideerEnBereidOp({ ...project, budgetRegels: klaar.regels, begroting: nieuweBegroting });

    if (!check.ok) {
      setFout(check.fout);
      setBezig(false);

      return false;
    }

    const id = await Promise.resolve(store.saveProject(check.project));

    setBezig(false);

    if (id === null) {
      setFout('Opslaan lukte niet. Probeer het opnieuw.');

      return false;
    }

    const opgeslagen = leesBudgetRegels(klaar.regels);

    setRegels(opgeslagen);
    setBasis(JSON.stringify(opgeslagen));
    setMelding(totaal > 0 ? `Opgeslagen. De projectbegroting is nu ${formatEuro(totaal)}.` : 'Opgeslagen.');
    laadFin();

    return true;
  };

  // Een bestaande begroting uploaden: de browser haalt de tekst eruit, de server zet haar om in regels en rekent de sommen na; de regels worden direct
  // bij de begroting gezet en opgeslagen (met bron "upload"). Afwijkingen komen als melding terug; "Ongedaan maken" zet de vorige stand terug.
  const kiesBestand = () => {
    if (bestandRef.current) bestandRef.current.click();
  };

  const uploadBestand = async (ev) => {
    const bestand = ev.target.files && ev.target.files[0];

    ev.target.value = '';

    if (!bestand || uploadBezig) return;

    setFout('');
    setMelding('');
    setUpload(null);

    const vorig = regelsVoorOpslag(regels);

    if (!vorig.ok) {
      setFout(`Los eerst dit op voordat u een bestand uploadt: ${vorig.fout}`);

      return;
    }

    setUploadBezig(true);

    const gelezen = await leesBegrotingBestand(bestand);

    if (!gelezen.ok) {
      setFout(gelezen.melding);
      setUploadBezig(false);

      return;
    }

    const res = await leesBegrotingUpload({ projectId, tekst: gelezen.tekst });

    if (!res.ok) {
      setFout(res.melding);
      setUploadBezig(false);

      return;
    }

    const nieuw = voorstelNaarRegels(res.antwoord.regels, 'upload', bestand.name);
    const samen = leesBudgetRegels(samenvoegVoorstel(vorig.regels, nieuw, 'toevoegen'));
    const klaar = regelsVoorOpslag(samen);

    if (!klaar.ok) {
      setFout(klaar.fout);
      setUploadBezig(false);

      return;
    }

    const totaalNa = berekenBegroting(samen).totaalGeld;
    const check = valideerEnBereidOp({ ...project, budgetRegels: klaar.regels, begroting: totaalNa > 0 ? Math.round(totaalNa) : project.begroting });

    if (!check.ok) {
      setFout(check.fout);
      setUploadBezig(false);

      return;
    }

    const id = await Promise.resolve(store.saveProject(check.project));

    setUploadBezig(false);

    if (id === null) {
      setFout('Opslaan lukte niet. Probeer het opnieuw.');

      return;
    }

    const opgeslagen = leesBudgetRegels(klaar.regels);
    const controle = res.antwoord.controle || {};

    setRegels(opgeslagen);
    setBasis(JSON.stringify(opgeslagen));
    setUpload({
      bestand: bestand.name,
      aantal: Array.isArray(res.antwoord.regels) ? res.antwoord.regels.length : 0,
      waarschuwingen: Array.isArray(controle.waarschuwingen) ? controle.waarschuwingen : [],
      sluit: res.antwoord.sluit && res.antwoord.sluit.toevoegen ? res.antwoord.sluit.toevoegen : null, // de controle van de server: sluit de begroting met het dekkingsplan?
      vorigeRegels: vorig.regels,
      vorigeBegroting: project.begroting,
      resterend: typeof res.antwoord.resterend === 'number' ? res.antwoord.resterend : null,
    });
    laadFin();
  };

  const maakUploadOngedaan = async () => {
    if (!upload || uploadBezig) return;

    setUploadBezig(true);
    setFout('');

    const terug = leesBudgetRegels(upload.vorigeRegels);
    const totaalTerug = berekenBegroting(terug).totaalGeld;
    const check = valideerEnBereidOp({ ...project, budgetRegels: upload.vorigeRegels, begroting: totaalTerug > 0 ? Math.round(totaalTerug) : upload.vorigeBegroting });

    if (!check.ok) {
      setFout(check.fout);
      setUploadBezig(false);

      return;
    }

    const id = await Promise.resolve(store.saveProject(check.project));

    setUploadBezig(false);

    if (id === null) {
      setFout('Terugzetten lukte niet. Probeer het opnieuw.');

      return;
    }

    setRegels(terug);
    setBasis(JSON.stringify(terug));
    setUpload(null);
    setMelding('De begroting staat weer zoals voor de upload.');
    laadFin();
  };

  const downloadExcel = async () => {
    setFout('');

    try {
      const [{ berekenBudget }, { generateExcelDocument, bepaalExcelBestandsnaam }] = await Promise.all([import('../../../shared/budget/berekenBudget.js'), import('../../../shared/budget/generateExcelDocument.js')]);
      const naam = (store && store.orgProfile && store.orgProfile.name) || null;
      const p = { ...project, begroting: begrotingVoorDekking };
      const budget = berekenBudget(expenseLinesVoorExcel(regels), p, {}, fin && fin.beschikbaar ? { regels: fin.regels, dekking: dekkingVanProject(p, fin.regels), metPlanning: true } : undefined);
      const blob = await generateExcelDocument({ budget, project: p, organizationName: naam });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = bepaalExcelBestandsnaam({ project: p, organizationName: naam });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setFout('De Excel kon niet worden gemaakt. Probeer het opnieuw.');
    }
  };

  if (!project) return null;

  const lijst = fin ? fin.regels : [];
  const toegekend = lijst.filter((r) => r.status === 'awarded');
  const uitstaand = lijst.filter((r) => r.status === 'submitted');
  const gepland = lijst.filter((r) => r.status === 'interesting' || r.status === 'preparing');
  const bedragVan = (r) => (r.status === 'awarded' ? (r.awarded != null ? r.awarded : r.requested) : r.requested);

  return (
    <div data-testid="bg-tab">
      <AanvraagStijl />
      <BegrotingStijl />
      <ProjectKeuze projecten={projecten} projectId={projectId} onKies={onKiesProject} />

      <DekkingBalk dek={dek} projectNaam={project && project.naam} />

      <Blok
        titel="Begroting"
        testid="bg-begroting"
      >
        <div className="fwk-aa-klein" style={css('margin: 0 0 10px;')}>
          {regels.length === 0 ? 'Weet u niet waar u moet beginnen? ' : 'Iets vergeten? '}
          <a className="fwk-wp-link" data-testid="bg-chat" href={chatStartHref({ projectId, start: 'begroting' })}>
            Laat Subsidie Kompas de vragen stellen →
          </a>
        </div>
        <div className="fwk-aa-klein" style={css('margin: 0 0 10px;')}>
          Heeft u al een begroting?{' '}
          <button type="button" className="fwk-wp-link" data-testid="bg-upload-knop" disabled={uploadBezig} onClick={kiesBestand} style={css('background: none; border: 0; padding: 0; font: inherit; cursor: pointer;')}>
            {uploadBezig ? 'Bezig met lezen…' : 'Upload een Excel- of Word-bestand →'}
          </button>
          <input ref={bestandRef} type="file" accept=".xlsx,.docx" data-testid="bg-upload-bestand" aria-label="Begroting uploaden" style={css('display: none;')} onChange={uploadBestand} />
        </div>

        {upload && (
          <Melding toon="succes" testid="bg-upload-resultaat">
            <div style={css('min-width: 0; flex: 1;')}>
            <b>
              {upload.aantal} {upload.aantal === 1 ? 'regel' : 'regels'} uit {upload.bestand} staan in uw begroting en zijn opgeslagen.
            </b>{' '}
            Wijs met de muis naar het stipje bij een bedrag om te zien waar het vandaan komt.
            {upload.waarschuwingen.length > 0 && (
              <div data-testid="bg-upload-let-op" style={css('margin-top: 8px;')}>
                <b>Let op, dit klopt niet helemaal:</b>
                <ul style={css('margin: 4px 0 0; padding-left: 18px;')}>
                  {upload.waarschuwingen.map((w, i) => (
                    <li key={i} data-testid="bg-upload-waarschuwing">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {upload.waarschuwingen.length === 0 && (
              <div data-testid="bg-upload-klopt" style={css('margin-top: 6px;')}>
                De sommen in het bestand kloppen met de regels.
              </div>
            )}
            {upload.sluit && (
              <div data-testid="bg-upload-sluit" data-uitkomst={upload.sluit.uitkomst} style={css('margin-top: 8px;')}>
                <b>{upload.sluit.uitkomst === 'sluitend' ? 'Begroting en dekkingsplan sluiten.' : 'Begroting en dekkingsplan:'}</b> {upload.sluit.tekst}
              </div>
            )}
            <div style={css('margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;')}>
              <Button variant="outline" onClick={maakUploadOngedaan} disabled={uploadBezig} ariaLabel="Upload ongedaan maken">
                Ongedaan maken
              </Button>
              {upload.resterend !== null && (
                <span className="fwk-aa-klein" data-testid="bg-upload-resterend">
                  Nog {upload.resterend} {upload.resterend === 1 ? 'beoordeling' : 'beoordelingen'} over deze maand.
                </span>
              )}
            </div>
            </div>
          </Melding>
        )}

        <div className="fwk-bg-kopjesbalk" data-testid="bg-kopjes">
          <div className="fwk-bg-kopjes-label">Kies een subcategorie, of voeg direct budgetregels toe</div>
          <div className="fwk-bg-chips">
            {nietZichtbaar.map((c) => (
              <Toelichting key={c.id} kopje={c} knop={false}>
                <span className="fwk-bg-chipgroep">
                  <button type="button" className="fwk-bg-chip" data-testid={`bg-kopje-kies-${c.id}`} onClick={() => kiesKopje(c.id)}>
                    {c.label}
                  </button>
                  <button type="button" className="fwk-bg-chipx" aria-label={`Suggestie ${c.label} weghalen`} title="Deze suggestie weghalen" data-testid={`bg-kopje-sug-weg-${c.id}`} onClick={() => setAfgewezen((cur) => [...cur, c.id])}>
                    ✕
                  </button>
                </span>
              </Toelichting>
            ))}
            <button type="button" className="fwk-bg-chip fwk-bg-chip-plus" data-testid="bg-kopje-eigen" aria-label="Eigen subcategorie toevoegen" title="Eigen subcategorie toevoegen" onClick={() => setEigenOpen(true)}>
              +
            </button>
            {!zichtbaar.some((c) => c.id === GEEN_KOPJE) && (
              <button type="button" className="fwk-bg-chip" data-testid="bg-kopje-geen" onClick={() => voegToe(GEEN_KOPJE)}>
                + Budgetregel zonder subcategorie
              </button>
            )}
          </div>
          {eigenOpen && (
            <form
              className="fwk-bg-eigen"
              data-testid="bg-eigen-form"
              onSubmit={(ev) => {
                ev.preventDefault();
                voegEigenKopjeToe();
              }}
            >
              <input className="fwk-bg-veld" aria-label="Naam van de subcategorie" data-testid="bg-eigen-naam" value={eigenNaam} maxLength={60} autoFocus placeholder="Naam van de subcategorie" onChange={(e) => setEigenNaam(e.target.value)} />
              <Button size="s" variant="dark" type="submit" disabled={!eigenNaam.trim()} ariaLabel="Subcategorie toevoegen">
                Toevoegen
              </Button>
            </form>
          )}
        </div>

        {regels.length === 0 && project.begroting ? (
          <div className="fwk-aa-klein" data-testid="bg-leeg" style={css('margin-bottom: 8px;')}>
            Bij Projecten staat nu {formatEuro(project.begroting)}.
          </div>
        ) : null}

        {zichtbaar.map((c) => {
          const rijen = regels.filter((r) => r.categorie === c.id);
          const deel = totalen.perCategorie.find((x) => x.id === c.id);
          const gebruikt = new Set(rijen.map((r) => r.omschrijving.trim().toLowerCase()));
          const open = plusOpen === c.id && c.id !== GEEN_KOPJE;
          const slug = kopjeSlug(c.id);
          const kopjeNr = kopjesMetRegels.indexOf(c.id);
          const kopOver = over && over.id === c.id && over.soort === 'kopje' ? over.plek : undefined;
          const isDoel = over && over.soort === 'doel' && over.id === c.id;

          return (
            <section
              key={c.id}
              className="fwk-bg-sec"
              data-kop={c.id !== GEEN_KOPJE ? 'ja' : undefined}
              data-testid={`bg-kopje-${slug}`}
              data-sleep={drag && drag.soort === 'kopje' && drag.id === c.id ? 'ja' : undefined}
              data-over={kopOver}
              data-doel={isDoel ? 'ja' : undefined}
              onDragOver={kopjeOver(c)}
              onDrop={kopjeDrop(c)}
              style={css('margin: 0 0 22px;')}
            >
              {c.id !== GEEN_KOPJE && (
                <div className="fwk-bg-kophoofd">
                  <div className="fwk-bg-kopkant">
                    {kopjeNr !== -1 && (
                      <span className="fwk-bg-greep" data-testid={`bg-kopje-greep-${slug}`} draggable aria-hidden="true" title="Subcategorie verslepen" onDragStart={startSleep('kopje', c.id)} onDragEnd={eindeSleep}>
                        ⠿
                      </span>
                    )}
                    <Toelichting kopje={c}>
                      <h3 data-testid={`bg-kop-${slug}`} style={css(`margin: 0; font-size: 15.5px; font-weight: 800; color: ${color.donkerblauw};`)}>
                        {c.label}
                      </h3>
                    </Toelichting>
                    <button type="button" className="fwk-bg-icoon" aria-label={`Subcategorie ${c.label} weghalen`} title="Subcategorie weghalen (de regels blijven staan)" data-testid={`bg-kopje-weg-${slug}`} onClick={() => haalKopjeWeg(c.id)}>
                      ✕
                    </button>
                  </div>
                  <div className="fwk-bg-kopkant">
                    {kopjeNr !== -1 && (
                      <span className="fwk-bg-schuif">
                        <button type="button" className="fwk-bg-icoon" aria-label={`Subcategorie ${c.label} omhoog`} data-testid={`bg-kopje-omhoog-${slug}`} disabled={kopjeNr === 0} onClick={() => schuifKopjeKnop(c.id, 'omhoog')}>
                          ▲
                        </button>
                        <button type="button" className="fwk-bg-icoon" aria-label={`Subcategorie ${c.label} omlaag`} data-testid={`bg-kopje-omlaag-${slug}`} disabled={kopjeNr === kopjesMetRegels.length - 1} onClick={() => schuifKopjeKnop(c.id, 'omlaag')}>
                          ▼
                        </button>
                      </span>
                    )}
                    <span className="fwk-aa-klein" data-testid={`bg-sub-${slug}`}>
                      {deel ? euro(deel.subtotaal) : euro(0)}
                    </span>
                  </div>
                </div>
              )}

              {rijen.map((r, i) => (
                <Regel
                  key={r.id}
                  r={r}
                  focus={focusId === r.id ? focusVeld : ''}
                  onVolgende={() => (c.id === GEEN_KOPJE ? voegToe(GEEN_KOPJE) : setPlusOpen(c.id))}
                  sleep={!!drag && drag.soort === 'regel' && drag.id === r.id}
                  over={over && over.soort === 'regel' && over.id === r.id ? over.plek : undefined}
                  onWijzig={(w) => wijzig(r.id, w)}
                  onWeg={() => weg(r.id)}
                  onSleepStart={startSleep('regel', r.id)}
                  onSleepEinde={eindeSleep}
                  onSleepOver={regelOver(r)}
                  onDrop={regelDrop(r)}
                  onSchuif={(richting) => schuifRegelKnop(r.id, richting)}
                  kanOmhoog={i > 0}
                  kanOmlaag={i < rijen.length - 1}
                />
              ))}

              {open ? (
                <div className="fwk-bg-chips" data-testid={`bg-suggesties-${slug}`}>
                  {c.suggesties
                    .filter(([naam]) => !gebruikt.has(naam.toLowerCase()))
                    .map(([naam, eenheid]) => (
                      <button key={naam} type="button" className="fwk-bg-chip" data-testid="bg-suggestie" onClick={() => voegToe(c.id, { omschrijving: naam, eenheid })}>
                        {naam}
                      </button>
                    ))}
                  <button type="button" className="fwk-bg-chip" data-testid="bg-eigen-regel" onClick={() => voegToe(c.id)}>
                    + Zelf invullen
                  </button>
                </div>
              ) : (
                <div className="fwk-bg-lijn">
                  <button type="button" className="fwk-bg-plus" data-testid={`bg-plus-${slug}`} aria-label="Regel toevoegen" title="Regel toevoegen" onClick={() => (c.id === GEEN_KOPJE ? voegToe(GEEN_KOPJE) : setPlusOpen(c.id))}>
                    +
                  </button>
                </div>
              )}
              {c.id !== GEEN_KOPJE && c.id === zichtbaar[zichtbaar.length - 1].id && rijen.length > 0 && !volgendeOpen && (
                <div className="fwk-bg-klaar">
                  <button type="button" className="fwk-bg-volgende" data-testid="bg-volgende-kop" disabled={bezig} onClick={naOpslaanVerder}>
                    {bezig ? 'Opslaan…' : 'Opslaan en volgende subcategorie'}
                  </button>
                </div>
              )}
              {c.id !== GEEN_KOPJE && c.id === zichtbaar[zichtbaar.length - 1].id && volgendeOpen && (
                <div className="fwk-bg-volgendekeuze" data-testid="bg-volgende-keuze">
                  <div className="fwk-bg-kopjes-label">Opgeslagen. Kies de volgende subcategorie</div>
                  <div className="fwk-bg-chips">
                    {nietZichtbaar.map((k) => (
                      <button key={k.id} type="button" className="fwk-bg-chip" data-testid={`bg-volgende-kies-${k.id}`} onClick={() => kiesKopje(k.id)}>
                        {k.label}
                      </button>
                    ))}
                    {!zichtbaar.some((k) => k.id === GEEN_KOPJE) && (
                      <button type="button" className="fwk-bg-chip" data-testid="bg-volgende-geen" onClick={() => { setVolgendeOpen(false); voegToe(GEEN_KOPJE); }}>
                        + Budgetregel zonder subcategorie
                      </button>
                    )}
                    <button type="button" className="fwk-bg-chip fwk-bg-chip-plus" data-testid="bg-volgende-eigen" aria-label="Eigen subcategorie toevoegen" title="Eigen subcategorie toevoegen" onClick={() => setVolgendeEigen(true)}>
                      +
                    </button>
                  </div>
                  {volgendeEigen && (
                    <form
                      className="fwk-bg-eigen"
                      data-testid="bg-volgende-eigen-form"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        voegEigenKopjeToe();
                      }}
                    >
                      <input className="fwk-bg-veld" aria-label="Naam van de subcategorie" data-testid="bg-volgende-eigen-naam" value={eigenNaam} maxLength={60} autoFocus placeholder="Naam van de subcategorie" onChange={(e) => setEigenNaam(e.target.value)} />
                      <Button size="s" variant="dark" type="submit" disabled={!eigenNaam.trim()} ariaLabel="Subcategorie toevoegen">
                        Toevoegen
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {regels.length > 0 && (
          <div style={css('display: flex; justify-content: flex-end; margin-top: 12px; padding-top: 10px; border-top: 1px solid #E3EAE6;')}>
            <span data-testid="bg-totaal" style={css('font-weight: 800; font-size: 17px; padding-right: 4px;')}>
              Totaal {euro(totaal)}
            </span>
          </div>
        )}

        {totalen.zonderBedrag.length > 0 && (
          <div className="fwk-aa-klein" data-testid="bg-zonder-bedrag" style={css('margin: 10px 0;')}>
            Nog geen bedrag bij: {totalen.zonderBedrag.map((r) => r.omschrijving || categorieLabel(r.categorie)).join(', ')}. Deze regels tellen nog niet mee.
          </div>
        )}
        {totalen.aantalSchattingen > 0 && (
          <div className="fwk-aa-klein" data-testid="bg-schatting-totaal" style={css('margin: 10px 0;')}>
            Waarvan {euro(totalen.totaalSchatting)} nog een schatting ({totalen.aantalSchattingen} {totalen.aantalSchattingen === 1 ? 'regel' : 'regels'}). Klik op schatting bij een regel als u het bedrag hebt gecontroleerd.
          </div>
        )}

        {fout && (
          <Melding toon="fout" testid="bg-fout">
            {fout}
          </Melding>
        )}
        {melding && !gewijzigd && (
          <Melding toon="succes" testid="bg-melding">
            {melding}
          </Melding>
        )}

        {(regels.length > 0 || gewijzigd) && (
          <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 14px;')}>
            <Button variant="dark" onClick={opslaan} disabled={bezig || !gewijzigd} ariaLabel="Begroting opslaan">
              {bezig ? 'Opslaan…' : 'Opslaan'}
            </Button>
            <Button variant="outline" onClick={downloadExcel} disabled={regels.length === 0} ariaLabel="Begroting downloaden als Excel">
              Download Excel
            </Button>
            {gewijzigd && (
              <span className="fwk-aa-klein" data-testid="bg-niet-opgeslagen">
                Nog niet opgeslagen.
              </span>
            )}
          </div>
        )}
      </Blok>

      <div style={css('height: 18px;')} />

      <Blok
        titel="Dekkingsplan"
        testid="bg-dekking"
        actie={
          <a className="fwk-wp-link" href={projectFinancieringHref(projectId)}>
            Aanpassen in Projectfinanciering →
          </a>
        }
      >
        {!dek.heeftBegroting ? (
          <Leeg>Vul eerst de begroting in.</Leeg>
        ) : (
          <>
            <div style={css(KOP)}>Toegekend</div>
            {dek.overige > 0 && <DekkingRij naam="Eigen bijdrage" bedrag={dek.overige} />}
            {toegekend.map((r) => (
              <DekkingRij key={r.id} naam={r.naam} bedrag={bedragVan(r)} />
            ))}
            {dek.overige === 0 && toegekend.length === 0 && <div className="fwk-aa-klein">Nog niets toegekend.</div>}

            <div style={css(KOP)}>Uitstaand</div>
            {uitstaand.map((r) => (
              <DekkingRij key={r.id} naam={r.naam} bedrag={bedragVan(r)} />
            ))}
            {uitstaand.length === 0 && <div className="fwk-aa-klein">Niets uitstaand.</div>}

            <div style={css(KOP)}>In planning</div>
            {gepland.map((r) => (
              <DekkingRij key={r.id} naam={r.naam} bedrag={bedragVan(r)} />
            ))}
            {gepland.length === 0 && <div className="fwk-aa-klein">Niets in planning.</div>}

            <div style={css('margin-top: 14px; padding-top: 10px; border-top: 1px solid #E3EAE6;')}>
              <div className="fwk-aa-regel" data-testid="bg-dek-totaal-rij" style={css('padding: 3px 0;')}>
                <span>Totaal</span>
                <b data-testid="bg-dek-totaal">{euro(dek.gedektMetPlan)}</b>
              </div>
              {dek.overgedekt > 0 ? (
                <>
                  <div className="fwk-aa-regel" data-testid="bg-reeds-gedekt" style={css('padding: 3px 0;')}>
                    <span>Reeds gedekt</span>
                    <b>{euro(Math.max(0, dek.gedektMetPlan - dek.overgedekt))}</b>
                  </div>
                  <div className="fwk-aa-regel" data-testid="bg-overdekking" style={css('padding: 3px 0;')}>
                    <span>Overdekking</span>
                    <b>{euro(dek.overgedekt)}</b>
                  </div>
                </>
              ) : (
                <div className="fwk-aa-regel" data-testid="bg-nog-te-plannen" style={css('padding: 3px 0;')}>
                  <span>Nog te dekken</span>
                  <b>{euro(dek.nogTePlannen)}</b>
                </div>
              )}
              {dek.planVolledig && dek.overgedekt <= 0 && (
                <div style={css('margin-top: 8px;')}>
                  <Chip testid="bg-sluit">Sluitend</Chip>
                </div>
              )}
              {dek.geplandZonderBedrag > 0 && (
                <div className="fwk-aa-klein" style={css('margin-top: 6px;')}>
                  Bij {dek.geplandZonderBedrag} {dek.geplandZonderBedrag === 1 ? 'financier in planning' : 'financiers in planning'} staat nog geen bedrag.
                </div>
              )}
            </div>
          </>
        )}
      </Blok>
    </div>
  );
}
