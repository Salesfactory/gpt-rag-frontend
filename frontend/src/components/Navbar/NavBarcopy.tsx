import React, { useState } from "react";
import styles from "./Navbarcopy.module.css";
import { Menu, Settings, History, MessageCircleQuestion } from "lucide-react";
import { IconMenu2, IconHistory, IconSettings, IconAppsFilled, IconMessageCircleQuestion } from "@tabler/icons-react";
import { useAppContext } from "../../providers/AppProviders";
import { Link, useLocation } from "react-router-dom";
import { ProfilePanel } from "../ProfilePanel/Profile";

interface NavbarProps {
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}
function persistFinancialAssistantState(userId: string | undefined, state: boolean) {
    localStorage.setItem(`financialAssistantActive_${userId}`, JSON.stringify(state));
}

const Navbar: React.FC<NavbarProps> = ({ isCollapsed, setIsCollapsed }) => {
    const {
        showHistoryPanel,
        setShowHistoryPanel,
        showFeedbackRatingPanel,
        setShowFeedbackRatingPanel,
        settingsPanel,
        setSettingsPanel,
        user,
        subscriptionTiers,
        isFinancialAssistantActive,
        setIsFinancialAssistantActive
    } = useAppContext();
    const historyContent = showHistoryPanel ? "Hide chat history" : "Show chat history";
    const feedbackContent = showFeedbackRatingPanel ? "Hide feedback panel" : "Show feedback panel";
    const userName = user?.name || "";
    const subscriptiontype = subscriptionTiers || " ";
    const location = useLocation().pathname;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const fastatus = subscriptiontype.includes("Basic + Financial Assistant")
        ? true
        : false || subscriptiontype.includes("Premium + Financial Assistant") || subscriptiontype.includes("Custom + Financial Assistant");

    const handleShowHistoryPanel = () => {
        setShowHistoryPanel(!showHistoryPanel);
        setShowFeedbackRatingPanel(false);
        setSettingsPanel(false);
        setIsDropdownOpen(false);
        setIsCollapsed(true);
    };

    const handleShowFeedbackRatingPanel = () => {
        setShowFeedbackRatingPanel(!showFeedbackRatingPanel);
        setSettingsPanel(false);
        setShowHistoryPanel(false);
        setIsDropdownOpen(false);
        setIsCollapsed(true);
    };

    const handleShowSettings = () => {
        setSettingsPanel(!settingsPanel);
        setShowHistoryPanel(false);
        setShowFeedbackRatingPanel(false);
        setIsDropdownOpen(false);
        setIsCollapsed(true);
    };

    const handleOnClickShowSidebar = () => {
        setIsCollapsed(!isCollapsed);
        setShowHistoryPanel(false);
        setShowFeedbackRatingPanel(false);
        setIsDropdownOpen(false);
        setSettingsPanel(false);
    };

    const handleOnClickProfileCard = () => {
        setIsDropdownOpen(!isDropdownOpen);
        setShowHistoryPanel(false);
        setShowFeedbackRatingPanel(false);
        setSettingsPanel(false);
        setIsCollapsed(true);
    };

    const handleFinancialAgent = () => {
        const newState = !isFinancialAssistantActive;
        setIsFinancialAssistantActive(newState);
        persistFinancialAssistantState(user?.id, newState);
    };

    const getInitialsFromUserName = (name: string): string => {
        if (!name) return "";

        const uppercaseMatches = name.match(/[A-Z]/g);

        if (uppercaseMatches && uppercaseMatches.length >= 2) {
            // Si hay al menos 2 letras mayúsculas, usamos las primeras dos
            return uppercaseMatches.slice(0, 2).join("");
        }

        // Si no, usamos las dos primeras letras del nombre (ignorando espacios)
        const cleaned = name.replace(/\s+/g, "").slice(0, 2).toUpperCase();
        return cleaned;
    };
    const userInitials = getInitialsFromUserName(userName);

    return (
        <nav className={`navbar navbar-expand-lg navbar-light ${location == "/" ? styles.headerNavbar : styles.headerNavbarAlt} `}>
            {/* Sidebar Toggle (For smaller screens) */}
            <ul className="navbar-nav mr-4">
                <li className="nav-item d-flex align-items-center">
                    <button onClick={handleOnClickShowSidebar} className={`nav-link d-flex align-items-center ${styles.sidebartoggler}`} id="headerCollapse">
                        <Menu className={styles.iconLarge} />
                    </button>
                    <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>FreddAid</span>
                </li>
            </ul>
            <div className={`navbar-collapse d-flex px-0 ${styles.iconContainer}`} id="navbarNav">
                <ul className="navbar-nav flex-row align-items-center gap-3">
                    {/* Financial Assistant Toggle */}
                    {fastatus && location === "/" && (
                        <li className="nav-item">
                            <div className="d-flex flex-column align-items-start">
                                <div className={styles.financialToggleContainer}>
                                    <span className={styles.financialToggleText}>Financial Assistant </span>
                                    <div className="form-check form-switch">
                                        <input
                                            className={`form-check-input ${styles.financialToggle}`}
                                            type="checkbox"
                                            checked={isFinancialAssistantActive}
                                            onChange={handleFinancialAgent}
                                        />
                                    </div>
                                </div>
                            </div>
                        </li>
                    )}
                    {/* Feedback Panel Button */}
                    {location === "/" && (
                        <li className="nav-item">
                            <button onClick={handleShowFeedbackRatingPanel} className="btn btn-white btn-sm d-flex align-items-center gap-1">
                                <MessageCircleQuestion className={styles.iconLarge} />
                                {/* <span className="d-none d-md-inline">{feedbackContent}</span> */}
                            </button>
                        </li>
                    )}
                    {/* Hide Chat History Button */}
                    {location === "/" && (
                        <li className="nav-item">
                            <button onClick={handleShowHistoryPanel} className="btn btn-white btn-sm d-flex align-items-center gap-1">
                                <History className={styles.iconLarge} />
                                {/* <span className="d-none d-md-inline">{historyContent}</span> */}
                            </button>
                        </li>
                    )}
                    {/* Settings Button */}
                    {location === "/" && (
                        <li className="nav-item">
                            <button onClick={handleShowSettings} className="btn btn-white btn-sm d-flex align-items-center gap-1">
                                <Settings className={styles.iconLarge} />
                                {/* <span className="d-none d-md-inline">Settings</span> */}
                            </button>
                        </li>
                    )}

                    {/* User Profile Card */}
                    <li className="nav-item dropdown">
                        <button className="nav-link" onClick={handleOnClickProfileCard}>
                            <div className={`d-flex align-items-center gap-2 ${styles.profileCard}`}>
                                <div className={styles.profileCircle}>{userInitials}</div>
                                <span className={`${styles.userName} d-none d-md-inline`}>{userName}</span>
                            </div>
                        </button>
                        {isDropdownOpen && <ProfilePanel />}
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;
