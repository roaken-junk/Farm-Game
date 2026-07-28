// All audio is synthesised with the WebAudio API — no sample files, so the
// game stays tiny and works offline. The music is a slow pentatonic
// (yo-scale) koto-ish arpeggio, which gives the Japanese flavour.

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = 0;
let musicOn = true;
let sfxOn = true;
let started = false;
let step = 0;
let currentMood = 'menu';

// Yo scale (no semitones) — the classic bright Japanese pentatonic.
const YO = [0, 2, 5, 7, 9];
const noteHz = (semi) => 440 * Math.pow(2, (semi - 9) / 12);

// Audio is a luxury: on some devices (locked-down frames, low power mode) the
// context cannot be created at all. Nothing in here may ever throw into the
// caller, because the caller is the code that starts the game.
let failed = false;

export function initAudio() {
  if (ctx || failed) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { failed = true; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.85;
    sfxGain.connect(master);
  } catch (err) {
    console.warn('audio unavailable, continuing silently', err);
    failed = true;
    ctx = null;
  }
  return ctx;
}

export function resumeAudio() {
  try {
    if (!ctx) initAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!started) {
      started = true;
      scheduleMusic();
    }
  } catch (err) {
    console.warn('audio resume failed', err);
  }
}

export function setAudioPrefs({ music, sfx }) {
  if (music !== undefined) musicOn = music;
  if (sfx !== undefined) sfxOn = sfx;
  try {
    if (musicGain && ctx) {
      musicGain.gain.setTargetAtTime(musicOn ? 0.22 : 0, ctx.currentTime, 0.3);
    }
  } catch { /* not fatal */ }
}

export function setMood(mood) {
  currentMood = mood;
}

/* ---------------- music ---------------- */

function scheduleMusic() {
  clearInterval(musicTimer);
  const tick = () => {
    try {
      musicTick();
    } catch (err) {
      clearInterval(musicTimer);
      console.warn('music stopped', err);
    }
  };
  tick();
  musicTimer = setInterval(tick, 380);
  try {
    if (musicGain && ctx) musicGain.gain.setTargetAtTime(musicOn ? 0.22 : 0, ctx.currentTime, 1.2);
  } catch { /* not fatal */ }
}

function musicTick() {
  if (!ctx || !musicOn || ctx.state !== 'running') return;
  const battle = currentMood === 'battle';
  const root = battle ? -5 : 0;
  const octave = step % 16 < 8 ? 0 : 12;
  const degree = YO[(step * (battle ? 3 : 2) + (step >> 2)) % YO.length];
  const t = ctx.currentTime;

  pluck(noteHz(root + degree + octave), t, battle ? 0.55 : 0.85, 0.16);
  if (step % 4 === 0) pluck(noteHz(root + degree - 12), t, 1.6, 0.11);
  if (battle && step % 8 === 4) taiko(t);
  if (!battle && step % 16 === 12) pluck(noteHz(root + YO[4] + 12), t + 0.12, 1.2, 0.08);
  step++;
}

// Karplus-Strong-ish plucked string via a decaying triangle + lowpass.
function pluck(freq, when, dur, vol) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const g = ctx.createGain();
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(2600, when);
  filt.frequency.exponentialRampToValueAtTime(500, when + dur);
  osc.type = 'triangle';
  osc2.type = 'sine';
  osc.frequency.value = freq;
  osc2.frequency.value = freq * 2.01;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(filt); osc2.connect(filt); filt.connect(g); g.connect(musicGain);
  osc.start(when); osc2.start(when);
  osc.stop(when + dur + 0.05); osc2.stop(when + dur + 0.05);
}

function taiko(when) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, when);
  osc.frequency.exponentialRampToValueAtTime(48, when + 0.22);
  g.gain.setValueAtTime(0.35, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
  osc.connect(g); g.connect(musicGain);
  osc.start(when); osc.stop(when + 0.32);
}

/* ---------------- sfx ---------------- */

function env(node, when, attack, dur, peak) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  node.connect(g);
  g.connect(sfxGain);
  return g;
}

function noiseBuffer(dur = 0.4) {
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function sfx(name, intensity = 1) {
  if (!ctx || !sfxOn || ctx.state !== 'running') return;
  try {
    playSfx(name, intensity);
  } catch (err) {
    // A dud oscillator must never take down the render loop that called it.
  }
}

function playSfx(name, intensity) {
  const t = ctx.currentTime;
  const I = Math.max(0.1, Math.min(1.6, intensity));

  switch (name) {
    case 'click': {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(1500, t + 0.05);
      env(o, t, 0.004, 0.08, 0.10);
      o.start(t); o.stop(t + 0.1);
      break;
    }
    case 'back': {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(700, t);
      o.frequency.exponentialRampToValueAtTime(320, t + 0.08);
      env(o, t, 0.004, 0.11, 0.09);
      o.start(t); o.stop(t + 0.13);
      break;
    }
    case 'aim': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(200 + 700 * I, t);
      env(o, t, 0.01, 0.07, 0.05);
      o.start(t); o.stop(t + 0.09);
      break;
    }
    case 'launch': {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(680 * I, t + 0.14);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
      o.connect(f);
      env(f, t, 0.006, 0.2, 0.16 * I);
      o.start(t); o.stop(t + 0.24);
      // whoosh
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(0.25);
      const bf = ctx.createBiquadFilter();
      bf.type = 'bandpass'; bf.frequency.setValueAtTime(500, t);
      bf.frequency.exponentialRampToValueAtTime(2600, t + 0.2);
      s.connect(bf); env(bf, t, 0.02, 0.22, 0.1 * I);
      s.start(t); s.stop(t + 0.26);
      break;
    }
    case 'hit': {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(0.2);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3800 * I, t);
      f.frequency.exponentialRampToValueAtTime(400, t + 0.14);
      s.connect(f); env(f, t, 0.002, 0.16, 0.24 * I);
      s.start(t); s.stop(t + 0.2);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(220 * (0.7 + I * 0.6), t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.16);
      env(o, t, 0.002, 0.18, 0.2 * I);
      o.start(t); o.stop(t + 0.2);
      break;
    }
    case 'wall': {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.09);
      env(o, t, 0.002, 0.1, 0.09 * I);
      o.start(t); o.stop(t + 0.12);
      break;
    }
    case 'special': {
      // rising shimmer + gong
      for (let i = 0; i < 5; i++) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        const base = noteHz(YO[i % YO.length] + 12);
        o.frequency.setValueAtTime(base * 0.5, t + i * 0.045);
        o.frequency.exponentialRampToValueAtTime(base * 1.5, t + i * 0.045 + 0.3);
        env(o, t + i * 0.045, 0.01, 0.4, 0.09);
        o.start(t + i * 0.045); o.stop(t + i * 0.045 + 0.45);
      }
      const g2 = ctx.createOscillator();
      g2.type = 'sine';
      g2.frequency.setValueAtTime(90, t);
      env(g2, t, 0.01, 0.9, 0.22);
      g2.start(t); g2.stop(t + 0.95);
      break;
    }
    case 'ko': {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(0.6);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(5000, t);
      f.frequency.exponentialRampToValueAtTime(200, t + 0.5);
      s.connect(f); env(f, t, 0.003, 0.55, 0.3);
      s.start(t); s.stop(t + 0.6);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(400, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.5);
      env(o, t, 0.004, 0.55, 0.18);
      o.start(t); o.stop(t + 0.6);
      break;
    }
    case 'pit': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(600, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.7);
      env(o, t, 0.01, 0.75, 0.16);
      o.start(t); o.stop(t + 0.8);
      break;
    }
    case 'heal': {
      [0, 4, 7, 12].forEach((n, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = noteHz(n + 12);
        env(o, t + i * 0.06, 0.01, 0.35, 0.1);
        o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.4);
      });
      break;
    }
    case 'win': {
      [0, 4, 7, 12, 16].forEach((n, i) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = noteHz(n);
        env(o, t + i * 0.11, 0.01, 0.6, 0.13);
        o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.7);
      });
      break;
    }
    case 'lose': {
      [7, 4, 0, -5].forEach((n, i) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = noteHz(n);
        env(o, t + i * 0.16, 0.02, 0.7, 0.12);
        o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.8);
      });
      break;
    }
    case 'reward': {
      for (let i = 0; i < 7; i++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = noteHz(YO[i % YO.length] + 24);
        env(o, t + i * 0.05, 0.005, 0.25, 0.075);
        o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.3);
      }
      break;
    }
    default: break;
  }
}

export function haptic(pattern = 12) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}
