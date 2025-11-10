/**
 * Enhanced fetch wrapper with automatic session expiration handling
 *
 * This wrapper provides:
 * - Automatic 401 (Unauthorized) response interception
 * - Session validation on auth failures
 * - Global error handling for expired sessions
 * - Consistent credential handling
 */

export interface FetchWrapperOptions extends RequestInit {
    skipAuthCheck?: boolean; // Skip 401 handling for specific requests
}

export interface SessionExpirationHandler {
    onSessionExpired: () => void;
}

// Global session expiration handler - will be set by useSessionManager hook
let sessionExpirationHandler: SessionExpirationHandler | null = null;

/**
 * Register a handler for session expiration events
 */
export function registerSessionExpirationHandler(handler: SessionExpirationHandler) {
    sessionExpirationHandler = handler;
}

/**
 * Unregister the session expiration handler
 */
export function unregisterSessionExpirationHandler() {
    sessionExpirationHandler = null;
}

/**
 * Validate if the current session is still active
 * @returns Promise<boolean> - true if session is valid, false otherwise
 */
async function validateSession(): Promise<boolean> {
    try {
        const response = await fetch("/api/auth/session/status", {
            method: "GET",
            credentials: "include",
        });

        return response.ok && response.status === 200;
    } catch (error) {
        console.error("[fetchWrapper] Session validation failed:", error);
        return false;
    }
}

/**
 * Enhanced fetch wrapper with automatic 401 handling
 *
 * @param url - The URL to fetch
 * @param options - Fetch options with optional skipAuthCheck flag
 * @returns Promise<Response>
 */
export async function fetchWrapper(
    url: string,
    options: FetchWrapperOptions = {}
): Promise<Response> {
    const { skipAuthCheck = false, ...fetchOptions } = options;

    // Always include credentials for session cookies
    const enhancedOptions: RequestInit = {
        ...fetchOptions,
        credentials: "include",
    };

    try {
        const response = await fetch(url, enhancedOptions);

        // Handle 401 Unauthorized responses
        if (response.status === 401 && !skipAuthCheck) {
            console.warn("[fetchWrapper] Received 401 response, validating session...");

            // Validate if session is truly expired or if it's a transient error
            const isSessionValid = await validateSession();

            if (!isSessionValid) {
                console.error("[fetchWrapper] Session validation failed - session expired");

                // Trigger session expiration handler if registered
                if (sessionExpirationHandler) {
                    sessionExpirationHandler.onSessionExpired();
                }

                // Return the 401 response to let caller handle it appropriately
                return response;
            } else {
                console.log("[fetchWrapper] Session is valid, retrying original request...");

                // Session is valid, retry the original request
                const retryResponse = await fetch(url, enhancedOptions);
                return retryResponse;
            }
        }

        return response;
    } catch (error) {
        console.error("[fetchWrapper] Fetch error:", error);
        throw error;
    }
}

/**
 * Helper function to check if a response indicates session expiration
 * @param response - The fetch response
 * @returns boolean - true if session is expired
 */
export function isSessionExpired(response: Response): boolean {
    return response.status === 401;
}

/**
 * Helper function to handle common error responses
 * @param response - The fetch response
 * @returns Promise<Error> - Formatted error with helpful message
 */
export async function handleErrorResponse(response: Response): Promise<Error> {
    const status = response.status;

    switch (status) {
        case 401:
            return new Error("Session expired. Please refresh the page to continue.");
        case 403:
            return new Error("You do not have permission to perform this action.");
        case 404:
            return new Error("The requested resource was not found.");
        case 409:
            return new Error("A conflict occurred. The resource may already exist.");
        case 422:
            return new Error("Invalid request. Please check your input.");
        case 500:
            return new Error("Server error. Please try again later.");
        default:
            try {
                const errorData = await response.json();
                return new Error(errorData.error || errorData.message || "An unexpected error occurred");
            } catch {
                return new Error(`Request failed with status ${status}`);
            }
    }
}
