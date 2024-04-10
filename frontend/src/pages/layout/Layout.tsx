import { Outlet, NavLink, Link } from "react-router-dom";
import { getChatHistory } from "../../api"; //FUNCION DE LA API
import salesLogo from "../../img/logo.png";

import github from "../../assets/github.svg";

import styles from "./Layout.module.css";
import { ChatHistoryButton } from "../../components/ChatHistoryButton/ChatHistoryButton";
import { FeedbackRatingButton } from "../../components/FeedbackRating/FeedbackRatingButton";
import { useAppContext } from "../../providers/AppProviders";
import { SettingsButton } from "../../components/SettingsButton";

const Layout = () => {
    const { showHistoryPanel, setShowHistoryPanel, showFeedbackRatingPanel, setShowFeedbackRatingPanel, settingsPanel, setSettingsPanel } = useAppContext();

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
                    <nav>
                        {/*
                        <ul className={styles.headerNavList}>
                            <li>
                                <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Chat
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Ask a question
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <a href="https://aka.ms/entgptsearch" target={"_blank"} title="Github repository link">
                                    <img
                                        src={github}
                                        alt="Github logo"
                                        aria-label="Link to github repository"
                                        width="20px"
                                        height="20px"
                                        className={styles.githubLogo}
                                    />
                                </a>
                            </li>
                        </ul>
    */}
                    </nav>
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
