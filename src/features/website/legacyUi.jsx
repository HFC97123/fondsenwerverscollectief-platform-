// Gedeelde bouwstenen in de huisstijl. Houdt de pagina's kort.
import React from 'react';
import { css } from '../../shared/lib/css.js';

export const KLEUR = {
  donker: '#2C4A5E',
  groen: '#4E9A6C',
  pastelgroen: '#A8D5BA',
  pastelblauw: '#A9C9DE',
  achtergrond: '#F7F9F8',
  tekst: '#2E3A38',
  grijstekst: '#4B5C58',
  zacht: '#7B8985',
  lijn: '#E1EAE4',
  rood: '#9E3B2C',
};

export const inputStyle = css(`
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  padding: 13px 14px;
  border: 1px solid #D5E0D9;
  border-radius: 12px;
  background: #FFFFFF;
  font-family: 'Mulish', sans-serif;
  font-size: 15px;
  color: #2E3A38;
  outline: none;
`);

export const selectStyle = css(`
  box-sizing: border-box;
  min-height: 46px;
  padding: 12px 14px;
  border: 1px solid #D5E0D9;
  border-radius: 12px;
  background: #FFFFFF;
  font-family: 'Mulish', sans-serif;
  font-size: 14.5px;
  font-weight: 700;
  color: #2C4A5E;
  outline: none;
`);

export function Label({ children, style }) {
  return (
    <label style={{ ...css('display: grid; gap: 7px; align-content: start; font-size: 14px; font-weight: 700; color: #2C4A5E;'), ...(style || {}) }}>
      {children}
    </label>
  );
}

export function Button({ children, onClick, variant = 'primary', style }) {
  const varianten = {
    primary: 'background: #4E9A6C; color: #FFFFFF; border: none;',
    dark: 'background: #2C4A5E; color: #FFFFFF; border: none;',
    outline: 'background: #FFFFFF; color: #2C4A5E; border: 1px solid #D6E3E9;',
    danger: 'background: #FFFFFF; color: #9E3B2C; border: 1px solid #E1D3D0;',
    plain: 'background: none; color: #9E3B2C; border: none;',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...css(`
          cursor: pointer;
          box-sizing: border-box;
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 13px 22px;
          border-radius: 999px;
          font-family: 'Mulish', sans-serif;
          font-size: 14.5px;
          font-weight: 800;
          ${varianten[variant]}
        `),
        ...(style || {}),
      }}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel || label}
      onClick={onChange}
      style={css(`
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 44px;
        border: none;
        background: none;
        padding: 0;
      `)}
    >
      <span style={css(`
        position: relative;
        width: 52px;
        height: 30px;
        flex-shrink: 0;
        border-radius: 999px;
        background: ${on ? '#4E9A6C' : '#D5E0D9'};
        transition: background 0.2s ease;
      `)}
      >
        <span style={css(`
          position: absolute;
          top: 3px;
          left: ${on ? '26px' : '3px'};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 1px 3px rgba(44,74,94,0.25);
          transition: left 0.2s ease;
        `)}
        />
      </span>
      <span style={css(`
        font-family: 'Mulish', sans-serif;
        font-size: 14px;
        font-weight: 800;
        color: ${on ? '#2F6D47' : '#7B8985'};
        white-space: nowrap;
      `)}
      >
        {label}
      </span>
    </button>
  );
}

export function Melding({ children }) {
  if (!children) {
    return null;
  }

  return (
    <div style={css(`
      margin-top: 16px;
      padding: 13px 16px;
      border: 1px solid #BFD4C6;
      border-radius: 12px;
      background: #EAF4EE;
      font-size: 14.5px;
      font-weight: 700;
      color: #2F6D47;
    `)}
    >
      {children}
    </div>
  );
}

export function PaneelKop({ titel, intro }) {
  return (
    <>
      <h1 style={css(`
        margin: 0 0 10px;
        font-family: 'Newsreader', serif;
        font-size: clamp(26px, 3.6vw, 34px);
        font-weight: 600;
        color: #2C4A5E;
      `)}
      >
        {titel}
      </h1>
      <p style={css('margin: 0 0 26px; max-width: 700px; font-size: 15.5px; line-height: 1.7; color: #4B5C58;')}>
        {intro}
      </p>
    </>
  );
}

export function SectieKop({ children }) {
  return (
    <div style={css(`
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid #E1EAE4;
      font-family: 'Newsreader', serif;
      font-size: 21px;
      font-weight: 600;
      color: #2C4A5E;
    `)}
    >
      {children}
    </div>
  );
}

export function Paneel({ children }) {
  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <div style={css('max-width: 1180px; margin: 0 auto; padding: clamp(28px, 4.4vw, 56px) clamp(16px, 4vw, 24px) clamp(48px, 7vw, 90px);')}>
        <div style={css('padding: clamp(22px, 3.4vw, 40px); border: 1px solid #E1EAE4; border-radius: 26px; background: #FFFFFF;')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LeegBlok({ titel, tekst }) {
  return (
    <div style={css('padding: 26px 22px; border: 1px dashed #D5E0D9; border-radius: 18px; background: #F7F9F8;')}>
      <div style={css('margin-bottom: 6px; font-size: 15px; font-weight: 800; color: #2C4A5E;')}>{titel}</div>
      <div style={css('font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>{tekst}</div>
    </div>
  );
}
