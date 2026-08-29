// Terugkoppeling: laden, leeg, fout en bevestiging.
import React from 'react';
import { css } from '../lib/css.js';
import { color, font, radius, space, type } from '../tokens.js';
import { Button } from './primitives.jsx';

// Skeletonrijen in plaats van een spinner.
export function SkeletonRows({ count = 6, widths }) {
  const breedtes = widths || ['62%', '48%', '70%', '55%', '64%', '44%'];

  return (
    <div style={css(`display: flex; flex-direction: column; gap: ${space.s};`)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={css(`
            padding: 20px 22px;
            border: 1px solid ${color.lijn};
            border-radius: ${radius.xl};
            background: ${color.wit};
          `)}
        >
          <div
            style={css(`
              height: 15px;
              width: ${breedtes[i % breedtes.length]};
              border-radius: 6px;
              background: #EDF2EF;
              margin-bottom: 12px;
            `)}
          />
          <div style={css(`height: 11px; width: 34%; border-radius: 6px; background: ${color.vlakGrijs};`)} />
        </div>
      ))}
    </div>
  );
}

export function Notice({ children, tone = 'succes', style }) {
  if (!children) {
    return null;
  }

  const tonen = {
    succes: `border-color: ${color.lijnGroenSterk}; background: ${color.vlakGroen}; color: ${color.succes};`,
    fout: `border-color: ${color.foutLijn}; background: ${color.foutVlak}; color: ${color.fout};`,
    info: `border-color: ${color.lijnBlauw}; background: ${color.vlakBlauw}; color: ${color.donkerblauw};`,
  };

  return (
    <div
      style={{
        ...css(`
          margin-top: 16px;
          padding: 13px 16px;
          border: 1px solid transparent;
          border-radius: ${radius.m};
          font-family: ${font.tekst};
          font-size: ${type.knop};
          line-height: 1.6;
          font-weight: 700;
          ${tonen[tone]}
        `),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

// Leeg vlak met gestippelde rand: er is nog niets, en dat is geen fout.
export function EmptyState({ title, text, action }) {
  return (
    <div
      style={css(`
        padding: 26px 22px;
        border: 1px dashed ${color.lijnInput};
        border-radius: 18px;
        background: ${color.achtergrond};
      `)}
    >
      {title && (
        <div
          style={css(`
            margin-bottom: ${space.xs};
            font-family: ${font.tekst};
            font-size: ${type.bodyKlein};
            font-weight: 800;
            color: ${color.donkerblauw};
          `)}
        >
          {title}
        </div>
      )}
      <div
        style={css(`
          font-family: ${font.tekst};
          font-size: ${type.knop};
          line-height: 1.65;
          color: ${color.tekstZacht};
        `)}
      >
        {text}
      </div>
      {action && <div style={css(`margin-top: ${space.l};`)}>{action}</div>}
    </div>
  );
}

// Geen resultaten na filteren: witte kaart met een uitweg.
export function NoResults({ title, text, onClear, clearLabel = 'Wis filters' }) {
  return (
    <div
      style={css(`
        padding: 34px 26px;
        border: 1px solid ${color.lijn};
        border-radius: 18px;
        background: ${color.wit};
      `)}
    >
      <div
        style={css(`
          margin-bottom: 8px;
          font-family: ${font.kop};
          font-size: 22px;
          font-weight: 600;
          color: ${color.donkerblauw};
        `)}
      >
        {title}
      </div>
      <div
        style={css(`
          margin-bottom: ${space.l};
          font-family: ${font.tekst};
          font-size: ${type.bodyKlein};
          line-height: 1.65;
          color: ${color.tekstZacht};
        `)}
      >
        {text}
      </div>
      {onClear && <Button onClick={onClear}>{clearLabel}</Button>}
    </div>
  );
}

export function ErrorState({ text, onRetry, retryLabel = 'Opnieuw proberen' }) {
  return (
    <div
      style={css(`
        padding: 26px 24px;
        border: 1px solid ${color.foutLijn};
        border-radius: 18px;
        background: ${color.foutVlak};
      `)}
    >
      <div
        style={css(`
          margin-bottom: ${space.m};
          font-family: ${font.tekst};
          font-size: 15.5px;
          line-height: 1.6;
          font-weight: 700;
          color: ${color.fout};
        `)}
      >
        {text}
      </div>
      {onRetry && (
        <Button variant="dark" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

// Vangt een fout in een deelboom op zodat één stuk stuk gaat en niet de pagina.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: false };
  }

  static getDerivedStateFromError() {
    return { fout: true };
  }

  render() {
    if (this.state.fout) {
      return (
        <ErrorState
          text={this.props.text || 'Dit onderdeel kon niet worden geladen.'}
          onRetry={() => this.setState({ fout: false })}
        />
      );
    }

    return this.props.children;
  }
}
