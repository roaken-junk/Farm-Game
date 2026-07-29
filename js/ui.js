/* ==========================================================================
   ui.js — rendering. Views are rebuilt on any action; per-second changes
   (timers, progress rings) run through lightweight "tickers" so the DOM
   isn't thrown away every frame and scroll position survives.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import { farmMap } from './map.js';
import { el, fmt, fmtTime, fmtSpan, now, clamp, haptic, setHaptics } from './util.js';
import { SFX, setSound, soundOn } from './audio.js';
import * as FX from './fx.js';

const $ = id => document.getElementById(id);

export let view = 'farm';
let tickers = [];
let seedScroll = 0;      // horizontal position of the seed rack, kept across renders

const TABS = [
  { id: 'farm',    icon: '🌾', label: 'Farm' },
  { id: 'animals', icon: '🐔', label: 'Animals' },
  { id: 'craft',   icon: '🏭', label: 'Craft' },
  { id: 'orders',  icon: '📋', label: 'Orders' },
  { id: 'goals',   icon: '🏆', label: 'Goals' },
  { id: 'shop',    icon: '🛒', label: 'Shop' },
];

/** Register a function to run every second while the current view is up. */
function T(fn) { tickers.push(fn); fn(); }

export function setView(v) {
  view = v;
  render();
  $('view').scrollTop = 0;
}

/* ------------------------------ chrome ---------------------------------- */

export function render() {
  tickers = [];
  renderHud();
  renderTabs();
  const host = $('view');
  host.innerHTML = '';
  host.classList.toggle('flush', view === 'farm');
  const builder = { farm: farmView, animals: animalsView, craft: craftView,
                    orders: ordersView, goals: goalsView, shop: shopView }[view];
  host.appendChild(builder());
}

/** Called once a second — never rebuilds, only refreshes. */
export function refresh() {
  for (const fn of tickers) fn();
  renderHudNumbers();
  renderTabBadges();
}

function renderHud() {
  const S = St.S;
  const hud = $('hud');
  hud.innerHTML = '';

  const av = el('button', 'hud-avatar', `${S.avatar}<span class="hud-lvl">LV ${S.level}</span>`);
  av.onclick = () => { haptic(); profileSheet(); };
  hud.appendChild(av);

  const mid = el('div', 'hud-mid');
  mid.appendChild(el('div', 'hud-name', `${S.name} · ${D.titleFor(S.level)}`));
  const bar = el('div', 'xpbar', '<i></i><span></span>');
  mid.appendChild(bar);
  hud.appendChild(mid);

  hud.appendChild(el('div', 'pill', `<em>🪙</em><span id="hud-coins"></span>`));
  hud.appendChild(el('div', 'pill', `<em>💎</em><span id="hud-gems"></span>`));
  hud.appendChild(el('div', 'boostbar', ''));

  renderHudNumbers();
}

function renderHudNumbers() {
  const S = St.S;
  const c = $('hud-coins'), g = $('hud-gems');
  if (c) c.textContent = fmt(S.coins);
  if (g) g.textContent = fmt(S.gems);
  const p = St.levelProgress();
  const fill = document.querySelector('.xpbar > i');
  const txt = document.querySelector('.xpbar > span');
  if (fill) fill.style.width = (p.pct * 100).toFixed(1) + '%';
  if (txt) txt.textContent = `${fmt(p.have)} / ${fmt(p.need)} XP`;
  const lvl = document.querySelector('.hud-lvl');
  if (lvl) lvl.textContent = 'LV ' + S.level;

  const bar = document.querySelector('.boostbar');
  if (bar) {
    const live = St.boostsRunning();
    bar.hidden = !live.length;
    const want = live.map(b => `${b.id}:${Math.ceil(St.boostLeft(b.id))}`).join('|');
    if (bar.dataset.sig !== want) {
      bar.dataset.sig = want;
      bar.innerHTML = live
        .map(b => `<span class="boostchip">${b.icon} ${fmtTime(St.boostLeft(b.id))}</span>`)
        .join('');
    }
  }
}

function renderTabs() {
  const bar = $('tabbar');
  bar.innerHTML = '';
  for (const t of TABS) {
    const b = el('button', 'tab' + (t.id === view ? ' on' : ''), `<em>${t.icon}</em>${t.label}`);
    b.dataset.tab = t.id;
    b.onclick = () => { haptic(); SFX.plant(); setView(t.id); };
    bar.appendChild(b);
  }
  renderTabBadges();
}

/** Little red counters that tell you where taps are waiting. */
function renderTabBadges() {
  const S = St.S;
  const counts = {
    farm: S.plots.filter(p => G.plotState(p) === 'ready').length,
    animals: S.animals.filter(a => G.animalState(a) === 'ready').length,
    craft: Object.values(S.machines).reduce(
      (n, m) => n + (m.owned ? m.queue.filter(G.jobReady).length : 0), 0),
    orders: (S.orders || []).filter(o => o && o.oid && G.canDeliver(o)).length,
    goals: G.goalsReady() + (G.dailyReady() ? 1 : 0) + G.festReady(),
    shop: 0,
  };
  for (const t of TABS) {
    const btn = document.querySelector(`.tab[data-tab="${t.id}"]`);
    if (!btn) continue;
    let b = btn.querySelector('.badge');
    const n = counts[t.id];
    if (n > 0) {
      if (!b) { b = el('span', 'badge'); btn.appendChild(b); }
      b.textContent = n > 99 ? '99+' : n;
    } else if (b) b.remove();
  }
}

/* ------------------------------ shared bits ------------------------------ */

function storageBar(kind) {
  const S = St.S;
  const wrap = el('div', 'storage');
  const isSilo = kind === 'silo';
  wrap.innerHTML = `<span>${isSilo ? '🛖' : '🏠'}</span><span class="bar"><i></i></span><span class="num"></span>`;
  const sell = el('button', 'btn btn-sm btn-gold', 'Sell');
  sell.onclick = () => { haptic(); sellSheet(kind); };
  wrap.appendChild(sell);
  T(() => {
    const used = isSilo ? St.siloUsed() : St.barnUsed();
    const cap = isSilo ? S.siloCap : S.barnCap;
    wrap.querySelector('.bar > i').style.width = clamp(used / cap, 0, 1) * 100 + '%';
    wrap.querySelector('.num').textContent = `${used}/${cap}`;
    wrap.classList.toggle('full', used >= cap);
  });
  return wrap;
}

function panel(titleHtml, ...children) {
  const p = el('div', 'panel');
  if (titleHtml) p.appendChild(el('div', 'panel-head', titleHtml));
  for (const c of children) if (c) p.appendChild(c);
  return p;
}

/**
 * The one row component every tab uses: icon tile, title, subtitle, optional
 * meta chips, optional trailing control. Keeping this single definition is
 * what makes the tabs look like the same app.
 */
function row({ icon, title, sub, chips, trail, locked, onIcon, tone }) {
  const r = el('div', 'row' + (locked ? ' locked' : '') + (tone ? ' tone-' + tone : ''));
  const ic = el(onIcon ? 'button' : 'div', 'ic', icon);
  if (onIcon) ic.onclick = e => { e.stopPropagation(); haptic(); onIcon(); };
  r.appendChild(ic);

  const body = el('div', 'body');
  body.appendChild(el('b', null, title));
  if (sub) body.appendChild(el('small', null, sub));
  if (chips && chips.length) {
    body.appendChild(el('div', 'chips', chips.map(c =>
      `<span class="chip ${c.cls || ''}">${c.text}</span>`).join('')));
  }
  r.appendChild(body);
  if (trail) r.appendChild(trail);
  return r;
}

/**
 * A labelled progress bar, used by goals, the festival, storage and the
 * trough. The label span is always present, empty or not, so callers that
 * update it on a ticker always have something to write into.
 */
function meter(pct, label = '', cls = '') {
  const m = el('div', 'meter ' + cls);
  m.innerHTML = `<i style="width:${clamp(pct, 0, 1) * 100}%"></i><span>${label}</span>`;
  return m;
}

/** A pill button that costs something, so prices read the same everywhere. */
function costBtn(text, { tone = 'gold', disabled = false, onTap }) {
  const b = el('button', `btn btn-sm btn-${tone}`, text);
  b.disabled = disabled;
  b.onclick = () => { haptic(); onTap(); };
  return b;
}

function lockRow(icon, name, level, note) {
  const r = el('div', 'row locked');
  r.innerHTML = `<div class="ic">${icon}</div><div class="body"><b>${name}</b>
    <small>🔒 Unlocks at level ${level}${note ? ' · ' + note : ''}</small></div>`;
  return r;
}

/* --------------------------------- FARM ---------------------------------- */

/** "What am I working towards?" — the next level that actually opens something. */
function goalPanel() {
  const S = St.S;
  let target = 0, unlocks = [];
  for (let lv = S.level + 1; lv <= S.level + 20; lv++) {
    const u = unlocksAt(lv);
    if (u.length) { target = lv; unlocks = u; break; }
  }
  if (!target) return null;

  let toGo = D.xpToNext(S.level) - S.xp;
  for (let lv = S.level + 1; lv < target; lv++) toGo += D.xpToNext(lv);

  const row = el('div', 'row');
  row.innerHTML = `<div class="ic">🎯</div><div class="body">
    <b>Next goal: level ${target} · ${fmt(toGo)} XP</b>
    <div class="chips">${unlocks.map(u => `<span class="chip">${u}</span>`).join('')}</div></div>`;
  return panel(null, row);
}

function farmView() {
  const frag = document.createDocumentFragment();
  const col = el('div', 'mapcol');

  col.appendChild(farmMap({ T, open: mapTap }));
  col.appendChild(seedBar());
  frag.appendChild(col);
  return frag;
}

/** Everything the map can hand back to us. */
function mapTap(kind, arg) {
  const S = St.S;
  if (kind === 'plot') {
    const i = arg;
    const state = G.plotState(S.plots[i]);
    if (state === 'empty') G.plant(i, S.selectedSeed);
    else if (state === 'ready') G.harvest(i);
    else {
      speedSheet('field', () => { if (G.speedUpPlot(i)) render(); },
        (S.plots[i].end - now()) / 1000, D.ITEMS[S.plots[i].crop]);
      return;
    }
    refresh();
    return;
  }

  if (kind === 'land') { landSheet(); return; }

  if (kind === 'animal') {
    const an = St.animalsOf(arg.type)[arg.idx];
    if (!an) return;
    const st = G.animalState(an);
    if (st === 'hungry') G.feedAnimal(an);
    else if (st === 'ready') G.collectAnimal(an);
    else {
      speedSheet(arg.type, () => { if (G.speedUpAnimal(an)) render(); },
        (an.readyAt - now()) / 1000, D.ITEMS[D.ANIMALS.find(a => a.id === arg.type).product]);
      return;
    }
    refresh();
    return;
  }

  if (kind === 'buy-animal') {
    const t = D.ANIMALS.find(a => a.id === arg);
    if (t.level > S.level) { SFX.error(); toast(`${t.name}s unlock at level ${t.level}`, '🔒', true); return; }
    G.buyAnimal(arg);
    render();
    return;
  }

  if (kind === 'silo') { sellSheet('silo'); return; }
  if (kind === 'barn') { sellSheet('barn'); return; }
  if (kind === 'works') { setView('craft'); return; }
  if (kind === 'orders') { setView('orders'); return; }
  if (kind === 'goals') { setView('goals'); return; }
  if (kind === 'store') { setView('shop'); return; }
}

/** Clearing the next field, from the overgrown patches on the map. */
function landSheet() {
  const S = St.S;
  if (S.plots.length >= D.MAX_PLOTS) { toast('Every field is yours', '🏆'); return; }
  const cost = D.plotCost(S.plots.length), lv = D.plotLevel(S.plots.length);
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, '🚧 Clear this patch'));
    sheet.appendChild(el('p', 'sub',
      S.level >= lv ? `Field ${S.plots.length + 1} of ${D.MAX_PLOTS}.`
                    : `You need to reach level ${lv} before clearing this one.`));
    const go = el('button', 'btn btn-big btn-green', `🪙 ${fmt(cost)} — Clear it`);
    go.disabled = S.level < lv || S.coins < cost;
    go.onclick = () => { G.buyPlot(); close(); render(); };
    sheet.appendChild(go);
    const no = el('button', 'btn btn-big', 'Not yet');
    no.style.marginTop = '8px';
    no.onclick = close;
    sheet.appendChild(no);
  });
}

/** The seed rack pinned under the map, plus the two bulk buttons. */
function seedBar() {
  const S = St.S;
  const bar = el('div', 'seedbar');

  const harvestBtn = el('button', 'btn btn-sm btn-green', '🧺');
  harvestBtn.title = 'Harvest all';
  harvestBtn.onclick = () => { haptic(); G.harvestAll(); refresh(); };

  const strip = el('div', 'strip');
  for (const c of D.CROPS) {
    const locked = c.level > S.level;
    const chip = el('button', 'seedchip' + (c.id === S.selectedSeed ? ' on' : '') + (locked ? ' locked' : ''),
      `${c.icon}<small>${locked ? 'Lv' + c.level : '🪙' + c.seed}</small>`);
    chip.onclick = () => {
      haptic();
      if (locked) { SFX.error(); toast(`${c.name} unlocks at level ${c.level}`, '🔒', true); return; }
      S.selectedSeed = c.id;
      St.saveSoon();
      // Swap the highlight in place. Re-rendering here would reset the
      // strip's horizontal scroll and throw you back to wheat.
      for (const n of strip.children) n.classList.toggle('on', n === chip);
      FX.floatFrom(chip, c.name);
    };
    strip.appendChild(chip);
  }
  // Remember where the rack was scrolled to across full re-renders.
  strip.addEventListener('scroll', () => { seedScroll = strip.scrollLeft; }, { passive: true });
  requestAnimationFrame(() => {
    strip.scrollLeft = seedScroll;
    const on = strip.querySelector('.seedchip.on');
    if (!seedScroll && on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  });

  const plantBtn = el('button', 'btn btn-sm btn-gold', '🌱');
  plantBtn.title = 'Plant all';
  plantBtn.onclick = () => { haptic(); G.plantAll(S.selectedSeed); refresh(); };

  bar.append(harvestBtn, strip, plantBtn);
  return bar;
}

function plotTile(i) {
  const S = St.S;
  const b = el('button', 'plot');
  b.onclick = () => {
    haptic();
    const p = St.S.plots[i];
    const state = G.plotState(p);
    if (state === 'empty') { if (G.plant(i, St.S.selectedSeed)) render(); }
    else if (state === 'ready') { G.harvest(i); render(); }
    else speedSheet('field', () => { if (G.speedUpPlot(i)) render(); }, (St.S.plots[i].end - now()) / 1000, D.ITEMS[St.S.plots[i].crop]);
  };

  T(() => {
    const p = St.S.plots[i];
    const state = G.plotState(p);
    b.className = 'plot ' + (state === 'empty' ? 'empty' : state);
    if (state === 'empty') { b.innerHTML = ''; return; }
    const crop = D.ITEMS[p.crop];
    const total = p.end - p.at;
    const pct = clamp((now() - p.at) / total, 0, 1);
    const left = (p.end - now()) / 1000;
    if (!b.dataset.crop || b.dataset.crop !== p.crop || !b.querySelector('.crop')) {
      b.innerHTML = `<span class="crop">${crop.icon}</span>
                     <span class="tag"></span><span class="growbar"><i></i></span>`;
      b.dataset.crop = p.crop;
    }
    // Seedling grows into a full plant as the timer runs down.
    const scale = 0.42 + 0.58 * pct;
    b.querySelector('.crop').style.transform = `scale(${scale.toFixed(2)})`;
    b.querySelector('.growbar > i').style.width = (pct * 100).toFixed(1) + '%';
    b.querySelector('.tag').textContent = state === 'ready' ? 'TAP!' : fmtTime(left);
  });
  return b;
}

/* -------------------------------- ANIMALS -------------------------------- */

function animalsView() {
  const S = St.S;
  const frag = document.createDocumentFragment();

  const cb = el('button', 'btn btn-sm btn-green', '🧺 Collect All');
  cb.style.marginBottom = '10px';
  cb.onclick = () => { haptic(); G.collectAllAnimals(); render(); };

  frag.appendChild(panel(`<em>🐮</em>Barnyard<span class="spacer"></span>`,
    storageBar('barn'), cb, troughPanel()));

  const soon = [];
  for (const type of D.ANIMALS) {
    if (type.level > S.level) { soon.push(lockRow(type.icon, type.name2 || type.name + 's', type.level)); continue; }
    const mine = St.animalsOf(type.id);
    const head = `<em>${type.icon}</em>${type.name2 || type.name + 's'}<span class="spacer"></span>
      <span class="muted">${mine.length}/${type.max}</span>`;
    const info = el('div', 'muted',
      `Eats ${type.feed} from the trough → ${D.ITEMS[type.product].icon} ${D.ITEMS[type.product].name} ` +
      `every ${fmtTime(type.cycle)} · sells for 🪙${fmt(G.sellPrice(type.product))}`);
    const pen = el('div', 'pen-grid');

    for (const an of mine) pen.appendChild(critterTile(an, type));

    if (mine.length < type.max) {
      const add = el('button', 'critter add', `<span>＋</span><span class="tag">🪙${fmt(type.cost)}</span>`);
      add.onclick = () => { haptic(); G.buyAnimal(type.id); render(); };
      pen.appendChild(add);
    }
    frag.appendChild(panel(head, info, pen));
  }
  if (soon.length) frag.appendChild(panel(`<em>🔒</em>Coming Soon`, ...soon));
  return frag;
}

/** The trough: a bar, what's filling it, and the two ways to top it up. */
export function troughPanel() {
  const wrap = el('div', 'trough');
  const bar = meter(0, '', 'meter-hay');
  const note = el('div', 'muted');
  const buttons = el('div', 'btn-row');
  buttons.style.marginTop = '8px';

  const hay = el('button', 'btn btn-sm btn-gold',
    `🌾 Buy hay · 🪙${fmt(D.HAY.coins)}`);
  hay.onclick = () => { haptic(); G.buyHay(); render(); };
  const mill = el('button', 'btn btn-sm', '🏚️ Mill feed');
  mill.onclick = () => { haptic(); setView('craft'); };
  buttons.append(hay, mill);

  wrap.append(el('div', 'fld-label', 'Feed trough'), bar, note, buttons);

  T(() => {
    const u = St.troughUnits();
    const pct = u / D.TROUGH_CAP;
    bar.querySelector('i').style.width = clamp(pct, 0, 1) * 100 + '%';
    bar.querySelector('span').textContent = `${u} / ${D.TROUGH_CAP}`;
    bar.classList.toggle('low', pct < 0.15);
    const grazing = u < D.TROUGH_CAP * D.GRAZE_CEILING;
    const ceiling = Math.round(D.TROUGH_CAP * D.GRAZE_CEILING);
    note.textContent = grazing
      ? `Your animals feed themselves from here. Grass regrows on its own and will reach ` +
        `${ceiling} in about ${fmtTime((ceiling - u) / St.grazeRate())}.`
      : 'Your animals feed themselves from here. The pasture is grazed down to its limit — ' +
        'hay or milled feed tops up the rest.';
    hay.disabled = u >= D.TROUGH_CAP || St.S.coins < D.HAY.coins;
  });
  return wrap;
}

function critterTile(an, type) {
  const b = el('button', 'critter');
  b.onclick = () => {
    haptic();
    const st = G.animalState(an);
    if (st === 'hungry') { G.feedAnimal(an); render(); }
    else if (st === 'ready') { G.collectAnimal(an); render(); }
    else speedSheet(type.name.toLowerCase(), () => { if (G.speedUpAnimal(an)) render(); }, (an.readyAt - now()) / 1000, D.ITEMS[type.product]);
  };
  T(() => {
    const st = G.animalState(an);
    b.className = 'critter ' + st;
    const mark = st === 'ready' ? D.ITEMS[type.product].icon : st === 'hungry' ? '❗' : '';
    const tag = st === 'ready' ? 'TAP!' : st === 'hungry' ? 'Feed' : fmtTime((an.readyAt - now()) / 1000);
    b.innerHTML = `<span>${type.icon}</span>${mark ? `<span class="mark">${mark}</span>` : ''}<span class="tag">${tag}</span>`;
  });
  return b;
}

/* --------------------------------- CRAFT --------------------------------- */

function craftView() {
  const S = St.S;
  const frag = document.createDocumentFragment();

  const top = panel(`<em>🏭</em>Workshops<span class="spacer"></span>`, storageBar('barn'));
  const cb = el('button', 'btn btn-sm btn-green', '🧺 Collect Everything');
  cb.style.marginTop = '8px';
  cb.onclick = () => { haptic(); G.collectAllJobs(); render(); };
  top.appendChild(cb);
  frag.appendChild(top);

  const soon = [];
  for (const m of D.MACHINES) {
    const owned = S.machines[m.id] && S.machines[m.id].owned;
    if (m.level > S.level && !owned) {
      soon.push(lockRow(m.icon, m.name, m.level,
        D.recipesFor(m.id).map(r => D.ITEMS[r.out].icon).join(' ')));
      continue;
    }

    if (!owned) {
      const b = el('button', 'btn btn-sm btn-green', `🔨 ${fmt(m.cost)}`);
      b.disabled = S.coins < m.cost;
      b.onclick = () => { haptic(); G.buyMachine(m.id); render(); };
      frag.appendChild(panel(null, row({
        icon: m.icon,
        title: m.name,
        sub: `Makes ${D.recipesFor(m.id).map(r => D.ITEMS[r.out].name).join(', ')}`,
        trail: b,
        onIcon: () => machineSheet(m.id),
      })));
      continue;
    }

    frag.appendChild(machinePanel(m));
  }
  if (soon.length) frag.appendChild(panel(`<em>🔒</em>Coming Soon`, ...soon));
  return frag;
}

function machinePanel(m) {
  const S = St.S;
  const head = `<em>${m.icon}</em>${m.name}<span class="spacer"></span>`;
  const slots = el('div', 'slots');
  const list = el('div');
  list.style.marginTop = '10px';

  const cap = St.queueCap();
  for (let i = 0; i < cap; i++) slots.appendChild(slotTile(m.id, i));

  for (const r of D.recipesFor(m.id)) {
    const out = D.ITEMS[r.out];
    const locked = r.level > S.level;
    const row = el('div', 'row' + (locked ? ' locked' : ''));
    const ing = el('div', 'chips');
    const icBtn = el('button', 'ic', out.icon);
    icBtn.onclick = e => { e.stopPropagation(); haptic(); itemSheet(r.out); };
    row.appendChild(icBtn);
    const body = el('div', 'body');
    const toTrough = r.out === 'feed';
    body.innerHTML = `<b>${toTrough ? `Feed · +${D.MILL_UNITS} to trough` : out.name + (r.qty > 1 ? ' ×' + r.qty : '')}</b>
      <small>${locked ? '🔒 Level ' + r.level
        : toTrough ? `⏱ ${fmtTime(G.craftTime(r))} · fills the trough your animals eat from`
        : `⏱ ${fmtTime(G.craftTime(r))} · 🪙${fmt(G.sellPrice(r.out))} · +${out.xp} XP`}</small>`;
    body.appendChild(ing);
    row.appendChild(body);

    const btn = el('button', 'btn btn-sm btn-green', '🔨 Make');
    btn.onclick = () => { haptic(); G.enqueue(m.id, r.id); render(); };
    row.appendChild(btn);

    T(() => {
      ing.innerHTML = '';
      for (const [id, q] of Object.entries(r.in)) {
        const have = St.count(id);
        ing.appendChild(el('span', 'chip ' + (have >= q ? 'done' : 'miss'),
          have >= q ? `${D.ITEMS[id].icon} ×${q}` : `${D.ITEMS[id].icon} ${have}/${q}`));
      }
      const full = S.machines[m.id].queue.length >= St.queueCap();
      btn.disabled = locked || full || !St.hasAll(r.in);
      btn.textContent = full ? '⏳ Full' : '🔨 Make';
    });
    list.appendChild(row);
  }
  return panel(head, slots, list);
}

function slotTile(machineId, i) {
  const b = el('button', 'slot');
  b.onclick = () => {
    const m = St.S.machines[machineId];
    const job = m.queue[i];
    if (!job) return;
    haptic();
    if (G.jobReady(job)) { G.collectJob(machineId, job.jid); render(); }
    else {
      const r = D.RECIPES.find(x => x.id === job.recipe);
      speedSheet(D.ITEMS[r.out].name, () => { if (G.speedUpJob(machineId, job.jid)) render(); },
        (job.end - now()) / 1000, D.ITEMS[r.out]);
    }
  };
  T(() => {
    const m = St.S.machines[machineId];
    const job = m.queue[i];
    if (!job) { b.className = 'slot'; b.innerHTML = '<span style="opacity:.35">＋</span>'; return; }
    const r = D.RECIPES.find(x => x.id === job.recipe);
    const out = D.ITEMS[r.out];
    const ready = G.jobReady(job);
    b.className = 'slot ' + (ready ? 'done' : 'busy');
    const total = Math.max(1, job.end - job.start);
    const pct = clamp((now() - job.start) / total, 0, 1) * 100;
    b.innerHTML = `<span class="ring" style="--p:${pct.toFixed(0)}%"></span><span>${out.icon}</span>
      <span class="tag">${ready ? 'TAP!' : fmtTime((job.end - now()) / 1000)}</span>`;
  });
  return b;
}

/* -------------------------------- ORDERS --------------------------------- */

const CUSTOMERS = ['👨‍🍳', '👵', '🧑‍🎤', '👮', '🧑‍🏫', '👨‍🔧', '🧕', '🧑‍🚀', '💁', '🧙'];

function ordersView() {
  const S = St.S;
  const frag = document.createDocumentFragment();
  const p = panel(`<em>📋</em>Order Board<span class="spacer"></span>`);
  p.appendChild(el('div', 'muted',
    'Fill a crate to earn far more than selling piece by piece. Decline anything you cannot make — a new order arrives sooner.'));
  frag.appendChild(p);

  S.orders.forEach((o, i) => {
    if (!o || !o.oid) {
      const w = el('div', 'order wait');
      T(() => {
        const left = ((o && o.wait ? o.wait : 0) - now()) / 1000;
        w.innerHTML = `🚚 New order in ${fmtTime(Math.max(0, left))}`;
      });
      frag.appendChild(w);
      return;
    }
    frag.appendChild(orderCard(o, i));
  });
  return frag;
}

function orderCard(o, i) {
  const card = el('div', 'order');
  const face = CUSTOMERS[(o.oid.charCodeAt(0) + i) % CUSTOMERS.length];
  const top = el('div', 'order-top');
  top.innerHTML = `<span class="who">${face}</span>
    <div class="body" style="flex:1"><b>Order #${o.oid.slice(0, 4).toUpperCase()}</b>
      <small class="muted">🪙 ${fmt(o.coins)} · +${o.xp} XP${o.gems ? ` · 💎 ${o.gems}` : ''}</small></div>`;
  card.appendChild(top);

  const reqs = el('div', 'order-req');
  card.appendChild(reqs);

  const btns = el('div', 'btn-row');
  btns.style.marginTop = '10px';
  const deliver = el('button', 'btn btn-sm btn-green', '🚚 Deliver');
  deliver.onclick = () => { haptic(); G.deliverOrder(o.oid); render(); };
  const decline = el('button', 'btn btn-sm', '✖️ Decline');
  decline.style.flex = '0 0 auto';
  decline.onclick = () => { haptic(); G.declineOrder(o.oid); render(); };
  btns.append(deliver, decline);
  card.appendChild(btns);

  T(() => {
    reqs.innerHTML = '';
    for (const [id, q] of Object.entries(o.items)) {
      const have = St.count(id);
      const r = el('div', 'req' + (have >= q ? '' : ' miss'));
      r.innerHTML = `<em>${D.ITEMS[id].icon}</em><b>${Math.min(have, q)}/${q}</b>`;
      reqs.appendChild(r);
    }
    deliver.disabled = !G.canDeliver(o);
  });
  return card;
}

/* -------------------------------- GOALS ---------------------------------- */

function festivalPanel() {
  const S = St.S;
  const f = G.festState();
  const tiers = G.festTiers();
  const p = panel(`<em>🎪</em>Harvest Festival<span class="spacer"></span>
                   <span class="tag" id="fest-clock"></span>`);
  p.classList.add('panel-feature');
  p.appendChild(el('div', 'muted',
    'Everything you harvest, collect, craft and deliver earns festival points. ' +
    'Prizes reset when the next festival starts, so claim as you go.'));

  const top = tiers[tiers.length - 1].at;
  const bar = meter(f.points / top, `${fmt(f.points)} / ${fmt(top)} points`, 'meter-fest');
  bar.style.margin = '10px 0 4px';
  p.appendChild(bar);

  const marks = el('div', 'fest-marks');
  for (const t of tiers) {
    marks.appendChild(el('span', 'fest-mark' + (t.reached ? ' hit' : ''),
      `${t.icon}<small>${fmt(t.at)}</small>`));
  }
  p.appendChild(marks);

  for (const t of tiers) {
    const r = row({
      icon: t.icon,
      title: `${t.name}`,
      sub: t.claimed ? 'Prize collected'
        : t.reached ? 'Ready to claim!'
        : `${fmt(t.at - f.points)} more points to go`,
      chips: [
        { text: `🪙 ${fmt(t.reward.coins)}`, cls: 'chip-gold' },
        { text: `💎 ${t.reward.gems}`, cls: 'chip-gem' },
        { text: `⭐ ${fmt(t.reward.xp)} XP`, cls: '' },
      ],
      locked: !t.reached,
      trail: t.claimed
        ? el('span', 'chip done', '✔')
        : t.reached
          ? costBtn('Claim', { tone: 'green', onTap: () => { G.claimFest(t.i); render(); } })
          : null,
    });
    p.appendChild(r);
  }

  T(() => {
    const c = document.getElementById('fest-clock');
    if (c) c.textContent = '⏳ ' + fmtTime(G.festLeft());
  });
  return p;
}

function goalsView() {
  const frag = document.createDocumentFragment();
  frag.appendChild(festivalPanel());

  /* daily bonus */
  const daily = panel(`<em>🎁</em>Daily Bonus`);
  const S = St.S;
  const streak = S.daily.streak || 0;
  if (G.dailyReady()) {
    const next = D.dailyReward(
      D.today(Date.now() - 86400000) === S.daily.day ? streak + 1 : 1, S.level);
    const row = el('div', 'row');
    row.innerHTML = `<div class="ic">🎁</div><div class="body"><b>Today's bonus is waiting</b>
      <small>🪙 ${fmt(next.coins)} · 💎 ${next.gems}${streak ? ` · ${streak}-day streak` : ''}</small></div>`;
    const b = el('button', 'btn btn-sm btn-green', 'Claim');
    b.onclick = () => { haptic(); G.claimDaily(); render(); };
    row.appendChild(b);
    daily.appendChild(row);
  } else {
    daily.appendChild(el('div', 'muted',
      `Claimed today. Streak: ${streak} day${streak === 1 ? '' : 's'} — come back tomorrow to keep it going.`));
  }
  const dots = el('div', 'chips');
  for (let i = 1; i <= D.DAILY_MAX_STREAK; i++) {
    dots.appendChild(el('span', 'chip ' + (i <= streak ? 'done' : ''), i === D.DAILY_MAX_STREAK ? '🏅' : i));
  }
  daily.appendChild(dots);
  frag.appendChild(daily);

  /* goals */
  const p = panel(`<em>🏆</em>Farm Goals`);
  p.appendChild(el('div', 'muted', 'Every goal has four ranks. Claim each one for coins and gems.'));
  for (const g of D.GOALS) {
    const st = G.goalState(g);
    const row = el('div', 'row' + (st.done ? ' locked' : ''));
    const rank = st.done ? 'Legend' : D.GOAL_RANKS[st.claimed];
    const pct = clamp(st.value / st.target, 0, 1) * 100;
    row.innerHTML = `<div class="ic">${g.icon}</div><div class="body">
      <b>${g.name} · ${rank}</b>
      <small>${fmt(Math.min(st.value, st.target))} / ${fmt(st.target)} ${g.unit}</small>
      <span class="goalbar"><i style="width:${pct.toFixed(1)}%"></i></span></div>`;
    if (st.ready) {
      const r = D.goalReward(st.claimed);
      const b = el('button', 'btn btn-sm btn-gold', `🪙${fmt(r.coins)}`);
      b.onclick = () => { haptic(); G.claimGoal(g.id); render(); };
      row.appendChild(b);
    } else if (st.done) {
      row.appendChild(el('span', 'chip done', '✔'));
    }
    p.appendChild(row);
  }
  frag.appendChild(p);
  return frag;
}

/* --------------------------------- SHOP ---------------------------------- */

function shopView() {
  const S = St.S;
  const frag = document.createDocumentFragment();

  /* market */
  const market = panel(`<em>💰</em>Market`);
  market.appendChild(el('div', 'muted', 'Sell straight from storage at market price.'));
  const mrow = el('div', 'btn-row');
  mrow.style.marginTop = '8px';
  const s1 = el('button', 'btn btn-sm btn-gold', '🛖 Sell Crops');
  s1.onclick = () => { haptic(); sellSheet('silo'); };
  const s2 = el('button', 'btn btn-sm btn-gold', '🏠 Sell Goods');
  s2.onclick = () => { haptic(); sellSheet('barn'); };
  mrow.append(s1, s2);
  market.appendChild(mrow);
  if (St.has('scythe')) market.appendChild(el('div', 'muted', '🪄 Golden Scythe: +25% on every sale.'));

  const movers = G.marketMovers(4);
  if (movers.length) {
    market.appendChild(el('div', 'muted', 'Prices drift all day. Best rates on what you are holding:'));
    const chips = el('div', 'chips');
    for (const m of movers) chips.appendChild(el('span', 'chip ' + trendClass(m.factor),
      `${D.ITEMS[m.id].icon} ${trendLabel(m.factor)}`));
    market.appendChild(chips);
  }
  frag.appendChild(market);

  /* boosts — the profit levers */
  const boosts = panel(`<em>⚡</em>Boosts`);
  boosts.appendChild(el('div', 'muted',
    'Buy one before a big harvest or a full-silo sell-off. Buying again adds more time.'));
  for (const b of D.BOOSTS) {
    const left = St.boostLeft(b.id);
    const locked = S.level < b.level;
    const cost = b.gems ? `💎 ${b.gems}` : `🪙 ${fmt(b.coins)}`;
    const row = el('div', 'row' + (locked ? ' locked' : ''));
    row.innerHTML = `<div class="ic">${b.icon}</div><div class="body"><b>${b.name}</b>
      <small>${locked ? `🔒 Unlocks at level ${b.level}` : b.desc}</small></div>`;
    const btn = el('button', 'btn btn-sm ' + (left ? 'btn-green' : 'btn-gold'),
      left ? `⏳ ${fmtTime(left)}` : cost);
    btn.disabled = locked || (b.gems ? S.gems < b.gems : S.coins < b.coins);
    btn.onclick = () => { haptic(); G.buyBoost(b.id); render(); };
    row.appendChild(btn);
    boosts.appendChild(row);
  }
  frag.appendChild(boosts);

  /* feed */
  const feed = panel(`<em>🌾</em>Feed`);
  feed.appendChild(troughPanel());
  frag.appendChild(feed);

  /* land */
  const land = panel(`<em>🚜</em>Land`);
  if (S.plots.length >= D.MAX_PLOTS) {
    land.appendChild(el('div', 'muted', '🏆 You own every field on Sunny Acres.'));
  } else {
    const owned = S.plots.length;
    const cost = D.plotCost(owned), lv = D.plotLevel(owned);
    land.appendChild(buyRow('🚧', `Field ${owned + 1}`,
      `${owned} of ${D.MAX_PLOTS} fields cleared`, cost, S.level < lv ? lv : 0,
      () => { G.buyPlot(); render(); }));
  }
  frag.appendChild(land);

  /* storage */
  const store = panel(`<em>📦</em>Storage`);
  store.appendChild(buyRow('🛖', `Silo +${D.SILO_STEP}`,
    `Holds ${S.siloCap} crops now`, D.siloUpgradeCost(S.siloCap), 0,
    () => { G.upgradeSilo(); render(); }));
  store.appendChild(buyRow('🏠', `Barn +${D.BARN_STEP}`,
    `Holds ${S.barnCap} goods now`, D.barnUpgradeCost(S.barnCap), 0,
    () => { G.upgradeBarn(); render(); }));
  frag.appendChild(store);

  /* upgrades */
  const up = panel(`<em>⭐</em>Farm Upgrades`);
  up.appendChild(el('div', 'muted', 'Permanent boosts. Each one takes work off your hands for good.'));
  for (const u of D.UPGRADES) {
    if (S.upgrades[u.id]) {
      const r = el('div', 'row');
      r.innerHTML = `<div class="ic">${u.icon}</div><div class="body"><b>${u.name}</b><small>${u.desc}</small></div>
        <span class="chip done">✔ Owned</span>`;
      up.appendChild(r);
    } else {
      up.appendChild(buyRow(u.icon, u.name, u.desc, u.cost, S.level < u.level ? u.level : 0,
        () => { G.buyUpgrade(u.id); render(); }));
    }
  }
  frag.appendChild(up);
  return frag;
}

function buyRow(icon, name, desc, cost, needLevel, onBuy) {
  const S = St.S;
  const r = el('div', 'row' + (needLevel ? ' locked' : ''));
  r.innerHTML = `<div class="ic">${icon}</div><div class="body"><b>${name}</b>
    <small>${needLevel ? '🔒 Unlocks at level ' + needLevel : desc}</small></div>`;
  const b = el('button', 'btn btn-sm btn-green', `🪙 ${fmt(cost)}`);
  b.disabled = !!needLevel || S.coins < cost;
  b.onclick = () => { haptic(); onBuy(); };
  r.appendChild(b);
  return r;
}

/** Market drift, as a chip class and a signed percentage. */
function trendClass(f) { return f >= 1.06 ? 'done' : f <= 0.94 ? 'miss' : ''; }
function trendLabel(f) {
  const pct = Math.round((f - 1) * 100);
  return `${pct > 0 ? '▲+' : pct < 0 ? '▼' : '='}${pct === 0 ? '' : pct + '%'}`;
}

/* -------------------------------- sheets --------------------------------- */

export function openSheet(build) {
  const root = $('sheet-root');
  const back = el('div', 'backdrop');
  const sheet = el('div', 'sheet');

  const grip = el('div', 'sheet-grip');
  grip.innerHTML = '<span class="sheet-grab"></span>';
  const x = el('button', 'sheet-x', '✕');
  x.setAttribute('aria-label', 'Close');
  grip.appendChild(x);
  sheet.appendChild(grip);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sheet.classList.add('closing');
    back.classList.add('closing');
    setTimeout(() => back.remove(), 180);
  };
  x.onclick = () => { haptic(); close(); };

  build(sheet, close);
  back.appendChild(sheet);
  back.onclick = e => { if (e.target === back) close(); };
  root.appendChild(back);
  makeSheetDraggable(sheet, close);
  return close;
}

/**
 * Drag the sheet down to dismiss it, the way the grab handle implies.
 * The drag only starts when the sheet's own scroller is already at the top,
 * so scrolling a long list still works normally.
 */
function makeSheetDraggable(sheet, close) {
  let startY = 0, dy = 0, dragging = false, startedAt = 0;

  const onDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (sheet.scrollTop > 0) return;
    // Let controls handle their own taps; only bare surface starts a drag.
    if (e.target.closest('button, input, textarea, a')) return;
    dragging = true;
    startY = e.clientY;
    dy = 0;
    startedAt = Date.now();
    sheet.style.transition = 'none';
  };

  const onMove = e => {
    if (!dragging) return;
    dy = e.clientY - startY;
    if (dy < 0) dy = dy * 0.25;          // slight resistance upward
    sheet.style.transform = `translateY(${dy}px)`;
    if (dy > 4 && e.cancelable) e.preventDefault();
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    const flicked = dy > 40 && Date.now() - startedAt < 300;
    if (dy > 110 || flicked) close();
  };

  sheet.addEventListener('pointerdown', onDown);
  sheet.addEventListener('pointermove', onMove, { passive: false });
  sheet.addEventListener('pointerup', onUp);
  sheet.addEventListener('pointercancel', onUp);
  sheet.addEventListener('pointerleave', onUp);
}

function sellSheet(kind) {
  const S = St.S;
  openSheet((sheet, close) => {
    const isSilo = kind === 'silo';
    sheet.appendChild(el('h2', null, isSilo ? '🛖 Sell Crops' : '🏠 Sell Goods'));
    sheet.appendChild(el('p', 'sub',
      'Tap to sell. Prices swing through the day — ▲ means better than usual.'));

    const list = el('div');
    const build = () => {
      list.innerHTML = '';
      const stock = isSilo ? S.silo : S.barn;
      const ids = Object.keys(stock).filter(id => stock[id] > 0);
      if (!ids.length) {
        list.appendChild(el('div', 'muted center', 'Nothing in here yet.'));
        return;
      }
      ids.sort((a, b) => D.ITEMS[a].price - D.ITEMS[b].price);
      for (const id of ids) {
        const it = D.ITEMS[id];
        const n = stock[id];
        const f = G.marketFactor(id);
        const one = el('button', 'btn btn-sm btn-gold', 'Sell 1');
        const all = el('button', 'btn btn-sm btn-green', `All 🪙${fmt(G.sellPrice(id) * n)}`);

        const doSell = (btn, qty) => {
          const got = G.sell(id, qty);
          FX.floatFrom(btn, '+' + fmt(got) + ' 🪙');
          build();
          refresh();
        };
        one.onclick = () => { haptic(); doSell(one, 1); };
        all.onclick = () => {
          haptic();
          if (St.S.settings.confirmSell && n > 1) {
            confirmSheet(`Sell all ${n} ${it.name}?`,
              `That's 🪙 ${fmt(G.sellPrice(id) * n)} at today's price.`, () => doSell(all, n));
          } else doSell(all, n);
        };

        const trail = el('div', 'row-actions');
        trail.append(one, all);
        list.appendChild(row({
          icon: it.icon,
          title: `${it.name} × ${n}`,
          sub: `🪙 ${fmt(G.sellPrice(id))} each <span class="trend ${trendClass(f)}">${trendLabel(f)}</span>`,
          trail,
          onIcon: () => itemSheet(id),
        }));
      }
    };
    build();
    sheet.appendChild(list);

    const done = el('button', 'btn btn-big btn-blue', 'Done');
    done.style.marginTop = '10px';
    done.onclick = () => { close(); render(); };
    sheet.appendChild(done);
  });
}

function speedSheet(what, action, secLeft, item) {
  openSheet((sheet, close) => {
    const cost = D.speedUpCost(secLeft);
    sheet.appendChild(el('h2', null, `${item ? item.icon : '⏳'} Still ${fmtTime(secLeft)}`));
    sheet.appendChild(el('p', 'sub', `Spend gems to finish this ${what} right now.`));
    const go = el('button', 'btn btn-big btn-blue', `💎 ${cost} — Finish Now`);
    go.onclick = () => { action(); close(); };
    sheet.appendChild(go);
    const nope = el('button', 'btn btn-big', 'Wait it out');
    nope.style.marginTop = '8px';
    nope.onclick = close;
    sheet.appendChild(nope);
  });
}

function profileSheet() {
  const S = St.S;
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, `${S.avatar} ${S.name}`));
    sheet.appendChild(el('p', 'sub',
      `${D.titleFor(S.level)} · Level ${S.level} · Save ${St.slot + 1}`));

    const next = D.TITLES.find(t => t.level > S.level);
    const stats = el('div', 'panel');
    stats.style.margin = '0 0 10px';
    stats.innerHTML = `
      <div class="row"><div class="ic">🧺</div><div class="body"><b>${fmt(S.stats.harvested)}</b><small>Crops harvested</small></div></div>
      <div class="row"><div class="ic">🥚</div><div class="body"><b>${fmt(S.stats.collected)}</b><small>Animal goods collected</small></div></div>
      <div class="row"><div class="ic">🏭</div><div class="body"><b>${fmt(S.stats.crafted)}</b><small>Goods crafted</small></div></div>
      <div class="row"><div class="ic">🚚</div><div class="body"><b>${fmt(S.stats.orders)}</b><small>Orders delivered</small></div></div>
      <div class="row"><div class="ic">🪙</div><div class="body"><b>${fmt(S.stats.earned)}</b><small>Coins earned all-time</small></div></div>
      ${next ? `<div class="row"><div class="ic">🎖️</div><div class="body"><b>${next.name}</b><small>Next title, at level ${next.level}</small></div></div>` : ''}`;
    sheet.appendChild(stats);

    /* avatar swap */
    sheet.appendChild(el('div', 'fld-label', 'Change your look'));
    const grid = el('div', 'avatar-grid');
    for (const a of D.AVATARS) {
      const b = el('button', 'av' + (a === S.avatar ? ' on' : ''), a);
      b.onclick = () => { S.avatar = a; St.save(); close(); render(); };
      grid.appendChild(b);
    }
    sheet.appendChild(grid);

    const cog = el('button', 'btn btn-big', '⚙️ Settings');
    cog.onclick = () => { close(); settingsSheet(); };
    sheet.appendChild(cog);

    const swap = el('button', 'btn btn-big btn-blue', '🔄 Switch farm');
    swap.style.marginTop = '8px';
    swap.onclick = () => { St.save(); location.reload(); };
    sheet.appendChild(swap);

    const xfer = el('button', 'btn btn-big', '📤 Move this farm to another device');
    xfer.style.marginTop = '8px';
    xfer.onclick = () => transferSheet();
    sheet.appendChild(xfer);

    const reset = el('button', 'btn btn-big btn-red', '🗑️ Delete this farm');
    reset.style.marginTop = '8px';
    reset.onclick = () => confirmSheet('Delete this farm?',
      `Save ${St.slot + 1} is erased for good. Your other saves are untouched.`,
      () => { St.wipe(); location.reload(); });
    sheet.appendChild(reset);

    const done = el('button', 'btn btn-big btn-blue', 'Close');
    done.style.marginTop = '8px';
    done.onclick = close;
    sheet.appendChild(done);
  });
}

/* -------------------------- "what is this?" sheets ----------------------- */

/** Everything the game knows about one item, in one place. */
export function itemSheet(id) {
  const it = D.ITEMS[id];
  if (!it) return;
  openSheet((sheet, close) => {
    const f = G.marketFactor(id);
    sheet.appendChild(el('div', 'sheet-hero',
      `<span class="hero-ic">${it.icon}</span>
       <div><h2>${it.name}</h2>
       <p class="sub">${it.kind === 'crop' ? 'Crop · kept in the silo' : 'Good · kept in the barn'}</p></div>`));

    const facts = el('div', 'factgrid');
    const add = (k, v, cls) => facts.appendChild(el('div', 'fact ' + (cls || ''),
      `<small>${k}</small><b>${v}</b>`));

    add('You have', fmt(St.count(id)));
    add('Sells for', '🪙 ' + fmt(G.sellPrice(id)));
    add('Base value', '🪙 ' + fmt(it.price));
    add('Market now', trendLabel(f), trendClass(f) === 'done' ? 'fact-up'
      : trendClass(f) === 'miss' ? 'fact-down' : '');
    add('Gives', '⭐ ' + it.xp + ' XP');
    if (it.level) add('Unlocks at', 'Level ' + it.level);
    sheet.appendChild(facts);

    /* where it comes from */
    const crop = D.CROPS.find(c => c.id === id);
    const fromAnimal = D.ANIMALS.find(a => a.product === id);
    const madeBy = D.RECIPES.find(r => r.out === id);
    let source = null;
    if (crop) {
      source = `Grows in ${fmtTime(G.growSeconds(crop))} from a 🪙${crop.seed} seed, ` +
               `${D.CROP_YIELD} per field.`;
    } else if (fromAnimal) {
      source = `${fromAnimal.name}s make one every ${fmtTime(fromAnimal.cycle)} ` +
               `for ${fromAnimal.feed} feed.`;
    } else if (madeBy) {
      const m = D.MACHINES.find(x => x.id === madeBy.machine);
      const ing = Object.entries(madeBy.in)
        .map(([k, q]) => `${D.ITEMS[k].icon} ${q}`).join(' + ');
      source = `${m.name} turns ${ing} into this in ${fmtTime(G.craftTime(madeBy))}.`;
    }
    if (source) {
      sheet.appendChild(el('div', 'fld-label', 'Where it comes from'));
      sheet.appendChild(el('div', 'note', source));
    }

    /* what it's used for */
    const usedIn = D.RECIPES.filter(r => r.in[id]);
    if (usedIn.length) {
      sheet.appendChild(el('div', 'fld-label', 'Used to make'));
      const chips = el('div', 'chips');
      for (const r of usedIn) {
        const b = el('button', 'chip chip-link',
          `${D.ITEMS[r.out].icon} ${D.ITEMS[r.out].name} ×${r.in[id]}`);
        b.onclick = () => { haptic(); itemSheet(r.out); };
        chips.appendChild(b);
      }
      sheet.appendChild(chips);
    }

    const done = el('button', 'btn btn-big btn-blue', 'Got it');
    done.style.marginTop = '12px';
    done.onclick = close;
    sheet.appendChild(done);
  });
}

/** The same treatment for a building/workshop on the map. */
export function machineSheet(id) {
  const m = D.MACHINES.find(x => x.id === id);
  if (!m) return;
  const owned = St.S.machines[id] && St.S.machines[id].owned;
  openSheet((sheet, close) => {
    sheet.appendChild(el('div', 'sheet-hero',
      `<span class="hero-ic">${m.icon}</span>
       <div><h2>${m.name}</h2><p class="sub">${owned ? 'Built and running' :
         St.S.level >= m.level ? `Costs 🪙 ${fmt(m.cost)} to build` : `Unlocks at level ${m.level}`}</p></div>`));
    sheet.appendChild(el('div', 'fld-label', 'Makes'));
    for (const r of D.recipesFor(id)) {
      const out = D.ITEMS[r.out];
      sheet.appendChild(row({
        icon: out.icon,
        title: out.name,
        sub: `${fmtTime(G.craftTime(r))} · sells for 🪙${fmt(G.sellPrice(r.out))}`,
        chips: Object.entries(r.in).map(([k, q]) => ({ text: `${D.ITEMS[k].icon} ${q}` })),
        locked: r.level > St.S.level,
        onIcon: () => itemSheet(r.out),
      }));
    }
    const done = el('button', 'btn btn-big btn-blue', 'Close');
    done.style.marginTop = '12px';
    done.onclick = close;
    sheet.appendChild(done);
  });
}

/* -------------------------------- settings ------------------------------- */

function toggleRow(label, note, get, set) {
  const wrap = el('button', 'row row-tap');
  const sw = el('span', 'switch');
  const paint = () => {
    sw.classList.toggle('on', !!get());
    wrap.setAttribute('aria-pressed', String(!!get()));
  };
  wrap.innerHTML = `<div class="ic">${label.icon}</div>
    <div class="body"><b>${label.text}</b><small>${note}</small></div>`;
  wrap.appendChild(sw);
  wrap.onclick = () => { haptic(); set(!get()); St.save(); paint(); };
  paint();
  return wrap;
}

export function settingsSheet() {
  const S = St.S;
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, '⚙️ Settings'));
    sheet.appendChild(el('p', 'sub', 'These stick to this farm and this device.'));

    sheet.appendChild(el('div', 'fld-label', 'Feel'));
    sheet.appendChild(toggleRow({ icon: '🔊', text: 'Sound effects' },
      'Chimes when you plant, sell and level up.',
      () => S.settings.sound, v => { S.settings.sound = v; setSound(v); }));
    sheet.appendChild(toggleRow({ icon: '📳', text: 'Vibration' },
      'A tiny buzz on every tap, where the phone supports it.',
      () => S.settings.haptics, v => { S.settings.haptics = v; setHaptics(v); }));
    sheet.appendChild(toggleRow({ icon: '✨', text: 'Animations' },
      'Confetti, button bounces and floating numbers.',
      () => S.settings.motion, v => { S.settings.motion = v; FX.setMotion(v); }));

    sheet.appendChild(el('div', 'fld-label', 'Reading'));
    sheet.appendChild(toggleRow({ icon: '🔠', text: 'Larger text' },
      'Bumps every label up a size.',
      () => S.settings.bigText, v => {
        S.settings.bigText = v;
        document.body.classList.toggle('big-text', v);
      }));

    sheet.appendChild(el('div', 'fld-label', 'Safety'));
    sheet.appendChild(toggleRow({ icon: '🛡️', text: 'Confirm Sell All' },
      'Asks before emptying a whole stack, so a stray tap cannot cost you a silo.',
      () => S.settings.confirmSell, v => { S.settings.confirmSell = v; }));

    const done = el('button', 'btn btn-big btn-blue', 'Done');
    done.style.marginTop = '12px';
    done.onclick = () => { close(); render(); };
    sheet.appendChild(done);
  });
}

/** A farm's whole save as a code you can paste on another phone. */
function transferSheet() {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, '📤 Move your farm'));
    sheet.appendChild(el('p', 'sub',
      'Copy this code, then paste it into Load From Code on the other device. Your farm here is left alone.'));

    const box = el('textarea', 'fld code-box');
    box.readOnly = true;
    box.value = St.exportCode();
    box.onclick = () => box.select();
    sheet.appendChild(box);

    const copy = el('button', 'btn btn-big btn-green', '📋 Copy code');
    copy.style.marginTop = '10px';
    copy.onclick = async () => {
      haptic();
      box.select();
      try {
        await navigator.clipboard.writeText(box.value);
        toast('Code copied', '📋');
      } catch {
        // Clipboard is blocked in some in-app browsers; the selection still works.
        toast('Press and hold the code to copy', '📋');
      }
    };
    sheet.appendChild(copy);

    const done = el('button', 'btn btn-big btn-blue', 'Done');
    done.style.marginTop = '8px';
    done.onclick = close;
    sheet.appendChild(done);
  });
}

function confirmSheet(title, body, onYes) {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, title));
    sheet.appendChild(el('p', 'sub', body));
    const yes = el('button', 'btn btn-big btn-red', 'Yes, do it');
    yes.onclick = () => { close(); onYes(); };
    const no = el('button', 'btn btn-big', 'Cancel');
    no.style.marginTop = '8px';
    no.onclick = close;
    sheet.append(yes, no);
  });
}

/* ------------------------------- feedback -------------------------------- */

export function toast(msg, icon, bad) {
  const t = el('div', 'toast' + (bad ? ' bad' : ''), `${icon ? icon + ' ' : ''}${msg}`);
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 2300);
}

function floatText(e, text) {
  const f = el('div', 'float', text);
  const x = e && e.clientX ? e.clientX : innerWidth / 2;
  const y = e && e.clientY ? e.clientY : innerHeight / 2;
  f.style.left = x + 'px';
  f.style.top = y + 'px';
  f.style.transform = 'translate(-50%, 0)';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

/** What the player just earned the right to do. */
function unlocksAt(level) {
  const out = [];
  for (const c of D.CROPS) if (c.level === level) out.push(`${c.icon} ${c.name}`);
  for (const a of D.ANIMALS) if (a.level === level) out.push(`${a.icon} ${a.name}`);
  for (const m of D.MACHINES) if (m.level === level) out.push(`${m.icon} ${m.name}`);
  for (const r of D.RECIPES) if (r.level === level && !D.MACHINES.some(m => m.level === level && m.id === r.machine)) {
    out.push(`${D.ITEMS[r.out].icon} ${D.ITEMS[r.out].name}`);
  }
  for (const u of D.UPGRADES) if (u.level === level) out.push(`${u.icon} ${u.name}`);
  const owned = St.S.plots.length;
  if (owned < D.MAX_PLOTS && D.plotLevel(owned) === level) out.push('🚧 New field');
  return out;
}

export function levelUpSplash(level) {
  SFX.levelUp();
  FX.confetti(90);
  setTimeout(() => FX.confetti(50, innerWidth * 0.25, innerHeight * 0.28), 220);
  setTimeout(() => FX.confetti(50, innerWidth * 0.75, innerHeight * 0.28), 400);
  const wrap = el('div', 'levelup');
  const card = el('div', 'card');
  const unlocks = unlocksAt(level);
  const newTitle = D.titleFor(level) !== D.titleFor(level - 1);
  card.innerHTML = `<div class="big">🎉</div><h2>Level ${level}!</h2>
    <p>${newTitle ? `You are now a ${D.titleFor(level)} · ` : ''}+🪙${fmt(level * 120)} · +💎${level % 5 === 0 ? 3 : 1}</p>
    ${unlocks.length ? `<div class="unlock-list">${unlocks.map(u => `<span class="chip">${u}</span>`).join('')}</div>` : ''}`;
  const b = el('button', 'btn btn-big btn-green', 'Nice!');
  b.onclick = () => { wrap.remove(); render(); };
  card.appendChild(b);
  wrap.appendChild(card);
  wrap.onclick = e => { if (e.target === wrap) { wrap.remove(); render(); } };
  document.body.appendChild(wrap);
}

export function welcomeBack(info) {
  if (info.away < 120) return;
  const bits = [];
  if (info.ripe) bits.push(`${info.ripe} field${info.ripe > 1 ? 's' : ''} ripened`);
  if (info.ready) bits.push(`${info.ready} animal${info.ready > 1 ? 's' : ''} produced`);
  if (info.crafts) bits.push(`${info.crafts} craft${info.crafts > 1 ? 's' : ''} finished`);
  if (!bits.length) return;
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, '👋 Welcome back!'));
    sheet.appendChild(el('p', 'sub', `You were away for ${fmtSpan(info.away)}.`));
    const list = el('div');
    for (const b of bits) {
      const r = el('div', 'row');
      r.innerHTML = `<div class="ic">✅</div><div class="body"><b>${b}</b></div>`;
      list.appendChild(r);
    }
    sheet.appendChild(list);
    const go = el('button', 'btn btn-big btn-green', 'Back to the farm');
    go.style.marginTop = '10px';
    go.onclick = close;
    sheet.appendChild(go);
  });
}
