import React, { useState, useEffect, useRef } from "react";
import styles from "./Navbarcopy.module.css";
import { Menu, Settings, Clock, ChevronDown, Upload, Copy, ExternalLink } from "lucide-react";
import { useAppContext } from "../../providers/AppProviders";
import { useLocation } from "react-router-dom";
import { ProfilePanel } from "../ProfilePanel/Profilecopy";
import ChatHistorySidebar from "../ChatHistorySidebar/ChatHistorySidebar";
import { getUserById, exportConversation } from "../../api";
import { toast } from "react-toastify";
import { Spinner } from "@fluentui/react";
import SFActionableLogo from "../../img/SF-actionableLogo.png";
import { SettingsPanel } from "../../components/SettingsPanel/indexCopy";

type Role = "user" | "admin" | "platformAdmin";

interface NavbarProps {
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<NavbarProps> = ({ isCollapsed, setIsCollapsed }) => {
    const {
        setShowFeedbackRatingPanel,
        user,
        userName,
        organization,
        setDataConversation,
        setChatId,
        setNewChatDeleted,
        chatId,
        dataConversation,
        setRefreshFetchHistory
    } = useAppContext();

    const location = useLocation().pathname;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const profileRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        if (!isDropdownOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

    const [settingsPanel, setSettingsPanel] = useState(false);

    const handleShowChatHistory = () => {
        setShowChatHistory(!showChatHistory);
        setShowFeedbackRatingPanel(false);
        setSettingsPanel(false);
        setIsDropdownOpen(false);
        setIsCollapsed(true);
        setRefreshFetchHistory(true);
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
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>Conversation exported successfully!</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            aria-label="Copy Link in the keyboard"
                            onClick={() => {
                                navigator.clipboard.writeText(result.share_url);
                                toast("Link copied to clipboard!", { type: "success" });
                            }}
                            style={{
                                padding: "4px 8px",
                                background: "#0078d4",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                            }}
                        >
                            <Copy size={12} />
                            Copy Link
                        </button>
                        <button
                            aria-label="Open Link in the Keyboard"
                            onClick={() => {
                                window.open(result.share_url, "_blank");
                            }}
                            style={{
                                padding: "4px 8px",
                                background: "#107c10",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
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

    const [chatPanelMinWidth, setChatPanelMinWidth] = useState(260);
    const [chatPanelMaxWidth, setChatPanelMaxWidth] = useState(500);
    const [chatPanelWidth, setChatPanelWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 750) {
                setChatPanelMinWidth(120); // o el valor que prefieras para móvil
                setChatPanelMaxWidth(window.innerWidth * 0.95); // 95% del ancho de pantalla
                if (chatPanelWidth > window.innerWidth * 0.95) {
                    setChatPanelWidth(window.innerWidth * 0.95);
                }
            } else {
                setChatPanelMinWidth(260);
                setChatPanelMaxWidth(500);
                if (chatPanelWidth > 500) {
                    setChatPanelWidth(500);
                }
            }
        };
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, [chatPanelWidth]);

    const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = chatPanelWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(chatPanelMinWidth, Math.min(chatPanelMaxWidth, startWidth - (moveEvent.clientX - startX)));
            setChatPanelWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.body.style.userSelect = "none";
    };

    return (
        <>
            <nav className={`navbar navbar-expand-lg h-14 navbar-light ${location == "/" ? styles.headerNavbar : styles.headerNavbarAlt} `}>
                {/* Sidebar Toggle (For smaller screens) */}
                <ul className="navbar-nav mr-2">
                    <li className="nav-item d-flex align-items-center">
                        <button
                            aria-label="Show Menu"
                            onClick={handleOnClickShowSidebar}
                            className={`nav-link d-flex align-items-center  ${styles.sidebartoggler}`}
                            id="headerCollapse"
                        >
                            <Menu width={20} height={20} className={styles.iconLarge} />
                        </button>
                        {location === "/" && (
                            <div className={`ms-1 d-none d-sm-flex align-items-center ${styles.brandContainer}`}>
                                <img src={SFActionableLogo} alt="FreddAid Logo" className={styles.brandImage} />
                                <span className={styles.grayBar}></span>
                                <span className={styles.brandText2}>{organization?.name}</span>
                            </div>
                        )}
                        {location === "/admin" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Team Management</span>}
                        {location === "/organization" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Workspace Governance</span>}
                        {location === "/knowledge-sources" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Knowledge Sources</span>}
                        {location === "/voice-customer" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Voice of Customer</span>}
                        {location === "/details-settings" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Distribution List</span>}
                        {location === "/upload-resources" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>File Vault</span>}
                        {location === "/vault" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Vault</span>}
                        {location === "/subscription-management" && (
                            <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Subscription Management</span>
                        )}
                        {location === "/view-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Report Dashboard</span>}
                        {location === "/view-manage-reports" && <span className={`ms-2 d-none d-sm-inline ${styles.brandText}`}>Report Management</span>}
                    </li>
                </ul>
                <div className={`navbar-collapse d-flex px-0 ${styles.iconContainer}`} id="navbarNav">
                    <ul className="navbar-nav flex-row align-items-center gap-2">
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
                                <div className={styles.tooltipWrapper}>
                                    <button
                                        aria-label="Export Conversation"
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
                                    <span className={styles.tooltipText}>Share conversation</span>
                                </div>
                            </li>
                        )}
                        {location === "/" && (
                            <li className="nav-item">
                                <div className={styles.tooltipWrapper}>
                                    <button
                                        onClick={handleShowChatHistory}
                                        aria-label="Chat History Button"
                                        className={`btn btn-white btn-sm d-flex align-items-center gap-1 ${styles.historyButton}`}
                                    >
                                        <Clock className={styles.iconLarge} />
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
                                    <button
                                        aria-label="Chat Settings"
                                        onClick={handleShowSettings}
                                        className={`btn btn-white btn-sm d-flex align-items-center gap-1 ${styles.historyButton}`}
                                        data-testid="settings-button"
                                    >
                                        <Settings className={styles.iconLarge} />
                                        <span className={styles.tooltipText}>Chat Settings</span>
                                        {/* <span className="d-none d-md-inline">Settings</span> */}
                                    </button>
                                </div>
                            </li>
                        )}

                        {/* User Profile Card */}
                        <li className="nav-item dropdown" ref={profileRef}>
                            <button
                                className={`nav-link ${styles.profileButton} ${isDropdownOpen ? styles.dropdownOpen : ""}`}
                                onClick={handleOnClickProfileCard}
                                aria-label="Profile Card"
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
                                    <ChevronDown size={14} className={`${styles.chevron} ${isDropdownOpen ? styles.rotate : ""}`} />
                                </div>
                            </button>
                            <ProfilePanel show={isDropdownOpen} />
                        </li>
                    </ul>
                    <div>
                        <div className={settingsPanel ? styles.commandsContainer : styles.hidden}>
                            {settingsPanel && <SettingsPanel onClose={() => setSettingsPanel(false)} />}
                        </div>
                    </div>
                </div>
            </nav>
            <>
                {showChatHistory && (
                    <ChatHistorySidebar
                        onClose={() => setShowChatHistory(false)}
                        onDeleteChat={handleDeleteChat}
                        width={chatPanelWidth}
                        minWidth={chatPanelMinWidth}
                        maxWidth={chatPanelMaxWidth}
                        onResizeMouseDown={handleResizeMouseDown}
                        isResizing={isResizing}
                    />
                )}
            </>
        </>
    );
};

export default Navbar;
