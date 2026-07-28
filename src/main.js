// Bootstrap: wire the screens together, register the service worker,
// and hand control to the home screen.

import { $, $$, go, goRoot, back, modal, updateCurrencies, tapFx } from './ui/ui.js';
import { load, save } from './core/storage.js';
import { initAudio, resumeAudio, setAudioPrefs, setMood, sfx } from './core/audio.js';
import { ensureStarter } from './game/profile.js';
import { initHome, initBootCrest } from './ui/home.js';
import { initTeam, initCollection, initHeroDetail } from './ui/collection.js';
import { initShop } from './ui/shop.js';
import { initSettings } from './ui/settings.js';
import { initBattle, startBattle } from './ui/battle.js';

const bootBar = $('.boot-bar i');
let progress = 0;

function setProgress(v) {
  progress = Math.max(progress, v);
  if (bootBar) bootBar.style.width = `${progress * 100}%`;
}

async function boot() {
  let stopCrest = () => {};
  try { stopCrest = initBootCrest(); } catch (err) { console.warn('crest failed', err); }
  setProgress(0.15);

  // Each screen is initialised independently. One broken subsystem should cost
  // you that screen, never the ability to start the game.
  const steps = [
    ['profile', () => ensureStarter()],
    ['battle', () => initBattle()],
    ['home', () => initHome({
      onBattle: () => startBattle('ladder'),
      onVersus: () => modal({
        title: 'PASS & PLAY', jp: 'ふたりで',
        body: '<p>Two players, one phone. You take the bottom team, your friend takes the top. Hand the phone over when the banner changes.</p>',
        actions: [
          { label: 'CANCEL' },
          { label: 'START', cls: 'btn-gold', onClick: () => startBattle('versus') },
        ],
      }),
      onPractice: () => startBattle('practice'),
    })],
    ['team', () => initTeam()],
    ['collection', () => initCollection()],
    ['hero', () => initHeroDetail()],
    ['shop', () => initShop()],
    ['settings', () => initSettings()],
    ['nav', () => {
      $$('.tab').forEach((t) => {
        tapFx(t);
        t.onclick = () => {
          const target = t.dataset.goto;
          if (target === 'home') goRoot('home');
          else { goRoot('home'); go(target); }
        };
      });
      $$('[data-back]').forEach((b) => {
        tapFx(b);
        b.onclick = () => { sfx('back'); back(); };
      });
    }],
    ['audio-prefs', () => {
      const p = load();
      setAudioPrefs({ music: p.settings.music, sfx: p.settings.sfx });
    }],
    ['currencies', () => updateCurrencies()],
  ];

  const failed = [];
  steps.forEach(([name, fn], i) => {
    try { fn(); } catch (err) {
      failed.push(name);
      console.error(`init "${name}" failed`, err);
    }
    setProgress(0.15 + 0.85 * ((i + 1) / steps.length));
  });

  // wait for the first paint of the home canvas before revealing the tap prompt
  await new Promise((r) => setTimeout(r, 420));

  const start = () => {
    if (!$('#screen-boot').classList.contains('active')) return;
    // Audio is optional. Getting into the game is not.
    try {
      initAudio();
      resumeAudio();
      setMood('menu');
      sfx('click');
    } catch (err) {
      console.warn('audio start failed, continuing', err);
    }
    try { stopCrest(); } catch { /* ignore */ }
    $('#screen-boot').classList.remove('active');
    goRoot('home');
    try {
      const pp = load();
      if (!pp.seenIntro) {
        pp.seenIntro = true;
        save(true);
        setTimeout(showIntro, 500);
      }
    } catch { /* intro is cosmetic */ }
  };

  const tap = $('#btn-tap-start');
  tap.hidden = false;
  tap.onclick = start;
  // The whole splash is the target. The button can end up below the fold in a
  // short frame, and "tap to start" should mean anywhere.
  $('#screen-boot').addEventListener('pointerup', start);

  if (failed.length) {
    console.warn('some screens failed to initialise:', failed.join(', '));
    bootWarning(`Some screens failed to load (${failed.join(', ')}). The game will still start.`);
  }
}

function bootWarning(text) {
  const inner = document.querySelector('.boot-inner');
  if (!inner) return;
  const msg = document.createElement('p');
  msg.className = 'boot-tag';
  msg.style.cssText = 'letter-spacing:0;color:#ff8a8a;max-width:280px;text-align:center;line-height:1.5;margin-top:8px';
  msg.textContent = text;
  inner.appendChild(msg);
}

function showIntro() {
  modal({
    title: 'WELCOME', jp: 'ようこそ', wide: true,
    body: `<p style="text-align:left">
      You command four heroes. So does your rival.<br><br>
      <b>Drag back</b> from one of your heroes and <b>release</b> to fling them —
      the harder the hit, the more damage. Turns alternate.<br><br>
      Fill a hero's <b style="color:#ffcf5c">gold rage bar</b> and their next shot unleashes
      their special. Knock out all four enemies to win.<br><br>
      Win chests, collect hero cards, level everyone up, climb the leagues.
    </p>`,
    actions: [{ label: "LET'S GO", cls: 'btn-gold' }],
  });
}

/* --------------------------- lifecycle plumbing --------------------------- */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save(true);
  else resumeAudio();
});

window.addEventListener('pagehide', () => save(true));

// keep audio unlocked after the browser suspends it
['pointerdown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => resumeAudio(), { passive: true }));

// Stop iOS Safari from rubber-banding the game surface, while leaving the
// genuinely scrollable regions — screen bodies and tall modals — alone.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  const t = e.target;
  if (t && typeof t.closest === 'function' && t.closest('.scroll, .modal, .modal-layer')) return;
  e.preventDefault();
}, { passive: false });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}

boot().catch((err) => {
  // A dead loading bar tells the player nothing. Surface the reason.
  console.error('boot failed', err);
  bootWarning(`Could not start: ${err && err.message ? err.message : err}`);
});
