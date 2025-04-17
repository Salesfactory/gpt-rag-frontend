import React from "react";

const Logout: React.FC = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/logout";

    return null;
};

export default Logout;
