// Generates _shared/out.local/data.js (window.WG) for sketches 023/024 from a real export + spike 001's tank table.
// out.local/ is gitignored (*.local): it holds day-level play data of a real player.
//   node .planning/sketches/_shared/gen-data.mjs [export.zip]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readExport, wallSeconds, num } from '../../spikes/_lib/export-reader.mjs';

const data = readExport(process.argv[2]);
const D = 86400, iso = (s) => new Date(s * 1000).toISOString().slice(0, 10);
const api = JSON.parse(readFileSync(new URL('../../spikes/001-vehicle-lookup-table/out.local/vehicles.raw.json', import.meta.url), 'utf8'));
const byTag = new Map(api.map((v) => [`${v.nation}:${v.tag}`, v]));
const all = Object.values(data);
const rows = (f) => all.flatMap((x) => x[f] ?? []);

// sessions
const ses = rows('activity_history/wot_game_sessions.csv').map((r) => [wallSeconds(r.STARTED_AT), wallSeconds(r.FINISHED_AT)]).filter(([a, b]) => a !== null && b !== null && b >= a).sort((x, y) => x[0] - y[0]);
const daily = {}, dayTot = new Map(), yearH = {}, hourH = Array(24).fill(0);
for (const [a, b] of ses) {
  const h = (b - a) / 3600, dt = new Date(a * 1000), y = dt.getUTCFullYear();
  const doy = Math.floor((a - Date.UTC(y, 0, 1) / 1000) / D);
  (daily[y] ??= Array(366).fill(0))[doy] += h;
  dayTot.set(Math.floor(a / D), (dayTot.get(Math.floor(a / D)) ?? 0) + h);
  yearH[y] = (yearH[y] ?? 0) + h; hourH[dt.getUTCHours()] += h;
}
for (const y of Object.keys(daily)) daily[y] = daily[y].map((v) => Math.round(v * 10) / 10);
const days = [...dayTot.keys()].sort((x, y) => x - y);
let cur = 1, best = 1, bestEnd = days[0];
for (let i = 1; i < days.length; i++) { cur = days[i] - days[i - 1] === 1 ? cur + 1 : 1; if (cur > best) { best = cur; bestEnd = days[i]; } }
const [busyDay, busyH] = [...dayTot.entries()].sort((x, y) => y[1] - x[1])[0];
const longest = ses.reduce((m, s) => (s[1] - s[0] > m[1] - m[0] ? s : m), ses[0]);

// eras
const era = (y0, y1) => {
  const s = ses.filter(([a]) => { const y = new Date(a * 1000).getUTCFullYear(); return y >= y0 && y <= y1; });
  const len = s.map(([a, b]) => (b - a) / 60).sort((x, y) => x - y);
  const hh = Array(24).fill(0); let wk = 0, ev = 0, tot = 0;
  for (const [a, b] of s) { const d = new Date(a * 1000); hh[d.getUTCHours()] += (b - a) / 3600; const wd = d.getUTCDay(); if (wd === 0 || wd === 6) wk += b - a; if (d.getUTCHours() >= 17) ev += b - a; tot += b - a; }
  const yrs = y1 - y0 + 1;
  return { years: `${y0}-${y1}`, hoursPerYear: Math.round(tot / 3600 / yrs), sessions: s.length, avgSessionMin: Math.round(len.reduce((x, y) => x + y, 0) / len.length), medianSessionMin: Math.round(len[Math.floor(len.length / 2)]), peakHour: hh.indexOf(Math.max(...hh)), eveningShare: Math.round((ev / tot) * 100), weekendShare: Math.round((wk / tot) * 100), hourHist: hh.map(Math.round) };
};

// tanks
const acc = rows('player_statistics/wot_account_statistics.csv')[0] ?? {};
const veh = rows('player_statistics/wot_vehicle_statistics.csv').map((r) => { const v = byTag.get(r.VEHICLE_NAME); return { name: v ? (v.short_name || v.name) : r.VEHICLE_NAME, type: v?.type ?? null, tier: v?.tier ?? null, nation: r.VEHICLE_NAME.split(':')[0], battles: num(r.BATTLES_COUNT) ?? 0, wins: num(r.WINS_COUNT) ?? 0, hours: Math.round((num(r.BATTLE_LIFE_TIME_SEC) ?? 0) / 360) / 10, dmg: num(r.DAMAGE_DEALT) ?? 0 }; }).sort((x, y) => y.battles - x.battles);
const total = veh.reduce((s, v) => s + v.battles, 0);
const sum = (key) => Object.entries(veh.reduce((o, v) => ((o[v[key] ?? 'unknown'] = (o[v[key] ?? 'unknown'] ?? 0) + v.battles), o), {})).sort((x, y) => y[1] - x[1]);
const nameOf = (id) => { const v = api.find((x) => String(x.tank_id) === String(id)); return v ? { name: v.short_name || v.name, type: v.type, tier: v.tier } : null; };

const vc = rows('financial_data/virtual_currencies_operations.csv');
const credits = vc.filter((r) => r.CURRENCY_CODE === 'credits' && r.TYPE === 'deposit').reduce((s, r) => s + (num(r.AMOUNT) ?? 0), 0);

// per-year small multiples, weekday x hour grid, top days, folder timeline
const perYear = {}, weekGrid = Array.from({ length: 7 }, () => Array(24).fill(0));
for (const [a, b] of ses) {
  const dt = new Date(a * 1000), y = dt.getUTCFullYear(), h = (b - a) / 3600, hr = dt.getUTCHours(), wd = dt.getUTCDay();
  const o = (perYear[y] ??= { hours: 0, sessions: 0, evening: 0, weekend: 0, days: new Set() });
  o.hours += h; o.sessions++; if (hr >= 17) o.evening += h; if (wd === 0 || wd === 6) o.weekend += h; o.days.add(Math.floor(a / D));
  weekGrid[wd][hr] += h;
}
for (const y of Object.keys(perYear)) { const o = perYear[y]; perYear[y] = { hours: Math.round(o.hours), sessions: o.sessions, avgMin: Math.round((o.hours * 60) / o.sessions), eveningPct: Math.round((o.evening / o.hours) * 100), weekendPct: Math.round((o.weekend / o.hours) * 100), activeDays: o.days.size }; }
const topDays = [...dayTot.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([d, h]) => ({ date: iso(d * D), hours: Math.round(h * 10) / 10 }));
const folders = Object.values(data).map((f) => (f['activity_history/wot_game_sessions.csv'] ?? []).map((r) => wallSeconds(r.STARTED_AT)).filter((x) => x !== null).sort((x, y) => x - y)).filter((a) => a.length > 5).map((a) => ({ first: iso(a[0]), last: iso(a.at(-1)), sessions: a.length })).sort((x, y) => (x.first < y.first ? -1 : 1));

const WG = {
  perYear, weekGrid: weekGrid.map((r) => r.map((v) => Math.round(v))), topDays, folders,
  generated: 'from the maintainer\'s real 2026 export; local only',
  time: { loggedDays: Math.round(ses.reduce((s, [a, b]) => s + (b - a), 0) / D), loggedHours: Math.round(ses.reduce((s, [a, b]) => s + (b - a), 0) / 3600), battleDays: Math.round((num(acc.BATTLE_LIFE_TIME) ?? 0) / D), first: iso(ses[0][0]), last: iso(ses.at(-1)[0]), sessions: ses.length, activeDays: days.length, years: Object.fromEntries(Object.entries(yearH).map(([k, v]) => [k, Math.round(v)])), hourHist: hourH.map(Math.round), streak: { days: best, end: iso(bestEnd * D), start: iso((bestEnd - best + 1) * D) }, busiest: { date: iso(busyDay * D), hours: Math.round(busyH * 10) / 10 }, longestSession: { date: iso(longest[0]), hours: Math.round(((longest[1] - longest[0]) / 3600) * 10) / 10 } },
  eras: { early: era(2011, 2015), recent: era(2022, 2026) },
  totals: { battles: num(acc.BATTLES_COUNT), wins: num(acc.WINS_COUNT), damage: num(acc.DAMAGE_DEALT), frags: num(acc.FRAGS_COUNT), blocked: num(acc.DAMAGE_BLOCKED_BY_ARMOR), assisted: (num(acc.DAMAGE_ASSISTED_RADIO) ?? 0) + (num(acc.DAMAGE_ASSISTED_TRACK) ?? 0), trees: num(acc.TREES_CUT_COUNT), xp: num(acc.XP_AMOUNT) },
  records: { damage: { v: num(acc.DAMAGE_MAX), tank: nameOf(acc.MAX_DAMAGE_VEHICLE) }, xp: { v: num(acc.XP_MAX), tank: nameOf(acc.MAX_XP_VEHICLE) }, frags: { v: num(acc.FRAGS_MAX), tank: nameOf(acc.MAX_FRAGS_VEHICLE) }, killingSeries: num(acc.KILLING_SERIES_MAX), sniperSeries: num(acc.SNIPER_SERIES_MAX), piercingSeries: num(acc.PIERCING_SERIES_MAX), diehardSeries: num(acc.DIEHARD_SERIES_MAX) },
  tanks: { total, count: veh.length, top: veh.slice(0, 8), classes: sum('type'), nations: sum('nation').slice(0, 6), tiers: sum('tier') },
  economy: { creditsEarned: Math.round(credits), orders: rows('payment_history/orders.csv').length, chat: rows('chat_history/wot_ingame_chat.csv').length },
  daily,
};
mkdirSync(new URL('./out.local/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out.local/data.js', import.meta.url), `window.WG=${JSON.stringify(WG)};`);
console.log('streak', WG.time.streak, 'busiest', WG.time.busiest, 'longest', WG.time.longestSession);
console.log('eras', JSON.stringify({ early: { ...WG.eras.early, hourHist: undefined }, recent: { ...WG.eras.recent, hourHist: undefined } }));
console.log('records', JSON.stringify(WG.records));
console.log('bytes', JSON.stringify(WG).length);
