import React from "react";
import ReactDOM from "react-dom/client";

import { HashRouter } from "react-router-dom";

import { AppProvider } from "./providers/AppProviders";
import App from "./App";

import { initializeIcons } from "@fluentui/react";

import "./index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer } from "react-toastify";
import { installFetchUnauthorizedListener } from "./providers/SessionMonitorProvider";

initializeIcons();

const container = document.getElementById("root");

// Type assertion to ensure `container` is not null
if (container) {
    installFetchUnauthorizedListener();
    const root = ReactDOM.createRoot(container);

    root.render(
        <React.StrictMode>
            <HashRouter>
                <AppProvider>
                    <App />
                    <ToastContainer position="top-right" autoClose={3000} style={{ zIndex: 99999 }} />
                </AppProvider>
            </HashRouter>
        </React.StrictMode>
    );
} else {
    console.error("Failed to find the root element to mount React application.");
}
