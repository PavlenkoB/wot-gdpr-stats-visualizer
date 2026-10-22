// Spike 002: how many days did the player "spend in game"? Compare definitions per account+game.
import { readExport, wallSeconds, num } from '../_lib/export-reader.mjs';
const zip = process.argv[2];
const data = readExport(zip);
const D = 86400, H = 3600;
const fmt = (s) => `${(s / D).toFixed(1)}d (${Math.round(s / H)}h)`;

function merge(iv) { // union of [a,b] intervals
  iv.sort((x, y) => x[0] - y[0]);
  let total = 0, curA = null, curB = null;
  for (const [a, b] of iv) {
    if (curA === null) { curA = a; curB = b; }
    else if (a <= curB) curB = Math.max(curB, b);
    else { total += curB - curA; curA = a; curB = b; }
  }
  return curA === null ? 0 : total + (curB - curA);
}

const all = { sessions: [], byGame: {} };
const report = [];
for (const [acc, files] of Object.entries(data)) {
  for (const [name, rows] of Object.entries(files)) {
    const m = /activity_history\/(\w+?)_game_sessions\.csv$/.exec(name);
    if (!m || !rows.length) continue;
    const game = m[1].toUpperCase();
    let bad = 0, neg = 0, zero = 0, long = 0, raw = 0, longest = 0;
    const iv = [];
    for (const r of rows) {
      const a = wallSeconds(r.STARTED_AT), b = wallSeconds(r.FINISHED_AT);
      if (a === null || b === null) { bad++; continue; }
      if (b < a) { neg++; continue; }
      if (b === a) zero++;
      const d = b - a;
      if (d > D) long++;
      longest = Math.max(longest, d);
      raw += d; iv.push([a, b]);
    }
    const merged = merge(iv.map((x) => [...x]));
    (all.byGame[game] ??= []).push(...iv);
    report.push({ acc: acc.slice(0, 3) + '…', game, n: rows.length, bad, neg, zero, longOver24h: long, raw: fmt(raw), merged: fmt(merged), longest: fmt(longest) });
  }
}
console.table(report);

// Cross-account/overall union per game (same person, several accounts, overlapping?)
for (const [g, iv] of Object.entries(all.byGame)) {
  const raw = iv.reduce((s, [a, b]) => s + (b - a), 0);
  console.log(`ALL ACCOUNTS ${g}: raw ${fmt(raw)}  merged ${fmt(merge(iv.map((x) => [...x])))}`);
}
const everything = Object.values(all.byGame).flat();
console.log(`ALL GAMES raw ${fmt(everything.reduce((s, [a, b]) => s + (b - a), 0))} merged ${fmt(merge(everything.map((x) => [...x])))}`);

// Battle time (WoT) from account stats and per-vehicle sum
for (const [acc, files] of Object.entries(data)) {
  const a = files['player_statistics/wot_account_statistics.csv']?.[0];
  const v = files['player_statistics/wot_vehicle_statistics.csv'];
  if (!a && !v) continue;
  const accLife = num(a?.BATTLE_LIFE_TIME);
  const vehLife = v ? v.reduce((s, r) => s + (num(r.BATTLE_LIFE_TIME_SEC) ?? 0), 0) : null;
  console.log(`BATTLE TIME ${acc.slice(0, 3)}…: account ${accLife !== null ? fmt(accLife) : 'n/a'}  sum-of-vehicles ${vehLife !== null ? fmt(vehLife) : 'n/a'}  battles ${a?.BATTLES_COUNT ?? 'n/a'}`);
}
