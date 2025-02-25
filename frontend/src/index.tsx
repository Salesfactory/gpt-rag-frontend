// index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { PublicClientApplication, EventType, AuthenticationResult } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { initializeIcons } from "@fluentui/react";

import "./index.css";
import "bootstrap/dist/css/bootstrap.min.css";

initializeIcons();

/**
 * MSAL should be instantiated outside of the component tree to prevent it from being re-instantiated on re-renders.
 */
const msalInstance = new PublicClientApplication(msalConfig);

// Set the first available account as active if none is set
const accounts = msalInstance.getAllAccounts();
if (!msalInstance.getActiveAccount() && accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
}

// Listen for sign-in events and set active account
msalInstance.addEventCallback(event => {
    const payload = event.payload as AuthenticationResult | null;
    if (event.eventType === EventType.LOGIN_SUCCESS && payload?.account) {
        console.info("MSAL Login Successful:", payload.account);
        msalInstance.setActiveAccount(payload.account);
    } else {
        console.warn("MSAL Event:", event);
    }
});

// Mount React app
const container = document.getElementById("root");
if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(
        <React.StrictMode>
            <App instance={msalInstance} />
        </React.StrictMode>
    );
} else {
    console.error("Failed to find the root element to mount React application.");
}
