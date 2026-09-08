# Venue mapping brief

Paste this into a fresh Claude Code session in this repo to run the venue-mapping workflow.
It picks up where the 2026-09-08 session left off.

## What exists

- `src/lib/venueNotes.ts` — the guide database. Two kinds of entry:
  - **Venue guides** (`VENUE_GUIDES`, matched on venue name, optionally scoped to one category): Rate Field (MLB), United Center (concerts).
  - **Category guides** (`SPORT_GUIDES`, matched on title/type words): MLB ballparks, arena concerts.
- Each guide has `tiers` (ticket-type names offered in the picker and quoted verbatim to the price sweep), `seating` (one short line per tier with section ranges), `notes` (one-sentence buyer tips, first two shown by default), `sources` (URLs), and `map` (`"ballpark"` → `src/components/VenueMap.tsx`, `"arena"` → `src/components/ArenaMap.tsx`).
- `guideFor({ venue, title, category })` in venueNotes.ts resolves venue first, then category.
- Two agents per venue produced the existing entries: one on seating layout, one on that sport's resale price behavior. Each answered in under 450 words with a URL per claim.

## The job

Run a workflow (`/swarm` or "use a workflow") that produces venue guides in the exact `VenueGuide` shape, then append them to `VENUE_GUIDES`.

Suggested first batch (Chicago first, then the biggest MLB and arena venues):

1. Wrigley Field — MLB (ballpark map)
2. United Center — Bulls/Blackhawks (arena map; the concert entry already exists, scope this one to Sports)
3. Soldier Field — Bears + stadium concerts (needs a `"stadium"` map; see below)
4. Allstate Arena, Rosemont — concerts (arena)
5. Wintrust Arena — concerts / DePaul (arena)
6. Credit Union 1 Amphitheatre, Tinley Park — concerts (needs an `"amphitheater"` map)
7. Huntington Bank Pavilion at Northerly Island — concerts (amphitheater)
8. Yankee Stadium, Dodger Stadium, Fenway Park, Oracle Park, Citi Field — MLB (ballpark)
9. Madison Square Garden, Kia Forum, TD Garden, Crypto.com Arena — concerts (arena)

## Per-venue agent prompt (one agent per venue, Sonnet, web search)

> Research seating and resale pricing at **{venue}, {city}** for **{category / sport}**. Return JSON matching: `{ name, tiers[3-4], seating[{tier, where}], notes[5-7], sources[{label,url}], confidence: low|medium|high }`. Rules: `tiers` cheapest first, named so a price search can price exactly that type (e.g. "Upper deck (500s)", never "cheap seats"). `where` is one short line with section ranges and the value/avoid sections. `notes` are one sentence each: gated levels, sightlines, shade/weather, promo-night effects, parking/transit true cost, resale quirks. No standings or this-week prices. Every concrete claim needs a source URL; say "unconfirmed" rather than invent section numbers.

Add a second, cheap verifier agent per venue that tries to refute section ranges against the official seating chart; drop or mark unconfirmed anything it refutes.

## Maps still to draw

- `"stadium"` (football/soccer/stadium concerts): field in the middle, end-stage variant for concerts.
- `"amphitheater"`: stage, pavilion reserved, lawn GA.
- `"theater"`: orchestra / mezzanine / balcony.
- Golf (`"grounds"`): grounds pass vs hospitality; the Presidents Cup already uses those two tier names.

Keep maps schematic like the two that exist: four zones, tracked zone highlighted, section detail in tooltips.

## Cost note

The watchlist is at its 40-entry cap and the hourly sweep runs three Claude calls per hour (~$0.50). The Anthropic spend cap is $30/month; the US Open sessions (24 entries) end Sep 13 and free most of it.
