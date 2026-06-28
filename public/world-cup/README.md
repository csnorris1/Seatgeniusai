# World Cup 2026 Ticket Tracker

Single self-contained HTML app (Road to MetLife). The source of truth lives here at `index.html`.

## Hosting

This page is part of the SeatGenius site. Vite serves everything in `public/` at the
site root, so this file is live at:

**Live URL:** https://seatgeniusai.vercel.app/world-cup

It deploys automatically with the rest of the site whenever you push to `main`
(Vercel auto-deploy). No separate pipeline — edit `index.html`, push, done.

The old standalone S3 copy (`seatgenius-wc-tracker.s3...`) and its
`deploy-wc.yml` workflow have been retired in favor of this.
