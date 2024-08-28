import React, { useContext } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./router/ProtectedRoute";
import { initializeIcons } from "@fluentui/react";

import "./index.css";

import Layout from "./pages/layout/Layout";
import NoPage from "./pages/NoPage";
import AccessDenied from "./pages/AccesDenied";
import Chat from "./pages/chat/Chat";
import Admin from "./pages/admin/Admin";
import Onboarding from "./pages/onboarding/Onboarding";
import { AppProvider } from "./providers/AppProviders";
import { PaymentGateway } from "./components/PaymentGateway/PaymentGateway";
import SuccessPayment from "./components/PaymentGateway/SuccessPayment";

import { AppContext } from "./providers/AppProviders";

initializeIcons();

export default function App() {
    const { user } = useContext(AppContext);

    return (
        <HashRouter>
            <Routes>
                {!user.organizationId && (
                    <>
                        <Route path="/" element={<Onboarding />} />
                        <Route path="/payment" element={<PaymentGateway />} />
                        <Route path="*" element={<NoPage />} />
                    </>
                )}
                {user.organizationId && (
                    <>
                        <Route path="/" element={<Layout />}>
                            <Route index element={<Chat />} />
                            <Route path="*" element={<NoPage />} />
                        </Route>
                        <Route path="/admin" element={<Layout />}>
                            <Route
                                index
                                element={
                                    <ProtectedRoute allowedRoles={["admin"]}>
                                        <Admin />
                                    </ProtectedRoute>
                                }
                            />
                            <Route path="*" element={<NoPage />} />
                        </Route>
                        <Route path="/access-denied" element={<Layout />}>
                            <Route index element={<AccessDenied />} />
                            <Route path="*" element={<NoPage />} />
                        </Route>
                        <Route path="/payment" element={<Layout />}>
                            <Route index element={<PaymentGateway />} />
                            <Route path="*" element={<NoPage />} />
                        </Route>
                        <Route path="/success-payment" element={<Layout />}>
                            <Route index element={<SuccessPayment />} />
                            <Route path="*" element={<NoPage />} />
                        </Route>
                    </>
                )}
            </Routes>
        </HashRouter>
    );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <AppProvider>
            <App />
        </AppProvider>
    </React.StrictMode>
);
