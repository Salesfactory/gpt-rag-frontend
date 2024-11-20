// Sidebar.tsx
import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    IconX,
    IconMessagePlus,
    IconBell,
    IconRosetteDiscountCheck,
    IconStar,
    IconFileInvoice,
    IconAddressBook,
    IconUserCheck,
    IconUsers,
    IconChecklist,
    IconHeadset,
    IconDots,
    IconSubtask
} from "@tabler/icons-react";
import salesLogo from "../../img/logo.png";
import styles from "./Sidebar.module.css";
import SidebarItem from "./SidebarItem";
import { useAppContext } from "../../providers/AppProviders";
import { SidebarSection } from "./SidebarSectionTypes";
import { SidebarItem as SidebarItemType, Role, SubscriptionTier } from "./SidebarItemTypes";
interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
    const [activeItem, setActiveItem] = useState<string | null>(null);
    const handleItemClick = (itemTitle: string) => {
        setActiveItem(itemTitle);
    };

    const handleOnClickCloseSideBar = () => {
        setIsCollapsed(true);
    };

    const {
        subscriptionTiers: userSubscriptionTiers,
        user
        // ... other context values if needed
    } = useAppContext();

    /**
     * Determines if the current user has access to a sidebar item or link based on roles and subscription tiers.
     * @param itemRoles - Array of roles that have access to the item/link.
     * @param itemTiers - Array of subscription tiers that have access to the item/link.
     * @returns Boolean indicating access permission.
     */
    const hasAccess = useCallback(
        (itemRoles: Role[], itemTiers: SubscriptionTier[]): boolean => {
            if (!user || !user.role) return false;

            const roleMatch = itemRoles.includes(user.role);
            const tierMatch = itemTiers.some(tier => userSubscriptionTiers.includes(tier));

            return roleMatch && tierMatch;
        },
        [user, userSubscriptionTiers]
    );

    // Define your sidebar sections and items, including roles and tiers for links
    const sidebarSections: SidebarSection[] = [
        {
            section: "Agent",
            items: [
                {
                    title: "AI Chat",
                    icon: <IconMessagePlus className={styles.sidebarLinkIcon} />,
                    to: "/chat",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user"]
                },
                {
                    title: "Notifications",
                    icon: <IconBell className={styles.sidebarLinkIcon} />,
                    to: "/notification-settings",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user"]
                }
            ]
        },
        {
            divider: true
        },
        {
            section: "Admin Features",
            items: [
                {
                    title: "Roles and Access",
                    icon: <IconUsers className={styles.sidebarLinkIcon} />,
                    to: "/admin",
                    tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin"]
                },
                {
                    title: "Invitations",
                    icon: <IconUserCheck className={styles.sidebarLinkIcon} />,
                    to: "/invitations",
                    tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin"]
                },
                {
                    title: "Organization Management",
                    icon: <IconAddressBook className={styles.sidebarLinkIcon} />,
                    to: "/organization",
                    tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin"]
                }
            ]
        },
        {
            divider: true
        },
        {
            section: "Subscription",
            items: [
                {
                    title: "Subscription Management",
                    icon: <IconRosetteDiscountCheck className={styles.sidebarLinkIcon} />,
                    to: "/subscription",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin"]
                },
                {
                    title: "User Management",
                    icon: <IconSubtask className={styles.sidebarLinkIcon} />,
                    to: "/manage-email-lists",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin"]
                }
            ]
        },
        {
            section: "Premium Features",
            items: [
                {
                    title: "Premium Features",
                    icon: <IconStar className={styles.sidebarLinkIcon} />,
                    links: [
                        {
                            title: "Upload Resources",
                            href: "/upload-resources",
                            roles: ["admin", "user"],
                            tiers: ["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"]
                        },
                        {
                            title: "Request Studies",
                            href: "/request-studies",
                            roles: ["admin", "user"],
                            tiers: ["Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"]
                        }
                    ],
                    tiers: ["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user"]
                }
            ]
        },
        {
            divider: true
        },
        {
            section: "Reports",
            items: [
                {
                    title: "Report Management",
                    icon: <IconFileInvoice className={styles.sidebarLinkIcon} />,
                    to: "/view-manage-reports",
                    tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user"]
                },
                {
                    title: "Distribution Lists",
                    icon: <IconChecklist className={styles.sidebarLinkIcon} />,
                    to: "/details-settings",
                    tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user"]
                }
            ]
        },
        {
            divider: true
        },
        {
            section: "Help Center",
            items: [
                {
                    title: "Help Center",
                    icon: <IconHeadset className={styles.sidebarLinkIcon} />,
                    to: "/financial-assistant",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user"]
                }
            ]
        }
    ];

    // Filtered sidebar sections based on access
    const accessibleSidebarSections = useMemo(() => {
        return sidebarSections
            .map(section => {
                if (section.divider) {
                    return section; // Always include dividers
                }

                if (section.items) {
                    // Filter items based on access
                    const accessibleItems = section.items
                        .map(item => {
                            if (item.links) {
                                // Filter links based on access
                                const accessibleLinks = item.links.filter(link => hasAccess(link.roles, link.tiers));

                                if (accessibleLinks.length > 0) {
                                    return { ...item, links: accessibleLinks };
                                } else {
                                    return null; // Exclude item if no accessible links
                                }
                            } else {
                                // No links, just check access on the item itself
                                return hasAccess(item.roles, item.tiers) ? item : null;
                            }
                        })
                        .filter(item => item !== null) as SidebarItemType[];

                    if (accessibleItems.length > 0) {
                        return { ...section, items: accessibleItems };
                    }
                }

                // Exclude sections with no accessible items
                return null;
            })
            .filter(section => section !== null) as SidebarSection[];
    }, [sidebarSections, hasAccess]);

    return (
        <aside className={`${!isCollapsed ? styles.showSidebar : ""} ${styles.leftSidebar}`}>
            {/* Sidebar scroll */}
            <div>
                <div className={`d-flex align-items-center justify-content-between ${styles.brandLogo}`}>
                    <Link to="/">
                        <img src={salesLogo} alt="Sales Factory logo" className={styles.brandLogoImg} />
                    </Link>
                    <button
                        onClick={handleOnClickCloseSideBar}
                        className={`d-xl-none d-block ${styles.closeBtn} ${styles.sidebarToggler} ${styles.cursorPointer}`}
                        id="sidebarCollapse"
                        aria-label="Close Sidebar"
                    >
                        <IconX className={styles.icon} />
                    </button>
                </div>

                {/* Sidebar navigation */}
                <nav className={`${styles.nav} ${styles.scrollSidebar}`}>
                    <ul className={styles.navUl}>
                        {accessibleSidebarSections.map((section, index) => {
                            if (section.divider) {
                                return (
                                    <li key={`divider-${index}`}>
                                        <span className={`${styles.sidebarDivider} ${styles.lg}`}></span>
                                    </li>
                                );
                            }

                            return (
                                <React.Fragment key={`section-${section.section}-${index}`}>
                                    {/* Section Title */}
                                    {section.section && (
                                        <li className={styles.navSmallCap}>
                                            <IconDots className={`${styles.navSmallCapIcon}`} />
                                            <span className={styles.hideMenu}>{section.section}</span>
                                        </li>
                                    )}

                                    {/* Sidebar Items */}
                                    {section.items &&
                                        section.items.map(item => {
                                            return (
                                                <SidebarItem
                                                    key={item.title} // Preferably use a unique id
                                                    title={item.title}
                                                    icon={item.icon}
                                                    to={item.to}
                                                    links={item.links}
                                                    isActive={activeItem=== item.title}
                                                    onClick={()=>handleItemClick(item.title)}
                                                />
                                            );
                                        })}
                                </React.Fragment>
                            );
                        })}
                    </ul>
                </nav>
                {/* End Sidebar navigation */}
            </div>
            {/* End Sidebar scroll */}
        </aside>
    );
};

export default Sidebar;
