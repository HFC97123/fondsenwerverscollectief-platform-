// Documenten › Begroting: de projectbegroting per regel, met kopjes (categorieën), en daaronder het dekkingsplan
// (gegeven, uitstaande en geplande bijdragen) tot de begroting sluit. Het totaal van de kosten wordt de projectbegroting
// (project.begroting), waarmee de rest van Subsidie Kompas al rekent. Bedragen verzint niemand: een lege regel telt niet mee.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { color } from '../../../shared/tokens.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding } from '../../../shared/ui/werkplek.jsx';
import { AanvraagStijl, ProjectKeuze } from '../aanvraag/Bouwstenen.jsx';
import { dekkingVanProject, formatEuro, STATUS_LABEL } from '../financiering/dekkingsplan.js';
import { haalFinancieringVoorExport } from '../financiering/exportFinanciering.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { valideerEnBereidOp } from '../projectOpslaan.js';
import { CATEGORIEEN, berekenBegroting, categorieLabel, expenseLinesVoorExcel, leesBudgetRegels, nieuweRegel, regelBedrag, regelsVoorOpslag } from './begrotingModel.js';

const euro = (n) => `€ ${Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function BegrotingStijl() {
  return (
    <style>{`
.fwk-bg-rij { display: grid; grid-template-columns: minmax(0, 2.4fr) 72px minmax(0, 1fr) 96px 112px 118px; gap: 8px; align-items: center; margin: 0 0 8px; }
.fwk-bg-kop { font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${color.tekstLicht}; margin-bottom: 4px; }
.fwk-bg-sub { text-align: right; font-weight: 800; color: ${color.donkerblauw}; font-size: 14.5px; white-space: nowrap; }
.fwk-bg-veld { width: 100%; box-sizing: border-box; min-height: 40px; padding: 8px 10px; border: 1px solid ${color.lijnInput}; border-radius: 10px; background: ${color.wit}; font-family: inherit; font-size: 14.5px; color: ${color.tekst}; }
.fwk-bg-veld:focus { outline: 2px solid ${color.groen}; outline-offset: 1px; }
.fwk-bg-acties { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
.fwk-bg-mini { cursor: pointer; border: 1px solid ${color.lijnInput}; background: ${color.wit}; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 800; color: ${color.tekstGrijs}; }
.fwk-bg-mini[aria-pressed="true"] { background: ${color.vlakGroen}; border-color: ${color.lijnGroen}; color: ${color.succes}; }
.fwk-bg-chip { cursor: pointer; border: 1px dashed ${color.lijnInput}; background: ${color.wit}; border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 700; color: ${color.donkerblauw}; }
.fwk-bg-chip:hover { border-color: ${color.groen}; }
.fwk-bg-kopregel { display: grid; grid-template-columns: minmax(0, 2.4fr) 72px minmax(0, 1fr) 96px 112px 118px; gap: 8px; }
@media (max-width: 760px) {
  .fwk-bg-kopregel { display: none; }
  .fwk-bg-rij { grid-template-columns: 1fr 1fr; padding: 10px; border: 1px solid ${color.lijn}; border-radius: 12px; }
  .fwk-bg-rij > :first-child { grid-column: 1 / -1; }
  .fwk-bg-acties { grid-column: 1 / -1; justify-content: space-between; }
}
`}</style>
  );
}

function Regel({ r, onWijzig, onWeg }) {
  const b = regelBedrag(r);
  const berekend = b.bron === 'berekend';

  return (
    <div className="fwk-bg-rij" data-testid="bg-regel">
      <input className="fwk-bg-veld" aria-label="Omschrijving" data-testid="bg-omschrijving" value={r.omschrijving} maxLength={200} onChange={(e) => onWijzig({ omschrijving: e.target.value })} placeholder="Omschrijving" />
      <input className="fwk-bg-veld" aria-label="Aantal" data-testid="bg-aantal" inputMode="decimal" value={r.aantal} onChange={(e) => onWijzig({ aantal: e.target.value })} placeholder="Aantal" />
      <input className="fwk-bg-veld" aria-label="Eenheid" data-testid="bg-eenheid" value={r.eenheid} maxLength={40} onChange={(e) => onWijzig({ eenheid: e.target.value })} placeholder="Eenheid" />
      <input className="fwk-bg-veld" aria-label="Tarief in euro" data-testid="bg-tarief" inputMode="decimal" value={r.tarief} onChange={(e) => onWijzig({ tarief: e.target.value })} placeholder="Tarief €" />
      {berekend ? (
        <div className="fwk-bg-sub" data-testid="bg-bedrag-berekend">
          {euro(b.bedrag)}
        </div>
      ) : (
        <input className="fwk-bg-veld" aria-label="Bedrag in euro" data-testid="bg-bedrag" inputMode="decimal" value={r.bedrag} onChange={(e) => onWijzig({ bedrag: e.target.value })} placeholder="Bedrag €" />
      )}
      <div className="fwk-bg-acties">
        <button type="button" className="fwk-bg-mini" aria-pressed={r.soort === 'natura'} data-testid="bg-natura" onClick={() => onWijzig({ soort: r.soort === 'natura' ? 'geld' : 'natura' })}>
          In natura
        </button>
        <button type="button" className="fwk-bg-mini" aria-label="Regel verwijderen" data-testid="bg-weg" onClick={onWeg}>
          ✕
        </button>
      </div>
    </div>
  );
}

function DekkingRij({ naam, bedrag, sub }) {
  return (
    <div className="fwk-aa-regel" style={css('padding: 4px 0;')}>
      <span>
        {naam}
        {sub && <span className="fwk-aa-klein"> ({sub})</span>}
      </span>
      <b>{bedrag == null ? 'bedrag volgt' : euro(bedrag)}</b>
    </div>
  );
}

export default function BegrotingTab({ project, projecten, onKiesProject, store }) {
  const projectId = project ? project.id : '';
  const [regels, setRegels] = useState(() => leesBudgetRegels(project && project.budgetRegels));
  const [basis, setBasis] = useState(() => JSON.stringify(leesBudgetRegels(project && project.budgetRegels)));
  const [extra, setExtra] = useState([]); // lege kopjes die het lid zelf heeft toegevoegd
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
    setFout('');
    setMelding('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const laadFin = useCallback(async () => {
    if (!project) return;

    const f = await haalFinancieringVoorExport(project);

    setFin(f);
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
    setRegels((cur) => [...cur, nieuweRegel(categorie, basisRegel)]);
    setMelding('');
  };
  const weg = (id) => {
    setRegels((cur) => cur.filter((r) => r.id !== id));
    setMelding('');
  };
  const kiesKopje = (id) => {
    if (!id) return;

    setExtra((cur) => (cur.includes(id) ? cur : [...cur, id]));
    voegToe(id);
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

  const gegeven = (fin ? fin.regels : []).filter((r) => r.status === 'awarded');
  const uitstaand = (fin ? fin.regels : []).filter((r) => r.status === 'submitted');
  const gepland = (fin ? fin.regels : []).filter((r) => r.status === 'interesting' || r.status === 'preparing');
  const bedragVan = (r) => (r.status === 'awarded' ? (r.awarded != null ? r.awarded : r.requested) : r.requested);
  const begr = dek.begroting;
  const sluit = dek.heeftBegroting && dek.planVolledig;

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
        {regels.length === 0 && (
          <div className="fwk-aa-klein" data-testid="bg-leeg" style={css('margin-bottom: 12px;')}>
            Begin met een kopje.
            {project.begroting ? ` Bij Projecten staat nu ${formatEuro(project.begroting)}; zodra u regels opslaat, komt het totaal uit de begroting.` : ''}
          </div>
        )}

        {zichtbaar.map((c) => {
          const rijen = regels.filter((r) => r.categorie === c.id);
          const deel = totalen.perCategorie.find((x) => x.id === c.id);
          const gebruikt = new Set(rijen.map((r) => r.omschrijving.trim().toLowerCase()));

          return (
            <section key={c.id} data-testid={`bg-kopje-${c.id}`} style={css('margin: 0 0 22px;')}>
              <div className="fwk-wp-blokkop" style={css('margin-bottom: 8px;')}>
                <h3 style={css(`margin: 0; font-size: 16px; font-weight: 800; color: ${color.donkerblauw};`)}>{c.label}</h3>
                <span className="fwk-aa-klein" data-testid={`bg-sub-${c.id}`}>
                  {deel ? euro(deel.subtotaal) : euro(0)}
                  {deel && deel.natura > 0 ? ` + ${euro(deel.natura)} in natura` : ''}
                </span>
              </div>

              {rijen.length > 0 && (
                <div className="fwk-bg-kopregel fwk-bg-kop" aria-hidden="true">
                  <span>Omschrijving</span>
                  <span>Aantal</span>
                  <span>Eenheid</span>
                  <span>Tarief</span>
                  <span style={css('text-align: right;')}>Bedrag</span>
                  <span />
                </div>
              )}

              {rijen.map((r) => (
                <Regel key={r.id} r={r} onWijzig={(w) => wijzig(r.id, w)} onWeg={() => weg(r.id)} />
              ))}

              <div style={css('display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;')}>
                {c.suggesties
                  .filter(([naam]) => !gebruikt.has(naam.toLowerCase()))
                  .map(([naam, eenheid]) => (
                    <button key={naam} type="button" className="fwk-bg-chip" data-testid="bg-suggestie" onClick={() => voegToe(c.id, { omschrijving: naam, eenheid })}>
                      + {naam}
                    </button>
                  ))}
                <button type="button" className="fwk-bg-chip" data-testid="bg-eigen-regel" onClick={() => voegToe(c.id)}>
                  + Eigen regel
                </button>
              </div>
            </section>
          );
        })}

        {nietZichtbaar.length > 0 && (
          <div style={css('margin: 4px 0 14px;')}>
            <label htmlFor="bg-kopje-kies" className="fwk-aa-label">
              Kopje toevoegen
            </label>
            <select id="bg-kopje-kies" data-testid="bg-kopje-kies" className="fwk-aa-veld" style={css('width: auto; min-width: 280px; max-width: 100%; cursor: pointer;')} value="" onChange={(e) => kiesKopje(e.target.value)}>
              <option value="">Kies een kopje</option>
              {nietZichtbaar.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {totalen.zonderBedrag.length > 0 && (
          <div className="fwk-aa-klein" data-testid="bg-zonder-bedrag" style={css('margin-bottom: 10px;')}>
            Nog geen bedrag bij: {totalen.zonderBedrag.map((r) => r.omschrijving || categorieLabel(r.categorie)).join(', ')}. Deze regels tellen nog niet mee.
          </div>
        )}
        {totalen.totaalNatura > 0 && (
          <div className="fwk-aa-klein" data-testid="bg-natura-totaal" style={css('margin-bottom: 10px;')}>
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

        <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 12px;')}>
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
            <div className="fwk-aa-regel" style={css('padding: 4px 0 10px;')}>
              <span>Te dekken (begroting)</span>
              <b data-testid="bg-dek-begroting">{euro(begr)}</b>
            </div>

            <div className="fwk-aa-label" style={css('margin-top: 6px;')}>
              Gegeven
            </div>
            {dek.overige > 0 && <DekkingRij naam="Eigen bijdrage" bedrag={dek.overige} />}
            {gegeven.map((r) => (
              <DekkingRij key={r.id} naam={r.naam} bedrag={bedragVan(r)} sub={STATUS_LABEL.awarded} />
            ))}
            {dek.overige === 0 && gegeven.length === 0 && <div className="fwk-aa-klein">Nog niets gegeven.</div>}

            <div className="fwk-aa-label" style={css('margin-top: 12px;')}>
              Uitstaand
            </div>
            {uitstaand.map((r) => (
              <DekkingRij key={r.id} naam={r.naam} bedrag={bedragVan(r)} sub={STATUS_LABEL.submitted} />
            ))}
            {uitstaand.length === 0 && <div className="fwk-aa-klein">Niets uitstaand.</div>}

            <div className="fwk-aa-label" style={css('margin-top: 12px;')}>
              Nog aan te vragen (planning)
            </div>
            {gepland.map((r) => (
              <DekkingRij key={r.id} naam={r.naam} bedrag={bedragVan(r)} sub={STATUS_LABEL[r.status]} />
            ))}
            {gepland.length === 0 && <div className="fwk-aa-klein">Niets gepland.</div>}

            <div style={css('margin-top: 14px; padding-top: 12px; border-top: 1px solid #E3EAE6;')}>
              {sluit ? (
                <Chip testid="bg-sluit">{dek.overgedekt > 0 ? `Sluitend, ${euro(dek.overgedekt)} meer dan nodig` : 'Sluitend'}</Chip>
              ) : (
                <div className="fwk-aa-regel" data-testid="bg-nog-te-plannen">
                  <span>Nog te dekken</span>
                  <b>{euro(dek.nogTePlannen)}</b>
                </div>
              )}
              {dek.geplandZonderBedrag > 0 && (
                <div className="fwk-aa-klein" style={css('margin-top: 6px;')}>
                  Bij {dek.geplandZonderBedrag} geplande {dek.geplandZonderBedrag === 1 ? 'financier' : 'financiers'} staat nog geen bedrag.
                </div>
              )}
            </div>
          </>
        )}
      </Blok>
    </div>
  );
}
