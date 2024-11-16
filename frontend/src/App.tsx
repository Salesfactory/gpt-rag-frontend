import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./router/ProtectedRoute";
import Layout from "./pages/layout/Layout";
import LayoutNew from "./pages/layout/LayoutNew";

import NoPage from "./pages/NoPage";
import AccessDenied from "./pages/AccesDenied";
import Chat from "./pages/chat/Chat";
import Admin from "./pages/admin/Admin";
import Onboarding from "./pages/onboarding/Onboarding";
import Invitations from "./pages/invitations/Invitations";
import Organization from "./pages/organization/Organization";
import FinancialAssistant from "./pages/financialassistant/FinancialAssistant";

import { PaymentGateway } from "./components/PaymentGateway/PaymentGateway";
import SuccessPayment from "./components/PaymentGateway/SuccessPayment";

export default function App() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/payment" element={<PaymentGateway />} />
            <Route element={<LayoutNew />}>
                <Route path="/financial-assistant" element={<Chat />} />
            </Route>
            {/* Access Denied Route */}
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Protected Routes for Authenticated Users (Regular and Admin) */}
            <Route element={<ProtectedRoute allowedRoles={["user", "admin"]} />}>
                <Route element={<Layout />}>
                    {/* Regular User and Admin Routes */}
                    <Route path="/" element={<Chat />} />

                    <Route path="/success-payment" element={<SuccessPayment />} />
                </Route>
            </Route>

            {/* Protected Routes for Admin Only */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route element={<Layout />}>
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/invitations" element={<Invitations />} />
                    <Route path="/organization" element={<Organization />} />
                    <Route path="/financialassistant" element={<FinancialAssistant />} />
                </Route>
            </Route>

            {/* Catch-All Route for Undefined Paths */}
            <Route path="*" element={<NoPage />} />
        </Routes>
    );
}

// Define Organization interface based on your application's structure
interface Organization {
    subscriptionId: string | null;
    // Add other properties as needed
}
