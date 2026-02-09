# Engineering Standards: Coding & Testing Guidelines

Practical, enforceable standards for this React + TypeScript / Python + Flask codebase.
Every guideline here exists because it prevents real bugs, reduces review friction, or improves long-term maintainability.

---

## Table of Contents

1. [General Principles](#1-general-principles)
2. [Frontend — TypeScript & React](#2-frontend--typescript--react)
3. [Backend — Python & Flask](#3-backend--python--flask)
4. [Testing Strategy](#4-testing-strategy)
5. [Frontend Testing](#5-frontend-testing)
6. [Backend Testing](#6-backend-testing)
7. [API Contract & Integration](#7-api-contract--integration)
8. [Security](#8-security)
9. [Performance](#9-performance)
10. [Git & Code Review](#10-git--code-review)
11. [Error Handling](#11-error-handling)

---

## 1. General Principles

### 1.1 Write Code for the Reader
Code is read far more often than it is written. Optimize for clarity over cleverness.

- Name things by what they **represent**, not what they **do internally**.
- A function should do one thing. If the name needs "and", split it.
- Prefer explicit over implicit — a few extra lines of clear code beats a one-liner that requires a comment.

### 1.2 Keep Changes Focused
- One PR = one logical change. Bug fix and refactor belong in separate PRs.
- Don't clean up unrelated code in the same commit — it obscures the meaningful diff.

### 1.3 Fail Fast, Fail Loud
- Validate inputs at system boundaries (API endpoints, user input, external data).
- Throw or return errors immediately — don't let invalid state propagate.
- Never silently swallow exceptions.

### 1.4 Minimize Surface Area
- Export only what is consumed externally.
- Prefer private/internal functions for implementation details.
- Delete dead code — don't comment it out.

---

## 2. Frontend — TypeScript & React

### 2.1 Formatting & Tooling

Enforced via Prettier (see `.prettierrc.json`):
- **4-space indentation**
- **160-character line width**
- **No trailing commas**
- **No parentheses on single arrow params** (`x => x`, not `(x) => x`)

TypeScript strict mode is enabled. Do not add `@ts-ignore` or `any` without a justifying comment.

### 2.2 Component Structure

```
ComponentName/
  ComponentName.tsx          # Component logic
  ComponentName.module.css   # Scoped styles
  ComponentName.test.tsx     # Unit tests (when applicable)
  index.ts                   # Barrel export (optional)
```

**Rules:**
- Functional components only — no class components.
- Define `interface Props` (or `type Props`) at the top of every component file.
- Destructure props in the function signature.
- One exported component per file.

```tsx
interface Props {
    title: string;
    isActive: boolean;
    onToggle: (id: string) => void;
}

export const MyComponent = ({ title, isActive, onToggle }: Props) => {
    // ...
};
```

### 2.3 TypeScript Patterns

**Do:**
- Use discriminated unions for state variants instead of multiple booleans.
- Use `const enum` for fixed sets of string values.
- Use type guards (`value is Type`) over type assertions (`value as Type`).
- Define API types in `src/api/models.ts`, app-wide types in `src/types.ts`.

**Don't:**
- Use `any` — prefer `unknown` and narrow with type guards.
- Use `!` (non-null assertion) — handle the null case explicitly.
- Re-export types that are only used internally.

```tsx
// Prefer discriminated unions over boolean flags
type UploadState =
    | { status: "idle" }
    | { status: "uploading"; progress: number }
    | { status: "success"; url: string }
    | { status: "error"; message: string };
```

### 2.4 Hooks & State Management

**State hierarchy (use the simplest option that works):**
1. `useState` — local UI state (toggles, form values)
2. `useReducer` — complex local state with multiple transitions (e.g., multi-step flows)
3. Context (`useAppContext`) — shared app state (user, org, settings)

**Rules:**
- Wrap expensive computations in `useMemo` with correct dependency arrays.
- Wrap event handlers passed to children in `useCallback`.
- Always clean up effects: cancel `AbortController`, clear timeouts, unsubscribe listeners.
- Custom hooks must start with `use` and return a consistent object shape.

```tsx
// Good: AbortController cleanup
useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal).then(setData);
    return () => controller.abort();
}, [dependency]);
```

### 2.5 CSS Modules

- Import as `import styles from "./Component.module.css"`.
- Use `className={styles.myClass}` — never hardcoded strings.
- Use camelCase class names: `.answerContainer`, not `.answer-container`.
- Prefer CSS Grid/Flexbox over absolute positioning.
- Always add `@media (prefers-reduced-motion: reduce)` for animations.
- Use responsive breakpoints consistently.

### 2.6 Import Organization

Order imports top to bottom:
1. React and third-party libraries
2. Internal absolute imports (`@/...`)
3. Relative imports (components, utils)
4. Style imports (`.module.css`)

Use barrel exports (`index.ts`) for public APIs of feature folders.

---

## 3. Backend — Python & Flask

### 3.1 Style & Formatting

- **PEP 8** with 4-space indentation.
- Use type hints on all public function signatures.
- Use `from __future__ import annotations` for forward references.
- Use f-strings for string formatting — never `%` or `.format()`.

### 3.2 Route Organization

Every feature gets its own blueprint in `backend/routes/`:

```python
# routes/categories.py
bp = Blueprint("categories", __name__, url_prefix="/api/categories")

@bp.post("")
@auth_required
def create_category():
    ...
```

**Rules:**
- One blueprint per feature domain.
- Register all blueprints in `app.py`.
- Use proper HTTP methods: `GET` for reads, `POST` for creates, `PUT` for updates, `DELETE` for deletes.
- Always decorate protected routes with `@auth_required`.
- Extract `organization_id` through the helper `_require_organization_id()`.

### 3.3 Configuration

- Use `shared/config.py` `Settings` dataclass for Azure resource configuration.
- Use `app_config.py` for Flask-specific settings.
- Never hardcode secrets, connection strings, or resource names.
- All config comes from environment variables with sensible defaults where safe.

```python
@dataclass(frozen=True)
class Settings:
    storage_account: str = os.getenv("STORAGE_ACCOUNT", "")

    @property
    def blob_account_url(self) -> str:
        return f"https://{self.storage_account}.blob.core.windows.net"
```

### 3.4 Database Access (Cosmos DB)

- Always use parameterized queries — never concatenate user input into query strings.
- Always supply the partition key (`organization_id`).
- Use `enable_cross_partition_query=True` only when absolutely necessary and document why.
- Handle `CosmosResourceNotFoundError` explicitly and return proper HTTP 404.
- Access containers through `clients.get_cosmos_container()`.

```python
# Good: parameterized query
query = "SELECT * FROM c WHERE c.organization_id = @org_id AND c.type = @type"
parameters = [
    {"name": "@org_id", "value": org_id},
    {"name": "@type", "value": item_type}
]
items = container.query_items(query=query, parameters=parameters)
```

### 3.5 Client Management

- Use `@lru_cache` for expensive Azure client instantiation.
- Use `cachetools.TTLCache` for time-sensitive data (JWKS keys, tokens).
- Initialize clients lazily via `@app.before_first_request`.

### 3.6 Decorators

Use the decorator factory pattern for cross-cutting concerns:

```python
def check_organization_limits():
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # validation logic
            return f(*args, **kwargs)
        return decorated_function
    return decorator
```

Stack decorators in a consistent order: `@bp.route` → `@auth_required` → `@check_limits`.

---

## 4. Testing Strategy

### 4.1 The Testing Pyramid

```
        /  E2E  \          Cypress — critical user flows only
       /----------\
      / Integration \       API contract tests, component integration
     /----------------\
    /    Unit Tests     \   Pure functions, reducers, utilities, route handlers
   /______________________\
```

**Coverage targets:**
- **Unit tests**: Every utility function, every reducer, every data transformation.
- **Integration tests**: Route handlers with mocked dependencies.
- **E2E tests**: Core user journeys (login, main workflow, error states).

### 4.2 What to Test

| Always test | Sometimes test | Don't test |
|---|---|---|
| Business logic & transformations | Component rendering with props | Third-party library internals |
| State reducers (every action type) | Hook behavior with mock data | CSS styles and layout |
| API response parsing | Error boundaries | Getter/setter pass-through |
| Input validation | Conditional rendering | Implementation details |
| Error paths & edge cases | Route protection logic | Framework boilerplate |

### 4.3 Test Quality Rules

1. **One assertion per behavior** — a test should verify one specific behavior, not dump multiple unrelated checks.
2. **Descriptive names** — `it('returns empty string when input is null')`, not `it('works')`.
3. **Arrange-Act-Assert** (AAA) — separate setup, execution, and verification.
4. **No logic in tests** — no conditionals, no loops. Tests must be linear and predictable.
5. **Deterministic** — no reliance on time, network, random data, or execution order.
6. **Fast** — unit tests must run in under 1 second each. If slow, you're testing too much.

---

## 5. Frontend Testing

### 5.1 Unit Tests (Jest + jsdom)

Tests are co-located with source files: `formattingUtils.ts` → `formattingUtils.test.ts`.

**Structure:**
```tsx
describe("functionName", () => {
    it("returns expected value for typical input", () => {
        expect(functionName("input")).toBe("expected");
    });

    it("handles null gracefully", () => {
        expect(functionName(null)).toBe("");
    });

    it("throws on invalid input", () => {
        expect(() => functionName(-1)).toThrow("must be positive");
    });
});
```

**What to unit test:**
- Pure utility functions (`formattingUtils`, `fileUtils`, `currencyUtils`)
- Parsing logic (`parseAnswerToHtml`, `parseThoughts`, `streamParser`)
- Reducer functions (every action type, invalid action)
- Type guards and validators

**Mocking:**
- Mock API calls — never hit real endpoints in unit tests.
- Use `jest.fn()` for callback props.
- Prefer dependency injection over module mocking when possible.

### 5.2 Component Tests

When testing components, test **behavior**, not implementation:

```tsx
// Good: tests what the user sees
it("displays error message when submission fails", () => {
    render(<Form onSubmit={mockSubmit} />);
    fireEvent.click(screen.getByText("Submit"));
    expect(screen.getByRole("alert")).toHaveTextContent("Required field");
});

// Bad: tests implementation details
it("sets isError state to true", () => {
    // Don't test internal state directly
});
```

### 5.3 E2E Tests (Cypress)

Located in `frontend/cypress/e2e/*.cy.ts`. The Cypress config starts a Vite preview server on port 3000.

**Rules:**
- Test complete user journeys, not individual components.
- Use `data-testid` attributes for selectors — never CSS classes or DOM structure.
- Each test must be independent — no shared state between tests.
- Keep E2E tests to critical paths: login, core workflow, error recovery.
- Use Cypress commands for repeated actions (custom commands in `cypress/support/`).

```ts
// Good: stable selector
cy.get('[data-testid="submit-button"]').click();

// Bad: brittle selector
cy.get('.btn-primary.form-submit > span').click();
```

### 5.4 Running Frontend Tests

```bash
cd frontend
npm test                  # Run all unit tests
npm run test:watch        # Watch mode during development
npm run test:coverage     # Coverage report
npx cypress open          # Interactive E2E development
npx cypress run           # Headless E2E (CI)
```

---

## 6. Backend Testing

### 6.1 Test Organization

Tests live in `backend/tests/test_*.py` with shared fixtures in `conftest.py`.

### 6.2 Fixture Patterns

**Flask test client:**
```python
@pytest.fixture
def app(monkeypatch):
    # Patch external dependencies BEFORE importing blueprints
    monkeypatch.setattr(clients_mod, "get_cosmos_container", lambda name: fake_container)

    app = Flask(__name__)
    app.register_blueprint(bp)
    return app

@pytest.fixture
def client(app):
    return app.test_client()
```

**Fake Cosmos containers:**
```python
class FakeContainer:
    def __init__(self):
        self.store = {}

    def create_item(self, doc):
        key = (doc["organization_id"], doc["id"])
        self.store[key] = dict(doc)
        return dict(doc)

    def read_item(self, item, partition_key):
        key = (partition_key, item)
        if key not in self.store:
            raise NotFoundError("not found")
        return dict(self.store[key])

    def query_items(self, query, parameters, partition_key=None):
        # Minimal filter logic for tests
        return iter(self.store.values())
```

### 6.3 Mocking Strategy

- **Environment variables**: Set via `monkeypatch` or `os.environ` in `conftest.py` before imports.
- **Auth decorator**: Replace with a passthrough mock at module level for route testing.
- **Azure services**: Use fake implementations (FakeContainer, fake_get_secret) that implement the same interface.
- **External APIs**: Use `unittest.mock.patch` for third-party service calls.

**Order matters**: Patch environment and modules **before** importing the code under test.

```python
# conftest.py
os.environ["ENVIRONMENT"] = "TEST"
os.environ["AZURE_DB_ID"] = "test_db_id"

# Then import routes
from routes.categories import bp
```

### 6.4 What to Test in Routes

```python
def test_create_category_returns_201(client):
    resp = client.post("/api/categories", json={
        "name": "Test Category",
        "organization_id": "org-1"
    })
    assert resp.status_code == 201
    assert resp.get_json()["data"]["name"] == "Test Category"

def test_create_category_missing_field_returns_400(client):
    resp = client.post("/api/categories", json={"organization_id": "org-1"})
    assert resp.status_code == 400
    assert "Missing required" in resp.get_json()["error"]["message"]

def test_get_nonexistent_category_returns_404(client):
    resp = client.get("/api/categories/nonexistent?organization_id=org-1")
    assert resp.status_code == 404
```

### 6.5 Running Backend Tests

```bash
cd backend
pytest -q                           # All tests, quiet output
pytest tests/test_categories.py     # Single file
pytest -k "test_create"             # Pattern matching
pytest --tb=short                   # Shorter tracebacks
```

---

## 7. API Contract & Integration

### 7.1 Request/Response Standards

**Success response:**
```json
{
    "data": { ... },
    "status": 200
}
```

**Error response:**
```json
{
    "error": {
        "message": "Human-readable description",
        "status": 400,
        "code": "MISSING_REQUIRED_FIELD"
    }
}
```

### 7.2 Frontend API Client Rules

- All API functions live in `src/api/api.ts`.
- All request/response types live in `src/api/models.ts`.
- Use `fetchWrapper` for all API calls (handles session expiration automatically).
- Always include proper `Content-Type` and auth headers.
- Handle errors at the call site — don't let unhandled promise rejections propagate.

### 7.3 Vite Dev Proxy

API calls are proxied to the Flask backend during development. New route prefixes must be added to `vite.config.ts`:

```ts
proxy: {
    "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
    }
}
```

---

## 8. Security

### 8.1 Frontend

- **Sanitize all rendered HTML** with DOMPurify — no `dangerouslySetInnerHTML` without it.
- **Never store secrets** in frontend code or localStorage.
- **Validate file uploads** on the client (type, size) before sending.
- **Use `credentials: "include"`** for API calls requiring auth (handled by `fetchWrapper`).

### 8.2 Backend

- **Parameterize all database queries** — never concatenate user input.
- **Validate file signatures** — don't trust file extensions or `Content-Type` headers alone.
- **Check authorization** on every route — `@auth_required` decorator + org membership verification.
- **Prevent path traversal** — sanitize file paths, never use user input directly in filesystem operations.
- **Rate limit endpoints** — use Flask-Limiter on public-facing routes.
- **Never log secrets** — redact tokens, keys, and passwords from log output.

### 8.3 Environment & Secrets

- Secrets go in `.env` locally, Azure Key Vault in production.
- Never commit `.env`, credentials, or connection strings.
- Rotate secrets on any suspected exposure.

---

## 9. Performance

### 9.1 Frontend

- **Memoize expensive computations** (`useMemo`) — markdown parsing, large list filtering.
- **Stabilize callbacks** (`useCallback`) — especially those passed as props to child components.
- **Lazy load heavy components** — use `React.lazy()` for routes not needed on initial load.
- **Cancel abandoned requests** — `AbortController` in every `useEffect` that fetches data.
- **Optimize images** — use appropriate formats, lazy load below-the-fold images.
- **Respect reduced motion** — conditionally disable animations via CSS media query.

### 9.2 Backend

- **Cache Azure clients** — `@lru_cache` for credentials, Cosmos clients, container references.
- **Cache JWKS keys** — TTL-based cache (24h) to avoid hitting the discovery endpoint on every request.
- **Use partition keys** — every Cosmos query should target a specific partition.
- **Avoid cross-partition queries** — design data model to colocate related data.
- **Validate message sizes** — check against queue limits (64 KiB) before enqueueing.
- **Stream large responses** — don't buffer entire result sets in memory.

---

## 10. Git & Code Review

### 10.1 Commit Messages

Use imperative mood with optional scope:

```
feat(frontend): add file upload progress indicator
fix(backend): handle missing organization_id in categories
refactor(shared): extract blob validation into helper
test(routes): add coverage for report job edge cases
docs: update API contract for categories endpoint
```

### 10.2 Branch Strategy

- `main` — production-ready code
- `develop` — integration branch
- Feature branches: `feature/FA-XXXX-short-description`
- Bugfix branches: `fix/FA-XXXX-short-description`

### 10.3 Pull Request Checklist

Before requesting review, verify:

- [ ] Code compiles with no TypeScript/type errors
- [ ] All existing tests pass (`npm test` and `pytest -q`)
- [ ] New logic has corresponding tests
- [ ] No `console.log`, debug prints, or commented-out code
- [ ] Error paths are handled, not just the happy path
- [ ] API changes are reflected in both frontend types and backend schemas
- [ ] No secrets, tokens, or credentials in the diff
- [ ] PR description includes: what changed, why, how to verify
- [ ] Screenshots attached for UI changes

### 10.4 Code Review Standards

**Reviewers should check for:**
- Correctness: Does it do what it claims?
- Edge cases: What happens with empty, null, duplicate, or oversized input?
- Security: Is user input validated? Are queries parameterized?
- Consistency: Does it follow existing patterns in the codebase?
- Testability: Can the new code be tested in isolation?

**Reviewers should NOT block on:**
- Style preferences already handled by Prettier/PEP 8
- Alternative approaches that are equally valid
- Minor naming disagreements

---

## 11. Error Handling

### 11.1 Frontend Error Handling

- Use toast notifications (`react-toastify`) for transient user-facing errors.
- Use error boundaries for component-level crash recovery.
- Centralize error message strings in `errorMessages.ts`.
- Log errors to console in development only (`debugLog()`).

```tsx
try {
    const result = await fetchWrapper("/api/resource");
    setData(result);
} catch (error) {
    toast.error(getErrorMessage(error));
}
```

### 11.2 Backend Error Handling

- Use the custom exception hierarchy from `shared/error_handling.py`.
- Return errors through `create_error_response()` for consistent format.
- Include machine-readable error codes for frontend consumption.
- Log at appropriate levels: `WARNING` for client errors, `ERROR` for server errors, `EXCEPTION` for unexpected failures.

```python
from shared.error_handling import (
    MissingRequiredFieldError,
    create_error_response
)

@bp.post("")
@auth_required
def create_item():
    data = request.get_json(silent=True)
    if not data or "name" not in data:
        return create_error_response(
            "Missing required field: name",
            HTTPStatus.BAD_REQUEST,
            "MISSING_REQUIRED_FIELD"
        )
```

### 11.3 Error Code Convention

Define error codes as constants, uppercase with underscores:

```python
ERROR_CODE_UNAUTHORIZED_ORG = "FORBIDDEN_ORGANIZATION_ACCESS"
ERROR_CODE_USER_LIMIT_EXCEEDED = "USER_QUOTA_EXCEEDED"
ERROR_CODE_MISSING_FIELD = "MISSING_REQUIRED_FIELD"
```

Frontend can switch on these codes to show context-specific messages.

---

## Quick Reference

| Area | Frontend | Backend |
|---|---|---|
| **Formatting** | Prettier (4-space, 160 chars) | PEP 8 (4-space) |
| **Types** | TypeScript strict mode | Type hints + Pydantic |
| **Components** | Functional + Props interface | Blueprint + decorators |
| **State** | useState / useReducer / Context | Frozen Settings dataclass |
| **Testing** | Jest co-located + Cypress E2E | pytest + FakeContainer fixtures |
| **Error format** | Toast + errorMessages.ts | create_error_response() + error codes |
| **Auth** | fetchWrapper auto-401 handling | @auth_required + org verification |
| **Caching** | useMemo / useCallback | @lru_cache / TTLCache |
| **Security** | DOMPurify for HTML | Parameterized queries + file validation |
