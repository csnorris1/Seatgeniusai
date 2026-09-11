# 2026-09-10 — What data can tell us when to buy (research pass)

Three parallel research passes on the night before the Eric Clapton show
(United Center, Fri 2026-09-11): what the evidence says about concert resale
curves, which data sources could replace or supplement Claude web search, and
what the Clapton case itself looked like. Plain English; numbers with sources.

## 0. Why the Price Watch data was stale

Nothing was written to `seatgenius-price-history` between 06:09 UTC Sep 10 and
the evening of Sep 10. `sweep_status` after a forced run showed every batch
failing with an Anthropic "API usage limit" error. That is the key's **monthly
usage cap** in the Anthropic console (Settings → Limits), not the balance.
Raise the cap and the hourly sweep resumes on its own. `sweep_status` is the
fastest way to spot this — check it whenever `last_at` on the watchlist stops
advancing.

## 1. Published numbers on how resale prices move

| Finding | Number | Population | Source |
|---|---|---|---|
| Concerts: day-of buys are cheapest | 33% below the event's average; day-before 27% below; 3+ months out 14% **above** | 22,340 tickets, 14 major acts, Apr–May 2022 | [FinanceBuzz](https://financebuzz.com/when-to-buy-concert-tickets) |
| Concerts: the price **peak** is 2–4 weeks out | median $162 at 2–4 wks, $139 at 90+ days, $99 day-of | 307,727 sales (seatdata.io) | [TicketWhiz summary](https://ticketwhiz.com/blog/when-is-the-best-time-to-buy-concert-tickets) |
| Festivals invert | cheapest ~13 days out (−30%); day-of only −17% | 18,714 passes, 5 festivals | FinanceBuzz (same) |
| Volume timing | 24% of concert resale sells in the final week, 7% day-of | same | FinanceBuzz |
| Weeknight vs weekend | weeknight shows 15–20% cheaper (a level effect, not a trend) | seatdata.io | TicketWhiz |
| Most price changes are cuts | 80% of eBay and 89% of StubHub reprices are **cuts** | MLB 2007, millions of listings | [Sweeting 2012](http://econweb.umd.edu/~sweeting/SWEETING_PDECLINE_0112.pdf) |
| MLB decline by window | −35–38% final month, −17–25% final week, −10–15% final 3–5 days | same | Sweeting Table 2 |
| High-demand games fall **more** | projected sellouts −25% final week vs −17% for weak games | same | Sweeting |
| Cheap vs expensive seats | move within ~2 points of each other | same | Sweeting |
| Day-of intraday (sports) | MLB median $48 at 48h → $13 at 90 min after first pitch; NBA $127 → $40 | Gametime internal, no n | [Gametime blog](https://gametime.co/blog/gametime-price-drops-after-first-pitch/) |

Caveats: the strong numbers are MLB-2007 or a 7-week 2022 concert window. No
published data exists on legacy/older-audience acts, opening vs closing night,
venue size, or concert hour-by-hour on show day. **That gap is our moat: our
own curves are the only route to those answers.**

### What to change in `src/lib/priceWindow.ts` (not done yet)

- Single concerts: the bottom is **day-of / day-before**, not 12–20 days out.
  12–13 days out is the *festival* bottom. 2–4 weeks out is the peak. Our
  current concert pattern may have this backwards for single shows.
- "Sold-out never gets cheaper": keep for concerts with real excess demand,
  **drop for sports** (sellout-bound MLB games fell more, not less).
- MLB: split −25% (high demand) / −17% (low demand) in the final week.
- Don't model separate decay for get-in vs premium seats.
- Add a weeknight level adjustment (−15–20%) as a *comparison* hint only.
- Sports day-of: expect a further 40–70% inside the last ~90 minutes.

## 2. Data sources we could plug in

Verified tonight: **SeatGeek free stats are still empty** (`stats: {}`) for
every event including the top-scored games of the weekend — the account-wide
wall stands; the partner program is the only fix.

| Source | What you get | Cost / access | History? | Verdict |
|---|---|---|---|---|
| [Ticketmaster Discovery `priceRanges`](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | primary min/max ("face value floor") | free key, 5k/day; ours 401s (activation) | live | fix key, use as reference line |
| [Ticketmaster Inventory Status](https://developer.ticketmaster.com/products-and-docs/apis/inventory-status/) | `TICKETS_AVAILABLE / FEW_TICKETS_LEFT`, **`resaleStatus`** | partner-only (email devportalinquiry@ticketmaster.com) | live | apply — best free scarcity signal |
| [StubHub Catalog/Inventory API](https://developer.stubhub.com/api-reference/catalog/) | min ticket price per event | OAuth2; affiliates@stubhub.com + Partnerize | live | apply |
| [TickPick Partners](https://www.tickpick.com/affiliates/) | API + widgets, no-fee prices | application (domain + traffic) | live | apply |
| [Vivid Seats affiliate](https://www.vividseats.com/affiliates) | inventory access | application | live | apply, low expectations |
| [arXiv 2507.23767](https://arxiv.org/abs/2507.23767) | SeatGeek daily snapshots May 2023–May 2024, ~130k events | email authors | **historical** | ask — a year of category curves |
| [rebrowser/stubhub-dataset](https://github.com/rebrowser/stubhub-dataset) | 138.8M listings, 9.7k events, daily snapshots Mar 2024–Sep 2026 | free for research, paid commercial | **historical** | evaluate research tier |
| [Wikimedia pageviews](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/getting-started.html), Google Trends | per-artist daily attention | free | historical | add as demand feature |
| ESPN hidden JSON, MLB StatsAPI, [balldontlie](https://www.balldontlie.io/) | schedules, standings, injuries | free | live + results | add as demand features for sports |
| [Pollstar Data Cloud](https://pages.pollstar.com/data-cloud) | tickets sold, capacity, gross since 1999 | paid | historical | later |
| Marketplace "price trend" widgets | none exist publicly; SeatGeek Deal Score is a derived 1–10 | — | — | skip |
| Bandsintown / Songkick RSVPs | no public counts | — | — | skip |

Cheapest next steps, in order: fix the Ticketmaster key and ask for Inventory
Status; email StubHub affiliates and apply to TickPick Partners the same day
(both take weeks); add Wikipedia pageviews per performer; email the arXiv
authors for their snapshot set.

## 3. The Clapton case (a worked example)

- Chicago was **not sold out** the night before: ~1,300–4,300 resale listings
  open, get-in $60–$78 across TickPick, Vivid, ETC, AXS. Cheapest date left on
  the run (Milwaukee $84 "high demand", Kansas City $85). Garth Brooks at
  Allstate Arena the same night competes for the same audience. No promo codes.
- Our curve: upper bowl $72 flat for 3 days (one $91 blip); lower bowl $140 ×3
  then $185 — the only rising series.
- Read: upper bowl = classic soft seller, wait for day-of dumping; lower bowl =
  thinning cheap inventory, buy now. No day-of price record exists for the
  Detroit/Cincinnati stops, so the "drops at the door" call is inference from
  inventory depth, not observed precedent. **Log the Sep 11 outcome here.**
