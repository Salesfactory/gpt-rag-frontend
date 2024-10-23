import { Text } from "@fluentui/react";
import { HistoryRegular } from "@fluentui/react-icons";

import styles from "./ChatHistoryButton.module.css";
import { useAppContext } from "../../providers/AppProviders";
import { useContext } from "react";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const ChatHistoryButton = ({ className, disabled, onClick }: Props) => {
    const { showHistoryPanel } = useAppContext();
    const buttonContent = showHistoryPanel ? "Hide chat history" : "Show chat history";
    return (
        <button className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`} onClick={onClick}>
            <HistoryRegular className={styles.button} />
            <Text className={styles.buttonText}>{buttonContent}</Text>
        </button>
    );
};
