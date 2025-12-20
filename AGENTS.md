# Repository Guidelines

## Project Structure & Module Organization
`frontend/` hosts the Vite + React + TypeScript app. Source code lives in `frontend/src/`, static assets in `frontend/public/`, and Cypress E2E tests in `frontend/cypress/`. `backend/` contains the Flask API (`app.py`), route handlers in `backend/routes/`, shared utilities in `backend/shared/`, and backend tests in `backend/tests/`. The frontend build outputs to `backend/static/` (see `frontend/vite.config.ts`). `infra/` and `scripts/` hold deployment helpers, while `docs/` contains setup notes.

## Build, Test, and Development Commands
- `cp .env.template .env` then `./start.sh` (or `./startwin.sh`) to create the Python venv, install backend and frontend deps, build the UI, and run the backend at `http://127.0.0.1:8000`.
- `cd frontend && npm run dev` to start the Vite dev server with API proxying to the backend.
- `cd frontend && npm run build` to generate production assets into `backend/static/`.
- `cd frontend && npm test` / `npm run test:watch` / `npm run test:coverage` for Jest unit tests.
- `cd frontend && npx cypress run` for E2E tests, and `cd backend && python3 -m pytest` for backend tests (install `backend/requirements-dev.txt`).

## Coding Style & Naming Conventions
TypeScript uses 4-space indentation and double quotes (match existing files like `frontend/src/index.tsx`). Components follow PascalCase (`AnalysisPanel.tsx`) and pair with CSS modules (`AnalysisPanel.module.css`). Python modules use snake_case, and routes should stay in `backend/routes/` with shared helpers in `backend/shared/`.

## Testing Guidelines
Frontend unit tests live next to code as `*.test.ts(x)` and run in Jest’s jsdom environment. Cypress specs live under `frontend/cypress/e2e/*.cy.ts`. Backend tests use pytest and are named `backend/tests/test_*.py`. Add or update tests when changing business logic, API contracts, or UI flows.

## Commit & Pull Request Guidelines
Recent commits use short, imperative subjects; many include prefixes like `fix:` or `HOTFIX/` and ticket IDs such as `FA-1167`. Follow that pattern for new commits. PRs should include a clear summary, testing steps, and screenshots for UI changes; link related issues when applicable.

## Security & Configuration
Keep secrets out of git; use `.env` locally and document any new required keys. Review `SECURITY.md` before reporting vulnerabilities.
