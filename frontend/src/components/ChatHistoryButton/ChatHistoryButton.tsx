import { Text } from "@fluentui/react";
import { HistoryFilled } from "@fluentui/react-icons";

import styles from "./ChatHistoryButton.module.css";
import { useApp } from "../../providers/AppProviders";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const ChatHistoryButton = ({ className, disabled, onClick }: Props) => {
  const {showHistoryPanel} = useApp()
  const buttonContent = showHistoryPanel ? "Hide chat history" : 'Show chat history'
    return (
        <button className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`} onClick={onClick}>
            <HistoryFilled className={styles.button}/>
            <Text className={styles.buttonText}>{buttonContent}</Text>
        </button>
    );
};
