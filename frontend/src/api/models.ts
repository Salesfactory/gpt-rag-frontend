export type UserInfo = {
    access_token: string;
    expires_on: string;
    id_token: string;
    provider_name: string;
    user_claims: any[];
    user_id: string;
};

export const enum Approaches {
    RetrieveThenRead = "rtr",
    ReadRetrieveRead = "rrr",
    ReadDecomposeAsk = "rda"
}

export type ConversationHistoryItem = {
    id: string;
    start_date: string;
    content: string;
};

export type ConversationChatItem = {
    role: string;
    content: string;
};

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
    thoughts: string | null;
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
    thoughts: string | null;
    data_points: string[];
    transaction_data?: TransactionData;
    error?: string;
};

export type ChatTurn = {
    user: string;
    bot?: {
        message: string;
        thoughts: any;
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
    file_blob_url: string;
    overrides?: AskRequestOverrides;
    documentName: string;
};

export type GetSettingsProps = {
    user: {
        id: string;
        name: string;
    } | null;
};

export type PostSettingsProps = {
    user: {
        id: string;
        name: string;
    } | null;
    temperature: number;
};
