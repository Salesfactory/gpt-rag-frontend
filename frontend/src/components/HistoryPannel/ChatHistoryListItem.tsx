import styles from "./ChatHistoryPannel.module.css";
import { getChatHistory, getChatFromHistoryPannelById, deleteChatConversation } from "../../api";
import { useEffect, useState } from "react";
import { useAppContext } from "../../providers/AppProviders";
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
    } = useAppContext();

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
                    {sortedDataListByMonth.map(({ month, data }, monthIndex) => (
                        <div key={monthIndex}>
                            {data.length > 0 && (
                                <>
                                    <h3>{month}</h3>
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
