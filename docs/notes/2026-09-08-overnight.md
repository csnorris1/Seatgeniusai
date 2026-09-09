# 2026-09-08 → 09 overnight

## Shipped (all on main, auto-deployed)
- **Venue guides: 41.** Batch 1 (16 Chicago + big MLB/arenas) and batch 2 (8 theaters, 6 arenas, 5 ballparks, NBA/NHL/NFL fallbacks, golf). Each from one Opus researcher + one Opus verifier that refuted section ranges against official charts; refuted ranges corrected, non-evergreen notes dropped. Maps: ballpark, arena, stadium, amphitheater, theater, grounds.
- **Seven visual directions** approved by Cory from the design canvas and implemented:
  1. Event detail hero (verdict + price rail + buy/track + tier switcher)
  2. Chart: range toggle, estimated path, cheapest-window band, buy-by marker, stat tiles
  3. Seating maps: section ranges on zones, hover/tap detail strip, ticket-type list with trend
  4. Price Watch: sparklines per ticket type, verdict pills, sort, sticky desktop detail (fixed a real bug)
  5. Mobile: bottom tab bar, open-event action bar, collapsed venue card, quick-search chips
  6. Landing page at `/landing/` (static, live counts from `action=tracked`)
  7. Polish: skeleton cards, no-results suggestions, first-visit tour

## What is estimated vs real
- "Cheapest window" / "predicted low" come from `src/lib/priceWindow.ts`: category resale patterns (concerts dip 12–20d out, MLB final week, NBA/NHL 1–3d out, NFL game day) plus our own 7-day trend. Labelled "est." everywhere. Not a fitted model yet.
- Target price is saved in the browser (localStorage) and flagged in Price Watch when hit. No email/push — that needs backend work.

## Open
- Real alerts (email/push) — backend + SES; also store targets server-side on the tracked entry.
- Sparklines fetch `history` per entry client-side (4 at a time); a `spark` array written by the sweep would be cheaper.
- Point SeatGenius.net at Pages; the landing page is ready to be the root.
- Next venue batch ideas are in `../venue-mapping-brief.md`.

## Reference
- Design canvas: https://claude.ai/code/artifact/77427b16-77a4-4ff8-ab38-77e8216e79bf
- Commits: b3d4075, a05cfd3, d1bfdad, 1938229, 485d761, 44bbdad, 4d0308b
