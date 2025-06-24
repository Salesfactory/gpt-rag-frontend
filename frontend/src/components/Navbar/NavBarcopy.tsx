import React, { useEffect, useState } from "react";
import styles from "./Navbarcopy.module.css";
import { Menu, Settings, History, MessageCircleQuestion, ChevronDown, Upload, Copy, ExternalLink } from "lucide-react";
import { useAppContext } from "../../providers/AppProviders";
import { useLocation } from "react-router-dom";
import { ProfilePanel } from "../ProfilePanel/Profilecopy";
import ChatHistorySidebar from "../ChatHistorySidebar/ChatHistorySidebar";
import { getUserById, exportConversation } from "../../api";
import { toast } from "react-toastify";
import { Spinner } from "@fluentui/react";
import FreddaidLogo from "../../img/FreddaidLogo.png";

type Role = "user" | "admin" | "platformAdmin";

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
        userName,
        organization,
        subscriptionTiers,
        isFinancialAssistantActive,
        setIsFinancialAssistantActive,
        setDataConversation,
        setChatId,
        setNewChatDeleted,
        chatId,
        dataConversation
    } = useAppContext();

    const subscriptiontype = subscriptionTiers || " ";
    const location = useLocation().pathname;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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

    const handleExportConversation = async () => {
        const currentConversationId = chatId;
        
        if (!currentConversationId) {
            toast("No active conversation to export.", { type: "warning" });
            return;
        }

        if (!user) {
            toast("Please log in to export conversations.", { type: "warning" });
            return;
        }

        if (!user.id) {
            toast("User information is incomplete.", { type: "warning" });
            return;
        }

        setIsExporting(true);

        try {
            const result = await exportConversation(currentConversationId, user.id);
            
            // Show success toast with copy and open options
            const exportToast = (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>Conversation exported successfully!</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(result.share_url);
                                toast("Link copied to clipboard!", { type: "success" });
                            }}
                            style={{
                                padding: '4px 8px',
                                background: '#0078d4',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <Copy size={12} />
                            Copy Link
                        </button>
                        <button
                            onClick={() => {
                                window.open(result.share_url, '_blank');
                            }}
                            style={{
                                padding: '4px 8px',
                                background: '#107c10',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <ExternalLink size={12} />
                            Open
                        </button>
                    </div>
                </div>
            );

            toast(exportToast, { 
                type: "success", 
                autoClose: 8000,
                closeOnClick: false
            });

        } catch (error) {
            console.error("Error exporting conversation:", error);
            toast("Failed to export conversation. Please try again.", { type: "error" });
        } finally {
            setIsExporting(false);
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
                        {location === "/" && (
                            <div className={`ms-2 d-none d-sm-flex align-items-center ${styles.brandContainer}`}>
                                <img src={FreddaidLogo} alt="FreddAid Logo" className={styles.brandImage} />
                                <span className={styles.greenBar}></span>
                                <span className={styles.brandText2}>{organization?.name}</span>
                            </div>
                        )}
                        {location === "/admin" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Team Management</span>}
                        {location === "/organization" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Workspace Governance</span>}
                        {location === "/knowledge-sources" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Knowledge Sources</span>}
                        {location === "/details-settings" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Distribution List</span>}
                        {location === "/upload-resources" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Upload Resources</span>}
                        {location === "/subscription-management" && (
                            <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Subscription Management</span>
                        )}
                        {location === "/view-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Report Dashboard</span>}
                        {location === "/view-manage-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Report Management</span>}
                        {location === "/curation-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Curation Reports</span>}
                        {location === "/create-curation-report" && (
                            <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Curation Report Creation</span>
                        )}
                        {location === "/create-summarization-report" && (
                            <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Summarization Report Creation</span>
                        )}
                        {location === "/create-template-report" && (
                            <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Summarization Report Template Creation</span>
                        )}
                        {location === "/summarization-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Summarization Reports</span>}
                        {location === "/report-templates" && (
                            <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Summarization Report Templates</span>
                        )}
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
                        {/* {location === "/" && (
                            <li className="nav-item">
                                <button onClick={handleShowFeedbackRatingPanel} className="btn btn-white btn-sm d-flex align-items-center gap-1">
                                    <MessageCircleQuestion className={styles.iconLarge} />
                                </button>
                            </li>
                        )} */}
                        {/*Then change the route*/}
                        {/* Chat History Button */}
                        {/*Then change the route*/}
                        {/* Share Button - only show when there's an active conversation */}
                        {location === "/" && (chatId || dataConversation.length > 0) && (
                            <li className="nav-item">
                                <button 
                                    onClick={handleExportConversation} 
                                    disabled={isExporting}
                                    className={styles.shareButton}
                                >
                                    {isExporting ? (
                                        <>
                                            <Spinner size={1} />
                                            <span>Sharing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            <span>Share</span>
                                        </>
                                    )}
                                </button>
                            </li>
                        )}
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
                                        <span className={styles.tooltipText}>Chat Settings</span>
                                        {/* <span className="d-none d-md-inline">Settings</span> */}
                                    </button>
                                </div>
                            </li>
                        )}

                        {/* User Profile Card */}
                        <li className="nav-item dropdown">
                            <button
                                className={`nav-link ${styles.profileButton} ${isDropdownOpen ? styles.dropdownOpen : ""}`}
                                onClick={handleOnClickProfileCard}
                            >
                                <div className={`d-flex align-items-center gap-2 ${styles.profileCard}`}>
                                    <div className={styles.profileWrapper}>
                                        <div
                                            className={`${styles.profileCircle} ${
                                                (user?.role as Role) === "platformAdmin"
                                                    ? styles.platformAdminBorder
                                                    : user?.role === "admin"
                                                    ? styles.adminBorder
                                                    : styles.userBorder
                                            }`}
                                        >
                                            {userInitials}

                                            {/* Hover Tooltip */}
                                            <div className={styles.tooltip}>
                                                <div className={styles.tooltipContent}>
                                                    <div className={styles.userName}>{userName}</div>
                                                    <div className={styles.userRole}>
                                                        {(user?.role as Role) === "platformAdmin"
                                                            ? "Platform Administrator"
                                                            : (user?.role as Role) === "admin"
                                                            ? "Administrator"
                                                            : "User"}
                                                    </div>
                                                </div>
                                                {/* Tooltip Arrow */}
                                                <div className={styles.tooltipArrow}></div>
                                            </div>
                                        </div>
                                    </div>
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
