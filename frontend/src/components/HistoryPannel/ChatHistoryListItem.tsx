import styles from "./ChatHistoryPannel.module.css";
import { getChatHistory, getChatFromHistoryPannelById, deleteChatConversation } from "../../api";
import { useContext, useEffect, useState } from "react";
import { AppContext } from "../../providers/AppProviders";
import trash from "../../assets/trash.png";
import pencil from "../../assets/pencil.png";
import yes from "../../assets/check.png";
import no from "../../assets/close.png";
import { Spinner } from "@fluentui/react";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ChatHistoryPanelProps {
    onDeleteChat: () => void;
}

export const ChatHistoryPanelList: React.FC<ChatHistoryPanelProps> = ({ onDeleteChat }) => {
    const [hoveredItemIndex, setHoveredItemIndex] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingIsLoading, setDeletingIsLoading] = useState(false);
    const [confirmationDelete, setConfirmationDelete] = useState<string | null>(null);
    const [conversationsIds, setConversationsIds] = useState<String[]>([]);
    const {
        dataHistory,
        setDataHistory,
        user,
        dataConversation,
        setDataConversation,
        setConversationIsLoading,
        setChatId,
        chatId,
        refreshFetchHistorial,
        setRefreshFetchHistorial,
        chatSelected,
        setChatSelected,
        setNewChatDeleted
    } = useContext(AppContext);

    const handleMouseEnter = (index: string) => {
        setHoveredItemIndex(index);
    };

    const handleMouseLeave = () => {
        setHoveredItemIndex(null);
    };

    const fetchData = async () => {
        try {
            const data = await getChatHistory(user.id);
            if (data.length > 0) {
                const sortedData = data.sort((a, b) => {
                    const dateA = new Date(a.start_date);
                    const dateB = new Date(b.start_date);
                    return dateB.getTime() - dateA.getTime();
                });
                sortedData.splice(100);
                setDataHistory(sortedData);
                setIsLoading(false);
                const ids = sortedData.map(data => data.id);
                if (!ids.every(id => conversationsIds.includes(id))) {
                    setConversationsIds(ids);
                }
            } else {
                setIsLoading(false);
                setErrorMessage("There are not conversations yet.");
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            setIsLoading(false);
            setErrorMessage(`No history found`);
        }
    };

    const fetchConversation = async (chatConversationId: string) => {
        try {
            if (!chatSelected.includes(chatConversationId)) {
                setChatSelected(chatConversationId);
                setChatId(chatConversationId);
                setConversationIsLoading(true);
                const data = await getChatFromHistoryPannelById(chatConversationId, user.id);
                if (data.length > 0) {
                    setDataConversation(data);
                    setConversationIsLoading(false);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            setConversationIsLoading(false);
            setErrorMessage(`Was an error fetching data: ${error}`);
        }
    };

    const handleDeleteConversation = async (chatConversationId: string) => {
        try {
            setDeletingIsLoading(true);
            const data = await deleteChatConversation(chatConversationId, user.id);
            setDeletingIsLoading(false);
            if (chatSelected === chatConversationId) {
                setDataConversation([]);
            }
            if (chatId === chatConversationId) {
                onDeleteChat();
            }
            const updatedDataHistory = dataHistory.filter(item => item.id !== chatConversationId);
            setDataHistory(updatedDataHistory);

            toast("Conversation deleted successfully", { type: "success" });
        } catch (error) {
            console.error("Error deleting conversation:", error);
            setDeletingIsLoading(false);
            setErrorMessage(`We ran into an error deleting the conversation, please contact the system administrator.`);
            toast("Conversation could not be deleted", { type: "error" });
        }
    };

    const handleRefreshHistoial = async () => {
        if (refreshFetchHistorial) {
            await fetchData();
            setRefreshFetchHistorial(false);
        } else {
            return;
        }
    };

    useEffect(() => {
        if (dataHistory.length <= 0) {
            fetchData();
        } else {
            setIsLoading(false);
        }

        if (refreshFetchHistorial) {
            handleRefreshHistoial();
        }
    }, [user.id, dataHistory, conversationsIds, refreshFetchHistorial]);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Set to the start of the week (Sunday)

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const sortedDataByDate = dataHistory.sort((a, b) => Number(new Date(a.start_date)) - Number(new Date(b.start_date)));

    const uniqueItems = new Set();

    const sortedDataListByDate = [
        { label: "Today", filter: (itemDate: any) => itemDate.toDateString() === today.toDateString() },
        { label: "Yesterday", filter: (itemDate: any) => itemDate.toDateString() === yesterday.toDateString() },
        { label: "This Week", filter: (itemDate: any) => itemDate >= startOfWeek && itemDate <= today },
        { label: "This Month", filter: (itemDate: any) => itemDate >= startOfMonth && itemDate <= today },
        { label: "Previous Months", filter: (itemDate: any) => itemDate < startOfMonth }
    ].map(({ label, filter }) => {
        const filteredData = sortedDataByDate.filter(item => {
            const itemDate = new Date(item.start_date);
            if (!uniqueItems.has(item)) {
                const matches = filter(itemDate);
                if (matches) uniqueItems.add(item);
                return matches;
            }
            return false;
        });
        return { label, data: filteredData };
    });

    const isConfirmationDelete = (conversationId: string) => confirmationDelete === conversationId;

    const isChatId = (conversationId: string) => chatId === conversationId;

    const isChatSelected = (conversationId: string) => chatSelected === conversationId;

    return (
        <div className={styles.listContainer}>
            <ToastContainer />
            {isLoading && (
                <div className={styles.loaderContainer}>
                    <Spinner size={3} />
                </div>
            )}
            {errorMessage !== null ? (
                <p style={{ textAlign: "center", fontWeight: 400, fontStyle: "italic" }}>{errorMessage}</p>
            ) : (
                <>
                    {sortedDataListByDate.map(({ label, data }, monthIndex) => (
                        <div key={monthIndex}>
                            {data.length > 0 && (
                                <>
                                    <h3>{label}</h3>
                                    {data.map((conversation, index) => (
                                        <div
                                            key={conversation.id}
                                            className={
                                                isChatSelected(conversation.id) || isChatId(conversation.id) || isConfirmationDelete(conversation.id)
                                                    ? styles.conversationSelected
                                                    : styles.conversationContainer
                                            }
                                            onMouseEnter={() => handleMouseEnter(`${monthIndex}-${index}`)}
                                            onMouseLeave={handleMouseLeave}
                                        >
                                            <button
                                                className={
                                                    isConfirmationDelete(conversation.id) ? styles.buttonConversationSelected : styles.buttonConversation
                                                }
                                                onClick={() => fetchConversation(conversation.id)}
                                            >
                                                {isConfirmationDelete(conversation.id) ? "Do you want to delete this conversation?" : conversation.content}
                                            </button>
                                            {hoveredItemIndex === `${monthIndex}-${index}` ||
                                            chatSelected === conversation.id ||
                                            chatId === conversation.id ||
                                            isConfirmationDelete(conversation.id) ? (
                                                <div className={styles.actionsButtons}>
                                                    <img
                                                        className={styles.actionButton}
                                                        src={isConfirmationDelete(conversation.id) ? no : trash}
                                                        alt="Destroy"
                                                        onClick={
                                                            isConfirmationDelete(conversation.id)
                                                                ? () => setConfirmationDelete(null)
                                                                : () => setConfirmationDelete(conversation.id)
                                                        }
                                                    />
                                                    {deletingIsLoading && isConfirmationDelete(conversation.id) ? (
                                                        <Spinner className={styles.actionButton} size={1} />
                                                    ) : (
                                                        <img
                                                            className={styles.actionButton}
                                                            src={isConfirmationDelete(conversation.id) ? yes : pencil}
                                                            alt="Edit"
                                                            onClick={
                                                                isConfirmationDelete(conversation.id)
                                                                    ? () => handleDeleteConversation(conversation.id)
                                                                    : () => setConfirmationDelete(null)
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <></>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};
