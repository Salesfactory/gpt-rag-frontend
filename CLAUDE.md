# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a full-stack GPT-RAG application that combines a React 18 + TypeScript frontend (built with Vite) and a Flask backend. The frontend builds into `backend/static` and is deployed together with the backend as a single Azure Web App. The application is part of the larger [GPT-RAG](https://github.com/Azure/gpt-rag) ecosystem.

## Architecture

### Frontend (`frontend/`)
- **Framework**: React 18 with TypeScript, bundled via Vite
- **Structure**:
  - `src/api/`: API client functions for backend communication
  - `src/components/`: Reusable React components with co-located `.module.css` styles
  - `src/pages/`: Top-level page components
  - `src/providers/`: React context providers
  - `src/router/`: Routing configuration
  - `src/utils/`: Utility functions and helpers
  - `src/hooks/`: Custom React hooks
  - `src/assets/` and `src/img/`: Static assets
- **Build Output**: Emits to `../backend/static/`
- **Dev Server**: Runs on default Vite port, proxies API calls to `http://127.0.0.1:8000`

### Backend (`backend/`)
- **Framework**: Flask application with structured routing
- **Main Files**:
  - `app.py`: Main Flask application (imports routes as blueprints)
  - `app_config.py`: Azure AD B2C and Flask configuration
  - `utils.py`: Shared utility functions
  - `auth.py`: Authentication logic
  - `models.py`, `schemas.py`: Data models and validation
- **Routes** (`backend/routes/`): Flask blueprints organized by feature
  - `organizations.py`, `users.py`, `invitations.py`
  - `file_management.py`, `user_documents.py`, `categories.py`
  - `report_jobs.py`, `voice_customer.py`
- **Shared Utilities** (`backend/shared/`):
  - `blob_storage.py`: Azure Blob Storage interactions
  - `cosmo_db.py`: Cosmos DB operations
  - `clients.py`: External service clients
  - `decorators.py`: Route decorators (auth, rate limiting, etc.)
  - `config.py`, `webhook.py`, `error_handling.py`, `idempotency.py`
- **AI/Data Features**:
  - `data_summary/`: AI-powered data summarization (PandasAI integration)
  - `gallery/`: Gallery asset management
  - `report_email_templates/`: Email template rendering
  - `Reports/`: Generated reports storage
- **Static/Templates**:
  - `backend/static/`: Frontend build output (generated, not version-controlled)
  - `backend/templates/`: Flask HTML templates

### Infrastructure
- **Deployment**: Azure Web App deployment via `azd` (see `azure.yaml`)
- **Provisioning**: Disabled in this repo; infrastructure lives in [Azure/GPT-RAG](https://github.com/Azure/GPT-RAG)
- **Scripts**: `start.sh` (Linux/Mac), `startwin.sh` (Windows), `scripts/preprovision.*`

## Development Commands

### Frontend Development
```bash
cd frontend
npm install                  # Install dependencies
npm run dev                  # Start Vite dev server (proxies to backend on :8000)
npm run build               # Production build: tsc + vite build → ../backend/static
npm run watch               # Watch mode: rebuild on changes
```

### Frontend Testing
```bash
npm test                    # Run Jest unit tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Generate coverage report
npx cypress open            # Open Cypress E2E test UI
npx cypress run             # Run E2E tests headless (uses Vite preview on :3000)
```

### Backend Development
```bash
# Setup (first time or after dependency changes)
python3 -m venv backend_env
source backend_env/bin/activate  # Windows: backend_env\Scripts\activate
pip install -r backend/requirements.txt

# Run backend
cd backend
python app.py               # Starts Flask on port 8000
```

### Backend Testing
```bash
cd backend
pytest -q                   # Run all tests
pytest tests/test_*.py      # Run specific test file
```

### Full Stack Local Development
```bash
# 1. Copy and configure environment variables
cp .env.template .env       # Edit with your Azure resource values

# 2. Run the start script (builds frontend + starts backend)
./start.sh                  # Linux/Mac
./startwin.sh              # Windows
```

## Deployment

### Building for Deployment
```bash
# 1. Build frontend
cd frontend
npm install
npm run build              # Outputs to ../backend/static

# 2. Package backend
cd ../backend
rm -rf backend_env         # Remove local venv before packaging

# 3. Create deployment package
cd ..
zip -r deploy.zip backend/* # Linux/Mac
# tar -a -c -f deploy.zip backend/* # Windows

# 4. Deploy to Azure
az webapp deploy \
  --subscription <subscription-id> \
  --resource-group <resource-group> \
  --name <app-name> \
  --src-path deploy.zip \
  --type zip \
  --async true
```

### Azure Deployment (azd)
```bash
azd env refresh            # Sync with existing GPT-RAG infrastructure
azd deploy                 # Deploy (runs prepackage hook: npm install && npm run build)
```

## Code Style & Conventions

### Frontend (TypeScript/React)
- **Formatting**: Prettier with 4-space indent, 160 char line width, no trailing commas (see `frontend/.prettierrc.json`)
- **Components**: Functional components only, use React Hooks
- **Naming**:
  - PascalCase for components and component files
  - camelCase for variables, functions, hooks
  - Co-locate component styles: `Component.tsx` + `Component.module.css`
- **Testing**:
  - Unit tests: `*.test.ts(x)` next to source files
  - E2E tests: `frontend/cypress/e2e/*.cy.ts`
  - Use Jest + jsdom for unit tests (`jest.config.ts`, `setupTests.ts`)

### Backend (Python/Flask)
- **Style**: PEP 8 with 4-space indent
- **Routes**: Organize as blueprints in `backend/routes/`, register in `app.py`
- **Utilities**: Shared helpers in `backend/shared/`, app-specific in `backend/utils.py`
- **Testing**: `backend/tests/test_*.py`, fixtures in `conftest.py`
- **Async Preference**: The codebase uses Flask, but Copilot instructions mention Quart - use async route handlers when appropriate

### Commit Messages
- Imperative mood with optional scope: `feat(frontend): add profile menu`, `fix(backend): handle missing key`

### Pull Requests
- Include clear description, linked issues (`Fixes #123`), screenshots for UI changes
- Verification steps and migration/environment notes
- Keep changes focused; update docs when behavior changes

## Environment Configuration

### Required Environment Variables (`.env`)
```bash
# Orchestrator (GPT-RAG backend)
ORCHESTRATOR_ENDPOINT="http://localhost:7071/api/orc"  # Use local or deployed endpoint

# Azure Resources
AZURE_KEY_VAULT_NAME="your-key-vault-name"
STORAGE_ACCOUNT="your-storage-account-name"
AZURE_DB_ID="your-cosmos-db-account"
AZURE_DB_NAME="your-cosmos-db-database"

# Speech Services
SPEECH_REGION="eastus"
SPEECH_RECOGNITION_LANGUAGE="en-US"
SPEECH_SYNTHESIS_LANGUAGE="en-US"
SPEECH_SYNTHESIS_VOICE_NAME="en-US-AriaNeural"

# Email (SMTP)
EMAIL_SMTP_SERVER="smtp.gmail.com"
EMAIL_SMTP_PORT=587
EMAIL_USER_NAME="your-email@gmail.com"
EMAIL_USER_PASSWORD="your-app-specific-password"

# Azure AD B2C (Authentication)
AAD_TENANT_NAME="your-b2c-tenant"
AAD_POLICY_NAME="B2C_1_signupsignin1"
AAD_CLIENT_ID="your-client-id"
AAD_CLIENT_SECRET="your-client-secret"
FLASK_SECRET_KEY="your-secret-key"

# Stripe (Payments)
# See app_config.py and routes for additional Stripe variables
```

### Security Notes
- **Never commit secrets** - use `.env` for local development
- Production secrets are sourced from Azure Key Vault
- Backend validates required env vars in `app_config.py` and via start scripts
- Clean local venvs before packaging: `rm -rf backend_env`
- Frontend build output (`backend/static/`) is generated, not checked in

## Testing Architecture

### Frontend Tests
- **Unit**: Jest + jsdom, tests co-located with source (`*.test.ts(x)`)
- **E2E**: Cypress with custom config that starts Vite preview server on port 3000
- **Coverage**: `npm run test:coverage`
- **Best Practices**: Fast, isolated tests; mock network calls

### Backend Tests
- **Framework**: pytest
- **Location**: `backend/tests/test_*.py`
- **Fixtures**: `backend/tests/conftest.py`
- **Run**: `cd backend && pytest -q`

## Key Integration Points

### Frontend ↔ Backend Communication
- Vite dev server proxies API calls to Flask (see `frontend/vite.config.ts`)
- API client functions in `frontend/src/api/`
- Backend routes serve JSON; frontend consumes via fetch/axios

### Authentication Flow
- Azure AD B2C integration via `backend/auth.py` and `app_config.py`
- User principal extraction: `utils.get_client_principal()`
- Protected routes use decorators from `shared/decorators.py`

### Storage Integration
- Blob Storage: `shared/blob_storage.py` (BlobStorageManager)
- Cosmos DB: `shared/cosmo_db.py` (organizations, users, conversations, invitations)
- Document management: `routes/user_documents.py`, API docs in `backend/USER_DOCUMENTS_API.md`

### AI Features
- Orchestrator calls: `ORCHESTRATOR_ENDPOINT` for GPT-RAG queries
- Data summarization: `data_summary/` with PandasAI
- Report generation: `routes/report_jobs.py`, templates in `report_email_templates/`

## Common Patterns

### Adding a New Backend Route
1. Create blueprint in `backend/routes/new_feature.py`
2. Import and register in `backend/app.py`: `from routes.new_feature import bp as new_feature` → `app.register_blueprint(new_feature)`
3. Add proxy config in `frontend/vite.config.ts` for dev server
4. Create API client function in `frontend/src/api/`

### Adding Frontend Customization
- **Title**: Edit `frontend/src/pages/layout/Layout.tsx` and `frontend/index.html`
- **Logo**: Update `<Link>` in `Layout.tsx`
- **Citations**: Toggle `showSources` prop in `frontend/src/pages/chat/Chat.tsx`
- **Speech**: Set `speechSynthesisEnabled` in `Chat.tsx`

### Error Handling
- Backend: Use custom exceptions from `shared/error_handling.py`
- Frontend: Handle errors in API client functions, display via toast/modal
- HTTP Status: Import from `http.HTTPStatus` for consistency

## Documentation References
- **User Documents API**: `backend/USER_DOCUMENTS_API.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`
- **Main README**: `README.md` (deployment quickstart)
- **Contributing**: `CONTRIBUTING.md` (team onboarding, PR guidelines)
