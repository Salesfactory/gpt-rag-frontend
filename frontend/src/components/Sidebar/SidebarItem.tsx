// SidebarItem.tsx
import React from "react";
import { Link } from "react-router-dom";
import { IconChevronDown } from "@tabler/icons-react";
import styles from "./Sidebar.module.css";

interface SidebarItemProps {
    title: string;
    icon: JSX.Element;
    to?: string;
    links?: Array<{ title: string; href: string }>;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ title, icon, to = "#", links }) => {
    const [isActive, setIsActive] = React.useState(false);

    const toggleSubmenu = (e: React.MouseEvent) => {
        if (links) {
            e.preventDefault();
            setIsActive(!isActive);
        }
    };

    return (
        <li className={styles.navLi}>
            <Link
                className={`${styles.sidebarLink} ${styles.navLink} ${isActive && !links ? styles.sidebarLinkActive : ""}`}
                to={to}
                aria-expanded={isActive}
                onClick={toggleSubmenu}
            >
                {React.cloneElement(icon, { className: styles.sidebarLinkIcon })}
                <span className={styles.hideMenu}>{title}</span>
                {links && (
                    <span className={`${styles.submenuArrow} ${isActive ? styles.submenuArrowActive : ""}`}>
                        <IconChevronDown />
                    </span>
                )}
            </Link>
            {links && (
                <ul
                    className={`${styles.submenu} ${styles.navUl} ${isActive ? styles.submenuActive : ""}`}
                    style={{ maxHeight: isActive ? `${links.length * 40}px` : "0" }}
                >
                    {links.map((linkItem, index) => (
                        <li key={index} className={`${styles.submenuItem} `}>
                            <Link className={styles.submenuLink} to={linkItem.href}>
                                {linkItem.title}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
};

export default SidebarItem;