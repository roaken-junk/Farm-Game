// ============================================================================
// Battle world: pure data + pure functions.
//
// Nothing in here touches the DOM or canvas. That is deliberate — the AI runs
// this exact code to look one turn into the future, so what it predicts is
// literally what will happen. Rendering just reads the state and drains
// `world.events`.
// ============================================================================

import { ARENA_BY_ID, ARENA_W, ARENA_H, spawnPoints } from '../data/arenas.js';
import { HERO_BY_ID, heroStats } from '../data/heroes.js';
import { makeRng } from '../core/rng.js';
import { clamp, len, norm, dist } from '../core/math.js';

export const MAX_LAUNCH_SPEED = 1450;
export const MIN_LAUNCH_SPEED = 260;
export const REF_SPEED = 900;
export const MAX_DRAG = 340;          // virtual units of pull for full power
export const STOP_SPEED = 14;
export const WALL_BOUNCE = 0.84;
export const UNIT_BOUNCE = 0.95;
export const RAGE_MAX = 100;
export const TURN_LIMIT = 60;         // after this, the arena starts collapsing
export const SIM_TIMEOUT = 14;        // virtual seconds before a turn is force-ended

/* -------------------------------------------------------------------------- */
/* construction                                                               */
/* -------------------------------------------------------------------------- */

let nextId = 1;

export function createWorld({ arenaId, teams, seed = 1234, firstTurn = 0 }) {
  const arena = ARENA_BY_ID[arenaId] || ARENA_BY_ID.courtyard;
  const rng = makeRng(seed);
  const world = {
    arenaId: arena.id,
    friction: arena.friction,          // fraction of speed retained per second
    hazards: arena.hazards.map((h) => ({ ...h, pulse: 0 })),
    units: [],
    projectiles: [],
    turn: firstTurn,
    turnCount: 0,
    phase: 'aim',
    activeId: null,
    firstHitDone: false,
    stopResolved: true,
    winner: null,
    time: 0,
    simTime: 0,
    events: [],
    quiet: false,
    seed,
    _rngState: rng.state(),
    collapse: 0,
  };

  teams.forEach((team, side) => {
    const pts = spawnPoints(side);
    team.forEach((member, i) => {
      const hero = HERO_BY_ID[member.heroId];
      if (!hero) return;
      const st = heroStats(member.heroId, member.level);
      const p = pts[i % pts.length];
      world.units.push({
        id: nextId++,
        side,
        slot: i,
        heroId: hero.id,
        abilityId: hero.ability.id,
        level: member.level,
        x: p.x, y: p.y, vx: 0, vy: 0,
        r: st.radius,
        mass: hero.weight,
        hp: st.hp, hpMax: st.hp,
        atk: st.atk,
        // Moving second is a real edge — you get to answer their positioning.
        // The side that opens starts with a slice of rage as compensation.
        rage: side === firstTurn ? 18 : 0,
        charged: false,
        alive: true,
        falling: 0,
        frozen: 0,
        brittle: 1,
        shield: 0, shieldTurns: 0,
        burn: 0, burnTick: 0,
        leech: 0,
        slick: 0,
        dmgMul: 1,
        pierce: 0,
        spin: 0,
        onSpike: false,
      });
    });
  });

  return world;
}

// Fast structural clone. Much quicker than structuredClone for the AI's
// hundreds of speculative rollouts.
export function cloneWorld(w) {
  return {
    ...w,
    hazards: w.hazards.map((h) => ({ ...h })),
    units: w.units.map((u) => ({ ...u })),
    projectiles: w.projectiles.map((p) => ({ ...p })),
    events: [],
    quiet: true,
  };
}

const rngFor = (w) => {
  const r = makeRng(0);
  r.setState(w._rngState);
  return r;
};
const saveRng = (w, r) => { w._rngState = r.state(); };

function emit(w, ev) {
  if (!w.quiet) w.events.push(ev);
}

/* -------------------------------------------------------------------------- */
/* queries                                                                    */
/* -------------------------------------------------------------------------- */

export const unitById = (w, id) => w.units.find((u) => u.id === id);
export const aliveOf = (w, side) => w.units.filter((u) => u.side === side && u.alive);
export const enemiesOf = (w, side) => w.units.filter((u) => u.side !== side && u.alive);

export function legalLaunchers(w, side) {
  return w.units.filter((u) => u.side === side && u.alive && u.frozen <= 0);
}

export function teamHp(w, side) {
  return aliveOf(w, side).reduce((s, u) => s + u.hp, 0);
}

export function settled(w) {
  if (w.projectiles.length) return false;
  for (const u of w.units) {
    if (!u.alive) continue;
    if (u.falling > 0) return false;
    if (len(u.vx, u.vy) > STOP_SPEED) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* launching                                                                  */
/* -------------------------------------------------------------------------- */

export function launch(w, unitId, dirX, dirY, power01) {
  const u = unitById(w, unitId);
  if (!u || !u.alive || u.frozen > 0) return false;
  if (w.phase !== 'aim') return false;

  const [nx, ny] = norm(dirX, dirY);
  const speed = MIN_LAUNCH_SPEED + clamp(power01, 0, 1) * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED);

  u.vx = nx * speed;
  u.vy = ny * speed;
  u.spin = (nx * 0.6 + ny * 0.2) * speed * 0.004;

  w.activeId = u.id;
  w.firstHitDone = false;
  w.phase = 'sim';
  w.simTime = 0;
  w.stopResolved = false;

  // per-turn modifiers reset
  u.leech = 0; u.slick = 0; u.dmgMul = 1; u.pierce = 0;

  const useAbility = u.charged;
  u.usingAbility = useAbility;
  if (useAbility) {
    u.charged = false;
    u.rage = 0;
    const hero = HERO_BY_ID[u.heroId];
    emit(w, { type: 'abilityCast', x: u.x, y: u.y, unit: u.id, heroId: u.heroId, name: hero.ability.name, jp: hero.ability.jp });
    applyLaunchAbility(w, u, hero.ability, nx, ny, speed);
  }

  emit(w, { type: 'launch', x: u.x, y: u.y, unit: u.id, power: clamp(power01, 0, 1), dirX: nx, dirY: ny, special: useAbility });
  return true;
}

function applyLaunchAbility(w, u, ab, nx, ny, speed) {
  switch (ab.id) {
    case 'arrow':
      u.slick = ab.friction;
      u.dmgMul = ab.dmgMul;
      break;
    case 'clones': {
      for (let i = 0; i < ab.count; i++) {
        const sign = i % 2 === 0 ? 1 : -1;
        const step = Math.ceil((i + 1) / 2);
        const a = Math.atan2(ny, nx) + sign * ab.spread * step;
        w.projectiles.push({
          id: nextId++, kind: 'clone', owner: u.id, side: u.side, heroId: u.heroId,
          x: u.x + Math.cos(a) * (u.r + 6), y: u.y + Math.sin(a) * (u.r + 6),
          vx: Math.cos(a) * speed * 0.92, vy: Math.sin(a) * speed * 0.92,
          r: u.r * 0.72, dmg: u.atk * ab.dmgMul, ttl: 2.6, target: null, hits: [],
        });
      }
      break;
    }
    case 'vampire':
      u.leech = ab.leech;
      break;
    case 'pierce':
      u.pierce = 1;
      break;
    default:
      // onFirstHit / onStop abilities are handled elsewhere; flag stays on the unit.
      break;
  }
}

/* -------------------------------------------------------------------------- */
/* stepping                                                                   */
/* -------------------------------------------------------------------------- */

export function step(w, dt) {
  if (w.phase !== 'sim') return;
  w.time += dt;
  w.simTime += dt;

  integrate(w, dt);

  for (const h of w.hazards) h.pulse = Math.max(0, h.pulse - dt * 2.2);

  if (w.simTime > SIM_TIMEOUT) {
    for (const u of w.units) { u.vx = 0; u.vy = 0; }
    w.projectiles.length = 0;
  }

  if (settled(w)) {
    if (!w.stopResolved) {
      w.stopResolved = true;
      resolveStopAbility(w);
      if (!settled(w)) return;   // ability spawned projectiles / knockback
    }
    finishTurn(w);
  }
}

function integrate(w, dt) {
  // --- units ---
  for (const u of w.units) {
    if (!u.alive) continue;

    if (u.falling > 0) {
      u.falling += dt * 2.4;
      u.vx *= 0.86; u.vy *= 0.86;
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (u.falling >= 1) {
        u.alive = false;
        u.hp = 0;
        u.vx = u.vy = 0;
        emit(w, { type: 'ko', x: u.x, y: u.y, unit: u.id, side: u.side, heroId: u.heroId, cause: 'pit' });
      }
      continue;
    }

    const speed = len(u.vx, u.vy);
    if (speed > 0) {
      const retain = u.slick ? Math.max(w.friction, u.slick) : w.friction;
      const f = Math.pow(retain, dt);
      u.vx *= f; u.vy *= f;
      if (len(u.vx, u.vy) < STOP_SPEED) { u.vx = 0; u.vy = 0; u.spin *= 0.5; }
    }
    u.spin *= Math.pow(0.2, dt);

    u.x += u.vx * dt;
    u.y += u.vy * dt;

    bounceWalls(w, u);
  }

  resolveUnitCollisions(w);
  resolveHazards(w, dt);
  stepProjectiles(w, dt);
}

function bounceWalls(w, u) {
  let hit = 0;
  if (u.x - u.r < 0) { u.x = u.r; u.vx = -u.vx * WALL_BOUNCE; hit = Math.abs(u.vx); }
  else if (u.x + u.r > ARENA_W) { u.x = ARENA_W - u.r; u.vx = -u.vx * WALL_BOUNCE; hit = Math.abs(u.vx); }
  if (u.y - u.r < 0) { u.y = u.r; u.vy = -u.vy * WALL_BOUNCE; hit = Math.max(hit, Math.abs(u.vy)); }
  else if (u.y + u.r > ARENA_H) { u.y = ARENA_H - u.r; u.vy = -u.vy * WALL_BOUNCE; hit = Math.max(hit, Math.abs(u.vy)); }
  if (hit > 180) emit(w, { type: 'wall', x: u.x, y: u.y, power: clamp(hit / REF_SPEED, 0, 1) });
}

function resolveUnitCollisions(w) {
  const us = w.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    if (!a.alive || a.falling > 0) continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      if (!b.alive || b.falling > 0) continue;

      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;

      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;

      // positional de-overlap weighted by mass
      const overlap = rr - d;
      const totalMass = a.mass + b.mass;
      a.x -= nx * overlap * (b.mass / totalMass);
      a.y -= ny * overlap * (b.mass / totalMass);
      b.x += nx * overlap * (a.mass / totalMass);
      b.y += ny * overlap * (a.mass / totalMass);

      const avn = a.vx * nx + a.vy * ny;
      const bvn = b.vx * nx + b.vy * ny;
      const approach = avn - bvn;
      if (approach <= 0) continue;

      // 1D elastic impulse along the normal
      const imp = ((1 + UNIT_BOUNCE) * approach) / totalMass;
      a.vx -= imp * b.mass * nx; a.vy -= imp * b.mass * ny;
      b.vx += imp * a.mass * nx; b.vy += imp * a.mass * ny;

      a.spin += approach * 0.0016 * (ny > 0 ? 1 : -1);
      b.spin -= approach * 0.0016 * (ny > 0 ? 1 : -1);

      const impact = clamp(approach / REF_SPEED, 0, 1.7);
      const hx = a.x + nx * a.r, hy = a.y + ny * a.r;

      if (a.side === b.side) {
        // friendly bumps push but never hurt
        emit(w, { type: 'bump', x: hx, y: hy, power: impact });
        continue;
      }

      const aShare = Math.abs(avn) / (Math.abs(avn) + Math.abs(bvn) + 1e-6);
      const preSpeedA = len(a.vx, a.vy);

      const dmgToB = a.atk * impact * aShare * a.dmgMul;
      const dmgToA = b.atk * impact * (1 - aShare) * b.dmgMul;

      const attacker = dmgToB >= dmgToA ? a : b;
      const defender = attacker === a ? b : a;

      if (dmgToB > 1) applyHit(w, a, b, dmgToB, hx, hy, impact);
      if (dmgToA > 1) applyHit(w, b, a, dmgToA, hx, hy, impact);

      emit(w, { type: 'clash', x: hx, y: hy, power: impact, a: attacker.id, b: defender.id });

      // first-impact abilities fire once per turn, for the launched hero only
      const active = unitById(w, w.activeId);
      if (active && active.usingAbility && !w.firstHitDone && (active === a || active === b)) {
        const other = active === a ? b : a;
        if (other.side !== active.side) {
          w.firstHitDone = true;
          resolveFirstHitAbility(w, active, other, nx, ny, preSpeedA);
        }
      }
    }
  }
}

function applyHit(w, from, to, rawDmg, hx, hy, impact) {
  let dmg = rawDmg * to.brittle;
  if (to.shieldTurns > 0) dmg *= 1 - to.shield;
  dmg = Math.round(dmg);
  if (dmg <= 0) return;

  damage(w, from, to, dmg, hx, hy, impact);

  from.rage = clamp(from.rage + dmg * 0.085, 0, RAGE_MAX);
  to.rage = clamp(to.rage + dmg * 0.05, 0, RAGE_MAX);
  refreshCharge(from); refreshCharge(to);

  if (from.leech > 0) {
    const healed = Math.round(dmg * from.leech);
    from.hp = Math.min(from.hpMax, from.hp + healed);
    emit(w, { type: 'heal', x: from.x, y: from.y, unit: from.id, amount: healed });
  }
}

function refreshCharge(u) {
  if (u.rage >= RAGE_MAX && !u.charged) {
    u.charged = true;
  }
}

// Core damage application, also used by abilities and hazards.
function damage(w, from, to, amount, hx, hy, impact = 0.6, kind = 'hit') {
  if (!to.alive) return 0;
  const dealt = Math.min(to.hp, Math.round(amount));
  to.hp -= dealt;
  emit(w, {
    type: 'damage', x: hx ?? to.x, y: hy ?? to.y, unit: to.id, side: to.side,
    amount: dealt, power: impact, kind,
  });
  if (to.hp <= 0) {
    to.hp = 0;
    to.alive = false;
    to.vx = to.vy = 0;
    emit(w, { type: 'ko', x: to.x, y: to.y, unit: to.id, side: to.side, heroId: to.heroId, cause: kind });
  }
  return dealt;
}

/* -------------------------------------------------------------------------- */
/* hazards                                                                    */
/* -------------------------------------------------------------------------- */

function resolveHazards(w, dt) {
  for (const u of w.units) {
    if (!u.alive || u.falling > 0) continue;
    let onSpikeNow = false;

    for (const h of w.hazards) {
      const d = dist(u.x, u.y, h.x, h.y);

      if (h.type === 'pit') {
        // You have to be genuinely over the hole to drop — clipping the edge
        // at speed should skim you past it, not swallow you.
        if (d < h.r * 0.5) {
          u.falling = 0.01;
          h.pulse = 1;
          emit(w, { type: 'pitfall', x: u.x, y: u.y, unit: u.id, hx: h.x, hy: h.y });
        } else if (d < h.r * 0.95) {
          // the lip tugs, but only once you are properly over the rim, and it
          // pulls a stationary hero in far harder than one flying past
          const speed = len(u.vx, u.vy);
          const grip = clamp(1 - speed / 900, 0.25, 1);
          const pull = (1 - (d - h.r * 0.5) / (h.r * 0.45)) * 175 * grip;
          const [nx, ny] = norm(h.x - u.x, h.y - u.y);
          u.vx += nx * pull * dt;
          u.vy += ny * pull * dt;
        }
      } else if (h.type === 'spike') {
        if (d < h.r + u.r * 0.7) {
          onSpikeNow = true;
          if (!u.onSpike) {
            h.pulse = 1;
            damage(w, null, u, h.dmg, u.x, u.y, 0.8, 'spike');
            emit(w, { type: 'spikeHit', x: u.x, y: u.y, unit: u.id });
          }
        }
      } else if (h.type === 'bumper') {
        const rr = h.r + u.r;
        if (d < rr && d > 0) {
          const nx = (u.x - h.x) / d, ny = (u.y - h.y) / d;
          u.x = h.x + nx * rr;
          u.y = h.y + ny * rr;
          const vn = u.vx * nx + u.vy * ny;
          if (vn < 0) {
            u.vx -= 2.1 * vn * nx;
            u.vy -= 2.1 * vn * ny;
            const boost = 150;
            u.vx += nx * boost; u.vy += ny * boost;
            h.pulse = 1;
            emit(w, { type: 'bumper', x: h.x + nx * h.r, y: h.y + ny * h.r, power: clamp(-vn / REF_SPEED, 0, 1) });
          }
        }
      }
    }
    u.onSpike = onSpikeNow;
  }
}

/* -------------------------------------------------------------------------- */
/* projectiles (clones, foxfire)                                              */
/* -------------------------------------------------------------------------- */

function stepProjectiles(w, dt) {
  const keep = [];
  for (const p of w.projectiles) {
    p.ttl -= dt;
    if (p.ttl <= 0) { emit(w, { type: 'projGone', x: p.x, y: p.y, kind: p.kind }); continue; }

    if (p.kind === 'foxfire') {
      const t = unitById(w, p.target);
      if (!t || !t.alive) {
        const alt = enemiesOf(w, p.side)[0];
        if (!alt) { emit(w, { type: 'projGone', x: p.x, y: p.y, kind: p.kind }); continue; }
        p.target = alt.id;
      }
      const tgt = unitById(w, p.target);
      const [nx, ny] = norm(tgt.x - p.x, tgt.y - p.y);
      const sp = len(p.vx, p.vy) || 500;
      p.vx = (p.vx + nx * sp * 5.5 * dt);
      p.vy = (p.vy + ny * sp * 5.5 * dt);
      const s2 = len(p.vx, p.vy);
      p.vx = (p.vx / s2) * sp; p.vy = (p.vy / s2) * sp;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x < 0 || p.x > ARENA_W || p.y < 0 || p.y > ARENA_H) {
      if (p.kind === 'clone') {
        // clones ricochet off the walls once
        if (p.x < 0 || p.x > ARENA_W) p.vx *= -1;
        if (p.y < 0 || p.y > ARENA_H) p.vy *= -1;
        p.x = clamp(p.x, 0, ARENA_W); p.y = clamp(p.y, 0, ARENA_H);
      } else {
        emit(w, { type: 'projGone', x: p.x, y: p.y, kind: p.kind });
        continue;
      }
    }

    let consumed = false;
    for (const u of w.units) {
      if (!u.alive || u.side === p.side || u.falling > 0) continue;
      if (p.hits && p.hits.includes(u.id)) continue;
      if (dist(p.x, p.y, u.x, u.y) < u.r + p.r) {
        const owner = unitById(w, p.owner);
        let dmg = p.dmg * u.brittle;
        if (u.shieldTurns > 0) dmg *= 1 - u.shield;
        damage(w, owner, u, dmg, p.x, p.y, 0.7, p.kind);
        if (owner && owner.alive) {
          owner.rage = clamp(owner.rage + dmg * 0.05, 0, RAGE_MAX);
          refreshCharge(owner);
        }
        const [kx, ky] = norm(p.vx, p.vy);
        u.vx += kx * 190; u.vy += ky * 190;
        emit(w, { type: 'projHit', x: p.x, y: p.y, kind: p.kind, unit: u.id });
        if (p.kind === 'foxfire') { consumed = true; break; }
        p.hits.push(u.id);
        p.dmg *= 0.7;
      }
    }
    if (consumed) continue;
    keep.push(p);
  }
  w.projectiles = keep;
}

/* -------------------------------------------------------------------------- */
/* abilities                                                                  */
/* -------------------------------------------------------------------------- */

function resolveFirstHitAbility(w, u, target, nx, ny, preSpeed) {
  const ab = HERO_BY_ID[u.heroId].ability;
  if (ab.trigger !== 'onFirstHit') return;

  switch (ab.id) {
    case 'pierce': {
      const extra = Math.round(u.atk * (ab.dmgMul - 1));
      let dmg = extra * target.brittle;
      if (target.shieldTurns > 0) dmg *= 1 - target.shield;
      damage(w, u, target, dmg, target.x, target.y, 1.2, 'pierce');
      // punch straight through instead of bouncing back
      const keep = preSpeed * ab.keepMomentum;
      const dirX = target.x - u.x, dirY = target.y - u.y;
      const [dx, dy] = norm(dirX, dirY);
      u.vx = dx * keep; u.vy = dy * keep;
      emit(w, { type: 'slash', x: target.x, y: target.y, angle: Math.atan2(dy, dx), unit: u.id });
      break;
    }
    case 'freeze': {
      target.frozen = ab.turns + 1;
      target.brittle = ab.brittle;
      target.vx *= 0.25; target.vy *= 0.25;
      emit(w, { type: 'freeze', x: target.x, y: target.y, unit: target.id });
      break;
    }
    case 'burn': {
      target.burn = ab.turns;
      target.burnTick = ab.tick;
      target.burnBlast = ab.blast;
      target.burnRadius = ab.blastRadius;
      target.burnSrc = u.id;
      emit(w, { type: 'burnApply', x: target.x, y: target.y, unit: target.id });
      break;
    }
    case 'chain': {
      let from = target;
      const hitIds = [target.id];
      for (let i = 0; i < ab.jumps; i++) {
        const cands = enemiesOf(w, u.side)
          .filter((e) => !hitIds.includes(e.id))
          .map((e) => ({ e, d: dist(from.x, from.y, e.x, e.y) }))
          .filter((c) => c.d < ab.range)
          .sort((a, b) => a.d - b.d);
        if (!cands.length) break;
        const nxt = cands[0].e;
        emit(w, { type: 'lightning', x1: from.x, y1: from.y, x2: nxt.x, y2: nxt.y });
        let dmg = ab.dmg * nxt.brittle;
        if (nxt.shieldTurns > 0) dmg *= 1 - nxt.shield;
        damage(w, u, nxt, dmg, nxt.x, nxt.y, 0.9, 'lightning');
        hitIds.push(nxt.id);
        from = nxt;
      }
      break;
    }
    case 'vampire':
      // handled as a per-turn leech modifier set at launch
      break;
    default:
      break;
  }
}

function resolveStopAbility(w) {
  const u = unitById(w, w.activeId);
  if (!u || !u.usingAbility || !u.alive) { clearTurnFlags(w); return; }
  const ab = HERO_BY_ID[u.heroId].ability;
  if (ab.trigger !== 'onStop') { clearTurnFlags(w); return; }

  switch (ab.id) {
    case 'nova': {
      emit(w, { type: 'nova', x: u.x, y: u.y, r: ab.radius, color: HERO_BY_ID[u.heroId].art.aura });
      for (const e of enemiesOf(w, u.side)) {
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < ab.radius + e.r) {
          const falloff = clamp(1 - (d / (ab.radius + e.r)) * 0.45, 0.5, 1);
          let dmg = ab.dmg * falloff * e.brittle;
          if (e.shieldTurns > 0) dmg *= 1 - e.shield;
          damage(w, u, e, dmg, e.x, e.y, 1, 'nova');
          const [nx, ny] = norm(e.x - u.x, e.y - u.y);
          e.vx += nx * 260; e.vy += ny * 260;
        }
      }
      break;
    }
    case 'quake': {
      emit(w, { type: 'quake', x: u.x, y: u.y, r: ab.radius });
      for (const e of enemiesOf(w, u.side)) {
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < ab.radius + e.r) {
          let dmg = ab.dmg * e.brittle;
          if (e.shieldTurns > 0) dmg *= 1 - e.shield;
          damage(w, u, e, dmg, e.x, e.y, 1.1, 'quake');
          const [nx, ny] = norm(e.x - u.x || 0.01, e.y - u.y || 0.01);
          const push = ab.knock * (1 - (d / (ab.radius + e.r)) * 0.5) / e.mass;
          e.vx += nx * push; e.vy += ny * push;
        }
      }
      break;
    }
    case 'heal': {
      emit(w, { type: 'bloom', x: u.x, y: u.y, r: 320 });
      for (const a of aliveOf(w, u.side)) {
        const before = a.hp;
        a.hp = Math.min(a.hpMax, a.hp + ab.heal);
        if (a.hp > before) emit(w, { type: 'heal', x: a.x, y: a.y, unit: a.id, amount: a.hp - before });
      }
      break;
    }
    case 'shield': {
      emit(w, { type: 'ward', x: u.x, y: u.y, r: 340 });
      for (const a of aliveOf(w, u.side)) {
        a.shield = ab.reduce;
        a.shieldTurns = ab.turns * 2; // counted in half-turns (both sides act)
        emit(w, { type: 'shieldOn', x: a.x, y: a.y, unit: a.id });
      }
      break;
    }
    case 'barrage': {
      const foes = enemiesOf(w, u.side);
      if (!foes.length) break;
      const rng = rngFor(w);
      for (let i = 0; i < ab.count; i++) {
        const t = foes[i % foes.length];
        const a = (i / ab.count) * Math.PI * 2 + rng() * 0.4;
        w.projectiles.push({
          id: nextId++, kind: 'foxfire', owner: u.id, side: u.side, heroId: u.heroId,
          x: u.x + Math.cos(a) * (u.r + 10), y: u.y + Math.sin(a) * (u.r + 10),
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          r: 17, dmg: ab.dmg, ttl: 3.4 + i * 0.06, target: t.id, hits: null,
        });
      }
      saveRng(w, rng);
      emit(w, { type: 'foxfireCast', x: u.x, y: u.y });
      break;
    }
    default:
      break;
  }
  clearTurnFlags(w);
}

function clearTurnFlags(w) {
  const u = unitById(w, w.activeId);
  if (u) u.usingAbility = false;
}

/* -------------------------------------------------------------------------- */
/* turn lifecycle                                                             */
/* -------------------------------------------------------------------------- */

function finishTurn(w) {
  // burning targets tick at the end of every turn
  for (const u of w.units) {
    if (!u.alive || u.burn <= 0) continue;
    damage(w, unitById(w, u.burnSrc), u, u.burnTick, u.x, u.y, 0.7, 'burn');
    emit(w, { type: 'burnTick', x: u.x, y: u.y, unit: u.id });
    u.burn -= 1;
    if (u.burn <= 0 && u.alive) {
      emit(w, { type: 'inferno', x: u.x, y: u.y, r: u.burnRadius || 240 });
      const src = unitById(w, u.burnSrc);
      const side = src ? src.side : 1 - u.side;
      for (const e of w.units) {
        if (!e.alive || e.side === side) continue;
        if (dist(u.x, u.y, e.x, e.y) < (u.burnRadius || 240) + e.r) {
          damage(w, src, e, u.burnBlast || 260, e.x, e.y, 1.2, 'inferno');
        }
      }
    }
  }

  // shields and freezes decay
  for (const u of w.units) {
    if (u.shieldTurns > 0) {
      u.shieldTurns -= 1;
      if (u.shieldTurns === 0) { u.shield = 0; emit(w, { type: 'shieldOff', unit: u.id, x: u.x, y: u.y }); }
    }
  }

  w.turnCount += 1;

  // sudden death: the arena starts to come apart
  if (w.turnCount > TURN_LIMIT) {
    w.collapse += 1;
    const tick = 90 + w.collapse * 30;
    emit(w, { type: 'collapse', amount: tick });
    for (const u of w.units) {
      if (u.alive) damage(w, null, u, tick, u.x, u.y, 0.6, 'collapse');
    }
  }

  checkWinner(w);
  if (w.winner !== null) {
    w.phase = 'over';
    emit(w, { type: 'battleEnd', winner: w.winner });
    return;
  }

  // pass the turn, thawing anyone whose ice has expired
  w.turn = 1 - w.turn;
  const side = w.turn;
  for (const u of w.units) {
    if (u.side !== side) continue;
    if (u.frozen > 0) {
      u.frozen -= 1;
      if (u.frozen <= 0) { u.brittle = 1; emit(w, { type: 'thaw', unit: u.id, x: u.x, y: u.y }); }
    }
    u.rage = clamp(u.rage + 6, 0, RAGE_MAX);
    refreshCharge(u);
  }

  // everyone on this side frozen solid? skip and thaw them all
  if (legalLaunchers(w, side).length === 0) {
    for (const u of aliveOf(w, side)) { u.frozen = 0; u.brittle = 1; }
    emit(w, { type: 'turnSkipped', side });
    w.turn = 1 - w.turn;
    w.turnCount += 1;
  }

  w.activeId = null;
  w.phase = 'aim';
  emit(w, { type: 'turnStart', side: w.turn, turn: w.turnCount });
}

function checkWinner(w) {
  const a = aliveOf(w, 0).length;
  const b = aliveOf(w, 1).length;
  if (a === 0 && b === 0) w.winner = 0;
  else if (b === 0) w.winner = 0;
  else if (a === 0) w.winner = 1;
}

/* -------------------------------------------------------------------------- */
/* helper for the AI: run a whole turn to completion                          */
/* -------------------------------------------------------------------------- */

export function runTurnToEnd(w, dt = 1 / 60, maxSteps = 1400) {
  let n = 0;
  while (w.phase === 'sim' && n < maxSteps) {
    step(w, dt);
    n++;
  }
  if (w.phase === 'sim') {
    for (const u of w.units) { u.vx = 0; u.vy = 0; }
    w.projectiles.length = 0;
    step(w, dt);
  }
  return w;
}
