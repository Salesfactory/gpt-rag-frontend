# Session Expiration Implementation Comparison

## Branch: FA-1106-handle-user-session-expiration-gracefully vs. Current Implementation

This document compares two approaches to handling session expiration in the GPT RAG Frontend application.

---

## Executive Summary

| Aspect | Branch Implementation | Current Implementation |
|--------|----------------------|------------------------|
| **Approach** | Toast notification (non-blocking) | Blocking modal |
| **Architecture** | Global fetch monkey-patching | Wrapper-based interception |
| **User Experience** | Non-intrusive toast with refresh button | Full-screen blocking modal |
| **Session Validation** | None (immediate toast on 401) | Validates session before showing modal |
| **Backend Changes** | None | Session status endpoint + timeout config |
| **Integration Point** | `index.tsx` + `App.tsx` wrapper | `AppProviders.tsx` context integration |
| **Complexity** | Low | Medium |
| **False Positives** | Possible (any 401 triggers toast) | Prevented (validates session first) |

---

## Detailed Comparison

### 1. **Backend Implementation**

#### Branch FA-1106 (`backend/app.py`)
```python
# NO BACKEND CHANGES
# - No session timeout configuration
# - No session validation endpoint
# - Relies entirely on frontend detection
```

**Pros:**
- ✅ No backend changes required
- ✅ Simple to implement

**Cons:**
- ❌ No explicit session timeout
- ❌ No way to validate session state
- ❌ Cannot distinguish between expired session and temporary auth issues

---

#### Current Implementation (`backend/app.py` + `app_config.py`)
```python
# app_config.py
PERMANENT_SESSION_LIFETIME = 3600  # 1 hour explicit timeout

# app.py
@app.route("/api/auth/session/status")
@auth.login_required
def check_session_status(*, context: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """Lightweight endpoint to validate session without fetching full user data"""
    return jsonify({"valid": True, "user_id": context.get("user", {}).get("oid")}), 200
```

**Pros:**
- ✅ Explicit session timeout (predictable behavior)
- ✅ Session validation endpoint (prevents false positives)
- ✅ Can distinguish transient errors from true expiration

**Cons:**
- ❌ Requires backend changes
- ❌ Additional API endpoint to maintain

---

### 2. **401 Interception Mechanism**

#### Branch FA-1106 (`SessionMonitorProvider.tsx`)
```typescript
// Monkey-patches global fetch function
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await originalFetch(...args);
    if (res.status === 401) {
        // Immediately dispatch event without validation
        window.dispatchEvent(new CustomEvent('api-unauthorized', {
            detail: { url: args[0] }
        }));
    }
    return res;
};
```

**Architecture:**
- Modifies global `window.fetch` at application startup
- Fires custom DOM event on any 401 response
- No session validation before notifying user

**Pros:**
- ✅ Catches ALL fetch calls automatically (no migration needed)
- ✅ Simple implementation (~70 lines)
- ✅ Works immediately without changing existing code

**Cons:**
- ❌ **Monkey-patching anti-pattern** (modifies global built-in)
- ❌ **No validation** (false positives from transient 401s)
- ❌ **Potential conflicts** with other libraries that wrap fetch
- ❌ **Hard to test** (global state mutation)
- ❌ **Hard to debug** (invisible fetch modification)
- ❌ **No TypeScript safety** (loses type information)

---

#### Current Implementation (`fetchWrapper.ts`)
```typescript
// Wrapper function that enhances fetch
export async function fetchWrapper(
    url: string,
    options: FetchWrapperOptions = {}
): Promise<Response> {
    const response = await fetch(url, { ...options, credentials: "include" });

    if (response.status === 401 && !skipAuthCheck) {
        // Validate session before showing modal
        const isSessionValid = await validateSession();

        if (!isSessionValid) {
            // Truly expired - trigger modal
            sessionExpirationHandler.onSessionExpired();
        } else {
            // Transient error - retry request
            return fetch(url, options);
        }
    }
    return response;
}
```

**Architecture:**
- Wrapper function that API functions explicitly use
- Validates session state before notifying user
- Retries request if session is actually valid

**Pros:**
- ✅ **No global mutation** (functional approach)
- ✅ **Validates session** (prevents false positives)
- ✅ **Retry logic** (handles transient errors gracefully)
- ✅ **TypeScript-safe** (preserves types)
- ✅ **Testable** (pure function)
- ✅ **Debuggable** (explicit wrapper calls visible in stack trace)

**Cons:**
- ❌ Requires migrating API functions to use wrapper
- ❌ More complex implementation (~140 lines)
- ❌ Only works for functions using fetchWrapper (gradual migration needed)

---

### 3. **User Interface**

#### Branch FA-1106 (`SessionMonitorProvider.tsx`)
```typescript
const sessionExpiredToast = (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div>The session has expired.</div>
        <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => window.location.reload()}
                    style={{ /* inline styles */ }}>
                Refresh
            </button>
        </div>
    </div>
);

toast(sessionExpiredToast, {
    type: "error",
    autoClose: 8000,  // Auto-dismisses after 8 seconds
    closeOnClick: false
});
```

**UI Characteristics:**
- **Type:** Toast notification (top-right corner)
- **Blocking:** No - user can continue interacting with app
- **Dismissible:** Yes - auto-closes after 8 seconds
- **Actions:** Single "Refresh" button
- **Visual:** Small red toast with inline-styled button
- **z-index:** 99999 (via ToastContainer)

**User Experience Flow:**
1. User triggers API call → 401 response
2. Toast appears in corner for 8 seconds
3. User can click "Refresh" or ignore
4. **User can continue working** (potentially losing data)
5. Toast auto-dismisses after 8 seconds

**Pros:**
- ✅ **Non-intrusive** (doesn't block workflow)
- ✅ **Simple** (leverages existing toast system)
- ✅ **Quick implementation** (~50 lines total)

**Cons:**
- ❌ **NOT blocking** - user can continue making failed requests
- ❌ **Auto-dismisses** - user might miss the notification
- ❌ **Inline styles** - no external CSS, harder to theme
- ❌ **No logout option** - only refresh available
- ❌ **No warning about data loss**
- ❌ **Silent failures possible** - requests after toast dismissal

---

#### Current Implementation (`SessionExpiredModal.tsx`)
```typescript
<div className={styles.overlay} onClick={e => e.stopPropagation()}>
    <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
            <h2>Session Expired</h2>
            <svg className={styles.warningIcon}>{/* Warning icon */}</svg>
        </div>

        <div className={styles.content}>
            <p>Your session has expired due to inactivity.</p>
            <p className={styles.subMessage}>
                Any unsaved work may be lost. Please save your work before
                refreshing if possible.
            </p>
        </div>

        <div className={styles.footer}>
            <button onClick={onLogout}>Logout</button>
            <button onClick={onRefresh}>Refresh Session</button>
        </div>
    </div>
</div>
```

**UI Characteristics:**
- **Type:** Full-screen modal dialog
- **Blocking:** Yes - prevents all interactions
- **Dismissible:** No - user must choose action
- **Actions:** "Refresh Session" (primary) and "Logout" (secondary)
- **Visual:** Professional modal with external CSS module
- **z-index:** 9999 (dedicated modal layer)
- **Accessibility:** ARIA labels and roles

**User Experience Flow:**
1. User triggers API call → 401 response
2. System validates session → confirms expiration
3. Modal covers entire screen
4. **User cannot interact** until choosing action
5. User clicks "Refresh Session" → page reloads
6. OR user clicks "Logout" → redirects to logout

**Pros:**
- ✅ **Blocking** - prevents failed requests
- ✅ **Cannot be dismissed accidentally**
- ✅ **Two clear actions** (refresh or logout)
- ✅ **Data loss warning** (informs user of risks)
- ✅ **Professional styling** (external CSS module)
- ✅ **Accessible** (ARIA attributes)
- ✅ **No silent failures** (user must respond)

**Cons:**
- ❌ **Disruptive** - blocks entire application
- ❌ **More complex** (~200 lines with CSS)
- ❌ **Forces decision** (no "continue anyway" option)

---

### 4. **Integration Points**

#### Branch FA-1106

**`index.tsx`** - Installs global fetch listener:
```typescript
import { installFetchUnauthorizedListener } from "./providers/SessionMonitorProvider";

if (container) {
    installFetchUnauthorizedListener();  // ← Monkey-patches fetch
    const root = ReactDOM.createRoot(container);
    // ... render app
}
```

**`App.tsx`** - Wraps routes with provider:
```typescript
export default function App() {
    return (
        <SessionMonitorProvider>  {/* ← Listens for events */}
            <Routes>
                {/* All routes */}
            </Routes>
        </SessionMonitorProvider>
    );
}
```

**Integration Characteristics:**
- 2 files modified (`index.tsx`, `App.tsx`)
- 1 new file created (`SessionMonitorProvider.tsx`)
- No changes to existing components
- No context integration needed

---

#### Current Implementation

**`AppProviders.tsx`** - Integrates with existing context:
```typescript
import { useSessionManager } from "../hooks/useSessionManager";
import { SessionExpiredModal } from "../components/SessionExpiredModal/SessionExpiredModal";

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isSessionExpiredModalOpen, handleRefreshSession, handleLogout, validateSession }
        = useSessionManager();

    // Add validateSession to context for route protection
    const contextValue = useMemo(() => ({
        // ... existing values
        validateSession,
    }), [...deps, validateSession]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
            <SessionExpiredModal
                isOpen={isSessionExpiredModalOpen}
                onRefresh={handleRefreshSession}
                onLogout={handleLogout}
            />
        </AppContext.Provider>
    );
};
```

**`api/api.ts`** - Migrated functions use wrapper:
```typescript
import { fetchWrapper } from './fetchWrapper';

export async function fetchUserOrganizations(userId: string): Promise<any> {
    const response = await fetchWrapper(`/api/get-user-organizations`, {
        method: "GET",
        headers: { "X-MS-CLIENT-PRINCIPAL-ID": userId }
    });
    // ... rest of function
}
```

**`ProtectedRoute.tsx`** - Validates session on mount:
```typescript
const { validateSession } = useAppContext();

useEffect(() => {
    if (isAuthenticated && !isLoading) {
        validateSession().then(isValid => {
            if (!isValid) {
                // Modal will be shown by session manager
            }
        });
    }
}, [isAuthenticated, isLoading, validateSession]);
```

**Integration Characteristics:**
- 5 files modified (`AppProviders.tsx`, `api.ts`, `ProtectedRoute.tsx`, etc.)
- 4 new files created (wrapper, hook, modal component, modal CSS)
- Context integration for global access
- Gradual migration of API functions

---

### 5. **Session Validation Logic**

#### Branch FA-1106
```typescript
// NO SESSION VALIDATION
// Any 401 immediately triggers toast
if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('api-unauthorized'));
}
```

**Behavior:**
- **Transient 401** (temporary auth glitch) → Shows toast ❌
- **True session expiration** → Shows toast ✅
- **401 from different API** (not session-related) → Shows toast ❌

**False Positive Risk:** HIGH

---

#### Current Implementation
```typescript
// VALIDATES SESSION BEFORE NOTIFYING
if (response.status === 401 && !skipAuthCheck) {
    const isSessionValid = await validateSession();

    if (!isSessionValid) {
        // TRUE EXPIRATION - show modal
        sessionExpirationHandler.onSessionExpired();
        return response;
    } else {
        // TRANSIENT ERROR - retry
        const retryResponse = await fetch(url, enhancedOptions);
        return retryResponse;
    }
}
```

**Behavior:**
- **Transient 401** → Validates → Still valid → Retries request ✅
- **True session expiration** → Validates → Invalid → Shows modal ✅
- **401 from different API** → Validates → Can skip with flag ✅

**False Positive Risk:** LOW

---

### 6. **Deduplication of Notifications**

#### Branch FA-1106
```typescript
const onUnauthorized = (ev: Event) => {
    // Prevents multiple toasts with same ID
    if (toast.isActive((window as any).__sessionExpiredToastId)) return;
    (window as any).__sessionExpiredToastId = toast(sessionExpiredToast, {...});
};
```

**Mechanism:**
- Uses global variable on `window` object
- Checks if toast is already active
- Prevents duplicate toasts from concurrent 401s

**Pros:**
- ✅ Handles concurrent requests
- ✅ Only one toast shown at a time

**Cons:**
- ❌ Uses global state on window
- ❌ Not TypeScript-safe (uses `any`)

---

#### Current Implementation
```typescript
// Global handler singleton
let sessionExpirationHandler: SessionExpirationHandler | null = null;

export function registerSessionExpirationHandler(handler: SessionExpirationHandler) {
    sessionExpirationHandler = handler;  // Only one handler
}

// In useSessionManager hook
const [isSessionExpiredModalOpen, setIsSessionExpiredModalOpen] = useState(false);

const handleSessionExpired = useCallback(() => {
    setIsSessionExpiredModalOpen(true);  // Sets boolean flag
}, []);
```

**Mechanism:**
- Singleton handler pattern
- Boolean state in React (can't be "more true")
- Multiple 401s all set same boolean to true

**Pros:**
- ✅ Handles concurrent requests
- ✅ Only one modal shown
- ✅ TypeScript-safe
- ✅ No global window mutation

---

### 7. **Testing & Debugging**

#### Branch FA-1106

**Testing:**
```typescript
// To test, need to:
1. Clear cookies in browser
2. Trigger API call
3. Verify toast appears
4. Check toast auto-dismisses after 8 seconds
```

**Debugging:**
- Fetch behavior is invisible in code
- Need to check `window.fetch` at runtime
- Custom events in DevTools event listener panel
- Toast state in react-toastify internals

**Challenges:**
- ❌ Hard to unit test (global mutation)
- ❌ Hard to mock (native fetch is replaced)
- ❌ Hard to trace (no explicit wrapper calls)

---

#### Current Implementation

**Testing:**
```typescript
// To test:
1. Mock fetchWrapper to return 401
2. Mock validateSession to return false
3. Verify modal state changes
4. Test button actions
5. Unit test fetchWrapper independently
```

**Debugging:**
- Wrapper calls visible in stack traces
- Console logs show validation attempts
- React DevTools shows modal state
- Can set breakpoints in fetchWrapper

**Challenges:**
- ✅ Easy to unit test (pure functions)
- ✅ Easy to mock (wrapper is explicit)
- ✅ Easy to trace (explicit calls)
- ✅ Development mode logging

---

## Side-by-Side Feature Comparison

| Feature | Branch FA-1106 | Current Implementation |
|---------|---------------|------------------------|
| **Backend Changes** | None | Session endpoint + timeout config |
| **401 Detection** | Monkey-patched fetch | Wrapper function |
| **Session Validation** | ❌ No | ✅ Yes (validates before notifying) |
| **Retry Logic** | ❌ No | ✅ Yes (retries if session valid) |
| **UI Type** | Toast notification | Blocking modal |
| **Auto-Dismiss** | ✅ Yes (8 seconds) | ❌ No (user must act) |
| **Blocks User Actions** | ❌ No | ✅ Yes |
| **Logout Option** | ❌ No (refresh only) | ✅ Yes |
| **Data Loss Warning** | ❌ No | ✅ Yes |
| **False Positives** | High risk | Low risk (validated) |
| **Silent Failures** | Possible (after dismiss) | Impossible (blocks) |
| **Code Complexity** | Low (~70 lines) | Medium (~400 lines) |
| **Migration Required** | ❌ No | ✅ Yes (gradual) |
| **TypeScript Safety** | Partial (uses `any`) | ✅ Full |
| **Testability** | Difficult | Easy |
| **Debuggability** | Difficult | Easy |
| **Accessibility** | Basic | Full (ARIA labels) |
| **Styling** | Inline CSS | External CSS module |
| **Integration Depth** | Shallow (2 files) | Deep (5 files + context) |

---

## Recommendations

### Use Branch FA-1106 Implementation If:
- ✅ You want a **quick, minimal solution**
- ✅ You prefer **non-blocking notifications**
- ✅ You don't want to change backend
- ✅ You're okay with potential false positives
- ✅ Code simplicity is top priority
- ✅ User can tolerate silent failures after toast dismisses

### Use Current Implementation If:
- ✅ You need **guaranteed no silent failures**
- ✅ You want to **prevent false positives**
- ✅ You need **blocking behavior** (ensure user responds)
- ✅ You want **retry logic** for transient errors
- ✅ You need **full control** over session state
- ✅ You prefer **testable, debuggable** code
- ✅ You can commit to gradual API migration
- ✅ Robust solution is more important than speed

---

## Hybrid Approach (Best of Both Worlds)

A potential compromise that combines strengths of both:

```typescript
// Use monkey-patching for broad coverage (from Branch FA-1106)
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await originalFetch(...args);

    if (res.status === 401) {
        // Validate session before showing UI (from Current Implementation)
        const isValid = await validateSession();

        if (!isValid) {
            // Show BLOCKING modal (from Current Implementation)
            window.dispatchEvent(new CustomEvent('api-unauthorized'));
        } else {
            // Retry request (from Current Implementation)
            return originalFetch(...args);
        }
    }

    return res;
};
```

**Benefits:**
- ✅ No migration needed (catches all fetch calls)
- ✅ Session validation (prevents false positives)
- ✅ Retry logic (handles transient errors)
- ✅ Blocking modal (no silent failures)

**Trade-offs:**
- ❌ Still uses monkey-patching (anti-pattern)
- ❌ Requires backend session validation endpoint
- ❌ More complex than either approach alone

---

## Conclusion

**Branch FA-1106** took a pragmatic, lightweight approach that prioritizes speed of implementation and minimal disruption. It works adequately for basic session expiration detection but has risks around false positives and silent failures.

**Current Implementation** takes a more robust, enterprise-grade approach that prioritizes correctness, user experience, and maintainability. It requires more initial work but provides stronger guarantees and better long-term maintainability.

The choice depends on your priorities:
- **Speed & Simplicity** → Branch FA-1106
- **Robustness & Control** → Current Implementation
- **Balanced** → Hybrid approach (monkey-patch + validation + blocking modal)
