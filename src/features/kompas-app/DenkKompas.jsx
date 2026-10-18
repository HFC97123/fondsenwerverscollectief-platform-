// Het denkende kompas: draaiende ring en een zoekende naald, zolang Subsidie Kompas bezig is (chat en dekkingsplan).
// De keyframes staan ook in app.html; hier staan ze nogmaals zodat het icoon overal werkt. Met "beweging verminderen" staat het stil.
import React from 'react';
import { css } from '../../shared/lib/css.js';

const CSS_DENKEN = `
@keyframes sk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes sk-needle { 0% { transform: rotate(0deg); } 22% { transform: rotate(212deg); } 40% { transform: rotate(188deg); } 58% { transform: rotate(340deg); } 78% { transform: rotate(318deg); } 100% { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .fwk-denk-ring, .fwk-denk-naald { animation: none !important; } }
`;

export default function DenkKompas({ grootte = 38, label = 'Subsidie Kompas denkt na' }) {
  return (
    <div style={css('align-self: flex-start; padding: 2px 0 2px 4px;')}>
      <style>{CSS_DENKEN}</style>
      <svg viewBox="0 0 48 48" width={grootte} height={grootte} style={{ display: 'block' }} aria-label={label} role="img">
        <circle cx="24" cy="24" r="21" fill="none" stroke="#DCE7E1" strokeWidth="2" />
        <circle
          className="fwk-denk-ring"
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke="#4E9A6C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="34 98"
          style={{ transformBox: 'view-box', transformOrigin: '24px 24px', animation: 'sk-spin 1.5s linear infinite' }}
        />
        <g className="fwk-denk-naald" style={{ transformBox: 'view-box', transformOrigin: '24px 24px', animation: 'sk-needle 2.6s cubic-bezier(0.45, 0, 0.25, 1) infinite' }}>
          <polygon points="24,8 27.4,24 24,27 20.6,24" fill="#4E9A6C" />
          <polygon points="24,40 27.4,24 24,21 20.6,24" fill="#A9C9DE" />
        </g>
        <circle cx="24" cy="24" r="2.6" fill="#2C4A5E" />
      </svg>
    </div>
  );
}
