import React, { useContext, useEffect, useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { getChatHistory } from "../../api"; //FUNCION DE LA API
import salesLogo from "../../img/logo.png";

import github from "../../assets/github.svg";

import styles from "./Layout.module.css";
import { ChatHistoryButton } from "../../components/ChatHistoryButton/ChatHistoryButton";
import { FeedbackRatingButton } from "../../components/FeedbackRating/FeedbackRatingButton";
import { AppContext } from "../../providers/AppProviders";
import { SettingsButton } from "../../components/SettingsButton";

const Layout = () => {
    const { showHistoryPanel, setShowHistoryPanel, showFeedbackRatingPanel, setShowFeedbackRatingPanel, settingsPanel, setSettingsPanel } =
        useContext(AppContext);

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
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <Link to="/" className={styles.headerTitleContainer}>
                        <img height="45px" src={salesLogo}></img>
                        <h3 className={styles.headerTitle}></h3>
                    </Link>
                    <nav></nav>
                    <div className={styles.layoutOptions}>
                        <FeedbackRatingButton onClick={handleShowFeedbackRatingPanel} />
                        <ChatHistoryButton onClick={handleShowHistoryPanel} />
                        <SettingsButton onClick={handleShowSettings} />
                    </div>
                </div>
            </header>

            <Outlet />
        </div>
    );
};

export default Layout;
