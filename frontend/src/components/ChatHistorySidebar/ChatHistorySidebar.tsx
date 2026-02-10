import React, { useEffect, useState, useRef } from "react";
import styles from "./ChatHistorySidebar.module.css";
import { getChatHistory, getChatFromHistoryPannelById, deleteChatConversation, exportConversation, renameConversation } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import { Spinner } from "@fluentui/react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Trash2, Check, X, ChevronDown, ChevronUp, Upload, ExternalLink, Copy, Pencil } from "lucide-react";

interface ChatHistorySidebarProps {
    onClose: () => void;
    onDeleteChat: () => void;
    width: number;
    minWidth: number;
    maxWidth: number;
    onResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    isResizing: boolean;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({ onClose, onDeleteChat, width, minWidth, maxWidth, onResizeMouseDown, isResizing }) => {
    const [visible, setVisible] = useState(false);
    const [hoveredItemIndex, setHoveredItemIndex] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingIsLoading, setDeletingIsLoading] = useState(false);
    const [confirmationDelete, setConfirmationDelete] = useState<string | null>(null);
    const [conversationsIds, setConversationsIds] = useState<String[]>([]);
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2, 3]));
    const [exportingConversations, setExportingConversations] = useState<Set<string>>(new Set());
    const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");

    const sidebarRef = useRef<HTMLDivElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const {
        dataHistory,
        setDataHistory,
        user,
        organization,
        dataConversation,
        setDataConversation,
        setConversationIsLoading,
        setChatId,
        chatId,
        refreshFetchHistory,
        setRefreshFetchHistory,
        chatSelected,
        setChatSelected,
        setShowHistoryPanel
    } = useAppContext();

    useEffect(() => {
        // Activar transición al montar
        const timeout = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300);
        setShowHistoryPanel(false);
    };

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
            setErrorMessage("You must be logged in to view conversations.");
            return;
        }

        if (!chatSelected.includes(chatConversationId)) {
            setChatSelected(chatConversationId);
            setChatId(chatConversationId);
            setConversationIsLoading(true);
            handleClose();

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

    const handleExportConversation = async (conversationId: string) => {
        if (!user) {
            toast("Please log in to export conversations.", { type: "warning" });
            return;
        }

        if (!user.id) {
            toast("User information is incomplete.", { type: "warning" });
            return;
        }

        // Add to exporting set
        setExportingConversations(prev => new Set(prev).add(conversationId));

        try {
            const result = await exportConversation(conversationId, user.id);

            // Show success toast with copy and open options
            const exportToast = (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>Conversation exported successfully!</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            aria-label="Copy to Clipboard"
                            onClick={() => {
                                navigator.clipboard.writeText(result.share_url);
                                toast("Link copied to clipboard!", { type: "success" });
                            }}
                            style={{
                                padding: "4px 8px",
                                background: "#0078d4",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                            }}
                        >
                            <Copy size={12} aria-hidden="true" />
                            Copy Link
                        </button>
                        <button
                            aria-label="Open Conversation"
                            onClick={() => {
                                window.open(result.share_url, "_blank");
                            }}
                            style={{
                                padding: "4px 8px",
                                background: "#107c10",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                            }}
                        >
                            <ExternalLink size={12} aria-hidden="true" />
                            Open
                        </button>
                    </div>
                </div>
            );

            toast(exportToast, {
                type: "success",
                autoClose: 8000,
                closeOnClick: false
            });
        } catch (error) {
            console.error("Error exporting conversation:", error);
            toast("Failed to export conversation. Please try again.", { type: "error" });
        } finally {
            // Remove from exporting set
            setExportingConversations(prev => {
                const newSet = new Set(prev);
                newSet.delete(conversationId);
                return newSet;
            });
        }
    };

    const startRenaming = (conversationId: string, currentTitle: string, currentContent: string) => {
        setEditingConversationId(conversationId);
        setEditTitle(currentTitle || currentContent);
        setTimeout(() => renameInputRef.current?.select(), 0);
    };

    const cancelRenaming = () => {
        setEditingConversationId(null);
        setEditTitle("");
    };

    const confirmRenaming = async (conversationId: string, currentTitle: string, currentContent: string) => {
        const trimmed = editTitle.trim();
        const currentDisplay = currentTitle || currentContent;

        if (!trimmed || trimmed === currentDisplay) {
            cancelRenaming();
            return;
        }

        if (!user?.id) {
            cancelRenaming();
            return;
        }

        try {
            const result = await renameConversation(conversationId, user.id, trimmed);
            setDataHistory(prev => prev.map(c => c.id === conversationId ? { ...c, title: result.title } : c));
        } catch (error) {
            console.error("Error renaming conversation:", error);
            toast("Failed to rename conversation", { type: "error" });
        } finally {
            cancelRenaming();
        }
    };

    const handleRefreshHistoial = async () => {
        if (refreshFetchHistory) {
            await fetchData();
            setRefreshFetchHistory(false);
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
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const dataForOrganization = dataHistory.filter(
        item => item.organization_id === "" || (organization && item.organization_id === organization.id)
    );
    const sortedDataByDate = dataForOrganization.sort((a, b) => Number(new Date(a.start_date)) - Number(new Date(b.start_date)));

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
        <>
            {visible && <div className={styles.overlay} onClick={handleClose} />}

            <div
                ref={sidebarRef}
                className={`${styles.sidebar} ${visible ? styles.visible : ""}`}
                style={{
                    width,
                    minWidth,
                    maxWidth,
                    transition: isResizing ? "none" : "right 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s ease, width 0.1s",
                    background: "#fff"
                }}
            >
                {/* Resize Sidebar */}
                <div
                    className={styles.chatResizeHandle}
                    onMouseDown={onResizeMouseDown}
                    style={{
                        position: "absolute",
                        cursor: "col-resize",
                        zIndex: 10
                    }}
                />
                <div className={styles.header}>
                    <h2 className={styles.title}>Chat History</h2>
                    <button onClick={handleClose} className={styles.closeButton} aria-label="Close sidebar">
                        <X />
                    </button>
                </div>

                <div className={styles.content}>
                    {isLoading && (
                        <div className={styles.loaderContainer}>
                            <Spinner size={3} />
                        </div>
                    )}

                    {errorMessage !== null ? (
                        <p className={styles.errorMessage}>{errorMessage}</p>
                    ) : (
                        <div className={styles.conversationsList}>
                            {sortedDataListByDate
                                .filter(({ data }) => data.length > 0)
                                .map(({ label, data }, monthIndex) => (
                                    <div key={monthIndex} className={styles.timeSection}>
                                        <div className={styles.timeHeader} onClick={() => toggleSection(monthIndex)}>
                                            <span className={styles.timeLabel}>{label}</span>
                                            {expandedSections.has(monthIndex) ? (
                                                <ChevronUp className={styles.chevronIcon} />
                                            ) : (
                                                <ChevronDown className={styles.chevronIcon} />
                                            )}
                                        </div>

                                        {expandedSections.has(monthIndex) && (
                                            <div className={styles.conversationsGroup}>
                                                {data.map((conversation, index) => (
                                                    <div
                                                        key={conversation.id}
                                                        className={`${styles.conversationItem} ${
                                                            isChatSelected(conversation.id) || isChatId(conversation.id) ? styles.selected : ""
                                                        }`}
                                                        onMouseEnter={() => handleMouseEnter(`${monthIndex}-${index}`)}
                                                        onMouseLeave={handleMouseLeave}
                                                    >
                                                        {editingConversationId === conversation.id ? (
                                                            <input
                                                                ref={renameInputRef}
                                                                className={styles.renameInput}
                                                                value={editTitle}
                                                                onChange={e => setEditTitle(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") confirmRenaming(conversation.id, conversation.title || "", conversation.content);
                                                                    if (e.key === "Escape") cancelRenaming();
                                                                }}
                                                                maxLength={200}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <button
                                                                aria-label={`Select conversation ${conversation.id}`}
                                                                className={styles.conversationButton}
                                                                onClick={() => (isConfirmationDelete(conversation.id) ? null : fetchConversation(conversation.id))}
                                                            >
                                                                {isConfirmationDelete(conversation.id)
                                                                    ? "Do you want to delete this conversation?"
                                                                    : conversation.title || conversation.content}
                                                            </button>
                                                        )}

                                                        {(hoveredItemIndex === `${monthIndex}-${index}` ||
                                                            chatSelected === conversation.id ||
                                                            chatId === conversation.id ||
                                                            isConfirmationDelete(conversation.id) ||
                                                            editingConversationId === conversation.id) && (
                                                            <div className={styles.actionButtons}>
                                                                {editingConversationId === conversation.id ? (
                                                                    <>
                                                                        <Check
                                                                            className={`${styles.actionButton} ${styles.confirmButton}`}
                                                                            onClick={() => confirmRenaming(conversation.id, conversation.title || "", conversation.content)}
                                                                        />
                                                                        <X
                                                                            className={`${styles.actionButton} ${styles.cancelButton}`}
                                                                            onClick={cancelRenaming}
                                                                        />
                                                                    </>
                                                                ) : isConfirmationDelete(conversation.id) ? (
                                                                    <>
                                                                        <X
                                                                            className={`${styles.actionButton} ${styles.cancelButton}`}
                                                                            onClick={() => setConfirmationDelete(null)}
                                                                        />
                                                                        {deletingIsLoading ? (
                                                                            <Spinner className={styles.actionSpinner} size={1} />
                                                                        ) : (
                                                                            <Check
                                                                                className={`${styles.actionButton} ${styles.confirmButton}`}
                                                                                onClick={() => handleDeleteConversation(conversation.id)}
                                                                            />
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Pencil
                                                                            className={styles.actionButton}
                                                                            onClick={() => startRenaming(conversation.id, conversation.title || "", conversation.content)}
                                                                        />
                                                                        {exportingConversations.has(conversation.id) ? (
                                                                            <Spinner className={styles.actionSpinner} size={1} />
                                                                        ) : (
                                                                            <Upload
                                                                                className={`${styles.actionButton} ${styles.exportButton}`}
                                                                                onClick={() => handleExportConversation(conversation.id)}
                                                                            />
                                                                        )}
                                                                        <Trash2
                                                                            className={styles.actionButton}
                                                                            onClick={() => setConfirmationDelete(conversation.id)}
                                                                        />
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                            {dataHistory.length === 0 && !isLoading && <p className={styles.emptyMessage}>No conversations found</p>}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ChatHistorySidebar;
