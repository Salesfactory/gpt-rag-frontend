// AppProvider.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, Dispatch, SetStateAction } from "react";
import { Spinner } from "@fluentui/react";
import { checkUser, getOrganizationSubscription } from "../api";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";

// Updated Role and SubscriptionTier types
type Role = "admin" | "user";

type SubscriptionTier = "Basic" | "Custom" | "Premium" | "Basic + Financial Assistant" | "Custom + Financial Assistant" | "Premium + Financial Assistant";

// Updated UserInfo interface
interface UserInfo {
    id: string;
    name: string;
    email: string | null;
    role?: Role;
    organizationId?: string;
}

interface OrganizationInfo {
    id: string;
    name: string;
    owner: string;
    subscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionExpirationDate?: number;
    subscriptionTier?: SubscriptionTier;
}

// ConversationHistoryItem and ChatTurn remain unchanged
export interface ConversationHistoryItem {
    id: string;
    start_date: string;
    content: string;
    // Add other properties as needed
}

export interface ChatTurn {
    user: string;
    bot?: {
        message: string;
        thoughts: any;
    } | null;
    // Add other properties as needed
}

// Define the shape of the context
interface AppContextType {
    showHistoryPanel: boolean;
    setShowHistoryPanel: Dispatch<SetStateAction<boolean>>;
    showFeedbackRatingPanel: boolean;
    setShowFeedbackRatingPanel: Dispatch<SetStateAction<boolean>>;
    settingsPanel: boolean;
    setSettingsPanel: Dispatch<SetStateAction<boolean>>;
    refreshFetchHistory: boolean;
    setRefreshFetchHistory: Dispatch<SetStateAction<boolean>>;
    chatIsCleaned: boolean;
    setChatIsCleaned: Dispatch<SetStateAction<boolean>>;
    dataHistory: ConversationHistoryItem[];
    setDataHistory: Dispatch<SetStateAction<ConversationHistoryItem[]>>;
    user: UserInfo | null;
    setUser: Dispatch<SetStateAction<UserInfo | null>>;
    organization: OrganizationInfo | null;
    setOrganization: Dispatch<SetStateAction<OrganizationInfo | null>>;
    chatSelected: string;
    setChatSelected: Dispatch<SetStateAction<string>>;
    chatId: string;
    setChatId: Dispatch<SetStateAction<string>>;
    dataConversation: ChatTurn[];
    setDataConversation: Dispatch<SetStateAction<ChatTurn[]>>;
    conversationIsLoading: boolean;
    setConversationIsLoading: Dispatch<SetStateAction<boolean>>;
    newChatDeleted: boolean;
    setNewChatDeleted: Dispatch<SetStateAction<boolean>>;
    isAuthenticated: boolean;
    isLoading: boolean;
    subscriptionTiers: SubscriptionTier[]; // New state variable
    setSubscriptionTiers: Dispatch<SetStateAction<SubscriptionTier[]>>; // Setter for subscriptionTiers
    isFinancialAssistantActive: boolean;
    setIsFinancialAssistantActive: Dispatch<SetStateAction<boolean>>;
    documentName: string;
    agentType: string;
}

// Create the context with a default value
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Create the provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Existing state variables
    const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(true);
    const [showFeedbackRatingPanel, setShowFeedbackRatingPanel] = useState<boolean>(false);
    const [settingsPanel, setSettingsPanel] = useState<boolean>(false);
    const [refreshFetchHistory, setRefreshFetchHistory] = useState<boolean>(false);
    const [chatIsCleaned, setChatIsCleaned] = useState<boolean>(false);
    const [dataHistory, setDataHistory] = useState<ConversationHistoryItem[]>([]);
    const [dataConversation, setDataConversation] = useState<ChatTurn[]>([]);
    const [chatSelected, setChatSelected] = useState<string>("");
    const [chatId, setChatId] = useState<string>("");
    const [conversationIsLoading, setConversationIsLoading] = useState<boolean>(false);
    const [newChatDeleted, setNewChatDeleted] = useState<boolean>(false);
    const [user, setUser] = useState<UserInfo | null>(null);
    const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isFinancialAssistantActive, setIsFinancialAssistantActive] = useState(false);

    // New state variables for subscription tiers
    const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);

    // Variables for the Financial Agent URL
    const location = useLocation();
    const [documentName, setDocumentName] = useState<string>("defaultDocument");
    const [agentType, setAgentType] = useState<string>("defaultAgent");

    // Handle keyboard shortcuts (unchanged)
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            const isCtrlOrCmd = event.ctrlKey || event.metaKey;
            const isAlt = event.altKey;

            if (isCtrlOrCmd && isAlt) {
                switch (event.code) {
                    case "Digit8":
                        event.preventDefault();
                        setShowFeedbackRatingPanel(prev => !prev);
                        setSettingsPanel(false);
                        setShowHistoryPanel(false);
                        break;
                    case "Period":
                        event.preventDefault();
                        setShowHistoryPanel(prev => !prev);
                        setShowFeedbackRatingPanel(false);
                        setSettingsPanel(false);
                        break;
                    case "Comma":
                        event.preventDefault();
                        setSettingsPanel(prev => !prev);
                        setShowHistoryPanel(false);
                        setShowFeedbackRatingPanel(false);
                        break;
                    case "Digit0":
                        event.preventDefault();
                        window.location.href = "/logout";
                        break;
                    case "Digit9":
                        event.preventDefault();
                        window.location.href = "#/admin";
                        break;
                    case "Digit7":
                        event.preventDefault();
                        window.location.href = "#/payment";
                        break;
                    default:
                        break;
                }
            }
        },
        [setShowFeedbackRatingPanel, setSettingsPanel, setShowHistoryPanel]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const documentParam = searchParams.get("document");
        const agentParam = searchParams.get("agent");
    
        setDocumentName(documentParam || "defaultDocument");
        setAgentType(agentParam || "defaultAgent");
        
    }, [location.search]);

    useEffect(() => {
        const fetchUserAuth = async (invitationToken?: string | null) => {
            let url = "/api/auth/user";
            if (invitationToken) {
                const params = new URLSearchParams({ invitation: invitationToken });
                url += `?${params.toString()}`;
            }

            const response = await fetch(url, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return response.json();
        };

        const fetchOrganizationDetails = async (userId: string, organizationId: string) => {
            try {
                const organization = await getOrganizationSubscription({
                    userId,
                    organizationId
                });

                if (organization) {
                    setOrganization({
                        id: organization.id,
                        name: organization.name,
                        owner: organization.owner,
                        subscriptionId: organization.subscriptionId,
                        subscriptionTier: organization.subscriptionTier as SubscriptionTier // Type assertion
                    });

                    if (organization.subscriptionId) {
                        await fetchSubscriptionTiers(organization.subscriptionId, userId);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch organization details:", error);
                toast.error("Failed to fetch organization details.");
                throw error;
            }
        };

        const fetchSubscriptionTiers = async (subscriptionId: string, userId: string) => {
            try {
                const response = await fetch(`/api/subscriptions/${subscriptionId}/tiers`, {
                    method: "GET",
                    headers: {
                        "X-MS-CLIENT-PRINCIPAL-ID": userId || "", // Ensure user is set
                        "Content-Type": "application/json"
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to fetch subscription tiers");
                }

                const data = await response.json();
                setSubscriptionTiers(data.subscriptionTiers as SubscriptionTier[]);
                // Optionally, update organization.subscriptionTier if needed
            } catch (error: any) {
                console.error("Failed to fetch subscription tiers:", error);
                toast.error(error.message || "Failed to fetch subscription tiers.");
                // Handle error appropriately, e.g., show notification
            }
        };

        const initialize = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const invitationToken = urlParams.get("invitation");

                const authData = await fetchUserAuth(invitationToken);

                if (authData.authenticated) {
                    setUser(authData.user);
                    setIsAuthenticated(true);

                    if (authData.user.id && authData.user.organizationId) {
                        await fetchOrganizationDetails(authData.user.id, authData.user.organizationId);
                    }
                }
                const savedState = localStorage.getItem(`financialAssistantActive_${user?.id}`);
                if (savedState !== null) {
                    setIsFinancialAssistantActive(JSON.parse(savedState));
                }
            } catch (error) {
                console.error("Initialization failed:", error);
                toast.error("Failed to initialize user authentication.");
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, [user?.id]);

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo(
        () => ({
            showHistoryPanel,
            setShowHistoryPanel,
            showFeedbackRatingPanel,
            setShowFeedbackRatingPanel,
            settingsPanel,
            setSettingsPanel,
            refreshFetchHistory,
            setRefreshFetchHistory,
            chatIsCleaned,
            setChatIsCleaned,
            dataHistory,
            setDataHistory,
            user,
            setUser,
            organization,
            setOrganization,
            chatSelected,
            setChatSelected,
            chatId,
            setChatId,
            dataConversation,
            setDataConversation,
            conversationIsLoading,
            setConversationIsLoading,
            newChatDeleted,
            setNewChatDeleted,
            isAuthenticated,
            isLoading,
            subscriptionTiers, // New state variable
            setSubscriptionTiers, // Setter for subscriptionTiers
            isFinancialAssistantActive,
            setIsFinancialAssistantActive,
            documentName,
            setDocumentName,
            agentType,
            setAgentType
        }),
        [
            showHistoryPanel,
            showFeedbackRatingPanel,
            settingsPanel,
            refreshFetchHistory,
            chatIsCleaned,
            dataHistory,
            user,
            organization,
            chatSelected,
            chatId,
            dataConversation,
            conversationIsLoading,
            newChatDeleted,
            isAuthenticated,
            isLoading,
            subscriptionTiers,
            isFinancialAssistantActive,
            documentName,
            agentType
        ]
    );

    // Render loading spinner if data is still loading
    if (isLoading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    width: "100vw"
                }}
            >
                <Spinner size={3} />
            </div>
        );
    }

    // Provide the context to child components
    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

// Custom hook for consuming the context
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
};
