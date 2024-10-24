import { LogLevel, Configuration } from "@azure/msal-browser";

const tenantName: string = "salesfactoryai2"; // Replace with your tenant name

const policyNames: { signUpSignIn: string; editProfile: string } = {
    signUpSignIn: "B2C_1_signupsignin1",
    editProfile: "B2C_1_edit_profile"
};

export const b2cPolicies = {
    names: policyNames,
    authorities: {
        signUpSignIn: {
            authority: `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/${policyNames.signUpSignIn}`
        },
        editProfile: {
            authority: `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/${policyNames.editProfile}`
        }
    },
    authorityDomain: `${tenantName}.b2clogin.com`
};

const loggerCallback = (level: LogLevel, message: string, containsPii: boolean): void => {
    if (containsPii) {
        return;
    }
    switch (level) {
        case LogLevel.Error:
            console.error(message);
            break;
        case LogLevel.Info:
            console.info(message);
            break;
        case LogLevel.Verbose:
            console.debug(message);
            break;
        case LogLevel.Warning:
            console.warn(message);
            break;
        default:
            break;
    }
};

export const msalConfig: Configuration = {
    auth: {
        clientId: "9c0c6caa-5553-410e-aaa1-12379dd7bec2", // Replace with your client ID
        authority: b2cPolicies.authorities.signUpSignIn.authority,
        knownAuthorities: [b2cPolicies.authorityDomain],
        redirectUri: "/",
        postLogoutRedirectUri: "/"
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false // Set to true if you have issues on IE11 or Edge
    },
    system: {
        allowNativeBroker: false,
        loggerOptions: {
            loggerCallback: loggerCallback,
            logLevel: LogLevel.Info,
            piiLoggingEnabled: false
        }
    }
};

export const loginRequest: { scopes: string[] } = {
    scopes: ["openid", "profile", "offline_access"]
};

export const apiConfig: { scopes: string[]; uri: string } = {
    scopes: ["YOUR_API_SCOPE"], // Replace with your API scopes
    uri: "YOUR_API_URI" // Replace with your API URI
};
