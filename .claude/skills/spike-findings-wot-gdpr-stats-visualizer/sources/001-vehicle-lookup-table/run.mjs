// Spike 001: pull the WoT vehicle list from the official WG API (needs WG_APPLICATION_ID), then measure
// how many ids in the real export resolve. Output (raw list + report) goes to out.local/ (gitignored).
// Key: env WG_APPLICATION_ID, or a line `WG_APPLICATION_ID=...` in <repo>/.env.local
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readExport, num } from '../_lib/export-reader.mjs';

const envFile = new URL('../../../.env.local', import.meta.url);
let key = process.env.WG_APPLICATION_ID;
if (!key && existsSync(envFile)) key = /^WG_APPLICATION_ID=(.+)$/m.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim();
if (!key) { console.error('No WG_APPLICATION_ID in env or .env.local'); process.exit(1); }

const out = new URL('./out.local/', import.meta.url);
mkdirSync(out, { recursive: true });

const url = (page) => `https://api.worldoftanks.eu/wot/encyclopedia/vehicles/?application_id=${encodeURIComponent(key)}&language=en&limit=100&page_no=${page}&fields=tank_id,tag,name,short_name,type,tier,nation,is_premium,is_gift`;
const vehicles = [];
for (let page = 1; ; page++) {
  const j = await (await fetch(url(page))).json();
  if (j.status !== 'ok') { console.error('API error:', JSON.stringify(j.error)); process.exit(1); }
  vehicles.push(...Object.values(j.data));
  if (page >= j.meta.page_total) break;
}
writeFileSync(new URL('vehicles.raw.json', out), JSON.stringify(vehicles));
console.log(`API vehicles: ${vehicles.length}`);

const byTag = new Map(vehicles.map((v) => [`${v.nation}:${v.tag}`, v]));
const byId = new Map(vehicles.map((v) => [String(v.tank_id), v]));
const compact = vehicles.map((v) => [v.tank_id, `${v.nation}:${v.tag}`, v.short_name || v.name, v.type, v.tier]);
console.log(`compact table: ${JSON.stringify(compact).length} B raw, ${gzipSync(JSON.stringify(compact)).length} B gzip`);

const data = readExport(process.argv[2]);
let seen = 0, hit = 0, battlesSeen = 0, battlesHit = 0; const misses = [];
const recIds = new Set();
for (const files of Object.values(data)) {
  for (const r of files['player_statistics/wot_vehicle_statistics.csv'] ?? []) {
    const b = num(r.BATTLES_COUNT) ?? 0; seen++; battlesSeen += b;
    if (byTag.has(r.VEHICLE_NAME)) { hit++; battlesHit += b; } else misses.push([r.VEHICLE_NAME, b]);
  }
  const a = files['player_statistics/wot_account_statistics.csv']?.[0];
  for (const k of ['MAX_DAMAGE_VEHICLE', 'MAX_XP_VEHICLE', 'MAX_FRAGS_VEHICLE']) if (a?.[k] && a[k] !== '\\N') recIds.add(a[k]);
}
console.log(`tag coverage: ${hit}/${seen} tanks, ${battlesHit}/${battlesSeen} battles (${((battlesHit / battlesSeen) * 100).toFixed(1)}%)`);
console.log('top misses:', misses.sort((x, y) => y[1] - x[1]).slice(0, 10).map(([t, b]) => `${t} ${b}`).join(' | '));
for (const id of recIds) { const v = byId.get(id); console.log(`record tank_id ${id} -> ${v ? `${v.short_name || v.name} (${v.type}, tier ${v.tier})` : 'NOT FOUND'}`); }
const classes = new Map();
for (const files of Object.values(data)) for (const r of files['player_statistics/wot_vehicle_statistics.csv'] ?? []) { const v = byTag.get(r.VEHICLE_NAME); if (v) classes.set(v.type, (classes.get(v.type) ?? 0) + (num(r.BATTLES_COUNT) ?? 0)); }
console.log('battles by class:', JSON.stringify([...classes.entries()].sort((x, y) => y[1] - x[1])));
