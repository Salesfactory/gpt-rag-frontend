// SidebarItemTypes.ts

export type Role = "admin" | "user";

export type SubscriptionTier =
    | "Basic"
    | "Custom"
    | "Premium"
    | "Basic + Financial Assistant"
    | "Custom + Financial Assistant"
    | "Premium + Financial Assistant";

export interface SidebarLink {
    title: string;
    href: string;
    tiers: SubscriptionTier[];
    roles: Role[];
}

export interface BaseSidebarItem {
    title: string;
    icon: JSX.Element;
    tiers: SubscriptionTier[];
    roles: Role[];
}

export interface LinkSidebarItem extends BaseSidebarItem {
    to: string;
    links?: never; // Ensures that 'links' is not present
}

export interface SubmenuSidebarItem extends BaseSidebarItem {
    to?: never; // Ensures that 'to' is not present
    links: SidebarLink[];
}

export type SidebarItem = LinkSidebarItem | SubmenuSidebarItem;
