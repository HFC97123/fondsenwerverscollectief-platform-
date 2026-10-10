import { readFileSync, existsSync } from 'node:fs';

let ok = 0, fail = 0;
const check = (n, c) => { if (c) ok += 1; else { fail += 1; console.log('FAIL:', n); } };
const lees = (p) => readFileSync(p, 'utf8');

const netwerk = lees('src/features/website/NetwerkPage.jsx');
const provider = lees('src/features/website/WebsiteProvider.jsx');
const routes = lees('src/app/routes.js');
const header = lees('src/features/website/Header.jsx');
const footer = lees('src/features/website/Footer.jsx');
const subnav = lees('src/shared/ui/KompasSubnav.jsx');
const workspace = lees('src/data/services/workspace.js');
const store = lees('src/features/kompas-app/KompasStore.jsx');

// ledenlijst weg
for (const t of ['Leden van het Collectief', 'Zoek op naam, expertise of regio', 'ledenlijst', 'ledenQuery', 'ledenHidden', 'zichtbaar voor andere leden', 'Wilt u zichtbaar zijn']) {
  check(`NetwerkPage bevat niet: ${t}`, !netwerk.includes(t) || t === 'ledenlijst' && !/ledenlijst[A-Z(\s=:,]/.test(netwerk.replace(/\/\/.*\n/g, '')));
}
check('provider exporteert geen ledenlijst/zichtbaarheid meer', !/ledenlijst\s*:|ledenQuery\s*:|toggleMemberVisible\s*:|visHint\s*:|ledenGefilterd/.test(provider));
check('geen leden-route', !/pad: '\/(leden|members|ledenlijst|community|smoelenboek)/i.test(routes));
check('/netwerk (ledengedeelte) bestaat nog', /pad: '\/netwerk'/.test(routes));
check('geen ledenoverzicht-link in Header/Footer/Subnav', ![header, footer, subnav].some((t) => /ledenlijst|alle leden|communityleden|smoelenboek/i.test(t)));

// eigen profiel en overige community blijft
for (const t of ['Over mij', 'profileFullName', 'Uitloggen', 'Praktijkgidsen', 'Vraag', 'Vacatures']) {
  check(`NetwerkPage bevat nog: ${t}`, netwerk.includes(t));
}
check('auteurs bij vragen blijven getoond', netwerk.includes('{q.author}') && netwerk.includes('{r.author}') && netwerk.includes('{post.author}'));
check('antwoorden/vragen plaatsen blijft', /postQuestion|submitQuestion|plaatsVraag|onQuestion|questionDraft/i.test(provider));

// data blijft: voorkeur wordt nog bewaard
check('voorkeur zichtbaar_in_ledenlijst blijft bewaard (geen datawijziging)', workspace.includes('zichtbaar_in_ledenlijst') && store.includes('memberVisible'));
check('geen database-/migratiebestand aangeraakt voor ledenlijst', !existsSync('supabase/migrations/20261010130000_leden.sql'));

console.log(`\nRESULTAAT: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
