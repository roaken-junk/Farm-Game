/* ==========================================================================
   menus.js — the windows behind every A press: fields, pens, silo, barn,
   workshops, store, order board and the farmhouse.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import * as S from './screen.js';
import { fmt, fmtTime } from './util.js';

const price = id => '$' + fmt(G.sellPrice(id));

/* -------------------------------- fields --------------------------------- */

export function fieldMenu(i) {
  const plot = St.S.plots[i];
  const state = G.plotState(plot);

  if (state === 'ready') {                 // no menu — just take the crop
    const n = G.harvest(i);
    if (n) S.flash(`GOT ${n} ${D.ITEMS[plot.crop].name}`);
    return;
  }

  if (state === 'growing') {
    const left = (plot.end - Date.now()) / 1000;
    const cost = D.speedUpCost(left);
    S.confirm(`${D.ITEMS[plot.crop].name} NEEDS ${fmtTime(left)}. FINISH FOR ${cost} GEMS?`,
      () => { if (G.speedUpPlot(i)) S.flash('READY!'); });
    return;
  }

  seedMenu(i);
}

function seedMenu(plotIndex) {
  const crops = D.CROPS;
  const items = [{
    label: 'PLANT ALL', icon: '🚜', right: '',
    detail: 'FILL EVERY EMPTY FIELD WITH THE SEED YOU PICK NEXT.', value: null,
  }];
  for (const c of crops) {
    const locked = c.level > St.S.level;
    items.push({
      label: c.name, icon: c.icon,
      right: locked ? 'LV' + c.level : '$' + c.seed,
      disabled: locked || St.S.coins < c.seed,
      disabledWhy: locked ? `NEEDS LEVEL ${c.level}` : 'NOT ENOUGH COINS',
      detail: locked ? `UNLOCKS AT LEVEL ${c.level}.`
        : `GROWS IN ${fmtTime(G.growSeconds(c))}. SELLS FOR ${price(c.id)} EACH.`,
      value: c.id,
    });
  }
  const start = Math.max(0, crops.findIndex(c => c.id === St.S.selectedSeed) + 1);

  S.menu({
    title: 'SEED BAG', items, cursor: start,
    onPick(item) {
      if (!item.value) {                   // PLANT ALL -> pick the seed first
        S.pop();
        plantAllMenu();
        return;
      }
      St.S.selectedSeed = item.value;
      if (plotIndex == null) { S.flash(`${D.ITEMS[item.value].name} SELECTED`); return; }
      if (G.plant(plotIndex, item.value)) {
        S.pop();
        S.flash(`PLANTED ${D.ITEMS[item.value].name}`);
      }
    },
  });
}

function plantAllMenu() {
  const items = D.CROPS.filter(c => c.level <= St.S.level).map(c => ({
    label: c.name, icon: c.icon, right: '$' + c.seed, value: c.id,
    detail: `PLANTS EVERY EMPTY FIELD. ${fmtTime(G.growSeconds(c))} EACH.`,
  }));
  S.menu({
    title: 'PLANT ALL', items,
    onPick(item) { S.pop(); G.plantAll(item.value); },
  });
}

export function seedBag() { seedMenu(null); }

export function lockedField() {
  const owned = St.S.plots.length;
  if (owned >= D.MAX_PLOTS) { S.dialog('EVERY FIELD ON THE FARM IS YOURS.'); return; }
  const cost = D.plotCost(owned), lv = D.plotLevel(owned);
  if (St.S.level < lv) { S.dialog(`THIS PATCH IS OVERGROWN. CLEAR IT AT LEVEL ${lv}.`); return; }
  S.confirm(`CLEAR THIS FIELD FOR ${fmt(cost)} COINS?`, () => G.buyPlot());
}

/* --------------------------------- pens ---------------------------------- */

export function penTile(type, slot) {
  const kind = D.ANIMALS.find(a => a.id === type);
  const mine = St.animalsOf(type);

  if (slot < mine.length) {
    const an = mine[slot];
    const st = G.animalState(an);
    if (st === 'ready') {
      if (G.collectAnimal(an)) S.flash(`GOT ${D.ITEMS[kind.product].name}`);
      return;
    }
    if (st === 'hungry') {
      if (St.count('feed') < kind.feed) {
        S.dialog(`THE ${kind.name} IS HUNGRY. IT NEEDS ${kind.feed} FEED - MILL SOME AT WORKS.`);
        return;
      }
      G.feedAnimal(an);
      S.flash(`FED THE ${kind.name}`);
      return;
    }
    const left = (an.readyAt - Date.now()) / 1000;
    S.confirm(`${kind.name} IS BUSY FOR ${fmtTime(left)}. RUSH FOR ${D.speedUpCost(left)} GEMS?`,
      () => { if (G.speedUpAnimal(an)) S.flash('READY!'); });
    return;
  }

  if (kind.level > St.S.level) { S.dialog(`${kind.name}S ARRIVE AT LEVEL ${kind.level}.`); return; }
  if (mine.length >= kind.max) { S.dialog('THIS PEN IS FULL.'); return; }
  S.confirm(`BUY A ${kind.name} FOR ${fmt(kind.cost)} COINS?`, () => G.buyAnimal(type));
}

/* ------------------------------- selling --------------------------------- */

function sellList(title, isCrop) {
  const build = () => Object.keys(isCrop ? St.S.silo : St.S.barn)
    .filter(id => St.count(id) > 0)
    .sort((a, b) => D.ITEMS[a].price - D.ITEMS[b].price)
    .map(id => ({
      label: D.ITEMS[id].name, icon: D.ITEMS[id].icon,
      right: 'x' + St.count(id), value: id,
      detail: `${price(id)} EACH. ALL ${St.count(id)} FETCH $${fmt(G.sellPrice(id) * St.count(id))}.`,
    }));

  S.menu({
    title, items: build(),
    onPick(item) {
      const id = item.value;
      S.menu({
        title: D.ITEMS[id].name.toUpperCase(),
        items: [
          { label: 'SELL 1', right: price(id), value: 1 },
          { label: 'SELL 10', right: '$' + fmt(G.sellPrice(id) * Math.min(10, St.count(id))), value: 10 },
          { label: 'SELL ALL', right: '$' + fmt(G.sellPrice(id) * St.count(id)), value: 1e9 },
          { label: 'BACK', value: 0 },
        ],
        onPick(sub) {
          S.pop();
          if (sub.value) {
            const got = G.sell(id, sub.value);
            S.flash(`SOLD FOR $${fmt(got)}`);
          }
          S.refreshMenu(build());
        },
      });
    },
  });
}

export const siloMenu = () => sellList('SILO', true);
export const barnMenu = () => sellList('BARN', false);

/* ------------------------------ workshops -------------------------------- */

export function worksMenu() {
  const build = () => D.MACHINES.map(m => {
    const own = St.S.machines[m.id] && St.S.machines[m.id].owned;
    const ready = own ? St.S.machines[m.id].queue.filter(G.jobReady).length : 0;
    const locked = m.level > St.S.level;
    return {
      label: m.name, icon: m.icon, value: m.id,
      right: !own ? (locked ? 'LV' + m.level : '$' + fmt(m.cost)) : ready ? `!${ready}` : '',
      disabled: locked,
      disabledWhy: `NEEDS LEVEL ${m.level}`,
      detail: !own
        ? (locked ? `UNLOCKS AT LEVEL ${m.level}.` : `BUILD FOR ${fmt(m.cost)} COINS.`)
        : `MAKES ${D.recipesFor(m.id).map(r => D.ITEMS[r.out].name).join(', ')}.`,
      owned: own,
    };
  });

  S.menu({
    title: 'WORKSHOPS', items: build(),
    onPick(item) {
      if (!item.owned) {
        const m = D.MACHINES.find(x => x.id === item.value);
        S.confirm(`BUILD THE ${m.name} FOR ${fmt(m.cost)} COINS?`, () => {
          G.buyMachine(m.id);
          S.refreshMenu(build());
        });
        return;
      }
      machineMenu(item.value, () => S.refreshMenu(build()));
    },
  });
}

function machineMenu(id, onBack) {
  const m = D.MACHINES.find(x => x.id === id);

  const build = () => {
    const q = St.S.machines[id].queue;
    const rows = [];
    for (const job of q) {
      const r = D.RECIPES.find(x => x.id === job.recipe);
      const done = G.jobReady(job);
      rows.push({
        label: done ? 'TAKE ' + D.ITEMS[r.out].name : D.ITEMS[r.out].name,
        icon: D.ITEMS[r.out].icon,
        right: done ? 'DONE' : fmtTime((job.end - Date.now()) / 1000),
        job, detail: done ? 'READY TO COLLECT.' : 'STILL COOKING. PICK IT TO RUSH WITH GEMS.',
      });
    }
    for (const r of D.recipesFor(id)) {
      const locked = r.level > St.S.level;
      const need = Object.entries(r.in)
        .map(([k, v]) => `${St.count(k)}/${v} ${D.ITEMS[k].name}`).join(', ');
      rows.push({
        label: 'MAKE ' + D.ITEMS[r.out].name, icon: D.ITEMS[r.out].icon,
        right: locked ? 'LV' + r.level : fmtTime(G.craftTime(r)),
        recipe: r,
        disabled: locked || !St.hasAll(r.in) || St.S.machines[id].queue.length >= St.queueCap(),
        disabledWhy: locked ? `NEEDS LEVEL ${r.level}`
          : St.S.machines[id].queue.length >= St.queueCap() ? 'QUEUE IS FULL' : 'MISSING INGREDIENTS',
        detail: locked ? `UNLOCKS AT LEVEL ${r.level}.` : `NEEDS ${need}. SELLS ${price(r.out)}.`,
      });
    }
    return rows;
  };

  S.menu({
    title: m.name, items: build(), onCancel: onBack,
    onPick(item) {
      if (item.job) {
        if (G.jobReady(item.job)) {
          G.collectJob(id, item.job.jid);
          S.flash('COLLECTED');
        } else {
          const left = (item.job.end - Date.now()) / 1000;
          S.confirm(`RUSH FOR ${D.speedUpCost(left)} GEMS?`, () => {
            G.speedUpJob(id, item.job.jid);
            S.refreshMenu(build());
          });
          return;
        }
      } else if (item.recipe) {
        if (G.enqueue(id, item.recipe.id)) S.flash('STARTED');
      }
      S.refreshMenu(build());
    },
  });
}

/* -------------------------------- orders --------------------------------- */

export function ordersMenu() {
  const build = () => St.S.orders.map((o, i) => {
    if (!o || !o.oid) {
      return { label: 'WAITING...', right: fmtTime(Math.max(0, ((o && o.wait) || 0 - Date.now()) / 1000)),
        disabled: true, disabledWhy: 'NO ORDER YET', detail: 'A NEW CUSTOMER IS ON THE WAY.' };
    }
    const need = Object.entries(o.items)
      .map(([id, q]) => `${St.count(id)}/${q} ${D.ITEMS[id].name}`).join(', ');
    const first = Object.keys(o.items)[0];
    return {
      label: 'ORDER ' + (i + 1), icon: D.ITEMS[first].icon,
      right: '$' + fmt(o.coins), order: o,
      disabled: !G.canDeliver(o), disabledWhy: 'YOU ARE SHORT ON GOODS',
      detail: `WANTS ${need}. PAYS $${fmt(o.coins)} AND ${o.xp} XP${o.gems ? ` AND ${o.gems} GEMS` : ''}.`,
    };
  });

  S.menu({
    title: 'ORDER BOARD', items: build(),
    onPick(item) {
      if (!item.order) return;
      G.deliverOrder(item.order.oid);
      S.refreshMenu(build());
    },
  });
}

/* --------------------------------- store --------------------------------- */

export function storeMenu() {
  const build = () => {
    const S_ = St.S;
    const rows = [];
    if (S_.plots.length < D.MAX_PLOTS) {
      const cost = D.plotCost(S_.plots.length), lv = D.plotLevel(S_.plots.length);
      rows.push({
        label: 'NEW FIELD', icon: '🚜', right: '$' + fmt(cost), kind: 'plot',
        disabled: S_.level < lv || S_.coins < cost,
        disabledWhy: S_.level < lv ? `NEEDS LEVEL ${lv}` : 'NOT ENOUGH COINS',
        detail: `CLEARS FIELD ${S_.plots.length + 1} OF ${D.MAX_PLOTS}.`,
      });
    }
    rows.push({
      label: 'BIGGER SILO', icon: '🛖', right: '$' + fmt(D.siloUpgradeCost(S_.siloCap)), kind: 'silo',
      disabled: S_.coins < D.siloUpgradeCost(S_.siloCap), disabledWhy: 'NOT ENOUGH COINS',
      detail: `HOLDS ${S_.siloCap} CROPS. ADDS ${D.SILO_STEP} MORE.`,
    });
    rows.push({
      label: 'BIGGER BARN', icon: '🏠', right: '$' + fmt(D.barnUpgradeCost(S_.barnCap)), kind: 'barn',
      disabled: S_.coins < D.barnUpgradeCost(S_.barnCap), disabledWhy: 'NOT ENOUGH COINS',
      detail: `HOLDS ${S_.barnCap} GOODS. ADDS ${D.BARN_STEP} MORE.`,
    });
    for (const u of D.UPGRADES) {
      const owned = !!S_.upgrades[u.id];
      rows.push({
        label: u.name, icon: u.icon, kind: 'up', up: u.id,
        right: owned ? 'OWNED' : S_.level < u.level ? 'LV' + u.level : '$' + fmt(u.cost),
        disabled: owned || S_.level < u.level || S_.coins < u.cost,
        disabledWhy: owned ? 'ALREADY YOURS' : S_.level < u.level ? `NEEDS LEVEL ${u.level}` : 'NOT ENOUGH COINS',
        detail: u.desc.toUpperCase(),
      });
    }
    return rows;
  };

  S.menu({
    title: 'FARM STORE', items: build(),
    onPick(item) {
      const done = () => S.refreshMenu(build());
      if (item.kind === 'plot') S.confirm('CLEAR A NEW FIELD?', () => { G.buyPlot(); done(); });
      else if (item.kind === 'silo') { G.upgradeSilo(); done(); }
      else if (item.kind === 'barn') { G.upgradeBarn(); done(); }
      else if (item.kind === 'up') {
        const u = D.UPGRADES.find(x => x.id === item.up);
        S.confirm(`BUY ${u.name} FOR ${fmt(u.cost)} COINS?`, () => { G.buyUpgrade(u.id); done(); });
      }
    },
  });
}

/* ------------------------------- farmhouse ------------------------------- */

export function homeMenu() {
  const s = St.S.stats;
  S.menu({
    title: St.S.name.toUpperCase(), items: [
      { label: 'LEVEL ' + St.S.level, right: D.titleFor(St.S.level).toUpperCase(),
        detail: `${fmt(St.levelProgress().have)} OF ${fmt(St.levelProgress().need)} XP TO THE NEXT LEVEL.` },
      { label: 'HARVESTED', right: fmt(s.harvested), detail: 'CROPS PULLED OUT OF THE GROUND.' },
      { label: 'COLLECTED', right: fmt(s.collected), detail: 'GOODS TAKEN FROM YOUR ANIMALS.' },
      { label: 'CRAFTED', right: fmt(s.crafted), detail: 'GOODS MADE IN THE WORKSHOPS.' },
      { label: 'ORDERS', right: fmt(s.orders), detail: 'CRATES SHIPPED FROM THE BOARD.' },
      { label: 'EARNED', right: '$' + fmt(s.earned), detail: 'COINS EARNED SINCE DAY ONE.' },
      { label: 'SAVE', icon: '💾', kind: 'save', detail: 'THE FARM SAVES ITSELF, BUT HERE YOU GO.' },
      { label: 'NEW FARM', kind: 'wipe', detail: 'ERASES THIS FARM FOR GOOD.' },
    ],
    onPick(item) {
      if (item.kind === 'save') { St.save(); S.flash('SAVED'); }
      if (item.kind === 'wipe') {
        S.confirm('ERASE THIS FARM FOR GOOD?', () => { St.wipe(); location.reload(); });
      }
    },
  });
}

/* ------------------------------ start menu ------------------------------- */

export function startMenu() {
  S.menu({
    title: 'MENU', items: [
      { label: 'SEEDS', icon: '🌱', kind: 'seeds', detail: 'CHOOSE WHAT TO SOW NEXT.' },
      { label: 'SILO', icon: '🛖', kind: 'silo', detail: 'SELL CROPS.' },
      { label: 'BARN', icon: '🏠', kind: 'barn', detail: 'SELL ANIMAL AND CRAFTED GOODS.' },
      { label: 'ORDERS', icon: '📋', kind: 'orders', detail: 'SEE WHAT CUSTOMERS WANT.' },
      { label: 'WORKS', icon: '🏭', kind: 'works', detail: 'MILL FEED AND CRAFT GOODS.' },
      { label: 'STORE', icon: '🛒', kind: 'store', detail: 'LAND, STORAGE AND UPGRADES.' },
      { label: 'FARMER', icon: '🧑‍🌾', kind: 'home', detail: 'YOUR LEVEL AND RECORDS.' },
    ],
    onPick(item) {
      S.pop();
      ({ seeds: seedBag, silo: siloMenu, barn: barnMenu, orders: ordersMenu,
         works: worksMenu, store: storeMenu, home: homeMenu })[item.kind]();
    },
  });
}

/** Routes a building's door to its window. */
export function openBuilding(id) {
  ({ home: homeMenu, silo: siloMenu, barn: barnMenu, works: worksMenu, store: storeMenu })[id]();
}
