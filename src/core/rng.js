// Deterministic seeded RNG (mulberry32). The battle world uses a seeded
// stream so the AI's forward simulation reproduces the real outcome exactly.

export function makeRng(seed = Date.now() >>> 0) {
  let s = seed >>> 0;
  const fn = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.state = () => s;
  fn.setState = (v) => { s = v >>> 0; };
  return fn;
}

export const randRange = (rng, a, b) => a + rng() * (b - a);
export const randInt = (rng, a, b) => Math.floor(a + rng() * (b - a + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Weighted pick: entries are [value, weight].
export function weighted(rng, entries) {
  let total = 0;
  for (const e of entries) total += e[1];
  let r = rng() * total;
  for (const e of entries) {
    r -= e[1];
    if (r <= 0) return e[0];
  }
  return entries[entries.length - 1][0];
}
