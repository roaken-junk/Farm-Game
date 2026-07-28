/* ==========================================================================
   main.js — boot, onboarding, and the once-a-second heartbeat.
   ========================================================================== */

import * as D from './data.js';
import * as St from './state.js';
import * as G from './game.js';
import * as UI from './ui.js';
import { setSound, unlockAudio } from './audio.js';

const $ = id => document.getElementById(id);

/* ------------------------------ onboarding ------------------------------- */

function showOnboarding() {
  const ob = $('onboard');
  ob.hidden = false;
  let avatar = D.AVATARS[0];

  const grid = $('ob-avatars');
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
    St.startNew(name, avatar);
    ob.hidden = true;
    boot();
  };
}

/* --------------------------------- boot ---------------------------------- */

function boot() {
  const S = St.S;
  setSound(S.settings.sound !== false);
  $('app').hidden = false;

  G.on('toast', t => UI.toast(t.msg, t.icon, t.bad));
  G.on('levelup', lv => UI.levelUpSplash(lv));

  const info = G.settleOffline();
  UI.render();
  UI.welcomeBack(info);

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

/* --------------------------------- start --------------------------------- */

if (St.load()) boot();
else showOnboarding();

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
