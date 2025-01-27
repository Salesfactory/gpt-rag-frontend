// src/ProtectedRoute.tsx

import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAppContext } from "../providers/AppProviders";
import LoadingSpinner from "../components/LoadingSpinner/LoadingSpinner"; // Optional: Create a loading spinner component

// Define the debug mode based on the environment
const isDebugMode = process.env.NODE_ENV === "development";

/**
 * Logs messages to the console only in development mode.
 * @param args - The messages or data to log.
 */
const debugLog = (...args: any[]) => {
    if (isDebugMode) {
        console.log(...args);
    }
};

/**
 * ProtectedRoute component ensures that only authenticated users with allowed roles can access certain routes.
 * It uses MsalAuthenticationTemplate to handle authentication automatically.
 *
 * @param {Array} allowedRoles - Array of roles that are permitted to access the route.
 * @param {Array} allowedTiers - Array of subscription tiers that are permitted to access the route.
 */
type Role = "platformAdmin" | "admin" | "user";
type SubscriptionTier = "Basic" | "Custom" | "Premium" | "Basic + Financial Assistant" | "Custom + Financial Assistant" | "Premium + Financial Assistant";

interface ProtectedRouteProps {
    allowedRoles: Role[];
    allowedTiers: SubscriptionTier[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, allowedTiers }) => {
    const { user, isAuthenticated, organization, subscriptionTiers, isLoading, isOrganizationLoading, isSubscriptionTiersLoading, isChatHistoryLoading } =
        useAppContext();

    // Debug: Log context values
    debugLog("ProtectedRoute Rendered with props:", { allowedRoles, allowedTiers });
    debugLog("Context Values:", {
        user,
        isAuthenticated,
        organization,
        subscriptionTiers,
        isLoading,
        isOrganizationLoading,
        isSubscriptionTiersLoading,
        isChatHistoryLoading
    });

    // Check if the user has the required role
    const hasRequiredRole = (): boolean => {
        if (!user?.role) {
            debugLog("hasRequiredRole: User role is undefined or null.");
            return false;
        }
        const hasRole = allowedRoles.includes(user.role);
        debugLog(`hasRequiredRole: User role "${user.role}" is ${hasRole ? "" : "not "}allowed.`);
        return hasRole;
    };

    // Check if the user's subscription tier is in the allowed tiers
    const hasRequiredTier = (): boolean => {
        if (!organization?.subscriptionId) {
            debugLog("hasRequiredTier: User does not have a subscription ID.");
            return false;
        }
        if (!subscriptionTiers || subscriptionTiers.length === 0) {
            debugLog("hasRequiredTier: No subscription tiers available.");
            return false;
        }
        const hasTier = subscriptionTiers.some(tier => allowedTiers.includes(tier));
        debugLog(`hasRequiredTier: User has ${hasTier ? "" : "no "}allowed subscription tiers.`);
        return hasTier;
    };

    // Ensure the organization and subscription information is valid
    const isValidSubscriptionForOrganization = (): boolean => {
        const isValid = user?.organizationId && organization?.subscriptionId ? true : false;
        debugLog(`isValidSubscriptionForOrganization: ${isValid ? "Valid" : "Invalid"}.`);
        return isValid;
    };

    // Show a loading spinner while loading data
    if (isLoading || isOrganizationLoading || isSubscriptionTiersLoading || isChatHistoryLoading) {
        debugLog(
            `ProtectedRoute: Loading states - isLoading: ${isLoading}, isOrganizationLoading: ${isOrganizationLoading}, isSubscriptionTiersLoading: ${isSubscriptionTiersLoading}, isChatHistoryLoading: ${isChatHistoryLoading}. Rendering LoadingSpinner.`
        );
        return <LoadingSpinner />;
    }

    // Determine which navigation path to take
    if (isAuthenticated && hasRequiredRole() && hasRequiredTier()) {
        debugLog("ProtectedRoute: User is authenticated with required role and tier. Rendering Outlet.");
        return <Outlet />;
    } else if (!hasRequiredRole()) {
        debugLog("ProtectedRoute: User does not have the required role. Redirecting to /access-denied.");
        return <Navigate to="/access-denied" replace />;
    } else if (!isValidSubscriptionForOrganization()) {
        debugLog("ProtectedRoute: Subscription is invalid. Redirecting to /onboarding.");
        return <Navigate to="/onboarding" replace />;
    } else if (!hasRequiredTier()) {
        debugLog("ProtectedRoute: User does not have the required subscription tier. Redirecting to /access-denied.");
        return <Navigate to="/access-denied" replace />;
    } else {
        debugLog("ProtectedRoute: Default redirect to /access-denied.");
        return <Navigate to="/access-denied" replace />;
    }
};

export default ProtectedRoute;
