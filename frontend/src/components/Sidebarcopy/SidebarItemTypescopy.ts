// SidebarItemTypes.ts
import { SubscriptionTier } from "../../api/models";
export type Role = "platformAdmin"|"admin" | "user";

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
