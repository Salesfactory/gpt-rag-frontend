import { useState } from "react";
import { useAppContext } from "../../providers/AppProviders";
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
}

export const QuestionInput = ({
  onSend,
  disabled,
  placeholder,
  clearOnSend,
  extraButtonNewChat,
  extraButtonAttach
}: Props) => {
  const { organization } = useAppContext();
  const [question, setQuestion] = useState<string>("");

  const sendQuestion = () => {
    if (
      disabled ||
      !question.trim() ||
      !organization ||
      organization.subscriptionStatus === "inactive" ||
      !organization.subscriptionId
    ) {
      return;
    }

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

  const sendQuestionDisabled =
    disabled ||
    !question.trim() ||
    !organization ||
    organization.subscriptionStatus === "inactive" ||
    !organization.subscriptionId;

  return (
    <Stack horizontal className={styles.questionInputContainer}>
      <div className={styles.questionInputButtonsContainer}>
        {extraButtonNewChat}
        {extraButtonAttach} {/* ← lo renderiza el padre (Chat) */}
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
          className={`${styles.questionInputSendButton} ${sendQuestionDisabled ? styles.questionInputSendButtonDisabled : ""}`}
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
