// Bootstrap: wire the screens together, register the service worker,
// and hand control to the home screen.

import { $, $$, go, goRoot, back, toast, modal, closeModal, updateCurrencies, tapFx } from './ui/ui.js';
import { load, save } from './core/storage.js';
import { initAudio, resumeAudio, setAudioPrefs, setMood, sfx } from './core/audio.js';
import { ensureStarter } from './game/profile.js';
import { initHome, initBootCrest } from './ui/home.js';
import { initTeam, initCollection, initHeroDetail } from './ui/collection.js';
import { initShop } from './ui/shop.js';
import { initSettings } from './ui/settings.js';
import { initBattle, startBattle, stopBattle } from './ui/battle.js';

const bootBar = $('.boot-bar i');
let progress = 0;

function setProgress(v) {
  progress = Math.max(progress, v);
  if (bootBar) bootBar.style.width = `${progress * 100}%`;
}

async function boot() {
  const stopCrest = initBootCrest();
  setProgress(0.15);

  ensureStarter();
  setProgress(0.35);

  initBattle();
  initHome({
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
  });
  initTeam();
  initCollection();
  initHeroDetail();
  initShop();
  initSettings();
  setProgress(0.7);

  // tab bar + back buttons
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

  const p = load();
  setAudioPrefs({ music: p.settings.music, sfx: p.settings.sfx });
  updateCurrencies();
  setProgress(1);

  // wait for the first paint of the home canvas before revealing the tap prompt
  await new Promise((r) => setTimeout(r, 420));
  const tap = $('#btn-tap-start');
  tap.hidden = false;
  tap.onclick = async () => {
    initAudio();
    resumeAudio();
    setMood('menu');
    sfx('click');
    stopCrest();
    $('#screen-boot').classList.remove('active');
    goRoot('home');
    if (!load().seenIntro) {
      const pp = load();
      pp.seenIntro = true;
      save(true);
      setTimeout(showIntro, 500);
    }
  };
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

// stop iOS Safari from bouncing / zooming the game surface
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if (e.target.closest('.scroll')) return;
  e.preventDefault();
}, { passive: false });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}

boot();
