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

**Backend:** `api/search.js` and `api/monitor.js` are AWS Lambda handlers (`exports.handler`, CommonJS) deployed behind API Gateway at a hardcoded URL in `App.jsx` (`AWS_URL`). They proxy SeatGeek API calls:
- `action=events&team=<name>` — search MLB events by team name keyword
- `action=listings&event_id=<id>` — get price tiers (from event stats) and buy URL for a specific event
- `action=compare&event_id=<id>` — multi-platform price comparison (SeatGeek live; StubHub/Vivid Seats pending)
- `action=monitor` (monitor Lambda) — hot deals across MLB, ranked by discount vs average price

**AI Analysis:** The frontend calls the Anthropic API directly (no backend proxy) to analyze ticket listings with Claude.

## API Keys & URLs

- AWS API Gateway URL: https://vebhfm3r55.execute-api.us-east-2.amazonaws.com
- SeatGeek Client ID: NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky (active, used for events + listings + comparison)
- Anthropic model: claude-sonnet-4-20250514
- Ticketmaster API Key: removed (was l87nPH1XY6rgyddM3MlzeAJoRGJ30Szk, expired and returning InvalidApiKey errors)

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

## CI / Monitoring

- `.github/workflows/site-monitor.yml` — runs hourly, checks frontend (Vercel) and both API endpoints
- Can also be triggered manually via `workflow_dispatch`
