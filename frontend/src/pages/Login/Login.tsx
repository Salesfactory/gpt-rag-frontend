// src/pages/Login.tsx

import React, { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../authConfig";
import { InteractionType } from "@azure/msal-browser";

const Login: React.FC = () => {
    const { instance } = useMsal();

    useEffect(() => {
        instance.loginRedirect(loginRequest).catch(error => {
            console.error("Login Redirect Error:", error);
        });
    }, [instance]);

    return null; // Optionally, render a loading indicator
};

export default Login;
