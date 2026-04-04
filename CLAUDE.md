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

## Key Conventions

- ESLint rule: unused vars are errors, except those starting with uppercase or underscore (`varsIgnorePattern: '^[A-Z_]'`)
- The Lambda uses `fetch` (Node 18+ built-in), not `https` or axios
- Ticketmaster event IDs are used as-is (no prefixing); SeatGeek is no longer used
