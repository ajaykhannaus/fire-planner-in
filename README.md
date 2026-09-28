# FIRE Planner

A private retirement planner for [fire-planner.in](https://fire-planner.in). Everything is calculated in the browser; no account, analytics or server.

- Lean, regular, fat, barista and coast FIRE targets
- Life goals with their own inflation, funding and "closing the gap" routes
- Retirement income streams, withdrawal tax and investment holdings
- Stress testing with 1,000 random-return futures
- Plain-language observations, dark mode, and lakh/crore shorthand (60L, 1.5cr)

## Layout

- `website/dist/` — the static site (HTML, CSS and ES modules, no build step)
- `website/tests/` — calculation tests (`npm test` in `website/`)
- `website/build_artifact.py` — builds a single-file copy for publishing as a claude.ai Artifact
- `ios/` — early SwiftUI app

## Run locally

```bash
cd website
npm test
npm run dev   # http://127.0.0.1:8765
```

Pushing to `main` runs the tests and deploys `website/dist` to GitHub Pages.

Planning scenarios, not financial advice.
