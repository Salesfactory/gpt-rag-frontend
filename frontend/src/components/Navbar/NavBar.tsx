import React, { useState } from "react";
import styles from "./Navbar.module.css";
import { IconMenu2, IconMessageCircle, IconHistory, IconSettings, IconBell, IconUser, IconMail, IconListCheck } from "@tabler/icons-react";
import { useAppContext } from "../../providers/AppProviders";
import { Link, useLocation } from "react-router-dom";

interface NavbarProps {
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}
function persistFinancialAssistantState(userId: string | undefined, state: boolean) {
    localStorage.setItem(`financialAssistantActive_${userId}`, JSON.stringify(state));
}

const Navbar: React.FC<NavbarProps> = ({ setIsCollapsed }) => {
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
    const email = user?.email || " ";
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
    };

    const handleShowFeedbackRatingPanel = () => {
        setShowFeedbackRatingPanel(!showFeedbackRatingPanel);
        setSettingsPanel(false);
        setShowHistoryPanel(false);
        setIsDropdownOpen(false);
    };

    const handleShowSettings = () => {
        setSettingsPanel(!settingsPanel);
        setShowHistoryPanel(false);
        setShowFeedbackRatingPanel(false);
        setIsDropdownOpen(false);
    };

    const handleOnClickShowSidebar = () => {
        setIsCollapsed(false);
    };

    const handleOnClickProfileCard = () => {
        setIsDropdownOpen(!isDropdownOpen);
        setShowHistoryPanel(false);
        setShowFeedbackRatingPanel(false);
        setSettingsPanel(false);
    };

    const handleFinancialAgent = () => {
        const newState = !isFinancialAssistantActive;
        setIsFinancialAssistantActive(newState);
        persistFinancialAssistantState(user?.id, newState);
    };

    return (
        <nav className={`navbar navbar-expand-lg navbar-light ${location == "/" ? styles.headerNavbar : styles.headerNavbarAlt} `}>
            {/* Sidebar Toggle (For smaller screens) */}
            <ul className="navbar-nav mr-4">
                <li className="nav-item d-block d-xl-none">
                    <button onClick={handleOnClickShowSidebar} className={`nav-link ${styles.sidebartoggler}`} id="headerCollapse">
                        <IconMenu2 className={styles.iconLarge} />
                    </button>
                </li>
            </ul>
            <div className="navbar-collapse justify-content-end px-0" id="navbarNav">
                <ul className="navbar-nav flex-row align-items-center gap-4">
                    {/* Financial Assistant Toggle */}
                    {fastatus && location === "/" &&(
                        <li className="nav-item">
                            <div className="d-flex flex-column align-items-start">
                                <div className="form-check form-switch">
                                    <input
                                        className={`form-check-input ${styles.financialToggle}`}
                                        type="checkbox"
                                        checked={isFinancialAssistantActive}
                                        onChange={handleFinancialAgent}
                                    />
                                    <span className={`form-check-label ${styles.financialToggleText}`}>Financial Assistant</span>
                                </div>
                            </div>
                        </li>
                    )}
                    {/* Feedback Panel Button */}
                    {location === "/" &&(
                        <li className="nav-item">
                            <button onClick={handleShowFeedbackRatingPanel} className="btn btn-light btn-sm d-flex align-items-center gap-1">
                                <IconMessageCircle className={styles.iconLarge} />
                                <span className="d-none d-md-inline">{feedbackContent}</span>
                            </button>
                        </li>
                    )}
                    {/* Hide Chat History Button */}
                    {location === "/" &&(
                    <li className="nav-item">
                        <button onClick={handleShowHistoryPanel} className="btn btn-light btn-sm d-flex align-items-center gap-1">
                            <IconHistory className={styles.iconLarge} />
                            <span className="d-none d-md-inline">{historyContent}</span>
                        </button>
                    </li>
                    )}
                    {/* Settings Button */}
                    {location === "/" &&(
                    <li className="nav-item">
                        <button onClick={handleShowSettings} className="btn btn-light btn-sm d-flex align-items-center gap-1">
                            <IconSettings className={styles.iconLarge} />
                            <span className="d-none d-md-inline">Settings</span>
                        </button>
                    </li>
                    )}

                    {/* User Profile Card */}
                    <li className="nav-item dropdown">
                        <button
                            className={`nav-link ${isDropdownOpen ? "show" : ""}`}
                            role="button"
                            id="drop2"
                            data-bs-toggle="dropdown"
                            aria-expanded={isDropdownOpen}
                            onClick={handleOnClickProfileCard}
                        >
                            <div className={`d-flex align-items-center gap-2 ${styles.profileCard}`}>
                                <IconBell className={`fs-6 ${styles.iconLarge}`} />
                                <div className={styles.userDetails}>
                                    <p className={`${styles.userName} mb-0`}>{userName}</p>
                                    <p className={`${styles.userEmail} mb-0`}>{email}</p>
                                </div>
                            </div>
                        </button>
                        <div
                            className={`dropdown-menu dropdown-menu-end animate-dropdown ${isDropdownOpen ? "show" : ""}`}
                            aria-labelledby="drop2"
                            data-bs-popper={`${isDropdownOpen ? "static" : ""}`}
                        >
                            <div className={styles.messageBody}>
                                <Link to={""} className="d-flex align-items-center gap-2 dropdown-item">
                                    <IconUser className="fs-6" />
                                    <p className="mb-0 fs-5">My Profile</p>
                                </Link>
                                <Link to={""} className="d-flex align-items-center gap-2 dropdown-item">
                                    <IconMail className="fs-6" />
                                    <p className="mb-0 fs-5">My Account</p>
                                </Link>
                                <Link to={""} className="d-flex align-items-center gap-2 dropdown-item">
                                    <IconListCheck className="fs-6" />
                                    <p className="mb-0 fs-5">My Task</p>
                                </Link>
                                <Link to={"/logout"} className="btn btn-outline-primary mx-3 mt-2 d-block">
                                    Logout
                                </Link>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;
