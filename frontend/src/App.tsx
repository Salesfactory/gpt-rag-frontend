import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./router/ProtectedRoute";
import Layout from "./pages/layout/_Layout";
import NoPage from "./pages/NoPage";
import AccessDenied from "./pages/AccesDenied";
import Chat from "./pages/chat/Chat";
import Admin from "./pages/admin/Admin";
import Onboarding from "./pages/onboarding/Onboarding";
import Invitations from "./pages/invitations/Invitations";
import Organization from "./pages/organization/Organization";
import FinancialAssistant from "./pages/financialassistant/FinancialAssistant";
import HelpCenter from "./pages/helpcenter/HelpCenter";
import UploadResources from "./pages/resources/UploadResources";
import RequestStudies from "./pages/studies/RequestStudies";
import ReportManagement from "./pages/reports/ReportManagement";
import DistributionLists from "./pages/reports/DistributionLists";
import Logout from "./pages/logout/Logout";
import Notifications from "./pages/notifications/Notifications";
import SubscriptionManagement from "./pages/subscriptionmanagement/SubscriptionManagement";
import UserManagement from "./pages/usermanagement/UserManagement";
import { PaymentGateway } from "./components/PaymentGateway/PaymentGateway";
import SuccessPayment from "./components/PaymentGateway/SuccessPayment";

export default function App() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/payment" element={<PaymentGateway />} />

            {/* Access Denied Route */}
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Protected Routes for Authenticated Users (Regular and Admin) */}
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["user", "admin"]}
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
                    <Route path="/" element={<Chat />} />
                    <Route path="/success-payment" element={<SuccessPayment />} />
                    <Route path="/help-center" element={<HelpCenter />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path="/notification-settings" element={<Notifications/>}/>
                </Route>
            </Route>

            {/* Protected Routes for Admin Only */}
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["admin"]}
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
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/invitations" element={<Invitations />} />
                    <Route path="/organization" element={<Organization />} />
                    <Route path="/financialassistant" element={<FinancialAssistant />} />
                    <Route path="/subscription-management" element={<SubscriptionManagement/>}/>
                    <Route path="/manage-email-lists" element={<UserManagement/>}/>
                </Route>
            </Route>

            {/* Protected Routes for Premium Features */}
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["admin", "user"]}
                        allowedTiers={["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"]}
                    />
                }
            >
                <Route element={<Layout />}>
                    <Route path="/upload-resources" element={<UploadResources />} />
                    <Route path="/request-studies" element={<RequestStudies />} />
                </Route>
            </Route>

            {/* Protected Routes for Reports */}
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["admin", "user"]}
                        allowedTiers={["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"]}
                    />
                }
            >
                <Route element={<Layout />}>
                    <Route path="/view-manage-reports" element={<ReportManagement />} />
                    <Route path="/details-settings" element={<DistributionLists />} />
                </Route>
            </Route>

            {/* Catch-All Route for Undefined Paths */}
            <Route path="*" element={<NoPage />} />
        </Routes>
    );
}
