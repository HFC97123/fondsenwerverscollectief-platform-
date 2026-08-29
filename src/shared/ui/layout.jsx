// Opmaak en structuur. Alle stijlen komen uit tokens.js.
import React from 'react';
import { css } from '../lib/css.js';
import { color, font, maxWidth, radius, space, type } from '../tokens.js';

// De vaste paginabreedte met de horizontale marge uit het ontwerp.
export function Container({ children, width = maxWidth.pagina, style }) {
  return (
    <div
      style={{
        ...css(`max-width: ${width}; margin: 0 auto; padding: 0 ${space.paginaX};`),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

// Volle band met een eigen achtergrond, voor het ritme van een pagina.
export function Band({ children, tone = 'wit', top, bottom, style }) {
  const tonen = {
    wit: `background: ${color.wit}; border-top: 1px solid #E9EFEB; border-bottom: 1px solid #E9EFEB;`,
    licht: `background: ${color.achtergrond};`,
    groen: `background: ${color.vlakGroen}; border-top: 1px solid ${color.lijnGroen}; border-bottom: 1px solid ${color.lijnGroen};`,
    donker: `background: ${color.donkerblauw};`,
  };

  return (
    <div
      style={{
        ...css(`
          padding: ${top || 'clamp(40px, 5.6vw, 78px)'} 0 ${bottom || 'clamp(40px, 5.6vw, 78px)'};
          ${tonen[tone]}
        `),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

export function Card({ children, tone = 'wit', pad, style }) {
  const tonen = {
    wit: `background: ${color.wit}; border: 1px solid ${color.lijn};`,
    licht: `background: ${color.achtergrond}; border: 1px solid ${color.lijn};`,
    groen: `background: ${color.vlakGroen}; border: 1px solid ${color.lijnGroen};`,
    blauw: `background: ${color.vlakBlauw}; border: 1px solid ${color.lijnBlauw};`,
    donker: `background: ${color.donkerblauw}; border: none;`,
  };

  return (
    <div
      style={{
        ...css(`
          padding: ${pad || space.xl};
          border-radius: ${radius.xl};
          ${tonen[tone]}
        `),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

// Paneel van de Kompas-werkomgeving: volledige pagina met één witte kaart.
export function Panel({ children }) {
  return (
    <div style={css(`min-height: 100vh; background: ${color.achtergrond};`)}>
      <Container style={css('padding-top: clamp(28px, 4.4vw, 56px); padding-bottom: clamp(48px, 7vw, 90px);')}>
        <div
          style={css(`
            padding: ${space.paneel};
            border: 1px solid ${color.lijn};
            border-radius: ${radius.paneel};
            background: ${color.wit};
          `)}
        >
          {children}
        </div>
      </Container>
    </div>
  );
}

export function Stack({ children, gap = space.s, direction = 'column', wrap = false, align, justify, style }) {
  return (
    <div
      style={{
        ...css(`
          display: flex;
          flex-direction: ${direction};
          gap: ${gap};
          ${wrap ? 'flex-wrap: wrap;' : ''}
          ${align ? `align-items: ${align};` : ''}
          ${justify ? `justify-content: ${justify};` : ''}
        `),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

// Responsief raster zonder media queries: kolommen vullen zich naar breedte.
export function Grid({ children, min = '250px', gap = space.l, style }) {
  return (
    <div
      style={{
        ...css(`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, ${min}), 1fr));
          gap: ${gap};
        `),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, tone = 'groen' }) {
  return (
    <div
      style={css(`
        margin-bottom: ${space.m};
        font-family: ${font.tekst};
        font-size: ${type.micro};
        font-weight: 800;
        letter-spacing: 0.12em;
        color: ${tone === 'groen' ? color.groen : color.pastelblauw};
      `)}
    >
      {children}
    </div>
  );
}

export function PageTitle({ children, size = type.hero, tone = 'donker', style }) {
  return (
    <h1
      style={{
        ...css(`
          margin: 0 0 ${space.l};
          font-family: ${font.kop};
          font-size: ${size};
          font-weight: 600;
          line-height: 1.15;
          color: ${tone === 'licht' ? color.wit : color.donkerblauw};
          text-wrap: balance;
        `),
        ...(style || {}),
      }}
    >
      {children}
    </h1>
  );
}

export function Lead({ children, tone = 'zacht', style }) {
  return (
    <p
      style={{
        ...css(`
          margin: 0;
          max-width: ${maxWidth.lead};
          font-family: ${font.tekst};
          font-size: ${type.leadGroot};
          line-height: 1.65;
          color: ${tone === 'licht' ? color.tekstOpDonkerZacht : color.tekstZacht};
        `),
        ...(style || {}),
      }}
    >
      {children}
    </p>
  );
}

// Kop van een paneel in de werkomgeving, met introductie.
export function PanelHeader({ title, intro }) {
  return (
    <>
      <h1
        style={css(`
          margin: 0 0 ${space.s};
          font-family: ${font.kop};
          font-size: ${type.paneelKop};
          font-weight: 600;
          color: ${color.donkerblauw};
        `)}
      >
        {title}
      </h1>
      {intro && (
        <p
          style={css(`
            margin: 0 0 26px;
            max-width: 700px;
            font-family: ${font.tekst};
            font-size: 15.5px;
            line-height: 1.7;
            color: ${color.tekstZacht};
          `)}
        >
          {intro}
        </p>
      )}
    </>
  );
}

export function SectionHeading({ children }) {
  return (
    <div
      style={css(`
        margin-bottom: 16px;
        padding-bottom: ${space.s};
        border-bottom: 1px solid ${color.lijn};
        font-family: ${font.kop};
        font-size: ${type.blokKop};
        font-weight: 600;
        color: ${color.donkerblauw};
      `)}
    >
      {children}
    </div>
  );
}

// Klein label boven een waarde, zoals BEDRAG en DEADLINE op de deadlineskaarten.
export function DataLabel({ children }) {
  return (
    <div
      style={css(`
        margin-bottom: 4px;
        font-family: ${font.tekst};
        font-size: ${type.label};
        font-weight: 800;
        letter-spacing: 0.05em;
        color: ${color.label};
      `)}
    >
      {children}
    </div>
  );
}
