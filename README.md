# 🌻 Sunny Acres

*Be a strong independent American farmer.*

A pocket farming game for iPhone, in the mould of Hay Day and Township. Plant
crops, raise animals, craft goods, fill orders, and level up to unlock the next
stage of the farm.

No build step, no dependencies, no network calls at runtime — it's plain HTML,
CSS and ES modules. Your farm saves to the phone itself.

## Play it on your iPhone

**Open the link, and that's it.** The game is published here:

> https://claude.ai/code/artifact/2dd99825-f20d-4082-bfce-d65aa0cb1aca

Open it in Safari on your phone and start farming. Nothing to install, nothing
to configure. Your farm saves on the phone, so come back to the same link.

### Other ways to run it

**Add it to your home screen.** In Safari, tap *Share → Add to Home Screen*. It
then opens full-screen like a real app, with no browser bar.

**One file, no internet.** `dist/sunny-acres.html` is the whole game in a single
file — CSS, code and icon inlined. Double-click it, AirDrop it to your phone,
email it to yourself, drop it on any web host. It needs no server at all.

**The multi-file version** (`index.html` + `js/`) needs a real web server,
because browsers refuse to load ES modules from `file://`:

```sh
npx http-server -p 8080 -c-1     # then open http://localhost:8080
```

**GitHub Pages**, if you want your own URL: repo *Settings → Pages → Build and
deployment → Source: **GitHub Actions***. The included workflow does the rest,
and that version installs to the home screen with its proper icon.

## How to play

The **Farm tab is a map of your land** — fields, animal pens, the silo, barn,
workshops and store all sit on it. Tap the thing itself: soil to sow, a ripe
crop to pull it, a hungry animal to feed it, a building to go inside. Red dots
appear over anything waiting on you.

| Tab | What you do there |
| --- | --- |
| 🌾 **Farm** | The map. Plant and harvest by tapping soil; the seed rack sits under it. |
| 🐔 **Animals** | Buy animals, feed them, collect eggs, milk, bacon, wool and honey. |
| 🏭 **Craft** | Build workshops and turn raw goods into far more valuable ones. |
| 📋 **Orders** | Fill a customer's crate for ~40% more than the goods are worth, plus XP. |
| 🏆 **Goals** | Daily bonus streak, plus six tiered goals that pay out coins and gems. |
| 🛒 **Shop** | Boosts, the market, land, storage and permanent upgrades. |

The core loop: **grow → process → sell/deliver → level up → unlock more**.

- **Coins** 🪙 buy seeds, animals, workshops, land and upgrades.
- **Gems** 💎 skip any timer. You earn them from levelling and the odd order.
- **XP** comes from harvesting, collecting, crafting and — mostly — orders.
- **Storage is the real constraint.** The silo holds crops, the barn holds
  goods. Both fill fast; expanding them is one of the best early buys.
- **Prices move.** Every good drifts between roughly 0.7x and 1.3x of its base
  value on its own slow cycle. The sell list shows ▲ or ▼ against each item, so
  holding a full silo until it swings green is worth real money.
- **Goals and the daily bonus** pay out on top of everything else. The streak
  resets if you skip a day and maxes out at seven.

### The Harvest Festival

A festival is always running. The clock is cut into six-hour cycles, and each
one gives you a fresh points bar with three milestones — Warm-Up, Main Stage
and Grand Prize. Points come from ordinary play (1 per crop harvested, 2 per
animal good, 4 per craft, 15 per order), so you are never asked to do anything
special; the prizes scale with your level and get large fast. Claim as you go,
because the bar resets when the next festival starts.

### Boosts

The shop sells six timed boosts — these are the profit levers, and buying one
again just adds more time to the clock:

| Boost | Effect | Runs for |
| --- | --- | --- |
| ☕ Farmhand Coffee | Crops ripen 2x faster | 30 min |
| 💰 Market Day | Everything sells for +50% | 20 min |
| 🌟 Feed Frenzy | Animals produce 2x faster | 30 min |
| ⚡ Rush Order | Workshops craft 2x faster | 30 min |
| 📘 Farm School | Double XP | 30 min |
| 🍀 Lucky Clover | Order payouts +50% | 20 min |

They stack with each other and with the permanent upgrades, and anything
running shows a countdown in the top bar. The play is to line them up: brew a
Market Day, then dump a silo that's already swung green.

Timers are stored as timestamps, so crops keep growing and machines keep
working while the app is closed.

## Settings

Tap your farmer, then **Settings**: sound effects, vibration, animations (turn
this off and confetti, bounces and floating numbers all stop), larger text, and
a confirm-before-Sell-All safety toggle. The game also honours the system's
reduce-motion preference on its own.

Tapping any item icon — in the sell list, in a recipe, in a workshop — opens a
detail card: how many you hold, what it sells for right now against its base
value, today's market swing, the XP it gives, where it comes from, and what it
can be made into. Those "used to make" chips are tappable, so you can walk a
production chain end to end.

## Saves

Three save slots, picked from the title screen. Each is a separate farm with its
own level, coins and land; deleting one leaves the others alone. Slot 1 uses the
original storage key, so a farm from an earlier build still loads.

The game autosaves constantly — there's nothing to press. To move a farm to
another phone, open your farmer (tap the avatar) → **Move this farm to another
device**, copy the code, and paste it into **Load from a code** on the title
screen of the other device. The farm you copied from is left untouched.

### Progression

Every level opens something new. 13 crops, 7 animals, 12 workshops, 22 craftable
goods, 24 fields, and 8 permanent upgrades that make the grind disappear:

| Level | Upgrade | What it does |
| --- | --- | --- |
| 5 | 🪣 Watering Can | Crops grow 10% faster |
| 9 | 🥫 Auto Feeder | Animals feed themselves from the barn |
| 12 | 💦 Sprinkler Rig | Another 20% off crop timers |
| 15 | 🪄 Golden Scythe | +25% on everything you sell |
| 17 | 🚚 Delivery Truck | +30% order payouts, orders refresh twice as fast |
| 20 | 🚜 Tractor | Plant All fills every field in one tap, free |
| 24 | 🧑‍🔧 Farm Foreman | +3 craft queue slots, 20% faster crafting |
| 27 | 🌾 Combine | Ripe crops harvest themselves |

Titles track your level too: Sprout → Field Hand → Homesteader → Rancher →
Master Grower → Estate Owner → Agri-Baron → Farm Legend.

## Project layout

```
index.html              app shell
css/style.css           all styling
js/data.js              crops, animals, recipes, upgrades, economy curves
js/state.js             the save file and every read/write against it
js/game.js              player actions + the world clock
js/map.js               the farm map: fields, pens, buildings, decoration
js/fx.js                confetti, button pops, floating numbers
js/ui.js                views, panels and sheets
js/main.js              boot, onboarding, heartbeat
js/audio.js             WebAudio blips (no asset files)
js/util.js              formatting helpers
sw.js                   offline cache
scripts/make-icons.mjs  regenerates icons/*.png
scripts/build-single.mjs bundles everything into dist/
```

`dist/` is generated — rebuild it after any change to the game:

```sh
node scripts/build-single.mjs
```

Tuning the game means editing `js/data.js` — grow times, prices, XP curve,
unlock levels and upgrade costs all live there.

To regenerate the app icons after changing the artwork:

```sh
node scripts/make-icons.mjs
```

## Notes

- Saves live in `localStorage` (`sunnyacres.save.v1`, `…slot2`, `…slot3`), on
  that device only. Clearing Safari's website data wipes them, so use a transfer
  code if a farm matters to you.
- After changing any game file, bump `CACHE` in `sw.js` so installed phones
  pick up the new build.
