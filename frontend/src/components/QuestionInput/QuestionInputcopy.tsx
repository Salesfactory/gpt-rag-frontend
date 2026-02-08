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
            <span className={styles.verticalSeparator} aria-hidden="true"></span>
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
                styles={{

                    // TextField styles - transparent since parent container owns the background
                    root: { backgroundColor: "transparent" },
                    wrapper: { backgroundColor: "transparent" },
                    fieldGroup: { backgroundColor: "transparent" },
                    field: { backgroundColor: "transparent", paddingLeft: 6, fontSize: "1rem", maxHeight: 150, lineHeight: "1.3", overflowY: "auto" }
                }}
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
                    <Send size={16} />
                </div>
            </div>
        </Stack>
    );
};
