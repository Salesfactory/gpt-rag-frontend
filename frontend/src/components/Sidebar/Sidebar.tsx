// Sidebar.tsx
import React from "react";
import { Link } from "react-router-dom";
import {
    IconX,
    IconMessagePlus,
    IconBell,
    IconDiscountCheck,
    IconStar,
    IconFileInvoice,
    IconChecklist,
    IconHeadset,
    IconDots,
    IconSubtask
} from "@tabler/icons-react";
import salesLogo from "../../img/logo.png";
import styles from "./Sidebar.module.css";
import SidebarItem from "./SidebarItem";

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
    const handleOnClickCloseSideBar = () => {
        setIsCollapsed(true);
    };
    return (
        <aside className={`${isCollapsed === false ? styles.showSidebar : ""} ${styles.leftSidebar}`}>
            {/* Sidebar scroll */}
            <div>
                <div className={`d-flex align-items-center justify-content-between ${styles.brandLogo}`}>
                    <Link to="#">
                        <img src={salesLogo} alt="Sales Factory logo" className={styles.brandLogoImg} />
                    </Link>
                    <button
                        onClick={handleOnClickCloseSideBar}
                        className={`d-xl-none d-block ${styles.closeBtn} ${styles.sidebarToggler} ${styles.cursorPointer}`}
                        id="sidebarCollapse"
                    >
                        <IconX className={styles.icon} />
                    </button>
                </div>

                {/* Sidebar navigation */}
                <nav className={`${styles.nav} ${styles.scrollSidebar}`} data-simplebar="init">
                    <ul className={styles.navUl}>
                        {/* Section Title */}
                        <li className={styles.navSmallCap}>
                            <IconDots className={`${styles.navSmallCapIcon}`} />
                            <span className={styles.hideMenu}>Agent</span>
                        </li>

                        {/* Sidebar Items */}
                        <SidebarItem title="AI Chat" icon={<IconMessagePlus className={styles.sidebarLinkIcon} />} to="/index.html" />

                        <SidebarItem title="Notifications" icon={<IconBell className={styles.sidebarLinkIcon} />} to="/notification-settings.html" />

                        <li>
                            <span className={`${styles.sidebarDivider} ${styles.lg}`}></span>
                        </li>

                        {/* Next Section Title */}
                        <li className={styles.navSmallCap}>
                            <IconDots className={`${styles.navSmallCapIcon}`} />
                            <span className={styles.hideMenu}>Subscription</span>
                        </li>

                        {/* Subscription Module */}
                        <SidebarItem title="Subscription management" icon={<IconDiscountCheck className={styles.sidebarLinkIcon} />} to="/subscription.html" />

                        <SidebarItem title="User management" icon={<IconSubtask className={styles.sidebarLinkIcon} />} to="/manage-email-lists.html" />

                        {/* Premium Features with Submenu */}
                        <SidebarItem
                            title="Premium Features"
                            icon={<IconStar className={styles.sidebarLinkIcon} />}
                            links={[
                                { title: "Upload Resources", href: "/upload-resources.html" },
                                { title: "Request Studies", href: "/request-studies.html" }
                            ]}
                        />

                        <li>
                            <span className={`${styles.sidebarDivider} ${styles.lg}`}></span>
                        </li>

                        {/* Reports Section */}
                        <li className={styles.navSmallCap}>
                            <IconDots className={`${styles.navSmallCapIcon}`} />
                            <span className={styles.hideMenu}>Reports</span>
                        </li>

                        <SidebarItem title="Report Management" icon={<IconFileInvoice className={styles.sidebarLinkIcon} />} to="/view-manage-reports.html" />

                        <SidebarItem title="Distribution Lists" icon={<IconChecklist className={styles.sidebarLinkIcon} />} to="/details-settings.html" />

                        <li>
                            <span className={`${styles.sidebarDivider} ${styles.lg}`}></span>
                        </li>

                        {/* Help Center */}
                        <li className={styles.navSmallCap}>
                            <IconDots className={`${styles.navSmallCapIcon}`} />
                        </li>

                        <SidebarItem title="Help Center" icon={<IconHeadset className={styles.sidebarLinkIcon} />} to="/financial-assitant" />
                    </ul>
                </nav>
                {/* End Sidebar navigation */}
            </div>
            {/* End Sidebar scroll */}
        </aside>
    );
};

export default Sidebar;
