// Layout.tsx

import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import styles from "./_Layoutcopy.module.css";
import Sidebar from "../../components/Sidebarcopy/Sidebarcopy";
import Navbar from "../../components/Navbar/NavBarcopy";

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
                <header className={`${styles.appHeader} border-bottom py-0.5 bg-white shadow-lg`}>
                    <Navbar setIsCollapsed={setIsCollapsed} isCollapsed={isCollapsed} />
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
