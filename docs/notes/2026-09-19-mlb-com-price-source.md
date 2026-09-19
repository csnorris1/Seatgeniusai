# 2026-09-19 — MLB.com as a sweep price source

Cory noticed Cubs tickets mostly sell on MLB.com (the team page, cubs.com, is the same
thing): primary via Tickets.com plus the club's own verified resale marketplace. The
sweep prompt only named aggregators (SeatGeek, StubHub, TickPick, Vivid Seats, SeatPick,
Gametime), so an MLB game's logged get-in could sit above what a fan actually pays.

What changed:
- The frontend now sends the SeatGeek `type` (e.g. `mlb`) on every `track` call and the
  Lambda stores it on the watchlist entry (`type`, inherited by extra tiers).
- The sweep adds an MLB rule when any event in the batch has `type === 'mlb'`: also check
  the home team's MLB.com ticket page and report that price as `p` if it beats the
  marketplaces. Entries tracked before today have no `type`, so they don't get the rule
  (re-tracking sets it).
- Same day: the verdict hero's track button got its "Track price" label back — the
  icon-only bell from the spacing tightening wasn't findable.
