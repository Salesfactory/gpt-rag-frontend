import React, { useEffect } from "react";

const Logout: React.FC = () => {
    useEffect(() => {
        const handleLogout = async () => {
            window.location.href = "/logout";
        };
        handleLogout();
    }, []);

    return null;
};

export default Logout;
