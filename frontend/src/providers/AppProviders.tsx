import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction, useEffect } from "react";
import { ConversationHistoryItem, ConversationChatItem, ChatTurn } from "../api";
import { Spinner } from "@fluentui/react";
import { chatApiGpt, Approaches, AskResponse, ChatRequest, ChatRequestGpt, getUserInfo, checkUser, getOrganizationSubscription } from "../api";
interface UserInfo {
    id: string;
    name: string;
    email: string | null;
    role: string | undefined;
    organizationId?: string;
}

interface OrganizationInfo {
    id: string;
    name: string;
    owner: string;
    subscriptionId: string | undefined;
    subscriptionStatus: string | undefined;
    subscriptionExpirationDate: number | undefined;
}

interface AppContextType {
    showHistoryPanel: boolean;
    setShowHistoryPanel: Dispatch<SetStateAction<boolean>>;
    newChatDeleted: boolean;
    setNewChatDeleted: Dispatch<SetStateAction<boolean>>;
    showFeedbackRatingPanel: boolean;
    setShowFeedbackRatingPanel: Dispatch<SetStateAction<boolean>>;
    refreshFetchHistorial: boolean;
    setRefreshFetchHistorial: Dispatch<SetStateAction<boolean>>;
    chatIsCleaned: boolean;
    setChatIsCleaned: Dispatch<SetStateAction<boolean>>;
    dataHistory: ConversationHistoryItem[];
    setDataHistory: Dispatch<SetStateAction<ConversationHistoryItem[]>>;
    user: UserInfo;
    setUser: Dispatch<SetStateAction<UserInfo>>;
    organization: OrganizationInfo;
    setOrganization: Dispatch<SetStateAction<OrganizationInfo>>;
    chatSelected: string;
    setChatSelected: Dispatch<SetStateAction<string>>;
    chatId: string;
    setChatId: Dispatch<SetStateAction<string>>;
    dataConversation: ChatTurn[];
    setDataConversation: Dispatch<SetStateAction<ChatTurn[]>>;
    conversationIsLoading: boolean;
    setConversationIsLoading: Dispatch<SetStateAction<boolean>>;
    settingsPanel: boolean;
    setSettingsPanel: Dispatch<SetStateAction<boolean>>;
}

export const AppContext = createContext<AppContextType>({
    showHistoryPanel: true,
    setShowHistoryPanel: () => {},
    showFeedbackRatingPanel: false,
    setShowFeedbackRatingPanel: () => {},
    dataHistory: [],
    setDataHistory: () => {},
    user: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "anonymous",
        email: "anonymous@gmail.com",
        role: undefined,
        organizationId: undefined
    },
    setUser: () => {},
    organization: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "no-organization",
        owner: "no-owner",
        subscriptionId: undefined,
        subscriptionStatus: undefined,
        subscriptionExpirationDate: undefined
    },
    setOrganization: () => {},
    dataConversation: [],
    setDataConversation: () => {},
    chatId: "",
    setChatId: () => {},
    conversationIsLoading: false,
    setConversationIsLoading: () => {},
    refreshFetchHistorial: false,
    setRefreshFetchHistorial: () => {},
    chatSelected: "",
    setChatSelected: () => {},
    chatIsCleaned: false,
    setChatIsCleaned: () => {},
    settingsPanel: false,
    setSettingsPanel: () => {},
    newChatDeleted: false,
    setNewChatDeleted: () => {}
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(true);
    const [showFeedbackRatingPanel, setShowFeedbackRatingPanel] = useState<boolean>(false);
    const [refreshFetchHistorial, setRefreshFetchHistorial] = useState<boolean>(false);
    const [dataHistory, setDataHistory] = useState<ConversationHistoryItem[]>([]);
    const [dataConversation, setDataConversation] = useState<ChatTurn[]>([]);
    const [user, setUser] = useState<UserInfo>({
        id: "00000000-0000-0000-0000-000000000000",
        name: "anonymous",
        email: "anonymous@gmail.com",
        role: undefined,
        organizationId: undefined
    });
    const [organization, setOrganization] = useState<OrganizationInfo>({
        id: "00000000-0000-0000-0000-000000000000",
        name: "no-organization",
        owner: "no-owner",
        subscriptionId: undefined,
        subscriptionStatus: undefined,
        subscriptionExpirationDate: undefined
    });
    const [chatId, setChatId] = useState<string>("");
    const [conversationIsLoading, setConversationIsLoading] = useState<boolean>(false);
    const [chatIsCleaned, setChatIsCleaned] = useState<boolean>(false);
    const [chatSelected, setChatSelected] = useState("");
    const [settingsPanel, setSettingsPanel] = useState(false);
    const [newChatDeleted, setNewChatDeleted] = useState(false);

    const handleKeyDown = (event: KeyboardEvent) => {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        const isAlt = event.altKey;

        if (event.code === "Digit8" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            setShowFeedbackRatingPanel(!showFeedbackRatingPanel);
            setSettingsPanel(false);
            setShowHistoryPanel(false);
        } else if (event.code === "Period" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            setShowHistoryPanel(!showHistoryPanel);
            setShowFeedbackRatingPanel(false);
            setSettingsPanel(false);
        } else if (event.code === "Comma" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            setSettingsPanel(!settingsPanel);
            setShowHistoryPanel(false);
            setShowFeedbackRatingPanel(false);
        } else if (event.code === "Digit0" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            window.location.href = "/.auth/logout?post_logout_redirect_uri=/";
        } else if (event.code === "Digit9" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            window.location.href = "#/admin";
        } else if (event.code === "Digit7" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            window.location.href = "#/payment";
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    //If I add this on a useEffect it doesn't work, I don't know why
    //maybe because it's a global event listener and is called multiple times

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user.organizationId) {
            const getUserInfoList = async () => {
                if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
                    const userInfoList = await getUserInfo();
                    if (userInfoList.length === 0) {
                        // setShowAuthMessage(true);
                        console.log("No user info found. Using anonymous user.", userInfoList);
                    } else {
                        // setShowAuthMessage(false);
                        console.log("User info found.", userInfoList);

                        const keyId = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
                        const keyName = "name";
                        const keyEmail = "emails";

                        const _user = userInfoList.find(obj => {
                            const _id = obj?.user_claims?.some(claim => claim.typ === keyId);
                            const _name = obj?.user_claims?.some(claim => claim.typ === keyName);
                            return _id && _name;
                        });

                        if (_user) {
                            const id = _user?.user_claims?.find(claim => claim.typ === keyId)?.val || "";
                            const name = _user?.user_claims?.find(claim => claim.typ === keyName)?.val || "";
                            const email = _user?.user_claims?.find(claim => claim.typ === keyEmail)?.val || null;

                            if (id && name) {
                                setUser({ id, name, email, role: undefined, organizationId: undefined });
                            }

                            // register user if doesn't exist

                            // const response = await getUsers({ user: { id, name, email } });  // to get all users

                            // verifies if user exists and assigns the role
                            const result = await checkUser({ user: { id, name, email } });
                            const role = result["role"] || undefined;
                            const organizationId = result["organizationId"] || undefined;

                            const organization = await getOrganizationSubscription({ userId: id, organizationId: organizationId });

                            if (result && role) {
                                setUser({ id, name, email, role, organizationId });
                            }
                            if (organization) {
                                setOrganization({
                                    id: organization.id,
                                    name: organization.name,
                                    owner: organization.owner,
                                    subscriptionId: organization.subscriptionId,
                                    subscriptionStatus: organization.subscriptionStatus,
                                    subscriptionExpirationDate: organization.subscriptionExpirationDate
                                });
                            }
                            setLoading(false);
                        }
                    }
                } else {
                    console.log("Local");
                    setUser({ ...user, organizationId: "test-organization" });
                    setOrganization({ ...organization, subscriptionId: "test-subscriptionId" });
                    setLoading(false);
                }
            };
            getUserInfoList();
        }
    }, []);

    if (loading)
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

    return (
        <AppContext.Provider
            value={{
                showHistoryPanel,
                setShowHistoryPanel,
                showFeedbackRatingPanel,
                setShowFeedbackRatingPanel,
                setSettingsPanel,
                settingsPanel,
                dataHistory,
                setDataHistory,
                user,
                setUser,
                organization,
                setOrganization,
                dataConversation,
                setDataConversation,
                chatId,
                setChatId,
                conversationIsLoading,
                setConversationIsLoading,
                refreshFetchHistorial,
                setRefreshFetchHistorial,
                chatSelected,
                setChatSelected,
                chatIsCleaned,
                setChatIsCleaned,
                newChatDeleted,
                setNewChatDeleted
            }}
        >
            {children}
        </AppContext.Provider>
    );
};
