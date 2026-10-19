// Bouwstenen van de vernieuwde werkplek van Subsidie Kompas (Dashboard, Projecten, Deadlines, Chat, Documenten).
// Eén rustige vormentaal: paginakop met één meta-regel, blokken met een korte kop, compacte rijen, een zijpaneel
// voor details, korte lege toestanden en uitleg alleen achter een Help-knop. Geen netwerk, geen opslag.
import React, { useEffect, useId, useRef, useState } from 'react';
import { css } from '../lib/css.js';
import { color, font } from '../tokens.js';

export const CSS_WERKPLEK = `
.fwk-wp-pagina { min-height: 100vh; background: ${color.achtergrond}; }
.fwk-wp-binnen { max-width: 1180px; margin: 0 auto; padding: clamp(18px, 3vw, 32px) clamp(16px, 4vw, 28px) 72px; box-sizing: border-box; }
.fwk-wp-kop { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 18px; margin: 0 0 22px; }
.fwk-wp-kop h1 { margin: 0; font-family: ${font.kop}; font-size: clamp(26px, 3.4vw, 34px); font-weight: 600; line-height: 1.15; color: ${color.donkerblauw}; overflow-wrap: anywhere; }
.fwk-wp-meta { margin-top: 6px; font-family: ${font.tekst}; font-size: 13.5px; line-height: 1.5; color: ${color.tekstGrijs}; }
.fwk-wp-meta2 { margin-top: 2px; font-family: ${font.tekst}; font-size: 13px; line-height: 1.5; color: ${color.tekstLicht}; }
.fwk-wp-eyebrow { display: inline-block; margin-bottom: 8px; padding: 3px 10px; border-radius: 999px; background: ${color.vlakGroen}; font-family: ${font.tekst}; font-size: 12px; font-weight: 800; color: ${color.succes}; text-decoration: none; }
.fwk-wp-acties { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.fwk-wp-blok { box-sizing: border-box; min-width: 0; padding: 18px 20px; border: 1px solid ${color.lijn}; border-radius: 16px; background: ${color.wit}; }
.fwk-wp-blok.fwk-wp-kaal { padding: 0; border: none; background: none; }
.fwk-wp-blokkop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; margin: 0 0 12px; }
.fwk-wp-blokkop h2 { margin: 0; font-family: ${font.kop}; font-size: 20px; font-weight: 600; color: ${color.donkerblauw}; }
.fwk-wp-blokkop .fwk-wp-tel { margin-left: 6px; font-family: ${font.tekst}; font-size: 13px; font-weight: 700; color: ${color.tekstLicht}; }
.fwk-wp-link { font-family: ${font.tekst}; font-size: 13.5px; font-weight: 800; color: ${color.groen}; text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; }
.fwk-wp-link:hover { text-decoration: underline; }
.fwk-wp-rijen { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fwk-wp-rij { position: relative; display: grid; grid-template-columns: minmax(0, 2.2fr) repeat(var(--kol, 2), minmax(0, 1fr)) auto; align-items: center; gap: 6px 16px; box-sizing: border-box; padding: 12px 16px; border: 1px solid ${color.lijn}; border-radius: 12px; background: ${color.wit}; font-family: ${font.tekst}; }
.fwk-wp-rij.fwk-wp-klik { cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
.fwk-wp-rij.fwk-wp-klik:hover { border-color: ${color.pastelgroen}; box-shadow: 0 2px 10px rgba(44,74,94,0.06); }
.fwk-wp-rij[aria-current="true"] { border-color: ${color.groen}; box-shadow: 0 0 0 1px ${color.groen}; }
.fwk-wp-rij-titel { min-width: 0; font-size: 14.5px; font-weight: 800; color: ${color.donkerblauw}; overflow-wrap: anywhere; }
.fwk-wp-rij-titel a, .fwk-wp-rij-titel button { color: inherit; text-decoration: none; font: inherit; background: none; border: none; padding: 0; cursor: pointer; text-align: left; }
.fwk-wp-rij-titel a::after, .fwk-wp-rij-titel button.fwk-wp-heel::after { content: ''; position: absolute; inset: 0; border-radius: 12px; }
.fwk-wp-rij-sub { margin-top: 2px; font-size: 12.5px; font-weight: 600; color: ${color.tekstLicht}; overflow-wrap: anywhere; }
.fwk-wp-kol { min-width: 0; }
.fwk-wp-kol-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${color.label}; }
.fwk-wp-kol-waarde { font-size: 13.5px; font-weight: 700; color: ${color.donkerblauw}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fwk-wp-kol-waarde.fwk-wp-urgent { color: ${color.fout}; }
.fwk-wp-kol-sub { font-size: 12px; color: ${color.tekstLicht}; }
.fwk-wp-rij-eind { position: relative; z-index: 1; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.fwk-wp-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; border: 1px solid ${color.lijnGroen}; background: ${color.vlakGroen}; font-family: ${font.tekst}; font-size: 12px; font-weight: 800; color: ${color.succes}; white-space: nowrap; }
.fwk-wp-chip[data-toon="blauw"] { border-color: #CFDFEA; background: ${color.vlakBlauw}; color: ${color.donkerblauw}; }
.fwk-wp-chip[data-toon="grijs"] { border-color: #DDE4E1; background: #EEF1F0; color: #5A6A66; }
.fwk-wp-chip[data-toon="oranje"] { border-color: ${color.waarschuwingLijn}; background: ${color.waarschuwingVlak}; color: ${color.waarschuwing}; }
.fwk-wp-chip[data-toon="rood"] { border-color: ${color.foutLijn}; background: ${color.foutVlak}; color: ${color.fout}; }
.fwk-wp-leeg { font-family: ${font.tekst}; font-size: 14px; line-height: 1.55; color: ${color.tekstGrijs}; }
.fwk-wp-melding { display: flex; align-items: flex-start; gap: 8px; box-sizing: border-box; padding: 10px 14px; border-radius: 12px; border: 1px solid ${color.lijnGroen}; background: ${color.vlakGroen}; font-family: ${font.tekst}; font-size: 13.5px; line-height: 1.5; color: ${color.succes}; }
.fwk-wp-melding[data-toon="waarschuwing"] { border-color: ${color.waarschuwingLijn}; background: ${color.waarschuwingVlak}; color: ${color.waarschuwing}; }
.fwk-wp-melding[data-toon="fout"] { border-color: ${color.foutLijn}; background: ${color.foutVlak}; color: ${color.fout}; }
.fwk-wp-melding[data-toon="info"] { border-color: #CFDFEA; background: ${color.vlakBlauw}; color: ${color.donkerblauw}; }
.fwk-wp-help { position: relative; display: inline-flex; }
.fwk-wp-help-knop { cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 12px; border: 1px solid ${color.lijn}; border-radius: 999px; background: ${color.wit}; font-family: ${font.tekst}; font-size: 13px; font-weight: 800; color: ${color.tekstGrijs}; }
.fwk-wp-help-knop:hover { border-color: ${color.pastelgroen}; color: ${color.donkerblauw}; }
.fwk-wp-help-paneel { position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; box-sizing: border-box; width: min(360px, 88vw); padding: 14px 16px; border: 1px solid ${color.lijn}; border-radius: 14px; background: ${color.wit}; box-shadow: 0 10px 30px rgba(44,74,94,0.14); font-family: ${font.tekst}; font-size: 13.5px; line-height: 1.6; color: ${color.tekstZacht}; }
.fwk-wp-help-paneel p { margin: 0 0 8px; }
.fwk-wp-help-paneel p:last-child { margin-bottom: 0; }
.fwk-wp-kolommen { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 370px); gap: 18px; align-items: start; }
.fwk-wp-kolommen > * { min-width: 0; }
.fwk-wp-stapel { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.fwk-wp-tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid ${color.lijn}; margin: 0 0 18px; scrollbar-width: thin; }
.fwk-wp-tab { flex: none; cursor: pointer; min-height: 42px; padding: 9px 14px; border: none; border-bottom: 3px solid transparent; background: none; font-family: ${font.tekst}; font-size: 14px; font-weight: 800; color: ${color.tekstGrijs}; }
.fwk-wp-tab[aria-selected="true"] { color: ${color.donkerblauw}; border-bottom-color: ${color.groen}; }
.fwk-wp-tab .fwk-wp-tel { margin-left: 6px; font-weight: 700; color: ${color.tekstLicht}; }
.fwk-wp-paneel-achter { position: fixed; inset: 0; z-index: 60; background: rgba(44,74,94,0.18); }
.fwk-wp-paneel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 61; box-sizing: border-box; width: min(460px, 100vw); overflow-y: auto; padding: 18px 22px 28px; background: ${color.wit}; border-left: 1px solid ${color.lijn}; box-shadow: -12px 0 32px rgba(44,74,94,0.12); font-family: ${font.tekst}; }
.fwk-wp-paneel { animation: fwk-wp-in .22s ease-out; }
@keyframes fwk-wp-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
@media (min-width: 900px) {
  .fwk-wp-paneel-achter { z-index: 58; background: rgba(247,249,248,0.6); }
  .fwk-wp-paneel { top: 16px; right: 16px; bottom: auto; max-height: calc(100vh - 32px); width: min(480px, calc(100vw - 32px)); padding: 24px 26px 26px; border: 1px solid ${color.lijn}; border-radius: 22px; box-shadow: 0 24px 60px rgba(44,74,94,0.16); }
  .fwk-wp-paneel-kop h2 { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) { .fwk-wp-paneel { animation: none; } }
.fwk-wp-paneel-kop { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.fwk-wp-paneel-kop h2 { margin: 0; font-family: ${font.kop}; font-size: 22px; font-weight: 600; line-height: 1.2; color: ${color.donkerblauw}; overflow-wrap: anywhere; }
.fwk-wp-sluit { cursor: pointer; flex: none; width: 36px; height: 36px; border: 1px solid ${color.lijn}; border-radius: 50%; background: ${color.wit}; font-size: 18px; line-height: 1; color: ${color.tekstGrijs}; }
.fwk-wp-label { margin: 16px 0 6px; font-family: ${font.tekst}; font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: ${color.tekstLicht}; }
.fwk-wp-feiten { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
.fwk-wp-feit { padding: 10px 12px; border: 1px solid ${color.lijn}; border-radius: 12px; background: ${color.achtergrond}; }
.fwk-wp-voortgang { height: 8px; border-radius: 999px; background: #E9EFEB; overflow: hidden; display: flex; }
.fwk-wp-pagina a:focus-visible, .fwk-wp-pagina button:focus-visible, .fwk-wp-pagina select:focus-visible, .fwk-wp-pagina input:focus-visible, .fwk-wp-pagina textarea:focus-visible, .fwk-wp-paneel a:focus-visible, .fwk-wp-paneel button:focus-visible, .fwk-wp-paneel select:focus-visible { outline: 2px solid ${color.groen}; outline-offset: 2px; }
@media (max-width: 960px) {
  .fwk-wp-kolommen { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 680px) {
  .fwk-wp-rij { grid-template-columns: minmax(0, 1fr) auto; }
  .fwk-wp-rij > .fwk-wp-kol { grid-column: 1 / 2; }
  .fwk-wp-rij > .fwk-wp-rij-eind { grid-column: 2 / 3; grid-row: 1 / span 2; align-self: start; }
  .fwk-wp-kol-label { display: inline; margin-right: 6px; }
  .fwk-wp-kol { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; }
  .fwk-wp-blok { padding: 16px; }
}
`;

export function WerkPagina({ children, testid }) {
  return (
    <div className="fwk-wp-pagina" data-testid={testid}>
      <style>{CSS_WERKPLEK}</style>
      <div className="fwk-wp-binnen">{children}</div>
    </div>
  );
}

// titel, meta (string of node: één regel kerngegevens), meta2 (optioneel tweede regel), acties (knoppen rechts),
// terug ({ href, label }), help (node met uitleg achter de Help-knop).
export function PaginaKop({ titel, meta, meta2, acties, terug, help, testid, titelTestid, metaTestid }) {
  return (
    <div className="fwk-wp-kop" data-testid={testid}>
      <div style={css('min-width: 0; flex: 1 1 320px;')}>
        {terug && (
          <a href={terug.href} className="fwk-wp-eyebrow">
            ← {terug.label}
          </a>
        )}
        <h1 data-testid={titelTestid}>{titel}</h1>
        {meta && (
          <div className="fwk-wp-meta" data-testid={metaTestid}>
            {meta}
          </div>
        )}
        {meta2 && <div className="fwk-wp-meta2">{meta2}</div>}
      </div>
      {(acties || help) && (
        <div className="fwk-wp-acties">
          {acties}
          {help && <HelpKnop>{help}</HelpKnop>}
        </div>
      )}
    </div>
  );
}

export function Blok({ titel, aantal, actie, children, testid, kaal = false, id, labelId }) {
  const auto = useId();
  const kopId = labelId || `${auto}-kop`;

  return (
    <section className={`fwk-wp-blok${kaal ? ' fwk-wp-kaal' : ''}`} data-testid={testid} aria-labelledby={titel ? kopId : undefined} id={id}>
      {(titel || actie) && (
        <div className="fwk-wp-blokkop">
          {titel && (
            <h2 id={kopId}>
              {titel}
              {aantal != null && <span className="fwk-wp-tel">{aantal}</span>}
            </h2>
          )}
          {actie}
        </div>
      )}
      {children}
    </section>
  );
}

// kolommen: [{ label, waarde, sub?, urgent? }]. href maakt de hele rij klikbaar via de titel (één link, geen geneste links);
// onOpen doet hetzelfde met een knop (bijv. zijpaneel). eind: chips/knoppen rechts (blijven los klikbaar).
export function Rij({ titel, sub, kolommen = [], eind, href, onOpen, actief = false, testid, data = {}, titelTestid }) {
  const klikbaar = Boolean(href || onOpen);

  return (
    <li
      className={`fwk-wp-rij${klikbaar ? ' fwk-wp-klik' : ''}`}
      style={{ '--kol': Math.max(kolommen.length, 0) }}
      data-testid={testid}
      aria-current={actief ? 'true' : undefined}
      {...data}
    >
      <div style={css('min-width: 0;')}>
        <div className="fwk-wp-rij-titel" data-testid={titelTestid}>
          {href ? (
            <a href={href}>{titel}</a>
          ) : onOpen ? (
            <button type="button" className="fwk-wp-heel" onClick={onOpen}>
              {titel}
            </button>
          ) : (
            titel
          )}
        </div>
        {sub && <div className="fwk-wp-rij-sub">{sub}</div>}
      </div>
      {kolommen.map((k, i) => (
        <div key={k.label || i} className="fwk-wp-kol">
          {k.label && <div className="fwk-wp-kol-label">{k.label}</div>}
          <div className={`fwk-wp-kol-waarde${k.urgent ? ' fwk-wp-urgent' : ''}`}>{k.waarde}</div>
          {k.sub && <div className="fwk-wp-kol-sub">{k.sub}</div>}
        </div>
      ))}
      <div className="fwk-wp-rij-eind">{eind}</div>
    </li>
  );
}

export function Rijen({ children, testid, label }) {
  return (
    <ul className="fwk-wp-rijen" data-testid={testid} aria-label={label}>
      {children}
    </ul>
  );
}

// toon: groen (standaard) | blauw | grijs | oranje | rood
export function Chip({ children, toon = 'groen', testid }) {
  return (
    <span className="fwk-wp-chip" data-toon={toon} data-testid={testid}>
      {children}
    </span>
  );
}

// Eén korte, passende vervolgstap als er (nog) niets is.
export function Leeg({ children, actie, testid }) {
  return (
    <div className="fwk-wp-leeg" data-testid={testid}>
      {children}
      {actie && <> {actie}</>}
    </div>
  );
}

// toon: succes | info | waarschuwing | fout
export function Melding({ children, toon = 'succes', testid, rol }) {
  return (
    <div className="fwk-wp-melding" data-toon={toon} data-testid={testid} role={rol || (toon === 'fout' ? 'alert' : 'status')}>
      {children}
    </div>
  );
}

// Uitleg hoort niet in de gewone interface: hij staat achter deze knop.
export function HelpKnop({ children, label = 'Help' }) {
  const [open, setOpen] = useState(false);
  const wortel = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;

    const toets = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const klik = (e) => {
      if (wortel.current && !wortel.current.contains(e.target)) setOpen(false);
    };

    document.addEventListener('keydown', toets);
    document.addEventListener('mousedown', klik);

    return () => {
      document.removeEventListener('keydown', toets);
      document.removeEventListener('mousedown', klik);
    };
  }, [open]);

  return (
    <span className="fwk-wp-help" ref={wortel}>
      <button type="button" className="fwk-wp-help-knop" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} data-testid="help-knop">
        <span aria-hidden="true">?</span> {label}
      </button>
      {open && (
        <div id={id} className="fwk-wp-help-paneel" role="note" data-testid="help-paneel">
          {children}
        </div>
      )}
    </span>
  );
}

// Zijpaneel voor details (rechts; op mobiel schermbreed). Escape en klikken naast het paneel sluiten het;
// de focus gaat naar het paneel en bij sluiten terug naar waar hij vandaan kwam.
export function Zijpaneel({ open, onSluit, titel, boven, children, testid, label }) {
  const paneel = useRef(null);
  const terug = useRef(null);
  const kopId = useId();

  useEffect(() => {
    if (!open) return undefined;

    terug.current = document.activeElement;

    const t = setTimeout(() => {
      if (paneel.current) paneel.current.focus();
    }, 0);
    const toets = (e) => {
      if (e.key === 'Escape') onSluit();
    };

    document.addEventListener('keydown', toets);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', toets);

      if (terug.current && typeof terug.current.focus === 'function') terug.current.focus();
    };
  }, [open, onSluit]);

  if (!open) return null;

  return (
    <>
      <style>{CSS_WERKPLEK}</style>
      <div className="fwk-wp-paneel-achter" onClick={onSluit} aria-hidden="true" />
      <aside ref={paneel} className="fwk-wp-paneel" role="dialog" aria-modal="true" aria-labelledby={kopId} aria-label={label} tabIndex={-1} data-testid={testid}>
        {boven}
        <div className="fwk-wp-paneel-kop">
          <h2 id={kopId}>{titel}</h2>
          <button type="button" className="fwk-wp-sluit" onClick={onSluit} aria-label="Sluiten" data-testid="zijpaneel-sluit">
            ×
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

// Tabs met aantallen. tabs: [{ id, label, aantal? }]
export function Tabs({ tabs, actief, onKies, label, testidPrefix = 'tab-btn-' }) {
  const refs = useRef({});

  const toetsen = (e, i) => {
    const doel = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];

    if (doel == null) return;

    e.preventDefault();

    const t = tabs[(doel + tabs.length) % tabs.length];

    onKies(t.id);

    if (refs.current[t.id]) refs.current[t.id].focus();
  };

  return (
    <div className="fwk-wp-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          type="button"
          role="tab"
          id={`wp-tab-${t.id}`}
          data-testid={`${testidPrefix}${t.id}`}
          aria-selected={actief === t.id}
          aria-controls={`wp-paneel-${t.id}`}
          tabIndex={actief === t.id ? 0 : -1}
          className="fwk-wp-tab"
          onClick={() => onKies(t.id)}
          onKeyDown={(e) => toetsen(e, i)}
        >
          {t.label}
          {t.aantal != null && <span className="fwk-wp-tel">{t.aantal}</span>}
        </button>
      ))}
    </div>
  );
}
