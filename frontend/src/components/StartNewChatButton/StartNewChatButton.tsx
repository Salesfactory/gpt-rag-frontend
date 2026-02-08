
import styles from "./StartNewChatButton.module.css";
import { PlusIcon } from "lucide-react";

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
                <PlusIcon />
            </button>
            <span className={styles.tooltipText}>Start a new chat</span>
        </div>
    );
};

export default StartNewChatButton;
