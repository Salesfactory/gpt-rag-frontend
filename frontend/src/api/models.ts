export type UserInfo = {
    access_token: string;
    expires_on: string;
    id_token: string;
    provider_name: string;
    user_claims: any[];
    user_id: string;
};

export type OrganizationUsage = {
    id: string;
    organizationId: string;
    subscriptionTierId: string;
    isSubscriptionActive: boolean;
    balance:{
        totalAllocated: number;
        currentUsed: number;
    }
    policy:{
        tierId: string;
        currentSeats: number;
        allowedUserIds: string[];
    }
}
export interface SubscriptionTier {
    id: string;
    tierId: string;
    tierName: string;
    cost: number;
    quotas: {
        totalCreditsAllocated: number;
        totalStorageAllocated: number;
    }
    policy: {
        allowOverdraft: boolean;
        maxSeats: number;
    }
}
export interface PartialUserInfo {
    id: string;
    name: string;
    email: string | null;
    role?: Role;
    organizationId?: string;
    isReportEmailReceiver?: boolean;
}

export interface OrganizationInfo {
    id: string;
    name: string;
    owner: string;
    subscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionExpirationDate?: number;
    brandInformation?: string;
    additionalInstructions?: string;
    segmentSynonyms?: string;
    industryInformation?: string;
}

export const enum Approaches {
    RetrieveThenRead = "rtr",
    ReadRetrieveRead = "rrr",
    ReadDecomposeAsk = "rda"
}

export type ConversationHistoryItem = {
    id: string;
    start_date: string;
    content: string;
    type: string;
    organization_id: string;
};

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


export type ConversationChatItem = {
    role: string;
    content: string;
};

export type ThoughtProcess = string | string[] | Record<string, unknown> | null;

export type AskRequestOverrides = {
    semanticRanker?: boolean;
    semanticCaptions?: boolean;
    excludeCategory?: string;
    top?: number;
    temperature?: number;
    promptTemplate?: string;
    promptTemplatePrefix?: string;
    promptTemplateSuffix?: string;
    suggestFollowupQuestions?: boolean;
};

export type AskRequest = {
    question: string;
    approach: Approaches;
    overrides?: AskRequestOverrides;
};

export type AskResponse = {
    answer: string;
    thoughts: ThoughtProcess;
    data_points: string[];
    error?: string;
};

export type TransactionData = {
    cuenta_origen: string;
    monto: string;
    telefono_destino: string;
};

export type AskResponseGpt = {
    conversation_id: string;
    answer: string;
    current_state: string;
    thoughts: ThoughtProcess;
    data_points: string[];
    transaction_data?: TransactionData;
    error?: string;
};

export type ChatTurn = {
    user: string;
    bot?: {
        message: string;
        thoughts: ThoughtProcess;
    } | null;
};

export type ChatRequest = {
    history: ChatTurn[];
    approach: Approaches;
    overrides?: AskRequestOverrides;
};

export type ChatRequestGpt = {
    history: ChatTurn[];
    approach: Approaches;
    conversation_id: string;
    query: string;
    overrides?: AskRequestOverrides;
    agent: string;
};

export type GetSettingsProps = {
    user: {
        id: string;
        name: string;
    } | null;
};

export type DetailLevel = "brief" | "balanced" | "detailed";

export type PostSettingsProps = {
    user: {
        id: string;
        name: string;
    } | null;
    temperature: number;
    model: string;
    font_family: string;
    font_size: string;
    detail_level?: DetailLevel;
};

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}


// ---- Report Jobs (status) ----
export type BackendReportStatus = "SUCCEEDED" | "RUNNING" | "QUEUED" | "FAILED";

export interface BackendReportJobDoc {
  id: string;
  report_key?: string;
  report_name?: string;
  status?: BackendReportStatus | string;
  progress?: number;
  created_at?: string | null;
  updated_at?: string | null;
  params?: { target?: string };
}
