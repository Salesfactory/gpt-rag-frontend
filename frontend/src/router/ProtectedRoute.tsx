import React, { useContext, ReactNode } from 'react';
import { AppContext } from "../providers/AppProviders";
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user } = useContext(AppContext);
  if (!user.role  || !allowedRoles.includes(user.role)) {
    console.log("Access Denied");
    return <Navigate to="/access-denied" />;
  }
  console.log("Access Granted");
  return children;
};

export default ProtectedRoute;
