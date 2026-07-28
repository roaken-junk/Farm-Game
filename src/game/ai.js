// Opponent brain.
//
// Rather than hand-tuned heuristics, the AI plays the same physics engine the
// player does: it clones the world, tries a spread of candidate shots, runs
// each one to a full stop, and scores the resulting board. `skill` controls
// how many candidates it may consider and how much aim noise it adds, which
// gives a smooth difficulty ramp across the trophy ladder.

import { cloneWorld, launch, runTurnToEnd, aliveOf, legalLaunchers, TURN_LIMIT } from './world.js';
import { ARENA_W, ARENA_H } from '../data/arenas.js';
import { clamp, dist, TAU } from '../core/math.js';
import { makeRng } from '../core/rng.js';

function snapshot(w) {
  const s = { hp: [0, 0], alive: [0, 0], rage: [0, 0] };
  for (const u of w.units) {
    if (u.alive) {
      s.hp[u.side] += u.hp;
      s.alive[u.side] += 1;
      s.rage[u.side] += u.rage;
    }
  }
  return s;
}

function positionScore(w, side) {
  let score = 0;
  const pits = w.hazards.filter((h) => h.type === 'pit');
  const spikes = w.hazards.filter((h) => h.type === 'spike');
  for (const u of w.units) {
    const mine = u.side === side;
    if (!u.alive) continue;
    // Sitting on the lip of a pit is dangerous — punish for us, reward for them.
    for (const p of pits) {
      const d = dist(u.x, u.y, p.x, p.y);
      const risk = clamp(1 - (d - p.r) / 320, 0, 1) * 130;
      score += mine ? -risk : risk;
    }
    for (const s of spikes) {
      const d = dist(u.x, u.y, s.x, s.y);
      const risk = clamp(1 - (d - s.r) / 260, 0, 1) * 70;
      score += mine ? -risk : risk;
    }
    // Hugging a wall limits your options next turn.
    const edge = Math.min(u.x, ARENA_W - u.x, u.y, ARENA_H - u.y);
    const cramped = clamp(1 - edge / 180, 0, 1) * 40;
    score += mine ? -cramped : cramped;
  }
  // Clustered enemies are easier to hit with AoE next turn.
  const foes = aliveOf(w, 1 - side);
  if (foes.length > 1) {
    let spread = 0;
    for (let i = 0; i < foes.length; i++)
      for (let j = i + 1; j < foes.length; j++)
        spread += dist(foes[i].x, foes[i].y, foes[j].x, foes[j].y);
    score += clamp(900 - spread / foes.length, -200, 200) * 0.15;
  }
  return score;
}

function scoreOutcome(before, after, w, side) {
  const foe = 1 - side;
  const dmgDealt = before.hp[foe] - after.hp[foe];
  const dmgTaken = before.hp[side] - after.hp[side];
  const kills = before.alive[foe] - after.alive[foe];
  const losses = before.alive[side] - after.alive[side];
  const rageGain = after.rage[side] - before.rage[side];

  let s = 0;
  s += dmgDealt * 1.0;
  s -= dmgTaken * 1.25;
  s += kills * 950;
  s -= losses * 1150;
  s += rageGain * 3;
  s += positionScore(w, side);

  // Finishing the match right now trumps everything.
  if (after.alive[foe] === 0) s += 6000;
  if (after.alive[side] === 0) s -= 8000;

  // If the arena is collapsing, being ahead on total HP is what matters.
  if (w.turnCount > TURN_LIMIT - 6) s += (after.hp[side] - after.hp[foe]) * 0.4;
  return s;
}

/**
 * Generator so the caller can spread the search across animation frames and
 * keep the UI responsive. Yields progress 0..1, returns the chosen shot.
 */
export function* planShot(w, side, skill = 0.6, seed = 1) {
  const rng = makeRng(seed >>> 0);
  const launchers = legalLaunchers(w, side);
  if (!launchers.length) return null;

  const before = snapshot(w);

  const angleSteps = Math.round(10 + skill * 22);   // 10 → 32 directions
  const powers = skill > 0.55 ? [1.0, 0.74, 0.5] : skill > 0.3 ? [1.0, 0.66] : [1.0];

  let best = null;
  let bestScore = -Infinity;

  const total = launchers.length * angleSteps * powers.length;
  let done = 0;

  for (const u of launchers) {
    for (let a = 0; a < angleSteps; a++) {
      const baseAngle = (a / angleSteps) * TAU + rng() * (TAU / angleSteps);
      for (const pw of powers) {
        const sim = cloneWorld(w);
        const ok = launch(sim, u.id, Math.cos(baseAngle), Math.sin(baseAngle), pw);
        if (ok) {
          runTurnToEnd(sim);
          const after = snapshot(sim);
          let s = scoreOutcome(before, after, sim, side);
          // A charged hero that wastes its ability on a weak shot is a loss.
          if (u.charged) s += 60;
          s += (rng() - 0.5) * 240 * (1 - skill);
          if (s > bestScore) {
            bestScore = s;
            best = { unitId: u.id, angle: baseAngle, power: pw, score: s };
          }
        }
        done++;
        if (done % 6 === 0) yield done / total;
      }
    }
  }

  if (!best) {
    const u = launchers[0];
    const a = rng() * TAU;
    return { unitId: u.id, dirX: Math.cos(a), dirY: Math.sin(a), power: 0.8 };
  }

  // Weaker rivals shake the aim and feather the power.
  const noise = (1 - skill) * 0.34;
  const angle = best.angle + (rng() - 0.5) * noise;
  const power = clamp(best.power * (1 - (rng() * noise * 0.5)), 0.28, 1);

  return { unitId: best.unitId, dirX: Math.cos(angle), dirY: Math.sin(angle), power, score: best.score };
}

// Blocking convenience wrapper (used by the practice arena's auto-play).
export function planShotSync(w, side, skill = 0.6, seed = 1) {
  const it = planShot(w, side, skill, seed);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
