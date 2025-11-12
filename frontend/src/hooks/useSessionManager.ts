import { useState, useEffect, useCallback } from "react";
import { registerSessionExpirationHandler, unregisterSessionExpirationHandler } from "../api/fetchWrapper";

/**
 * Hook to manage session expiration handling
 *
 * Features:
 * - Registers global session expiration handler
 * - Manages session expired modal state
 * - Provides session validation function
 * - Handles refresh and logout actions
 */
export function useSessionManager() {
    const [isSessionExpiredModalOpen, setIsSessionExpiredModalOpen] = useState(false);

    /**
     * Handler called when session expiration is detected
     */
    const handleSessionExpired = useCallback(() => {
        console.warn("[useSessionManager] Session has expired");
        setIsSessionExpiredModalOpen(true);
    }, []);

    /**
     * Handle refresh session action
     * Reloads the page to trigger Azure AD B2C authentication flow
     */
    const handleRefreshSession = useCallback(() => {
        console.log("[useSessionManager] Refreshing session...");
        window.location.reload();
    }, []);

    /**
     * Handle logout action
     * Redirects to logout endpoint to clear session
     */
    const handleLogout = useCallback(() => {
        console.log("[useSessionManager] Logging out...");
        window.location.href = "/logout";
    }, []);

    /**
     * Manually validate the current session
     * @returns Promise<boolean> - true if session is valid
     */
    const validateSession = useCallback(async (): Promise<boolean> => {
        try {
            const response = await fetch("/api/auth/session/status", {
                method: "GET",
                credentials: "include",
            });

            return response.ok && response.status === 200;
        } catch (error) {
            console.error("[useSessionManager] Session validation error:", error);
            return false;
        }
    }, []);

    /**
     * Register the session expiration handler on mount
     * Unregister on unmount
     */
    useEffect(() => {
        registerSessionExpirationHandler({
            onSessionExpired: handleSessionExpired,
        });

        return () => {
            unregisterSessionExpirationHandler();
        };
    }, [handleSessionExpired]);

    return {
        isSessionExpiredModalOpen,
        handleRefreshSession,
        handleLogout,
        validateSession,
    };
}
