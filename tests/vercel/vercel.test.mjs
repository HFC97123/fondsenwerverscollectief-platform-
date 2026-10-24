// Controle op vercel.json: elk adres (bijvoorbeeld /subsidie-kompas of /actueel) moet de app teruggeven, ook na herladen.
// Met cleanUrls bestaat /index.html niet meer als bestemming van de rewrite en geeft Vercel "404: NOT_FOUND" op elk adres behalve /.
//   node tests/vercel/vercel.test.mjs   (vanuit de repo-root)
import { readFileSync } from 'node:fs';

let ok = 0;
let fail = 0;
const check = (naam, cond, extra = '') => {
  if (cond) ok += 1;
  else {
    fail += 1;
    console.log('FAIL:', naam, extra);
  }
};

const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const r = (v.rewrites || [])[0] || {};

check('vercel.json: geen cleanUrls (dat breekt de rewrite naar /index.html)', v.cleanUrls !== true);
check('vercel.json: rewrite stuurt alle adressen naar /index.html', r.destination === '/index.html' && typeof r.source === 'string');
const re = new RegExp(`^${r.source.replace(/^\//, '/')}$`);
['/subsidie-kompas', '/subsidie-kompas/deadlines', '/actueel', '/contact', '/beheer'].forEach((p) => check(`rewrite geldt voor ${p}`, re.test(p)));
['/assets/app-abc.js', '/uploads/kompas-logo.png'].forEach((p) => check(`rewrite laat ${p} met rust`, !re.test(p)));
check('vercel.json: bouwt naar dist', v.outputDirectory === 'dist' && v.buildCommand === 'npm run build');

console.log(`${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
