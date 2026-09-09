# 2026-09-09 target-price notifications (browser, this device)

## What changed
- Setting a target price now asks the browser for notification permission (on the
  first save, using the click so Chrome shows the prompt). Under the target chip a
  row says whether notifications are on, offers "Notify me when it hits", or
  explains why they can't work (blocked / unsupported browser).
- `src/lib/targetAlerts.ts`: `checkTargetAlerts(entries, targets, onOpen)` compares
  the watchlist's `last_p` against the saved targets and fires one Notification per
  (entry, target). The "already told them" record is `sg-target-notified` in
  localStorage; it's dropped when the price climbs back above the target so a later
  dip pings again. Clicking the notification opens that ticket type in Price Watch.
- `App.tsx` runs the check after every watchlist load, every 10 minutes while the
  tab is open (background tabs included), and when the tab comes back into view.
  Nothing is fetched unless permission is granted and a target exists.

## Limits (say so if Cory asks)
- Only while SeatGenius is open in a tab: no service worker, no push server. Closing
  the tab means no ping. Phones suspend background tabs, so this is really a desktop
  feature; iPhone Safari has no Notification API unless the site is on the Home Screen.
- Targets still live only in localStorage. Real alerts (email/push when the tab is
  closed) need: targets stored on the tracked entry server-side, VAPID keys + web
  push (or SES email) sent from the sweep in `api/search.js`, and a service worker.
  The Lambda couldn't be deployed this session anyway (AWS SSO expired).

## Testing
- Headless check used: grant `notifications`, stub `action=tracked` with a `last_p`
  under a target in `sg-targets`, monkeypatch `window.Notification` and count calls.
  One notification on load, none on the re-check, click opens the event.

## Update, same day: email alerts (server-side)
Cory asked for email. Shipped both halves; only the SES sender setup is left and
that's a console task (no CLI login needed).

- **API (`api/search.js`)**: `alert_set&event_id&tier&target&email` (event must be
  tracked → 409 `not_tracked` otherwise; one alert per event+tier+email; caps 200
  total / 15 per address), `alert_clear` (also the "stop this alert" link in the
  mail), `alerts&email=` (that address's alerts), `alert_test&email=` (one test mail,
  gated by `LOG_TOKEN` once set). Alerts live in one registry item (PK `ALERTS`,
  SK `LIST`, `alerts_json`). After the sweep writes readings it runs
  `checkAlerts`: price ≤ target and not yet mailed for that target → SES mail,
  `hit_*` stamped; price back above → re-armed. Result lands in `sweep_status`
  under `alerts` (`checked/sent/errors`).
- **Mail**: subject "Event: Tier is $48 (your target $50)", body with date/venue,
  typical price, "Open in SeatGenius" (`?open=<id>&tier=<tier>` deep link the app
  now understands), buy link, stop link. Sent with `@aws-sdk/client-sesv2`
  (bundled in the nodejs22 runtime; nothing to add to the zip).
- **App**: under the target chip, "Email me when it hits" → address (remembered in
  `sg-alert-email`) → Save. Tracks the ticket type first if it isn't. Shows
  "Email alert on · address · change · stop". Changing the target re-saves the
  alert; clearing the target stops it. Local mirror `sg-email-alerts` is re-synced
  from `action=alerts` on load.
- Tested with stubbed DynamoDB/SES (`scratchpad/alerts-test.cjs` in this session):
  no mail above target, one at/below, no repeat, re-arm after climbing back,
  SES error surfaced not thrown, stop link removes, untracked alert dropped.

### To switch sending on (Cory, AWS console, us-east-2) — ~5 minutes
1. **SES → Identities → Create identity → Email address** → your address (or
   verify the `seatgenius.net` domain via DNS at Squarespace for a nicer sender).
   Click the link in the verification mail.
2. SES starts in **sandbox**: it only delivers to verified addresses. Your own
   address is verified by step 1, so alerts to you work. For other people either
   verify their address too or request production access (SES → Account dashboard
   → Request production access; usually approved within a day).
3. **Lambda → seatgenius-search → Configuration → Environment variables** → add
   `ALERT_FROM` = the verified address. (`APP_URL`/`API_URL` are optional overrides.)
4. **Lambda → Configuration → Permissions → the execution role** → Add permissions
   → attach `AmazonSESFullAccess` (or an inline policy allowing `ses:SendEmail`).
5. Check: open
   `https://vebhfm3r55.execute-api.us-east-2.amazonaws.com/search?action=alert_test&email=YOUR@ADDRESS`
   (add `&token=…` if `LOG_TOKEN` is set). `{"ok":true}` means the mail went out.
   Until then `alert_set` still saves and the app says "sending isn't switched on
   at our end yet"; `sweep_status.alerts.errors` shows the SES error.
