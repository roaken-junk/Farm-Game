/* Tiny WebAudio blip synth — no asset files, no network, works offline.
   iOS keeps the context suspended until a real touch, so we resume on first tap. */

let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }
export function soundOn() { return enabled; }

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function blip(freq, dur, type = 'sine', gain = 0.06) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function chord(freqs, dur, type = 'triangle', gain = 0.05) {
  freqs.forEach((f, i) => setTimeout(() => blip(f, dur, type, gain), i * 70));
}

export const SFX = {
  plant:   () => blip(430, 0.10, 'triangle'),
  harvest: () => chord([620, 830], 0.14),
  coin:    () => chord([880, 1170], 0.13, 'sine', 0.05),
  buy:     () => chord([520, 700, 900], 0.14),
  error:   () => blip(150, 0.18, 'sawtooth', 0.04),
  levelUp: () => chord([523, 659, 784, 1046], 0.30, 'triangle', 0.06),
  collect: () => chord([700, 950], 0.12),
  order:   () => chord([600, 800, 1000], 0.16),
};
