# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npm run lint` — ESLint (flat config, ignores `dist/`)
- `npm run preview` — Preview production build locally

## Architecture

SeatGenius is an MLB ticket deal finder. Users pick a team, browse upcoming games from Ticketmaster, view price tiers, and get AI-powered deal analysis via Claude.

**Frontend:** Single-page React 19 app (Vite 8, plain JSX, no TypeScript, no router). All UI lives in `src/App.jsx` — team selection, event list, ticket listings, and AI analysis are rendered as state-driven views within one component. Styles are embedded as a template string in App.jsx (not in CSS files).

**Backend:** `api/search.js` is an AWS Lambda handler (CommonJS `module.exports`, not ESM) deployed behind API Gateway at a hardcoded URL in `App.jsx` (`AWS_URL`). It proxies two Ticketmaster Discovery API calls:
- `action=events&team=<name>` — search MLB events by team name
- `action=listings&event_id=<id>` — get price ranges and buy URL for a specific event

**AI Analysis:** The frontend calls the Anthropic API directly (no backend proxy) to analyze ticket listings with Claude.

## API Keys & URLs

- AWS API Gateway URL: https://vebhfm3r55.execute-api.us-east-2.amazonaws.com
- Ticketmaster API Key: l87nPH1XY6rgyddM3MlzeAJoRGJ30Szk
- SeatGeek Client ID: NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky (keep for reference)
- Anthropic model: claude-sonnet-4-20250514

## Product Roadmap

- Current: MLB only, Ticketmaster data for schedule + prices
- Next: Apply to affiliate programs (SeatGeek, StubHub, Vivid Seats) to get resale data
- Goal: Show side-by-side primary vs secondary market prices so users find the true best deal
- Future: Expand to NBA, NFL, concerts

## Deployment

- Frontend: Vercel (seatgeniusai.vercel.app), auto-deploys on git push to main
- Backend: AWS Lambda + API Gateway
- Domain: SeatGenius.net (registered on Squarespace, not yet connected)
- Repo: github.com/csnorris1/Seatgeniusai

## Known Issues

- Ticketmaster free tier doesn't always return price ranges for all games
- SeatGenius.net domain not yet pointed to Vercel
- Need affiliate program approval for resale pricing data

## Key Conventions

- ESLint rule: unused vars are errors, except those starting with uppercase or underscore (`varsIgnorePattern: '^[A-Z_]'`)
- The Lambda uses `fetch` (Node 18+ built-in), not `https` or axios
- Ticketmaster event IDs are used as-is (no prefixing); SeatGeek is no longer used
