import styles from "./ChatHistoryPannel.module.css";
import { getChatHistory, getChatFromHistoryPannelById, deleteChatConversation } from "../../api";
import { useContext, useEffect, useState } from "react";
import { useAppContext } from "../../providers/AppProviders";
import { Spinner } from "@fluentui/react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DeleteRegular, CheckmarkRegular, DismissRegular, ChevronDownRegular, ChevronUpRegular } from "@fluentui/react-icons";

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
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
    const {
        dataHistory,
        setDataHistory,
        user,
        dataConversation,
        setDataConversation,
        setConversationIsLoading,
        setChatId,
        chatId,
        refreshFetchHistory,
        setRefreshFetchHistory,
        chatSelected,
        setChatSelected,
        setNewChatDeleted,
        setShowHistoryPanel,
        isFinancialAssistantActive
    } = useAppContext();

    const handleMouseEnter = (index: string) => {
        setHoveredItemIndex(index);
    };

    const handleMouseLeave = () => {
        setHoveredItemIndex(null);
    };

    const fetchData = async () => {
        if (!user?.id) {
            setIsLoading(false);
            setErrorMessage("Not Valid User Id");
        } else {
            try {
                const data = await getChatHistory(user?.id);
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
        }
    };

    const fetchConversation = async (chatConversationId: string) => {
        if (!user) {
            // Handle the case when user is null
            setErrorMessage("You must be logged in to view conversations.");
            return;
        }

        if (!chatSelected.includes(chatConversationId)) {
            setChatSelected(chatConversationId);
            setChatId(chatConversationId);
            setConversationIsLoading(true);
            setShowHistoryPanel(false);

            try {
                const data = await getChatFromHistoryPannelById(chatConversationId, user.id);

                if (data.length > 0) {
                    setDataConversation(data);
                } else {
                    setDataConversation([]);
                    setErrorMessage("No conversation data found.");
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                setErrorMessage(`An error occurred while fetching data: ${error}`);
            } finally {
                setConversationIsLoading(false);
            }
        }
    };

    const handleDeleteConversation = async (chatConversationId: string) => {
        if (!user) {
            // Handle the case where user is null
            setErrorMessage("You must be logged in to delete a conversation.");
            toast("Please log in to delete conversations.", { type: "warning" });
            return;
        }

        if (!user.id) {
            setErrorMessage("User ID is missing. Please log in again.");
            toast("User information is incomplete.", { type: "warning" });
            return;
        }

        setDeletingIsLoading(true);

        try {
            await deleteChatConversation(chatConversationId, user.id);

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
            setErrorMessage("We ran into an error deleting the conversation. Please try again later.");
            toast("Conversation could not be deleted", { type: "error" });
        } finally {
            setDeletingIsLoading(false);
        }
    };

    const handleRefreshHistoial = async () => {
        if (refreshFetchHistory) {
            await fetchData();
            setRefreshFetchHistory(false);
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

        if (refreshFetchHistory) {
            handleRefreshHistoial();
        }
    }, [user?.id, dataHistory, conversationsIds, refreshFetchHistory]);

    const today = new Date();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Set to the start of the week (Sunday)

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // either default for usual conversations or financial for financial conversations
    // != "financial" for default conversations
    const dataDefaultOrFinancial = isFinancialAssistantActive
        ? dataHistory.filter(item => item.type == "financial")
        : dataHistory.filter(item => item.type != "financial");
    const sortedDataByDate = dataDefaultOrFinancial.sort((a, b) => Number(new Date(a.start_date)) - Number(new Date(b.start_date)));

    const uniqueItems = new Set();

    const sortedDataListByDate = [
        { label: "Today", filter: (itemDate: any) => itemDate.toDateString() === today.toDateString() },
        { label: "This Week", filter: (itemDate: any) => itemDate >= startOfWeek && itemDate <= today },
        { label: "This Month", filter: (itemDate: any) => itemDate >= startOfMonth && itemDate <= today },
        { label: "Previous Months", filter: (itemDate: any) => itemDate < startOfMonth }
    ].map(({ label, filter }) => {
        const filteredData = sortedDataByDate
            .filter(item => {
                const itemDate = new Date(item.start_date);
                if (!uniqueItems.has(item)) {
                    const matches = filter(itemDate);
                    if (matches) uniqueItems.add(item);
                    return matches;
                }
                return false;
            })
            .reverse();
        return { label, data: filteredData };
    });

    const isConfirmationDelete = (conversationId: string) => confirmationDelete === conversationId;

    const isChatId = (conversationId: string) => chatId === conversationId;

    const isChatSelected = (conversationId: string) => chatSelected === conversationId;

    const toggleSection = (sectionIndex: number) => {
        setExpandedSections(prevExpandedSections => {
            const newExpandedSections = new Set(prevExpandedSections);
            if (newExpandedSections.has(sectionIndex)) {
                newExpandedSections.delete(sectionIndex);
            } else {
                newExpandedSections.add(sectionIndex);
            }
            return newExpandedSections;
        });
    };

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
                    {sortedDataListByDate.map(({ label, data }, monthIndex) => (
                        <div key={monthIndex}>
                            {data.length > 0 && (
                                <>
                                    <div className={styles.timeContainer} onClick={() => toggleSection(monthIndex)} style={{ cursor: "ponter" }}>
                                        <div className={styles.subtitle}>{label}</div>
                                        <div>{expandedSections.has(monthIndex) ? <ChevronUpRegular /> : <ChevronDownRegular />}</div>
                                    </div>
                                    {expandedSections.has(monthIndex) &&
                                        data.map((conversation, index) => (
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
                                                        {isConfirmationDelete(conversation.id) ? (
                                                            <DismissRegular
                                                                className={styles.actionButton}
                                                                onClick={() => setConfirmationDelete(null)}
                                                                style={{ color: "red" }}
                                                            />
                                                        ) : (
                                                            <DeleteRegular
                                                                className={styles.actionButton}
                                                                onClick={() => setConfirmationDelete(conversation.id)}
                                                            />
                                                        )}

                                                        {deletingIsLoading && isConfirmationDelete(conversation.id) ? (
                                                            <Spinner className={styles.actionButton} size={1} />
                                                        ) : (
                                                            isConfirmationDelete(conversation.id) && (
                                                                <CheckmarkRegular
                                                                    className={styles.actionButton}
                                                                    onClick={() => handleDeleteConversation(conversation.id)}
                                                                    style={{ color: "green" }}
                                                                />
                                                            )
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
