// AppProvider.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, Dispatch, SetStateAction } from "react";
import { Spinner } from "@fluentui/react";
import { checkUser, getOrganizationSubscription } from "../api";
import { toast } from "react-toastify";

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
    isReportEmailReceiver?: boolean;
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
    type: string;
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
    setDocumentName: Dispatch<SetStateAction<string>>;
    agentType: string;
    setAgentType: Dispatch<SetStateAction<string>>;
    // New loading states
    isOrganizationLoading: boolean;
    isSubscriptionTiersLoading: boolean;
    isChatHistoryLoading: boolean;
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

    // New loading states
    const [isOrganizationLoading, setIsOrganizationLoading] = useState<boolean>(false);
    const [isSubscriptionTiersLoading, setIsSubscriptionTiersLoading] = useState<boolean>(false);
    const [isChatHistoryLoading, setIsChatHistoryLoading] = useState<boolean>(false);

    // Setting variables for the Financial Agent URL
    const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
    const params = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

    const agentParam = params["agent"];
    const documentParam = params["document"];

    const [documentName, setDocumentName] = useState<string>(documentParam || "defaultDocument");
    const [agentType, setAgentType] = useState<string>(agentParam || "defaultAgent");

    // Move agentType update into useEffect to prevent state updates on every render
    useEffect(() => {
        if (agentParam && agentType !== agentParam) {
            console.log(`Updating agentType from "${agentType}" to "${agentParam}"`);
            setAgentType(agentParam);
        }
    }, [agentParam, agentType]);

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
                        console.log("Toggle Feedback Rating Panel");
                        break;
                    case "Period":
                        event.preventDefault();
                        setShowHistoryPanel(prev => !prev);
                        setShowFeedbackRatingPanel(false);
                        setSettingsPanel(false);
                        console.log("Toggle History Panel");
                        break;
                    case "Comma":
                        event.preventDefault();
                        setSettingsPanel(prev => !prev);
                        setShowHistoryPanel(false);
                        setShowFeedbackRatingPanel(false);
                        console.log("Toggle Settings Panel");
                        break;
                    case "Digit0":
                        event.preventDefault();
                        window.location.href = "/logout";
                        console.log("Redirecting to /logout");
                        break;
                    case "Digit9":
                        event.preventDefault();
                        window.location.href = "#/admin";
                        console.log("Redirecting to /admin");
                        break;
                    case "Digit7":
                        event.preventDefault();
                        window.location.href = "#/payment";
                        console.log("Redirecting to /payment");
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
        console.log("Keyboard event listener added.");
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            console.log("Keyboard event listener removed.");
        };
    }, [handleKeyDown]);

    // Effect to fetch user authentication on component mount
    useEffect(() => {
        const fetchUserAuth = async (invitationToken?: string | null) => {
            let url = "/api/auth/user";
            if (invitationToken) {
                const params = new URLSearchParams({ invitation: invitationToken });
                url += `?${params.toString()}`;
            }

            console.log(`Fetching user authentication from URL: ${url}`);

            const response = await fetch(url, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                console.error(`HTTP error while fetching user auth! Status: ${response.status}`);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            console.log("User authentication data fetched:", data);
            return data;
        };

        const initializeAuth = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const invitationToken = urlParams.get("invitation");

                const authData = await fetchUserAuth(invitationToken);

                if (authData.authenticated) {
                    setUser(authData.user);
                    setIsAuthenticated(true);
                    console.log(`User authenticated: ${authData.user.name}`);
                } else {
                    console.log("User not authenticated.");
                }

                // Handle financial assistant activation based on local storage or agentType
                const savedState = localStorage.getItem(`financialAssistantActive_${authData.user?.id}`);
                if (savedState !== null) {
                    setIsFinancialAssistantActive(JSON.parse(savedState));
                    console.log("Financial Assistant activation state loaded from localStorage.");
                }
                if (agentType === "financial") {
                    setIsFinancialAssistantActive(true);
                    console.log("Financial Assistant activated based on agentType.");
                }
            } catch (error) {
                console.error("Initialization failed:", error);
                toast.error("Failed to initialize user authentication.");
            } finally {
                setIsLoading(false);
                console.log("Initialization completed.");
            }
        };

        initializeAuth();
    }, [agentType]); // Dependency only on agentType

    // Effect to fetch organization details when user.id changes
    useEffect(() => {
        if (!user?.id || !user.organizationId) {
            console.log("No user ID or organization ID available. Skipping organization fetch.");
            return;
        }

        const fetchOrganizationDetails = async (userId: string, organizationId: string) => {
            console.log(`Fetching organization details for User ID: ${userId}, Organization ID: ${organizationId}`);
            setIsOrganizationLoading(true);

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
                        subscriptionTier: organization.subscriptionTier as SubscriptionTier, // Type assertion
                        subscriptionExpirationDate: organization.subscriptionExpirationDate,
                        subscriptionStatus: organization.subscriptionStatus
                    });

                    console.log("Organization details fetched:", organization);

                    if (organization.subscriptionId) {
                        await fetchSubscriptionTiers(organization.subscriptionId, userId);
                    }
                } else {
                    console.log("No organization details found.");
                }
            } catch (error) {
                console.error("Failed to fetch organization details:", error);
                toast.error("Failed to fetch organization details.");
                throw error;
            } finally {
                setIsOrganizationLoading(false);
                console.log("Organization fetch completed.");
            }
        };

        const fetchSubscriptionTiers = async (subscriptionId: string, userId: string) => {
            console.log(`Fetching subscription tiers for Subscription ID: ${subscriptionId}`);
            setIsSubscriptionTiersLoading(true);

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
                    console.error(`HTTP error while fetching subscription tiers! Status: ${response.status}`, errorData);
                    throw new Error(errorData.error || "Failed to fetch subscription tiers");
                }

                const data = await response.json();
                setSubscriptionTiers(data.subscriptionTiers as SubscriptionTier[]);
                console.log("Subscription tiers fetched:", data.subscriptionTiers);
            } catch (error: any) {
                console.error("Failed to fetch subscription tiers:", error);
                toast.error(error.message || "Failed to fetch subscription tiers.");
            } finally {
                setIsSubscriptionTiersLoading(false);
                console.log("Subscription tiers fetch completed.");
            }
        };

        fetchOrganizationDetails(user.id, user.organizationId);
    }, [user?.id, user?.organizationId]);

    // Effect to fetch chat history when user.id changes
    useEffect(() => {
        if (!user?.id) {
            console.log("No user ID available. Skipping chat history fetch.");
            return;
        }

        const fetchChatHistory = async () => {
            console.log(`Fetching chat history for User ID: ${user.id}`);
            setIsChatHistoryLoading(true);

            try {
                const response = await fetch("/api/chat-history", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json"
                    }
                });

                if (!response.ok) {
                    console.error(`HTTP error while fetching chat history! Status: ${response.status}`);
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data: ConversationHistoryItem[] = await response.json();
                setDataHistory(data);
                console.log("Chat history fetched:", data);
            } catch (error) {
                console.error("Failed to fetch chat history:", error);
                toast.error("Failed to fetch chat history.");
            } finally {
                setIsChatHistoryLoading(false);
                console.log("Chat history fetch completed.");
            }
        };

        fetchChatHistory();
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
            setAgentType,
            isOrganizationLoading, // New loading state
            isSubscriptionTiersLoading, // New loading state
            isChatHistoryLoading // New loading state
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
            agentType,
            isOrganizationLoading,
            isSubscriptionTiersLoading,
            isChatHistoryLoading
        ]
    );

    // Render loading spinner if data is still loading (initial authentication)
    if (isLoading || isOrganizationLoading || isSubscriptionTiersLoading || isChatHistoryLoading) {
        console.log("AppProvider: Loading initial authentication data. Rendering Spinner.");
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
                <Spinner size={3} label="Loading..." />
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
