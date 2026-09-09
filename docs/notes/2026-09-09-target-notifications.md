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
