#!/usr/bin/env node
// Bandbreedte-onderzoek voor fondsen en regelingen. Draai vanuit de projectmap:
//   node scripts/bandbreedte/bandbreedte.mjs run   --uit scripts/bandbreedte/runs/eerste --limit 10
//   node scripts/bandbreedte/bandbreedte.mjs sheet --uit scripts/bandbreedte/runs/eerste
//   node scripts/bandbreedte/bandbreedte.mjs sql   --sheet <reviewsheet.xlsx> --uit <bestand.sql>
//   node scripts/bandbreedte/bandbreedte.mjs gatenlijst  [--uit gatenlijst.xlsx]      (invulsheet goedgekeurde fondsen en regelingen)
//   node scripts/bandbreedte/bandbreedte.mjs gatenlijst-sql --sheet <ingevulde gatenlijst.xlsx>
// De tool leest en onderzoekt; hij schrijft NOOIT naar de database. Zie README.md.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maakOphaler } from './lib/ophalen.mjs';
import { maakModelAanroep } from './lib/extractie.mjs';
import { verwerkRecord } from './lib/verwerk.mjs';
import { bouwRijen, leesSheet, maakSql, schrijfSheet } from './lib/uitvoer.mjs';
import { bouwRijen as bouwGatenRijen, leesGatenlijst, maakSql as maakGatenSql, schrijfGatenlijst } from './lib/gatenlijst.mjs';

const hier = path.dirname(fileURLToPath(import.meta.url));
const PRIJS = { 'gpt-4o': { inUsd: 2.5, uitUsd: 10 }, 'gpt-4o-mini': { inUsd: 0.15, uitUsd: 0.6 }, 'gpt-5.5': { inUsd: 5, uitUsd: 30 } };
const USD_EUR = 0.92;

function args(argv) {
  const uit = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      uit[k] = v;
    } else uit._.push(a);
  }
  return uit;
}

const lees = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const bestaat = async (p) => !!(await fs.stat(p).catch(() => null));

function zaadUrls(handmatig, naam) {
  const n = naam.toLowerCase();
  return Object.entries(handmatig.seedUrls ?? {}).filter(([k]) => n.includes(k)).flatMap(([, v]) => v);
}

function kostenEur(k, model) {
  const p = PRIJS[model] ?? PRIJS['gpt-4o'];
  const z = PRIJS['gpt-5.5'];
  return ((k.inputTokens * p.inUsd + k.outputTokens * p.uitUsd + (k.zoekInputTokens ?? 0) * z.inUsd + (k.zoekOutputTokens ?? 0) * z.uitUsd) / 1e6 + k.zoekAanroepen * 0.01) * USD_EUR;
}

async function cmdRun(o) {
  const uit = path.resolve(String(o.uit ?? path.join(hier, 'runs', new Date().toISOString().slice(0, 10))));
  const recordsPad = path.resolve(String(o.records ?? path.join(hier, 'data/records.json')));
  const handmatig = (await bestaat(path.join(hier, 'data/handmatig.json'))) ? await lees(path.join(hier, 'data/handmatig.json')) : {};
  let records = await lees(recordsPad);
  if (o.type) records = records.filter((r) => r.type === o.type);
  if (o.alleen) records = records.filter((r) => r.naam.toLowerCase().includes(String(o.alleen).toLowerCase()));
  if (o['zonder-bedrag']) records = records.filter((r) => r.min == null && r.max == null);
  if (o.limit) records = records.slice(0, Number(o.limit));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Zet eerst je OpenAI-sleutel: export OPENAI_API_KEY=...');
  const model = String(o.model ?? process.env.BANDBREEDTE_MODEL ?? 'gpt-4o');
  const zoekModel = String(o['zoek-model'] ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-5.5');
  const zoekAan = o.zoek !== 'uit';
  const parallel = Math.max(1, Number(o.parallel ?? 4));
  const maxKosten = o['max-kosten'] ? Number(o['max-kosten']) : null;
  await fs.mkdir(path.join(uit, 'records'), { recursive: true });
  const ophaler = maakOphaler({ cacheMap: path.join(uit, 'cache'), perHostWachtMs: Number(o.wacht ?? 1200) });
  const modelAanroep = maakModelAanroep({ apiKey, model });
  let klaar = 0;
  let totaalKosten = 0;
  let stop = false;
  const wachtrij = [...records];
  console.log(`Start: ${records.length} records, model ${model}, webzoeken ${zoekAan ? `aan (${zoekModel})` : 'uit'}, uitvoer ${uit}`);

  async function werker() {
    while (wachtrij.length && !stop) {
      const rec = wachtrij.shift();
      const bestand = path.join(uit, 'records', `${rec.id}.json`);
      if (!o.opnieuw && (await bestaat(bestand))) {
        klaar++;
        continue;
      }
      const res = await verwerkRecord(rec, { ophaler, modelAanroep, zoekAan, apiKey, zoekModel, startUrls: zaadUrls(handmatig, rec.naam), log: (m) => console.log(m) });
      await fs.writeFile(bestand, JSON.stringify(res, null, 1));
      klaar++;
      totaalKosten += kostenEur(res.kosten, model);
      const v = res.voorstel;
      console.log(`[${klaar}/${records.length}] ${rec.naam} — ${res.basis}/${res.zekerheid}${v.min != null || v.max != null ? ` (${v.min ?? '?'}–${v.max ?? '?'})` : ''} · ${res.documenten.filter((d) => d.ok).length}/${res.documenten.length} pagina's · ~€${totaalKosten.toFixed(2)} totaal`);
      if (maxKosten != null && totaalKosten >= maxKosten) {
        console.log(`Kostengrens van €${maxKosten} bereikt: gestopt. Draai opnieuw om verder te gaan (al klare records worden overgeslagen).`);
        stop = true;
      }
    }
  }
  await Promise.all(Array.from({ length: parallel }, werker));
  console.log(`Klaar. ${klaar} records verwerkt. Geschatte kosten ongeveer €${totaalKosten.toFixed(2)}; ophaalverzoeken: ${ophaler.statistiek.verzoeken}, uit cache: ${ophaler.statistiek.cacheHits}.`);
  console.log(`Volgende stap: node scripts/bandbreedte/bandbreedte.mjs sheet --uit ${uit}`);
}

async function cmdSheet(o) {
  const uit = path.resolve(String(o.uit));
  const recordsPad = path.resolve(String(o.records ?? path.join(hier, 'data/records.json')));
  const handmatig = (await bestaat(path.join(hier, 'data/handmatig.json'))) ? await lees(path.join(hier, 'data/handmatig.json')) : { vast: [] };
  const records = await lees(recordsPad);
  const bestanden = (await fs.readdir(path.join(uit, 'records'))).filter((f) => f.endsWith('.json'));
  const resultaten = await Promise.all(bestanden.map((f) => lees(path.join(uit, 'records', f))));
  const rijen = bouwRijen(resultaten, records, handmatig);
  const pad = path.join(uit, 'bandbreedte-review.xlsx');
  await schrijfSheet(rijen, pad, { logoPad: path.join(hier, '../../uploads/kompas-logo.png') });
  const tel = (z) => rijen.filter((r) => r.zekerheid === z).length;
  console.log(`Sheet geschreven: ${pad}\n${rijen.length} records: hoog ${tel('hoog')}, midden ${tel('midden')}, laag ${tel('laag')}, niets gevonden ${tel('geen')}.`);
}

async function cmdSql(o) {
  if (!o.sheet) throw new Error('Geef --sheet <bestand.xlsx>');
  const rijen = await leesSheet(path.resolve(String(o.sheet)));
  const { sql, aantal, problemen } = maakSql(rijen);
  const uit = path.resolve(String(o.uit ?? String(o.sheet).replace(/\.xlsx$/i, '') + '.sql'));
  await fs.writeFile(uit, sql);
  console.log(`${aantal} updates geschreven naar ${uit}`);
  if (problemen.length) {
    console.log(`${problemen.length} rijen overgeslagen:`);
    for (const p of problemen) console.log(`  rij ${p.rij} (${p.naam}): ${p.fout}`);
  }
}

async function cmdGatenlijst(o) {
  const data = await lees(path.resolve(String(o.data ?? path.join(hier, 'data/gatenlijst.json'))));
  const taxonomie = await lees(path.join(hier, 'data/taxonomie.json'));
  const handmatig = (await bestaat(path.join(hier, 'data/handmatig.json'))) ? await lees(path.join(hier, 'data/handmatig.json')) : {};
  const rijen = bouwGatenRijen(data, handmatig);
  const pad = path.resolve(String(o.uit ?? path.join(hier, 'gatenlijst.xlsx')));
  await schrijfGatenlijst(rijen, pad, { logoPad: path.join(hier, '../../uploads/kompas-logo.png'), taxonomie });
  console.log(`Geschreven: ${pad} (${rijen.length} rijen, ${rijen.reduce((s, r) => s + r.gaten, 0)} gele cellen)`);
}

async function cmdGatenlijstSql(o) {
  if (!o.sheet) throw new Error('Geef --sheet <bestand.xlsx>');
  const taxonomie = await lees(path.join(hier, 'data/taxonomie.json'));
  const rijen = await leesGatenlijst(path.resolve(String(o.sheet)));
  const { sql, aantal, problemen, genegeerd } = maakGatenSql(rijen, taxonomie);
  const uit = path.resolve(String(o.uit ?? String(o.sheet).replace(/\.xlsx$/i, '') + '.sql'));
  await fs.writeFile(uit, sql);
  console.log(`${aantal} records met wijzigingen, geschreven naar ${uit}`);
  if (genegeerd) console.log(`${genegeerd} leeggemaakte of verwijderde waarden genegeerd (de tool wist nooit iets in de database).`);
  if (problemen.length) {
    console.log(`${problemen.length} meldingen, deze rijen zijn overgeslagen:`);
    for (const p of problemen) console.log(`  rij ${p.rij} (${p.naam}): ${p.fout}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const o = args(rest);
try {
  if (cmd === 'run') await cmdRun(o);
  else if (cmd === 'sheet') await cmdSheet(o);
  else if (cmd === 'sql') await cmdSql(o);
  else if (cmd === 'gatenlijst') await cmdGatenlijst(o);
  else if (cmd === 'gatenlijst-sql') await cmdGatenlijstSql(o);
  else console.log('Gebruik: run | sheet | sql | gatenlijst | gatenlijst-sql  (zie README.md)');
} catch (e) {
  console.error('Fout:', e.message);
  process.exit(1);
}
