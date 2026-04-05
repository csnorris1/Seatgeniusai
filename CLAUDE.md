# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npm run lint` — ESLint (flat config, ignores `dist/`)
- `npm run preview` — Preview production build locally

## Architecture

SeatGenius is an MLB ticket deal finder. Users pick a team, browse upcoming games from SeatGeek, view price tiers, and get AI-powered deal analysis via Claude.

**Frontend:** Single-page React 19 app (Vite 8, plain JSX, no TypeScript, no router). All UI lives in `src/App.jsx` — team selection, event list, ticket listings, and AI analysis are rendered as state-driven views within one component. Styles are embedded as a template string in App.jsx (not in CSS files).

**Backend:** `api/search.js` is an AWS Lambda handler (`exports.handler`, CommonJS) deployed behind API Gateway at a hardcoded URL in `App.jsx` (`AWS_URL`). All actions route through `/search`:
- `action=events&team=<name>` — search MLB events by team name keyword, enriched with Ticketmaster prices
- `action=listings&event_id=<id>` — get price tiers (SeatGeek stats + Ticketmaster primary market) and buy URLs
- `action=compare&event_id=<id>` — multi-platform price comparison (SeatGeek + Ticketmaster live; StubHub/Vivid Seats pending)
- `action=monitor` — hot deals across MLB, ranked by discount vs average price

**AI Analysis:** The frontend calls the Anthropic API directly (no backend proxy) to analyze ticket listings with Claude.

## API Keys & URLs

- AWS API Gateway URL: https://vebhfm3r55.execute-api.us-east-2.amazonaws.com
- SeatGeek API Base: https://api.seatgeek.com/2
- SeatGeek Client ID: NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky (active, used for events + listings + comparison)
- Ticketmaster API Base: https://app.ticketmaster.com/discovery/v2
- Ticketmaster API Key: l87nPH1XY6rgyddM3MlzeAJoRGJ30Szk (active, used for primary market pricing in listings + compare)
- Anthropic API Endpoint: https://api.anthropic.com/v1/messages (called directly from frontend)
- Anthropic model: claude-sonnet-4-20250514

## Product Roadmap

- Current: MLB only, SeatGeek data for schedule + prices, multi-platform comparison UI, hot deals monitor
- Next: Apply to affiliate programs (StubHub, Vivid Seats) for live resale data
- Goal: Show side-by-side primary vs secondary market prices so users find the true best deal
- Future: Expand to NBA, NFL, concerts

## Deployment

- Frontend: Vercel (seatgeniusai.vercel.app), auto-deploys on git push to main
- Backend: AWS Lambda + API Gateway
- Domain: SeatGenius.net (registered on Squarespace, not yet connected)
- Repo: github.com/csnorris1/Seatgeniusai

## Known Issues

- SeatGeek free tier doesn't always return price stats for all games (fallbacks added: lowest_sg_base_price, average_price)
- SeatGenius.net domain not yet pointed to Vercel
- Need affiliate program approval for resale pricing data

## Key Conventions

- ESLint rule: unused vars are errors, except those starting with uppercase or underscore (`varsIgnorePattern: '^[A-Z_]'`)
- The Lambda uses `fetch` (Node 18+ built-in), not `https` or axios
- SeatGeek event IDs are used as-is (no prefixing)

## Daily Standup Command

When asked to run a standup or daily check-in:
1. Check GitHub Issues for the repo (`csnorris1/Seatgeniusai`) — list open issues sorted by priority
2. Identify which issues are actionable now (not blocked, not waiting on external dependencies)
3. Pick the highest-priority unblocked issue and begin work
4. Report: what was done last session, what's planned now, and any blockers

## Agent Behavior

- Always commit and push directly to `main`. Never create pull requests. Never ask for PR approval.
- Before starting any task, check GitHub Issues for `csnorris1/Seatgeniusai` to see if there's a relevant open issue.
- Skip issues that are blocked (labeled `blocked`, or depend on external actions like affiliate approvals).
- Work autonomously — pick up the next actionable issue, implement, commit, and push.
- If an issue requires manual action (e.g., signing up for an API, configuring DNS), label it and move on.

## Task Labeling Convention

Use these prefixes in commit messages and issue comments to indicate who did the work:

- 🤖 **AGENT** — Work done autonomously by Claude Code (e.g., `🤖 AGENT: Add hot deals endpoint`)
- 👤 **MANUAL** — Work done by a human (e.g., `👤 MANUAL: Configure DNS for SeatGenius.net`)

This makes it easy to audit the git log and see what was automated vs. manual.

## Git Workflow

Always commit and push directly to main branch. Never create pull requests. Never ask for PR approval.

## CI / Monitoring

- `.github/workflows/site-monitor.yml` — runs hourly, checks frontend (Vercel) and both API endpoints
- Can also be triggered manually via `workflow_dispatch`
