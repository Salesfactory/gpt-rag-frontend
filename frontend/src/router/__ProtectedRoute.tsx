import React, { useContext, ReactNode } from "react";
import { useAppContext } from "../providers/AppProviders";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { user } = useAppContext();
    if (!user.role || !allowedRoles.includes(user.role)) {
        return <Navigate to="/access-denied" />;
    }
    return <>{children}</>;
};

export default ProtectedRoute;
