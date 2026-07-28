# 桜スマッシュ — Sakura Smash

A turn-based physics brawler for phones, in the spirit of *Smashing Four*: you and a rival each
field four heroes on a closed arena, take turns flinging them like billiard balls, and whoever
knocks out all four of the other team's heroes wins.

Everything here is original — characters, arenas, UI, music and code. The art is not drawn in a
paint program at all: every hero, chest and arena is generated at runtime from vector maths in
`src/art/`, so the whole game is a few hundred kilobytes, stays sharp on any screen density, and
loads instantly.

## Play it

It's a web game, so there is nothing to install and nothing to sign up for:

1. Open the link on your iPhone in **Safari**.
2. Tap **Share** → **Add to Home Screen**.

It now runs fullscreen with no browser chrome, keeps your progress on the device, and works with
no signal at all. Share the same link with anyone — Android and desktop work identically.

Locally:

```bash
python3 -m http.server 8000    # any static server will do
# then open http://localhost:8000
```

There is no build step. The game is plain ES modules loaded straight from disk.

## How it plays

- **Drag back from one of your heroes and release.** Pull further for more power. A dotted line
  previews the trajectory including wall bounces, and rings whoever you're about to hit.
- **Damage is force.** Whoever is moving faster into a collision deals the damage, so a hard,
  square hit hurts far more than a graze. Friendly bumps push but never hurt.
- **Turns alternate.** One hero per turn, per side. Whoever opens starts with a little rage,
  because moving second is a genuine advantage.
- **Rage powers specials.** The gold bar fills as a hero deals and takes damage. When it's full
  the hero glows and their next shot triggers their ability.
- **The arena fights too.** Pits are instant death, spikes bite, bumpers fling you. Stall past
  turn 60 and the arena starts collapsing on everyone.

## What's in it

| | |
|---|---|
| **12 heroes** | Four rarities, eleven levels each, all with a distinct special ability |
| **6 arenas** | Doubling as the trophy ladder, each with its own hazards, friction and weather |
| **12 abilities** | Pierce, shadow clones, chain lightning, foxfire barrage, freeze, burn, heal, ward, quake, nova, leech, arrow-glide |
| **Progression** | Trophies, leagues, gold, gems, chests on timers, hero cards, upgrades, a card market |
| **Modes** | Ladder vs AI, pass-and-play on one phone, practice |
| **Offline** | Service worker precaches everything; installs as a PWA |

No real money is involved anywhere — gems are earned from chests and promotions.

## Under the hood

```
src/
  core/      math, seeded RNG, save file, synthesised WebAudio
  data/      heroes, arenas, chest tables — all the tuning lives here
  game/
    world.js   the simulation: pure data + pure functions, no DOM
    ai.js      opponent brain
    profile.js progression, chests, matchmaking
  art/       procedural characters, arenas, particles, chests
  ui/        screens, and the battle loop that glues it together
tools/
  make-icons.mjs    renders the PWA icons (hand-rolled PNG encoder)
  bundle.mjs        flattens src/ into one self-contained HTML file
  check-imports.mjs verifies every import resolves to a real export
  art-preview.html  a contact sheet of every hero, for art iteration
```

```bash
node tools/check-imports.mjs   # catches a missing export before the page loads
```

Two decisions shape the rest:

**The simulation is pure.** `world.js` never touches the DOM. It takes state and a timestep and
returns new state plus a list of events. Rendering only reads that state and drains the events.

**The AI plays the real game.** Rather than heuristics that approximate the physics, the opponent
clones the world, tries a fan of candidate shots, runs each one to a complete stop through the
same engine the player uses, and scores the resulting board — damage, kills, losses, rage gained,
and positional risk like sitting on the lip of a pit. Because it's the same code, what it predicts
is exactly what happens. Difficulty is how many candidates it may consider and how much noise it
adds to its aim, which gives a smooth ramp from the first rival to the last. The search is a
generator, sliced across animation frames, so the UI never stutters while it thinks.

The music is synthesised live from oscillators on a *yo* scale — the Japanese pentatonic — with a
taiko hit on the off-beat during battles. No audio files.

## Balance

Balance was tuned by running whole matches headlessly — AI versus AI across every arena — and
reading back turn counts, knockout causes and ability usage. That's how the pits got smaller (they
were causing 81% of all knockouts) and how the opening-rage compensation arrived (moving second was
winning 70% of mirror matches; it's even now). Matches land between roughly 10 and 30 turns
depending on how hazardous the arena is.

## Running on older phones

The game targets a wide range of devices, so it avoids anything that would hard-fail
on an older iOS Safari and treats every optional subsystem as optional:

- No `structuredClone` (added in Safari 15.4) — the save file is cloned via JSON.
- `ctx.roundRect` (Safari 16.4) has an `arcTo` fallback.
- Audio, storage, haptics and the service worker can each fail completely without
  stopping the game; audio in particular must never block startup.
- No `window.prompt`, which sandboxed frames silently ignore.

If boot does fail, the loading screen shows the reason instead of hanging.

## Deploying

Pushes to `main` publish to GitHub Pages via `.github/workflows/deploy.yml`. Enable it once under
**Settings → Pages → Source → GitHub Actions**, and the game is live at
`https://<user>.github.io/<repo>/`.

Regenerate the icons after changing the crest:

```bash
node tools/make-icons.mjs
```

## The single-file build

`dist/sakura-smash.html` is the whole game flattened into one HTML file — every
module, all the CSS, no network requests. Useful when a host only accepts a single
file, or for handing the game to someone directly over AirDrop or email.

```bash
node tools/bundle.mjs                  # regenerate after changing anything in src/
node tools/bundle.mjs path/to/out.html
```

It is a committed build artifact, so re-run the bundler when the source changes.
The single-file build drops the service worker (there is nothing to precache when
the page *is* the app), so it does not install as an offline PWA — use the normal
multi-file deploy for that.
