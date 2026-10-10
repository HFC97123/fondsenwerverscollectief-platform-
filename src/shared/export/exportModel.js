// src/shared/export/exportModel.js
//
// Eén gemeenschappelijk tussenformaat voor alle exports ("bestaande data ->
// bestaande exportlaag -> gekozen bestandsformaat"). Elke bouwer hieronder
// zet BESTAANDE gegevens (een AI-tekst, een project, het organisatieprofiel,
// een gesprek) om naar hetzelfde model:
//
//   {
//     kind, titel, documentType, organisatieNaam, projectNaam, bestandsDelen,
//     blocks,   // dezelfde blocks als normalizeDocumentContent() -> Word + PDF
//     sheets,   // tabbladen met kolommen en rijen -> Excel
//     budgetBron // alleen bij een begrotingsdocument: bestaande budget-Excel
//   }
//
// Word en PDF lezen allebei `blocks` (dus altijd dezelfde inhoud in dezelfde
// volgorde); Excel leest `sheets`. Deze bestand is pure functies: geen
// netwerk, geen opslag, geen React - het model bevat uitsluitend wat de
// aanroeper expliciet meegeeft (dat is zelf al uit de RLS-beveiligde tabellen
// van de ingelogde gebruiker gehaald, zie exportService.js).
import { normalizeDocumentContent } from '../document-theme/normalizeDocumentContent.js';

const EXCEL_CEL_MAX = 32000; // Excel staat maximaal 32.767 tekens per cel toe

// ---------------------------------------------------------------- hulpjes

const gevuld = (v) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0);

const tekst = (v) => (v == null ? '' : Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v).trim());

// Zelfde regel als berekenDekking() (KompasStore.jsx) en getal() in
// projecten.js: alle niet-cijfers eruit. Zo komen de bedragen in de export
// altijd overeen met wat het lid in de app ziet.
const bedragNaarGetal = (v) => {
  const cijfers = String(v == null ? '' : v).replace(/[^0-9]/g, '');

  return cijfers ? Number(cijfers) : null;
};

const euroTekst = (n) => (n == null ? '' : `€ ${Number(n).toLocaleString('nl-NL')}`);

const afkappen = (s) => {
  const t = String(s == null ? '' : s);

  return t.length > EXCEL_CEL_MAX ? `${t.slice(0, EXCEL_CEL_MAX)}…` : t;
};

const vandaag = () => new Date();

// "2027-03-01" -> Date (voor Excel) en "01-03-2027" (voor Word/PDF); alles wat
// geen ISO-datum is blijft ongemoeid.
const ISO_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;
const isoNaarDate = (v) => {
  const m = ISO_DATUM.exec(String(v == null ? '' : v).trim());

  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const datumTekst = (v) => {
  const m = ISO_DATUM.exec(String(v == null ? '' : v).trim());

  return m ? `${m[3]}-${m[2]}-${m[1]}` : tekst(v);
};

// Vrije AI-/gebruikerstekst -> blocks, via dezelfde normalisatie als de
// bestaande Word-export. Koppen binnen een veldtekst worden niveau 3 zodat
// ze nooit boven de eigen sectiekoppen uitkomen.
function veldBlokken(waarde) {
  const { blocks } = normalizeDocumentContent(waarde);

  return blocks.map((b) => (b.type === 'heading' ? { ...b, level: 3 } : b));
}

function sectie(titel, blokken) {
  return blokken.length ? [{ type: 'heading', level: 1, text: titel }, ...blokken] : [];
}

function sleutelWaardeTabel(rijen) {
  const gevuldeRijen = rijen.filter(([, w]) => gevuld(w) && tekst(w) !== '');

  return gevuldeRijen.length
    ? [{ type: 'table', headers: ['Onderdeel', 'Gegeven'], rows: gevuldeRijen.map(([k, w]) => [k, tekst(w)]) }]
    : [];
}

function sheet(naam, kolommen, rijen) {
  return { naam, kolommen, rijen };
}

const K = (kop, sleutel, breedte, type = 'tekst') => ({ kop, sleutel, breedte, type });

// ------------------------------------------------------- 1. een document

/**
 * Een AI-resultaat (chatbericht) of een bewaard projectdocument.
 * `blocks` zijn EXACT die van de bestaande Word-export (zelfde
 * normalizeDocumentContent op dezelfde tekst).
 */
export function bouwDocumentModel({ tekst: docTekst, soort, organisatieNaam, projectNaam, project, titel, alsBegroting = false }) {
  const content = normalizeDocumentContent(docTekst);
  const documentSoort = soort || 'Document';
  const sheets = [];
  const overzicht = [
    { onderdeel: 'Documentsoort', waarde: documentSoort },
    titel && titel !== documentSoort ? { onderdeel: 'Titel', waarde: titel } : null,
    projectNaam ? { onderdeel: 'Project', waarde: projectNaam } : null,
    organisatieNaam ? { onderdeel: 'Organisatie', waarde: organisatieNaam } : null,
    { onderdeel: 'Exportdatum', waarde: vandaag(), type: 'datum' },
  ].filter(Boolean);

  sheets.push(sheet('Overzicht', [K('Onderdeel', 'onderdeel', 26), K('Waarde', 'waarde', 60, 'auto')], overzicht));

  // "Inhoud": per tekstblok één rij, met de bijbehorende kop als onderdeel -
  // dus geen enkele grote tekstblob in één cel.
  const inhoud = [];
  let kop = '';
  let nr = 0;

  content.blocks.forEach((b) => {
    if (b.type === 'heading') {
      kop = b.text;
      nr += 1;
      inhoud.push({ nr, onderdeel: kop, type: `Kop ${b.level}`, tekst: b.text });
    } else if (b.type === 'paragraph') {
      nr += 1;
      inhoud.push({ nr, onderdeel: kop, type: 'Alinea', tekst: afkappen(b.text) });
    } else if (b.type === 'bullets') {
      b.items.forEach((it) => {
        nr += 1;
        inhoud.push({ nr, onderdeel: kop, type: 'Opsomming', tekst: afkappen(it) });
      });
    } else if (b.type === 'numbered') {
      b.items.forEach((it) => {
        nr += 1;
        inhoud.push({ nr, onderdeel: kop, type: 'Genummerde lijst', tekst: afkappen(`${it.nummer}. ${it.tekst}`) });
      });
    } else if (b.type === 'table') {
      const tabelNr = sheets.filter((s) => s.naam.startsWith('Tabel')).length + 1;

      nr += 1;
      inhoud.push({ nr, onderdeel: kop, type: 'Tabel', tekst: `Zie tabblad Tabel ${tabelNr}` });

      sheets.push(
        sheet(
          `Tabel ${tabelNr}`,
          b.headers.map((h, i) => K(h || `Kolom ${i + 1}`, `c${i}`, i === 0 ? 30 : 22, 'auto')),
          b.rows.map((r) => Object.fromEntries(r.map((c, i) => [`c${i}`, c]))),
        ),
      );
    }
  });

  if (inhoud.length) {
    sheets.splice(
      1,
      0,
      sheet(
        'Inhoud',
        [K('Nr', 'nr', 6, 'getal'), K('Onderdeel', 'onderdeel', 30), K('Type', 'type', 18), K('Tekst', 'tekst', 90)],
        inhoud,
      ),
    );
  }

  return {
    kind: 'document',
    titel: documentSoort,
    documentType: documentSoort,
    organisatieNaam: organisatieNaam || null,
    projectNaam: projectNaam || null,
    bestandsDelen: [projectNaam || organisatieNaam, documentSoort],
    blocks: content.blocks,
    sheets,
    // Begrotingen houden hun bestaande Excel-route (tekst -> budget -> Excel).
    budgetBron: alsBegroting || documentSoort === 'Begroting' ? { tekst: docTekst, project: project || null } : null,
  };
}

// ------------------------------------------------------- 2. een project

const PROJECT_TEKSTVELDEN = [
  ['omschrijving', 'Korte omschrijving'],
  ['doelstellingen', 'Doelstellingen'],
  ['activiteiten', 'Activiteiten'],
  ['impact', 'Beoogde impact'],
  ['planning', 'Planning'],
  ['resultaten', 'Resultaten'],
];

/**
 * @param {Object} project  Eén project (vorm van naarProjectVeld in projecten.js)
 * @param {Object} opties   { organisatieNaam, dekking } - `dekking` is het
 *                          resultaat van berekenDekking(project) (KompasStore.jsx),
 *                          zodat de totalen exact die van de app zijn.
 */
export function bouwProjectModel(project, { organisatieNaam, dekking } = {}) {
  const p = project || {};
  const naam = tekst(p.naam) || 'Naamloos project';
  const looptijd = [tekst(p.periodeVan), tekst(p.periodeTot)].filter(Boolean).join(' – ');
  const begroting = bedragNaarGetal(p.begroting);
  const gevraagd = bedragNaarGetal(p.gevraagd);
  const eigen = bedragNaarGetal(p.eigenBijdrage);
  const getalVan = (s) => bedragNaarGetal(s);
  const toegekend = dekking ? getalVan(dekking.toegekend) : null;
  const inAanvraag = dekking ? getalVan(dekking.inAanvraag) : null;
  const open = dekking ? getalVan(dekking.open) : null;
  const cofin = (p.cofin || []).filter((c) => gevuld(c.naam) || gevuld(c.bedrag));
  const eerder = (p.eerder || []).filter((e) => gevuld(e.fonds) || gevuld(e.bedrag));
  const regelingen = (p.regelingen || []).filter((r) => gevuld(r.naam));
  const docs = (p.docs || []).filter((d) => !d.vervangen);

  const blocks = [
    ...sectie(
      'Projectgegevens',
      sleutelWaardeTabel([
        ['Projectnaam', naam],
        ['Programma of onderdeel', p.programma],
        ['Doelgroep', p.doelgroep],
        ['Projectlocatie', p.regio],
        ['Looptijd', looptijd],
        ['Partners', p.partners],
        ['Organisatie', organisatieNaam],
        ['Status', p.gearchiveerd ? 'Gearchiveerd' : 'Actief'],
      ]),
    ),
    ...PROJECT_TEKSTVELDEN.flatMap(([sleutel, label]) =>
      gevuld(p[sleutel]) ? sectie(label, veldBlokken(p[sleutel])) : [],
    ),
  ];

  const financiering = [
    ['Totale projectbegroting', begroting],
    ['Gevraagd bedrag', gevraagd],
    ['Eigen bijdrage', eigen],
    ['Toegekend (incl. eigen bijdrage)', toegekend],
    ['In aanvraag', inAanvraag],
    ['Nog te dekken', open],
  ].filter(([, w]) => w != null && !(w === 0 && !dekking?.heeftBegroting));

  if (financiering.length) {
    blocks.push(
      ...sectie('Financiering', [
        { type: 'table', headers: ['Onderdeel', 'Bedrag'], rows: financiering.map(([k, w]) => [k, euroTekst(w)]) },
      ]),
    );
  }

  if (cofin.length) {
    blocks.push(
      ...sectie('Co-financiers', [
        { type: 'table', headers: ['Co-financier', 'Bedrag', 'Status'], rows: cofin.map((c) => [tekst(c.naam), tekst(c.bedrag), tekst(c.status)]) },
      ]),
    );
  }

  if (eerder.length) {
    blocks.push(
      ...sectie('Eerdere aanvragen', [
        {
          type: 'table',
          headers: ['Fonds of regeling', 'Jaar', 'Bedrag', 'Uitkomst'],
          rows: eerder.map((e) => [tekst(e.fonds), tekst(e.jaar), tekst(e.bedrag), tekst(e.uitkomst)]),
        },
      ]),
    );
  }

  if (regelingen.length) {
    blocks.push(
      ...sectie('Gekoppelde fondsen en regelingen', [
        {
          type: 'table',
          headers: ['Regeling', 'Financier', 'Deadline', 'Aangevraagd bedrag', 'Status'],
          rows: regelingen.map((r) => [
            tekst(r.naam),
            tekst(r.funder),
            datumTekst(r.deadline),
            euroTekst(bedragNaarGetal(r.aangevraagd != null && r.aangevraagd !== '' ? r.aangevraagd : r.bedragMax)),
            tekst(r.plan) || 'Gepland',
          ]),
        },
      ]),
    );
  }

  if (docs.length) {
    blocks.push(...sectie('Documenten bij dit project', [{ type: 'bullets', items: docs.map((d) => `${d.soort || 'Overig'}: ${d.naam}`) }]));
  }

  // -- Excel
  const sheets = [];

  sheets.push(
    sheet(
      'Overzicht',
      [K('Onderdeel', 'onderdeel', 30), K('Waarde', 'waarde', 50, 'auto')],
      [
        { onderdeel: 'Projectnaam', waarde: naam },
        organisatieNaam ? { onderdeel: 'Organisatie', waarde: organisatieNaam } : null,
        gevuld(p.programma) ? { onderdeel: 'Programma of onderdeel', waarde: tekst(p.programma) } : null,
        looptijd ? { onderdeel: 'Looptijd', waarde: looptijd } : null,
        { onderdeel: 'Status', waarde: p.gearchiveerd ? 'Gearchiveerd' : 'Actief' },
        begroting != null ? { onderdeel: 'Totale projectbegroting', waarde: begroting, type: 'euro' } : null,
        gevraagd != null ? { onderdeel: 'Gevraagd bedrag', waarde: gevraagd, type: 'euro' } : null,
        eigen != null ? { onderdeel: 'Eigen bijdrage', waarde: eigen, type: 'euro' } : null,
        { onderdeel: 'Exportdatum', waarde: vandaag(), type: 'datum' },
      ].filter(Boolean),
    ),
  );

  const gegevens = [
    ['Projectnaam', naam],
    ['Programma of onderdeel', p.programma],
    ['Doelgroep', p.doelgroep],
    ['Projectlocatie', p.regio],
    ['Looptijd van', p.periodeVan],
    ['Looptijd tot', p.periodeTot],
    ['Partners', p.partners],
    ...PROJECT_TEKSTVELDEN.map(([s, l]) => [l, p[s]]),
  ]
    .filter(([, w]) => gevuld(w) && tekst(w) !== '')
    .map(([veld, w]) => ({ veld, waarde: afkappen(tekst(w)) }));

  sheets.push(sheet('Projectgegevens', [K('Veld', 'veld', 28), K('Waarde', 'waarde', 90)], gegevens));

  const fin = [
    ['Totale projectbegroting', begroting],
    ['Gevraagd bedrag', gevraagd],
    ['Eigen bijdrage', eigen],
    ['Toegekend (incl. eigen bijdrage)', toegekend],
    ['In aanvraag', inAanvraag],
    ['Nog te dekken', open],
  ].filter(([, w]) => w != null && !(w === 0 && !dekking?.heeftBegroting));

  if (fin.length) {
    sheets.push(
      sheet(
        'Financiering',
        [K('Onderdeel', 'onderdeel', 36), K('Bedrag', 'bedrag', 18, 'euro'), K('Aandeel van begroting', 'aandeel', 22, 'procent')],
        fin.map(([onderdeel, bedrag]) => ({
          onderdeel,
          bedrag,
          aandeel: begroting && onderdeel !== 'Totale projectbegroting' ? bedrag / begroting : null,
        })),
      ),
    );
  }

  if (cofin.length) {
    sheets.push(
      sheet(
        'Co-financiers',
        [K('Co-financier', 'naam', 36), K('Bedrag', 'bedrag', 18, 'euro'), K('Status', 'status', 18)],
        cofin.map((c) => ({ naam: tekst(c.naam), bedrag: bedragNaarGetal(c.bedrag), status: tekst(c.status) })),
      ),
    );
  }

  if (eerder.length) {
    sheets.push(
      sheet(
        'Eerdere aanvragen',
        [K('Fonds of regeling', 'fonds', 36), K('Jaar', 'jaar', 10), K('Bedrag', 'bedrag', 18, 'euro'), K('Uitkomst', 'uitkomst', 20), K('Reden', 'reden', 50)],
        eerder.map((e) => ({
          fonds: tekst(e.fonds),
          jaar: tekst(e.jaar),
          bedrag: bedragNaarGetal(e.bedrag),
          uitkomst: tekst(e.uitkomst),
          reden: tekst(e.reden),
        })),
      ),
    );
  }

  if (regelingen.length) {
    sheets.push(
      sheet(
        'Fondsen en regelingen',
        [K('Regeling', 'naam', 40), K('Financier', 'funder', 30), K('Deadline', 'deadline', 14, 'datum'), K('Aangevraagd bedrag', 'bedrag', 20, 'euro'), K('Status', 'plan', 16)],
        regelingen.map((r) => ({
          naam: tekst(r.naam),
          funder: tekst(r.funder),
          deadline: isoNaarDate(r.deadline) || tekst(r.deadline),
          bedrag: bedragNaarGetal(r.aangevraagd != null && r.aangevraagd !== '' ? r.aangevraagd : r.bedragMax),
          plan: tekst(r.plan) || 'Gepland',
        })),
      ),
    );
  }

  if (docs.length) {
    sheets.push(
      sheet(
        'Documenten',
        [K('Naam', 'naam', 50), K('Soort', 'soort', 20), K('Versie', 'versie', 10, 'getal'), K('Gemaakt op', 'gemaakt', 16, 'datum')],
        docs.map((d) => ({
          naam: d.naam,
          soort: d.soort || 'Overig',
          versie: d.versie || null,
          gemaakt: d.gemaakt ? new Date(d.gemaakt) : null,
        })),
      ),
    );
  }

  return {
    kind: 'project',
    titel: naam,
    documentType: 'Projectgegevens',
    organisatieNaam: organisatieNaam || null,
    projectNaam: naam,
    bestandsDelen: [naam, 'Projectgegevens'],
    blocks,
    sheets,
    budgetBron: null,
  };
}

// ------------------------------------------------- 3. organisatieprofiel

/**
 * @param {Object} profiel  Het organisatieprofiel (vorm van naarProfielVeld)
 * @param {Array}  velden   De bestaande VELDEN-lijst van OrganisatieprofielPage
 *                          ({s: sectie, n: sleutel, l: label, t: type}) - zo
 *                          blijven labels en volgorde altijd gelijk aan de app.
 */
export function bouwOrganisatieModel(profiel, velden) {
  const pr = profiel || {};
  const naam = tekst(pr.name) || 'Organisatie';
  const secties = [];

  (velden || []).forEach((v) => {
    if (!secties.includes(v.s)) secties.push(v.s);
  });

  const blocks = [];
  const hoofdRijen = [];

  secties.forEach((sec) => {
    const velden_ = (velden || []).filter((v) => v.s === sec);
    const kort = [];
    const lang = [];
    const contacten = [];
    const socials = [];

    velden_.forEach((v) => {
      const w = pr[v.n];

      if (!gevuld(w)) return;

      if (v.t === 'contacts') {
        (w || []).filter((c) => c && (c.naam || c.email || c.telefoon)).forEach((c) => contacten.push(c));
      } else if (v.t === 'socials') {
        (w || []).filter((x) => x && (x.url || x.platform)).forEach((x) => socials.push(x));
      } else if (v.t === 'area') {
        lang.push(v);
      } else {
        kort.push(v);
      }

      if (v.t !== 'contacts' && v.t !== 'socials') {
        hoofdRijen.push({
          sectie: sec,
          veld: v.l,
          waarde: v.t === 'number' && Number.isFinite(Number(w)) && String(w).trim() !== '' ? Number(w) : afkappen(tekst(w)),
          type: v.t === 'number' && Number.isFinite(Number(w)) && String(w).trim() !== '' ? 'getal' : 'tekst',
        });
      }
    });

    const sectieBlokken = [
      ...(kort.length ? [{ type: 'table', headers: ['Onderdeel', 'Gegeven'], rows: kort.map((v) => [v.l, tekst(pr[v.n])]) }] : []),
      ...lang.flatMap((v) => [{ type: 'heading', level: 3, text: v.l }, ...veldBlokken(pr[v.n])]),
      ...(contacten.length
        ? [
            { type: 'heading', level: 3, text: 'Contactpersonen' },
            { type: 'table', headers: ['Naam', 'Functie', 'E-mail', 'Telefoon'], rows: contacten.map((c) => [tekst(c.naam), tekst(c.functie), tekst(c.email), tekst(c.telefoon)]) },
          ]
        : []),
      ...(socials.length
        ? [
            { type: 'heading', level: 3, text: 'Social media' },
            { type: 'table', headers: ['Platform', 'Adres'], rows: socials.map((x) => [tekst(x.platform), tekst(x.url)]) },
          ]
        : []),
    ];

    blocks.push(...sectie(sec, sectieBlokken));
  });

  const sheets = [
    sheet(
      'Organisatieprofiel',
      [K('Sectie', 'sectie', 24), K('Veld', 'veld', 30), K('Waarde', 'waarde', 90, 'auto')],
      hoofdRijen,
    ),
  ];

  const contactVeld = (velden || []).find((v) => v.t === 'contacts');
  const socialVeld = (velden || []).find((v) => v.t === 'socials');
  const contactRijen = contactVeld ? (pr[contactVeld.n] || []).filter((c) => c && (c.naam || c.email || c.telefoon)) : [];
  const socialRijen = socialVeld ? (pr[socialVeld.n] || []).filter((x) => x && (x.url || x.platform)) : [];

  if (contactRijen.length) {
    sheets.push(
      sheet(
        'Contactpersonen',
        [K('Naam', 'naam', 28), K('Functie', 'functie', 28), K('E-mail', 'email', 34), K('Telefoon', 'telefoon', 18)],
        contactRijen.map((c) => ({ naam: tekst(c.naam), functie: tekst(c.functie), email: tekst(c.email), telefoon: tekst(c.telefoon) })),
      ),
    );
  }

  if (socialRijen.length) {
    sheets.push(sheet('Social media', [K('Platform', 'platform', 20), K('Adres', 'url', 60)], socialRijen.map((x) => ({ platform: tekst(x.platform), url: tekst(x.url) }))));
  }

  return {
    kind: 'organisatie',
    titel: naam,
    documentType: 'Organisatieprofiel',
    organisatieNaam: naam === 'Organisatie' ? null : naam,
    projectNaam: null,
    bestandsDelen: [naam === 'Organisatie' ? '' : naam, 'Organisatieprofiel'],
    blocks,
    sheets,
    budgetBron: null,
  };
}

// ------------------------------------------------------- 4. een gesprek

const AFZENDER = { user: 'U', assistant: 'Subsidie Kompas' };
const BERICHTTYPE = { user: 'Vraag', assistant: 'Antwoord' };

/**
 * @param {Object} gesprek  { titel, berichten: [{ role, content, tijd }], projectNaam }
 */
export function bouwGesprekModel({ titel, berichten, projectNaam, organisatieNaam }) {
  const lijst = (berichten || []).filter((b) => b && gevuld(b.content));
  const gesprekTitel = tekst(titel) || 'Gesprek';
  const datumTijd = (d) =>
    d ? `${new Date(d).toLocaleDateString('nl-NL')} ${new Date(d).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : '';

  const blocks = [];

  lijst.forEach((b) => {
    const tijd = datumTijd(b.tijd);

    blocks.push({ type: 'heading', level: 2, text: `${AFZENDER[b.role] || 'Bericht'}${tijd ? ` · ${tijd}` : ''}` });
    blocks.push(...veldBlokken(b.content));
  });

  const tijden = lijst.map((b) => b.tijd).filter(Boolean).map((d) => new Date(d));
  const eerste = tijden.length ? new Date(Math.min(...tijden)) : null;
  const laatste = tijden.length ? new Date(Math.max(...tijden)) : null;

  const sheets = [
    sheet(
      'Overzicht',
      [K('Onderdeel', 'onderdeel', 28), K('Waarde', 'waarde', 50, 'auto')],
      [
        { onderdeel: 'Gesprek', waarde: gesprekTitel },
        projectNaam ? { onderdeel: 'Gekoppeld project', waarde: projectNaam } : null,
        organisatieNaam ? { onderdeel: 'Organisatie', waarde: organisatieNaam } : null,
        { onderdeel: 'Aantal berichten', waarde: lijst.length, type: 'getal' },
        eerste ? { onderdeel: 'Eerste bericht', waarde: eerste, type: 'datumtijd' } : null,
        laatste ? { onderdeel: 'Laatste bericht', waarde: laatste, type: 'datumtijd' } : null,
        { onderdeel: 'Exportdatum', waarde: vandaag(), type: 'datum' },
      ].filter(Boolean),
    ),
    sheet(
      'Gesprek',
      [K('Nr', 'nr', 6, 'getal'), K('Datum en tijd', 'tijd', 20, 'datumtijd'), K('Afzender', 'afzender', 18), K('Type bericht', 'type', 14), K('Bericht', 'bericht', 110)],
      lijst.map((b, i) => ({
        nr: i + 1,
        tijd: b.tijd ? new Date(b.tijd) : null,
        afzender: AFZENDER[b.role] || 'Onbekend',
        type: BERICHTTYPE[b.role] || 'Bericht',
        bericht: afkappen(b.content),
      })),
    ),
  ];

  return {
    kind: 'gesprek',
    titel: gesprekTitel,
    documentType: 'Gesprek',
    organisatieNaam: organisatieNaam || null,
    projectNaam: projectNaam || null,
    bestandsDelen: [gesprekTitel, 'Gesprek'],
    blocks,
    sheets,
    budgetBron: null,
  };
}
