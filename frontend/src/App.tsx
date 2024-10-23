import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import ProtectedRoute from "./router/ProtectedRoute";
import Layout from "./pages/layout/Layout";
import NoPage from "./pages/NoPage";
import AccessDenied from "./pages/AccesDenied";
import Chat from "./pages/chat/Chat";
import Admin from "./pages/admin/Admin";
import Onboarding from "./pages/onboarding/Onboarding";
import Invitations from "./pages/invitations/Invitations";
import Organization from "./pages/organization/Organization";
import Login from "./pages/Login/Login";
import { PaymentGateway } from "./components/PaymentGateway/PaymentGateway";
import SuccessPayment from "./components/PaymentGateway/SuccessPayment";
import { MsalProvider, useMsal } from "@azure/msal-react";
import {
    EventType,
    PublicClientApplication,
    AccountInfo,
    EventMessage,
    AuthenticationResult,
    NavigationClient,
    NavigationOptions,
    SsoSilentRequest
} from "@azure/msal-browser";
import { b2cPolicies } from "./authConfig";
import { AppProvider } from "./providers/AppProviders";

interface AppProps {
    pca: PublicClientApplication;
}

export default function App({ pca }: AppProps) {
    return (
        <ClientSideNavigation pca={pca}>
            <MsalProvider instance={pca}>
                <Pages />
            </MsalProvider>
        </ClientSideNavigation>
    );
}

interface ClientSideNavigationProps {
    pca: PublicClientApplication;
    children: React.ReactNode;
}

function ClientSideNavigation({ pca, children }: ClientSideNavigationProps) {
    const navigate = useNavigate();
    const [firstRender, setFirstRender] = useState<boolean>(true);

    useEffect(() => {
        class CustomNavigationClient extends NavigationClient {
            navigateInternal(url: string, options: NavigationOptions): Promise<boolean> {
                navigate(url);
                return Promise.resolve(false);
            }
        }

        pca.setNavigationClient(new CustomNavigationClient());
        setFirstRender(false);
    }, [pca, navigate]);

    if (firstRender) {
        return null;
    }

    return <>{children}</>;
}

function Pages() {
    const { instance, accounts, inProgress } = useMsal();
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        const callbackId = instance.addEventCallback((event: EventMessage) => {
            if ((event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) && event.payload) {
                const authResult = event.payload as AuthenticationResult;
                const account = authResult.account;
                const idTokenClaims = authResult.idTokenClaims as any;

                if (idTokenClaims["tfp"] === b2cPolicies.names.editProfile) {
                    const originalSignInAccount = instance
                        .getAllAccounts()
                        .find(
                            (accountItem: AccountInfo) =>
                                accountItem.idTokenClaims?.oid === account.idTokenClaims?.oid &&
                                accountItem.idTokenClaims?.sub === account.idTokenClaims?.sub &&
                                accountItem.idTokenClaims?.tfp === b2cPolicies.names.signUpSignIn
                        );

                    if (originalSignInAccount) {
                        const signUpSignInFlowRequest: SsoSilentRequest = {
                            authority: b2cPolicies.authorities.signUpSignIn.authority,
                            account: originalSignInAccount
                        };

                        // Silently login again with the signUpSignIn policy
                        instance.ssoSilent(signUpSignInFlowRequest).catch(error => {
                            // Handle error
                            console.error(error);
                        });
                    }
                }
            }

            if (event.eventType === EventType.SSO_SILENT_SUCCESS && event.payload) {
                setStatus("ssoSilent success");
            }
        });

        return () => {
            if (callbackId) {
                instance.removeEventCallback(callbackId);
            }
        };
    }, [instance]);
    const activeAccount = instance.getActiveAccount();

    console.log(accounts);
    console.log(inProgress);

    if (inProgress !== "none") {
        return <div>loading</div>;
    }

    return (
        <AppProvider activeAccount={activeAccount}>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/payment" element={<PaymentGateway />} />

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
                    </Route>
                </Route>

                {/* Catch-All Route for Undefined Paths */}
                <Route path="*" element={<NoPage />} />
            </Routes>
        </AppProvider>
    );
}

// Define Organization interface based on your application's structure
interface Organization {
    subscriptionId: string | null;
    // Add other properties as needed
}
