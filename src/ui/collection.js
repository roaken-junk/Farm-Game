// Team builder, hero collection and the hero detail sheet.

import { $, el, go, toast, onEnter, updateCurrencies, animate } from './ui.js';
import { load } from '../core/storage.js';
import { HEROES, HERO_BY_ID, RARITY, heroStats, heroPower, ABILITY_TRIGGER, cardsForNextLevel } from '../data/heroes.js';
import { paintCard, drawPortrait } from '../art/characters.js';
import { teamPower, setTeamSlot, upgradeInfo, upgradeHero } from '../game/profile.js';
import { sfx, haptic } from '../core/audio.js';

let selectedSlot = 0;
let detailHero = null;
let stopDetailAnim = null;

/* ------------------------------- card node ------------------------------- */

export function heroCard(heroId, opts = {}) {
  const hero = HERO_BY_ID[heroId];
  const p = load();
  const own = p.owned[heroId];
  const node = el('div', `card ${RARITY[hero.rarity].cls}`);
  if (!own) node.classList.add('locked');
  if (opts.selected) node.classList.add('selected');
  if (opts.deployed) node.classList.add('deployed');

  node.appendChild(el('div', 'card-rarity'));
  const cv = el('canvas');
  node.appendChild(cv);

  if (own) {
    node.appendChild(el('div', 'card-lvl', `L${own.level}`));
    const need = cardsForNextLevel(hero.rarity, own.level);
    const bar = el('div', 'card-cards');
    const fill = el('i');
    fill.style.width = `${Math.min(100, (own.cards / (need === Infinity ? own.cards || 1 : need)) * 100)}%`;
    bar.appendChild(fill);
    node.appendChild(bar);
    const info = upgradeInfo(heroId);
    if (info && info.canUpgrade) node.appendChild(el('div', 'card-up', '⬆️'));
  } else {
    node.appendChild(el('div', 'card-lvl', '🔒'));
  }

  node.appendChild(el('div', 'card-name', hero.name));

  node.onclick = () => {
    sfx('click'); haptic(6);
    if (opts.onClick) opts.onClick(heroId);
  };

  requestAnimationFrame(() => paintCard(cv, heroId, { w: 110, h: 130 }));
  return node;
}

/* --------------------------------- team ---------------------------------- */

export function initTeam() {
  onEnter('team', renderTeam);
}

function renderTeam() {
  const p = load();
  $('#team-power').textContent = teamPower();

  const slots = $('#team-slots');
  slots.innerHTML = '';
  p.team.forEach((heroId, i) => {
    const node = heroCard(heroId, {
      selected: i === selectedSlot,
      onClick: () => { selectedSlot = i; renderTeam(); },
    });
    slots.appendChild(node);
  });

  const roster = $('#team-roster');
  roster.innerHTML = '';
  const owned = HEROES.filter((h) => p.owned[h.id]);
  owned.sort((a, b) => heroPower(b.id, p.owned[b.id].level) - heroPower(a.id, p.owned[a.id].level));
  for (const hero of owned) {
    const deployed = p.team.includes(hero.id);
    roster.appendChild(heroCard(hero.id, {
      deployed,
      onClick: (id) => {
        setTeamSlot(selectedSlot, id);
        selectedSlot = (selectedSlot + 1) % 4;
        renderTeam();
        toast(`${HERO_BY_ID[id].name} deployed`);
      },
    }));
  }
}

/* ------------------------------ collection ------------------------------- */

export function initCollection() {
  onEnter('collection', renderCollection);
}

function renderCollection() {
  const p = load();
  const grid = $('#collection-grid');
  grid.innerHTML = '';
  const ownedCount = HEROES.filter((h) => p.owned[h.id]).length;
  $('#collection-count').textContent = `${ownedCount}/${HEROES.length}`;

  const order = [...HEROES].sort((a, b) => {
    const ao = p.owned[a.id] ? 0 : 1, bo = p.owned[b.id] ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return RARITY[b.rarity].power - RARITY[a.rarity].power;
  });

  for (const hero of order) {
    grid.appendChild(heroCard(hero.id, {
      onClick: (id) => openHero(id),
    }));
  }
}

/* ----------------------------- hero detail ------------------------------- */

export function initHeroDetail() {
  onEnter('hero', () => { if (detailHero) renderHero(detailHero); });
}

export function openHero(heroId) {
  detailHero = heroId;
  go('hero');
  renderHero(heroId);
}

function statRow(label, cls, value, max) {
  const row = el('div', `stat-row ${cls}`);
  row.appendChild(el('span', null, label));
  const bar = el('div', 'stat-bar');
  const fill = el('i');
  fill.style.width = `${Math.min(100, (value / max) * 100)}%`;
  bar.appendChild(fill);
  row.appendChild(bar);
  row.appendChild(el('b', null, typeof value === 'number' ? Math.round(value) : value));
  return row;
}

function renderHero(heroId) {
  const hero = HERO_BY_ID[heroId];
  const p = load();
  const own = p.owned[heroId];
  const level = own ? own.level : 1;
  const st = heroStats(heroId, level);

  $('#hero-detail-name').innerHTML = `<span class="jp">${hero.jp}</span>${hero.name.toUpperCase()}`;
  const rar = RARITY[hero.rarity];
  const chip = $('#hero-detail-rarity');
  chip.textContent = rar.label;
  chip.style.color = rar.color;

  const body = $('#hero-detail-body');
  body.innerHTML = '';

  const top = el('div', 'detail-top');
  const art = el('canvas', 'detail-art');
  art.style.aspectRatio = '3/4';
  top.appendChild(art);

  const info = el('div', 'detail-info');
  info.appendChild(el('h3', null, hero.name));
  info.appendChild(el('div', 'jp-name', `${hero.jp} · ${hero.title}`));
  info.appendChild(el('p', null, hero.lore));
  top.appendChild(info);
  body.appendChild(top);

  const stats = el('div');
  stats.appendChild(statRow('HEALTH', 'bar-hp', st.hp, 2400));
  stats.appendChild(statRow('ATTACK', 'bar-atk', st.atk, 600));
  stats.appendChild(statRow('WEIGHT', 'bar-wt', hero.weight * 100, 200));
  stats.appendChild(statRow('POWER', 'bar-cd', heroPower(heroId, level), 900));
  body.appendChild(stats);

  const ab = hero.ability;
  const box = el('div', 'ability-box');
  box.appendChild(el('h4', null,
    `<span class="jp">${ab.jp}</span>${ab.name} <small style="opacity:.7;font-size:10px">(${ABILITY_TRIGGER[ab.trigger]})</small>`));
  box.appendChild(el('p', null, ab.desc));
  body.appendChild(box);

  if (own) {
    const info2 = upgradeInfo(heroId);
    const bar = el('div', 'upgrade-bar');
    if (info2.maxed) {
      bar.appendChild(el('div', 'power-chip', 'MAX LEVEL'));
    } else {
      const btn = el('button', `btn ${info2.canUpgrade ? 'btn-gold' : 'btn-ghost'}`,
        `UPGRADE TO L${level + 1}<small>🎴 ${own.cards}/${info2.need} · 🪙 ${info2.gold}</small>`);
      if (!info2.canUpgrade) btn.disabled = true;
      btn.onclick = () => {
        if (upgradeHero(heroId)) {
          sfx('reward'); haptic([10, 30, 10]);
          toast(`${hero.name} is now level ${load().owned[heroId].level}!`);
          updateCurrencies();
          renderHero(heroId);
        }
      };
      bar.appendChild(btn);
    }
    body.appendChild(bar);
  } else {
    body.appendChild(el('p', 'hint', 'Not unlocked yet — find their cards in chests.'));
  }

  // animated portrait
  if (stopDetailAnim) stopDetailAnim();
  const ctx = art.getContext('2d');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  stopDetailAnim = animate((dt, t) => {
    if (!$('#screen-hero').classList.contains('active')) return;
    const rect = art.getBoundingClientRect();
    const w = rect.width || 180, h = rect.height || 240;
    if (art.width !== Math.round(w * dpr)) {
      art.width = Math.round(w * dpr); art.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawPortrait(ctx, heroId, w, h, t, { pad: 0.07 });
  });
}
