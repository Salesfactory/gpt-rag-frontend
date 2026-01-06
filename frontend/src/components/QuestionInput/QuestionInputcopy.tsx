import { useState } from "react";
import { Stack, TextField } from "@fluentui/react";
import { Send } from "lucide-react";

import styles from "./QuestionInputcopy.module.css";

interface Props {
    onSend: (question: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    extraButtonNewChat?: React.ReactNode;
    extraButtonAttach?: React.ReactNode;
    extraButtonDataAnalyst?: React.ReactNode;
}

export const QuestionInput = ({
    onSend,
    disabled: _disabled,
    placeholder,
    clearOnSend,
    extraButtonNewChat,
    extraButtonAttach,
    extraButtonDataAnalyst
}: Props) => {
    const [question, setQuestion] = useState<string>("");

    const sendQuestion = () => {
        onSend(question);

        if (clearOnSend) {
            setQuestion("");
        }
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setQuestion(newValue ?? "");
    };

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            <div className={styles.questionInputButtonsContainer}>
                {extraButtonNewChat}
                {extraButtonDataAnalyst}
                {extraButtonAttach}
            </div>
            <TextField
                className={styles.questionInputTextArea}
                placeholder={placeholder}
                multiline
                resizable={false}
                borderless
                value={question}
                onChange={onQuestionChange}
                onKeyDown={onEnterPress}
                autoAdjustHeight
            />
            <div className={styles.leftButtons}>
                <div
                    className={styles.questionInputSendButton}
                    aria-label="Ask a question button"
                    onClick={sendQuestion}
                    onKeyDown={ev => {
                        if (ev.key === "Enter") {
                            ev.preventDefault();
                            sendQuestion();
                        }
                    }}
                    tabIndex={0}
                >
                    <Send />
                </div>
            </div>
        </Stack>
    );
};
