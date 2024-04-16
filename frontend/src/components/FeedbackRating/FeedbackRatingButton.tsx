import { Text } from "@fluentui/react";
import { ChatBubblesQuestionFilled } from "@fluentui/react-icons";

import styles from "./FeedbackRatingButton.module.css";
import { useAppContext } from "../../providers/AppProviders";

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
            <ChatBubblesQuestionFilled className={styles.button} />
            <Text className={styles.buttonText}>{buttonContent}</Text>
        </button>
    );
};
