import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { initializeIcons } from "@fluentui/react";
import App from "./App"; // Ensure correct casing

import "./index.css";

import { PublicClientApplication, EventType, AccountInfo } from "@azure/msal-browser";
import { msalConfig } from "./authConfig"; // Adjusted import for default export

export const msalInstance = new PublicClientApplication(msalConfig);

initializeIcons();

msalInstance.initialize().then(() => {
    // Set active account if none is active but accounts are available
    const activeAccount = msalInstance.getActiveAccount();
    const accounts = msalInstance.getAllAccounts();

    if (!activeAccount && accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
    }

    // Enable account storage events to synchronize auth state across tabs/windows
    msalInstance.enableAccountStorageEvents();

    // Add event callback to handle successful login and token acquisition
    msalInstance.addEventCallback(event => {
        if (
            event.eventType === EventType.LOGIN_SUCCESS ||
            event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
            event.eventType === EventType.SSO_SILENT_SUCCESS
        ) {
            const account = (event.payload as { account: AccountInfo }).account;
            msalInstance.setActiveAccount(account);
            console.log("log in success");
        }
    });

    const container = document.getElementById("root");

    // Type assertion to ensure `container` is not null
    if (container) {
        const root = ReactDOM.createRoot(container);

        root.render(
            <React.StrictMode>
                <HashRouter>
                    <App pca={msalInstance} />
                </HashRouter>
            </React.StrictMode>
        );
    } else {
        console.error("Failed to find the root element to mount React application.");
    }
});
