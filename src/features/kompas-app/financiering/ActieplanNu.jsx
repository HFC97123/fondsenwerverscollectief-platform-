// Bovenaan het Actieplan: "Nu aan de beurt" (één actie met Gedaan en Datum aanpassen), "Hierna" (hooguit drie) en per project een tijdlijn
// met de stappen per fonds, het project zelf en het go/no-go-moment (6 weken vóór de start). De logica staat in actieplanOverzicht.js;
// dit bestand tekent alleen. Alle kleuren, lettertypen en maten komen uit shared/tokens.js (één opmaak voor de hele website).
import React, { useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { color as C, font as F, radius as R, shadow as S, type as T } from '../../../shared/tokens.js';
import { dagenTekst, formatDatum, formatDatumLang } from './dekkingsplan.js';
import { bepaalNuEnHierna, bouwTijdlijn, kortDatum, positie, waarschuwingTekst } from './actieplanOverzicht.js';

const STIJL = `
.fwk-apn { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.fwk-apn * { box-sizing: border-box; }
.fwk-apn-lab { font-family: ${F.tekst}; font-size: ${T.label}; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${C.tekstLicht}; }
.fwk-apn-kaart { padding: 18px 20px; border: 1px solid ${C.lijn}; border-radius: ${R.xl}; background: ${C.wit}; }
.fwk-apn-nu { border: 2px solid ${C.donkerblauw}; }
.fwk-apn-nu h2 { margin: 4px 0 6px; font-family: ${F.kop}; font-size: ${T.sectieKop}; font-weight: 600; line-height: 1.2; color: ${C.donkerblauw}; overflow-wrap: anywhere; }
.fwk-apn-tekst { margin: 0; font-family: ${F.tekst}; font-size: ${T.klein}; line-height: 1.55; color: ${C.tekstZacht}; }
.fwk-apn-tekst b { color: ${C.tekst}; }
.fwk-apn-laat { color: ${C.fout}; font-weight: 800; }
.fwk-apn-rij { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 14px; }
.fwk-apn-knop { cursor: pointer; min-height: 40px; padding: 0 18px; border: none; border-radius: ${R.pil}; background: ${C.donkerblauw}; color: ${C.wit}; box-shadow: ${S.knop}; font-family: ${F.tekst}; font-size: ${T.knop}; font-weight: 800; }
.fwk-apn-knop:disabled { opacity: 0.6; cursor: default; }
.fwk-apn-knop.l { border: 1px solid ${C.lijnInput}; background: ${C.wit}; color: ${C.donkerblauw}; box-shadow: none; }
.fwk-apn-invoer { min-height: 40px; padding: 6px 10px; border: 1px solid ${C.lijnInput}; border-radius: ${R.m}; background: ${C.wit}; font-family: ${F.tekst}; font-size: ${T.klein}; color: ${C.tekst}; }
.fwk-apn-fout { font-family: ${F.tekst}; font-size: ${T.kleiner}; font-weight: 700; color: ${C.fout}; }
.fwk-apn-hierna { display: grid; gap: 8px; margin-top: 16px; }
.fwk-apn-h { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: ${R.m}; background: ${C.vlakGrijs}; font-family: ${F.tekst}; font-size: ${T.klein}; color: ${C.tekst}; }
.fwk-apn-h .nr { flex: none; width: 24px; height: 24px; border-radius: ${R.rond}; background: ${C.donkerblauw}; color: ${C.wit}; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.fwk-apn-h .nr.m { background: ${C.succes}; border-radius: 6px; transform: rotate(45deg) scale(0.8); }
.fwk-apn-h .dat { flex: none; min-width: 74px; font-weight: 800; color: ${C.succes}; }
.fwk-apn-h .tit { min-width: 0; flex: 1 1 auto; overflow-wrap: anywhere; }
.fwk-apn-h .tit small { display: block; font-size: ${T.micro}; color: ${C.tekstLicht}; }
.fwk-apn-h .wanneer { flex: none; margin-left: auto; font-size: ${T.micro}; color: ${C.tekstLicht}; white-space: nowrap; }
.fwk-apn-kop { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline; }
.fwk-apn-kop h3 { margin: 2px 0 0; font-family: ${F.kop}; font-size: ${T.blokKop}; font-weight: 600; color: ${C.donkerblauw}; }
.fwk-apn-scroll { overflow-x: auto; }
.fwk-apn-tl { margin-top: 12px; }
.fwk-apn-rij2 { display: grid; grid-template-columns: 150px minmax(0, 1fr); align-items: center; border-bottom: 1px solid ${C.lijnZacht}; }
.fwk-apn-rij2:last-child { border-bottom: none; }
.fwk-apn-naam { padding-right: 10px; font-family: ${F.tekst}; font-size: ${T.kleiner}; font-weight: 800; color: ${C.tekst}; overflow-wrap: anywhere; }
.fwk-apn-naam small { display: block; font-weight: 600; color: ${C.tekstLicht}; font-size: ${T.micro}; }
.fwk-apn-spoor { position: relative; height: 54px; margin: 0 30px; }
.fwk-apn-as { position: relative; height: 26px; margin: 0 30px; }
.fwk-apn-as span { position: absolute; top: 0; height: 26px; padding-left: 4px; border-left: 1px solid ${C.lijnZacht}; font-family: ${F.tekst}; font-size: ${T.micro}; font-weight: 800; color: ${C.tekstLicht}; }
.fwk-apn-lijn { position: absolute; top: 50%; height: 3px; transform: translateY(-50%); background: ${C.lijnInput}; }
.fwk-apn-pt { position: absolute; top: 50%; transform: translate(-50%, -50%); }
.fwk-apn-pt i { display: block; width: 14px; height: 14px; border-radius: ${R.rond}; background: ${C.donkerblauw}; border: 2px solid ${C.wit}; box-shadow: 0 0 0 1px ${C.donkerblauw}; }
.fwk-apn-pt.klaar i { background: ${C.pastelgroen}; box-shadow: 0 0 0 1px ${C.groen}; }
.fwk-apn-pt.uitslag-ok i { background: ${C.succes}; box-shadow: 0 0 0 1px ${C.succes}; }
.fwk-apn-pt.uitslag-laat i { background: ${C.wit}; box-shadow: 0 0 0 2px ${C.fout}; }
.fwk-apn-pt em { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); font-style: normal; font-family: ${F.tekst}; font-size: 10.5px; font-weight: 800; white-space: nowrap; color: ${C.tekstZacht}; }
.fwk-apn-pt.boven em { top: -17px; }
.fwk-apn-balk { position: absolute; top: 14px; height: 26px; padding-left: 10px; display: flex; align-items: center; border: 1px solid ${C.lijnGroenSterk}; border-radius: 8px; background: ${C.vlakGroen}; font-family: ${F.tekst}; font-size: ${T.micro}; font-weight: 800; color: ${C.succes}; overflow: hidden; white-space: nowrap; }
.fwk-apn-vlag { position: absolute; top: 0; bottom: 0; width: 0; z-index: 2; pointer-events: none; }
.fwk-apn-vlag.vandaag { border-left: 2px solid ${C.donkerblauw}; }
.fwk-apn-vlag.gonogo { border-left: 2px dashed ${C.fout}; }
.fwk-apn-vlag span { position: absolute; top: 0; left: 6px; padding: 1px 8px; border-radius: ${R.pil}; font-family: ${F.tekst}; font-size: 11px; font-weight: 800; white-space: nowrap; }
.fwk-apn-vlag.vandaag span { background: ${C.donkerblauw}; color: ${C.wit}; }
.fwk-apn-vlag.gonogo span { background: ${C.foutVlak}; color: ${C.fout}; border: 1px solid ${C.foutLijn}; }
.fwk-apn-over { position: absolute; left: 150px; right: 0; top: 0; bottom: 0; pointer-events: none; }
.fwk-apn-over .binnen { position: absolute; left: 30px; right: 30px; top: 0; bottom: 0; }
.fwk-apn-waarsch { margin-top: 14px; padding: 10px 14px; border: 1px solid ${C.foutLijn}; border-radius: ${R.m}; background: ${C.foutVlak}; font-family: ${F.tekst}; font-size: ${T.klein}; font-weight: 700; color: ${C.fout}; }
.fwk-apn-leg { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 14px; font-family: ${F.tekst}; font-size: ${T.micro}; color: ${C.tekstGrijs}; }
.fwk-apn-leg i { display: inline-block; width: 11px; height: 11px; margin-right: 5px; border-radius: ${R.rond}; vertical-align: -1px; }
@media (max-width: 640px) {
  .fwk-apn-tl { min-width: 640px; }
  .fwk-apn-rij2 { grid-template-columns: 96px minmax(0, 1fr); }
  .fwk-apn-over { left: 96px; }
  .fwk-apn-spoor, .fwk-apn-as { margin: 0 22px; }
  .fwk-apn-over .binnen { left: 22px; right: 22px; }
  .fwk-apn-h { flex-wrap: wrap; }
  .fwk-apn-h .wanneer { margin-left: 0; }
}
`;

const datumRegel = (i, nu) => {
  if (!i.datum) return 'Nog geen datum';

  return i.dagen != null && i.dagen < 0 ? (
    <span className="fwk-apn-laat">Verstreken op {formatDatum(i.datum)}</span>
  ) : (
    <>
      Uiterlijk <b>{formatDatumLang(i.datum)}</b>
      {i.dagen != null ? ` (${dagenTekst(i.dagen)})` : ''}
    </>
  );
};

function NuKaart({ item, nu, plan, beschikbaar, maakTaak, toonProject, naamVanProject, fondsVan }) {
  const [bezig, setBezig] = useState(false);
  const [wijzig, setWijzig] = useState(false);
  const [datum, setDatum] = useState('');
  const [fout, setFout] = useState('');

  const taakId = async (extra) => {
    if (item.taak && item.taak.id) return item.taak.id;

    const res = await maakTaak(item, extra);

    return res && res.ok && res.actie ? res.actie.id : null;
  };
  const uitvoeren = async (werk) => {
    setBezig(true);
    setFout('');

    try {
      const ok = await werk();

      if (!ok) setFout('Opslaan is niet gelukt. Probeer het opnieuw.');
      else setWijzig(false);
    } catch (e) {
      setFout('Opslaan is niet gelukt. Probeer het opnieuw.');
    }

    setBezig(false);
  };
  const gedaan = () =>
    uitvoeren(async () => {
      const id = await taakId({});
      const res = id ? await plan.wijzig(id, { status: 'done' }) : null;

      return Boolean(res && res.ok);
    });
  const bewaarDatum = () =>
    uitvoeren(async () => {
      if (!datum) return false;

      if (item.taak && item.taak.id) {
        const res = await plan.wijzig(item.taak.id, { deadline: datum });

        return Boolean(res && res.ok);
      }

      const res = await maakTaak(item, { deadline: datum });

      return Boolean(res && res.ok);
    });
  const uitleg = (item.taak && item.taak.notitie) || item.reden || '';
  const fonds = fondsVan(item);
  const waar = [fonds, toonProject ? naamVanProject(item.projectId) : ''].filter(Boolean).join(' · ');

  return (
    <div className="fwk-apn-kaart fwk-apn-nu" data-testid="ap-nu">
      <div className="fwk-apn-lab">Nu aan de beurt</div>
      <h2 data-testid="ap-nu-titel">{item.titel}</h2>
      {waar && <p className="fwk-apn-tekst" style={css('margin-bottom: 4px;')}>{waar}</p>}
      <p className="fwk-apn-tekst" data-testid="ap-nu-datum">{datumRegel(item, nu)}</p>
      {uitleg && <p className="fwk-apn-tekst" style={css('margin-top: 6px;')}>{uitleg}</p>}
      {beschikbaar && (
        <div className="fwk-apn-rij">
          <button type="button" className="fwk-apn-knop" data-testid="ap-nu-gedaan" disabled={bezig} onClick={gedaan}>
            {bezig ? 'Opslaan…' : 'Gedaan'}
          </button>
          {!wijzig && (
            <button type="button" className="fwk-apn-knop l" data-testid="ap-nu-datum-wijzig" disabled={bezig} onClick={() => { setDatum(item.datum || ''); setWijzig(true); }}>
              Datum aanpassen
            </button>
          )}
          {wijzig && (
            <>
              <input type="date" className="fwk-apn-invoer" data-testid="ap-nu-datum-invoer" aria-label="Nieuwe datum" value={datum} onChange={(e) => setDatum(e.target.value)} />
              <button type="button" className="fwk-apn-knop" data-testid="ap-nu-datum-opslaan" disabled={bezig || !datum} onClick={bewaarDatum}>
                Opslaan
              </button>
              <button type="button" className="fwk-apn-knop l" onClick={() => setWijzig(false)}>
                Annuleren
              </button>
            </>
          )}
          {fout && <span role="alert" className="fwk-apn-fout">{fout}</span>}
        </div>
      )}
    </div>
  );
}

function Hierna({ regels, toonProject, naamVanProject, fondsVan }) {
  if (!regels.length) return null;

  return (
    <div className="fwk-apn-hierna" data-testid="ap-hierna">
      <div className="fwk-apn-lab">Hierna</div>
      {regels.map((i, n) => {
        const mijlpaal = i.soort === 'mijlpaal';
        const nummer = regels.slice(0, n).filter((x) => x.soort !== 'mijlpaal').length + 2;
        const klein = mijlpaal ? (toonProject ? naamVanProject(i.projectId) : 'Zes weken vóór de start van het project') : [fondsVan(i), toonProject ? naamVanProject(i.projectId) : ''].filter(Boolean).join(' · ');

        return (
          <div key={i.sleutel} className="fwk-apn-h" data-testid={mijlpaal ? 'ap-hierna-gonogo' : 'ap-hierna-rij'}>
            <span className={`nr${mijlpaal ? ' m' : ''}`}>{mijlpaal ? '' : nummer}</span>
            <span className="dat">{i.datum ? kortDatum(i.datum) : '–'}</span>
            <span className="tit">
              {i.titel}
              {klein && <small>{klein}</small>}
            </span>
            <span className="wanneer">{i.dagen != null ? dagenTekst(i.dagen) : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tijdlijn({ t, toonNaam }) {
  const pos = (d) => positie(t, d);

  return (
    <div className="fwk-apn-kaart" data-testid="ap-tijdlijn" data-project={t.projectId}>
      <div className="fwk-apn-kop">
        <div>
          <div className="fwk-apn-lab">Tijdlijn</div>
          {toonNaam && <h3>{t.naam}</h3>}
        </div>
      </div>
      <div className="fwk-apn-scroll">
      <div className="fwk-apn-tl" style={css('position: relative;')}>
        <div className="fwk-apn-rij2" style={css('border-bottom: 1px solid ' + C.lijnInput + ';')}>
          <div />
          <div className="fwk-apn-as">
            {t.maanden.map((m) => (
              <span key={m.datum} style={{ left: `${pos(m.datum)}%` }}>{m.label}</span>
            ))}
          </div>
        </div>
        <div className="fwk-apn-rij2">
          <div className="fwk-apn-naam">
            Het project
            {t.start && <small>{[kortDatum(t.start), t.eind ? kortDatum(t.eind) : ''].filter(Boolean).join(' tot ')}</small>}
          </div>
          <div className="fwk-apn-spoor">
            {t.start && (
              <div className="fwk-apn-balk" data-testid="ap-tl-project" style={{ left: `${pos(t.start)}%`, width: `${Math.max(2, pos(t.eind || t.tot) - pos(t.start))}%` }}>
                Uitvoering
              </div>
            )}
          </div>
        </div>
        {t.banen.map((b) => {
          const xs = b.punten.map((p) => pos(p.datum));
          let laatste = -100;
          let boven = false;

          return (
            <div key={b.fonds} className="fwk-apn-rij2" data-testid="ap-tl-baan">
              <div className="fwk-apn-naam">{b.fonds}</div>
              <div className="fwk-apn-spoor">
                {xs.length > 1 && <div className="fwk-apn-lijn" style={{ left: `${Math.min(...xs)}%`, width: `${Math.max(...xs) - Math.min(...xs)}%` }} />}
                {b.punten.map((p) => {
                  const x = pos(p.datum);

                  boven = x - laatste < 13 ? !boven : false;
                  laatste = x;

                  return (
                    <div key={p.sleutel} className={`fwk-apn-pt ${p.stijl}${boven ? ' boven' : ''}`} style={{ left: `${x}%` }} title={p.titel} data-testid="ap-tl-punt" data-stijl={p.stijl}>
                      <i />
                      <em>{`${p.label} ${kortDatum(p.datum)}`}</em>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="fwk-apn-over">
          <div className="binnen">
            <div className="fwk-apn-vlag vandaag" style={{ left: `${pos(t.vandaag)}%` }}><span>Vandaag</span></div>
            {t.gonogo && (
              <div className="fwk-apn-vlag gonogo" data-testid="ap-tl-gonogo" style={{ left: `${pos(t.gonogo)}%` }}>
                <span>Go/no-go {kortDatum(t.gonogo)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      {t.waarschuwingen.map((w) => (
        <div key={w.fonds} className="fwk-apn-waarsch" role="status" data-testid="ap-tl-waarschuwing">
          {waarschuwingTekst(w)}
        </div>
      ))}
      {!t.start && (
        <p className="fwk-apn-tekst" style={css('margin-top: 12px;')} data-testid="ap-tl-geen-start">
          Vul bij dit project een startdatum in; dan staan het project en het go/no-go-moment (6 weken vóór de start) ook op de tijdlijn.
        </p>
      )}
      {t.zonderDatum > 0 && (
        <p className="fwk-apn-tekst" style={css('margin-top: 8px;')}>
          {t.zonderDatum === 1 ? '1 actie heeft nog geen datum en staat niet op de tijdlijn.' : `${t.zonderDatum} acties hebben nog geen datum en staan niet op de tijdlijn.`}
        </p>
      )}
      <div className="fwk-apn-leg">
        <span><i style={{ background: C.donkerblauw }} />Actie of indiendatum</span>
        {t.gonogo && <span><i style={{ background: C.succes }} />Uitslag op tijd</span>}
        {t.gonogo && <span><i style={{ background: C.wit, boxShadow: `0 0 0 2px ${C.fout}` }} />Uitslag na het go/no-go-moment</span>}
        <span><i style={{ background: C.pastelgroen }} />Afgerond</span>
      </div>
    </div>
  );
}

// items: de open en afgeronde acties van de getoonde projecten (bouwActiesEnDeadlines); projecten: die projecten zelf.
export function ActieplanNu({ items, projecten, nu, plan, beschikbaar, maakTaak, naamVanProject, fondsVan }) {
  const toonProject = projecten.length > 1;
  const { nu: eerste, hierna } = useMemo(() => bepaalNuEnHierna({ items, projecten, nu }), [items, projecten, nu]);
  const tijdlijnen = useMemo(() => projecten.map((p) => bouwTijdlijn({ project: p, items, nu, fondsVan })).filter((t) => t.banen.length), [projecten, items, nu, fondsVan]);

  return (
    <section className="fwk-apn" data-testid="ap-nu-sectie">
      <style>{STIJL}</style>
      {eerste ? (
        <div>
          <NuKaart key={eerste.sleutel} item={eerste} nu={nu} plan={plan} beschikbaar={beschikbaar} maakTaak={maakTaak} toonProject={toonProject} naamVanProject={naamVanProject} fondsVan={fondsVan} />
          <Hierna regels={hierna} toonProject={toonProject} naamVanProject={naamVanProject} fondsVan={fondsVan} />
        </div>
      ) : (
        <div className="fwk-apn-kaart" data-testid="ap-nu-leeg">
          <div className="fwk-apn-lab">Nu aan de beurt</div>
          <p className="fwk-apn-tekst" style={css('margin-top: 6px;')}>
            Er staat op dit moment niets open. Zodra er fondsen in het dekkingsplan staan, ziet u hier de volgende stap.
          </p>
        </div>
      )}
      {tijdlijnen.map((t) => (
        <Tijdlijn key={t.projectId} t={t} toonNaam={toonProject} />
      ))}
    </section>
  );
}
