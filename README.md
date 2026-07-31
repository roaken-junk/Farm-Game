# 🌻 Sunny Acres

*Be a strong independent American farmer.*

A pocket farming game for iPhone, in the mould of Hay Day and Township. Plant
crops, raise animals, craft goods, fill orders, and level up to unlock the next
stage of the farm.

No build step, no dependencies, no network calls at runtime — it's plain HTML,
CSS and ES modules. Your farm saves to the phone itself, in two places at once,
and restores itself if either one is lost. See [Saves](#saves).

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

The **Farm tab is your growing land, and nothing else** — a grid of large
fields with the silo and barn above them. Animals, workshops and the store each
have their own tab, which keeps the scene about crops and lets the plots be big
enough to read at arm's length.

Every field and every pen wears the same **fill bar** along its bottom edge,
with the countdown sitting on top of it. The bar creeps left to right and turns
gold and full the moment the tile is ready, so the state of the whole farm reads
in one glance. The crop or animal fills its tile at a constant size — it used to
scale up as the timer ran down, which read as jitter rather than as growth.
Sowing drops the seed in with a puff of soil; harvesting pops the crop out of
the ground and sends it flying to the silo.

When levelling opens a seed you have never planted, its chip in the rack wears a
**NEW** flag and the Farm tab carries a badge, so a new crop never slips by
unnoticed. Picking the seed up clears both.

| Tab | What you do there |
| --- | --- |
| 🌾 **Farm** | The field grid. Plant and harvest by tapping soil; the seed rack sits under it. |
| 🐓 **Animals** | Buy animals and collect eggs, milk, bacon, wool and honey. They feed themselves. |
| 🏭 **Craft** | Build workshops and turn raw goods into far more valuable ones. |
| 📋 **Orders** | Fill a customer's crate for ~40% more than the goods are worth, plus XP. |
| 🏆 **Goals** | Daily bonus streak, plus six tiered goals that pay out coins and gems. |
| 🕹️ **Arcade** | Three mini-games in the back of the barn. They pay gems. |
| 🛒 **Shop** | Boosts, the market, land, storage and permanent upgrades. |

The core loop: **grow → process → sell/deliver → level up → unlock more**.

- **Coins** 🪙 buy seeds, animals, workshops, land and upgrades.
- **Gems** 💎 skip any timer. You earn them from levelling and the odd order.
- **XP** comes from harvesting, collecting, crafting and — mostly — orders.
- **Storage is the real constraint.** The silo holds crops, the barn holds
  goods. Both fill fast; the first expansions are pocket change and the last
  ones are serious money.
- **Prices move.** Every good drifts between roughly 0.7x and 1.3x of its base
  value on its own slow cycle. The sell list shows ▲ or ▼ against each item, so
  holding a full silo until it swings green is worth real money.
- **Goals and the daily bonus** pay out on top of everything else. The streak
  resets if you skip a day and maxes out at seven.

### Feeding animals

Animals eat from one shared **trough** and feed themselves — there is nothing to
tap, and no need to hand fields over to growing animal feed. The trough fills
three ways:

- **Grazing** — free and automatic. Grass regrows on its own up to 60% of the
  trough, so a small barnyard can run indefinitely without you doing anything.
- **Hay bales** — 🪙240 for 20 feed, bought from the Animals tab or the Shop.
  This is the "I'd rather spend coins than fields" option, and it is priced to
  be clearly worth it.
- **The Feed Mill** — wheat + corn into 6 feed a batch. Best value per unit,
  and entirely optional.

Farms saved before this change have their leftover barn feed poured into the
trough on load.

### The Harvest Festival

A festival is always running. The clock is cut into six-hour cycles, and each
one gives you a fresh points bar with three milestones — Warm-Up, Main Stage
and Grand Prize. Points come from ordinary play (1 per crop harvested, 2 per
animal good, 4 per craft, 15 per order), so you are never asked to do anything
special; the prizes scale with your level and get large fast. Claim as you go,
because the bar resets when the next festival starts.

### The Barn Arcade

Three cabinets in the spirit of the old Atari machines, with the farm painted
over them. They are the only place that hands out **gems** freely, and they are
built for one thumb in portrait:

| Cabinet | Plays like | Controls |
| --- | --- | --- |
| 🌽 **Crow Patrol** | Space Invaders | Drag anywhere to slide the scarecrow — it throws kernels on its own. |
| 🐓 **Chicken Run** | Frogger | Tap the middle to hop forward, the sides to step across. |
| 🐐 **Hungry Goat** | Snake | Tap the left half to turn left, the right half to turn right. |

Swipes and arrow keys work everywhere too. Crow Patrol is open from the start;
Chicken Run unlocks at level 3 and Hungry Goat at level 5.

Each cabinet has **four score rungs**. Clear a rung during a run and it pays a
gem, so one good run beats four mediocre ones, and beating your own best always
pays an extra gem however small the run. **12 gems a day**, resetting at local
midnight — after that, coins keep paying, and they scale with your farm level,
so a late-game run is worth real money. Walking out mid-game still banks
whatever you had scored.

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

**Larger text is the default** — it is the size the game was designed to be read
at, at arm's length on a phone. Turning it off gives you the compact scale, and
that choice sticks.

Tapping any item icon — in the sell list, in a recipe, in a workshop — opens a
detail card: how many you hold, what it sells for right now against its base
value, today's market swing, the XP it gives, where it comes from, and what it
can be made into. Those "used to make" chips are tappable, so you can walk a
production chain end to end.

## Saves

Three save slots, picked from the title screen. Each is a separate farm with its
own level, coins and land; deleting one leaves the others alone. Slot 1 uses the
original storage key, so a farm from an earlier build still loads.

The game autosaves constantly — there's nothing to press.

### Not losing your farm

Everything below lives behind the farmer avatar → **🛟 Backup & Safety**, which
tells you in plain words how safe your farm currently is.

**Every save is written twice**, to `localStorage` and to IndexedDB, and a
rolling set of the last five snapshots is kept alongside them. At boot the game
checks the primary copy of each slot; if it's missing or corrupt it restores it
from the mirror, or failing that from the newest good backup, and tells you it
did. That covers the two things that actually eat saves in practice: a partial
write and a browser evicting one store but not the other.

**Add it to your home screen.** This matters more than anything else on iPhone.
Safari clears the storage of *websites* you haven't visited in seven days —
but not of pages installed to the home screen. Tap *Share → Add to Home Screen*
and the seven-day clock stops applying. The game also asks the browser for
persistent storage on first run, which some browsers grant outright.

**Backup file.** *Download backup file* saves every slot as
`sunny-acres-YYYY-MM-DD.json` to your Files/Downloads. *Restore from a file*
reads one back. This is the copy that survives a wiped phone, and it's worth
taking one after a long session.

**Transfer code.** To move a farm to another phone without a file, open your
farmer → **Move this farm to another device**, copy the code, and paste it into
**Load from a code** on the title screen of the other device. The farm you
copied from is left untouched.

### Cloud saves (sign in with Google, Apple or Facebook)

The code for this is written and wired up — `js/cloud.js` — but it ships
**switched off**, because it cannot work without two things only you can supply:

1. **A server to hold the saves.** "Sign in with Google" means exchanging a
   secret with Google's servers, and a page made of static files has nowhere to
   keep a secret. Something server-side has to complete the handshake and own
   the database.
2. **A developer account with each provider.** Google and Facebook are free to
   register. Apple charges $99/year for the developer account that Sign in with
   Apple requires.

Until it's configured the login buttons appear greyed out with an explanation,
no network call is ever made, and the game runs entirely on the device.

To switch it on, the least work is [Supabase](https://supabase.com), which hosts
both the OAuth handshake and the database and speaks plain REST — no SDK:

1. Create a free project, and copy its URL and **anon** key into `CONFIG` at the
   top of `js/cloud.js`. (The anon key is designed to be public; it is safe in
   client code. Row-level security is what protects the data.)
2. *Authentication → Providers*: switch on Google / Apple / Facebook and paste
   in the client ID and secret from each provider's console.
3. *Authentication → URL Configuration*: add the URL you host the game at.
4. Run this SQL so a player can only ever touch their own row:

   ```sql
   create table saves (
     user_id uuid references auth.users on delete cascade,
     slot    int  not null,
     data    jsonb not null,
     updated_at timestamptz default now(),
     primary key (user_id, slot)
   );
   alter table saves enable row level security;
   create policy "own saves" on saves
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```

5. Rebuild (`node scripts/build-single.mjs`) and host the result somewhere with
   a real URL — OAuth redirects back to an origin, so `file://` and the
   published artifact link can't take part.

Sync is two-way and newest-wins per slot, and the merge is a pure function
(`merge()` in `js/cloud.js`) so it can be reasoned about without a network.

## Balance

The numbers are checked against each other rather than set one at a time, and a
few of them were quietly working against the player:

- **Every crop now earns about the same per field-hour** (~2,160 coins, ~90 XP).
  Before, a longer crop earned *less* per field than wheat, all the way from
  carrots to watermelon — so unlocking one made your farm worse. Flat rates mean
  the upgrade a new crop gives you is the real one: far fewer taps for the same
  money, and the farm's income grows with every field you clear instead.
- **Every animal tier out-earns the one before it**, 600 coins/hour for a
  chicken up to 1,300 for a hive, and asks a longer payback in exchange (20
  minutes, up to 8.5 hours). A pig used to earn exactly what a cow did while
  costing three times as much and unlocking six levels later.
- **No recipe is worth less than its ingredients.** Hot Sauce, Melon Candy and
  Goat Cheese all sold for less than what went into them, and Espresso cleared
  2%. Every recipe now returns at least 1.5x, and craft times are set so the
  margin per hour rises with the recipe's level. Hot Sauce also moved out of the
  Textile Mill, which had no business making it, and into the Jam Kitchen.
- **The whole map is reachable.** At two levels a field, the 24th field needed
  level 37 — ten levels past the last thing the game unlocks. At 1.4 levels a
  field, the last field lands at level 26, just before the Combine.
- **Land and storage cost something now.** Field 19 used to be forty minutes of
  income; the last field is now a genuine goal. The silo ladder still starts at
  160 coins and ends somewhere you have to save for.
- **The festival no longer drowns out everything else.** Four cycles a day paid
  96 gems — more than every other source put together, which made the arcade
  pointless and gems close to free. A full festival now pays 14.

`scripts/` has no balance tool in it, but the assertions that hold these in
place live in the test suite, so a change that re-breaks one of them fails.

### Progression

**The early levels go fast and the later ones are milestones.** Level 1 costs
12 XP — two rounds of the starting wheat — and the cost climbs steeply from
there: 200 by level 5, 675 by level 10, 5,400 by level 20, and 22,300 by level
29. That's a gentle power curve with a compounding factor that only starts
biting past level 10, so the first sitting carries you several levels in while
the top of the tree still means something.

Every level opens something new. 13 crops, 7 animals, 12 workshops, 22 craftable
goods, 24 fields, and 8 permanent upgrades that make the grind disappear:

| Level | Upgrade | What it does |
| --- | --- | --- |
| 5 | 🪣 Watering Can | Crops grow 10% faster |
| 9 | 🌱 Rich Pasture | Grass regrows twice as fast |
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
js/store.js             durability: the IndexedDB mirror, backups, restore
js/cloud.js             optional sign-in + server sync (off until configured)
js/game.js              player actions + the world clock
js/map.js               the field grid
js/arcade.js            the three arcade cabinets, on one canvas
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

Tuning the game means editing `js/data.js` — grow times, prices, the XP curve,
unlock levels, upgrade costs and the arcade's score rungs all live there. The
cabinets themselves are in `js/arcade.js`: an engine that owns the loop, the
input and the results card, and three small factories that own nothing but
their own rules.

To regenerate the app icons after changing the artwork:

```sh
node scripts/make-icons.mjs
```

## Notes

- Saves live under `sunnyacres.save.v1`, `…slot2`, `…slot3` — in `localStorage`
  and mirrored into the `sunnyacres` IndexedDB database, on that device only
  until cloud saves are configured. Deliberately clearing all website data wipes
  both, so keep a backup file if a farm matters to you.
- After changing any game file, bump `CACHE` in `sw.js` so installed phones
  pick up the new build.
