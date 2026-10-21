// Documenten › Begroting: de projectbegroting, schoon en leeg om mee te beginnen. Het lid voegt zelf een kopje (tussenregel) toe en daaronder
// regels: omschrijving en bedrag, eventueel met aantal x tarief of als bijdrage in natura. Daaronder staat het dekkingsplan: toegekend,
// uitstaand en in planning, het totaal (dat gelijk moet zijn aan de begroting) en wat nog te dekken is. Het totaal van de kosten wordt de
// projectbegroting (project.begroting), waarmee de rest van Subsidie Kompas al rekent. Bedragen verzint niemand: een lege regel telt niet mee.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { color } from '../../../shared/tokens.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding } from '../../../shared/ui/werkplek.jsx';
import { AanvraagStijl, ProjectKeuze } from '../aanvraag/Bouwstenen.jsx';
import { dekkingVanProject, formatEuro } from '../financiering/dekkingsplan.js';
import { haalFinancieringVoorExport } from '../financiering/exportFinanciering.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { valideerEnBereidOp } from '../projectOpslaan.js';
import { CATEGORIEEN, berekenBegroting, categorieLabel, expenseLinesVoorExcel, leesBudgetRegels, nieuweRegel, regelBedrag, regelsVoorOpslag } from './begrotingModel.js';

const euro = (n) => `€ ${Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function BegrotingStijl() {
  return (
    <style>{`
.fwk-bg-rij { display: grid; grid-template-columns: minmax(0, 1fr) 132px auto; gap: 8px; align-items: center; margin: 0 0 8px; }
.fwk-bg-sub { text-align: right; font-weight: 800; color: ${color.donkerblauw}; font-size: 15px; white-space: nowrap; padding-right: 4px; }
.fwk-bg-veld { width: 100%; box-sizing: border-box; min-height: 40px; padding: 8px 10px; border: 1px solid ${color.lijnInput}; border-radius: 10px; background: ${color.wit}; font-family: inherit; font-size: 14.5px; color: ${color.tekst}; }
.fwk-bg-veld:focus { outline: 2px solid ${color.groen}; outline-offset: 1px; }
.fwk-bg-acties { display: flex; gap: 4px; align-items: center; }
.fwk-bg-icoon { cursor: pointer; width: 32px; height: 32px; border: none; background: none; border-radius: 999px; font-size: 16px; line-height: 1; color: ${color.tekstLicht}; }
.fwk-bg-icoon:hover { background: ${color.vlakGrijs}; color: ${color.donkerblauw}; }
.fwk-bg-detail { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: flex-end; margin: -2px 0 10px; padding: 8px 10px; border-radius: 10px; background: ${color.vlakGrijs}; }
.fwk-bg-detail label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: ${color.tekstLicht}; }
.fwk-bg-detail .fwk-bg-veld { width: 110px; min-height: 36px; }
.fwk-bg-plus { cursor: pointer; border: none; background: none; padding: 6px 2px; font-family: inherit; font-size: 13.5px; font-weight: 800; color: ${color.groen}; }
.fwk-bg-plus:hover { text-decoration: underline; }
.fwk-bg-lijn { display: flex; align-items: center; gap: 10px; margin: 2px 0 0; }
.fwk-bg-lijn::after { content: ''; flex: 1; height: 1px; background: ${color.lijn}; }
.fwk-bg-chip { cursor: pointer; border: 1px dashed ${color.lijnInput}; background: ${color.wit}; border-radius: 999px; padding: 5px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: ${color.donkerblauw}; }
.fwk-bg-chip:hover { border-color: ${color.groen}; }
.fwk-bg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 6px; }
.fwk-bg-natura { cursor: pointer; border: 1px solid ${color.lijnInput}; background: ${color.wit}; border-radius: 999px; padding: 6px 12px; font-family: inherit; font-size: 12.5px; font-weight: 800; color: ${color.tekstGrijs}; }
.fwk-bg-natura[aria-pressed="true"] { background: ${color.vlakGroen}; border-color: ${color.lijnGroen}; color: ${color.succes}; }
@media (max-width: 560px) { .fwk-bg-rij { grid-template-columns: minmax(0, 1fr) 104px auto; } }
`}</style>
  );
}

function Regel({ r, focus, onWijzig, onWeg }) {
  const b = regelBedrag(r);
  const berekend = b.bron === 'berekend';
  const [meer, setMeer] = useState(false); // aantal, tarief en in natura staan achter ⋯, zodat de regel zelf schoon blijft

  return (
    <div data-testid="bg-regel">
      <div className="fwk-bg-rij">
        <input className="fwk-bg-veld" aria-label="Omschrijving" data-testid="bg-omschrijving" value={r.omschrijving} maxLength={200} autoFocus={focus} onChange={(e) => onWijzig({ omschrijving: e.target.value })} placeholder="Omschrijving" />
        {berekend ? (
          <div className="fwk-bg-sub" data-testid="bg-bedrag-berekend">
            {euro(b.bedrag)}
          </div>
        ) : (
          <input className="fwk-bg-veld" aria-label="Bedrag in euro" data-testid="bg-bedrag" inputMode="decimal" value={r.bedrag} onChange={(e) => onWijzig({ bedrag: e.target.value })} placeholder="€" style={css('text-align: right;')} />
        )}
        <div className="fwk-bg-acties">
          {r.soort === 'natura' && !meer && (
            <span className="fwk-aa-klein" data-testid="bg-natura-label">
              natura
            </span>
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
          <button type="button" className="fwk-bg-natura" aria-pressed={r.soort === 'natura'} data-testid="bg-natura" onClick={() => onWijzig({ soort: r.soort === 'natura' ? 'geld' : 'natura' })}>
            In natura
          </button>
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
  const [kopjeOpen, setKopjeOpen] = useState(beginRegels.length === 0);
  const [focusId, setFocusId] = useState('');
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fin, setFin] = useState(null); // { regels, dekking, beschikbaar }

  // Een ander project: de regels van dat project laden.
  useEffect(() => {
    const r = leesBudgetRegels(project && project.budgetRegels);

    setRegels(r);
    setBasis(JSON.stringify(r));
    setExtra([]);
    setPlusOpen(null);
    setKopjeOpen(r.length === 0);
    setFout('');
    setMelding('');
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

  const zichtbaar = CATEGORIEEN.filter((c) => regels.some((r) => r.categorie === c.id) || extra.includes(c.id));
  const nietZichtbaar = CATEGORIEEN.filter((c) => !zichtbaar.some((z) => z.id === c.id));

  const wijzig = (id, wijz) => {
    setRegels((cur) => cur.map((r) => (r.id === id ? { ...r, ...wijz } : r)));
    setMelding('');
    setFout('');
  };
  const voegToe = (categorie, basisRegel = {}) => {
    const n = nieuweRegel(categorie, basisRegel);

    setRegels((cur) => [...cur, n]);
    setFocusId(basisRegel.omschrijving ? '' : n.id);
    setPlusOpen(null);
    setMelding('');
  };
  const weg = (id) => {
    setRegels((cur) => cur.filter((r) => r.id !== id));
    setMelding('');
  };
  const kiesKopje = (id) => {
    setExtra((cur) => (cur.includes(id) ? cur : [...cur, id]));
    setKopjeOpen(false);
    setPlusOpen(id);
  };

  const opslaan = async () => {
    const klaar = regelsVoorOpslag(regels);

    if (!klaar.ok) {
      setFout(klaar.fout);

      return;
    }

    setBezig(true);
    setFout('');

    const nieuweBegroting = totaal > 0 ? Math.round(totaal) : project.begroting;
    const check = valideerEnBereidOp({ ...project, budgetRegels: klaar.regels, begroting: nieuweBegroting });

    if (!check.ok) {
      setFout(check.fout);
      setBezig(false);

      return;
    }

    const id = await Promise.resolve(store.saveProject(check.project));

    setBezig(false);

    if (id === null) {
      setFout('Opslaan lukte niet. Probeer het opnieuw.');

      return;
    }

    const opgeslagen = leesBudgetRegels(klaar.regels);

    setRegels(opgeslagen);
    setBasis(JSON.stringify(opgeslagen));
    setMelding(totaal > 0 ? `Opgeslagen. De projectbegroting is nu ${formatEuro(totaal)}.` : 'Opgeslagen.');
    laadFin();
  };

  const downloadExcel = async () => {
    setFout('');

    try {
      const [{ berekenBudget }, { generateExcelDocument, bepaalExcelBestandsnaam }] = await Promise.all([import('../../../shared/budget/berekenBudget.js'), import('../../../shared/budget/generateExcelDocument.js')]);
      const naam = (store && store.orgProfile && store.orgProfile.name) || null;
      const p = { ...project, begroting: begrotingVoorDekking };
      const budget = berekenBudget(expenseLinesVoorExcel(regels), p, {}, fin && fin.beschikbaar ? { regels: fin.regels, dekking: dekkingVanProject(p, fin.regels) } : undefined);
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

      <Blok
        titel="Begroting"
        testid="bg-begroting"
        actie={
          <span data-testid="bg-totaal" style={css('font-weight: 800; font-size: 17px;')}>
            Totaal {euro(totaal)}
          </span>
        }
      >
        {regels.length === 0 && project.begroting ? (
          <div className="fwk-aa-klein" data-testid="bg-leeg" style={css('margin-bottom: 8px;')}>
            Bij Projecten staat nu {formatEuro(project.begroting)}.
          </div>
        ) : null}

        {zichtbaar.map((c) => {
          const rijen = regels.filter((r) => r.categorie === c.id);
          const deel = totalen.perCategorie.find((x) => x.id === c.id);
          const gebruikt = new Set(rijen.map((r) => r.omschrijving.trim().toLowerCase()));
          const open = plusOpen === c.id;

          return (
            <section key={c.id} data-testid={`bg-kopje-${c.id}`} style={css('margin: 0 0 16px;')}>
              <div className="fwk-wp-blokkop" style={css('margin: 14px 0 8px;')}>
                <h3 style={css(`margin: 0; font-size: 15.5px; font-weight: 800; color: ${color.donkerblauw};`)}>{c.label}</h3>
                <span className="fwk-aa-klein" data-testid={`bg-sub-${c.id}`}>
                  {deel ? euro(deel.subtotaal) : euro(0)}
                  {deel && deel.natura > 0 ? ` + ${euro(deel.natura)} in natura` : ''}
                </span>
              </div>

              {rijen.map((r) => (
                <Regel key={r.id} r={r} focus={focusId === r.id} onWijzig={(w) => wijzig(r.id, w)} onWeg={() => weg(r.id)} />
              ))}

              {open ? (
                <div className="fwk-bg-chips" data-testid={`bg-suggesties-${c.id}`}>
                  {c.suggesties
                    .filter(([naam]) => !gebruikt.has(naam.toLowerCase()))
                    .map(([naam, eenheid]) => (
                      <button key={naam} type="button" className="fwk-bg-chip" data-testid="bg-suggestie" onClick={() => voegToe(c.id, { omschrijving: naam, eenheid })}>
                        {naam}
                      </button>
                    ))}
                  <button type="button" className="fwk-bg-chip" data-testid="bg-eigen-regel" onClick={() => voegToe(c.id)}>
                    Eigen regel
                  </button>
                </div>
              ) : (
                <div className="fwk-bg-lijn">
                  <button type="button" className="fwk-bg-plus" data-testid={`bg-plus-${c.id}`} onClick={() => setPlusOpen(c.id)}>
                    + Regel
                  </button>
                </div>
              )}
            </section>
          );
        })}

        {nietZichtbaar.length > 0 && (
          <div style={css('margin: 6px 0 4px;')}>
            {kopjeOpen ? (
              <div className="fwk-bg-chips" data-testid="bg-kopjes">
                {nietZichtbaar.map((c) => (
                  <button key={c.id} type="button" className="fwk-bg-chip" data-testid={`bg-kopje-kies-${c.id}`} onClick={() => kiesKopje(c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="fwk-bg-lijn">
                <button type="button" className="fwk-bg-plus" data-testid="bg-plus-kopje" onClick={() => setKopjeOpen(true)}>
                  + Kopje
                </button>
              </div>
            )}
          </div>
        )}

        {totalen.zonderBedrag.length > 0 && (
          <div className="fwk-aa-klein" data-testid="bg-zonder-bedrag" style={css('margin: 10px 0;')}>
            Nog geen bedrag bij: {totalen.zonderBedrag.map((r) => r.omschrijving || categorieLabel(r.categorie)).join(', ')}. Deze regels tellen nog niet mee.
          </div>
        )}
        {totalen.totaalNatura > 0 && (
          <div className="fwk-aa-klein" data-testid="bg-natura-totaal" style={css('margin: 10px 0;')}>
            In natura (telt niet mee in het totaal): {euro(totalen.totaalNatura)}.
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
              <div className="fwk-aa-regel" data-testid="bg-nog-te-plannen" style={css('padding: 3px 0;')}>
                <span>Nog te dekken</span>
                <b>{euro(dek.nogTePlannen)}</b>
              </div>
              {dek.planVolledig && (
                <div style={css('margin-top: 8px;')}>
                  <Chip testid="bg-sluit">{dek.overgedekt > 0 ? `Sluitend, ${euro(dek.overgedekt)} meer dan de begroting` : 'Sluitend'}</Chip>
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
