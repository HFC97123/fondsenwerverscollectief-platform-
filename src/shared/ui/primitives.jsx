// Interactieve primitieven. Alle stijlen komen uit tokens.js.
import React from 'react';
import { css } from '../lib/css.js';
import { color, font, radius, tap, type } from '../tokens.js';

const KNOP_VARIANT = {
  primary: `background: ${color.groen}; color: ${color.wit}; border: none;`,
  dark: `background: ${color.donkerblauw}; color: ${color.wit}; border: none;`,
  outline: `background: ${color.wit}; color: ${color.donkerblauw}; border: 1px solid ${color.lijnBlauw};`,
  ghost: `background: none; color: ${color.donkerblauw}; border: none;`,
  danger: `background: ${color.wit}; color: ${color.fout}; border: 1px solid #E1D3D0;`,
  plain: `background: none; color: ${color.fout}; border: none;`,
  link: `background: none; color: ${color.groen}; border: none; padding: 0;`,
};

const KNOP_MAAT = {
  s: `min-height: 40px; padding: 10px 18px; font-size: ${type.kleiner};`,
  m: `min-height: 46px; padding: 13px 22px; font-size: ${type.knop};`,
  l: `min-height: 52px; padding: 15px 30px; font-size: ${type.bodyKlein};`,
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'm',
  block = false,
  disabled = false,
  ariaLabel,
  style,
  type: htmlType = 'button',
}) {
  return (
    <button
      type={htmlType}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        ...css(`
          cursor: ${disabled ? 'default' : 'pointer'};
          opacity: ${disabled ? 0.55 : 1};
          box-sizing: border-box;
          display: ${block ? 'flex' : 'inline-flex'};
          width: ${block ? '100%' : 'auto'};
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: ${radius.pil};
          font-family: ${font.tekst};
          font-weight: 800;
          white-space: nowrap;
          ${KNOP_MAAT[size]}
          ${KNOP_VARIANT[variant]}
        `),
        ...(style || {}),
      }}
    >
      {children}
    </button>
  );
}

const VELD_BASIS = `
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  padding: 13px 14px;
  border: 1px solid ${color.lijnInput};
  border-radius: ${radius.m};
  background: ${color.wit};
  font-family: ${font.tekst};
  font-size: ${type.bodyKlein};
  color: ${color.tekst};
  outline: none;
`;

export const veldStijl = css(VELD_BASIS);

export function Input({ value, onChange, placeholder, ariaLabel, type: inputType = 'text', style }) {
  return (
    <input
      type={inputType}
      value={value == null ? '' : value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{ ...veldStijl, ...(style || {}) }}
    />
  );
}

export function Textarea({ value, onChange, placeholder, rows = 4, ariaLabel, style }) {
  return (
    <textarea
      value={value == null ? '' : value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      aria-label={ariaLabel}
      style={{ ...veldStijl, lineHeight: 1.6, resize: 'vertical', ...(style || {}) }}
    />
  );
}

// Losse stijl voor een select die niet via het component loopt.
export const selectStijl = css(`
  box-sizing: border-box;
  min-height: 46px;
  padding: 12px 14px;
  border: 1px solid ${color.lijnInput};
  border-radius: ${radius.m};
  background: ${color.wit};
  font-family: ${font.tekst};
  font-size: ${type.knop};
  font-weight: 700;
  color: ${color.donkerblauw};
  outline: none;
`);

export function Select({ value, onChange, options, ariaLabel, style }) {
  return (
    <select
      value={value == null ? '' : value}
      onChange={onChange}
      aria-label={ariaLabel}
      style={{
        ...selectStijl,
        ...(style || {}),
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, children, span }) {
  return (
    <label
      style={{
        ...css(`
          display: grid;
          gap: 7px;
          align-content: start;
          font-family: ${font.tekst};
          font-size: ${type.klein};
          font-weight: 700;
          color: ${color.donkerblauw};
        `),
        ...(span ? { gridColumn: span } : {}),
      }}
    >
      {label}
      {children}
    </label>
  );
}

// Filterpil met optioneel aantal. Toetsenbordbediening zit in de button zelf.
export function Pill({ label, count, active = false, onClick, shape = 'blok' }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={css(`
        cursor: pointer;
        box-sizing: border-box;
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: ${shape === 'blok' ? 'space-between' : 'flex-start'};
        gap: 10px;
        padding: ${shape === 'blok' ? '9px 13px' : '10px 16px'};
        border: 1px solid ${active ? color.lijnGroenSterk : color.lijn};
        border-radius: ${shape === 'blok' ? radius.m : radius.pil};
        background: ${active ? color.vlakGroen : color.wit};
        color: ${active ? color.succes : '#3D4B48'};
        font-family: ${font.tekst};
        font-size: ${type.kleiner};
        font-weight: 700;
        text-align: left;
      `)}
    >
      <span>{label}</span>
      {count != null && (
        <span style={css(`font-size: 12px; color: ${color.tekstLicht};`)}>{count}</span>
      )}
    </button>
  );
}

export function Badge({ children, tone = 'blauw' }) {
  const tonen = {
    groen: `background: ${color.vlakGroen}; color: ${color.succes}; border-color: ${color.lijnGroenSterk};`,
    blauw: `background: ${color.vlakBlauw}; color: ${color.donkerblauw}; border-color: ${color.lijnBlauw};`,
    grijs: `background: ${color.vlakGrijs}; color: ${color.tekstZacht}; border-color: ${color.lijn};`,
  };

  return (
    <span
      style={css(`
        display: inline-flex;
        align-items: center;
        padding: 5px 13px;
        border: 1px solid transparent;
        border-radius: ${radius.pil};
        font-family: ${font.tekst};
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
        ${tonen[tone]}
      `)}
    >
      {children}
    </span>
  );
}

// Statusbadge van een subsidieregeling; kleuren komen uit statusStyle.
export function StatusBadge({ status, palet }) {
  const s = palet || { bg: color.vlakBlauw, color: color.donkerblauw, border: color.lijnBlauw };

  return (
    <span
      style={css(`
        padding: 6px 14px;
        border: 1px solid ${s.border};
        border-radius: ${radius.pil};
        background: ${s.bg};
        color: ${s.color};
        font-family: ${font.tekst};
        font-size: ${type.micro};
        font-weight: 800;
        white-space: nowrap;
      `)}
    >
      {status}
    </span>
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
        min-height: ${tap};
        border: none;
        background: none;
        padding: 0;
      `)}
    >
      <span
        style={css(`
          position: relative;
          width: 52px;
          height: 30px;
          flex-shrink: 0;
          border-radius: ${radius.pil};
          background: ${on ? color.groen : color.lijnInput};
          transition: background 0.2s ease;
        `)}
      >
        <span
          style={css(`
            position: absolute;
            top: 3px;
            left: ${on ? '26px' : '3px'};
            width: 24px;
            height: 24px;
            border-radius: ${radius.rond};
            background: ${color.wit};
            box-shadow: 0 1px 3px rgba(44,74,94,0.25);
            transition: left 0.2s ease;
          `)}
        />
      </span>
      {label && (
        <span
          style={css(`
            font-family: ${font.tekst};
            font-size: ${type.klein};
            font-weight: 800;
            color: ${on ? color.succes : color.tekstLicht};
            white-space: nowrap;
          `)}
        >
          {label}
        </span>
      )}
    </button>
  );
}

// Chipselectie: meerdere waarden aan of uit.
export function ChipGroup({ options, value = [], onToggle }) {
  return (
    <span style={css('display: flex; flex-wrap: wrap; gap: 8px;')}>
      {options.map((optie) => (
        <Pill
          key={optie}
          label={optie}
          shape="pil"
          active={value.indexOf(optie) !== -1}
          onClick={() => onToggle(optie)}
        />
      ))}
    </span>
  );
}
