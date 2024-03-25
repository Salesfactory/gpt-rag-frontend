import { AddFilled } from "@fluentui/react-icons"

import styles from "./ChatHistoryPannel.module.css";

export const ChatHistoryPanel = () => {
    return (
        <section className="container" data-is-scrollable aria-label="chat history panel" style={{ marginRight: 10, marginTop: 5, width: 250, padding: "0 10px"}}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <div style={{fontWeight: 600, fontSize: "18px"}}>Chat history</div>
                <div style={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                    <div className={styles.closeButtonContainer}>
                        <button className={styles.clearButton} aria-label="clear all chat history">...</button>
                    </div>
                    <div className={styles.closeButtonContainer}>
                        <button className={styles.closeButton} aria-label="hide button"><AddFilled /></button>
                    </div>   
                </div>
            </div>
            <div style={{display: "flex", flexDirection: "column", maxWidth: "100%"}}>
                <h4>Conversations</h4>
            </div>
            <hr />
        </section>
    )
}