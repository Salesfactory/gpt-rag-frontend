import React, { useContext, useEffect, useRef } from "react";
import { AddFilled } from "@fluentui/react-icons";
import styles from "./ChatHistoryPannel.module.css";
import { useAppContext } from "../../providers/AppProviders";
import { ChatHistoryPanelList } from "./ChatHistoryListItem";

interface ChatHistoryPanelProps {
    functionDeleteChat: () => void;
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({ functionDeleteChat }) => {
    const { showHistoryPanel, setShowHistoryPanel } = useAppContext();

    const handleClosePannel = () => {
        setShowHistoryPanel(!showHistoryPanel);
    };

    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setShowHistoryPanel(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setShowHistoryPanel]);

    return (
        <div ref={panelRef} className={styles.cardHistoryWrapper} data-is-scrollable aria-label="chat history panel">
            <div className={styles.cardHistory}>
                <div className={styles.header}>
                    <div className={styles.title}>Chat history</div>
                    <div className={styles.buttons}>
                        <div className={styles.closeButtonContainer}>
                            <button className={styles.closeButton} aria-label="hide button" onClick={handleClosePannel}>
                                <AddFilled />
                            </button>
                        </div>
                    </div>
                </div>
                <div className={styles.content}>
                    <ChatHistoryPanelList onDeleteChat={functionDeleteChat} />
                </div>
            </div>
        </div>
    );
};
