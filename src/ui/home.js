// Home screen: hero showcase, battle entry, chest slots.

import { $, el, go, toast, modal, closeModal, fmtTime, updateCurrencies, onEnter, animate } from './ui.js';
import { load, save } from '../core/storage.js';
import { HERO_BY_ID } from '../data/heroes.js';
import { drawPortrait, paintCard } from '../art/characters.js';
import { drawCrest, paintChest, drawChest, drawCardIcon } from '../art/chest.js';
import { CHESTS } from '../data/chests.js';
import { RARITY } from '../data/heroes.js';
import {
  chestSlots, startUnlock, isReady, remainingMs, gemCostToSkip, skipUnlock, openChest,
  teamMembers, leagueName,
} from '../game/profile.js';
import { arenaForTrophies, nextArena } from '../data/arenas.js';
import { sfx, haptic } from '../core/audio.js';

let showcaseIdx = 0;
let stopAnim = null;

export function initHome({ onBattle, onVersus, onPractice }) {
  const canvas = $('#home-hero');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = 520 * dpr; canvas.height = 620 * dpr;

  canvas.addEventListener('pointerdown', () => {
    const team = teamMembers();
    showcaseIdx = (showcaseIdx + 1) % team.length;
    sfx('click'); haptic(8);
    updateShowcaseLabel();
  });

  $('#btn-battle').onclick = () => { sfx('click'); haptic(14); onBattle(); };
  $('#btn-versus').onclick = () => { sfx('click'); haptic(10); onVersus(); };
  $('#btn-practice').onclick = () => { sfx('click'); haptic(10); onPractice(); };

  paintAvatar();

  onEnter('home', () => {
    updateCurrencies();
    updateShowcaseLabel();
    renderChests();
    updateBattleLabel();
  });

  // one shared rAF for the home stage
  stopAnim = animate((dt, t) => {
    if (!$('#screen-home').classList.contains('active')) return;
    const team = teamMembers();
    if (!team.length) return;
    const heroId = team[showcaseIdx % team.length].heroId;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 520, 620);
    drawPortrait(ctx, heroId, 520, 620, t, { pad: 0.06 });
  });

  setInterval(() => {
    if ($('#screen-home').classList.contains('active')) renderChests(true);
  }, 1000);
}

function paintAvatar() {
  const c = $('#home-avatar');
  const p = load();
  const team = teamMembers();
  if (team.length) paintCard(c, team[0].heroId, { w: 96, h: 96, backdrop: true });
  $('#home-name').textContent = p.name;
  $('#home-league').textContent = leagueName(p.trophies);
}

function updateShowcaseLabel() {
  const team = teamMembers();
  if (!team.length) return;
  const hero = HERO_BY_ID[team[showcaseIdx % team.length].heroId];
  $('#home-hero-title').textContent = `${hero.name} · ${hero.title}`;
  $('#home-hero-sub').textContent = `${hero.jp} — ${RARITY[hero.rarity].label}`;
  paintAvatar();
}

function updateBattleLabel() {
  const p = load();
  const arena = arenaForTrophies(p.trophies);
  const nxt = nextArena(p.trophies);
  $('#battle-sub').textContent = nxt
    ? `${arena.name} · ${nxt.minTrophies - p.trophies}🏆 to ${nxt.name}`
    : `${arena.name} · Top League`;
}

/* -------------------------------- chests -------------------------------- */

export function renderChests(timeOnly = false) {
  const row = $('#chest-row');
  const slots = chestSlots();

  if (!timeOnly || row.children.length !== 4) {
    row.innerHTML = '';
    slots.forEach((c, i) => {
      const node = el('div', 'chest-slot');
      if (c) {
        node.classList.add('filled');
        const def = CHESTS[c.type];
        const cv = el('canvas');
        node.appendChild(cv);
        const label = el('div', 'chest-label');
        node.appendChild(label);
        requestAnimationFrame(() => paintChest(cv, def, { w: 90, h: 90, glow: true, sparkle: isReady(c) }));
        node.onclick = () => openChestMenu(i);
      } else {
        node.appendChild(el('div', 'lock', '＋'));
        const label = el('div', 'chest-label', 'EMPTY');
        node.appendChild(label);
        node.onclick = () => toast('Win a battle to earn a chest');
      }
      row.appendChild(node);
    });
  }

  // refresh timers/labels in place
  slots.forEach((c, i) => {
    const node = row.children[i];
    if (!node) return;
    const label = node.querySelector('.chest-label');
    if (!c) { if (label) label.textContent = 'EMPTY'; node.classList.remove('ready'); return; }
    const def = CHESTS[c.type];
    if (isReady(c)) {
      label.textContent = 'OPEN!';
      node.classList.add('ready');
    } else if (c.unlockAt) {
      label.textContent = fmtTime(remainingMs(c));
      node.classList.remove('ready');
    } else {
      label.textContent = def.name.replace(' Chest', '').toUpperCase();
      node.classList.remove('ready');
    }
  });
}

function openChestMenu(slot) {
  const p = load();
  const c = p.chests[slot];
  if (!c) return;
  const def = CHESTS[c.type];
  sfx('click');

  const body = el('div');
  const preview = el('canvas');
  preview.style.width = '140px'; preview.style.height = '140px';
  preview.style.margin = '0 auto 6px'; preview.style.display = 'block';
  body.appendChild(preview);
  requestAnimationFrame(() => paintChest(preview, def, { w: 140, h: 140 }));

  const odds = def.odds
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<b style="color:${RARITY[k].color}">${RARITY[k].label} ${v}%</b>`)
    .join(' · ');
  body.appendChild(el('p', null,
    `${def.gold[0]}–${def.gold[1]} gold · ${def.cards[0]}–${def.cards[1]} hero cards<br>${odds}`));

  const actions = [];
  if (isReady(c)) {
    actions.push({ label: 'OPEN', cls: 'btn-gold', onClick: () => doOpen(slot) });
  } else if (c.unlockAt) {
    const cost = gemCostToSkip(c);
    body.appendChild(el('p', null, `Ready in <b>${fmtTime(remainingMs(c))}</b>`));
    actions.push({
      label: `SKIP · 💠${cost}`, cls: 'btn-primary',
      onClick: () => { if (skipUnlock(slot)) { updateCurrencies(); renderChests(); doOpen(slot); } else toast('Not enough gems'); },
    });
  } else {
    const busy = p.chests.some((x) => x && x.unlockAt && !isReady(x));
    if (def.unlockMs === 0) {
      actions.push({ label: 'OPEN', cls: 'btn-gold', onClick: () => { startUnlock(slot); doOpen(slot); } });
    } else if (busy) {
      body.appendChild(el('p', null, 'Another chest is already unlocking.'));
      const cost = Math.max(1, Math.ceil(def.unlockMs / (1000 * 60 * 12)));
      actions.push({
        label: `OPEN NOW · 💠${cost}`, cls: 'btn-primary',
        onClick: () => { if (skipUnlock(slot)) { updateCurrencies(); doOpen(slot); } else toast('Not enough gems'); },
      });
    } else {
      actions.push({
        label: `UNLOCK · ${fmtTime(def.unlockMs)}`, cls: 'btn-gold',
        onClick: () => { startUnlock(slot); renderChests(); toast('Unlocking started'); },
      });
    }
  }
  actions.push({ label: 'CLOSE' });

  modal({ title: def.name, jp: def.jp, body, actions });
}

function doOpen(slot) {
  const loot = openChest(slot);
  if (!loot) { toast('Chest is not ready'); return; }
  sfx('reward');
  haptic([12, 40, 18]);
  updateCurrencies();
  renderChests();
  showLoot(loot);
}

export function showLoot(loot) {
  const body = el('div');

  const top = el('div', 'reward-line');
  top.appendChild(el('div', 'reward-pill', `🪙 <b>${loot.gold}</b>`));
  if (loot.gems > 0) top.appendChild(el('div', 'reward-pill', `💠 <b>${loot.gems}</b>`));
  body.appendChild(top);

  const grid = el('div', 'loot-grid');
  loot.cards.forEach((item, i) => {
    const hero = HERO_BY_ID[item.heroId];
    const node = el('div', 'loot-item');
    node.style.animationDelay = `${i * 0.09}s`;
    node.style.borderColor = RARITY[hero.rarity].color;
    const cv = el('canvas');
    cv.style.width = '100%'; cv.style.height = '62px';
    node.appendChild(cv);
    node.appendChild(el('b', null, `×${item.count}`));
    node.appendChild(el('small', null, hero.name));
    if (item.isNew) node.appendChild(el('div', 'loot-new', 'NEW!'));
    grid.appendChild(node);
    requestAnimationFrame(() => paintCard(cv, item.heroId, { w: 90, h: 62 }));
  });
  body.appendChild(grid);

  modal({
    title: 'REWARDS', jp: 'ほうび', body,
    actions: [{ label: 'NICE', cls: 'btn-gold' }],
  });
}

export function initBootCrest() {
  const c = $('#boot-crest');
  const ctx = c.getContext('2d');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = 220 * dpr; c.height = 220 * dpr;
  let raf;
  const loop = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 220, 220);
    ctx.translate(110, 110);
    drawCrest(ctx, 200, now / 1000);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
