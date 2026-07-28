// Verifies every imported name actually exists in the module it comes from.
// A missing export is a runtime-fatal error that only shows up when the page
// loads, so it is worth catching from the command line.
//
//   node tools/check-imports.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g;

function exportsOf(code) {
  const out = new Set();
  for (const m of code.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]);
  for (const m of code.matchAll(/^export\s+(?:function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]);
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const n of m[1].split(',')) { const t = n.trim(); if (t) out.add(t); }
  }
  return out;
}

const files = walk(SRC);
const cache = new Map();
const problems = [];

for (const abs of files) {
  const code = readFileSync(abs, 'utf8');
  for (const m of code.matchAll(IMPORT_RE)) {
    const target = resolve(dirname(abs), m[2]);
    if (!cache.has(target)) {
      try { cache.set(target, exportsOf(readFileSync(target, 'utf8'))); }
      catch { problems.push(`${relative(ROOT, abs)}: cannot resolve '${m[2]}'`); continue; }
    }
    const available = cache.get(target);
    for (const raw of m[1].split(',')) {
      const name = raw.trim();
      if (!name) continue;
      if (!available.has(name)) {
        problems.push(`${relative(ROOT, abs)}: '${name}' is not exported by ${m[2]}`);
      }
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} bad import(s):`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`checked ${files.length} modules — every import resolves`);
