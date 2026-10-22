// Tile model shared by sketch 025: one array of insights built from window.WG (see gen-data.mjs).
// ---- Pure grid-fill helpers (no DOM, no WG): unit-testable in node via `require`. ----
// A tile is hero (2 cols x 2 rows = 4 cells), feat (2 x 1 = 2 cells) or met (1 x 1). Numbers 4 / 2 / 1 mean the same.
// gridHoles(dims, C): simulates CSS `grid-auto-flow: dense` for C columns (first free slot for each item, in order) and
// counts the empty cells inside the used rows. dims = [[colSpan, rowSpan], ...].
function gridHoles(dims, C) {
  const occ = []; let rows = 0, last = -1, reorder = false;
  const free = (r, c, w, h) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (occ[y] && occ[y][x]) return false; return true; };
  for (const [w0, h] of dims) {
    const w = Math.min(w0, C); let done = false;
    for (let r = 0; !done; r++) for (let c = 0; c + w <= C && !done; c++) if (free(r, c, w, h)) {
      for (let y = r; y < r + h; y++) { occ[y] = occ[y] || []; for (let x = c; x < c + w; x++) occ[y][x] = 1; }
      if (r * C + c < last) reorder = true; last = r * C + c; // dense placement put this tile BEFORE an earlier one: visual order would differ from DOM order
      rows = Math.max(rows, r + h); done = true;
    }
  }
  let holes = 0; for (let y = 0; y < rows; y++) for (let x = 0; x < C; x++) if (!(occ[y] && occ[y][x])) holes++;
  return { rows, holes, reorder };
}
// fillSpans(tiles): tiles = ordered visible tiles of ONE group (sizes 'hero'|'feat'|'met' or 4|2|1, or objects with .size).
// Returns { c4, r4, c2 }: per-tile EXTRA column span for the 4-column layout (c4), EXTRA row span (r4, always 0 now) and EXTRA column
// span for the 2-column layout (c2). RULE (decided 2026-10-22): ONLY FEATURE tiles ever widen. Heroes stay 2x2 and metrics stay 1x1, so a
// single metric never stretches across a row. Among the feature widths 2..C it picks the combination with the fewest empty cells, then the
// least widening. Holes that no feature can fill (e.g. three lone metrics in 4 columns) are accepted. The 1-column layout never has holes.
function fillSpans(tiles) {
  const NAME = { 4: 'hero', 2: 'feat', 1: 'met' }, BASE = { hero: [2, 2], feat: [2, 1], met: [1, 1] };
  const sizes = tiles.map((t) => { const s = t && t.size !== undefined ? t.size : t; return NAME[s] || s; });
  const out = { c4: sizes.map(() => 0), r4: sizes.map(() => 0), c2: sizes.map(() => 0) };
  const solve = (C, key) => {
    const base = sizes.map((s) => BASE[s].slice());
    const feats = []; sizes.forEach((s, i) => { if (s === 'feat') feats.push(i); });
    const g0 = gridHoles(base, C);
    let best = { holes: g0.reorder ? Infinity : g0.holes, extra: 0, mods: [] };
    const rec = (k, mods, extra) => {
      if (k === feats.length) {
        const d = base.map((x) => x.slice()); for (const [i, e] of mods) d[i][0] += e;
        const g = gridHoles(d, C); if (g.reorder) return;
        const h = g.holes;
        if (h < best.holes || (h === best.holes && extra < best.extra)) best = { holes: h, extra, mods: mods.slice() };
        return;
      }
      for (let e = 0; BASE.feat[0] + e <= C; e++) rec(k + 1, e ? mods.concat([[feats[k], e]]) : mods, extra + e);
    };
    rec(0, [], 0);
    for (const [i, e] of best.mods) out[key][i] = e;
  };
  solve(4, 'c4'); solve(2, 'c2');
  return out;
}
if (typeof module !== 'undefined') module.exports = { fillSpans, gridHoles };
const M = typeof WG === 'undefined' ? null : (function () {
  const W = WG, T = W.time, K = W.tanks, R = W.records, TT = W.totals;
  const top = K.top[0], cls0 = K.classes[0], yrs = Object.keys(T.years), yv = Object.values(T.years);
  const fmtDate = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const peakH = T.hourHist.indexOf(Math.max(...T.hourHist));
  const recTank = (r) => (r.tank ? `on ${r.tank.name} (${CLASS[r.tank.type].toLowerCase()}, tier ${r.tank.tier})` : 'on a tank no longer in the game list');
  const money = (v, small) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)}` : `${Math.round(v / 1e6)}`) + (small ? ` <small>${v >= 1e9 ? 'billion' : 'million'}</small>` : v >= 1e9 ? ' billion' : ' million');
  const items = [
    { id: 'logged', g: 'Time', size: 'hero', k: 'Logged in', v: `${T.loggedDays} <small>days</small>`, t: `${T.loggedDays} days`, rule: `${n(T.loggedHours)} h (24-hour days) since ${fmtDate(T.first)} · ${T.battleDays} days in battle`, def: 'Union of WoT session intervals over all account folders, in 24-hour days. Sessions can include idle hangar time; "in battle" is a separate lifetime figure.', src: 'Activity_History / WOT_Game_Sessions', tab: 'Playtime', viz: 'years' },
    { id: 'hour', g: 'Time', size: 'feat', k: 'Signature hour', v: `${String(peakH).padStart(2, '0')}:00`, t: `${String(peakH).padStart(2, '0')}:00`, rule: 'logged hours by hour of day, wall clock as recorded', def: 'The hour of day with the most logged hours across all years. No timezone: times are as the game wrote them.', src: 'WOT_Game_Sessions', tab: 'Playtime', viz: 'hours' },
    { id: 'streak', g: 'Time', size: 'met', k: 'Longest streak', v: `${T.streak.days} <small>days</small>`, t: `${T.streak.days} days`, rule: `${fmtDate(T.streak.start)} to ${fmtDate(T.streak.end)}`, def: 'Most consecutive calendar days with at least one session. Wall clock as recorded, no timezone.', src: 'WOT_Game_Sessions', tab: 'Playtime' },
    { id: 'sess', g: 'Time', size: 'met', k: 'Longest session', v: `${T.longestSession.hours} <small>h</small>`, t: `${T.longestSession.hours} h`, rule: fmtDate(T.longestSession.date), def: 'One login to logout. Disconnects or idle time can inflate it.', src: 'WOT_Game_Sessions', tab: 'Playtime' },
    { id: 'busy', g: 'Time', size: 'met', k: 'Busiest day', v: `${T.busiest.hours} <small>h</small>`, t: `${T.busiest.hours} h`, rule: fmtDate(T.busiest.date), def: 'Most logged hours on one calendar day, by session start.', src: 'WOT_Game_Sessions', tab: 'Playtime' },
    { id: 'tank', g: 'Tanks', size: 'hero', k: 'Most-played tank', v: `${top.name} <small>${CLASS[top.type].toLowerCase()} · T${top.tier} · ${NATION[top.nation]}</small>`, t: top.name, rule: `${n(top.battles)} battles · ${pct(top.battles, K.total)} of all · ${f1(top.hours)} h in battle · ${pct(top.wins, top.battles)} wins`, def: 'Most battles in the lifetime vehicle statistics. Class, tier and nation come from the build-time tank table; win rate is shown only for 100+ battles.', src: 'WOT_Vehicle_Statistics + tank table', tab: 'Vehicles', viz: 'top5' },
    { id: 'cls', g: 'Tanks', size: 'feat', k: 'Favourite class', v: CLASS[cls0[0]], t: CLASS[cls0[0]], rule: `${pct(cls0[1], K.total)} of battles`, def: 'Battles grouped by class via the tank table. Retired tanks are left out and counted as unknown.', src: 'WOT_Vehicle_Statistics + tank table', tab: 'Vehicles', viz: 'stack' },
    { id: 'fleet', g: 'Tanks', size: 'met', k: 'Tanks played', v: K.count, t: `${K.count} tanks`, rule: 'different tanks', def: 'Tanks with a row in the lifetime vehicle statistics.', src: 'WOT_Vehicle_Statistics', tab: 'Vehicles' },
    { id: 'nat', g: 'Tanks', size: 'met', k: 'Favourite nation', short: 'Top nation', v: NATION[K.nations[0][0]], t: NATION[K.nations[0][0]], rule: `${pct(K.nations[0][1], K.total, 0)} of battles`, def: 'Nation from the vehicle id prefix (reliable), summed over battles.', src: 'WOT_Vehicle_Statistics', tab: 'Vehicles' },
    { id: 'dmg', g: 'Records', size: 'met', k: 'Most damage, one battle', short: 'Top damage', v: n(R.damage.v), t: n(R.damage.v), rule: recTank(R.damage), def: 'Personal best in a single battle.', src: 'WOT_Account_Statistics', tab: 'Vehicles' },
    { id: 'xp', g: 'Records', size: 'met', k: 'Most XP, one battle', short: 'Top XP', v: n(R.xp.v), t: n(R.xp.v), rule: recTank(R.xp), def: 'Personal best in a single battle.', src: 'WOT_Account_Statistics', tab: 'Vehicles' },
    { id: 'kills', g: 'Records', size: 'met', k: 'Most kills, one battle', short: 'Top kills', v: R.frags.v, t: R.frags.v, rule: recTank(R.frags), def: 'Personal best in a single battle.', src: 'WOT_Account_Statistics', tab: 'Vehicles' },
    { id: 'snip', g: 'Records', size: 'met', k: 'Sniper series', v: R.sniperSeries, t: R.sniperSeries, rule: 'longest run recorded', def: 'Longest run recorded in the export. Series definitions differ by mode, so this is not a medal.', src: 'WOT_Account_Statistics', tab: 'Vehicles' },
    { id: 'cred', g: 'Totals', size: 'feat', k: 'Credits earned', v: money(W.economy.creditsEarned, true), t: money(W.economy.creditsEarned, false), rule: 'recorded currency operations only', def: 'Sum of credit deposits in the currency operations log. The log may be incomplete for old years.', src: 'Financial_Data / Virtual_Currencies_Operations', tab: 'Finance' },
    { id: 'bat', g: 'Totals', size: 'met', k: 'Battles', v: n(TT.battles), t: n(TT.battles), rule: `${pct(TT.wins, TT.battles)} wins`, def: 'Lifetime battles and wins from the account statistics. Win rate depends on teammates.', src: 'WOT_Account_Statistics', tab: 'Vehicles' },
    { id: 'ord', g: 'Totals', size: 'met', k: 'Orders', v: W.economy.orders, t: W.economy.orders, rule: 'count only', def: 'Number of payment orders. Amounts are hidden by default because they are sensitive.', src: 'Payment_History / Orders', tab: 'Payments' },
  ];
  const groups = [...new Set(items.map((i) => i.g))];
  const labelsH = T.hourHist.map((_, i) => String(i).padStart(2, '0') + ':00');
  const peakYear = yrs[yv.indexOf(Math.max(...yv))], peakHour = peakH;
  const share = (c) => c[1] / Math.max(...K.classes.filter((x) => x[0] !== 'unknown').map((x) => x[1]));
  const classes = K.classes.filter((c) => c[0] !== 'unknown');
  const sr = (s) => `<span class="sr">${s}</span>`;
  function vizHtml(type) {
    if (type === 'years') return `<span class="chartwrap" aria-hidden="true"><span class="peaklbl" data-peak="years"></span><span class="cols" data-cols="years"></span></span><span class="axis" aria-hidden="true"><span>${yrs[0]}</span><span></span><span>${yrs.at(-1)}</span></span>${sr(`Chart: logged hours per year, ${yrs.length} years, peak ${peakYear} with ${n(Math.max(...yv))} hours.`)}`;
    if (type === 'hours') return `<span class="chartwrap" aria-hidden="true"><span class="peaklbl" data-peak="hours"></span><span class="cols" data-cols="hours" style="height:56px"></span></span><span class="axis" aria-hidden="true"><span>00:00</span><span>12:00</span><span>23:00</span></span>${sr(`Chart: logged hours by hour of day, peak at ${String(peakHour).padStart(2, '0')}:00.`)}`;
    if (type === 'stack') return `<span class="stack blk" aria-hidden="true" style="margin-top:10px">${classes.map((c) => `<i title="${CLASS[c[0]]} ${pct(c[1], K.total)}" style="width:${(c[1] / K.total) * 100}%;background:${hc(share(c))}"></i>`).join('')}</span><span class="cap" aria-hidden="true" style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">${classes.map((c) => `<span><b style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${hc(share(c))};margin-right:4px"></b>${CLASS[c[0]]} ${pct(c[1], K.total, 0)}</span>`).join('')}</span>${sr('Battles by class: ' + classes.map((c) => CLASS[c[0]] + ' ' + pct(c[1], K.total, 0)).join(', ') + '.')}`;
    if (type === 'top5') return `<span class="blk" aria-hidden="true" style="margin-top:10px">${K.top.slice(0, 5).map((t) => `<span class="barrow"><span><b style="color:var(--ink)">${t.name}</b><br><span class="cap">${CLASS[t.type]}</span></span><span class="bar"><i style="width:${(t.battles / top.battles) * 100}%;background:${hc(t.battles / top.battles)}"></i></span><span>${n(t.battles)}</span></span>`).join('')}</span>${sr('Top 5 tanks by battles: ' + K.top.slice(0, 5).map((t) => t.name + ' ' + n(t.battles)).join(', ') + '.')}`;
    return '';
  }
  const peakPos = (arr) => { const i = arr.indexOf(Math.max(...arr)), p = ((i + 0.5) / arr.length) * 100; return p < 12 ? ['0', ''] : p > 88 ? ['', '0'] : [p.toFixed(1) + '%', '']; };
  function hydrate(root) {
    root.querySelectorAll('[data-cols="years"]').forEach((el) => cols(el, yv, yrs));
    root.querySelectorAll('[data-cols="hours"]').forEach((el) => cols(el, T.hourHist, labelsH));
    const place = (el, text, arr) => { el.textContent = text; const [l, r] = peakPos(arr); if (l) { el.style.left = l; if (l !== '0') el.style.transform = 'translateX(-50%)'; } else el.style.right = r; };
    root.querySelectorAll('[data-peak="years"]').forEach((el) => place(el, `${n(Math.max(...yv))} h \u00b7 ${peakYear}`, yv));
    root.querySelectorAll('[data-peak="hours"]').forEach((el) => place(el, `${String(peakHour).padStart(2, '0')}:00`, T.hourHist));
  }
  return { items, groups, fmtDate, vizHtml, hydrate, byId: Object.fromEntries(items.map((i) => [i.id, i])) };
})();
