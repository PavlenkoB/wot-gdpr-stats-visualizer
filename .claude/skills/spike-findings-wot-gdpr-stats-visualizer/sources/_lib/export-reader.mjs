// Spike helper: read a real WG export zip into { account -> { "Folder/File.csv" -> rows[] } }.
// Aggregates only leave this process; never print row values that identify the player.
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from '../../../node_modules/fflate/esm/index.mjs';
import Papa from '../../../node_modules/papaparse/papaparse.js';

export const DEFAULT_ZIP = `${process.env.HOME}/Downloads/path/to/export.zip`;

export function readExport(zipPath = DEFAULT_ZIP) {
  const files = unzipSync(new Uint8Array(readFileSync(zipPath)));
  const out = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.toLowerCase().endsWith('.csv')) continue;
    const parts = path.split('/');
    if (parts.length < 3) continue;
    const [account, folder, file] = [parts[0], parts[1], parts[parts.length - 1]];
    const text = strFromU8(bytes).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const delimiter = text.split('\n', 1)[0].includes(';') ? ';' : ',';
    const rows = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter }).data;
    ((out[account] ??= {})[`${folder}/${file}`.toLowerCase()] = rows);
  }
  return out;
}

// Wall-clock seconds since 1970 (no timezone, like the app's civil-date). null if unparseable.
export function wallSeconds(s) {
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) / 1000;
  m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] ?? 0)) / 1000;
  return null;
}

export const num = (v) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
