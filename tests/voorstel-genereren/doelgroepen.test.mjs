// Doelgroepen in de matching: strenge families (kinderen, jongeren en studenten wisselen uit, ziekte is iets anders dan een beperking), brede groepen, en
// uitvoerders (musea, scholen, kunstenaars...) die nooit uitsluiten. Dezelfde regels voor elk project; de database blijft ongewijzigd.
import { PID, w, TAXONOMIE, resetGenereren, fonds, regeling, projectRij } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

async function post(body) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, tekst };
}

const PREMIUM = { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' };

TAXONOMIE.themas.splice(0, TAXONOMIE.themas.length, 'Muziek', 'Cultuur', 'Jeugd en kinderen', 'Ouderen', 'Sociaal-maatschappelijk', 'Vluchtelingen', 'Gehandicaptenzorg', 'Armoedebestrijding');
TAXONOMIE.doelgroepen.splice(0, TAXONOMIE.doelgroepen.length,
  'Kinderen', 'Jongeren', 'Studenten', 'Ouderen', 'Gezinnen', 'Mensen in armoede', 'Mensen in een kwetsbare positie', 'Dak- en thuislozen', 'Musea', 'Culturele instellingen',
  'Podiumkunstorganisaties', 'Scholen en onderwijsinstellingen', 'Kunstenaars', 'Makers', 'Patiënten', 'Chronisch zieken', 'Mensen met een beperking', 'Blinden en slechtzienden',
  'Mantelzorgers', 'Naasten van mensen met een chronische aandoening', 'Nieuwkomers/ongedocumenteerden', 'Vluchtelingen', 'Vrouwen en meisjes', 'Serviceclubs');
TAXONOMIE.regios.splice(0, TAXONOMIE.regios.length, 'Rotterdam', 'Landelijk', 'Amsterdam', 'Regionaal');

const M = ['Muziek', 'Cultuur'];
let teller = 0;
const id = () => `00000000-0000-4000-8000-0000000003${String(++teller).padStart(2, '0')}`;
const F = (naam, doelgroepen, themas = M) => fonds({ naam, themas, doelgroepen, regios: ['Rotterdam'], id: id() });

async function draai(doelgroep, funders, { regelingen = [], project = {} } = {}) {
  teller = 0;
  resetGenereren({ funders: funders(), regelingen, profile: PREMIUM, project: projectRij({ target_groups: doelgroep, budget_total: 3000000, own_contribution: 0, ...project }) });
  const r = await post({ mode: 'voorstel-genereren', projectId: PID });
  const regels = [...(r.json?.voorstel?.regels || [])];

  return { r, regels, namen: regels.map((x) => x.naam), per: (n) => regels.find((x) => x.naam === n)?.kenmerken };
}

const heeft = (k, re) => (k?.controleren || []).some((c) => re.test(c));

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Jeugd: kinderen, jongeren en studenten wisselen uit; andere groepen vallen af');
{
  const { r, namen, per } = await draai('Kinderen', () => [
    F('Fonds Kinderen', ['Kinderen']), F('Fonds Jongeren', ['Jongeren']), F('Fonds Studenten', ['Studenten']), F('Fonds Ouderen', ['Ouderen']),
    F('Fonds Armoede', ['Mensen in armoede']), F('Fonds Gezinnen', ['Gezinnen']), F('Fonds Jeugddiscipline', [], ['Muziek', 'Jeugd en kinderen']),
    F('Fonds Musea', ['Musea']), F('Fonds Musea en Ouderen', ['Musea', 'Ouderen']), F('Fonds Jeugdthema Patiënten', ['Patiënten'], ['Muziek', 'Jeugd en kinderen']),
  ]);

  check('het voorstel wordt gemaakt', r.status === 200 && r.json.ok === true, r.tekst.slice(0, 200));
  check('kinderen: aantoonbaar, zonder leeftijdsnotitie', namen.includes('Fonds Kinderen') && per('Fonds Kinderen').passendheid === 'aantoonbaar' && !heeft(per('Fonds Kinderen'), /leeftijdsgrens/), JSON.stringify(per('Fonds Kinderen')));
  check('jongeren bij een kinderproject: komt mee, met de aantekening de leeftijdsgrens te controleren', namen.includes('Fonds Jongeren') && heeft(per('Fonds Jongeren'), /leeftijdsgrens/), JSON.stringify(namen));
  check('studenten bij een kinderproject: komt mee', namen.includes('Fonds Studenten'), JSON.stringify(namen));
  check('fonds met alleen de discipline Jeugd en kinderen (geen doelgroep): komt mee', namen.includes('Fonds Jeugddiscipline'), JSON.stringify(namen));
  check('ouderen: valt af', !namen.includes('Fonds Ouderen'));
  check('alleen een brede groep (armoede, gezinnen): valt af voor een kinderproject', !namen.includes('Fonds Armoede') && !namen.includes('Fonds Gezinnen'), JSON.stringify(namen));
  check('alleen een uitvoerder (musea): sluit niet uit, maar staat als te controleren', namen.includes('Fonds Musea') && per('Fonds Musea').passendheid === 'mogelijk' && heeft(per('Fonds Musea'), /geen doelgroep, alleen wie kan aanvragen/), JSON.stringify(per('Fonds Musea')));
  check('alleen de discipline Jeugd en kinderen, maar als doelgroep patiënten: komt mee als mogelijk, met controlepunt', namen.includes('Fonds Jeugdthema Patiënten') && per('Fonds Jeugdthema Patiënten').passendheid === 'mogelijk' && heeft(per('Fonds Jeugdthema Patiënten'), /als thema/), JSON.stringify(per('Fonds Jeugdthema Patiënten')));
  check('uitvoerder samen met een andere mensengroep: het mensendeel bepaalt (valt af)', !namen.includes('Fonds Musea en Ouderen'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Uitvoerders sluiten nooit uit (de fout bij culturele regelingen)');
{
  const funders = () => [
    F('Fonds Culturele instellingen', ['Culturele instellingen']), F('Fonds Podium', ['Podiumkunstorganisaties', 'Musea']), F('Fonds Kunstenaars', ['Kunstenaars']),
    F('Fonds Makers', ['Makers']), F('Fonds Ouderen', ['Ouderen']),
  ];
  const jong = await draai('Jongeren', funders);

  check('jongerenproject: een fonds voor culturele instellingen valt niet af', jong.namen.includes('Fonds Culturele instellingen') && jong.per('Fonds Culturele instellingen').passendheid === 'mogelijk', JSON.stringify(jong.namen));
  check('jongerenproject: een fonds voor podiumkunstorganisaties en musea valt niet af', jong.namen.includes('Fonds Podium'));
  check('jongerenproject: een fonds voor kunstenaars valt niet af', jong.namen.includes('Fonds Kunstenaars') && jong.namen.includes('Fonds Makers'));
  check('jongerenproject: een fonds voor ouderen valt wel af', !jong.namen.includes('Fonds Ouderen'));

  const kunst = await draai('Kunstenaars', funders);

  check('project voor kunstenaars: fonds voor kunstenaars is een pluspunt (aantoonbaar)', kunst.per('Fonds Kunstenaars')?.passendheid === 'aantoonbaar', JSON.stringify(kunst.per('Fonds Kunstenaars')));
  check('project voor kunstenaars: fonds voor makers telt als dezelfde familie (aantoonbaar)', kunst.per('Fonds Makers')?.passendheid === 'aantoonbaar', JSON.stringify(kunst.per('Fonds Makers')));
  check('project voor kunstenaars: fonds voor culturele instellingen valt niet af', kunst.namen.includes('Fonds Culturele instellingen'));
  check('project voor kunstenaars zonder bekende doelgroep: fonds voor ouderen komt mee als te controleren, geen uitsluiting', kunst.namen.includes('Fonds Ouderen') && kunst.per('Fonds Ouderen').passendheid === 'mogelijk' && heeft(kunst.per('Fonds Ouderen'), /controleer of uw doelgroep/), JSON.stringify(kunst.per('Fonds Ouderen')));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Ziekte en beperking zijn aparte families');
{
  const funders = () => [F('Fonds Patiënten', ['Patiënten']), F('Fonds Chronisch zieken', ['Chronisch zieken']), F('Fonds Beperking', ['Mensen met een beperking']), F('Fonds Zicht', ['Blinden en slechtzienden']), F('Fonds Zorgdiscipline', [], ['Muziek', 'Gehandicaptenzorg'])];
  const ziek = await draai('Patiënten', funders);

  check('project voor patiënten: chronisch zieken komt mee', ziek.namen.includes('Fonds Patiënten') && ziek.namen.includes('Fonds Chronisch zieken'), JSON.stringify(ziek.namen));
  check('project voor patiënten: een fonds voor mensen met een beperking valt af', !ziek.namen.includes('Fonds Beperking') && !ziek.namen.includes('Fonds Zicht') && !ziek.namen.includes('Fonds Zorgdiscipline'), JSON.stringify(ziek.namen));

  const beperking = await draai('Mensen met een beperking', funders);

  check('project voor mensen met een beperking: blinden en de discipline gehandicaptenzorg komen mee', beperking.namen.includes('Fonds Beperking') && beperking.namen.includes('Fonds Zicht') && beperking.namen.includes('Fonds Zorgdiscipline'), JSON.stringify(beperking.namen));
  check('project voor mensen met een beperking: een fonds voor patiënten valt af', !beperking.namen.includes('Fonds Patiënten') && !beperking.namen.includes('Fonds Chronisch zieken'), JSON.stringify(beperking.namen));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Verzorgers: mantelzorgers en naasten van mensen met een chronische aandoening');
{
  const funders = () => [F('Fonds Naasten', ['Naasten van mensen met een chronische aandoening']), F('Fonds Mantelzorgers', ['Mantelzorgers']), F('Fonds Patiënten', ['Patiënten']), F('Fonds Ouderen', ['Ouderen'])];
  const mz = await draai('Mantelzorgers', funders);

  check('mantelzorgers en naasten wisselen uit', mz.namen.includes('Fonds Mantelzorgers') && mz.namen.includes('Fonds Naasten'), JSON.stringify(mz.namen));
  check('een fonds voor patiënten of ouderen is geen fonds voor verzorgers (valt af)', !mz.namen.includes('Fonds Patiënten') && !mz.namen.includes('Fonds Ouderen'), JSON.stringify(mz.namen));

  const naasten = await draai('Naasten van mensen met een chronische aandoening', funders);

  check('andersom ook: naasten vinden een fonds voor mantelzorgers', naasten.namen.includes('Fonds Mantelzorgers'), JSON.stringify(naasten.namen));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Migratie: ongedocumenteerden en vluchtelingen, met een controlepunt over de verblijfsstatus');
{
  const funders = () => [
    F('Fonds Nieuwkomers', ['Nieuwkomers/ongedocumenteerden']), F('Fonds Vluchtelingen', ['Vluchtelingen']), F('Fonds Kwetsbaar', ['Mensen in een kwetsbare positie']),
    F('Fonds Kinderen', ['Kinderen']), F('Fonds Vluchtelingendiscipline', [], ['Muziek', 'Vluchtelingen']),
    F('Kinderfonds Zonneland', ['Kinderen', 'Mensen in een kwetsbare positie'], ['Muziek', 'Jeugd en kinderen']),
    F('Algemeen Fonds Noordster', ['Jongeren', 'Mensen met een beperking', 'Mensen in een kwetsbare positie']),
    F('Breed Fonds Poolster', ['Jongeren', 'Kinderen', 'Gemeenschappen', 'Buurtbewoners', 'Mensen in een kwetsbare positie']),
  ];
  const { namen, per } = await draai('Nieuwkomers/ongedocumenteerden', funders);

  check('fonds voor nieuwkomers/ongedocumenteerden: aantoonbaar', namen.includes('Fonds Nieuwkomers') && per('Fonds Nieuwkomers').passendheid === 'aantoonbaar', JSON.stringify(per('Fonds Nieuwkomers')));
  check('fonds voor vluchtelingen: mogelijk, met controlepunt over de verblijfsstatus', namen.includes('Fonds Vluchtelingen') && per('Fonds Vluchtelingen').passendheid === 'mogelijk' && heeft(per('Fonds Vluchtelingen'), /verblijfsstatus/), JSON.stringify(per('Fonds Vluchtelingen')));
  check('breed sociaal fonds (kwetsbare positie): mogelijk, met controlepunt over de verblijfsvergunning', namen.includes('Fonds Kwetsbaar') && per('Fonds Kwetsbaar').passendheid === 'mogelijk' && heeft(per('Fonds Kwetsbaar'), /verblijfsvergunning/), JSON.stringify(per('Fonds Kwetsbaar')));
  check('fonds voor kinderen valt af', !namen.includes('Fonds Kinderen'));
  check('kinderfonds dat ook "kwetsbare positie" noemt (specialist voor één groep) valt af voor nieuwkomers', !namen.includes('Kinderfonds Zonneland'), JSON.stringify(namen));
  check('breed fonds met één familie (jeugd) en meerdere brede groepen is geen specialist: blijft mogelijk', namen.includes('Breed Fonds Poolster'), JSON.stringify(namen));
  check('algemener fonds (meerdere groepen) met kwetsbare positie blijft mogelijk', namen.includes('Algemeen Fonds Noordster'), JSON.stringify(namen));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Strenge én brede groep in één project: de "of"-regel');
{
  const funders = () => [
    F('Fonds Kinderen', ['Kinderen']), F('Fonds Armoede', ['Mensen in armoede']), F('Fonds Kwetsbaar', ['Mensen in een kwetsbare positie']),
    F('Fonds Ouderen', ['Ouderen']), F('Fonds Dak- en thuislozen', ['Dak- en thuislozen']),
  ];
  const { namen, per } = await draai('Kinderen, Mensen in armoede', funders);

  check('fonds voor kinderen: aantoonbaar', namen.includes('Fonds Kinderen') && per('Fonds Kinderen').passendheid === 'aantoonbaar', JSON.stringify(per('Fonds Kinderen')));
  check('fonds voor mensen in armoede: komt mee als mogelijk, met controlepunt', namen.includes('Fonds Armoede') && per('Fonds Armoede').passendheid === 'mogelijk' && heeft(per('Fonds Armoede'), /bredere doelgroep/), JSON.stringify(per('Fonds Armoede')));
  check('verwante brede groep (kwetsbare positie): komt mee als mogelijk', namen.includes('Fonds Kwetsbaar') && per('Fonds Kwetsbaar').passendheid === 'mogelijk', JSON.stringify(namen));
  check('fonds voor ouderen of dak- en thuislozen valt af', !namen.includes('Fonds Ouderen') && !namen.includes('Fonds Dak- en thuislozen'), JSON.stringify(namen));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. Alleen brede groepen: geen poort voor het project; een specialistisch fonds valt wel af');
{
  const funders = () => [F('Fonds Armoede', ['Mensen in armoede']), F('Fonds Kwetsbaar', ['Mensen in een kwetsbare positie']), F('Fonds Ouderen', ['Ouderen']), F('Fonds Musea', ['Musea']), F('Kinderfonds Armoede', ['Kinderen', 'Mensen in armoede'])];
  const { namen, per } = await draai('Mensen in armoede', funders);

  check('exacte brede groep: aantoonbaar', namen.includes('Fonds Armoede') && per('Fonds Armoede').passendheid === 'aantoonbaar', JSON.stringify(per('Fonds Armoede')));
  check('verwante brede groep: mogelijk', namen.includes('Fonds Kwetsbaar') && per('Fonds Kwetsbaar').passendheid === 'mogelijk', JSON.stringify(namen));
  check('fonds uitsluitend voor ouderen valt af bij een project voor mensen in armoede', !namen.includes('Fonds Ouderen'));
  check('fonds voor musea valt niet af', namen.includes('Fonds Musea'));
  check('kinderfonds dat ook armoede noemt (specialist) valt af bij een project voor mensen in armoede', !namen.includes('Kinderfonds Armoede'), JSON.stringify(namen));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('8. Serviceclubs (zoals de Rotary Global Grant): onderaan als optioneel, met uitleg, alleen bij het juiste onderwerp');
{
  const club = () => regeling({ naam: 'Global Grant', gever: 'The Rotary Foundation', themas: ['Muziek'], doelgroepen: ['Serviceclubs'], regios: ['Rotterdam'], id: '00000000-0000-4000-8000-000000000390', extra: { type_gever: 'service_club' } });
  const funders = () => [F('Fonds Armoede Gewoon', ['Mensen in armoede'])];
  const arm = await draai('Mensen in armoede', funders, { regelingen: [club()], project: { themes: 'Muziek, Armoedebestrijding' } });
  const regel = arm.regels.find((x) => x.naam === 'Global Grant');

  check('project over armoedebestrijding: de Global Grant komt mee', Boolean(regel), JSON.stringify(arm.namen));
  check('... helemaal onderaan en als optioneel te onderzoeken', arm.regels[arm.regels.length - 1]?.naam === 'Global Grant' && regel?.onderdeel === 'Optioneel te onderzoeken', JSON.stringify(arm.regels.map((x) => [x.naam, x.onderdeel])));
  check('... met de uitleg over hoe Rotary werkt (wereldwijd netwerk, landelijk hoofdorgaan, clubs per regio)', (regel?.onzekerheden || []).some((t) => /wereldwijd netwerk/.test(t) && /landelijk hoofdorgaan/.test(t) && /regio/.test(t)), JSON.stringify(regel?.onzekerheden));

  const muziek = await draai('Mensen in armoede', funders, { regelingen: [club()], project: { themes: 'Muziek, Cultuur' } });

  check('project over muziek en cultuur: de Global Grant wordt niet aangeboden', !muziek.namen.includes('Global Grant'), JSON.stringify(muziek.namen));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('9. Werkgebied "Amsterdam + Regionaal" is de regio rond Amsterdam, niet heel Nederland');
{
  const funders = () => [
    fonds({ naam: 'Stichting Grachtengordel', themas: M, doelgroepen: ['Ouderen'], regios: ['Amsterdam', 'Regionaal'], id: id() }),
    fonds({ naam: 'Stichting Maasoever', themas: M, doelgroepen: ['Ouderen'], regios: ['Rotterdam', 'Regionaal'], id: id() }),
    fonds({ naam: 'Stichting Heideveld', themas: M, doelgroepen: ['Ouderen'], regios: ['Regionaal'], id: id() }),
    fonds({ naam: 'Stichting Noorderlicht', themas: M, doelgroepen: ['Ouderen'], regios: ['Amsterdam', 'Landelijk'], id: id() }),
  ];
  const { namen } = await draai('Ouderen', funders);

  check('Amsterdam + Regionaal valt af voor een project in Rotterdam', !namen.includes('Stichting Grachtengordel'), JSON.stringify(namen));
  check('Rotterdam + Regionaal past', namen.includes('Stichting Maasoever'), JSON.stringify(namen));
  check('alleen Regionaal (niet gespecificeerd) blijft een controlepunt, geen uitsluiting', namen.includes('Stichting Heideveld'), JSON.stringify(namen));
  check('Amsterdam + Landelijk blijft meedoen', namen.includes('Stichting Noorderlicht'), JSON.stringify(namen));
}

console.log(`\ndoelgroepen: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
