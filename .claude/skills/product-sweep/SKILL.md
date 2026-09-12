---
name: product-sweep
description: Daily improvement sweep of SeatGenius — health checks, four parallel reviews (frontend code, backend + price sweep, product/UX, docs drift), then a ranked findings note. `/product-sweep` reports only; `/product-sweep apply` also ships the safe tier. Use when Cory asks "what could be improved / cleaned up" or to run the daily refinement pass.
---

# Product sweep

One repeatable pass over the whole product. Two modes:

- **report** (default, and the only mode the cloud routine uses): produce the
  findings, ship nothing.
- **apply** (`/product-sweep apply`, laptop only, Cory present): report, then
  fix the *safe tier* in one commit and push to `main` (this repo deploys
  straight from `main`, so a push is a production deploy).

Read `CLAUDE.md`, `docs/notes/README.md` and the **latest** `docs/notes/*-sweep.md`
first. Never re-report an item the last sweep note lists as "deferred by Cory".

## 1. Health checks (always, before any review)

Run these and record pass/fail with the tail of any failure:

```
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
curl -s "$API/search?action=sweep_status"
curl -s "$API/search?action=tracked"
```

`API` = https://vebhfm3r55.execute-api.us-east-2.amazonaws.com. From the
watchlist, flag any entry whose `last_at` is older than **26h**, or older than
2× its cadence (2h inside 48h of the event, 6h inside a week, 24h beyond).
Flag any `sweep_status` batch with an `error`. A stalled sweep outranks every
other finding — it is the product's moat.

## 2. Four reviews in parallel (Agent tool, general-purpose, read-only)

Each reviewer gets: the repo path, "read CLAUDE.md first", its lane, and
"verify every claim by reading the code; cite file:line; max 15 items; each
item = problem, fix, effort S/M/L; do not edit files".

1. **Frontend code** — `src/`: real bugs, dead code, effect/fetch races,
   perf, cheap high-value refactors.
2. **Backend + sweep** — `api/search.js`, `.github/workflows/`: bugs, cost and
   reliability of the hourly sweep, unauthenticated write actions, dead code,
   monitoring gaps.
3. **Product / UX** — the flows in `src/App.tsx` and `public/landing/`:
   misleading copy (estimates presented as data), empty/loading/error states,
   friction to first value, trust gaps, polish; plus 3–5 bigger bets.
4. **Docs drift** — `CLAUDE.md`, `docs/notes/`, `package.json` vs the code:
   stale claims, fixed Known Issues, shipped roadmap items, unused deps.

## 3. Triage into tiers

- **Safe** — no product judgment needed and no behaviour change a visitor would
  notice: lint/type fixes, dead code, unused deps, docs drift, typos, obviously
  wrong labels. `apply` mode ships these.
- **Small** — under an hour, visible, low risk. List with a one-line proposal;
  Cory says go.
- **Bet** — product direction, cost, or architecture. Two sentences each.
- **Deferred by Cory** — carried forward verbatim from the previous note so
  they are not re-raised.

Drop anything a reviewer could not verify. Rank within a tier by value to a
first-time visitor, then by effort.

## 4. Output

Write `docs/notes/YYYY-MM-DD-sweep.md` (plain English, lead with the health
check result, then the tiers, then what `apply` shipped) and add it to the top
of `docs/notes/README.md`. In the cloud routine, open **one GitHub issue**
titled `Sweep YYYY-MM-DD` with the same content instead of committing, and
close the previous sweep issue if it is still open and fully carried forward.

Tell Cory in chat: health status in one line, the top 3 safe items, the top 3
small items, and the one bet worth discussing. Nothing else.

## Guardrails

- The cloud routine never pushes to `main` and never edits the watchlist,
  alerts, or AWS. Report only.
- `apply` never touches `api/search.js` behaviour or the sweep cadence without
  Cory's named yes in the session — a bad deploy there silently stops the
  price history.
- Keep the note free of keys, spend figures and emails (public repo).
