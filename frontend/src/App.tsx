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
import Organization from "./pages/organization/Organizationcopy";

import UploadResources from "./pages/resources/UploadResources";

import SubscriptionManagement from "./pages/subscriptionmanagement/SubscriptionManagementcopy";

import KnowledgeSources from "./pages/knowledgesources/KnowledgeSources";
import VoiceCustomer from "./pages/voicecustomer/VoiceCustomer";
import Gallery from "./pages/gallery/Gallery";
import SubscriptionError from "./pages/SubscriptionError";

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
                    <Route path="/" element={<Chat />} />
                    <Route path="/success-payment" element={<SuccessPayment />} />
                    <Route path="/help-center" element={<HelpCenter />} />
                    <Route path="/vizvault" element={<Gallery />} />
                    <Route path="/notification-settings" element={<Notifications />} />
                    <Route path="/access-denied" element={<AccessDenied />} />
                    <Route path="/subscription-error" element={<SubscriptionError />} />
                </Route>
            </Route>
            {/* <Route
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
                <Route element={<Layout2 />}>
                    {/* <Route path="/secondary-chat" element={<Chat2 />} /> */}
            {/* <Route path="/secondary-admin" element={<Admin2 />} /> */}
            {/* <Route path="/secondary-organization" element={<Organization2 />} /> */}
            {/* <Route path="/secondary-details-settings" element={<DistributionLists2 />} /> */}
            {/* <Route path="/secondary-subscription-management" element={<SubscriptionManagementcopy />} /> */}
            {/* <Route path="/secondary-upload-resources" element={<UploadResources2 />} /> */}
            {/* <Route path="/secondary-view-reports" element={<Reports2 />} /> 
                </Route>
            </Route> */}

            {/* Protected Routes for Admin Only */}
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
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/organization" element={<Organization />} />
                    <Route path="/knowledge-sources" element={<KnowledgeSources />} />
                    <Route path="/voice-customer" element={<VoiceCustomer />} />
                    <Route path="/subscription-management" element={<SubscriptionManagement />} />
                </Route>
            </Route>

            {/* Protected Routes for Premium Features */}
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["admin", "user", "platformAdmin"]}
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
                        allowedRoles={["admin", "platformAdmin"]}
                        allowedTiers={["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"]}
                    />
                }
            >
                <Route element={<Layout />}></Route>
            </Route>

            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["admin", "platformAdmin"]}
                        allowedTiers={["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"]}
                    />
                }
            >
                <Route element={<Layout />}></Route>
            </Route>

            {/* Catch-All Route for Undefined Paths */}
            <Route path="*" element={<NoPage />} />
        </Routes>
    );
}
