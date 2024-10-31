import { Text } from "@fluentui/react";
import { ChatBubblesQuestionRegular } from "@fluentui/react-icons";

import styles from "./FeedbackRatingButton.module.css";
import { useAppContext } from "../../providers/AppProviders";
import { useContext } from "react";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const FeedbackRatingButton = ({ className, disabled, onClick }: Props) => {
    const { showFeedbackRatingPanel } = useAppContext();
    const buttonContent = showFeedbackRatingPanel ? "Hide feedback panel" : "Show feedback panel";
    return (
        <button className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`} onClick={onClick}>
            <ChatBubblesQuestionRegular className={styles.button} />
            <Text className={styles.buttonText}>{buttonContent}</Text>
        </button>
    );
};
