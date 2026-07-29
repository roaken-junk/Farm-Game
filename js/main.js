/* ==========================================================================
   main.js — the title screen, onboarding, and the once-a-second heartbeat.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import * as UI from './ui.js';
import { setSound, unlockAudio, SFX } from './audio.js';
import * as FX from './fx.js';
import { el, fmt, setHaptics } from './util.js';

const $ = id => document.getElementById(id);

/* ------------------------------ title screen ----------------------------- */

/** "3 days ago" style, for the save list. */
function ago(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function showTitle() {
  const screen = $('title');
  screen.hidden = false;
  $('onboard').hidden = true;
  $('app').hidden = true;

  const list = $('slots');
  list.innerHTML = '';

  for (const s of St.slotSummaries()) {
    const card = el('button', 'slot-card' + (s.empty ? ' empty' : ''));
    card.type = 'button';
    card.innerHTML = s.empty
      ? `<span class="face">＋</span><span class="who"><b>New Farm</b>
         <small>Save ${s.i + 1} · empty</small></span>`
      : `<span class="face">${s.avatar}</span><span class="who"><b>${s.name}</b>
         <small>Level ${s.level} · 🪙 ${fmt(s.coins)} · played ${ago(s.played)}</small></span>`;
    card.onclick = () => {
      unlockAudio();
      if (s.empty) showOnboarding(s.i);
      else if (St.load(s.i)) boot();
    };
    list.appendChild(card);

    if (!s.empty) {
      const del = el('button', 'slot-del', '🗑️');
      del.type = 'button';
      del.title = `Delete save ${s.i + 1}`;
      del.onclick = e => {
        e.stopPropagation();
        if (confirm(`Delete ${s.name}'s farm? This cannot be undone.`)) {
          St.deleteSlot(s.i);
          showTitle();
        }
      };
      card.appendChild(del);
    }
  }

  $('load-code').onclick = () => {
    const code = prompt('Paste the farm code from your other device:');
    if (!code) return;
    const target = St.slotSummaries().find(s => s.empty);
    if (!target) { alert('All three saves are full. Delete one first.'); return; }
    const err = St.importCode(code, target.i);
    if (err) alert(err);
    else boot();
  };
}

/* ------------------------------ onboarding ------------------------------- */

function showOnboarding(slot) {
  const ob = $('onboard');
  $('title').hidden = true;
  ob.hidden = false;
  let avatar = D.AVATARS[0];

  const grid = $('ob-avatars');
  grid.innerHTML = '';
  D.AVATARS.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = 'av' + (i === 0 ? ' on' : '');
    b.type = 'button';
    b.textContent = a;
    b.onclick = () => {
      avatar = a;
      [...grid.children].forEach(c => c.classList.toggle('on', c === b));
    };
    grid.appendChild(b);
  });

  $('ob-start').onclick = () => {
    unlockAudio();
    const name = ($('ob-name').value || '').trim().slice(0, 14) || 'Farmer';
    St.startNew(name, avatar, slot);
    boot();
  };
}

/* --------------------------------- boot ---------------------------------- */

let started = false;

/** Push the saved preferences into the systems that act on them. */
function applySettings() {
  const st = St.S.settings;
  setSound(st.sound !== false);
  setHaptics(st.haptics !== false);
  FX.setMotion(st.motion !== false);
  document.body.classList.toggle('big-text', !!st.bigText);
}

function boot() {
  const S = St.S;
  applySettings();
  $('title').hidden = true;
  $('onboard').hidden = true;
  $('app').hidden = false;

  if (!started) {
    started = true;
    FX.bindTapFeedback();
    G.on('toast', t => UI.toast(t.msg, t.icon, t.bad));
    G.on('levelup', lv => UI.levelUpSplash(lv));
    G.on('celebrate', e => {
      FX.confetti(e && e.big ? 120 : 60);
      if (e && e.big) setTimeout(() => FX.confetti(80), 260);
    });

    // Heartbeat: advance the world, then repaint the cheap bits.
    setInterval(() => {
      G.tick();
      UI.refresh();
    }, 1000);

    // Timers are all timestamp-based, so a backgrounded tab catches up instantly.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) St.save();
      else { G.tick(); UI.render(); }
    });
    window.addEventListener('pagehide', St.save);
    window.addEventListener('blur', St.save);

    // iOS only starts audio inside a user gesture.
    document.addEventListener('pointerdown', unlockAudio, { once: true });

    // Kill the pull-to-refresh / rubber-band bounce on the game surface.
    document.addEventListener('touchmove', e => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
  }

  const info = G.settleOffline();
  UI.setView('farm');
  UI.welcomeBack(info);
}

/* --------------------------------- start --------------------------------- */

showTitle();

/* @strip-in-bundle:start — the single-file build ships no sw.js to register */
// Offline play is a bonus, never a requirement, so failure here is silent.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    } catch { /* no controllable scope here */ }
  });
}
/* @strip-in-bundle:end */
