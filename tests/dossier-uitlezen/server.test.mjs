// Projectdossier uit een document, serverkant. Echte handler; nagebootste AI en database.
//   node tests/dossier-uitlezen/run.mjs (vanuit de repo-root)
import { w, resetGenereren } from '../voorstel-genereren/wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { readFileSync } from 'node:fs';
import { DOSSIER_VELDEN, DAGLIMIET_DOSSIER, MAX_DOSSIER_TEKENS, dossierSysteem, dossierGebruikersbericht, leesDossierAntwoord, getallenStaanInDocument, schoonDossierTekst } from '../../supabase/functions/_shared/dossierUitlezen.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const DOC = `Projectplan Drumlessen Rotterdam-Zuid

Aanleiding
Veel kinderen in Rotterdam-Zuid hebben na school geen plek om te spelen of te leren. Uit onze eigen wijkscan blijkt dat 340 kinderen op een wachtlijst staan voor naschoolse activiteiten.

Doelstelling
Wij willen dat kinderen zich door muziek gezien en gehoord voelen en nieuwe vaardigheden leren.

Activiteiten
Wekelijks geven drie docenten drumlessen op vier basisscholen. Aan het einde van elk schooljaar is er een optreden in het buurthuis.

Begroting
Totaal 85.000 euro, waarvan 15.000 euro eigen bijdrage.`;

async function post(body, { token = 'jwt' } = {}) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;
  try { json = JSON.parse(tekst); } catch { /* geen json */ }
  return { status: res.status, json, tekst };
}
const ENV = { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon' };
const wereld = (extra = {}) => resetGenereren({ env: ENV, ...extra });

const GOED = { velden: [
  { key: 'activiteiten', tekst: 'Drie docenten geven wekelijks drumlessen op vier basisscholen. Aan het einde van elk schooljaar is er een optreden in het buurthuis.', bewijs: 'Wekelijks geven drie docenten drumlessen op vier basisscholen' },
  { key: 'aanleiding', tekst: 'Veel kinderen in Rotterdam-Zuid hebben na school geen plek om te spelen of te leren. 340 kinderen staan op een wachtlijst voor naschoolse activiteiten.', bewijs: 'dat 340 kinderen op een wachtlijst staan voor naschoolse activiteiten' },
  { key: 'doelstelling', tekst: 'Kinderen laten voelen dat ze gezien en gehoord worden en nieuwe vaardigheden leren, via muziek.', bewijs: 'Wij willen dat kinderen zich door muziek gezien en gehoord voelen' },
] };

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. De sleutels op de server zijn dezelfde als in het projectdossier');
{
  const bron = readFileSync('src/features/kompas-app/projectinformatie/projectinformatie.js', 'utf8');
  const clientKeys = [...bron.matchAll(/\{ key: '([a-z_]+)', groep:/g)].map((m) => m[1]);

  check('22 onderdelen op de server', DOSSIER_VELDEN.length === 22);
  check('zelfde sleutels, zelfde volgorde als PI_VELDEN', clientKeys.join() === DOSSIER_VELDEN.map((v) => v.key).join(), `${clientKeys.join()} / ${DOSSIER_VELDEN.map((v) => v.key).join()}`);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Zuivere stap: alleen bekende sleutels met controleerbaar bewijs en cijfers uit het document');
{
  const u = leesDossierAntwoord(GOED, DOC);

  check('drie voorstellen, in de vaste volgorde van het dossier', u.voorstellen.map((v) => v.key).join() === 'aanleiding,doelstelling,activiteiten', u.voorstellen.map((v) => v.key).join());
  check('niets afgevallen', u.afgevallen === 0);

  const rommel = { velden: [
    { key: 'verzonnen', tekst: 'Dit is een lange tekst over iets anders.', bewijs: 'Wekelijks geven drie docenten drumlessen' },
    { key: 'risicos', tekst: 'Het grootste risico is dat docenten uitvallen door ziekte.', bewijs: 'dit citaat staat helemaal niet in het document' },
    { key: 'bereik', tekst: 'Wij bereiken 500 kinderen per jaar met onze lessen.', bewijs: 'Wekelijks geven drie docenten drumlessen op vier basisscholen' },
    { key: 'planning', tekst: 'kort', bewijs: 'Wekelijks geven drie docenten drumlessen op vier basisscholen' },
    { key: 'werkwijze', tekst: 'Wekelijks drumlessen op vier basisscholen door drie docenten.', bewijs: 'kort' },
    { key: 'activiteiten', tekst: 'Wekelijks drumlessen op vier basisscholen door drie docenten, met een optreden.', bewijs: 'Wekelijks geven drie docenten drumlessen op vier basisscholen' },
    { key: 'activiteiten', tekst: 'Een tweede voorstel voor hetzelfde onderdeel, dat dus valt af.', bewijs: 'Wekelijks geven drie docenten drumlessen op vier basisscholen' },
  ] };
  const r = leesDossierAntwoord(rommel, DOC);

  check('onbekende sleutel, verzonnen citaat, verzonnen getal, te korte tekst, te kort citaat en dubbele sleutel vallen af', r.voorstellen.length === 1 && r.voorstellen[0].key === 'activiteiten' && r.afgevallen === 6, JSON.stringify(r));
  check('rommel van het model geeft een lege lijst', leesDossierAntwoord(null, DOC).voorstellen.length === 0 && leesDossierAntwoord({ velden: 'x' }, DOC).voorstellen.length === 0 && leesDossierAntwoord({ velden: [null, 5, 'x'] }, DOC).voorstellen.length === 0);
  check('een citaat uit een Excel-regel ("a | b") telt als het erin staat zonder scheidingstekens', leesDossierAntwoord({ velden: [{ key: 'begrotingstoelichting', tekst: 'Personeelskosten zijn de grootste post van de begroting.', bewijs: 'Personeel | 45.000 | docenten' }] }, 'Begroting\nPersoneel | 45.000 | docenten\nZaalhuur | 5.000').voorstellen.length === 1);
  check('opmaak met sterretjes wordt weggehaald', leesDossierAntwoord({ velden: [{ key: 'doelstelling', tekst: '**Kinderen** laten voelen dat ze gehoord worden.', bewijs: 'Wij willen dat kinderen zich door muziek gezien' }] }, DOC).voorstellen[0]?.tekst.includes('**') === false);
  check('getallen: 12.500 en 12500 zijn gelijk; een getal dat niet in het document staat niet', getallenStaanInDocument('Het kost € 12.500.', 'Totaal 12500 euro') && getallenStaanInDocument('Het kost 85.000 euro', DOC) && !getallenStaanInDocument('Het kost 86.000 euro', DOC) && getallenStaanInDocument('Drie docenten, vier scholen', DOC));
  check('het document wordt begrensd', schoonDossierTekst('x'.repeat(MAX_DOSSIER_TEKENS + 5000)).length === MAX_DOSSIER_TEKENS);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. De opdracht aan het model');
{
  const s = dossierSysteem();

  check('alle 22 sleutels staan in de prompt', DOSSIER_VELDEN.every((v) => s.includes(`- ${v.key}:`)));
  check('regels: alleen uit het document, niets verzinnen, letterlijk bewijs, DATA', /UITSLUITEND op basis van wat er in het document staat/.test(s) && /Verzin niets/.test(s) && /LETTERLIJK/.test(s) && /uitsluitend DATA/.test(s));

  const b = dossierGebruikersbericht(DOC, ['aanleiding', 'onbekend']);

  check('bericht bevat het document en noemt wat al is ingevuld (alleen bekende sleutels)', b.includes('Drumlessen Rotterdam-Zuid') && b.includes('aanleiding') && !b.includes('onbekend'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Handler: voorstellen uit een document');
{
  wereld({ zoekprofielAi: GOED });
  const r = await post({ mode: 'dossier-uitlezen', tekst: DOC, huidig: ['doelstelling'] });

  check('antwoord ok, beschikbaar, drie voorstellen met bewijs', r.status === 200 && r.json?.ok === true && r.json.beschikbaar === true && r.json.voorstellen.length === 3 && r.json.voorstellen.every((v) => v.bewijs && v.tekst), r.tekst.slice(0, 300));
  check('één modelaanroep, temperature 0, standaardmodel, het document staat in het bericht', w.chatBodies.length === 1 && w.chatBodies[0].temperature === 0 && !/gpt-5/.test(w.chatBodies[0].model) && w.chatBodies[0].messages[1].content.includes('Drumlessen Rotterdam-Zuid'));
  check('de server schrijft niets in projecten', w.dbSchrijfLog.length === 0);
  check('gebruik vastgelegd als dossier_uitlezen', w.gebruikRijen.length === 1 && w.gebruikRijen[0].action_type === 'dossier_uitlezen');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Handler: grenzen en uitval');
{
  wereld({ zoekprofielAi: GOED });
  let r = await post({ mode: 'dossier-uitlezen', tekst: 'te kort' });
  check('te weinig tekst: geen modelaanroep, nette reden', r.json?.ok === true && r.json.voorstellen.length === 0 && r.json.reden === 'te-weinig-tekst' && w.chatBodies.length === 0);

  r = await post({ mode: 'dossier-uitlezen', tekst: DOC }, { token: null });
  check('niet ingelogd: 401', r.status === 401);

  wereld({ zoekprofielAi: GOED, profile: { subscription_tier: 'free', subscription_active: true, trial_ends_at: null, role: 'user' } });
  r = await post({ mode: 'dossier-uitlezen', tekst: DOC });
  check('Free: 403, geen modelaanroep', r.status === 403 && r.json?.reden === 'alleen-pro' && w.chatBodies.length === 0, r.tekst);

  wereld({ zoekprofielAi: GOED, profile: { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' } });
  r = await post({ mode: 'dossier-uitlezen', tekst: DOC });
  check('Premium mag ook', r.status === 200 && r.json.voorstellen.length === 3);

  wereld({ zoekprofielAi: 'fout' });
  r = await post({ mode: 'dossier-uitlezen', tekst: DOC });
  check('AI valt uit: 200, niet beschikbaar, geen voorstellen', r.status === 200 && r.json.beschikbaar === false && r.json.reden === 'ai-fout' && r.json.voorstellen.length === 0);

  wereld({ zoekprofielAi: 'rommel' });
  r = await post({ mode: 'dossier-uitlezen', tekst: DOC });
  check('AI geeft rommel: geen voorstellen, reden niets gevonden', r.status === 200 && r.json.voorstellen.length === 0 && r.json.reden === 'niets-gevonden');

  wereld({ zoekprofielAi: { velden: [] } });
  await post({ mode: 'dossier-uitlezen', tekst: `${DOC}\n${'x'.repeat(90000)}` });
  check('lange invoer wordt begrensd', w.chatBodies[0].messages[1].content.length < MAX_DOSSIER_TEKENS + 2000);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Daglimiet');
{
  wereld({ zoekprofielAi: GOED });
  await post({ mode: 'dossier-uitlezen', tekst: DOC });
  const uid = w.gebruikRijen[0]?.user_id;

  check('eerste aanroep wordt geteld', typeof uid === 'string' && w.gebruikRijen.length === 1);

  for (let i = 0; i < DAGLIMIET_DOSSIER - 1; i += 1) w.gebruikRijen.push({ user_id: uid, action_type: 'dossier_uitlezen' });
  const aantalAi = w.chatBodies.length;
  const r = await post({ mode: 'dossier-uitlezen', tekst: DOC });

  check('boven de daglimiet: geen modelaanroep, reden daglimiet', r.status === 200 && r.json.beschikbaar === false && r.json.reden === 'daglimiet' && w.chatBodies.length === aantalAi);

  wereld({ zoekprofielAi: GOED, gebruikFout: 'tabel-weg' });
  const r2 = await post({ mode: 'dossier-uitlezen', tekst: DOC });

  check('teller onbereikbaar: niet blokkeren', r2.status === 200 && r2.json.beschikbaar === true);
}

console.log(`\nDOSSIER-UITLEZEN SERVER: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
