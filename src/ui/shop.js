// Shop: free daily chest, gem chests and a rotating card offer.

import { $, el, onEnter, toast, updateCurrencies, modal } from './ui.js';
import { load, save } from '../core/storage.js';
import { CHESTS } from '../data/chests.js';
import { HEROES, HERO_BY_ID, RARITY } from '../data/heroes.js';
import { paintChest } from '../art/chest.js';
import { paintCard } from '../art/characters.js';
import { rollChest, addCards, grantChest } from '../game/profile.js';
import { showLoot, renderChests } from './home.js';
import { sfx, haptic } from '../core/audio.js';
import { makeRng } from '../core/rng.js';

const FREE_CHEST_MS = 4 * 60 * 60 * 1000;

export function initShop() {
  onEnter('shop', renderShop);
}

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function renderShop() {
  const p = load();
  updateCurrencies();
  const body = $('#shop-body');
  body.innerHTML = '';

  /* ---- free chest ---- */
  const freeLeft = p.lastFreeChest + FREE_CHEST_MS - Date.now();
  const freeSection = el('div');
  freeSection.appendChild(el('h3', 'section-title', '<span class="jp">日々</span>DAILY GIFT'));
  const freeGrid = el('div', 'shop-grid');
  freeGrid.appendChild(shopItem({
    chest: CHESTS.silver,
    title: 'Blossom Gift',
    sub: freeLeft > 0 ? `Back in ${Math.ceil(freeLeft / 60000)} min` : 'Free — one every 4 hours',
    label: freeLeft > 0 ? 'WAITING' : 'CLAIM',
    cls: freeLeft > 0 ? 'btn-ghost' : 'btn-gold',
    disabled: freeLeft > 0,
    onBuy: () => {
      const pp = load();
      pp.lastFreeChest = Date.now();
      save(true);
      const loot = rollChest('silver', Date.now());
      applyLoot(loot);
      renderShop();
    },
  }));
  freeSection.appendChild(freeGrid);
  body.appendChild(freeSection);

  /* ---- gem chests ---- */
  const gemSection = el('div');
  gemSection.appendChild(el('h3', 'section-title', '<span class="jp">宝箱</span>CHESTS'));
  const gemGrid = el('div', 'shop-grid');
  const offers = [
    { chest: CHESTS.gold, price: 40 },
    { chest: CHESTS.sakura, price: 110 },
    { chest: CHESTS.oni, price: 280 },
  ];
  for (const o of offers) {
    gemGrid.appendChild(shopItem({
      chest: o.chest,
      title: o.chest.name,
      sub: `${o.chest.cards[0]}–${o.chest.cards[1]} cards · ${o.chest.gold[0]}–${o.chest.gold[1]} gold`,
      label: `💠 ${o.price}`,
      cls: 'btn-primary',
      onBuy: () => {
        const pp = load();
        if (pp.gems < o.price) { toast('Not enough gems'); return; }
        pp.gems -= o.price;
        save(true);
        applyLoot(rollChest(o.chest.id, Date.now()));
        renderShop();
      },
    }));
  }
  gemSection.appendChild(gemGrid);
  body.appendChild(gemSection);

  /* ---- daily card offers ---- */
  const rng = makeRng(dailySeed());
  const offersToday = [];
  for (let i = 0; i < 3; i++) {
    const hero = HEROES[Math.floor(rng() * HEROES.length)];
    const count = hero.rarity === 'legend' ? 1 : hero.rarity === 'epic' ? 2 : hero.rarity === 'rare' ? 6 : 14;
    const price = Math.round(count * (hero.rarity === 'legend' ? 900 : hero.rarity === 'epic' ? 320 : hero.rarity === 'rare' ? 90 : 26));
    offersToday.push({ hero, count, price });
  }

  const cardSection = el('div');
  cardSection.appendChild(el('h3', 'section-title', '<span class="jp">札</span>CARD MARKET'));
  const cardGrid = el('div', 'shop-grid');
  const bought = p.boughtToday || {};
  offersToday.forEach((o, i) => {
    const key = `${dailySeed()}-${i}`;
    const isBought = bought[key];
    const node = el('div', 'shop-item');
    node.style.borderColor = RARITY[o.hero.rarity].color;
    const cv = el('canvas');
    node.appendChild(cv);
    node.appendChild(el('h4', null, `${o.hero.name} ×${o.count}`));
    node.appendChild(el('div', 'sub', `${RARITY[o.hero.rarity].label} cards`));
    const btn = el('button', `btn ${isBought ? 'btn-ghost' : 'btn-gold'}`, isBought ? 'SOLD OUT' : `🪙 ${o.price}`);
    if (isBought) btn.disabled = true;
    btn.onclick = () => {
      const pp = load();
      if (pp.gold < o.price) { toast('Not enough gold'); return; }
      pp.gold -= o.price;
      pp.boughtToday = pp.boughtToday || {};
      pp.boughtToday[key] = true;
      save(true);
      addCards(o.hero.id, o.count);
      sfx('reward'); haptic(10);
      toast(`+${o.count} ${o.hero.name} cards`);
      updateCurrencies();
      renderShop();
    };
    node.appendChild(btn);
    cardGrid.appendChild(node);
    requestAnimationFrame(() => paintCard(cv, o.hero.id, { w: 110, h: 100 }));
  });
  cardSection.appendChild(cardGrid);
  body.appendChild(cardSection);

  /* ---- gold for gems ---- */
  const goldSection = el('div');
  goldSection.appendChild(el('h3', 'section-title', '<span class="jp">金</span>GOLD'));
  const goldGrid = el('div', 'shop-grid');
  for (const [gems, gold] of [[10, 1000], [40, 4600], [100, 13000]]) {
    const node = el('div', 'shop-item');
    node.appendChild(el('div', null, `<div style="font-size:44px;margin:6px 0">🪙</div>`));
    node.appendChild(el('h4', null, `${gold.toLocaleString()} Gold`));
    node.appendChild(el('div', 'sub', 'Upgrade your heroes'));
    const btn = el('button', 'btn btn-primary', `💠 ${gems}`);
    btn.onclick = () => {
      const pp = load();
      if (pp.gems < gems) { toast('Not enough gems'); return; }
      pp.gems -= gems; pp.gold += gold;
      save(true);
      sfx('reward');
      toast(`+${gold.toLocaleString()} gold`);
      updateCurrencies();
      renderShop();
    };
    node.appendChild(btn);
    goldGrid.appendChild(node);
  }
  goldSection.appendChild(goldGrid);
  body.appendChild(goldSection);

  body.appendChild(el('p', 'hint',
    'Gems are earned from chests and league promotions — no real money anywhere in this game.'));
}

function shopItem({ chest, title, sub, label, cls, disabled, onBuy }) {
  const node = el('div', 'shop-item');
  node.style.borderColor = chest.color;
  const cv = el('canvas');
  node.appendChild(cv);
  node.appendChild(el('h4', null, title));
  node.appendChild(el('div', 'sub', sub));
  const btn = el('button', `btn ${cls}`, label);
  if (disabled) btn.disabled = true;
  btn.onclick = onBuy;
  node.appendChild(btn);
  requestAnimationFrame(() => paintChest(cv, chest, { w: 110, h: 100 }));
  return node;
}

function applyLoot(loot) {
  const p = load();
  p.gold += loot.gold;
  p.gems += loot.gems;
  for (const item of loot.cards) {
    const r = addCards(item.heroId, item.count);
    item.isNew = r.isNew;
  }
  save(true);
  sfx('reward'); haptic([12, 40, 18]);
  updateCurrencies();
  showLoot(loot);
}
