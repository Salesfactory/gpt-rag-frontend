// src/ProtectedRoute.tsx
import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAppContext } from "../providers/AppProviders";
import LoadingSpinner from "../components/LoadingSpinner/LoadingSpinner"; // Optional: Create a loading spinner component

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
    console.log("ProtectedRoute Rendered with props:", { allowedRoles, allowedTiers });
    console.log("Context Values:", {
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
            console.log("hasRequiredRole: User role is undefined or null.");
            return false;
        }
        const hasRole = allowedRoles.includes(user.role);
        console.log(`hasRequiredRole: User role "${user.role}" is ${hasRole ? "" : "not "}allowed.`);
        return hasRole;
    };

    // Check if the user's subscription tier is in the allowed tiers
    const hasRequiredTier = (): boolean => {
        if (!organization?.subscriptionId) {
            console.log("hasRequiredTier: User does not have a subscription ID.");
            return false;
        }
        if (!subscriptionTiers || subscriptionTiers.length === 0) {
            console.log("hasRequiredTier: No subscription tiers available.");
            return false;
        }
        const hasTier = subscriptionTiers.some(tier => allowedTiers.includes(tier));
        console.log(`hasRequiredTier: User has ${hasTier ? "" : "no "}allowed subscription tiers.`);
        return hasTier;
    };

    // Ensure the organization and subscription information is valid
    const isValidSubscriptionForOrganization = (): boolean => {
        const isValid = user?.organizationId && organization?.subscriptionId ? true : false;
        console.log(`isValidSubscriptionForOrganization: ${isValid ? "Valid" : "Invalid"}.`);
        return isValid;
    };

    // Show a loading spinner while loading data
    if (isLoading || isOrganizationLoading || isSubscriptionTiersLoading || isChatHistoryLoading) {
        console.log(
            `ProtectedRoute: Loading states - isLoading: ${isLoading}, isOrganizationLoading: ${isOrganizationLoading}, isSubscriptionTiersLoading: ${isSubscriptionTiersLoading}, isChatHistoryLoading: ${isChatHistoryLoading}. Rendering LoadingSpinner.`
        );
        return <LoadingSpinner />;
    }

    // Determine which navigation path to take
    if (isAuthenticated && hasRequiredRole() && hasRequiredTier()) {
        console.log("ProtectedRoute: User is authenticated with required role and tier. Rendering Outlet.");
        return <Outlet />;
    } else if (!hasRequiredRole()) {
        console.log("ProtectedRoute: User does not have the required role. Redirecting to /access-denied.");
        return <Navigate to="/access-denied" replace />;
    } else if (!isValidSubscriptionForOrganization()) {
        console.log("ProtectedRoute: Subscription is invalid. Redirecting to /onboarding.");
        return <Navigate to="/onboarding" replace />;
    } else if (!hasRequiredTier()) {
        console.log("ProtectedRoute: User does not have the required subscription tier. Redirecting to /access-denied.");
        return <Navigate to="/access-denied" replace />;
    } else {
        console.log("ProtectedRoute: Default redirect to /access-denied.");
        return <Navigate to="/access-denied" replace />;
    }
};

export default ProtectedRoute;
