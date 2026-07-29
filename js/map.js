/* ==========================================================================
   map.js — the farm scene: nothing but the fields you grow in.

   Animals and buildings live in their own tabs now, so this is a single
   responsive grid of large plots. Each one wears a fill bar across the top;
   full and gold means ready, which is the only signal you need to read the
   whole farm at a glance.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import * as FX from './fx.js';
import { el, fmt, fmtTime, now, clamp, haptic } from './util.js';

/**
 * @param T     register a per-second updater (from ui.js)
 * @param open  open('plot' | 'land', index)
 */
export function fieldGrid({ T, open }) {
  const grid = el('div', 'fieldgrid');
  const nodes = [];

  const lay = () => {
    grid.innerHTML = '';
    nodes.length = 0;
    const owned = St.S.plots.length;
    // One row of overgrown patches ahead of you, so the next field to clear is
    // visible without the rest of the map being dead space.
    const preview = Math.min(D.MAX_PLOTS, owned + 3);

    for (let i = 0; i < preview; i++) {
      const isOwned = i < owned;
      const node = el('button', 'plotcard' + (isOwned ? '' : ' wild'));
      node.onclick = () => { haptic(); open(isOwned ? 'plot' : 'land', i); };
      grid.appendChild(node);
      nodes.push(isOwned ? node : null);
      if (!isOwned) {
        node.innerHTML = `<span class="wild-ic">🌿</span><span class="wild-tag">Clear</span>`;
      }
    }
  };
  lay();

  T(() => {
    const owned = St.S.plots.length;
    if (nodes.filter(Boolean).length !== owned) lay();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      const plot = St.S.plots[i];
      const state = G.plotState(plot);

      if (state === 'empty') {
        if (node.dataset.state !== 'empty') {
          node.dataset.state = 'empty';
          node.dataset.crop = '';
          node.className = 'plotcard empty';
          node.innerHTML = `<span class="sow">＋</span><span class="plot-label">Tap to sow</span>`;
        }
        continue;
      }

      const crop = D.ITEMS[plot.crop];
      const total = Math.max(1, plot.end - plot.at);
      const pct = clamp((now() - plot.at) / total, 0, 1);

      if (node.dataset.crop !== plot.crop || node.dataset.state === 'empty') {
        node.dataset.crop = plot.crop;
        node.innerHTML =
          `<span class="fill"><i></i></span>
           <span class="seedling">${crop.icon}</span>
           <span class="plot-label"></span>`;
      }
      node.dataset.state = state;
      node.className = 'plotcard ' + state;
      node.querySelector('.fill > i').style.width = (pct * 100).toFixed(1) + '%';
      // Sprouts start small and fill out as the timer runs down.
      node.querySelector('.seedling').style.setProperty('--s', (0.5 + 0.5 * pct).toFixed(2));
      node.querySelector('.plot-label').textContent =
        state === 'ready' ? 'READY' : fmtTime((plot.end - now()) / 1000);
    }
  });

  /** Lets ui.js play the right animation on the tile that was just used. */
  grid.plotNode = i => nodes[i] || null;
  return grid;
}
