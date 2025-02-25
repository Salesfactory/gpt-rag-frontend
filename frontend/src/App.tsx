import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";
import { EventType, InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";

import ProtectedRoute from "./router/ProtectedRoute";

import Layout from "./pages/layout/_Layout";
import NoPage from "./pages/NoPage";
import AccessDenied from "./pages/AccesDenied";
import Chat from "./pages/chat/Chat";
import Admin from "./pages/admin/Admin";
import Onboarding from "./pages/onboarding/Onboarding";
import Invitations from "./pages/invitations/Invitations";
import Organization from "./pages/organization/Organization";
import HelpCenter from "./pages/helpcenter/HelpCenter";
import UploadResources from "./pages/resources/UploadResources";
import RequestStudies from "./pages/studies/RequestStudies";
import ReportManagement from "./pages/reports/ReportManagement";
import Reports from "./pages/reports/Reports";
import DistributionLists from "./pages/reports/DistributionLists";
import Logout from "./pages/logout/Logout";
import Notifications from "./pages/notifications/Notifications";
import SubscriptionManagement from "./pages/subscriptionmanagement/SubscriptionManagement";
import UserManagement from "./pages/usermanagement/UserManagement";
import { PaymentGateway } from "./components/PaymentGateway/PaymentGateway";
import SuccessPayment from "./components/PaymentGateway/SuccessPayment";
import CurationReports from "./pages/reports/CurationReports";
import CurationCreation from "./pages/reports/ReportCreation/CurationCreation";
import SummarizationReports from "./pages/reports/SummarizationReports";
import SummarizationCreation from "./pages/reports/ReportCreation/SummarizationCreation";
import { TemplateCreation } from "./pages/reports/ReportCreation/ReportTemplateCreation";
import { TemplateReports } from "./pages/reports/ReportTemplates";
import { AppProvider } from "./providers/AppProviders";

/* 
   Example arrays grouping routes by role/tier 
   to avoid repeating <ProtectedRoute> in multiple places 
*/

const userRoutes = [
    { path: "/", element: <Chat /> },
    { path: "/success-payment", element: <SuccessPayment /> },
    { path: "/help-center", element: <HelpCenter /> },
    { path: "/logout", element: <Logout /> },
    { path: "/notification-settings", element: <Notifications /> },
    { path: "/access-denied", element: <AccessDenied /> }
];

const adminRoutes = [
    { path: "/admin", element: <Admin /> },
    { path: "/invitations", element: <Invitations /> },
    { path: "/organization", element: <Organization /> },
    { path: "/subscription-management", element: <SubscriptionManagement /> },
    { path: "/manage-email-lists", element: <UserManagement /> }
];

const premiumRoutes = [
    { path: "/upload-resources", element: <UploadResources /> },
    { path: "/request-studies", element: <RequestStudies /> }
];

const reportRoutes = [
    { path: "/view-reports", element: <Reports /> },
    { path: "/view-manage-reports", element: <ReportManagement /> },
    { path: "/details-settings", element: <DistributionLists /> },
    { path: "/curation-reports", element: <CurationReports /> },
    { path: "/create-curation-report", element: <CurationCreation /> },
    { path: "/summarization-reports", element: <SummarizationReports /> },
    { path: "/create-summarization-report", element: <SummarizationCreation /> },
    { path: "/report-templates", element: <TemplateReports /> },
    { path: "/create-template-report", element: <TemplateCreation /> }
];

// Component that redirects to Azure login
const RedirectToLogin = () => {
    const { instance } = useMsal();

    useEffect(() => {
        // Trigger login redirect
        instance.loginRedirect(loginRequest).catch(e => {
            console.error("Login redirect failed", e);
        });
    }, [instance]);

    return <div>Redirecting to login...</div>;
};

// AppContent component that only renders when authenticated
const AppContent = () => {
    const { accounts, inProgress } = useMsal();
    const activeAccount = accounts[0]; // Get the first account

    // If authentication is in progress, show loading
    if (inProgress !== InteractionStatus.None) {
        return <div>Loading...</div>;
    }

    // If no active account, redirect to login
    if (!activeAccount) {
        return <RedirectToLogin />;
    }

    return (
        <AppProvider>
            <Routes>
                {/* Unauthenticated Routes */}
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/payment" element={<PaymentGateway />} />
                <Route path="/access-denied" element={<AccessDenied />} />

                {/* Authenticated Routes */}
                {/* 1) Protected Routes for normal user */}
                <Route
                    element={
                        <ProtectedRoute
                            allowedRoles={["user", "admin", "platformAdmin"]}
                            allowedTiers={[
                                "Basic",
                                "Custom",
                                "Premium",
                                "Basic + Financial Assistant",
                                "Custom + Financial Assistant",
                                "Premium + Financial Assistant"
                            ]}
                        />
                    }
                >
                    <Route element={<Layout />}>
                        {userRoutes.map(r => (
                            <Route key={r.path} path={r.path} element={r.element} />
                        ))}
                    </Route>
                </Route>

                {/* 2) Admin-Only Routes */}
                <Route
                    element={
                        <ProtectedRoute
                            allowedRoles={["admin", "platformAdmin"]}
                            allowedTiers={[
                                "Basic",
                                "Custom",
                                "Premium",
                                "Basic + Financial Assistant",
                                "Custom + Financial Assistant",
                                "Premium + Financial Assistant"
                            ]}
                        />
                    }
                >
                    <Route element={<Layout />}>
                        {adminRoutes.map(r => (
                            <Route key={r.path} path={r.path} element={r.element} />
                        ))}
                    </Route>
                </Route>

                {/* 3) Premium Feature Routes */}
                <Route
                    element={
                        <ProtectedRoute
                            allowedRoles={["admin", "user", "platformAdmin"]}
                            allowedTiers={["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"]}
                        />
                    }
                >
                    <Route element={<Layout />}>
                        {premiumRoutes.map(r => (
                            <Route key={r.path} path={r.path} element={r.element} />
                        ))}
                    </Route>
                </Route>

                {/* 4) Report-Related Routes */}
                <Route
                    element={
                        <ProtectedRoute
                            allowedRoles={["admin", "platformAdmin"]}
                            allowedTiers={["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"]}
                        />
                    }
                >
                    <Route element={<Layout />}>
                        {reportRoutes.map(r => (
                            <Route key={r.path} path={r.path} element={r.element} />
                        ))}
                    </Route>
                </Route>

                {/* Catch-All for Undefined Paths */}
                <Route path="*" element={<NoPage />} />
            </Routes>
        </AppProvider>
    );
};

export default function App({ instance }: { instance: any }) {
    // Add event callback for login events
    useEffect(() => {
        const callbackId = instance.addEventCallback((event: any) => {
            if (event.eventType === EventType.LOGIN_SUCCESS && event?.payload?.account) {
                instance.setActiveAccount(event.payload.account);
            }
        });

        return () => {
            if (callbackId) {
                instance.removeEventCallback(callbackId);
            }
        };
    }, [instance]);

    return (
        <MsalProvider instance={instance}>
            <BrowserRouter>
                {/* For authenticated users, render the app content with AppProvider */}
                <AuthenticatedTemplate>
                    <AppContent />
                </AuthenticatedTemplate>

                {/* For unauthenticated users, redirect to login */}
                <UnauthenticatedTemplate>
                    <RedirectToLogin />
                </UnauthenticatedTemplate>
            </BrowserRouter>
        </MsalProvider>
    );
}
