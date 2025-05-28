import { CirclePlus } from "lucide-react";
import styles from "./StartNewChatButtoncopy.module.css";

const StartNewChatButton = ({ isEnabled, onClick }: { isEnabled: boolean; onClick: () => void }) => {
    return (
        <div className={styles.tooltipContainer}>
            <button
                className={isEnabled ? styles.newChatButton : styles.newChatButtonDisabled}
                onClick={onClick}
                aria-label="Start a new chat"
                type="button"
                disabled={!isEnabled}
            >
                <CirclePlus />
            </button>
            <span className={styles.tooltipText}>Start a new chat</span>
        </div>
    );
};

export default StartNewChatButton;
