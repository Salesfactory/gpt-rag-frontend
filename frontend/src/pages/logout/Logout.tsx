import React from "react";

const Logout: React.FC = () => {
    localStorage.clear();
    sessionStorage.clear();

    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        if (name.startsWith("selectedOrg_")) {
            document.cookie = `${name}=; max-age=0; path=/`;
        }
    }

    window.location.href = "/logout";

    return null;
};

export default Logout;
