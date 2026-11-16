# Handover: Piqo on the operator console

Branch `vercel` on https://github.com/CrypThias6/sauna-v1. This is not on `main` and not on `gh-pages`. The public site at https://crypthias6.github.io/sauna-v1/ does not include this work and cannot hold the Piqo token.

## Run it

```bash
npm install
cp .env.example .env
# put the private integration token in .env, then:
npm run dev
```

Open http://localhost:5173/. A phone on the same Wi-Fi can use the Network address Vite prints. Cellular will not reach it.

`npm run dev` is the backend. The token is read only by the Vite process. Do not prefix any secret with `VITE_`. Vite copies `VITE_` names into the public page.

There is no second host. GitHub Pages is a static build and has no `/piqo` routes. Do not publish this branch to `gh-pages` until a server holds the token.

## Env var names

Set these in `.env`. No values belong in the repo.

- `PIQO_TOKEN` — private integration bearer token. Required for readings.
- `PIQO_BASE_URL` — defaults to `https://proxy2.piqo.nz` if unset.
- `PIQO_DEVICE_ID` — Sauna sensor device id.
- `PIQO_COMPONENT` — temperature component id.
- `PIQO_HUMIDITY_COMPONENT` — optional. If empty, the server tries the humidity half of the same SHT4x id.

`.gitignore` ignores `.env` and `.env.*`, and keeps `.env.example`.

## What the browser calls

Same origin, no token in the response:

- `GET /piqo/sensor` — latest temperature, humidity if allowed, CO placeholder.
- `GET /piqo/status` — what the schedule wants, and the last attempts.
- `POST /piqo/sync` — today's bookings plus the outdoor on/off times.
- `POST /piqo/action` — a staff button. Body `{ "name": "Glow on" }` (or Glow off, Outdoor on, Outdoor off, Gentle flash, Warning flash).

The schedule also ticks inside the Vite process every 10 seconds, so it keeps going while the dev server is up even if the page is closed. It stops when that process stops.

## What works

- Live temperature from the Sauna sensor, with the reading's age. "Stale" after 2 minutes. A missing reading is not shown as 0.
- The preview heater temperature stays the old simulation. Its chip says Preview. It never changes the lights.
- Today's mock booking is listed. 16 Nov is 18:00–19:30, Big, Evening, 6 people. The day count is booked people, not the figures in the 3D scene.
- Checklist session and people follow the mock book. No booking reads as free, not as the old hardcoded "in use".
- Light schedule, not yet sent to Piqo:
  - Booking start → Glow on. Either room counts. One glow for both.
  - Every 15 minutes after the start, while the booking is still on → Gentle flash. A tick only counts if it lands within 25 seconds of the mark. Missed marks are not replayed in a burst.
  - Booking end → Glow off.
  - No booking → glow stays off unless staff turned it on. A staff on/off holds until the set of current bookings changes.
  - Outdoor on at 20:30 and off at 23:30 local time, both editable. A staff on/off holds until the next time boundary.
  - Warning flash is a button only.
- Outdoor colour is saved in this browser (`sauna-settings`). It is not sent.

## What is stubbed

- **Piqo Actions.** The HTTP address is not in the public help, and the current token cannot see the Sauna Twin (`25b839a8-6d58-4e62-b187-775a90e881a1`). `POST /piqo/action` records the attempt and returns not sent. Nothing is POSTed to Piqo. Do not invent the URL. Tim or Matt needs an operate token scoped to the Twin and these action names, plus the real request. The names must stay: Glow on, Glow off, Outdoor on, Outdoor off, Gentle flash, Warning flash.
- **Humidity.** The token cannot read it (403). The page says so. It does not show 0. A later grant, or `PIQO_HUMIDITY_COMPONENT`, is enough. A 403 is remembered until the Vite process restarts.
- **CO.** No sensor. The row is a placeholder. No phone alert.

## Known limits

- The 3D people, door, lock, heater, and air temperature are still the preview scene. They are not the booking and not the sensor.
- One sensor and one Twin glow cover both rooms.
- Outdoor colour does not change the saved "Outdoor on" action. That action is warm white until Piqo accepts a colour.
- The schedule only runs while `npm run dev` (or `vite preview`) is running on a machine that has `.env`.
- GitHub Pages and any static host show "sensor only on this Mac" and cannot press the lights.
- There is no Vercel (or Cloudflare) function yet. This branch is the app and the Vite middleware, ready for that host.
- SimplyBook, once accepted in the page, still adds a live "Now" row above the real bookings. It no longer hides a booking. The dev server's scheduler follows the bookings the open page posts. Before the page connects, it uses the mock book.
- MCP day counts are booked people. "In the room" on MCP is still the preview scene count.
- Clicking a calendar day does not change which sauna is on screen.
- `docs/FIX_PLAN.md` is an older local note and is not part of this branch.
