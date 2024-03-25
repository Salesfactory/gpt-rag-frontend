import { AddFilled } from "@fluentui/react-icons"

import styles from "./ChatHistoryPannel.module.css";

export const ChatHistoryPanel = () => {
    return (
        <section className={styles.container} data-is-scrollable aria-label="chat history panel">
    <div className={styles.header}>
        <div className={styles.title}>Chat history</div>
        <div className={styles.buttons}>
            <div className={styles.closeButtonContainer}>
                <button className={styles.clearButton} aria-label="clear all chat history">...</button>
            </div>
            <div className={styles.closeButtonContainer}>
                <button className={styles.closeButton} aria-label="hide button"><AddFilled /></button>
            </div>   
        </div>
    </div>
    <div className={styles.content}>
        <h4>Conversations</h4>
    </div>
    <hr />
</section>

    )
}