// Layout.tsx

import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import styles from "./_Layout.module.css";
import Sidebar from "../../components/Sidebar/Sidebar";
import Navbar from "../../components/Navbar/NavBar";

const Layout: React.FC = () => {
    const { pathname } = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(true);

    return (
        <>
            {/* Sidebar Start */}
            <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
            {/* Sidebar End */}

            {/* Main Wrapper */}
            <div className={`${styles.bodyWrapper} ${styles.bodyWrapperFull} ${isCollapsed ? styles.collapsed : styles.expanded}`}>
                {/* Header Start */}
                <header className={`${styles.appHeader} ${styles.appHeaderFull} border-bottom py-2 bg-light`}>
                    <Navbar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
                </header>
                {/* Header End */}

                {/* Main Content */}
                <div className={styles.bodyWrapperInner}>
                    {/* Content goes here */}
                    <Outlet />
                </div>
            </div>
        </>
    );
};

export default Layout;
