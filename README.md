# Lineup — walk-up queue for barbers

Clients scan a QR code, land in the barber's line, and get an expected time. The barber runs the chair from a phone: call the next client, take a break, add a walk-in, tweak the timing. Built mobile-first for an at-location setup (a shop, a pop-up, an event booth).

## What it does

**For clients** (`/q/:shop`)
- Scan → see the barber's brand, whether the line is open, how many are ahead, and the next available time.
- Join with a name, or leave it blank and get a timed default like **Haircut 4:15pm**.
- Pick a service if the barber lists more than one (each with its own duration).
- A live ticket: position, expected time, "you're next", then "it's your turn" — updated in real time over Server-Sent Events, with vibration and optional browser notifications.
- Leave the line, or rejoin after a cut. The ticket survives a page reload.

**For the barber** (`/b/:shop`, PIN-protected)
- One-tap **Call next** (finishes the current client and calls the next).
- Chair card with Done / No-show / Back to line.
- Tap any waiting client to call them now, move up/down, rename, no-show, or remove.
- Add manual walk-ins (they can join even when the QR line is closed).
- **Break** for 10/15/30/60 min — every expected time shifts.
- Open / close the line, cap the maximum line length.
- **Settings:** time per client (drives all estimates), turnover buffer, optional services, time zone, shop name, barber name, tagline, address, a notice to clients, and a branding image (resized in the browser before upload).
- QR code sheet with copy link, **printable A4 poster**, and a full-screen **shop display** (`/b/:shop/board`) for a tablet or TV.
- Today's stats: in line, served, average wait, plus an "earlier today" history.

## Run it

Requires **Node 22.5+** (uses the built-in `node:sqlite`).

```bash
npm install
npm start          # http://localhost:3000
npm test           # API test suite
```

Open `/`, create a shop (name, barber, 4–8 digit PIN). You land on the dashboard with the QR sheet open; print the poster and stick it on the door.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | SQLite database and uploaded images |
| `PUBLIC_URL` | derived from the request | Force the URL encoded in QR codes, e.g. `https://line.example.com` |

Put it behind any HTTPS proxy (Caddy, nginx, a PaaS). The app trusts `X-Forwarded-*` headers for building QR links and marks the session cookie `Secure` on HTTPS. Persist `DATA_DIR`.

## Project layout

```
server/
  index.js   Express app: pages, public queue API, barber admin API, QR, uploads
  queue.js   Queue domain logic: timeline/estimates, join, call, finish, reorder
  db.js      SQLite schema and helpers (node:sqlite)
  auth.js    PIN hashing (scrypt), sessions, slugs
  events.js  Server-Sent Events fan-out per shop
  time.js    Time-zone-aware formatting for default names and daily stats
public/
  index.html      Landing: create a shop / sign in
  queue.html      Client page
  dashboard.html  Barber dashboard
  board.html      Full-screen "now serving" display
  poster.html     Printable QR poster
  css/app.css     Design system
  js/             Page scripts + shared helpers
test/
  api.test.js     End-to-end API tests (node:test)
```

## How times are computed

The line is walked from "now": the client in the chair pushes the cursor to their expected finish (or now, if they've run over), an active break pushes it further, then each waiting client takes their service's minutes plus the turnover buffer. Estimates are recomputed on every read, so they drift forward honestly when the barber is running late and snap back when a client leaves.
