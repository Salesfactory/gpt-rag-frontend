# Session Expiration Testing Guide

This document provides instructions for testing the session expiration handling implementation.

## Overview

The session expiration handling system includes:
- **Automatic 401 response interception** via `fetchWrapper`
- **Session validation** on 401 errors
- **Blocking modal** when session expires
- **User options** to refresh session or logout

---

## Testing Methods

### Method 1: Using Browser DevTools (Recommended)

This is the easiest way to test session expiration without waiting for the actual timeout.

#### Steps:

1. **Start the application** and log in normally
2. **Open Browser DevTools** (F12 or right-click → Inspect)
3. **Go to Application tab** (Chrome) or Storage tab (Firefox)
4. **Clear session cookies**:
   - In Chrome: Application → Cookies → Select your domain → Delete session cookies
   - In Firefox: Storage → Cookies → Select your domain → Delete session cookies
5. **Trigger an API request** by:
   - Navigating to a different page
   - Uploading a file
   - Sending a chat message
   - Any action that makes an API call
6. **Verify the modal appears** with:
   - Title: "Session Expired"
   - Message explaining session expiration
   - "Refresh Session" button (primary)
   - "Logout" button (secondary)

#### Expected Behavior:
- ✅ Modal blocks all user interactions (backdrop click disabled)
- ✅ "Refresh Session" reloads the page and triggers Azure AD B2C re-authentication
- ✅ "Logout" redirects to `/logout` endpoint
- ✅ No API requests fail silently

---

### Method 2: Backend Session Timeout (Real-World Test)

This tests the actual session timeout configured in the backend.

#### Prerequisites:
- Backend session timeout is set to 1 hour (`PERMANENT_SESSION_LIFETIME = 3600` in `app_config.py`)

#### Steps:

1. **Log in to the application**
2. **Wait for 1 hour** (or modify `PERMANENT_SESSION_LIFETIME` to a shorter duration like 60 seconds for testing)
3. **Trigger an API request** after the timeout period
4. **Verify the session expired modal appears**

#### To Speed Up Testing:
- Temporarily modify `backend/app_config.py`:
  ```python
  PERMANENT_SESSION_LIFETIME = 60  # 60 seconds for testing
  ```
- Restart the backend server
- Log in and wait 60 seconds
- Trigger an API request
- **Don't forget to change it back to 3600 after testing!**

---

### Method 3: Network Simulation

Force a 401 response using browser DevTools network throttling.

#### Steps:

1. **Open DevTools** → **Network tab**
2. **Enable Request Blocking** (Chrome) or **Edit and Resend** (Firefox)
3. **Block or modify requests** to `/api/*` to return 401 status
4. **Trigger an API call**
5. **Verify session handling**

---

## What to Test

### ✅ Session Expiration Modal

- [ ] Modal appears when session expires
- [ ] Modal has red header with warning icon
- [ ] Title reads "Session Expired"
- [ ] Clear message explains the situation
- [ ] Warning about unsaved work is displayed
- [ ] Two buttons are present: "Refresh Session" and "Logout"
- [ ] Backdrop click is disabled (modal cannot be dismissed by clicking outside)

### ✅ Refresh Session Flow

- [ ] Clicking "Refresh Session" reloads the page
- [ ] Azure AD B2C authentication flow is triggered (if session truly expired)
- [ ] User can continue working after successful re-authentication
- [ ] No data loss occurs if form inputs can be preserved

### ✅ Logout Flow

- [ ] Clicking "Logout" redirects to `/logout`
- [ ] Session is cleared on backend
- [ ] User is redirected to Azure AD B2C logout page
- [ ] User can log back in normally

### ✅ API Request Handling

- [ ] 401 responses trigger session validation
- [ ] If session is valid (transient error), request is retried
- [ ] If session is invalid (truly expired), modal is shown
- [ ] No silent failures occur
- [ ] Console logs show session validation attempts (in development mode)

### ✅ Protected Routes

- [ ] Session is validated when navigating to protected routes
- [ ] Loading spinner shows during session validation
- [ ] Invalid sessions trigger the modal
- [ ] Valid sessions allow navigation to proceed

---

## Testing Checklist

### Basic Functionality
- [ ] Session expiration is detected on any API call
- [ ] Modal appears and blocks all interactions
- [ ] "Refresh Session" works correctly
- [ ] "Logout" works correctly

### Edge Cases
- [ ] Multiple concurrent API requests with 401 don't show multiple modals
- [ ] Session validation failure is handled gracefully
- [ ] Network errors don't trigger false session expiration
- [ ] Page refresh during session validation works correctly

### User Experience
- [ ] Modal is visually consistent with app design
- [ ] Messages are clear and actionable
- [ ] Loading states are shown appropriately
- [ ] No confusing error messages appear

---

## Debugging

### Console Logs (Development Mode)

When running in development mode, you'll see helpful logs:

```
[fetchWrapper] Received 401 response, validating session...
[fetchWrapper] Session validation failed - session expired
[useSessionManager] Session has expired
[ProtectedRoute] Session validation failed on mount
```

### Common Issues

#### Modal doesn't appear on 401:
- Check that `fetchWrapper` is being used (not native `fetch`)
- Verify `sessionExpirationHandler` is registered
- Check console for errors in `useSessionManager`

#### Session validation always fails:
- Verify backend endpoint `/api/auth/session/status` is working
- Check that `@auth.login_required` decorator is functioning
- Ensure cookies are being sent with requests (`credentials: "include"`)

#### Modal appears but buttons don't work:
- Check console for JavaScript errors
- Verify `handleRefreshSession` and `handleLogout` are defined
- Ensure event handlers are properly bound

---

## Files Modified

### Backend
- `backend/app_config.py` - Added session timeout configuration
- `backend/app.py` - Added `/api/auth/session/status` endpoint

### Frontend
- `frontend/src/api/fetchWrapper.ts` - **NEW** - Global 401 interceptor
- `frontend/src/hooks/useSessionManager.ts` - **NEW** - Session management hook
- `frontend/src/components/SessionExpiredModal/SessionExpiredModal.tsx` - **NEW** - Modal component
- `frontend/src/components/SessionExpiredModal/SessionExpiredModal.module.css` - **NEW** - Modal styles
- `frontend/src/providers/AppProviders.tsx` - Integrated session manager
- `frontend/src/router/ProtectedRoute.tsx` - Added session validation on mount
- `frontend/src/api/api.ts` - Migrated critical functions to use fetchWrapper

---

## Expected Test Results

### Successful Implementation

When session expires:
1. **API call with 401** → fetchWrapper intercepts
2. **Session validation** → `/api/auth/session/status` returns 401
3. **Modal appears** → User sees "Session Expired" message
4. **User clicks "Refresh Session"** → Page reloads
5. **Azure AD B2C re-authenticates** → User continues working

### No Silent Failures

- All 401 errors are caught and handled
- User is always notified of session expiration
- No data loss without warning
- Clear path to recovery (refresh or logout)

---

## Additional Notes

### Session Lifetime
- Default: 1 hour (3600 seconds)
- Configurable in `backend/app_config.py`
- Azure AD B2C tokens have their own expiration (typically 1 hour for access tokens)

### Security Considerations
- Sessions are stored server-side in filesystem
- Session IDs are in HTTP-only cookies
- Tokens are never exposed to JavaScript
- Session validation happens before sensitive operations

### Future Enhancements
- Add session activity tracking
- Implement session extension without full page reload
- Show countdown timer before session expires
- Add "keep me logged in" option
- Implement concurrent session detection

---

## Support

If you encounter issues:
1. Check console logs in browser DevTools
2. Verify backend server is running
3. Check backend logs for authentication errors
4. Review the troubleshooting section above
5. Ensure all files were updated correctly
