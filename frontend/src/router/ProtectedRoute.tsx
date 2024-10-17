// src/ProtectedRoute.jsx
import React, { useContext } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { MsalAuthenticationTemplate, useMsal } from "@azure/msal-react";
import { AppContext } from "../providers/AppProviders";

import { InteractionType } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";
import LoadingSpinner from "../components/LoadingSpinner/LoadingSpinner"; // Optional: Create a loading spinner component

/**
 * ProtectedRoute component ensures that only authenticated users with allowed roles can access certain routes.
 * It uses MsalAuthenticationTemplate to handle authentication automatically.
 *
 * @param {Array} allowedRoles - Array of roles that are permitted to access the route.
 */
interface ProtectedRouteProps {
    allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { instance } = useMsal();
    const activeAccount = instance.getActiveAccount();
    const { user } = useContext(AppContext);

    // Function to check if the user has at least one of the allowed roles
    const hasRequiredRole = (): boolean => {
        if (!activeAccount) return false;

        const roles = [user.role];
        //const roles = activeAccount.idTokenClaims?.roles as string[] | undefined;
        if (!roles) return false;
        return allowedRoles.some(role => roles.includes(role));
    };

    return (
        <MsalAuthenticationTemplate interactionType={InteractionType.Redirect} authenticationRequest={loginRequest} loadingComponent={LoadingSpinner}>
            {hasRequiredRole() ? <Outlet /> : <Navigate to="/access-denied" replace />}
        </MsalAuthenticationTemplate>
    );
};

export default ProtectedRoute;
