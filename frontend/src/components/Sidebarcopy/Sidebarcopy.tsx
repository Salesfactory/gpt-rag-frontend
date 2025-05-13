// Sidebar.tsx
import React, { useCallback, useMemo, useState } from "react";
import { BadgeCheck, Bell, MessageSquare, SlidersHorizontal, Headphones, Star, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { IconX, IconDots } from "@tabler/icons-react";
import salesLogo from "../../img/logo_white.png";
import styles from "./Sidebarcopy.module.css";
import SidebarItem from "./SidebarItemcopy";
import { useAppContext } from "../../providers/AppProviders";
import { SidebarSection } from "./SidebarSectionTypescopy";
import { SidebarItem as SidebarItemType, Role, SubscriptionTier } from "./SidebarItemTypescopy";
interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
    const [activeItem, setActiveItem] = useState<string | null>(null);
    const handleItemClick = (itemTitle: string) => {
        setActiveItem(itemTitle);
        setIsCollapsed(true);
    };

    const handleOnClickCloseSideBar = () => {
        setIsCollapsed(true);
    };
    const handleSetActiveItem = (title: string) => {
        setActiveItem(prev => (prev === title ? null : title));
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
    // Then change the route
    const sidebarSections: SidebarSection[] = [
        {
            section: "Agent",
            items: [
                {
                    title: "AI Chat",
                    icon: <MessageSquare className={styles.sidebarLinkIcon} />,
                    to: "/secondary-chat",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user", "platformAdmin"]
                },
                {
                    title: "Notifications",
                    icon: <Bell className={styles.sidebarLinkIcon} />,
                    to: "/notification-settings",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user", "platformAdmin"]
                }
            ]
        },
        {
            divider: true
        },
        {
            items: [
                {
                    title: "Control Center",
                    icon: <SlidersHorizontal className={styles.sidebarLinkIcon} />,
                    links: [
                        {
                            title: "Team Management",
                            href: "/admin",
                            tiers: [
                                "Basic",
                                "Custom",
                                "Premium",
                                "Basic + Financial Assistant",
                                "Custom + Financial Assistant",
                                "Premium + Financial Assistant"
                            ],
                            roles: ["admin", "platformAdmin"]
                        },
                        {
                            title: "Workspace Governance",
                            href: "/organization",
                            tiers: [
                                "Basic",
                                "Custom",
                                "Premium",
                                "Basic + Financial Assistant",
                                "Custom + Financial Assistant",
                                "Premium + Financial Assistant"
                            ],
                            roles: ["admin", "platformAdmin"]
                        },
                        {
                            title: "Subscription Plans",
                            href: "/subscription-management",
                            tiers: [
                                "Basic",
                                "Custom",
                                "Premium",
                                "Basic + Financial Assistant",
                                "Custom + Financial Assistant",
                                "Premium + Financial Assistant"
                            ],
                            roles: ["admin", "platformAdmin"]
                        }
                    ],
                    tiers: ["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user", "platformAdmin"]
                }
            ]
        },
        {
            items: [
                {
                    title: "Premium Features",
                    icon: <Star className={styles.sidebarLinkIcon} />,
                    links: [
                        {
                            title: "Upload Resources",
                            href: "/upload-resources",
                            roles: ["admin", "user", "platformAdmin"],
                            tiers: ["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"]
                        },
                        {
                            title: "Request Studies",
                            href: "/request-studies",
                            roles: ["admin", "user", "platformAdmin"],
                            tiers: ["Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"]
                        }
                    ],
                    tiers: ["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user", "platformAdmin"]
                }
            ]
        },
        {
            //It is only visible to platform administrators
            items: [
                {
                    title: "Reports",
                    icon: <FileText className={styles.sidebarLinkIcon} />,
                    links: [
                        {
                            title: "Reports Dashboard",
                            href: "/view-reports",
                            tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                            roles: ["admin", "platformAdmin"]
                        },
                        {
                            title: "Report Creation",
                            href: "/view-manage-reports",
                            tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                            roles: ["admin", "platformAdmin"]
                        },
                        {
                            title: "Sharing & Distribution",
                            href: "/details-settings",
                            tiers: ["Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                            roles: ["admin", "platformAdmin"]
                        }
                    ],
                    tiers: ["Custom", "Premium", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user", "platformAdmin"]
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
                    icon: <Headphones className={styles.sidebarLinkIcon} />,
                    to: "/help-center",
                    tiers: ["Basic", "Custom", "Premium", "Basic + Financial Assistant", "Custom + Financial Assistant", "Premium + Financial Assistant"],
                    roles: ["admin", "user", "platformAdmin"]
                }
            ]
        }
    ];

    const accessibleSidebarSections = useMemo(() => {
        let previousSectionHasItems = false;

        return sidebarSections
            .map((section, index) => {
                if (section.divider) {
                    return previousSectionHasItems ? section : null;
                }

                if (section.items) {
                    const accessibleItems = section.items
                        .map(item => {
                            if (item.links) {
                                const accessibleLinks = item.links.filter(link => hasAccess(link.roles, link.tiers));

                                if (accessibleLinks.length > 0) {
                                    return { ...item, links: accessibleLinks };
                                } else {
                                    return null;
                                }
                            } else {
                                return hasAccess(item.roles, item.tiers) ? item : null;
                            }
                        })
                        .filter(item => item !== null) as SidebarItemType[];

                    previousSectionHasItems = accessibleItems.length > 0;

                    if (accessibleItems.length > 0) {
                        return { ...section, items: accessibleItems };
                    }
                }

                previousSectionHasItems = false;
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
                                                    isActive={activeItem === item.title}
                                                    setIsActive={() => handleSetActiveItem(item.title)}
                                                    onClick={() => handleItemClick(item.title)}
                                                />
                                            );
                                        })}
                                </React.Fragment>
                            );
                        })}
                    </ul>
                </nav>
            </div>
        </aside>
    );
};

export default Sidebar;
