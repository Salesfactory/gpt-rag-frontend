import React from "react";
import styles from "./Navbar.module.css";
import { IconMenu2, IconMessageCircle, IconHistory, IconSettings, IconBell, IconUser, IconMail, IconListCheck } from "@tabler/icons-react";
import { useAppContext } from "../../providers/AppProviders";

interface NavbarProps {
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<NavbarProps> = ({ setIsCollapsed }) => {
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

    const handleOnClickShowSidebar = () => {
        setIsCollapsed(false);
    };

    return (
        <nav className={`navbar navbar-expand-lg navbar-light ${styles.headerNavbar} `}>
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
                    {/* Feedback Panel Button */}
                    <li className="nav-item">
                        <button className="btn btn-light btn-sm d-flex align-items-center gap-1">
                            <IconMessageCircle className={styles.iconLarge} />
                            <span className="d-none d-md-inline">Show feedback panel</span>
                        </button>
                    </li>

                    {/* Hide Chat History Button */}
                    <li className="nav-item">
                        <button className="btn btn-light btn-sm d-flex align-items-center gap-1">
                            <IconHistory className={styles.iconLarge} />
                            <span className="d-none d-md-inline">Hide chat history</span>
                        </button>
                    </li>

                    {/* Settings Button */}
                    <li className="nav-item">
                        <button className="btn btn-light btn-sm d-flex align-items-center gap-1">
                            <IconSettings className={styles.iconLarge} />
                            <span className="d-none d-md-inline">Settings</span>
                        </button>
                    </li>

                    {/* User Profile Card */}
                    <li className="nav-item dropdown">
                        <a className="nav-link" href="#" id="drop2" data-bs-toggle="dropdown" aria-expanded="false">
                            <div className={`d-flex align-items-center gap-2 ${styles.profileCard}`}>
                                <IconBell className={`fs-6 ${styles.iconLarge}`} />
                                <div className={styles.userDetails}>
                                    <p className={`${styles.userName} mb-0`}>Manuel Castro</p>
                                    <p className={`${styles.userEmail} mb-0`}>manuelcastro@hamalsolutions.com</p>
                                </div>
                            </div>
                        </a>
                        <div className="dropdown-menu dropdown-menu-end dropdown-menu-animate-up" aria-labelledby="drop2">
                            <div className={styles.messageBody}>
                                <a href="#" className="d-flex align-items-center gap-2 dropdown-item">
                                    <IconUser className="fs-6" />
                                    <p className="mb-0 fs-3">My Profile</p>
                                </a>
                                <a href="#" className="d-flex align-items-center gap-2 dropdown-item">
                                    <IconMail className="fs-6" />
                                    <p className="mb-0 fs-3">My Account</p>
                                </a>
                                <a href="#" className="d-flex align-items-center gap-2 dropdown-item">
                                    <IconListCheck className="fs-6" />
                                    <p className="mb-0 fs-3">My Task</p>
                                </a>
                                <a
                                    href="https://bootstrapdemos./matdash-free/src/html/authentication-login.html"
                                    className="btn btn-outline-primary mx-3 mt-2 d-block"
                                >
                                    Logout
                                </a>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;
