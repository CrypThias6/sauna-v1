# Custom domain

Do not add the domain, and do not turn Vercel Authentication off, until Matt says so. The console stays behind Vercel Authentication. Staff still sign in with the staff password after that.

Nothing in the app hardcodes a `vercel.app` host. The session cookie is `Secure`, `SameSite=Lax`, `Path=/`, and has no `Domain` attribute, so the browser keeps it on whatever host is open. API calls, the webhook, and the MCP path use the page's own origin.

## Add `console.<owner-domain>`

1. In Vercel, open the project → Settings → Domains.
2. Add `console.<owner-domain>`. Do not remove the existing deployment host.
3. Vercel shows the DNS record. Give the owner this record and nothing else:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `console` | `cname.vercel-dns.com` |

4. Wait until Vercel marks the domain valid. HTTPS is issued by Vercel after the CNAME is in place.
5. Open `https://console.<owner-domain>`. Vercel Authentication still appears first, then the staff password.
6. Point SimplyBook and cron-job.org at this host. See `docs/WEBHOOK.md`. Until the domain is live, those jobs stay on the current deployment host.

## Decision Matt has to make

Whether production should keep Vercel Authentication.

- Leave it on: only people who can pass Vercel Authentication, and who know the staff password, can open the console. This is how it works today.
- Turn it off for Production only: owner staff use the staff password and nothing else. Do that in the project → Settings → Deployment Protection, Production environment. Do not turn it off for Preview unless Matt asks. Do not do it before the domain and the staff password are both confirmed.
