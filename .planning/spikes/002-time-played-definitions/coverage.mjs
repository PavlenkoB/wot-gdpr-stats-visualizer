import { readExport, wallSeconds, num } from '../_lib/export-reader.mjs';
const iso = (s) => new Date(s * 1000).toISOString().slice(0, 10);
for (const [acc, files] of Object.entries(readExport(process.argv[2]))) {
  const s = files['activity_history/wot_game_sessions.csv'];
  const a = files['player_statistics/wot_account_statistics.csv']?.[0];
  if (!s?.length) continue;
  const st = s.map((r) => wallSeconds(r.STARTED_AT)).filter((x) => x !== null).sort((x, y) => x - y);
  console.log(`${acc.slice(0, 3)}… sessions ${iso(st[0])}..${iso(st.at(-1))} account created ${a?.CREATED_AT?.slice(0, 10)} last battle ${a?.LAST_BATTLE_TIME?.slice(0, 10)}`);
}
