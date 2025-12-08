import { SidebarItem } from "../../api/models";

export interface SidebarSection {
    section?: string; // Optional, present for section titles
    divider?: boolean; // Optional, present for dividers
    items?: SidebarItem[]; // Optional, present for items within a section
}
