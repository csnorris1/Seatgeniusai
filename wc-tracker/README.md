# World Cup 2026 Ticket Tracker

Single self-contained HTML app (Road to MetLife). The source of truth lives here at `wc2026-bracket.html`.

## Auto-deploy

Any push to `main` that changes a file under `wc-tracker/` triggers `.github/workflows/deploy-wc.yml`, which uploads the HTML to S3:

**Live URL:** https://seatgenius-wc-tracker.s3.us-east-2.amazonaws.com/wc-tracker.html

No manual `aws s3 cp` needed anymore — edit the file, push, and it deploys.
