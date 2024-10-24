import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, Dispatch, SetStateAction } from "react";
import { Spinner } from "@fluentui/react";
import { checkUser, getOrganizationSubscription } from "../api";
import { useMsal } from "@azure/msal-react";

// Define interfaces for UserInfo and OrganizationInfo
interface UserInfo {
    id: string;
    name: string;
    email: string | null;
    role?: string;
    organizationId?: string;
}

interface OrganizationInfo {
    id: string;
    name: string;
    owner: string;
    subscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionExpirationDate?: number;
}

// In types.ts
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
}

// Create the context with a default value
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Create the provider component
export const AppProvider: React.FC<{ children: ReactNode; activeAccount: any }> = ({ children, activeAccount }) => {
    // State variables
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
    const [loading, setLoading] = useState<boolean>(true);

    // MSAL instance and active account

    // Handle keyboard shortcuts
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
                        window.location.href = "/.auth/logout?post_logout_redirect_uri=/";
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

    // Add event listener for keyboard shortcuts
    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]);

    // Fetch user and organization info
    useEffect(() => {
        let isMounted = true;
        const fetchUserInfo = async () => {
            try {
                if (activeAccount) {
                    const id = activeAccount.localAccountId;
                    const name = activeAccount.name || "User";
                    const email = activeAccount.idTokenClaims?.emails?.[0] || activeAccount.username || null;
                    // Check if user exists and get role and organizationId
                    const result = await checkUser({ user: { id, name, email } });
                    const role = result.role;
                    const organizationId = result.organizationId;

                    // Set user state
                    if (isMounted) {
                        setUser({ id, name, email, role, organizationId });
                    }

                    // Get organization info
                    if (organizationId) {
                        const organizationData = await getOrganizationSubscription({
                            userId: id,
                            organizationId
                        });

                        if (isMounted && organizationData) {
                            setOrganization({
                                id: organizationData.id,
                                name: organizationData.name,
                                owner: organizationData.owner,
                                subscriptionId: organizationData.subscriptionId,
                                subscriptionStatus: organizationData.subscriptionStatus,
                                subscriptionExpirationDate: organizationData.subscriptionExpirationDate
                            });
                        }
                    }
                } else {
                    // No active account, leave user and organization as null
                    if (isMounted) {
                        setUser(null);
                        setOrganization(null);
                    }
                }
            } catch (error) {
                console.error("Error fetching user info:", error);
                // Handle errors as needed
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchUserInfo();

        return () => {
            isMounted = false;
        };
    }, [activeAccount]);

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
            setNewChatDeleted
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
            newChatDeleted
        ]
    );

    // Render loading spinner if data is still loading
    if (loading) {
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
