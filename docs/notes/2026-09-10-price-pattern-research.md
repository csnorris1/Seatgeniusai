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

## 2b. Done tonight / still pending

- `src/lib/priceWindow.ts`: concert pattern rewritten to the data above
  (single shows bottom day-before/day-of; festival passes ~13 days out;
  concerts need popularity ≥0.85 to count as "high demand"). Shipped.
- `api/search.js`: `log_tracked&event_id=<id>` prices one show only (all its
  ticket types). **Not deployed yet** — AWS SSO had expired; deploy the Lambda
  next session.
- `site-monitor.yml`: fails when no tracked event has a reading in 26h.
- Ticketmaster Discovery key **works now** (200). `priceRanges` is null for
  Live Nation arena shows; status codes and public-sale end times come back
  for every event. Worth polling `dates.status.code` as a sellout/offsale flag.

## 4. Making the price sweep cheaper and better (second pass)

**Costs, from the Anthropic pricing page.** Web *search* is $10 per 1,000
searches on top of tokens; web *fetch* of a known URL is free apart from
tokens. Haiku 4.5 supports both (basic variants; cap size with
`max_content_tokens`, and the URL must appear in the message). Rough cost per
1,000 event reads: today's Sonnet + web search ≈ $36; Haiku + web fetch of a
known page ≈ $5; plain `fetch()` + parse in the Lambda ≈ $0.

**TickPick pages carry the get-in as schema.org data.** The event page returns
200 to a plain request and embeds a JSON-LD `AggregateOffer` with `lowPrice`
(69 tonight), `highPrice` (2,661) and `validFrom` (the render time). No
average or listing count. Caveats: TickPick's terms prohibit automated
collection and its robots.txt disallows `/buy-*-tickets/` (the old URL shape;
the current shape is a grey area). The clean route is the TickPick Partners
program, which advertises an API to approved affiliates. Treat the JSON-LD
read as a stopgap only if Cory accepts that risk. Vivid Seats, SeatGeek and
StubHub pages block plain requests; don't try to get around that.

**Ticketmaster.** Discovery `priceRanges` were removed on 2025-03-11, which
is why every arena show returns null. The replacement is the **Inventory
Status API**: availability status plus price ranges for primary *and resale*
inventory, hourly. Access by emailing devportalinquiry@ticketmaster.com. Draft:

> Subject: Inventory Status API access — SeatGenius
> Hi — I run SeatGenius (seatgenius.net, GitHub Pages app), a buy-timing tool
> that tells fans whether to buy a ticket now or wait. We already use the
> Discovery API (key on account cory@roininc.net) for event lookup and link
> every event to its Ticketmaster page. I'd like access to the Inventory
> Status API to show availability status and primary/resale price ranges for
> the events users track (~40 today, checked at most hourly). Happy to
> describe the integration or sign whatever is needed. Thanks, Cory Norris

**Aggregators.** TicketsData (10 marketplaces, listing counts, $499/mo) is the
best quality and too expensive today. SeatData.io sells historical *sales*
(50M since 2021, "as low as $0.005 per request") — the right source for
fitting category curves later, not for the hourly sweep. Brave/SerpAPI
snippets are cached and stale; skip.

**The free StubHub sample is masked.** Every `minPrice`, `price` and
`ticketsRemaining` in the rebrowser sample is `[PREMIUM]`, so it gives no
curves. Their research tier ("free access to a much larger slice" for
non-commercial use, rebrowser.net/free-datasets-for-research) might; Cory
would have to apply. The arXiv 2507.23767 author (Jonathan R. Landers, no
affiliation listed) has not published the SeatGeek snapshots; email via arXiv.

**Recommended pipeline change, cheapest first** (40 events every 2–6h ≈ 7k
reads/month): (1) read TickPick's JSON-LD or, better, the Partners API for
get-in; (2) move the Claude fallback from web search to Haiku + web fetch of
the known marketplace URL (~$10–15/month instead of ~$260 at full cadence);
(3) send the Ticketmaster email today, apply to TickPick Partners and email
affiliates@stubhub.com the same day — all free, all slow.

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
