import styles from "./ChatHistoryPannel.module.css";
import { getChatHistory, getChatFromHistoryPannelById, deleteChatConversation } from "../../api";
import { useEffect, useState } from "react";
import { useAppContext } from "../../providers/AppProviders";
import trash from "../../assets/trash.png";
import pencil from "../../assets/pencil.png";
import yes from "../../assets/check.png";
import no from "../../assets/close.png";
import { Spinner } from "@fluentui/react";

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
        userId,
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
    } = useAppContext();

    const handleMouseEnter = (index: string) => {
        setHoveredItemIndex(index);
    };

    const handleMouseLeave = () => {
        setHoveredItemIndex(null);
    };

    const fetchData = async () => {
        try {
            const data = await getChatHistory(userId);
            if (data.length > 0) {
                const sortedData = data.sort((a, b) => {
                    const dateA = new Date(a.start_date);
                    const dateB = new Date(b.start_date);
                    return dateB.getTime() - dateA.getTime();
                });
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
                const data = await getChatFromHistoryPannelById(chatConversationId, userId);
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
            const data = await deleteChatConversation(chatConversationId, userId);
            setDeletingIsLoading(false);
            console.log("desde eliminar", chatId);
            if (chatSelected === chatConversationId) {
                setDataConversation([]);
            }
            if (chatId === chatConversationId) {
                onDeleteChat();
            }
            const updatedDataHistory = dataHistory.filter(item => item.id !== chatConversationId);
            setDataHistory(updatedDataHistory);
        } catch (error) {
            console.error("Error deleting conversation:", error);
            setDeletingIsLoading(false);
            setErrorMessage(`Was an error deleting conversation: ${error}`);
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
    }, [userId, dataHistory, conversationsIds, refreshFetchHistorial]);

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const sortedDataByMonth = dataHistory.sort((a, b) => {
        const monthA = new Date(a.start_date).getMonth();
        const monthB = new Date(b.start_date).getMonth();
        return monthA - monthB;
    });

    const sortedDataListByMonth = months.map(month => {
        const monthData = sortedDataByMonth.filter(item => {
            return new Date(item.start_date).getMonth() === months.indexOf(month);
        });
        return { month, data: monthData };
    });

    return (
        <div className={styles.listContainer}>
            {isLoading && (
                <div className={styles.loaderContainer}>
                    <Spinner size={3} />
                </div>
            )}
            {errorMessage !== null ? (
                <p style={{ textAlign: "center", fontWeight: 400, fontStyle: "italic" }}>{errorMessage}</p>
            ) : (
                <>
                    {sortedDataListByMonth.map(({ month, data }, monthIndex) => (
                        <div key={monthIndex}>
                            {data.length > 0 && (
                                <>
                                    <h3>{month}</h3>
                                    {data.map((conversation, index) => (
                                        <div
                                            key={conversation.id}
                                            className={
                                                chatSelected === conversation.id || chatId === conversation.id || confirmationDelete === conversation.id
                                                    ? styles.conversationSelected
                                                    : styles.conversationContainer
                                            }
                                            onMouseEnter={() => handleMouseEnter(`${monthIndex}-${index}`)}
                                            onMouseLeave={handleMouseLeave}
                                        >
                                            <button
                                                className={
                                                    confirmationDelete === conversation.id ? styles.buttonConversationSelected : styles.buttonConversation
                                                }
                                                onClick={() => fetchConversation(conversation.id)}
                                            >
                                                {confirmationDelete === conversation.id ? "Do you want to delete this conversation?" : conversation.content}
                                            </button>
                                            {hoveredItemIndex === `${monthIndex}-${index}` ||
                                            chatSelected === conversation.id ||
                                            chatId === conversation.id ||
                                            confirmationDelete === conversation.id ? (
                                                <div className={styles.actionsButtons}>
                                                    <img
                                                        className={styles.actionButton}
                                                        src={confirmationDelete === conversation.id ? no : trash}
                                                        alt="Destroy"
                                                        onClick={
                                                            confirmationDelete === conversation.id
                                                                ? () => setConfirmationDelete(null)
                                                                : () => setConfirmationDelete(conversation.id)
                                                        }
                                                    />
                                                    {deletingIsLoading && confirmationDelete === conversation.id ? (
                                                        <Spinner className={styles.actionButton} size={1} />
                                                    ) : (
                                                        <img
                                                            className={styles.actionButton}
                                                            src={confirmationDelete === conversation.id ? yes : pencil}
                                                            alt="Edit"
                                                            onClick={
                                                                confirmationDelete === conversation.id
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
