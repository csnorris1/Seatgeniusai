# Gotchas

- **Type-check with `npx tsc --noEmit -p tsconfig.app.json`.** The root `tsconfig.json` is a solution file (`"files": []`), so `tsc -p .` checks nothing and exits 0. The vite build (esbuild) does not type-check either.
- **AWS CLI sessions expire.** `aws sts get-caller-identity` says "session has expired" → run `aws login` and finish the browser SSO promptly. Until then the Lambda can't be deployed; keep changes frontend-only.
- **API Gateway caps requests at 29s.** Anything longer (sweeps, multi-batch runs) goes through the Function URL, which needs both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`.
- **Big research workflows exhaust WebSearch.** A 44-agent Opus workflow used the session's 200-search quota part-way through; later agents fell back to WebFetch. Run venue batches in a fresh session, ~20 items each.
- **Map zone keywords matter.** Each schematic map places a ticket type by words in its name (`zoneFor` in each `*Map.tsx`). Four tier names must hit four different zones; theaters are assigned by level order instead. `scratchpad/zonecheck2.tsx` in the 2026-09-08 session was the check; rebuild it if adding many guides.
- **Ambiguous team nicknames.** Rangers, Jets, Panthers, Giants, Cardinals, Kings are left out of the NBA/NHL/NFL regexes so MLB keeps them; events with no `type` field can't be disambiguated.
- **Design changes need a mockup first.** Cory approves visual work from a design canvas before it ships (see 2026-09-08 notes for the approved one).
