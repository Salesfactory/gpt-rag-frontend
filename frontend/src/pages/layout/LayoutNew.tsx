// Layout.tsx

import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import styles from "./_Layout.module.css";
import { useAppContext } from "../../providers/AppProviders";
import Sidebar from "../../components/Sidebar/Sidebar";
import Navbar from "../../components/Navbar/NavBar";

const Layout: React.FC = () => {
    const { showHistoryPanel, setShowHistoryPanel, showFeedbackRatingPanel, setShowFeedbackRatingPanel, settingsPanel, setSettingsPanel } = useAppContext();

    const { pathname } = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleShowHistoryPanel = () => {
        setShowHistoryPanel(!showHistoryPanel);
        setShowFeedbackRatingPanel(false);
        setSettingsPanel(false);
    };

    const handleShowFeedbackRatingPanel = () => {
        setShowFeedbackRatingPanel(!showFeedbackRatingPanel);
        setSettingsPanel(false);
        setShowHistoryPanel(false);
    };

    const handleShowSettings = () => {
        setSettingsPanel(!settingsPanel);
        setShowHistoryPanel(false);
        setShowFeedbackRatingPanel(false);
    };

    return (
        <>
            {/* Sidebar Start */}
            <Sidebar />
            {/* Sidebar End */}

            {/* Main Wrapper */}
            <div className={`${styles.bodyWrapper} ${styles.bodyWrapperFull}`}>
                {/* Header Start */}
                <header className={`${styles.appHeader} ${styles.appHeaderFull} border-bottom py-2 bg-light`}>
                    <Navbar />
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
