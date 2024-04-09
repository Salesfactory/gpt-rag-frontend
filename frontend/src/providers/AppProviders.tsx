import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { ConversationHistoryItem, ConversationChatItem, ChatTurn } from "../api";
interface AppContextType {
    showHistoryPanel: boolean;
    setShowHistoryPanel: Dispatch<SetStateAction<boolean>>;
    showFeedbackRatingPanel: boolean;
    setShowFeedbackRatingPanel: Dispatch<SetStateAction<boolean>>;
    refreshFetchHistorial: boolean;
    setRefreshFetchHistorial: Dispatch<SetStateAction<boolean>>;
    chatIsCleaned: boolean;
    setChatIsCleaned: Dispatch<SetStateAction<boolean>>;
    dataHistory: ConversationHistoryItem[];
    setDataHistory: Dispatch<SetStateAction<ConversationHistoryItem[]>>;
    userId: string;
    setUserId: Dispatch<SetStateAction<string>>;
    chatSelected: string;
    setChatSelected: Dispatch<SetStateAction<string>>;
    chatId: string;
    setChatId: Dispatch<SetStateAction<string>>;
    dataConversation: ChatTurn[];
    setDataConversation: Dispatch<SetStateAction<ChatTurn[]>>;
    conversationIsLoading: boolean;
    setConversationIsLoading: Dispatch<SetStateAction<boolean>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(true);
    const [showFeedbackRatingPanel, setShowFeedbackRatingPanel] = useState<boolean>(false);
    const [refreshFetchHistorial, setRefreshFetchHistorial] = useState<boolean>(false);
    const [dataHistory, setDataHistory] = useState<ConversationHistoryItem[]>([]);
    const [dataConversation, setDataConversation] = useState<ChatTurn[]>([]);
    const [userId, setUserId] = useState<string>("00000000-0000-0000-0000-000000000000");
    const [chatId, setChatId] = useState<string>("");
    const [conversationIsLoading, setConversationIsLoading] = useState<boolean>(false);
    const [chatIsCleaned, setChatIsCleaned] = useState<boolean>(false);
    const [chatSelected, setChatSelected] = useState("");

    return (
        <AppContext.Provider
            value={{
                showHistoryPanel,
                setShowHistoryPanel,
                showFeedbackRatingPanel,
                setShowFeedbackRatingPanel,
                dataHistory,
                setDataHistory,
                userId,
                setUserId,
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
                setChatIsCleaned
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used inside AppProvider");
    }
    return context;
};
