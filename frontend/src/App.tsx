import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./router/ProtectedRoute";
import NoPage from "./pages/NoPage";
import AccessDenied from "./pages/AccesDenied";
import Onboarding from "./pages/onboarding/Onboarding";
import HelpCenter from "./pages/helpcenter/HelpCenter";
import RequestStudies from "./pages/studies/RequestStudies";
import Logout from "./pages/logout/Logout";
import Notifications from "./pages/notifications/Notifications";
import { LazyPaymentGateway } from "./components/PaymentGateway/LazyPaymentGateway";
import SuccessPayment from "./components/PaymentGateway/SuccessPayment";
// New Routes

import Layout from "./pages/layout/_Layoutcopy";
import Chat from "./pages/chat/Chatcopy";
import Admin from "./pages/admin/Admincopy";
import ChatUsage from "./pages/admin/ChatUsage";
import Organization from "./pages/organization/Organizationcopy";

import UploadResources from "./pages/resources/UploadResources";
import UploadConsumerPulse from "./pages/consumerpulse/UploadConsumerPulse";

import SubscriptionManagement from "./pages/subscriptionmanagement/SubscriptionManagementcopy";

import KnowledgeSources from "./pages/knowledgesources/KnowledgeSources";
import VoiceCustomer from "./pages/voicecustomer/VoiceCustomer";
import Gallery from "./pages/gallery/Gallery";
import SubscriptionError from "./pages/SubscriptionError";
import { SubscriptionTier } from "./api/models";

// Platform Admin Routes
import { PlatformAdminLayout } from "./pages/platform-admin/PlatformAdminLayout/PlatformAdminLayout";
import { OrganizationManagement } from "./pages/platform-admin/OrganizationManagement/OrganizationManagement";
import { DataIngestion } from "./pages/platform-admin/DataIngestion/DataIngestion";
import { CreditsManagement } from "./pages/platform-admin/CreditsManagement/CreditsManagement";
import { SubscriptionSettings } from "./pages/platform-admin/SubscriptionSettings/SubscriptionSettings";
import { UserActivityPage } from "./pages/platform-admin/UserActivity/UserActivity";

const allowedTiers: SubscriptionTier[] = [
    "tier_free",
    "tier_basic",
    "tier_custom",
    "tier_premium",
    "tier_enterprise"
]

export default function App() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/payment" element={<LazyPaymentGateway />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/subscription-error" element={<SubscriptionError />} />
            <Route path="/logout" element={<Logout />} />

            {/* Protected Routes for Authenticated Users (Regular and Admin) */}
            <Route element={<ProtectedRoute allowedRoles={["user", "admin", "platformAdmin"]} allowedTiers={allowedTiers} />}>
                <Route element={<Layout />}>
                    <Route path="/" element={<Chat />} />
                    <Route path="/success-payment" element={<SuccessPayment />} />
                    <Route path="/help-center" element={<HelpCenter />} />
                    <Route path="/vault" element={<Gallery />} />
                    <Route path="/notification-settings" element={<Notifications />} />
                    <Route path="/access-denied" element={<AccessDenied />} />
                    <Route path="/subscription-error" element={<SubscriptionError />} />
                </Route>
            </Route>
            {/* Protected Routes for Admin Only */}
            <Route element={<ProtectedRoute allowedRoles={["admin", "platformAdmin"]} allowedTiers={allowedTiers} />}>
                <Route element={<Layout />}>
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/organization" element={<Organization />} />
                    <Route path="/knowledge-sources" element={<KnowledgeSources />} />
                    <Route path="/voice-customer" element={<VoiceCustomer />} />
                    <Route path="/subscription-management" element={<SubscriptionManagement />} />
                </Route>
            </Route>

            {/* Protected Routes for Platform Admin Only */}
            <Route element={<ProtectedRoute allowedRoles={["platformAdmin"]} allowedTiers={allowedTiers} />}>
                <Route element={<Layout />}>
                    <Route path="/upload-consumer-pulse" element={<UploadConsumerPulse />} />
                    <Route path="/chat-usage" element={<ChatUsage />} />
                </Route>
            </Route>

            {/* Platform Admin Portal Routes (Separate Layout) */}
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["platformAdmin"]}
                        allowedTiers={allowedTiers}
                    />
                }
            >
                <Route path="/platform-admin" element={<PlatformAdminLayout />}>
                    <Route path="organizations" element={<OrganizationManagement />} />
                    <Route path="pulse-data" element={<DataIngestion />} />
                    <Route path="user-activity" element={<UserActivityPage />} />
                    <Route path="credits" element={<CreditsManagement />} />
                    <Route path="settings" element={<SubscriptionSettings />} />
                </Route>
            </Route>

            {/* Protected Routes for Premium Features */}
            <Route element={<ProtectedRoute allowedRoles={["admin", "user", "platformAdmin"]} allowedTiers={allowedTiers} />}>
                <Route element={<Layout />}>
                    <Route path="/upload-resources" element={<UploadResources />} />
                    <Route path="/request-studies" element={<RequestStudies />} />
                </Route>
            </Route>

            {/* Protected Routes for Reports */}
            <Route element={<ProtectedRoute allowedRoles={["admin", "platformAdmin"]} allowedTiers={allowedTiers} />}>
                <Route element={<Layout />}></Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["admin", "platformAdmin"]} allowedTiers={allowedTiers} />}>
                <Route element={<Layout />}></Route>
            </Route>

            {/* Catch-All Route for Undefined Paths */}
            <Route path="*" element={<NoPage />} />
        </Routes>
    );
}
