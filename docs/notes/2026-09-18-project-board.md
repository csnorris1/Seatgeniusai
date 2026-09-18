# 2026-09-18 — GitHub project board

Tasks live on the **SeatGenius** project board: https://github.com/users/csnorris1/projects/2
(user project #2, id `PVT_kwHOAkdRWc4Bbk8W`). Same shape as Cory's Roin board, minus the
PR / dev-server columns this repo doesn't have (everything pushes straight to `main`).

Columns (Status field): **Backlog → Selected for Development → In Progress → Needs Cory Review → Done**.
"Needs Cory Review" = shipped to prod, waiting on Cory to confirm before the issue is closed.

Labels: `task` (default), `bug`, `security`, `enhancement`.

Conventions for a session:
- File work as a repo issue with a plain-English title, label it, and add it to the board:
  `gh project item-add 2 --owner csnorris1 --url <issue url>`
- Move it as you go: `gh project item-edit --project-id PVT_kwHOAkdRWc4Bbk8W --id <item id> --field-id PVTSSF_lAHOAkdRWc4Bbk8WzhWUhKQ --single-select-option-id <opt>`
  (option ids: Backlog `4f846e0e`, Selected `f773a598`, In Progress `c0450c91`, Needs Cory Review `f37ff453`, Done `8223c230`; item ids from `gh project item-list 2 --owner csnorris1 --format json`).
- Don't close an issue straight from In Progress — park it in Needs Cory Review.
