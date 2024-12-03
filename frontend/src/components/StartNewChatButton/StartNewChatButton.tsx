import { IconMessagePlus } from "@tabler/icons-react";
import styles from "./StartNewChatButton.module.css";

const StartNewChatButton = ({ isEnabled, onClick }: { isEnabled: boolean; onClick: () => void }) => {
    return (
        <button
            className={isEnabled ? styles.newChatButton : styles.newChatButtonDisabled}
            onClick={onClick}
            aria-label="Start a new chat"
            type="button"
            disabled={!isEnabled}
        >
            <IconMessagePlus />
        </button>
    );
};

export default StartNewChatButton;
