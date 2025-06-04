import React, { useState } from "react";
import styles from "./Navbarcopy.module.css";
import { Menu, Settings, History, MessageCircleQuestion, ChevronDown } from "lucide-react";
import { useAppContext } from "../../providers/AppProviders";
import { useLocation } from "react-router-dom";
import { ProfilePanel } from "../ProfilePanel/Profilecopy";
import ChatHistorySidebar from "../ChatHistorySidebar/ChatHistorySidebar";

interface NavbarProps {
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

function persistFinancialAssistantState(userId: string | undefined, state: boolean) {
    localStorage.setItem(`financialAssistantActive_${userId}`, JSON.stringify(state));
}

const Navbar: React.FC<NavbarProps> = ({ isCollapsed, setIsCollapsed }) => {
    const {
        setShowFeedbackRatingPanel,
        settingsPanel,
        setSettingsPanel,
        user,
        subscriptionTiers,
        isFinancialAssistantActive,
        setIsFinancialAssistantActive,
        setDataConversation,
        setChatId,
        setNewChatDeleted
    } = useAppContext();
    const userName = user?.name || "";
    const subscriptiontype = subscriptionTiers || " ";
    const location = useLocation().pathname;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);

    const fastatus = subscriptiontype.includes("Basic + Financial Assistant")
        ? true
        : false || subscriptiontype.includes("Premium + Financial Assistant") || subscriptiontype.includes("Custom + Financial Assistant");

    const handleShowChatHistory = () => {
        setShowChatHistory(!showChatHistory);
        setShowFeedbackRatingPanel(false);
        setSettingsPanel(false);
        setIsDropdownOpen(false);
        setIsCollapsed(true);
    };

    const handleShowFeedbackRatingPanel = () => {
        setShowFeedbackRatingPanel(true);
        setSettingsPanel(false);
        setShowChatHistory(false);
        setIsDropdownOpen(false);
        setIsCollapsed(true);
    };

    const handleShowSettings = () => {
        setSettingsPanel(!settingsPanel);
        setShowChatHistory(false);
        setShowFeedbackRatingPanel(false);
        setIsDropdownOpen(false);
        setIsCollapsed(true);
    };

    const handleOnClickShowSidebar = () => {
        setIsCollapsed(!isCollapsed);
        setShowChatHistory(false);
        setShowFeedbackRatingPanel(false);
        setIsDropdownOpen(false);
        setSettingsPanel(false);
    };

    const handleOnClickProfileCard = () => {
        setIsDropdownOpen(!isDropdownOpen);
        setShowChatHistory(false);
        setShowFeedbackRatingPanel(false);
        setSettingsPanel(false);
        setIsCollapsed(true);
    };

    const handleFinancialAgent = () => {
        const newState = !isFinancialAssistantActive;
        setIsFinancialAssistantActive(newState);
        persistFinancialAssistantState(user?.id, newState);
    };

    const handleDeleteChat = () => {
        setDataConversation([]);
        setChatId("");
        if (typeof setNewChatDeleted === "function") {
            setNewChatDeleted(true);
        }
    };

    const getInitialsFromUserName = (name: string): string => {
        if (!name) return "";

        const uppercaseMatches = name.match(/[A-Z]/g);

        if (uppercaseMatches && uppercaseMatches.length >= 2) {
            return uppercaseMatches.slice(0, 2).join("");
        }

        const cleaned = name.replace(/\s+/g, "").slice(0, 2).toUpperCase();
        return cleaned;
    };
    const userInitials = getInitialsFromUserName(userName);

    return (
        <>
            <nav className={`navbar navbar-expand-lg navbar-light ${location == "/" ? styles.headerNavbar : styles.headerNavbarAlt} `}>
                {/* Sidebar Toggle (For smaller screens) */}
                <ul className="navbar-nav mr-4">
                    <li className="nav-item d-flex align-items-center">
                        <button
                            onClick={handleOnClickShowSidebar}
                            className={`nav-link d-flex align-items-center ${styles.sidebartoggler}`}
                            id="headerCollapse"
                        >
                            <Menu className={styles.iconLarge} />
                        </button>
                        {location === "/" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>FreddAid</span>}
                        {location === "/admin" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Team Management</span>}
                        {location === "/organization" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Workspace Governance</span>}
                        {location === "/details-settings" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Distribution Lists</span>}
                        {location === "/upload-resources" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Upload Resources</span>}
                        {location === "/subscription-management" && (
                            <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Subscription Management</span>
                        )}
                        {location === "/view-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Report Dashboard</span>}
                        {location === "/view-manage-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Report Management</span>}
                    </li>
                </ul>
                <div className={`navbar-collapse d-flex px-0 ${styles.iconContainer}`} id="navbarNav">
                    <ul className="navbar-nav flex-row align-items-center gap-3">
                        {/*Then change the route*/}
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
                        {/*Then change the route*/}
                        {/* Feedback Panel Button */}
                        {location === "/" && (
                            <li className="nav-item">
                                <button onClick={handleShowFeedbackRatingPanel} className="btn btn-white btn-sm d-flex align-items-center gap-1">
                                    <MessageCircleQuestion className={styles.iconLarge} />
                                </button>
                            </li>
                        )}
                        {/*Then change the route*/}
                        {/* Chat History Button */}
                        {location === "/" && (
                            <li className="nav-item">
                                <div className={styles.tooltipWrapper}>
                                    <button onClick={handleShowChatHistory} className="btn btn-white btn-sm d-flex align-items-center gap-1">
                                        <History className={styles.iconLarge} />
                                    </button>
                                    <span className={styles.tooltipText}>Chat History</span>
                                </div>
                            </li>
                        )}
                        {/*Then change the route*/}
                        {/* Settings Button */}
                        {location === "/" && (
                            <li className="nav-item">
                                <div className={styles.tooltipWrapper}>
                                    <button onClick={handleShowSettings} className="btn btn-white btn-sm d-flex align-items-center gap-1">
                                        <Settings className={styles.iconLarge} />
                                        <span className={styles.tooltipText}>Model Settings</span>
                                        {/* <span className="d-none d-md-inline">Settings</span> */}
                                    </button>
                                </div>
                            </li>
                        )}

                        {/* User Profile Card */}
                        <li className="nav-item dropdown">
                            <button className="nav-link" onClick={handleOnClickProfileCard}>
                                <div className={`d-flex align-items-center gap-2 ${styles.profileCard}`}>
                                    <div className={styles.profileCircle}>{userInitials}</div>
                                    <span className={styles.userName}>{userName}</span>
                                    <ChevronDown size={16} className={`${styles.chevron} ${isDropdownOpen ? styles.rotate : ""}`} />
                                </div>
                            </button>
                            <ProfilePanel show={isDropdownOpen} />
                        </li>
                    </ul>
                </div>
            </nav>
            {showChatHistory && <ChatHistorySidebar onClose={() => setShowChatHistory(false)} onDeleteChat={handleDeleteChat} />}
        </>
    );
};

export default Navbar;
