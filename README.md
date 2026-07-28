# 🌻 Sunny Acres

*Be a strong independent American farmer.*

A pocket farming game for iPhone, in the mould of Hay Day and Township. Plant
crops, raise animals, craft goods, fill orders, and level up to unlock the next
stage of the farm.

No build step, no dependencies, no network calls at runtime — it's plain HTML,
CSS and ES modules. Your farm saves to the phone itself.

## Play it on your iPhone

1. **Turn on GitHub Pages** — repo *Settings → Pages → Build and deployment →
   Source: **GitHub Actions***. The included workflow publishes on every push
   to the game branch.
2. Open the published URL in **Safari** on your phone.
3. Tap **Share → Add to Home Screen**. It then launches full-screen with its own
   icon, no browser chrome, and works without signal.

Prefer to try it on a laptop first? From the repo root:

```sh
npx http-server -p 8080 -c-1
# then open http://localhost:8080 — use the browser's device toolbar for a phone-sized view
```

An `index.html` opened straight off the disk (`file://`) will **not** work —
ES modules need a real server. Any static server will do.

## How to play

| Tab | What you do there |
| --- | --- |
| 🌾 **Farm** | Pick a seed, tap a field to plant. Tap again when it says **TAP!** to harvest. |
| 🐔 **Animals** | Buy animals, feed them, collect eggs, milk, bacon, wool and honey. |
| 🏭 **Craft** | Build workshops and turn raw goods into far more valuable ones. |
| 📋 **Orders** | Fill a customer's crate for ~40% more than the goods are worth, plus XP. |
| 🛒 **Shop** | Sell from storage, clear new fields, expand the silo and barn, buy upgrades. |

The core loop: **grow → process → sell/deliver → level up → unlock more**.

- **Coins** 🪙 buy seeds, animals, workshops, land and upgrades.
- **Gems** 💎 skip any timer. You earn them from levelling and the odd order.
- **XP** comes from harvesting, collecting, crafting and — mostly — orders.
- **Storage is the real constraint.** The silo holds crops, the barn holds
  goods. Both fill fast; expanding them is one of the best early buys.

Timers are stored as timestamps, so crops keep growing and machines keep
working while the app is closed.

### Progression

Every level opens something new. 8 crops, 5 animals, 8 workshops, 14 craftable
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
js/ui.js                views and rendering
js/main.js              boot, onboarding, heartbeat
js/audio.js             WebAudio blips (no asset files)
js/util.js              formatting helpers
sw.js                   offline cache
scripts/make-icons.mjs  regenerates icons/*.png
```

Tuning the game means editing `js/data.js` — grow times, prices, XP curve,
unlock levels and upgrade costs all live there.

To regenerate the app icons after changing the artwork:

```sh
node scripts/make-icons.mjs
```

## Notes

- Saves live in `localStorage` under `sunnyacres.save.v1`, on that device only.
  Clearing Safari's website data wipes the farm. Profile → *Start a new farm*
  does the same on purpose.
- After changing any game file, bump `CACHE` in `sw.js` so installed phones
  pick up the new build.
