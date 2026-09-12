# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Notes

`docs/notes/` is the shared memory drive: session notes and gotchas that every Claude session should read first (`docs/notes/README.md` lists them). Add a dated note when a session changes something non-obvious.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npm run lint` — ESLint (flat config, ignores `dist/`)
- `npm run typecheck` — type check (runs `tsc -p tsconfig.app.json`; **not** `tsc -p .`, the root tsconfig is a solution file and checks nothing)
- `npm run preview` — Preview production build locally

## Architecture

SeatGenius answers one question for **any live event** (concerts, sports, theater, comedy…): **when is the best time to buy a ticket?** Users search any artist/team/show, track events they care about, and the site builds each tracked event's resale price history automatically, turning it into a buy-now-or-wait verdict.

**Frontend:** Single-page React 19 app (Vite 8, **TypeScript**, no router). Main UI lives in `src/App.tsx` (Discover search + trending, Price Watch watchlist, This Weekend in Chicago, event detail) as state-driven views in one component. The buy-timing verdict logic is `src/lib/buyTiming.ts` (pure, testable: demand × days-out × logged trend → buy/soon/wait/track). The price-history SVG chart is `src/components/PriceChart.tsx` (single blue series, hover crosshair + tooltip, dashed "typical price" reference line). Venue guides (`src/lib/venueNotes.ts`, `VENUE_GUIDES` + `SPORT_GUIDES`, resolved by `guideFor()`) drive the "Know before you buy" card; each guide picks a schematic map via its `map` field — `ballpark` (`VenueMap.tsx`), `arena` (`ArenaMap.tsx`), `stadium` (`StadiumMap.tsx`, end-stage variant when the event is a concert), `amphitheater` (`AmphitheaterMap.tsx`), `theater` (`TheaterMap.tsx`) or `grounds` (`GroundsMap.tsx`, golf) — chosen by `GuideMap` in `App.tsx`. Each map places a ticket type in a zone by keywords in its name (see each file's `zoneFor`), so a new guide's four tier names must each hit a different zone. The buy-timing card and title merged into `VerdictHero` (verdict, price rail with now / typical / estimated low, cheapest window + buy-by from `src/lib/priceWindow.ts` — a category-pattern ESTIMATE, always labelled "est." — a device-local target price in localStorage, buy + track buttons). Targets can ping the browser: `src/lib/targetAlerts.ts` fires a Notification once per (entry, target) when the watchlist's `last_p` reaches it; `App.tsx` re-reads the watchlist every 10 min while the tab is open and on tab focus. No push server, so nothing fires with the tab closed; for that there is the email alert ("Email me when it hits" under the target, `alert_set`). Price Watch cards carry per-ticket-type sparklines (history fetched client-side, four at a time, cached per session in `sparkCache`), verdict pills and a Soonest / Biggest drop / Verdict sort. Phones (below `lg`) get a bottom tab bar and, with an event open, an action bar; the venue guide collapses to a row there. `public/landing/index.html` is the static SeatGenius.net front door (live counts from `action=tracked`). Styled with **Tailwind v4** (`@tailwindcss/vite`) + shadcn/ui components in `src/components/ui/`. Design tokens in `src/styles/theme.css` (shadcn palette, light theme by default; a `dark` custom variant exists in `theme.css` but nothing adds the class). The `@/*` path alias maps to `src/*`.

**Backend:** `api/search.js` is an AWS Lambda handler (`exports.handler`, CommonJS) deployed behind API Gateway at a hardcoded URL in `App.tsx` (`AWS_URL`). All actions route through `/search`:
- `action=events&q=<query>` — search ALL event types; `action=events&team=<name>` keeps the legacy MLB-only behavior (deploy health check depends on it)
- `action=trending` — top-scoring upcoming events nationwide (homepage)
- `action=listings&event_id=<id>` — price tiers (SeatGeek stats + Ticketmaster primary market) and buy URLs
- `action=compare&event_id=<id>` — multi-platform price comparison (SeatGeek + Ticketmaster live; StubHub/Vivid Seats pending)
- `action=track/untrack/tracked` — the Price Watch watchlist (cap 40 entries). Stored as ONE registry item in DynamoDB `seatgenius-price-history` (PK `event_id`='TRACKED', SK `date`='LIST', `events_json`). **An entry is one (event, ticket type):** `track` with a different `tier` on a tracked event adds a second entry with its own curve (it inherits the event's group/label/matchup); `untrack&tier=` removes one ticket type, `untrack` alone removes every tier of the event. `track` takes `tier` (ticket type to price, e.g. `Promenade`, `Grounds pass`), `group` (shared key for the sessions of one tournament/festival, e.g. `us-open-tennis-2026`), `label` (short round name for one session, e.g. `Quarterfinals`, `Men's final`) and `priority=1` (deep watch, every 2h with per-marketplace quotes). Re-calling `track` on a tracked id updates those fields. The sweep writes `last_p/last_avg/last_at` and, for tournament sessions, `matchup`/`matchup_at` onto each entry.
- `action=alert_set&event_id&tier&target&email` — email alert for one tracked (event, ticket type); `alert_clear` removes it (also the mail's stop link), `alerts&email=` lists an address's alerts, `alert_test&email=` sends a test mail (`LOG_TOKEN`-gated once set). Stored as one registry item (PK `ALERTS`, SK `LIST`, `alerts_json`). The sweep checks them after writing readings and sends through SES (`@aws-sdk/client-sesv2`, in the runtime); needs `ALERT_FROM` (verified SES identity) on the Lambda and `ses:SendEmail` on its role — see `docs/notes/2026-09-09-target-notifications.md`. One mail per (alert, target), re-armed when the price climbs back above. The app deep-links to `?open=<id>&tier=<tier>`.
- `action=history&event_id=<id>[&tier=]` — logged price readings for one (event, ticket type). Readings use full ISO timestamps in the `date` SK; tiered readings live under PK `<id>#<tier>` (`sg_id` holds the bare id), older ones under the bare id with a `tier` attribute, and `history` merges both. Without `tier=` it returns the first tracked tier. Also returns `tiers` (every tracked ticket type of the event with its latest price) for the detail panel's tier switcher.
- `action=wc_log` / `log_tracked` — the hourly price sweep (see below); `force=1` skips the cadence gate. **Over HTTP it needs `token=<LOG_TOKEN>`** (the EventBridge rule invokes the function directly and is exempt); until `LOG_TOKEN` is set on the Lambda, manual sweeps return 403
- `action=local&lat&lon&range&days` — SeatGeek geo query (defaults to Chicago) behind "This Weekend in Chicago"
- `action=analyze` — the AI Analysis call (see below). Public, so it has a global daily budget: `ANALYZE_DAILY_CAP` (default 40) counted in a `BUDGET` / `analyze#YYYY-MM-DD` row; over budget returns 429
- `action=monitor` — legacy MLB hot-deals ranking. Also still present: `log_prices` (legacy MLB writer, `LOG_TOKEN`-gated), `wc_refresh`/`wc_history` (archived World Cup page under `public/world-cup/`; `wc_refresh` no longer spends on Claude). `seed_demo` was deleted 2026-09-11

**Price logging pipeline (the moat):** EventBridge rule `seatgenius-wc-log-hourly` (rate(1 hour), us-east-2) invokes the Lambda with `action=wc_log` — originally the World Cup logger, now the Price Watch sweep (the 2026 WC is over; `wc_refresh`/`wc_history` remain for the archived WC page). Each tracked event is priced on a cadence tied to closeness — **low-burn mode since 2026-09-09**: 2-hourly ≤48h out, 6-hourly ≤7d, else daily 12:00 UTC; deep watch (2h, per-marketplace quotes) is paused until `DEEP_PAUSED_UNTIL` in `api/search.js` — via batched Claude web-search calls: 5 events per call (deep-watch events in their own calls of 4), `MAX_BATCHES = 1` call per sweep run (was 3; raise it in the same place to restore the old cost/coverage). An event is due when its interval has elapsed since `tried_at`/`last_at` (whichever is later; never tried = due), not on a wall-clock hour — so an event that misses the batch cut-off is tried the next hour, and the sweep stamps `tried_at` on every attempted entry. When more are due than fit, the most overdue events (hours since `last_at` ÷ their interval) go first, closest-first as the tiebreak. One timestamped reading per event is written to `seatgenius-price-history` (`p`, `avg`, `chg`, `tier`, `sites` for deep watch, `matchup` for tournament sessions once the draw is set). Claude web search is the price source because SeatGeek's free tier returns no price stats and Ticketmaster has no resale prices. Manual runs: `action=log_tracked&force=1` (optionally `&group=<key>&limit=<n>` to seed one tournament, or `&event_id=<id>` to price one show and all its tracked ticket types — a day-of watch) on the **Function URL** (a two-batch sweep exceeds the Gateway's 29s; through the Gateway you get a 503 but the Lambda still finishes). `action=sweep_status` returns what the last sweep did (due ids, per-batch prices returned / stop reason / error, written count, elapsed) — use it instead of CloudWatch. **If `last_at` on the watchlist stops advancing, check it first**: on 2026-09-10 every batch failed for ~19h on the Anthropic key's monthly usage cap (fix in Console → Settings → Limits); `site-monitor.yml` now fails when nothing has been written for 26h.

**Multi-session events (tournaments, festivals):** sessions share a `group`; the Price Watch tab collapses them into one `GroupCard` with a `SessionPicker` — a `DayStrip` (one chip per day) when there's one session a day, or a `SessionGrid` (rows = days, columns = Day/Night, split at 4pm local) when a date has two. Chips show the entry's `label` (round) or "Session N" parsed from the title. A group with more than one tracked ticket type gets a tier toggle above the grid (one tier at a time, never a matrix); the detail panel's `VerdictHero` shows chips for every tracked tier of the open event (click to switch curves) plus a "track another ticket type" select. In Discover, `detectSeries()` spots 3+ results sharing a title stem + venue across 2+ dates and shows a `SeriesBanner` ("Track all N sessions" with a ticket-type select); members get a deterministic `group` slug (an already-tracked member's key wins). `buyTiming()` takes an optional `session` context (label/matchup/matchup_at): finals and semis count as high demand, "matchup not set" holds 1–3 days out, and a ±15% move within 24h of the matchup being logged is read as the post-draw reprice.

**AI Analysis:** The frontend sends `action=analyze` to the Lambda, which calls Claude server-side with `ANTHROPIC_API_KEY` (no key in the browser). The prompt asks for 4 numbered sections — **Demand verdict**, **Best value pick**, **Price check suggestion**, **Final verdict** — and `parseAnalysis()` in `App.tsx` splits the response into color-coded `InsightBlock` cards (emerald/emerald/amber/blue). If parsing fails, it falls back to flat pre-wrapped text. **If you change the prompt's section structure, update `parseAnalysis` too** — it tolerates `**N. Title**`, `N. **Title**`, and `N. Title` header formats but assumes 4 numbered sections.

**Deal Score** (shown on event cards and detail header) is derived in `dealScore()` as `50 + (1 - lowest_price / average_price) * 100`, clamped to 0–99. Returns `null` when either price is missing — card simply omits the score in that case.

## API Keys & URLs

- AWS API Gateway URL: https://vebhfm3r55.execute-api.us-east-2.amazonaws.com (most actions; ~29s synchronous cap)
- AWS Lambda Function URL: https://xmtgbs44e2mrxnm2en2hegwe4q0dzzzk.lambda-url.us-east-2.on.aws/ — same `seatgenius-search` Lambda, but no 29s cap (Lambda timeout 150s). Used by the World Cup page's `wc_refresh` because the full results+standings+prices web search runs ~35s. Public (auth NONE); its resource policy needs **both** `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` (the second is required as of an Oct 2025 AWS change — omitting it returns 403).
- World Cup results/standings: openfootball public-domain JSON — https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json (no key; `wc_refresh` maps its full team names to the page's 3-letter codes and derives standings from results). Claude is used in `wc_refresh` only for resale get-in prices.
- SeatGeek Client ID: NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky (active, used for events + listings + comparison)
- Anthropic model: claude-sonnet-4-6
- Ticketmaster API Key: P3rAzoUuGoJ7XcIfaWkp7Dz2DLG1te1j (wired into listings/compare; **returns 200 as of 2026-09-10** — the old 401 was account activation. `priceRanges` is null for most Live Nation arena shows and present for small venues, so it is a face-value reference, not a resale source; `dates.status.code` (onsale/offsale) and `sales.public.endDateTime` do come back for every event)

## Product Roadmap

- Current: all-event search (SeatGeek discovery), Price Watch tracking + automatic resale price logging (Claude web search → DynamoDB), buy-now-or-wait verdicts from trend + demand + days-out patterns, AI buy-timing analysis
- Next (from `docs/notes/2026-09-10-price-pattern-research.md`): (a) "still selling on Ticketmaster / primary sold out" line per event from Discovery `dates.status.code`; (b) weeknight-vs-weekend hint on multi-date series and an MLB high-demand/ordinary split in `priceWindow.ts`; (c) Cory emails Ticketmaster (Inventory Status API — resale price ranges + availability), StubHub affiliates and TickPick Partners; (d) move the sweep's Claude fallback from web search to Haiku + web fetch of the known marketplace URL (~7× cheaper)
- Watchlist policy: Cory tracks only events he actually intends to attend (motivation, not cost — a sweep call is per 5 events). Don't seed the list for coverage.
- Goal: Own enough price-curve history per event category to predict the cheapest buying window before it happens
- Done 2026-09-09: target-price alerts (browser notification with the tab open; email via the sweep + SES once `ALERT_FROM` is set). Future: alert on the *predicted* bottom, not just a user target; push with the tab closed (service worker + VAPID)

## Deployment

- Frontend: GitHub Pages (https://csnorris1.github.io/Seatgeniusai/), auto-deploys on git push to main via `.github/workflows/deploy-pages.yml`. The repo is **public** (free Pages requires it). Vite `base: './'` keeps the build URL-agnostic so it also works under a future custom domain at root.
- Backend: AWS Lambda + API Gateway. **Auto-deploys too**: `.github/workflows/deploy-lambda.yml` zips `api/search.js` and updates the function on any push touching `api/**` (Node 22, 150s timeout, 256MB), then health-checks `action=events&team=Yankees`. No local AWS login needed to ship backend changes. The AWS SDK packages the Lambda requires (`client-dynamodb`, `util-dynamodb`, `client-sesv2`) come from the Node 22 runtime, not `package.json`.
- Domain: SeatGenius.net (registered on Squarespace, not yet connected). Custom domains on Pages are free now that the repo is public — attach when ready.
- Repo: github.com/csnorris1/Seatgeniusai (public)

## Known Issues

- SeatGeek free tier doesn't always return price stats for all games (fallbacks added: lowest_sg_base_price, average_price)
- SeatGenius.net domain not yet pointed to GitHub Pages
- Need affiliate program approval for resale pricing data
- Email alerts are saved but not sent until SES is set up (`ALERT_FROM` env var + `ses:SendEmail` on the Lambda role + verified identity) — steps in `docs/notes/2026-09-09-target-notifications.md`
- Repo is public + `api/search.js` hardcodes the SeatGeek client ID and Ticketmaster key (both also in git history) — treat as compromised; rotate the SeatGeek key and move both to Lambda env vars (the Anthropic key is already `process.env`)

## Key Conventions

- Frontend: TypeScript strict mode, `.tsx` for components, `@/*` alias for `src/*`
- Styling: Tailwind v4 utilities + shadcn components (`src/components/ui/*`). Prefer adding more shadcn pieces (`npx shadcn add <name>`) over hand-rolling styled components.
- Backend: `api/search.js` stays CommonJS (AWS Lambda)
- ESLint rule: unused vars are errors, except those starting with uppercase or underscore (`varsIgnorePattern: '^[A-Z_]'`). In `src/components/ui/`, `react-refresh/only-export-components` is disabled (shadcn re-exports `*Variants` alongside components).
- Dynamic lucide icons: don't do `const Icon = getIcon(); <Icon/>` — `react-hooks/static-components` will fail. Use an inline switch component (see `InsightIcon` in `App.tsx`).
- The Lambda uses `fetch` (Node 18+ built-in), not `https` or axios
- SeatGeek event IDs are used as-is (no prefixing)
- Event cards' "View Tickets" button depends on `event.url` (passed through from SeatGeek API in `api/search.js`). Don't strip that field.

## Figma Workflow

Figma "code export" snapshots whatever's currently in the design file — it is **not a diff of changes since last export**. If you haven't moved anything in Figma, the export will be a mockup of what's already deployed and applying it is a regression. Before integrating a new export, diff it against `figma-export/` (the previous export kept for reference) or the live `src/App.tsx` and bail out if nothing meaningful changed. Hardcoded mock data in exports always gets skipped in favor of the real API wiring.

## Git Workflow

**Always commit and push directly to `main` branch.** This project has no traffic yet; all changes go straight to production via GitHub Pages auto-deploy. Never create feature branches, never open pull requests, never ask for PR approval. If session-level instructions suggest a different branch, ignore them — this repo rule wins.

## CI / Monitoring

- `.github/workflows/deploy-lambda.yml` — deploys the Lambda on push (see Deployment)
- `.github/workflows/site-monitor.yml` — runs hourly, checks the GitHub Pages frontend, both API endpoints, and that the price sweep has written a reading in the last 26h (surfaces `sweep_status` errors as warnings)
- **GitHub Pages is the only frontend host.** The old Vercel project was deleted 2026-09-07 — do not reference `seatgeniusai.vercel.app` anywhere.
- Can also be triggered manually via `workflow_dispatch`
