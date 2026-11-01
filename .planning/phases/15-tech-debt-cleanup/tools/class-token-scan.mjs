#!/usr/bin/env node
// Class-token scanner (phase 15, plan 15-05).
//
//   node class-token-scan.mjs <token> [paths...]   default paths: src tests
//   node class-token-scan.mjs --selftest
//
// Reports `file:line kind` for every use of <token> AS A CSS CLASS, and exits 1 when there is any:
//   markup-class      a whitespace-separated token in a static class="..." (.svelte)
//   class-directive   class:<token> (.svelte)
//   class-expr        a string literal, or an object key, inside class={...} or inside a {...} of a class="..." (.svelte)
//   css-selector      `.token` in a <style> block or a .css file
//   test-selector     `.token` inside a string, template or regex literal of a .ts/.mjs/.js file
//   test-class-frag   token inside a class="..." fragment of such a string
// It does NOT report <token> elements, locator('token'), identifiers, `t-token`, `--fs-token`, test ids such as
// `combined-token`, anything in a comment, or anything in a <script> block of a .svelte file.
// Node built-ins only. Outputs nothing to disk.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);
const EXTS = new Set(['.svelte', '.css', '.ts', '.mts', '.cts', '.mjs', '.js']);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mask = (s) => s.replace(/[^\n]/g, ' ');
const lineAt = (text, offset) => {
  let n = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};

/** Blank every match of `re` (keeping newlines, so offsets and line numbers stay valid). */
function maskMatches(text, re) {
  return text.replace(re, (m) => mask(m));
}

/**
 * A small JS/TS lexer: blanks comments in place and lists the string, template and regex literals.
 * `strings` entries are { start, value } where value is the raw source between the delimiters
 * (a template keeps its `${}` parts in the value).
 */
function lexJs(src) {
  const out = src.split('');
  const strings = [];
  const n = src.length;
  const tpl = []; // open templates: { start, inExpr, depth }
  let i = 0;
  let lastSig = '';

  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  const regexAllowed = () => {
    if (lastSig === '' || '(,=:[!&|?{};+-*%<>~^'.includes(lastSig)) return true;
    if (/[\w$]/.test(lastSig)) {
      const before = src.slice(0, i).trimEnd();
      return /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new|else|do)$/.test(before);
    }
    return false;
  };
  const continueTemplate = () => {
    const t = tpl[tpl.length - 1];
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '`') {
        strings.push({ start: t.start + 1, value: src.slice(t.start + 1, i) });
        tpl.pop();
        i++;
        lastSig = 'a';
        return;
      }
      if (c === '$' && src[i + 1] === '{') {
        t.inExpr = true;
        t.depth = 0;
        i += 2;
        lastSig = '{';
        return;
      }
      i++;
    }
    tpl.pop();
  };

  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i + 1;
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
      strings.push({ start, value: src.slice(start, i) });
      i++;
      lastSig = 'a';
      continue;
    }
    if (c === '`') {
      tpl.push({ start: i, inExpr: false, depth: 0 });
      i++;
      continueTemplate();
      continue;
    }
    if (c === '/' && regexAllowed()) {
      const start = i + 1;
      i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) break;
        i++;
      }
      strings.push({ start, value: src.slice(start, i) });
      i++;
      while (i < n && /[a-z]/i.test(src[i])) i++;
      lastSig = 'a';
      continue;
    }
    const top = tpl[tpl.length - 1];
    if (c === '{' && top && top.inExpr) top.depth++;
    if (c === '}' && top && top.inExpr) {
      if (top.depth === 0) {
        top.inExpr = false;
        i++;
        continueTemplate();
        continue;
      }
      top.depth--;
    }
    if (!/\s/.test(c)) lastSig = c;
    i++;
  }
  return { code: out.join(''), strings };
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const k = `${f.line}:${f.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function scanStringsForTs(text, strings, selRe, classFragRe, token) {
  const found = [];
  for (const s of strings) {
    let m;
    const sel = new RegExp(selRe.source, 'g');
    while ((m = sel.exec(s.value))) {
      found.push({ line: lineAt(text, s.start + m.index), kind: 'test-selector' });
    }
    const frag = new RegExp(classFragRe.source, 'g');
    while ((m = frag.exec(s.value))) {
      const words = m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/);
      if (words.includes(token)) {
        found.push({ line: lineAt(text, s.start + m.index), kind: 'test-class-frag' });
      }
    }
  }
  return found;
}

/** The `{...}` span starting at text[open] === '{' (string aware). Returns the end index (exclusive). */
function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < text.length && text[i] !== c) i += text[i] === '\\' ? 2 : 1;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

function exprFindings(text, exprStart, expr, token, keyRe) {
  const found = [];
  const { strings } = lexJs(expr);
  for (const s of strings) {
    if (s.value.split(/\s+/).includes(token)) {
      found.push({ line: lineAt(text, exprStart + s.start), kind: 'class-expr' });
    }
  }
  let m;
  const k = new RegExp(keyRe.source, 'g');
  while ((m = k.exec(expr))) {
    found.push({ line: lineAt(text, exprStart + m.index), kind: 'class-expr' });
  }
  return found;
}

function scanSvelte(text, token) {
  const t = escapeRe(token);
  const selRe = new RegExp(`\\.${t}(?![\\w-])`, 'g');
  const found = [];

  const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/g;
  const styleRe = /<style\b[^>]*>[\s\S]*?<\/style>/g;

  // CSS: only the <style> blocks, comments removed.
  let styleView = mask(text);
  const styleChars = styleView.split('');
  for (const m of text.matchAll(styleRe)) {
    for (let k = 0; k < m[0].length; k++) styleChars[m.index + k] = text[m.index + k];
  }
  styleView = maskMatches(styleChars.join(''), /\/\*[\s\S]*?\*\//g);
  for (const m of styleView.matchAll(selRe)) {
    found.push({ line: lineAt(text, m.index), kind: 'css-selector' });
  }

  // Markup: no script, no style, no comments.
  let markup = maskMatches(text, scriptRe);
  markup = maskMatches(markup, styleRe);
  markup = maskMatches(markup, /<!--[\s\S]*?-->/g);

  const keyRe = new RegExp(`(?:^|[{,\\s])${t}\\s*:`);
  // class="..." and class='...'
  for (const m of markup.matchAll(/\bclass\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1/g)) {
    const value = m[2];
    const valueStart = m.index + m[0].indexOf(value, m[0].indexOf('=') + 1);
    const staticPart = value.replace(/\{[^}]*\}/g, ' ');
    if (staticPart.split(/\s+/).includes(token)) {
      found.push({ line: lineAt(text, valueStart), kind: 'markup-class' });
    }
    for (const b of value.matchAll(/\{[^}]*\}/g)) {
      found.push(...exprFindings(text, valueStart + b.index, b[0], token, keyRe));
    }
  }
  // class={...}
  for (const m of markup.matchAll(/\bclass\s*=\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const end = matchBrace(markup, open);
    found.push(...exprFindings(text, open, markup.slice(open, end), token, keyRe));
  }
  // class:token
  const dirRe = new RegExp(`\\bclass:${t}(?![\\w-])`, 'g');
  for (const m of markup.matchAll(dirRe)) {
    found.push({ line: lineAt(text, m.index), kind: 'class-directive' });
  }
  return found;
}

function scanCss(text, token) {
  const t = escapeRe(token);
  const view = maskMatches(text, /\/\*[\s\S]*?\*\//g);
  const found = [];
  for (const m of view.matchAll(new RegExp(`\\.${t}(?![\\w-])`, 'g'))) {
    found.push({ line: lineAt(text, m.index), kind: 'css-selector' });
  }
  return found;
}

function scanTs(text, token) {
  const t = escapeRe(token);
  const { strings } = lexJs(text);
  const selRe = new RegExp(`\\.${t}(?![\\w-])`);
  const classFragRe = /class\s*=\s*\\?["']([^"'\\]*)/;
  return scanStringsForTs(text, strings, selRe, classFragRe, token);
}

export function scanText(name, text, token) {
  let found;
  if (name.endsWith('.svelte')) found = scanSvelte(text, token);
  else if (name.endsWith('.css')) found = scanCss(text, token);
  else found = scanTs(text, token);
  return dedupe(found).sort((a, b) => a.line - b.line || a.kind.localeCompare(b.kind));
}

function walk(path, files) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (SKIP_DIRS.has(name)) continue;
      walk(join(path, name), files);
    }
  } else if (EXTS.has(path.slice(path.lastIndexOf('.')))) {
    files.push(path);
  }
}

// ---------------------------------------------------------------------------------------------
// Self-test: one positive of each kind and one of each exclusion, over in-memory samples.
// Each sample line is [text, expectedKind | null].

function checkSample(name, lines, token) {
  const text = lines.map((l) => l[0]).join('\n');
  const expected = [];
  lines.forEach((l, i) => {
    if (l[1]) for (const kind of [].concat(l[1])) expected.push(`${i + 1}:${kind}`);
  });
  const actual = scanText(name, text, token).map((f) => `${f.line}:${f.kind}`);
  const same = JSON.stringify([...expected].sort()) === JSON.stringify([...actual].sort());
  if (!same) {
    console.error(`selftest FAILED for ${name}`);
    console.error(`  expected: ${expected.join(' ') || '(none)'}`);
    console.error(`  actual:   ${actual.join(' ') || '(none)'}`);
  }
  return same;
}

function selftest() {
  const svelte = [
    ['<script>', null],
    ["  const variant = 'caption'; // a script literal is not a class use", null],
    ['  const tbl = { caption: "caption" };', null],
    ['</script>', null],
    ['<!-- <p class="caption">commented out</p> -->', null],
    ['<p class="caption">A</p>', 'markup-class'],
    ['<p class="x caption y">B</p>', 'markup-class'],
    ["<p class=\"x {on ? 'caption' : ''}\">C</p>", 'class-expr'],
    ['<p class:caption={on}>D</p>', 'class-directive'],
    ["<p class={['a', 'caption']}>E</p>", 'class-expr'],
    ['<p class={{ caption: on }}>F</p>', 'class-expr'],
    ['<caption class="visually-hidden">G</caption>', null],
    ['<p class="t-caption caption-x combined-caption">H</p>', null],
    ['<p data-testid="section-caption">I {combinedCaption}</p>', null],
    ['<p class={variant}>J</p>', null],
    ['<p class="identity-caption">K</p>', null],
    ['<style>', null],
    ['  .caption { margin: 0 }', 'css-selector'],
    ['  p.caption.title { margin: 0 }', 'css-selector'],
    ['  .t-caption { margin: 0 }', null],
    ['  caption { margin: 0 }', null],
    ['  .hint { font-size: var(--fs-caption) }', null],
    ['  /* .caption in a comment */', null],
    ['</style>', null],
  ];
  const ts = [
    ['// .caption in a comment', null],
    ['/* class="caption" in a comment */', null],
    ["const a = 'p.caption.title';", 'test-selector'],
    ["const b = '.caption';", 'test-selector'],
    ['const c = \'<p class="caption under-title">x</p>\';', 'test-class-frag'],
    ['const d = `.caption { margin: 0; }`;', 'test-selector'],
    ['const r = /\\.caption\\b/;', 'test-selector'],
    ["page.locator('caption');", null],
    ["const f = 'combined-caption';", null],
    ["const g = '.t-caption';", null],
    ["const h = '--fs-caption';", null],
    ["const SPEND_CAPTION = 'x'; const combinedCaption = 1;", null],
    ["const u = 'http://x/.caption-y';", null],
    ['const q = `${a} ${"p"} ok`; const z = \'.caption\';', 'test-selector'],
  ];
  const css = [
    ['.caption {', 'css-selector'],
    ['  margin: 0;', null],
    ['}', null],
    ['/* .caption { } */', null],
    ['.t-caption { margin: 0; }', null],
  ];
  const results = [
    checkSample('sample.svelte', svelte, 'caption'),
    checkSample('sample.ts', ts, 'caption'),
    checkSample('sample.css', css, 'caption'),
  ];
  if (results.every(Boolean)) {
    console.log('selftest OK: every positive reported, every exclusion silent');
    return 0;
  }
  return 1;
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  const [token, ...paths] = argv.filter((a) => !a.startsWith('--'));
  if (!token) {
    console.error('usage: class-token-scan.mjs <token> [paths...] | --selftest');
    return 2;
  }
  const files = [];
  for (const p of paths.length ? paths : ['src', 'tests']) walk(p, files);
  files.sort();
  const perKind = new Map();
  const perFile = new Map();
  let total = 0;
  for (const f of files) {
    const hits = scanText(f, readFileSync(f, 'utf8'), token);
    for (const h of hits) {
      console.log(`${f}:${h.line} ${h.kind}`);
      perKind.set(h.kind, (perKind.get(h.kind) ?? 0) + 1);
      perFile.set(f, (perFile.get(f) ?? 0) + 1);
      total++;
    }
  }
  console.log(`\n${total} class use(s) of "${token}" in ${perFile.size} file(s), ${files.length} file(s) scanned`);
  for (const [k, v] of [...perKind].sort()) console.log(`  kind ${k}: ${v}`);
  for (const [f, v] of [...perFile].sort()) console.log(`  file ${f}: ${v}`);
  return total ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
