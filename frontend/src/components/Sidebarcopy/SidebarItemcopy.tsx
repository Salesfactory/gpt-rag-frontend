import React from "react";
import { Link } from "react-router-dom";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import styles from "./Sidebarcopy.module.css";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SidebarItemProps {
    title: string;
    icon: JSX.Element;
    to?: string;
    links?: Array<{ title: string; href: string }>;
    onClick: () => void;
    isActive: boolean;
    setIsActive: any;
    activeSubItem?: string | null;
    setActiveSubItem?: (href: string) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ title, icon, to, links, onClick, isActive, setIsActive, activeSubItem, setActiveSubItem }) => {
    const toggleSubmenu = (e: React.MouseEvent) => {
        if (links) {
            e.preventDefault();
        }
        setIsActive(isActive);
    };

    const handleSubItemClick = (href: string) => {
        if (setActiveSubItem) {
            setActiveSubItem(href);
        }
        onClick();
    };

    return (
        <li className={styles.navLi}>
            {links ? (
                <>
                    <div
                        className={`${styles.sidebarLink} ${styles.navLink} ${isActive ? styles.sidebarLinkActive : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isActive}
                        onClick={toggleSubmenu}
                        id="submenubutton"
                    >
                        {React.cloneElement(icon, {
                            className: isActive ? styles.sidebarLinkActiveIcon : styles.sidebarLinkIcon
                        })}
                        <span className={isActive ? styles.textActive : ""}>{title}</span>
                        <span className={`${styles.submenuArrow} ${isActive ? styles.submenuArrowActive : ""}`}>
                            {isActive ? <ChevronRight /> : <ChevronRight />}
                        </span>
                    </div>
                    <ul
                        className={`${styles.submenu} ${styles.navUl} ${isActive ? styles.submenuActive : ""}`}
                        style={{ maxHeight: isActive ? `${links.length * 60}px` : "0" }}
                    >
                        {links.map((linkItem, index) => (
                            <li key={index} className={`${styles.submenuItem} ${activeSubItem === linkItem.href ? styles.sidebarLinkActive : ""}`}>
                                <Link className={`${styles.submenuLink}`} to={linkItem.href} onClick={() => handleSubItemClick(linkItem.href)}>
                                    {linkItem.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <Link className={`${styles.sidebarLink} ${styles.navLink} ${isActive ? styles.sidebarLinkActive : ""}`} to={to || "#"} onClick={onClick}>
                    {React.cloneElement(icon, {
                        className: isActive ? styles.sidebarLinkActiveIcon : styles.sidebarLinkIcon
                    })}
                    <span className={isActive ? styles.textActive : ""}>{title}</span>
                </Link>
            )}
        </li>
    );
};

export default SidebarItem;
