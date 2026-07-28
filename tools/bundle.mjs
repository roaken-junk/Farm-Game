// Bundles the game into a single self-contained HTML file.
//
// The game normally ships as plain ES modules loaded over HTTP, which is the
// nicest thing to develop against. Some hosts only accept one file, so this
// flattens the module graph into a tiny synchronous registry — no import maps,
// no network, no build tooling beyond node.
//
//   node tools/bundle.mjs [outfile]

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = process.argv[2] || join(ROOT, 'dist', 'sakura-smash.html');

/* --------------------------- collect the modules -------------------------- */

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const files = walk(SRC);
const idOf = (abs) => relative(SRC, abs).split('\\').join('/');

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g;

const modules = new Map();
for (const abs of files) {
  const id = idOf(abs);
  const code = readFileSync(abs, 'utf8');
  const deps = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    deps.push(idOf(resolve(dirname(abs), m[2])));
  }
  modules.set(id, { id, abs, code, deps });
}

/* ------------------------------- topo sort -------------------------------- */

const order = [];
const state = new Map(); // 0 = visiting, 1 = done

function visit(id, trail = []) {
  if (state.get(id) === 1) return;
  if (state.get(id) === 0) {
    throw new Error(`circular import: ${[...trail, id].join(' -> ')}`);
  }
  const mod = modules.get(id);
  if (!mod) throw new Error(`unresolved import: ${id} (from ${trail[trail.length - 1] || 'entry'})`);
  state.set(id, 0);
  for (const d of mod.deps) visit(d, [...trail, id]);
  state.set(id, 1);
  order.push(id);
}
for (const id of modules.keys()) visit(id);

/* ------------------------------- transform -------------------------------- */

function transform(mod) {
  let code = mod.code;
  const exported = new Set();

  // A single-file build has no sibling sw.js to register, and nothing to
  // precache — it is already one document.
  if (mod.id === 'main.js') {
    code = code.replace(
      /if \('serviceWorker' in navigator\) \{[\s\S]*?\n\}\n/,
      '// (service worker omitted from the single-file build)\n'
    );
  }

  code = code.replace(IMPORT_RE, (_all, names, spec) => {
    const dep = idOf(resolve(dirname(mod.abs), spec));
    const clean = names.replace(/\s+/g, ' ').trim().replace(/,\s*$/, '');
    return `const { ${clean} } = __req(${JSON.stringify(dep)});`;
  });

  // export { a, b };
  code = code.replace(/^export\s*\{([^}]*)\}\s*;?\s*$/gm, (_all, names) => {
    for (const n of names.split(',')) {
      const t = n.trim();
      if (t) exported.add(t);
    }
    return '';
  });

  // export const/let/var X
  code = code.replace(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (_all, kind, name) => {
    exported.add(name);
    return `${kind} ${name}`;
  });

  // export function X / export function* X / export class X
  code = code.replace(/^export\s+(function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/gm, (_all, kind, name) => {
    exported.add(name);
    return `${kind} ${name}`;
  });

  if (/^export\s/m.test(code)) {
    throw new Error(`${mod.id}: unhandled export form near "${code.match(/^export.*/m)[0]}"`);
  }

  const list = [...exported].join(', ');
  return `__def(${JSON.stringify(mod.id)}, function (__x, __req) {\n${code}\n;Object.assign(__x, { ${list} });\n});`;
}

const bundled = order.map((id) => transform(modules.get(id))).join('\n\n');

/* --------------------------------- emit ----------------------------------- */

const css = readFileSync(join(ROOT, 'css', 'style.css'), 'utf8');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .trim();

const runtime = `
// Minimal synchronous module registry standing in for the ES module loader.
const __mods = {};
const __def = (id, fn) => { __mods[id] = { fn, exports: null }; };
const __req = (id) => {
  const m = __mods[id];
  if (!m) throw new Error('missing module ' + id);
  if (!m.exports) { m.exports = {}; m.fn(m.exports, __req); }
  return m.exports;
};
`;

const out = `<title>Sakura Smash 桜スマッシュ</title>
<style>
${css}
</style>

${body}

<script type="module">
${runtime}
${bundled}
__req('main.js');
</script>
`;

writeFileSync(OUT, out);
console.log(`bundled ${modules.size} modules -> ${relative(ROOT, OUT)} (${(out.length / 1024).toFixed(0)} KB)`);
console.log('order:', order.join(', '));
