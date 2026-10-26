// Gedeelde bouwstenen van de aanvraag-assistent (Documenten › Projectplan en Aanvragen). Alleen weergave: geen netwerk, geen opslag.
// Alle kleuren en maten komen uit shared/tokens.js; de vormentaal is die van de werkplek (shared/ui/werkplek.jsx).
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { color, font, radius } from '../../../shared/tokens.js';
import { Blok, Chip } from '../../../shared/ui/werkplek.jsx';
import { mailNaarCollectief, ruimteRegels } from './aanvraagModel.js';

export const CSS_AANVRAAG = `
.fwk-aa-keuzes { display: flex; flex-wrap: wrap; gap: 18px; }
.fwk-aa-keuze { flex: 1 1 300px; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; padding: 22px; border: 1px solid ${color.lijn}; border-radius: ${radius.xxl}; background: ${color.wit}; font-family: ${font.tekst}; }
.fwk-aa-keuze[data-accent="true"] { border: 2px solid ${color.groen}; background: ${color.vlakGroen}; }
.fwk-aa-keuze h3 { margin: 0; font-family: ${font.kop}; font-size: 21px; font-weight: 600; color: ${color.donkerblauw}; }
.fwk-aa-keuze p { margin: 0; font-size: 15px; line-height: 1.55; color: ${color.tekstZacht}; }
.fwk-aa-onder { margin-top: auto; padding-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.fwk-aa-klein { font-size: 13.5px; line-height: 1.5; color: ${color.tekstGrijs}; }
.fwk-aa-label { display: block; margin-bottom: 6px; font-family: ${font.tekst}; font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: ${color.tekstLicht}; }
.fwk-aa-info { box-sizing: border-box; padding: 20px 22px; border: 1px solid ${color.lijnBlauw}; border-radius: ${radius.xxl}; background: ${color.vlakBlauw}; font-family: ${font.tekst}; }
.fwk-aa-info h3 { margin: 0 0 8px; font-size: 15.5px; font-weight: 800; color: ${color.donkerblauw}; }
.fwk-aa-info p { margin: 0 0 14px; font-size: 14.5px; line-height: 1.55; color: ${color.tekstZacht}; }
.fwk-aa-linkknop { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-height: 40px; padding: 10px 18px; border: 1px solid ${color.lijnBlauw}; border-radius: ${radius.pil}; background: ${color.wit}; font-family: ${font.tekst}; font-size: 13.5px; font-weight: 800; color: ${color.donkerblauw}; text-decoration: none; }
.fwk-aa-linkknop:hover { border-color: ${color.pastelgroen}; }
.fwk-aa-stappen { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 22px; padding: 0; list-style: none; }
.fwk-aa-stap { display: flex; align-items: center; gap: 10px; box-sizing: border-box; padding: 6px 16px 6px 7px; border: 1px solid ${color.lijnBlauw}; border-radius: ${radius.pil}; background: ${color.wit}; font-family: ${font.tekst}; font-size: 13.5px; font-weight: 800; color: ${color.tekstGrijs}; }
.fwk-aa-stap > span { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid ${color.lijnBlauw}; border-radius: 50%; font-size: 12.5px; }
.fwk-aa-stap[data-staat="klaar"] { border-color: ${color.lijnGroenSterk}; background: ${color.vlakGroen}; color: ${color.succes}; }
.fwk-aa-stap[data-staat="klaar"] > span { border: none; background: ${color.groen}; color: ${color.wit}; }
.fwk-aa-stap[data-staat="nu"] { border-color: ${color.donkerblauw}; background: ${color.donkerblauw}; color: ${color.wit}; }
.fwk-aa-stap[data-staat="nu"] > span { border: none; background: ${color.wit}; color: ${color.donkerblauw}; }
.fwk-aa-balk { height: 8px; margin: 6px 0 14px; border-radius: 999px; background: ${color.vlakGrijs}; overflow: hidden; }
.fwk-aa-balk > div { height: 8px; background: ${color.groen}; }
.fwk-aa-regel { display: flex; justify-content: space-between; gap: 12px; font-family: ${font.tekst}; font-size: 14px; color: ${color.tekst}; }
.fwk-aa-regel b { color: ${color.donkerblauw}; }
.fwk-aa-lijst { margin: 0; padding: 0; list-style: none; }
.fwk-aa-lijst > li { padding: 16px 0; border-bottom: 1px solid ${color.lijn}; }
.fwk-aa-lijst > li:last-child { border-bottom: none; }
.fwk-aa-eis { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px 16px; }
.fwk-aa-eis-tekst { flex: 1 1 320px; min-width: 0; font-family: ${font.tekst}; font-size: 15px; font-weight: 700; line-height: 1.5; color: ${color.tekst}; overflow-wrap: anywhere; }
.fwk-aa-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.fwk-aa-acties { display: flex; flex-wrap: wrap; gap: 8px; }
.fwk-aa-veld { width: 100%; box-sizing: border-box; min-height: 46px; padding: 12px 14px; border: 1px solid ${color.lijnInput}; border-radius: ${radius.m}; background: ${color.wit}; font-family: ${font.tekst}; font-size: 15px; line-height: 1.5; color: ${color.tekst}; }
.fwk-aa-veld:focus { outline: 2px solid ${color.groen}; outline-offset: 1px; }
textarea.fwk-aa-veld { resize: vertical; }
.fwk-aa-drop { box-sizing: border-box; padding: 20px; border: 2px dashed ${color.lijnGroenSterk}; border-radius: ${radius.xl}; background: ${color.achtergrond}; text-align: center; font-family: ${font.tekst}; }
.fwk-aa-drop[data-over="true"] { border-color: ${color.groen}; background: ${color.vlakGroen}; }
.fwk-aa-optie { box-sizing: border-box; padding: 18px 20px; border: 1px solid ${color.lijn}; border-radius: ${radius.xl}; background: ${color.wit}; }
.fwk-aa-optie[data-accent="true"] { border: 2px solid ${color.groen}; background: ${color.vlakGroen}; }
.fwk-aa-optie h3 { margin: 0 0 4px; font-family: ${font.tekst}; font-size: 16.5px; font-weight: 800; color: ${color.donkerblauw}; }
.fwk-aa-optie p { margin: 0 0 12px; font-size: 14.5px; line-height: 1.55; color: ${color.tekstZacht}; }
.fwk-aa-tekst { font-family: ${font.tekst}; font-size: 15px; line-height: 1.7; color: ${color.tekst}; white-space: pre-wrap; overflow-wrap: anywhere; }
.fwk-aa-markering { padding: 1px 6px; border-radius: 6px; background: ${color.waarschuwingVlak}; border: 1px solid ${color.waarschuwingLijn}; color: ${color.waarschuwing}; font-weight: 700; }
.fwk-aa-citaat { margin: 8px 0 0; padding: 8px 12px; border-left: 3px solid ${color.lijnGroenSterk}; background: ${color.achtergrond}; border-radius: 0 ${radius.s} ${radius.s} 0; font-family: ${font.tekst}; font-size: 13.5px; line-height: 1.5; color: ${color.tekstZacht}; overflow-wrap: anywhere; }
.fwk-aa-citaat b { display: block; margin-bottom: 2px; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${color.tekstLicht}; }
.fwk-aa-bezig { display: inline-block; width: 16px; height: 16px; border: 2px solid ${color.lijnGroenSterk}; border-top-color: ${color.groen}; border-radius: 50%; animation: fwk-aa-draai .9s linear infinite; vertical-align: -3px; }
.fwk-aa-vier { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0 0 18px; padding: 0; list-style: none; border: 1px solid ${color.lijn}; border-radius: ${radius.xxl}; background: ${color.wit}; overflow: hidden; }
.fwk-aa-vier > li { min-width: 0; border-right: 1px solid ${color.lijn}; }
.fwk-aa-vier > li:last-child { border-right: none; }
.fwk-aa-vier button { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; font-family: ${font.tekst}; font-size: 14px; font-weight: 800; color: ${color.tekstGrijs}; }
.fwk-aa-vier button:focus-visible { outline: 2px solid ${color.groen}; outline-offset: -3px; }
.fwk-aa-vier button[disabled] { cursor: default; opacity: .6; }
.fwk-aa-vier-nr { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #EAEFF3; color: ${color.donkerblauw}; font-family: ${font.kop}; font-size: 14px; }
.fwk-aa-vier small { display: block; font-size: 12px; font-weight: 600; color: ${color.tekstLicht}; }
.fwk-aa-vier [data-staat="klaar"] { color: ${color.donkerblauw}; }
.fwk-aa-vier [data-staat="klaar"] .fwk-aa-vier-nr { background: ${color.groen}; color: ${color.wit}; }
.fwk-aa-vier [data-staat="nu"] { background: ${color.vlakGroen}; color: ${color.donkerblauw}; }
.fwk-aa-vier [data-staat="nu"] .fwk-aa-vier-nr { background: ${color.donkerblauw}; color: ${color.wit}; }
@media (max-width: 760px) { .fwk-aa-vier { grid-template-columns: repeat(2, minmax(0, 1fr)); } .fwk-aa-vier > li:nth-child(2) { border-right: none; } .fwk-aa-vier > li:nth-child(-n+2) { border-bottom: 1px solid ${color.lijn}; } }
.fwk-aa-vier-nr[data-klaar="true"] { background: ${color.groen}; color: ${color.wit}; }
.fwk-aa-split { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 18px; align-items: start; }
.fwk-aa-split > * { min-width: 0; }
.fwk-aa-vraagknop { all: unset; box-sizing: border-box; width: 100%; display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid transparent; border-radius: ${radius.l}; cursor: pointer; font-family: ${font.tekst}; }
.fwk-aa-vraagknop:focus-visible { outline: 2px solid ${color.groen}; outline-offset: 1px; }
.fwk-aa-vraagknop[data-actief="true"] { background: ${color.vlakGroen}; border-color: ${color.lijnGroen}; }
.fwk-aa-vraagtitel { display: block; font-size: 13.5px; font-weight: 700; line-height: 1.35; color: ${color.donkerblauw}; overflow-wrap: anywhere; }
.fwk-aa-vraagknop small { display: block; font-size: 12px; font-weight: 600; color: ${color.tekstLicht}; }
@media (max-width: 860px) { .fwk-aa-split { grid-template-columns: minmax(0, 1fr); } }
.fwk-aa-meer > summary { cursor: pointer; list-style: none; padding: 12px 16px; border: 1px solid ${color.lijn}; border-radius: ${radius.xl}; background: ${color.wit}; font-family: ${font.tekst}; font-size: 14px; font-weight: 800; color: ${color.donkerblauw}; }
.fwk-aa-meer > summary::-webkit-details-marker { display: none; }
.fwk-aa-meer > summary::before { content: '▸'; margin-right: 8px; color: ${color.tekstLicht}; }
.fwk-aa-meer[open] > summary::before { content: '▾'; }
.fwk-aa-meer > summary:focus-visible { outline: 2px solid ${color.groen}; outline-offset: 2px; }
.fwk-aa-kaarten { display: flex; flex-direction: column; gap: 12px; }
.fwk-aa-kaart { box-sizing: border-box; padding: 16px 18px; border: 1px solid ${color.lijn}; border-radius: ${radius.xl}; background: ${color.wit}; }
.fwk-aa-kaart-titel { margin: 0 0 2px; font-family: ${font.tekst}; font-size: 16px; font-weight: 800; color: ${color.donkerblauw}; }
.fwk-aa-mini { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
.fwk-aa-mini > li { min-width: 0; font-family: ${font.tekst}; font-size: 12.5px; font-weight: 700; color: ${color.tekstLicht}; }
.fwk-aa-mini > li > i { display: block; height: 6px; margin-bottom: 6px; border-radius: 999px; background: #E4EBE7; }
.fwk-aa-mini > li > b { display: block; font-weight: 800; }
.fwk-aa-mini > li > small { display: block; font-size: 12px; font-weight: 600; }
.fwk-aa-mini > li[data-staat="klaar"] > i { background: ${color.groen}; }
.fwk-aa-mini > li[data-staat="nu"] > i { background: ${color.donkerblauw}; }
.fwk-aa-mini > li[data-staat="klaar"], .fwk-aa-mini > li[data-staat="nu"] { color: ${color.donkerblauw}; }
@media (max-width: 560px) { .fwk-aa-mini { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@keyframes fwk-aa-draai { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .fwk-aa-bezig { animation: none; } }
`;

export function AanvraagStijl() {
  return <style>{CSS_AANVRAAG}</style>;
}

// Het project waar het om gaat, bovenaan Projectplan en Aanvragen.
export function ProjectKeuze({ projecten, projectId, onKies }) {
  return (
    <div style={css('display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; margin: 0 0 18px;')}>
      <label htmlFor="aa-project" className="fwk-aa-label" style={css('margin: 0;')}>
        Project
      </label>
      <select id="aa-project" data-testid="aa-projectkeuze" value={projectId} onChange={(e) => onKies(e.target.value)} className="fwk-aa-veld" style={css(`width: auto; min-width: 260px; max-width: 100%; font-weight: 700; color: ${color.donkerblauw}; cursor: pointer;`)}>
        {projecten.map((p) => (
          <option key={p.id} value={p.id}>
            {p.naam || 'Naamloos project'}
          </option>
        ))}
      </select>
    </div>
  );
}

// "Beoordelingen x van 6" en "Projectplannen x van 1". De cijfers komen van de server; zonder cijfer blijft het leeg.
export function RuimteBlok({ status }) {
  const regels = ruimteRegels(status).filter((r) => r.limiet !== null);

  if (!regels.length) return null;

  return (
    <Blok titel="Uw ruimte" testid="aa-ruimte">
      {regels.map((r) => (
        <div key={r.label}>
          <div className="fwk-aa-regel">
            <span>{r.label}</span>
            <b>{r.tekst}</b>
          </div>
          <div className="fwk-aa-balk" role="presentation">
            <div style={{ width: `${Math.round(r.aandeel * 100)}%` }} />
          </div>
        </div>
      ))}
    </Blok>
  );
}

// Voor een privaatfonds of familiefonds met weinig openbare informatie: één klik opent een e-mail aan het Fondsenwervers Collectief.
export function PrivaatfondsKaart({ fondsLabel }) {
  return (
    <div className="fwk-aa-info" data-testid="aa-privaatfonds">
      <h3>Een privaatfonds of familiefonds met weinig informatie?</h3>
      <p>Sommige privaatfondsen en familiefondsen publiceren bijna niets. Vraag het Fondsenwervers Collectief om de informatie. U verstuurt de e-mail met één klik.</p>
      <a className="fwk-aa-linkknop" href={mailNaarCollectief(fondsLabel)} data-testid="aa-mail-collectief">
        Mail het Fondsenwervers Collectief
      </a>
    </div>
  );
}

const STAPPEN = ['Fonds en criteria', 'Criteria controleren', 'Schrijven of beoordelen'];

export function Stappen({ actief }) {
  return (
    <ol className="fwk-aa-stappen" aria-label="Stappen" data-testid="aa-stappen">
      {STAPPEN.map((naam, i) => {
        const nr = i + 1;
        const staat = nr < actief ? 'klaar' : nr === actief ? 'nu' : 'later';

        return (
          <li key={naam} className="fwk-aa-stap" data-staat={staat} aria-current={staat === 'nu' ? 'step' : undefined}>
            <span aria-hidden="true">{staat === 'klaar' ? '✓' : nr}</span>
            {naam}
          </li>
        );
      })}
    </ol>
  );
}

// De vier stappen van een aanvraag per fonds. stappen: uit werkbladStappen(); actief: id van de stap waar het lid nu is; onKies(id) opent een stap (alleen als die open is).
export function VierStappen({ stappen, actief, onKies }) {
  return (
    <ol className="fwk-aa-vier" aria-label="Stappen van deze aanvraag" data-testid="aa-vier-stappen">
      {stappen.map((s) => {
        const staat = s.id === actief ? 'nu' : s.klaar ? 'klaar' : 'later';

        return (
          <li key={s.id}>
            <button type="button" data-staat={staat} data-testid={`aa-stap-${s.id}`} disabled={!s.open} aria-current={s.id === actief ? 'step' : undefined} onClick={() => onKies(s.id)}>
              <span className="fwk-aa-vier-nr" aria-hidden="true">{s.klaar && s.id !== actief ? '✓' : s.nr}</span>
              <span style={{ minWidth: 0 }}>
                {s.naam}
                <small>{s.sub}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function Keuzekaart({ titel, accent = false, children, testid }) {
  return (
    <div className="fwk-aa-keuze" data-accent={accent ? 'true' : 'false'} data-testid={testid}>
      <h3>{titel}</h3>
      {children}
    </div>
  );
}

export function Bezig({ children }) {
  return (
    <div role="status" aria-live="polite" className="fwk-aa-klein" data-testid="aa-bezig" style={css('display: flex; align-items: center; gap: 10px;')}>
      <span className="fwk-aa-bezig" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function StatusChip({ tekst, toon }) {
  return <Chip toon={toon}>{tekst}</Chip>;
}
