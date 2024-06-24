import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { ConversationHistoryItem, ConversationChatItem, ChatTurn } from "../api";

interface SettingsType {
    temperature: string;
    presencePenalty: string;
    frequencyPenalty: string;
}

interface UserInfo {
    id: string;
    name: string;
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
        name: "anonymous"
    },
    setUser: () => {},
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
    const [user, setUser] = useState({
        id: "00000000-0000-0000-0000-000000000000",
        name: "anonymous"
    });
    const [chatId, setChatId] = useState<string>("");
    const [conversationIsLoading, setConversationIsLoading] = useState<boolean>(false);
    const [chatIsCleaned, setChatIsCleaned] = useState<boolean>(false);
    const [chatSelected, setChatSelected] = useState("");
    const [settingsPanel, setSettingsPanel] = useState(false);
    const [newChatDeleted, setNewChatDeleted] = useState(false);

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "?" && event.ctrlKey && event.shiftKey) {
            event.preventDefault();
            setShowFeedbackRatingPanel(!showFeedbackRatingPanel);
            setSettingsPanel(false);
            setShowHistoryPanel(false);
        } else if (event.key === ";" && event.ctrlKey && event.shiftKey) {
            event.preventDefault()
            setShowHistoryPanel(!showHistoryPanel);
            setShowFeedbackRatingPanel(false);
            setSettingsPanel(false);
        } else if (event.key === ":" && event.ctrlKey && event.shiftKey) {
            event.preventDefault()
            setSettingsPanel(!settingsPanel);
            setShowHistoryPanel(false);
            setShowFeedbackRatingPanel(false);
        }
        else if(event.key === ")" && event.ctrlKey && event.shiftKey){
            event.preventDefault()
            window.location.href = "/.auth/logout?post_logout_redirect_uri=/";
        }
        else if(event.key === "(" && event.ctrlKey && event.shiftKey){
            event.preventDefault()
            window.location.href = "#/admin";
        }
    };
    

    window.addEventListener("keydown", handleKeyDown);
    //If I add this on a useEffect it doesn't work, I don't know why
    //maybe because it's a global event listener and is called multiple times

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
