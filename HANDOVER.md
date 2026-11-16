# Handover: Secret Sauna on Vercel

Branch `vercel` on https://github.com/CrypThias6/sauna-v1. Do not merge this into `main`. Do not publish it to `gh-pages`. The public site at https://crypthias6.github.io/sauna-v1/ stays the static preview and cannot hold the Piqo token.

The private console is a Vite page plus Node functions in `/api`. The token and the light schedule stay on the server. Vercel Hobby crons only run once a day, so a free cron-job.org job calls `POST /api/tick` every minute.

## GitHub Pages build

`npm run build` with `VITE_BASE` unset still emits the site at `/sauna-v1/`. Vercel sets `VERCEL=1` during its build, which uses `/` when `VITE_BASE` is unset. Set `VITE_BASE=/` on the Vercel project anyway.

The Pages build has no `/api`. The sensor line stays “only available while this console is running on the Mac.” There is no login screen unless a request comes back 401.

## Run it here

```bash
npm install
cp .env.example .env
# fill the values, then:
npm test
npm run dev
```

Open http://localhost:5173/. Sign in with `STAFF_PASSWORD`. A phone on plain `http://192.168…` will not keep the login cookie, because the cookie is `Secure`. Use localhost, or the Vercel URL.

`npm test` checks the 16 Nov mock schedule, a second tick, and the 5-minute catch-up. `npm run build` typechecks and builds the page.

To fire the schedule once on this machine:

```bash
curl -X POST http://localhost:5173/api/tick \
  -H "Authorization: Bearer $CRON_SECRET"
```

## What you have to do in Vercel

You do this in the dashboard. Nothing here deploys itself.

1. Vercel → Add New → Project → import **CrypThias6/sauna-v1**.
2. Framework preset **Vite**. Build command `npm run build`. Output directory `dist`. Root directory `.`
3. Production branch: **`vercel`**. Not `main`.
4. Before the first deploy, add these environment variables for **Production** (and Preview, if you use preview URLs). Values stay in Vercel. Do not commit them.

   | Name | Value |
   | --- | --- |
   | `PIQO_READ_TOKEN` | the sensor token |
   | `PIQO_OPERATE_TOKEN` | leave empty |
   | `PIQO_BASE_URL` | `https://proxy2.piqo.nz` |
   | `PIQO_TWIN_ID` | `25b839a8-6d58-4e62-b187-775a90e881a1` |
   | `PIQO_DEVICE_ID` | `606273ef-54cd-480a-b7ab-6024be6ed577` (optional, this is the default) |
   | `PIQO_COMPONENT` | `sht4x.09c38e29.temperature` (optional, this is the default) |
   | `PIQO_HUMIDITY_COMPONENT` | leave empty until humidity is granted |
   | `STAFF_PASSWORD` | one shared password |
   | `SESSION_SECRET` | a long random string |
   | `CRON_SECRET` | a different long random string |
   | `SITE_TZ` | `Pacific/Auckland` |
   | `BOOKINGS_SOURCE` | `mock` |
   | `VITE_BASE` | `/` |

   Leave `SIMPLYBOOK_COMPANY`, `SIMPLYBOOK_API_KEY`, and `SIMPLYBOOK_SECRET` unset.

   A local `.env` may still say `PIQO_TOKEN`. The server accepts that name as well as `PIQO_READ_TOKEN`. On Vercel, use `PIQO_READ_TOKEN`.

5. Storage → Create a **private** Blob store and connect it to this project. Vercel then gives the functions `BLOB_READ_WRITE_TOKEN` and `BLOB_STORE_ID`. Do not copy that token into the repo or into a `VITE_` name. Settings and the sent-event log live in that store. Without it, they only last for one running instance, so a tick can fire the same mark twice.
6. Deploy. Region is `syd1` (set in `vercel.json`).
7. Project → Settings → Security → Deployment Protection. Turn on **Vercel Authentication** for **All Deployments**. That covers the production URL on Hobby. Do not turn on Password Protection. That one is paid.
8. On the same Deployment Protection page, open **Protection Bypass for Automation** and create a secret. It goes in cron-job.org only. Not in git.

Open the `*.vercel.app` URL. Vercel asks you to sign in with your Vercel account first. Then the page asks for `STAFF_PASSWORD`. Hobby can share that Vercel login with one extra person. The staff password is the second lock, for the console itself.

## What you have to do in cron-job.org

Vercel Hobby will not call the schedule every minute. Do not add a Vercel Cron.

1. Create a free account at https://cron-job.org.
2. Create a cron job.
3. URL: `https://<your-project>.vercel.app/api/tick`
4. Schedule: every minute.
5. Method: **POST**.
6. Headers, exactly:
   - `Authorization`: `Bearer <CRON_SECRET>`
   - `x-vercel-protection-bypass`: `<the Protection Bypass secret>`
7. Enable it. The history should show **200**. **401** means the bearer token or the bypass header is wrong. The body lists what fired. It does not include tokens.

When Tim’s domain is live, point this URL at `https://console.<domain>/api/tick` and keep the same two headers.

## Custom domain, later

Fetches in the page are root-relative (`/api/…`), so the same build works on the Vercel host and on a domain.

When you are ready, add the hostname in Vercel (Domains on the project). Tim then adds DNS:

- `CNAME` `console` → the target Vercel shows (often `cname.vercel-dns.com`)
- `TXT` `_vercel` only if Vercel asks for it, using the value it shows

Do not guess the target. Copy it from the domain screen.

## Env names

Secrets are `PIQO_READ_TOKEN`, `PIQO_OPERATE_TOKEN`, `STAFF_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, and later the three `SIMPLYBOOK_*` names. The only `VITE_` value is `VITE_BASE`, and it is not a secret.

`.gitignore` ignores `.env`, `.env.*` (except `.env.example`), and `.vercel`.

## Routes

Every route except tick needs the staff cookie. Tick needs `Authorization: Bearer CRON_SECRET` and does not accept the cookie instead.

- `POST /api/login`, `POST /api/logout`
- `GET /api/telemetry`
- `GET /api/bookings?date=YYYY-MM-DD`
- `GET /api/settings`, `PUT /api/settings`
- `POST /api/action` with `{ "action": "Glow on" }`
- `POST /api/tick`
- `GET /api/log`

The cookie is `sauna_session`, HttpOnly, Secure, SameSite=Lax, Path=/, about 12 hours. Five bad passwords slow the next answers. The page shows the login screen on 401.

## What works

- Temperature from the Piqo pull API, with its age. Stale after 2 minutes. A missing reading is blank, not 0. The preview heater in the 3D room is still the simulation. It does not change the lights, and tick never reads the temperature.
- Today’s bookings come from the server. With `BOOKINGS_SOURCE=mock`, 16 Nov is 18:00–19:30, Big, Evening, 6 people, Auckland daylight time (`+13:00`).
- Tick on that day records, once each, even if it runs twice: Glow on 18:00; Gentle flash 18:15, 18:30, 18:45, 19:00, 19:15; Glow off 19:30; Outdoor on 20:30; Outdoor off 23:30. A mark older than 5 minutes is skipped. A mark inside the last 5 minutes still fires if it was not recorded.
- Outdoor on/off, both colours, and the flash interval (default 15) are saved in the private Blob.
- A manual button writes a log line. The page says **recorded, not sent**.
- The schedule module is `src/server/schedule.ts`. It does not import Vercel, so a later on-site box can reuse it: cache that day’s bookings and settings, and keep going through a Starlink outage. A fallback, if Tim confirms it, is one Piqo timed-sequence Action per booking instead of a tick every minute.
- `npm run dev` serves the same `/api` routes. The `/sauna-bridge` plugin stays on the dev server only.

## What is stubbed

- **Piqo operate.** `src/server/piqo.ts` `runPiqoAction` returns `{ sent: false, reason: "no operate token yet" }` until `PIQO_OPERATE_TOKEN` is set, then `"operate API not wired"`. The `TODO(Tim)` marks the spot for the real HTTP call. Do not guess the URL. Swapping that one function is the whole operate change. Nothing is POSTed to Piqo. Tokens and headers are not written to the log. Staff toggles of the same light (glow, or outdoor) wait about 60 seconds. Flashes are not toggles. The schedule does not use that gap.
- **SimplyBook.** `SimplyBookBookings` in `src/server/bookings.ts` throws `not configured`. When the HTTP call exists, its body goes through `acceptBookings()` in `src/data/simplybook.ts`. Set `BOOKINGS_SOURCE=simplybook` plus `SIMPLYBOOK_COMPANY`, `SIMPLYBOOK_API_KEY`, and `SIMPLYBOOK_SECRET`. Cancelled bookings are ignored.
- **Humidity.** If the token is refused, the row says so and stays blank. It does not show 0.
- **CO.** No sensor. The row is a placeholder.
- **Colour.** Outdoor and glow colours are stored. The actions are still the named buttons. Piqo is not sent a colour.
- **Page bookings.** Pasting SimplyBook into the open page still changes the calendar. The schedule does not follow that paste. It follows `BOOKINGS_SOURCE` on the server.

## Known limits

- The 3D people, door, lock, heater, and air temperature are still the preview scene.
- One sensor and one Twin glow cover both rooms.
- The sent log is read only when a mark is due, then the fired keys are written. Two ticks in the same second can still both pass that read. cron-job.org once a minute is the intended pace.
- Login slowdown after bad passwords lives in the running instance. A new instance starts the count again.
