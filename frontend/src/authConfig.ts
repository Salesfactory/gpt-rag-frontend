/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel } from "@azure/msal-browser";

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */

interface AuthConfig {
    clientId: string;
    authority: string;
    knownAuthorities: string[];
    redirectUri: string;
    postLogoutRedirectUri: string;
    navigateToLoginRequestUrl: boolean;
}

interface CacheConfig {
    cacheLocation: "sessionStorage" | "localStorage";
    storeAuthStateInCookie: boolean;
}

interface LoggerOptions {
    loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => void;
}

interface SystemConfig {
    loggerOptions: LoggerOptions;
}

interface MsalConfig {
    auth: AuthConfig;
    cache: CacheConfig;
    system: SystemConfig;
}

export const msalConfig: MsalConfig = {
    auth: {
        clientId: "9c0c6caa-5553-410e-aaa1-12379dd7bec2", // This is the ONLY mandatory field that you need to supply.
        authority: "https://salesfactoryai2.b2clogin.com/salesfactoryai2.onmicrosoft.com/B2C_1_signupsignin1", // Using B2C policy - replace with your actual policy name
        knownAuthorities: ["salesfactoryai2.b2clogin.com"], // Add known authorities to bypass authority validation
        redirectUri: window.location.origin, // Using window.location.origin instead of hardcoded URL
        postLogoutRedirectUri: window.location.origin, // Using window.location.origin
        navigateToLoginRequestUrl: true // Changed to true to maintain the original request URL
    },
    cache: {
        cacheLocation: "localStorage", // Changed to localStorage for SSO between tabs
        storeAuthStateInCookie: true // Changed to true for better browser compatibility
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }
            }
        }
    }
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit:
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export const loginRequest = {
    scopes: ["openid", "profile", "email"]
};

/**
 * An optional silentRequest object can be used to achieve silent SSO
 * between applications by providing a "login_hint" property.
 */
export const silentRequest = {
    scopes: ["openid", "profile", "email"]
};
