import JSZip from 'jszip';
import { check, gelijk, sectie, klaar } from '../verificatie/hulp.mjs';
import * as client from '../checkout-frontend/fake-client.js';
import { DEFINITIEF_SOORTEN, haalDefinitieveDocumenten, haalDefinitiefDocument, maakDefinitief, verwijderDefinitief } from '../../src/data/services/definitieveDocumenten.js';
import { DEFINITIEF_NAAM, begrotingMomentopname, definitieveDocsVoorLijst, definitiefSoortVan, planMomentopname } from '../../src/features/kompas-app/aanvraag/aanvraagModel.js';
import { maakBegrotingExcel } from '../../src/features/kompas-app/begroting/begrotingExport.js';
import { bouwHuisstijlThema } from '../../src/shared/document-theme/huisstijl.js';
import { nieuweRegel } from '../../src/features/kompas-app/begroting/begrotingModel.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

sectie('1. Het model: wat definitief kan worden en hoe de regels heten');
{
  gelijk('alleen plan, begroting en dekkingsplan kunnen definitief; een concept voor een fonds niet', [definitiefSoortVan({ gegenereerd: 'plan' }), definitiefSoortVan({ gegenereerd: 'begroting' }), definitiefSoortVan({ gegenereerd: 'dekking' }), definitiefSoortVan({ gegenereerd: 'fonds' }), definitiefSoortVan(null)], ['projectplan', 'begroting', 'dekkingsplan', null, null]);
  const rijen = [
    { id: 'a', projectId: 'p1', soort: 'projectplan', versie: 2, gemaakt: '2026-10-28T10:00:00Z' },
    { id: 'b', projectId: 'p1', soort: 'dekkingsplan', versie: 1, gemaakt: '2026-10-27T10:00:00Z' },
    { id: 'c', projectId: 'weg', soort: 'begroting', versie: 1, gemaakt: '' },
    { id: 'd', projectId: 'p1', soort: 'onzin', versie: 1, gemaakt: '' },
  ];
  const l = definitieveDocsVoorLijst(rijen, [{ id: 'p1', naam: 'Samen Spelen' }]);

  check('rijen van onbekende projecten of soorten vallen weg', l.length === 2);
  check('de naam is Projectplan en Dekkingsplan, zonder Concept, en de regel is definitief', l[0].naam === 'Projectplan' && l[1].naam === 'Dekkingsplan' && l.every((x) => x.definitief && !x.concept && x.gegenereerd === 'definitief'));
  check('soort voor het filter, versie, datum en projectnaam kloppen', l[0].soort === 'Projectplan' && l[1].soort === 'Concept-dekkingsplan' && l[0].versie === 2 && l[0].datum === '2026-10-28T10:00:00Z' && l[0].projectNaam === 'Samen Spelen' && l[0].id === 'def-a');
  gelijk('de namen op het scherm', DEFINITIEF_NAAM, { projectplan: 'Projectplan', begroting: 'Begroting', dekkingsplan: 'Dekkingsplan' });
  const m = begrotingMomentopname({ soort: 'begroting', project: { id: 'p1', naam: 'X', docs: [{ tekst: 'groot' }], budgetRegels: [] }, finRegels: [{ id: 1 }] });
  check('de kopie van een begroting bevat het project zonder zijn documenten en de financieringsregels', m.type === 'begroting' && m.project.id === 'p1' && !('docs' in m.project) && m.finRegels.length === 1);
  check('de kopie van een plan bevat het plan en de projectnaam', planMomentopname({ plan: { secties: [] }, projectNaam: 'X' }).plan.secties.length === 0);
}

sectie('2. De opslag');
{
  const rijen = [];
  let n = 0;
  let sessie = 'u1';
  let fout = null;
  const keten = (st) => {
    const q = {
      select: () => q,
      insert: (r) => { st.insert = r; return q; },
      delete: () => { st.del = true; return q; },
      eq: (k, v) => { st.f.push([k, v]); return q; },
      in: (k, v) => { st.f.push([k, v, true]); return q; },
      order: async () => ({ data: rijen.filter((r) => st.f.every(([k, v, i]) => (i ? v.includes(r[k]) : r[k] === v))), error: null }),
      single: async () => { if (fout) return { data: null, error: fout }; const r = { ...st.insert, id: `d${++n}`, versie: n, created_at: 'nu' }; rijen.push(r); return { data: { id: r.id, versie: r.versie }, error: null }; },
      maybeSingle: async () => ({ data: rijen.find((r) => st.f.every(([k, v]) => r[k] === v)) || null, error: null }),
      then: (ok) => { for (const r of rijen.filter((x) => st.f.every(([k, v]) => x[k] === v))) rijen.splice(rijen.indexOf(r), 1); return Promise.resolve({ error: null }).then(ok); },
    };

    return q;
  };

  client.__zetSupabase({ auth: { getUser: async () => ({ data: { user: sessie ? { id: sessie } : null } }) }, from: () => keten({ f: [] }) });

  gelijk('de soorten', DEFINITIEF_SOORTEN, ['projectplan', 'begroting', 'dekkingsplan']);
  check('onbekende soort of lege inhoud wordt geweigerd, zonder iets te schrijven', (await maakDefinitief({ projectId: 'p1', soort: 'brief', inhoud: {} })).reden === 'ongeldig' && (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: null })).reden === 'ongeldig' && (await maakDefinitief({ projectId: '', soort: 'begroting', inhoud: {} })).reden === 'ongeldig' && rijen.length === 0);
  const r = await maakDefinitief({ projectId: 'p1', soort: 'projectplan', naam: 'x'.repeat(300), inhoud: { type: 'projectplan', plan: { secties: [] } } });

  check('bewaren geeft id en versie en schrijft het eigen user_id, met een ingekorte naam', r.ok && r.id === 'd1' && rijen[0].user_id === 'u1' && rijen[0].naam.length === 160);
  const lijst = await haalDefinitieveDocumenten(['p1', 'p2', '']);

  check('de lijst heeft geen inhoud, wel projectId en versie', lijst.length === 1 && lijst[0].projectId === 'p1' && !('inhoud' in lijst[0]));
  check('één document komt met zijn inhoud terug', (await haalDefinitiefDocument('d1')).inhoud.type === 'projectplan' && (await haalDefinitiefDocument('nietbestaand')) === null);
  fout = { code: '42501' };
  check('de database weigert (geen Pro/Premium) -> niet-toegestaan', (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: { a: 1 } })).reden === 'niet-toegestaan');
  fout = { code: 'XX' };
  check('een andere fout -> fout', (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: { a: 1 } })).reden === 'fout');
  fout = null;
  check('verwijderen haalt alleen dat document weg', (await verwijderDefinitief('d1')).ok === true && rijen.length === 0);
  client.__zetSupabase({ auth: { getUser: async () => ({ data: { user: null } }) }, from: () => keten({ f: [] }) });
  check('zonder sessie: lege lijst, geen document, geen bewaren', (await haalDefinitieveDocumenten(['p1'])).length === 0 && (await haalDefinitiefDocument('d1')) === null && (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: { a: 1 } })).reden === 'geen-sessie');
}

sectie('3. De Excel van begroting en dekkingsplan, in de huisstijl');
{
  const regels = [nieuweRegel('', { omschrijving: 'Coördinator', aantal: '10', eenheid: 'uur', tarief: '50' }), nieuweRegel('', { omschrijving: 'Materiaal', bedrag: '300' })];
  const project = { id: 'p1', naam: 'Samen Spelen', budgetRegels: regels.map((r) => ({ ...r })) };
  const fin = [{ id: 'f1', naam: 'Fonds Test', status: 'submitted', requested: 400, awarded: null }];
  const sk = await maakBegrotingExcel({ project, finRegels: fin, organisatieNaam: 'Stichting' });

  check('een Excel-bestand met de bestandsnaam van het project', sk.bestandsnaam === 'Begroting - Samen Spelen.xlsx' && sk.blob.size > 2000);
  const eigen = bouwHuisstijlThema({ naam: 'Eigen Stichting', primair: '#7a1f3d', accent: '#d98a00', logo: PNG, logoBreedte: 100, logoHoogte: 25 });
  const ei = await maakBegrotingExcel({ project, finRegels: fin, organisatieNaam: 'Stichting', theme: eigen });
  const stijl = async (b) => { const z = await JSZip.loadAsync(Buffer.from(await b.arrayBuffer())); return (await z.file('xl/styles.xml').async('string')); };

  check('Subsidie Kompas-huisstijl: de Kompas-kleur staat in de opmaak', /2C4A5E/i.test(await stijl(sk.blob)));
  check('eigen huisstijl: de eigen kleur staat in de opmaak en de Kompas-kleur niet', /7A1F3D/i.test(await stijl(ei.blob)) && !/2C4A5E/i.test(await stijl(ei.blob)));
  const zonderFin = await maakBegrotingExcel({ project, finRegels: null });

  check('zonder financieringsregels lukt de begroting ook', zonderFin.blob.size > 2000);
}

klaar('definitief');
