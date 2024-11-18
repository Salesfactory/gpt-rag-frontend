// src/ProtectedRoute.jsx
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
interface ProtectedRouteProps {
    allowedRoles: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { user, isAuthenticated, organization } = useAppContext();

    // Function to check if the user has at least one of the allowed roles
    const hasRequiredRole = (): boolean => {
        const roles = [user?.role];
        //const roles = activeAccount.idTokenClaims?.roles as string[] | undefined;
        if (!roles) return false;
        return allowedRoles.some(role => roles.includes(role));
    };

    const isValidSubscriptionForOrganization = (): boolean => {
        if (!user?.organizationId || !organization?.subscriptionId) return false;
        return true;
    };

    return (
        <>
            {isValidSubscriptionForOrganization() && hasRequiredRole() ? (
                <Outlet />
            ) : hasRequiredRole() === false ? (
                <Navigate to="/access-denied" replace />
            ) : isValidSubscriptionForOrganization() === false ? (
                <Navigate to="/onboarding" replace />
            ) : (
                <Navigate to="/access-denied" replace />
            )}
        </>
    );
};

export default ProtectedRoute;
