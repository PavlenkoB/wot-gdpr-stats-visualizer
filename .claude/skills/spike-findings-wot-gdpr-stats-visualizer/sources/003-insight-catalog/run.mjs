// Spike 003: compute every candidate Overview insight from a real export and render a catalog page.
// Output goes to out.local/ (gitignored via *.local): it holds the player's real numbers.
import { mkdirSync, writeFileSync } from 'node:fs';
import { readExport, wallSeconds, num } from '../_lib/export-reader.mjs';

const data = readExport(process.argv[2]);
const D = 86400;
const sum = (rows, k) => rows.reduce((s, r) => s + (num(r[k]) ?? 0), 0);
const get = (file) => Object.values(data).flatMap((f) => f[file] ?? []);
const prettyTank = (id) => { // fallback until spike 001 lookup exists
  const [nation, tag] = id.split(':'); return { nation, name: (tag ?? id).replace(/^[A-Za-z]+\d+_/, '').replace(/_/g, ' ') };
};
const I = []; // insights
const add = (group, title, value, detail, source, status = 'ready') => I.push({ group, title, value, detail, source, status });
const n = (x) => Math.round(x).toLocaleString('en');

// ---- sessions (WoT) ----
const wotSessions = get('activity_history/wot_game_sessions.csv')
  .map((r) => [wallSeconds(r.STARTED_AT), wallSeconds(r.FINISHED_AT)]).filter(([a, b]) => a !== null && b !== null && b >= a);
wotSessions.sort((x, y) => x[0] - y[0]);
let logged = 0, ca = null, cb = null;
for (const [a, b] of wotSessions) { if (ca === null) [ca, cb] = [a, b]; else if (a <= cb) cb = Math.max(cb, b); else { logged += cb - ca; [ca, cb] = [a, b]; } }
if (ca !== null) logged += cb - ca;
const day = new Map(), hour = new Array(24).fill(0), wd = new Array(7).fill(0), years = new Map();
let longest = 0;
for (const [a, b] of wotSessions) {
  const d = Math.floor(a / D); day.set(d, (day.get(d) ?? 0) + (b - a));
  hour[new Date(a * 1000).getUTCHours()] += b - a; wd[new Date(a * 1000).getUTCDay()] += b - a;
  longest = Math.max(longest, b - a);
  const y = new Date(a * 1000).getUTCFullYear(); years.set(y, (years.get(y) ?? 0) + (b - a));
}
const days = [...day.keys()].sort((x, y) => x - y);
let streak = 1, best = 1, bestEnd = days[0];
for (let i = 1; i < days.length; i++) { streak = days[i] - days[i - 1] === 1 ? streak + 1 : 1; if (streak > best) { best = streak; bestEnd = days[i]; } }
const [busyDay, busySec] = [...day.entries()].sort((x, y) => y[1] - x[1])[0];
const dstr = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
const first = wotSessions[0][0], last = wotSessions.at(-1)[0];
const night = (hour.slice(0, 5).reduce((s, x) => s + x, 0) / hour.reduce((s, x) => s + x, 0)) * 100;
const peakH = hour.indexOf(Math.max(...hour));
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

add('Time', 'Days logged in', `${(logged / D).toFixed(0)} days`, `${n(logged / 3600)} h across ${n(wotSessions.length)} sessions, ${dstr(Math.floor(first / D))} to ${dstr(Math.floor(last / D))} (union of session intervals over all account folders; spike 002)`, 'Activity_History/WOT_Game_Sessions.csv');
add('Time', 'Years with the game', `${((last - first) / D / 365.25).toFixed(1)} years`, `first session ${dstr(Math.floor(first / D))}; ${n(days.length)} distinct days played`, 'WOT_Game_Sessions.csv');
add('Time', 'Longest session', `${(longest / 3600).toFixed(1)} h`, 'single login without a break', 'WOT_Game_Sessions.csv');
add('Time', 'Busiest day', `${(busySec / 3600).toFixed(1)} h`, dstr(busyDay), 'WOT_Game_Sessions.csv');
add('Time', 'Longest streak', `${best} days`, `in a row, ending ${dstr(bestEnd)}`, 'WOT_Game_Sessions.csv');
add('Time', 'Peak hour / favourite weekday', `${String(peakH).padStart(2, '0')}:00 / ${WD[wd.indexOf(Math.max(...wd))]}`, `${night.toFixed(0)}% of logged time between 00:00 and 05:00 (wall clock as recorded, no timezone)`, 'WOT_Game_Sessions.csv');
const topYears = [...years.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([y, s]) => `${y}: ${n(s / 3600)} h`).join(' · ');
add('Time', 'Busiest years', topYears, 'logged-in hours per year', 'WOT_Game_Sessions.csv');

// ---- account totals (newest folder carrying WoT stats) ----
const acc = get('player_statistics/wot_account_statistics.csv')[0] ?? {};
const veh = get('player_statistics/wot_vehicle_statistics.csv');
const battles = num(acc.BATTLES_COUNT) ?? sum(veh, 'BATTLES_COUNT');
const wins = num(acc.WINS_COUNT) ?? sum(veh, 'WINS_COUNT');
const inBattle = num(acc.BATTLE_LIFE_TIME) ?? sum(veh, 'BATTLE_LIFE_TIME_SEC');
add('Time', 'Days in battle', `${(inBattle / D).toFixed(0)} days`, `${((inBattle / logged) * 100).toFixed(0)}% of logged-in time (rest: hangar, queue, menus)`, 'Player_Statistics/WOT_Account_Statistics.csv BATTLE_LIFE_TIME');
add('Totals', 'Battles', n(battles), `${((wins / battles) * 100).toFixed(1)}% victories (${n(wins)} wins)`, 'WOT_Account_Statistics.csv');
add('Totals', 'Damage dealt', n(num(acc.DAMAGE_DEALT) ?? sum(veh, 'DAMAGE_DEALT')), `${n((num(acc.DAMAGE_DEALT) ?? 0) / battles)} per battle`, 'DAMAGE_DEALT');
add('Totals', 'Enemies destroyed', n(num(acc.FRAGS_COUNT) ?? sum(veh, 'FRAGS_COUNT')), `${((num(acc.FRAGS_COUNT) ?? 0) / battles).toFixed(2)} per battle`, 'FRAGS_COUNT');
add('Totals', 'Damage blocked by armor', n(num(acc.DAMAGE_BLOCKED_BY_ARMOR) ?? 0), `${n(num(acc.DAMAGE_ASSISTED_RADIO) ?? 0)} assisted by spotting, ${n(num(acc.DAMAGE_ASSISTED_TRACK) ?? 0)} by tracking`, 'DAMAGE_BLOCKED_BY_ARMOR, DAMAGE_ASSISTED_*');
add('Totals', 'Trees cut', n(num(acc.TREES_CUT_COUNT) ?? 0), 'lifetime', 'TREES_CUT_COUNT');
add('Totals', 'Experience earned', n(num(acc.XP_AMOUNT) ?? 0), 'lifetime, plus free XP in the economy section', 'XP_AMOUNT');

// ---- Hall of Fame ----
const rec = (title, valKey, vehKey, unit = '') => {
  const v = num(acc[valKey]); if (v === null) return;
  const t = acc[vehKey] && acc[vehKey] !== '\\N' ? acc[vehKey] : null;
  add('Hall of Fame', title, `${n(v)}${unit}`, t ? `on tank #${t} (numeric Wargaming tank_id, not the nation:tag id)` : 'vehicle not recorded', `${valKey}${t ? ' + ' + vehKey : ''}`, t ? 'value ready; tank name needs lookup by numeric tank_id (001)' : 'ready');
};
rec('Most damage in one battle', 'DAMAGE_MAX', 'MAX_DAMAGE_VEHICLE'); rec('Most XP in one battle', 'XP_MAX', 'MAX_XP_VEHICLE'); rec('Most kills in one battle', 'FRAGS_MAX', 'MAX_FRAGS_VEHICLE');
for (const [t, k] of [['Longest killing series', 'KILLING_SERIES_MAX'], ['Longest sniper series', 'SNIPER_SERIES_MAX'], ['Longest piercing series', 'PIERCING_SERIES_MAX'], ['Longest survival (die-hard) series', 'DIEHARD_SERIES_MAX'], ['Longest invincible series', 'INVINCIBLE_SERIES_MAX']]) {
  const v = num(acc[k]); if (v !== null) add('Hall of Fame', t, n(v), 'consecutive, lifetime record', k);
}

// ---- favourite tanks ----
const vs = veh.map((r) => ({ id: r.VEHICLE_NAME, b: num(r.BATTLES_COUNT) ?? 0, w: num(r.WINS_COUNT) ?? 0, s: num(r.BATTLE_LIFE_TIME_SEC) ?? 0, d: num(r.DAMAGE_DEALT) ?? 0 })).sort((x, y) => y.b - x.b);
const tot = vs.reduce((s, v) => s + v.b, 0);
if (vs.length) {
  const t = vs[0], p = prettyTank(t.id);
  add('Favourites', 'Most-played tank', `${p.name} (${p.nation})`, `${n(t.b)} battles · ${((t.b / tot) * 100).toFixed(1)}% of all battles · ${(t.s / 3600).toFixed(0)} h in battle · ${((t.w / t.b) * 100).toFixed(1)}% wins`, 'WOT_Vehicle_Statistics.csv', 'ready (name from id; nice name needs lookup)');
  add('Favourites', 'Top 5 tanks', vs.slice(0, 5).map((v) => `${prettyTank(v.id).name} ${n(v.b)}`).join(' · '), `top 5 = ${((vs.slice(0, 5).reduce((s, v) => s + v.b, 0) / tot) * 100).toFixed(0)}% of battles`, 'WOT_Vehicle_Statistics.csv');
  const best = vs.filter((v) => v.b >= 100).sort((x, y) => y.w / y.b - x.w / x.b)[0];
  if (best) add('Favourites', 'Best win rate (100+ battles)', `${prettyTank(best.id).name} ${((best.w / best.b) * 100).toFixed(1)}%`, `${n(best.b)} battles`, 'WOT_Vehicle_Statistics.csv');
  const dmg = vs.filter((v) => v.b >= 100).sort((x, y) => y.d / y.b - x.d / x.b)[0];
  if (dmg) add('Favourites', 'Highest average damage (100+ battles)', `${prettyTank(dmg.id).name} ${n(dmg.d / dmg.b)}`, `${n(dmg.b)} battles`, 'WOT_Vehicle_Statistics.csv');
  const nat = new Map(); for (const v of vs) { const k = v.id.split(':')[0]; nat.set(k, (nat.get(k) ?? 0) + v.b); }
  const [[nk, nb]] = [...nat.entries()].sort((x, y) => y[1] - x[1]);
  add('Favourites', 'Favourite nation', nk, `${((nb / tot) * 100).toFixed(0)}% of battles; ${vs.filter((v) => v.id.startsWith(nk + ':')).length} tanks played`, 'vehicle id prefix');
  add('Favourites', 'Garage reach', `${vs.filter((v) => v.b > 0).length} tanks played`, `of ${vs.length} listed; ${vs.filter((v) => v.b >= 1000).length} with 1000+ battles`, 'WOT_Vehicle_Statistics.csv');
  add('Favourites', 'Most-loved class', 'needs lookup', 'class is not in the export; spike 001', '—', 'blocked: lookup (001)');
}

// ---- modes ----
const types = get('player_statistics/wot_battle_types_statistics.csv').map((r) => ({ t: r.TYPE, b: num(r.BATTLES_COUNT) ?? 0, w: num(r.WINS_COUNT) ?? 0 })).sort((x, y) => y.b - x.b);
if (types.length) { const listed = types.reduce((s, t) => s + t.b, 0); add('Modes', 'Special-mode battles', n(listed), `only ${((listed / battles) * 100).toFixed(1)}% of ${n(battles)} battles are broken out into ${types.length} codes; the rest are not itemised, so NO mode-mix percentages. Codes stay unlabeled (rule D-07)`, 'WOT_Battle_Types_Statistics.csv', 'ready (wording must say "of listed modes")'); }

// ---- economy ----
const vc = get('financial_data/virtual_currencies_operations.csv');
const earned = (cur) => vc.filter((r) => r.CURRENCY_CODE === cur && r.TYPE === 'deposit').reduce((s, r) => s + (num(r.AMOUNT) ?? 0), 0);
const spent = (cur) => vc.filter((r) => r.CURRENCY_CODE === cur && r.TYPE === 'withdrawal').reduce((s, r) => s + (num(r.AMOUNT) ?? 0), 0);
if (vc.length) {
  add('Economy', 'Credits earned', n(earned('credits')), `${n(spent('credits'))} spent · ${n(vc.length)} currency operations logged`, 'Virtual_Currencies_Operations.csv');
  add('Economy', 'Gold & free XP', `${n(earned('gold'))} gold · ${n(earned('free_xp'))} free XP`, 'gold earned or bought; amounts as logged', 'Virtual_Currencies_Operations.csv');
}
const orders = get('payment_history/orders.csv');
if (orders.length) add('Economy', 'Orders', `${orders.length} orders`, 'count only by default; amounts opt-in (sensitive)', 'Payment_History/Orders.csv', 'ready (sensitive: hideable)');

// ---- life around the game ----
const chat = get('chat_history/wot_ingame_chat.csv'); if (chat.length) add('Social', 'Messages sent in battle', n(chat.length), 'count only; text is never shown', 'Chat_History/WOT_Ingame_Chat.csv');
const clans = get('clans/wot_clans.csv'); if (clans.length) add('Social', 'Clan history', `${clans.length} entries`, 'joins/leaves/roles; clan names are public but stay hidden by default', 'Clans/WOT_Clans.csv');
const games = {}; for (const f of Object.values(data)) for (const [k, rows] of Object.entries(f)) { const m = /activity_history\/(\w+?)_game_sessions\.csv$/.exec(k); if (m && rows.length) games[m[1].toUpperCase()] = (games[m[1].toUpperCase()] ?? 0) + rows.length; }
add('Wargaming life', 'Games played', Object.entries(games).map(([g, c]) => `${g} ${n(c)}`).join(' · '), 'sessions per game across all account folders', 'Activity_History/*_Game_Sessions.csv');
add('Wargaming life', 'Account folders', `${Object.keys(data).length}`, 'one player, several folders is normal (migrations, other regions)', 'export zip structure');

mkdirSync(new URL('./out.local/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out.local/catalog.json', import.meta.url), JSON.stringify(I, null, 2));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const groups = [...new Set(I.map((i) => i.group))];
const css = `body{font:15px/1.5 system-ui;background:#f6f5f1;color:#1b1b1b;margin:0;padding:24px;max-width:1100px;margin-inline:auto}h1{margin:0 0 4px}p.sub{color:#555;margin:0 0 24px}h2{margin:32px 0 12px;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#555}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.c{background:#fff;border:1px solid #e3e0d8;border-radius:12px;padding:14px 16px}.c .t{font-size:13px;color:#555}.c .v{font-size:24px;font-weight:650;line-height:1.2;margin:4px 0;overflow-wrap:anywhere}.c .d{font-size:13px;color:#333}.c .s{font-size:11px;color:#777;margin-top:8px;font-family:ui-monospace,monospace}.c .st{display:inline-block;font-size:11px;padding:1px 8px;border-radius:99px;background:#e6f3e6;margin-top:6px}.c .st.b{background:#fbe5e3}.c .st.w{background:#fff1d6}`;
const card = (i) => `<div class="c"><div class="t">${esc(i.title)}</div><div class="v">${esc(i.value)}</div><div class="d">${esc(i.detail)}</div><div class="s">${esc(i.source)}</div><span class="st ${i.status.startsWith('blocked') ? 'b' : i.status === 'ready' ? '' : 'w'}">${esc(i.status)}</span></div>`;
writeFileSync(new URL('./out.local/catalog.html', import.meta.url), `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Insight catalog</title><style>${css}</style><h1>Overview insight catalog</h1><p class=sub>Every candidate computed from the real 2026 export. Local file, contains real numbers, gitignored.</p>${groups.map((g) => `<h2>${esc(g)}</h2><div class=g>${I.filter((i) => i.group === g).map(card).join('')}</div>`).join('')}`);
console.log(I.map((i) => `${i.group.padEnd(14)} ${i.title.padEnd(38)} ${i.value}`).join('\n'));
