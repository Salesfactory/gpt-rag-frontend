import { useMemo } from "react";
import { Stack, IconButton } from "@fluentui/react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import styles from "./Answer.module.css";

import { AskResponse, getCitationFilePath, getFilePath } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";

import { animated, useSpring } from "@react-spring/web";

const userLanguage = navigator.language;
let citation_label_text = "";
if (userLanguage.startsWith("pt")) {
    citation_label_text = "Fontes";
} else if (userLanguage.startsWith("es")) {
    citation_label_text = "Fuentes";
} else {
    citation_label_text = "Sources";
}

let generating_answer_text = '';
if (userLanguage.startsWith('pt')) {
  generating_answer_text = 'Gerando resposta';
} else if (userLanguage.startsWith('es')) {
  generating_answer_text = 'Generando respuesta';
} else {
  generating_answer_text = 'Generating response';
}
interface Props {
    answer: AskResponse;
    isSelected?: boolean;
    onCitationClicked: (filePath: string, filename: string) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
    showSources?: boolean;
}

function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
        return str;
    }
    const startLength = Math.ceil((maxLength - 3) / 2);
    const endLength = Math.floor((maxLength - 3) / 2);
    return str.substring(0, startLength) + "..." + str.substring(str.length - endLength);
}

export const Answer = ({
    answer,
    isSelected,
    onCitationClicked,
    onThoughtProcessClicked,
    onSupportingContentClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    showSources
}: Props) => {
    const animatedStyles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 }
    });

    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, !!showSources, onCitationClicked), [answer]);

    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    if (answer.answer === "") {
        return (
            <animated.div style={{ ...animatedStyles }}>
                <Stack className={styles.answerContainer} verticalAlign="space-between">
                    <AnswerIcon />
                    <Stack.Item grow>
                        <p className={styles.answerText}>
                            {generating_answer_text}
                            <span className={styles.loadingdots} />
                        </p>
                    </Stack.Item>
                </Stack>
            </animated.div>
        );
    }

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div>
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "Lightbulb" }}
                            title="Show thought process"
                            ariaLabel="Show thought process"
                            onClick={() => onThoughtProcessClicked()}
                            disabled={!answer.thoughts}
                        />
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow className={styles.markdownContent}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: "#85a717", textDecoration: "none" }}>
                                {props.children}
                            </a>
                        )
                    }}
                >
                    {sanitizedAnswerHtml}
                </ReactMarkdown>
            </Stack.Item>

            {!!parsedAnswer.citations.length && showSources && (
                <Stack.Item>
                    <Stack id="Sources" horizontal wrap tokens={{ childrenGap: 5 }}>
                        <span className={styles.citationLearnMore}>{citation_label_text}:</span>
                        {parsedAnswer.citations.map((url, i) => {
                            const path = getFilePath(url);
                            if (!url.startsWith("https://") && !url.endsWith(".pdf") && !url.endsWith(".docx") && !url.endsWith(".doc")) {
                                url = "https://" + url;
                            }
                            return (
                                <>
                                    <div className={styles.citationContainer}>{`[${++i}]`}</div>
                                    <a
                                        onKeyDown={event => {
                                            if (event.key === "Enter") {
                                                onCitationClicked(url, path);
                                            }
                                        }}
                                        tabIndex={0}
                                        key={i}
                                        className={styles.citation}
                                        title={path}
                                        onClick={() => onCitationClicked(url, path)}
                                    >
                                        {`${truncateString(path, 15)}`}
                                    </a>
                                </>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}

            {!!parsedAnswer.followupQuestions.length && showFollowupQuestions && onFollowupQuestionClicked && (
                <Stack.Item>
                    <Stack horizontal wrap className={`${!!parsedAnswer.citations.length ? styles.followupQuestionsList : ""}`} tokens={{ childrenGap: 6 }}>
                        <span className={styles.followupQuestionLearnMore}>Follow-up questions:</span>
                        {parsedAnswer.followupQuestions.map((x, i) => {
                            return (
                                <a key={i} className={styles.followupQuestion} title={x} onClick={() => onFollowupQuestionClicked(x)}>
                                    {`${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}
        </Stack>
    );
};
