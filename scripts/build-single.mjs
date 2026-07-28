/* Bundles the game into one self-contained HTML file — no modules, no server.
   Run: node scripts/build-single.mjs

   Outputs:
     dist/sunny-acres.html   complete page; double-click it, host it anywhere
     dist/artifact.html      body-only fragment for hosts that supply <head>

   The source stays as ES modules; this script rewrites each one into an IIFE
   that returns its exports, wired together in dependency order.              */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), 'utf8');

/** Dependency order matters: a module may only import ones listed before it. */
const MODULES = ['util', 'data', 'audio', 'state', 'game', 'map', 'ui', 'main'];
const nsOf = name => `__mod_${name}`;

/* ------------------------- ES module -> IIFE ---------------------------- */

function transform(name) {
  let src = read(`js/${name}.js`);
  const prelude = [];

  // Regions the module marks as irrelevant once inlined (see js/main.js).
  const fenced = /\/\* @strip-in-bundle:start[\s\S]*?@strip-in-bundle:end \*\//g;
  if (name === 'main' && !fenced.test(src)) {
    throw new Error('js/main.js lost its @strip-in-bundle fence');
  }
  src = src.replace(fenced, '');

  // import * as D from './data.js';
  src = src.replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+['"]\.\/(\w+)\.js['"];?[ \t]*$/gm,
    (_, alias, mod) => {
      assertKnown(mod, name);
      prelude.push(`const ${alias} = ${nsOf(mod)};`);
      return '';
    });

  // import { el, fmt } from './util.js';
  src = src.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]\.\/(\w+)\.js['"];?[ \t]*$/gm,
    (_, names, mod) => {
      assertKnown(mod, name);
      prelude.push(`const {${names.trim()}} = ${nsOf(mod)};`);
      return '';
    });

  if (/^\s*import\s/m.test(src)) {
    throw new Error(`js/${name}.js has an import form the bundler doesn't handle`);
  }
  if (/^\s*export\s+(default|\{)/m.test(src)) {
    throw new Error(`js/${name}.js uses an export form the bundler doesn't handle`);
  }

  // Collect exports, then drop the keyword so the declarations stay local.
  const fns = [...src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  const vars = [...src.matchAll(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm)]
    .map(m => ({ kind: m[1], id: m[2] }));

  src = src.replace(/^export\s+/gm, '');

  // `let` exports get a getter: state.js reassigns S, and every other module
  // must see the new value, exactly as ES module live bindings would give it.
  const members = [
    ...fns,
    ...vars.map(v => (v.kind === 'let' || v.kind === 'var' ? `get ${v.id}() { return ${v.id}; }` : v.id)),
  ];

  return [
    `/* ---------- js/${name}.js ---------- */`,
    `const ${nsOf(name)} = (function () {`,
    prelude.join('\n'),
    src.trim(),
    `return { ${members.join(', ')} };`,
    `})();`,
  ].filter(Boolean).join('\n');
}

function assertKnown(mod, from) {
  if (!MODULES.includes(mod)) throw new Error(`js/${from}.js imports unknown module ${mod}`);
  if (MODULES.indexOf(mod) >= MODULES.indexOf(from)) {
    throw new Error(`js/${from}.js imports ${mod}, which is not bundled before it`);
  }
}

/* ------------------------------ assemble -------------------------------- */

const bundle = MODULES.map(transform).join('\n\n');
const css = read('css/style.css');

// Reuse the real markup so the two builds can never drift from index.html.
const html = read('index.html');
const body = html
  .match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1]
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .trim();

// Inlined so the standalone file stays a single self-contained artefact.
const ICON = 'data:image/png;base64,' +
  readFileSync(new URL('icons/icon-192.png', ROOT)).toString('base64');

const TITLE = 'Sunny Acres — Farm Game';
const VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, maximum-scale=1';

const parts = () => `<style>\n${css}\n</style>\n\n${body}\n\n<script>\n${bundle}\n</script>`;

mkdirSync(new URL('dist/', ROOT), { recursive: true });

/* 1. Standalone page — works over http(s) and straight off the disk. */
writeFileSync(new URL('dist/sunny-acres.html', ROOT), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${TITLE}</title>
<meta name="viewport" content="${VIEWPORT}">
<meta name="theme-color" content="#86d3f5">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Sunny Acres">
<link rel="icon" href="${ICON}">
<link rel="apple-touch-icon" href="${ICON}">
</head>
<body>
${parts()}
</body>
</html>
`);

/* 2. Fragment for hosts that wrap content in their own <head>. The viewport
      has to be planted from script there, since we don't control the head. */
writeFileSync(new URL('dist/artifact.html', ROOT), `<title>${TITLE}</title>
<meta name="viewport" content="${VIEWPORT}">

<script>
(function () {
  document.title = ${JSON.stringify(TITLE)};
  var head = document.head || document.documentElement;
  if (!head.querySelector('meta[name="viewport"]')) {
    var m = document.createElement('meta');
    m.name = 'viewport';
    m.content = ${JSON.stringify(VIEWPORT)};
    head.appendChild(m);
  }
})();
</script>

${parts()}
`);

console.log('wrote dist/sunny-acres.html and dist/artifact.html');
