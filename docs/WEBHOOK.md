# SimplyBook webhook

The route is `POST /api/simplybook-webhook`. It checks `SIMPLYBOOK_WEBHOOK_SECRET` and then refreshes the booking list. A wrong or missing secret does not refresh anything.

Do not turn on Protection Bypass for Automation until Matt says so. Vercel Authentication stays on.

## Callback URL

Use the host the console is actually on. No host is baked into the code. After a custom domain is attached, use that host.

```text
https://<console-host>/api/simplybook-webhook?secret=<SIMPLYBOOK_WEBHOOK_SECRET>
```

`<SIMPLYBOOK_WEBHOOK_SECRET>` is the same value stored in Vercel. Do not put the secret in git or in a log.

## Vercel Authentication

While Deployment Protection is on, SimplyBook's servers cannot reach that URL. The bypass is a separate secret from the webhook secret.

When Matt decides to allow the callback:

1. Project → Settings → Deployment Protection → Protection Bypass for Automation.
2. Create the bypass secret there. Store it only in SimplyBook (and cron-job.org if a job needs it). Do not copy it into the repo.
3. In SimplyBook, set the webhook URL above and send this header on the callback:

```text
x-vercel-protection-bypass: <the bypass secret>
```

4. Send a test notification. The setup page should still show the webhook secret as Ready, and the calendar should refresh without anyone opening it first.

The minute schedule in cron-job.org needs the same bypass header, plus `Authorization: Bearer <CRON_SECRET>`, on `POST /api/tick`. That header is not a substitute for `CRON_SECRET`.
