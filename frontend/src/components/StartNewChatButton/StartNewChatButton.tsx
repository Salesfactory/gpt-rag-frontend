import { AddRegular } from "@fluentui/react-icons";
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
            <AddRegular />
        </button>
    );
};

export default StartNewChatButton;
