# 2026-09-13 — Detail panel stripped back to the one question

The site answers one question: when to buy. The event detail panel had grown a
lot of second-order detail around that answer, so today it was cut back.

## What changed

**The hero (`VerdictHero`).** Gone: the "Based on N logged readings over N days"
line, the "Cheapest window … buy by … · est." paragraph in the left column (the
price box on the right already says both), the verdict factor chips, the ticket
type `<select>` that showed before an event was tracked, and the bottom row of
tracked-ticket-type chips with its "+ another type…" picker. The big
"Tracking X · stop" button is now an icon-only bell sitting beside Buy now
(BellRing tracked, BellPlus not, spinner while busy), with a tooltip and an
aria-label. What stays: title/date/venue, deal score, verdict badge + title +
one-line detail, the price box, the whole target-price flow, and Buy now.

**Ticket types moved into "Know before you buy".** The venue guide's seating
list is now the one place ticket types are managed. A row for a tracked type
switches the chart to that curve; a row for an untracked type adds it to the
watchlist when the event is already tracked ("+ track"), and otherwise just
picks which type the bell will start tracking ("+ pick"). Clicking a zone on the
venue map does the same thing as clicking its row.

**One marketplace section.** "Price Comparison Across Platforms" is gone — the
component, the `platforms` state and the `action=compare` fetch with it — because
StubHub and Vivid Seats were permanently "Coming soon" and SeatGeek/Ticketmaster
are already in "Cheapest by marketplace". The SeatGeek/Ticketmaster tier card now
renders nothing when there are no listings instead of an empty-state box.

**Price Watch cards open on any click.** Clicking anywhere on a watchlist card
opens the event — a single card on its first tracked ticket type, a multi-session
group card on its cheapest (or first) session. The ticket-type rows, the group's
tier toggle and the day chips still open exactly what they name (they stop the
click from bubbling). Cards are keyboard-reachable (Enter/Space) and show a hover
ring; the blue selected border is unchanged.

**The AI Analysis button is gone.** "Get AI Buy-Timing Analysis" called
`action=analyze` on every click — a paid Claude call producing prose that repeated
what the verdict already says. Removed from the frontend along with the analysis
card, `parseAnalysis()` and the insight blocks. The Lambda action still exists
(untouched, still budget-capped) so it can be brought back or reused, but nothing
calls it now. `src/lib/buyTiming.ts` is the analysis.

## Still open

- The verdict's confidence wording ("based on N readings") is gone from the UI;
  if a reading count matters to a user we need a quieter place for it.
- Nothing in the app spends on Claude any more except the hourly price sweep.
