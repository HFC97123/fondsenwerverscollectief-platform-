// Read-only voorstelpreview met verificatieblok per regel (Fase C). Toont wat de SERVER heeft vastgesteld; de interface bepaalt zelf niets.
// Geen knoppen die schrijven, geen opslag, geen koppeling met chat of taken. Fail-safe: bij een fout staat er alleen een melding.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import FinancieringsRegel from './FinancieringsRegel.jsx';
import { bouwPreviewModel, PREVIEW_FOUT } from './voorstelPreviewModel.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";

const STATUS_STIJL = {
  geverifieerd: { bg: '#E3F2E8', rand: '#B7DCC4', kleur: '#2F7A4D', teken: '✓' },
  gedeeltelijk: { bg: '#E6EFF6', rand: '#BFD5E6', kleur: '#2C4A5E', teken: '◐' },
  onzeker: { bg: '#FBF1E3', rand: '#EEDCC0', kleur: '#8A5A16', teken: '?' },
  conflict: { bg: '#FBE9E7', rand: '#F0C4BE', kleur: '#A3382B', teken: '!' },
  niet_gecontroleerd: { bg: '#EEF1F0', rand: '#D8DFDC', kleur: '#5D6B67', teken: '–' },
};

const VELD_STIJL = {
  confirmed: { kleur: '#2F7A4D', teken: '✓', label: 'Bevestigd' },
  uncertain: { kleur: '#8A5A16', teken: '?', label: 'Onzeker' },
  conflict: { kleur: '#A3382B', teken: '!', label: 'Conflict' },
  not_checked: { kleur: '#7B8985', teken: '–', label: 'Niet gecontroleerd' },
};

function Badge({ status, children }) {
  const s = STATUS_STIJL[status] || STATUS_STIJL.niet_gecontroleerd;

  return (
    <span
      data-testid="verificatie-status"
      data-status={status}
      style={css(`display: inline-flex; align-items: center; gap: 6px; padding: 3px 11px; border-radius: 999px; border: 1px solid ${s.rand}; background: ${s.bg}; color: ${s.kleur}; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800;`)}
    >
      <span aria-hidden="true">{s.teken}</span>
      {children}
    </span>
  );
}

function Verificatie({ v, reden, eindgebruikerTekst }) {
  const melding = reden || eindgebruikerTekst || v.melding;

  return (
    <div data-testid="verificatieblok" data-status={v.status} style={css('display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: 14px; background: #F7F9F8; border: 1px solid #E1EAE4;')}>
      <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
        <Badge status={v.status}>{v.label}</Badge>
        {v.gecontroleerdOp && <span style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>Gecontroleerd op {v.gecontroleerdOp}</span>}
      </div>

      {melding && (
        <div data-testid="verificatie-melding" style={css(`${TEKST} font-size: 13px;`)}>
          {melding}
        </div>
      )}

      {v.velden.length > 0 && (
        <ul data-testid="verificatie-velden" style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;')}>
          {v.velden.map((f) => {
            const s = VELD_STIJL[f.status] || VELD_STIJL.not_checked;

            return (
              <li key={f.label} data-testid="verificatie-veld" data-veld={f.label} data-status={f.status} style={css(`${TEKST} font-size: 13px; display: flex; flex-direction: column; gap: 2px;`)}>
                <span>
                  <span aria-hidden="true" style={css(`color: ${s.kleur}; font-weight: 800; display: inline-block; width: 16px;`)}>{s.teken}</span>
                  <strong>{f.label}</strong>: <span style={css(`color: ${s.kleur}; font-weight: 700;`)}>{s.label}</span>
                </span>
                {f.status === 'conflict' && (
                  <span data-testid="verificatie-conflict" style={css('padding-left: 16px; color: #A3382B;')}>
                    Website van de financier: {f.online || 'onbekend'} · Onze database: {f.database || 'onbekend'}. Controleer de actuele gegevens bij de financier.
                    {f.fragment && <em style={css('display: block; color: #6D7C77;')}>“{f.fragment}”</em>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {v.nietGecontroleerdOverig.length > 0 && (
        <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>Niet gecontroleerd: {v.nietGecontroleerdOverig.join(', ')}.</div>
      )}

      {v.bronUrl && (
        <div style={css(`${TEKST} font-size: 12.5px;`)}>
          Bron:{' '}
          <a data-testid="verificatie-bron" href={v.bronUrl} target="_blank" rel="noopener noreferrer nofollow" style={css('color: #4E9A6C; font-weight: 800; word-break: break-all;')}>
            {v.bronUrl}
          </a>
        </div>
      )}
    </div>
  );
}

const STIJL_DETAIL = `
.fwk-vr-rij { display: grid; grid-template-columns: minmax(110px, 160px) minmax(0, 1fr); column-gap: 12px; }
@media (max-width: 520px) { .fwk-vr-rij { grid-template-columns: minmax(0, 1fr); row-gap: 1px; } }
`;

function Rij({ label, children, testId }) {
  return (
    <div data-testid={testId} className="fwk-vr-rij" style={css('padding: 4px 0;')}>
      <dt style={css(`${TEKST} font-size: 12.5px; font-weight: 800; color: #7B8985;`)}>{label}</dt>
      <dd style={css(`${TEKST} font-size: 13.5px; margin: 0; min-width: 0; overflow-wrap: anywhere;`)}>{children}</dd>
    </div>
  );
}

const BRON_STIJL = {
  controleren: { bg: '#E6EFF6', rand: '#BFD5E6', kleur: '#2C4A5E', teken: '…' },
  gecontroleerd: { bg: '#E3F2E8', rand: '#B7DCC4', kleur: '#2F7A4D', teken: '✓' },
  onzeker: { bg: '#FBF1E3', rand: '#EEDCC0', kleur: '#8A5A16', teken: '?' },
  mislukt: { bg: '#FBE9E7', rand: '#F0C4BE', kleur: '#A3382B', teken: '!' },
  niet_gecontroleerd: { bg: '#EEF1F0', rand: '#D8DFDC', kleur: '#5D6B67', teken: '–' },
};

function datumTekst(iso) {
  const t = Date.parse(iso || '');

  return Number.isFinite(t) ? new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

// De bronstatus van de regel: of de bron is gecontroleerd. Los van de financieringsstatus; "Gecontroleerd" zegt niets over toekenning.
function BronBlok({ bron, onOpnieuw, bezig }) {
  const s = BRON_STIJL[bron.status] || BRON_STIJL.niet_gecontroleerd;
  const kanOpnieuw = typeof onOpnieuw === 'function' && bron.status !== 'controleren';

  return (
    <div data-testid="bronblok" data-status={bron.status} style={css('display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: 14px; background: #F7F9F8; border: 1px solid #E1EAE4;')}>
      <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
        <span data-testid="bron-status" data-status={bron.status} style={css(`display: inline-flex; align-items: center; gap: 6px; padding: 3px 11px; border-radius: 999px; border: 1px solid ${s.rand}; background: ${s.bg}; color: ${s.kleur}; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800;`)}>
          <span aria-hidden="true">{s.teken}</span>
          Bron: {bron.label}
        </span>
        {bron.gecontroleerdOp && <span style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>{bron.hergebruikt ? 'Eerder gecontroleerd op' : 'Gecontroleerd op'} {datumTekst(bron.gecontroleerdOp)}</span>}
      </div>
      <div data-testid="bron-uitleg" style={css(`${TEKST} font-size: 13px;`)}>
        {bron.uitleg}
        {bron.redenTekst ? ` ${bron.redenTekst}` : ''}
      </div>
      {kanOpnieuw && (
        <div>
          <button type="button" data-testid="bron-opnieuw" disabled={bezig} onClick={onOpnieuw} style={css("min-height: 36px; padding: 0 14px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800; cursor: pointer;")}>
            {bron.status === 'mislukt' ? 'Opnieuw proberen' : 'Opnieuw controleren'}
          </button>
        </div>
      )}
    </div>
  );
}

// De details van één voorgestelde regel. Alleen weergave van wat de server leverde; bevat zelf geen enkele controle.
// `bron` (optioneel): de bronstatus uit de aparte broncontrole; `toonVerificatie` (standaard aan): het blok met de verificatiedetails van de preview.
export function VoorstelRegelDetail({ r, bron = null, toonVerificatie = true, onOpnieuw = null, bezig = false }) {
  return (
    <div data-testid="voorstel-regel-detail" style={css('display: flex; flex-direction: column; gap: 12px;')}>
      <style>{STIJL_DETAIL}</style>
      <dl style={css('margin: 0;')}>
        <Rij label="Fonds / gever">{r.fondsnaam || '–'}</Rij>
        {r.regelingnaam && <Rij label="Regeling">{r.regelingnaam}</Rij>}
        <Rij label="Voorgesteld bedrag" testId="voorstel-regel-bedrag">
          {r.bedragTekst || 'Geen bedrag voorgesteld'}
          {r.bedragAangepast && <span style={css('display: block; font-size: 12px; color: #8A5A16;')}>Aangepast aan de grenzen van de regeling</span>}
        </Rij>
        {r.grenzenTekst && <Rij label="Bijdragegrenzen">{r.grenzenTekst}</Rij>}
        <Rij label="Deadline" testId="voorstel-regel-deadline">{r.deadlineTekst ? `${r.deadlineTekst} (volgens onze database)` : 'Geen deadline bekend'}</Rij>
        {r.extraVelden.map((v) => (
          <Rij key={v.label} label={v.label}>{v.waarde}</Rij>
        ))}
        <Rij label="Voorwaarden">
          {r.voorwaarden.length ? (
            <ul style={css('margin: 0; padding-left: 18px;')}>
              {r.voorwaarden.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            'Geen voorwaarden vermeld'
          )}
        </Rij>
        <Rij label="Cofinanciering">{r.cofinanciering ? `${r.cofinanciering} (niet automatisch gecontroleerd)` : 'Geen eis vermeld'}</Rij>
      </dl>

      {r.staatAl && <div style={css(`${TEKST} font-size: 13px; color: #8A5A16;`)}>Staat al in uw dekkingsplan en wordt niet opnieuw toegevoegd.</div>}

      {r.motivatie && (
        <div>
          <div style={css(LABEL)}>Waarom past dit bij uw project</div>
          <div data-testid="voorstel-regel-motivatie" style={css(`${TEKST} font-size: 13.5px;`)}>{r.motivatie}</div>
        </div>
      )}

      {r.onzekerheden.length > 0 && (
        <div>
          <div style={css(LABEL)}>Onzekerheden</div>
          <ul style={css(`${TEKST} font-size: 13px; margin: 2px 0 0; padding-left: 18px; color: #6D7C77;`)}>
            {r.onzekerheden.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {bron && <BronBlok bron={bron} onOpnieuw={onOpnieuw} bezig={bezig} />}
      {toonVerificatie && <Verificatie v={r.verificatie} reden={r.reden} eindgebruikerTekst={r.eindgebruikerTekst} />}
    </div>
  );
}

export default function VoorstelPreview({ antwoord }) {
  const model = useMemo(() => bouwPreviewModel(antwoord), [antwoord]);

  if (!model.ok) {
    return (
      <section data-testid="voorstel-preview" data-toestand="fout" role="alert" style={css(`${TEKST} padding: 14px 18px; border: 1px solid #EEDCC0; border-radius: 16px; background: #FBF1E3; color: #8A5A16;`)}>
        {model.melding || PREVIEW_FOUT}
      </section>
    );
  }

  return (
    <section data-testid="voorstel-preview" data-toestand="ok" data-opgeslagen="nee" style={css('box-sizing: border-box; padding: 20px 22px; border: 1px solid #CFE4D7; border-radius: 20px; background: #FFFFFF; display: flex; flex-direction: column; gap: 14px;')}>
      <div>
        <h2 style={css(`${LABEL} margin: 0 0 4px;`)}>Voorstel van Subsidiekompas (voorbeeld)</h2>
        <div data-testid="voorstel-niet-opgeslagen" style={css(`${TEKST} font-weight: 700; color: #2C4A5E;`)}>
          Dit is alleen een voorbeeld. Er is niets opgeslagen en er zijn geen taken aangemaakt.
        </div>
        {model.totalen.voorgesteld && (
          <div data-testid="voorstel-totalen" style={css(`${TEKST} font-size: 13px;`)}>
            Voorgesteld: <strong>{model.totalen.voorgesteld}</strong>
            {model.totalen.gat && <> · Nog te plannen: {model.totalen.gat}</>}
            {model.totalen.nietToegewezen && <> · Nog niet toegewezen: {model.totalen.nietToegewezen}</>}
          </div>
        )}
      </div>

      {model.regels.length === 0 && <div style={css(TEKST)}>Er zijn geen regels om te tonen.</div>}

      <div data-testid="voorstel-regels" style={css('display: flex; flex-direction: column; gap: 8px;')}>
        {model.regels.map((r) => (
          <FinancieringsRegel
            key={r.sleutel}
            testId="voorstel-regel"
            data-sleutel={r.sleutel}
            titel={r.naam}
            bedrag={r.bedragTekst}
            bedragLeeg="Geen bedrag"
            status={r.kop.status}
            samenvatting={r.kop.samenvatting}
          >
            <VoorstelRegelDetail r={r} />
          </FinancieringsRegel>
        ))}
      </div>

      {model.aantalOvergeslagen > 0 && (
        <div data-testid="voorstel-overgeslagen" style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>
          {model.aantalOvergeslagen === 1 ? '1 voorgestelde regel is' : `${model.aantalOvergeslagen} voorgestelde regels zijn`} niet getoond, omdat de gegevens niet beschikbaar of niet te controleren zijn.
        </div>
      )}
    </section>
  );
}
