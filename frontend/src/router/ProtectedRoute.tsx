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
 */
type Role = "admin" | "user";
type SubscriptionTier = "Basic" | "Custom" | "Premium" | "Basic + Financial Assistant" | "Custom + Financial Assistant" | "Premium + Financial Assistant";

interface ProtectedRouteProps {
    allowedRoles: Role[];
    allowedTiers: SubscriptionTier[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, allowedTiers }) => {
    const { user, isAuthenticated, organization, subscriptionTiers, isLoading } = useAppContext();

    // Check if the user has the required role
    const hasRequiredRole = (): boolean => {
        if (!user?.role) return false;
        return allowedRoles.includes(user.role);
    };

    // Check if the user's subscription tier is in the allowed tiers
    const hasRequiredTier = (): boolean => {
        const userSubscriptionTier = organization?.subscriptionId;
        if (!userSubscriptionTier) return false;
        if (!subscriptionTiers || subscriptionTiers.length === 0) return false;
        return subscriptionTiers.some(tier => allowedTiers.includes(tier));
    };

    // Ensure the organization and subscription information is valid
    const isValidSubscriptionForOrganization = (): boolean => {
        return user?.organizationId && organization?.subscriptionId ? true : false;
    };

    // Show a loading spinner while loading data
    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <>
            {isAuthenticated && hasRequiredRole() && hasRequiredTier() ? (
                <Outlet />
            ) : !hasRequiredRole() ? (
                <Navigate to="/access-denied" replace />
            ) : !hasRequiredTier() ? (
                <Navigate to="/access-denied" replace />
            ) : !isValidSubscriptionForOrganization() ? (
                <Navigate to="/onboarding" replace />
            ) : (
                <Navigate to="/access-denied" replace />
            )}
        </>
    );
};

export default ProtectedRoute;
