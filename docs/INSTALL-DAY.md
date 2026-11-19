# Install day

The console stays private. Do not add a domain and do not turn off Vercel Authentication until the decisions at the end are made.

Use the Setup section at the top of the console after the staff password. Every row should say Ready before you leave. It never shows secret values.

## Env vars for this owner

Set these on the Vercel project, Production. No `VITE_` prefix. Redeploy after they change (an empty commit on `vercel` is enough).

| Name | What to put |
| --- | --- |
| `BOOKINGS_SOURCE` | `simplybook` |
| `SIMPLYBOOK_COMPANY` | SimplyBook company login |
| `SIMPLYBOOK_USER_LOGIN` | The API user's login |
| `SIMPLYBOOK_USER_KEY` | That user's API key. This is the password the console sends. |
| `SIMPLYBOOK_API_URL` | Leave unset to use `https://user-api-v2.simplybook.me`. Set it only if SimplyBook gave another host. |
| `SIMPLYBOOK_WEBHOOK_SECRET` | A long random string you invent. The same string goes in the webhook URL. |
| `CRON_SECRET` | A different long random string. cron-job.org sends it as `Authorization: Bearer …`. |
| `SAUNA_LOCATIONS` | See below. Leave unset until the first site is chosen. |
| `SAUNA_PROVIDER_MAP` | See below. Leave unset to use the six built-in Secret Sauna names. |
| `STAFF_PASSWORD` | What owner staff type after Vercel Authentication. |
| `SESSION_SECRET` | A long random string. Signs the staff cookie. |
| `PIQO_LINK_GLOW_ON` | Piqo Action link. |
| `PIQO_LINK_GLOW_OFF` | Piqo Action link. |
| `PIQO_LINK_OUTDOOR_ON` | Piqo Action link. |
| `PIQO_LINK_OUTDOOR_OFF` | Piqo Action link. |
| `PIQO_LINK_GENTLE_FLASH` | Piqo Action link. |
| `PIQO_LINK_WARNING_FLASH` | Piqo Action link. |
| `PIQO_READ_TOKEN` | Piqo read token for the sensor. |

`SIMPLYBOOK_USER_PASSWORD` and `SIMPLYBOOK_API_KEY` still work if a user key is not set. Prefer `SIMPLYBOOK_USER_KEY`.

### Locations

One site stays on until this is set. Example, with only Camp bookable in the console:

```json
[
  {"id":"hawea","name":"Lake Hāwea","enabled":false},
  {"id":"cardrona","name":"Cardrona","enabled":false},
  {"id":"camp","name":"Camp","enabled":true}
]
```

The site menu lists enabled rows only. Bookings whose provider mapped to another id stay hidden. Bookings with no location still show.

### Provider names

Replace the built-in list only when this owner's names differ. `room` is `Small` or `Big`.

```json
[
  {"provider":"Camp only 8 person sauna","room":"Small","location":"camp"},
  {"provider":"Camp only 12 Person Sauna","room":"Big","location":"camp"}
]
```

8-person and private names map to Small. 12-person and shared names map to Big. A macron in Hāwea still matches Hawea.

## SimplyBook

1. SimplyBook → Manage → Users.
2. Open the API user (the login in `SIMPLYBOOK_USER_LOGIN`).
3. Set the role to Admin or Senior Employee. Other roles get AccessDenied on the bookings report, sometimes as HTTP 200. The setup page then says: This SimplyBook user needs Admin or Senior Employee.
4. Open that user → API User Keys. Create a key. Put it in `SIMPLYBOOK_USER_KEY`. Redeploy.
5. Setup should show login details Ready, sign-in Ready, and bookings permission Ready.
6. Webhook: follow `docs/WEBHOOK.md`. Do not enable the protection bypass until that decision is made.

## Domain

Follow `docs/DOMAIN.md`. Do not add the domain in this visit unless that decision is already made.

## Piqo and the sensor

Setup lists each Action by name. Not yet means that `PIQO_LINK_…` value is missing. It does not show the link.

The sensor row is online or offline, with the last reading time in Auckland. It does not show a stand-in temperature. Temperature and humidity never switch the lights.

## Final checks

- Staff password opens the console, after Vercel Authentication.
- Setup is all Ready, or the remaining rows are ones Matt chose to leave.
- The site menu shows the one enabled site.
- The calendar lists that site's bookings on the right room (8-person and private on Small, 12-person and shared on Big). A booking with no party size still marks the day.
- Outdoor and indoor lights follow their own switches. Changing the temperature on screen does not.
- `POST /api/tick` with the cron secret returns JSON and does not print secrets.
- The webhook URL is ready to paste, and the secret is only in Vercel and SimplyBook.

## Decisions still with Matt

- Which site is enabled first.
- The owner's domain, and whether to attach `console.<owner-domain>` now.
- Whether to turn Vercel Authentication off for Production so staff use only the staff password.
- When to create the Protection Bypass for Automation for the webhook and the minute cron.
- Whether the built-in provider names are the ones this owner uses.
