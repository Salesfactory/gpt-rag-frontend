import React from "react";
import styles from "./Navbar.module.css";
import { IconMenu2, IconMessageCircle, IconHistory, IconSettings, IconBell, IconUser, IconMail, IconListCheck } from "@tabler/icons-react";

const Navbar: React.FC = () => {
    return (
        <nav className="navbar navbar-expand-lg navbar-light">
            {/* Sidebar Toggle (For smaller screens) */}
            <ul className="navbar-nav">
                <li className="nav-item d-block d-xl-none">
                    <a className={`nav-link ${styles.sidebartoggler}`} id="headerCollapse" href="#">
                        <IconMenu2 className={styles.iconLarge} />
                    </a>
                </li>
            </ul>

            <div className="navbar-collapse justify-content-end px-0" id="navbarNav">
                <ul className="navbar-nav flex-row align-items-center gap-3">
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
