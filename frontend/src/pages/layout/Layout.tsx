import React, { useContext, useEffect, useState } from "react";
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";

import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { getChatHistory } from "../../api"; //FUNCION DE LA API
import salesLogo from "../../img/logo.png";

import github from "../../assets/github.svg";

import styles from "./Layout.module.css";
import { ChatHistoryButton } from "../../components/ChatHistoryButton/ChatHistoryButton";
import { FeedbackRatingButton } from "../../components/FeedbackRating/FeedbackRatingButton";
import { useAppContext } from "../../providers/AppProviders";
import { SettingsButton } from "../../components/SettingsButton";
import { ButtonPaymentGateway } from "../../components/PaymentGateway/ButtonPaymentGateway";
import { SideMenu } from "../../components/SideMenu/SideMenu";
import { ProfileButton } from "../../components/Profile";
import FinancialAssistantToggle from "../../components/FinancialAssistantButton/FinancialAssistantButton";

const Layout = () => {
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

    const handleFinancialAssistant = () => {
        
    };

    return (
        <>
            <div className={`${styles.layout} ${isCollapsed ? styles.collapsedContent : ""}`}>
                <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
                    <SideMenu isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
                </aside>
                <main className={styles.content}>
                    <header className={styles.header} role={"banner"}>
                        <div className={styles.headerContainer}>
                            <nav></nav>
                            <div className={styles.layoutOptions}>
                                {pathname === "/" && (
                                    <>
                                        <FinancialAssistantToggle onClick={handleFinancialAssistant} />
                                        <FeedbackRatingButton onClick={handleShowFeedbackRatingPanel} />
                                        <ChatHistoryButton onClick={handleShowHistoryPanel} />
                                        <SettingsButton onClick={handleShowSettings} />
                                        
                                    </>
                                )}
                                <div className={styles.profileButtonContainer}>
                                    <ProfileButton />
                                </div>
                            </div>
                        </div>
                    </header>

                    <Outlet />
                </main>
            </div>
        </>
    );
};

export default Layout;
