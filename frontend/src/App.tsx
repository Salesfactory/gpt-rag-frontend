import React, { useState, useEffect, useContext } from "react";
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
import { PaymentGateway } from "./components/PaymentGateway/PaymentGateway";
import SuccessPayment from "./components/PaymentGateway/SuccessPayment";

import { AppContext } from "./providers/AppProviders";
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
    const { instance } = useMsal();
    const [status, setStatus] = useState<string | null>(null);
    const { organization } = useContext(AppContext) as { organization: Organization };

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

    return (
        <Routes>
            {!organization?.subscriptionId && (
                <>
                    <Route path="/" element={<Onboarding />} />
                    <Route path="/payment" element={<PaymentGateway />} />
                    <Route path="*" element={<NoPage />} />
                </>
            )}
            {organization?.subscriptionId && (
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
                    <Route path="/invitations" element={<Layout />}>
                        <Route
                            index
                            element={
                                <ProtectedRoute allowedRoles={["admin"]}>
                                    <Invitations />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="*" element={<NoPage />} />
                    </Route>
                    <Route path="/organization" element={<Layout />}>
                        <Route
                            index
                            element={
                                <ProtectedRoute allowedRoles={["admin"]}>
                                    <Organization />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="*" element={<NoPage />} />
                    </Route>
                </>
            )}
        </Routes>
    );
}

// Define Organization interface based on your application's structure
interface Organization {
    subscriptionId: string | null;
    // Add other properties as needed
}
