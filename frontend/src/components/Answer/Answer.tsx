import React, { useMemo } from "react";
import { Stack, IconButton } from "@fluentui/react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import styles from "./Answer.module.css";

import { AskResponse, getFilePath } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";

import { animated, useSpring } from "@react-spring/web";
import { useAppContext } from "../../providers/AppProviders";

const userLanguage = navigator.language;
let citation_label_text = "";
if (userLanguage.startsWith("pt")) {
    citation_label_text = "Fontes";
} else if (userLanguage.startsWith("es")) {
    citation_label_text = "Fuentes";
} else {
    citation_label_text = "Sources";
}

let generating_answer_text = "";
if (userLanguage.startsWith("pt")) {
    generating_answer_text = "Gerando resposta";
} else if (userLanguage.startsWith("es")) {
    generating_answer_text = "Generando respuesta";
} else {
    generating_answer_text = "Generating response";
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
    const { settings } = useAppContext();
    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);
    const Heading = ({ node, ...props }: any) => {
        const Tag = node.tagName as keyof JSX.IntrinsicElements;
        return <Tag style={headingStyle}>{props.children}</Tag>;
    };

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

    const fontFamily = settings.font_family?.trim() || "Arial";
    const fontSize = settings.font_size || 16;

    const baseTextStyle = {
        fontFamily,
        fontSize: `${fontSize}px`
    };

    const headingStyle = {
        ...baseTextStyle,
        fontWeight: "bold",
        marginTop: "12px",
        marginBottom: "8px"
    };

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

            <Stack.Item>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        h1: props => <Heading {...props} />,
                        h2: props => <Heading {...props} />,
                        h3: props => <Heading {...props} />,
                        h4: props => <Heading {...props} />,
                        h5: props => <Heading {...props} />,
                        h6: props => <Heading {...props} />,
                        p: ({ node, ...props }) => (
                            <p style={{ ...baseTextStyle, marginBottom: "8px", overflowWrap: "break-word", wordBreak: "break-word", maxWidth: "100%" }}>
                                {props.children}
                            </p>
                        ),
                        li: ({ node, ...props }) => (
                            <li style={{ ...baseTextStyle, marginBottom: "4px", overflowWrap: "break-word", wordBreak: "break-word", maxWidth: "100%" }}>
                                {props.children}
                            </li>
                        ),
                        a: ({ node, ...props }) => (
                            <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    ...baseTextStyle,
                                    color: "#85a717",
                                    textDecoration: "none",
                                    overflowWrap: "break-word",
                                    wordBreak: "break-word",
                                    maxWidth: "100%"
                                }}
                            >
                                {props.children}
                            </a>
                        ),
                        table: ({ node, ...props }) => (
                            <table
                                style={{
                                    ...baseTextStyle,
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    marginBottom: "16px"
                                }}
                            >
                                {props.children}
                            </table>
                        ),
                        thead: ({ node, ...props }) => <thead style={{ ...baseTextStyle, backgroundColor: "#f3f4f6" }}>{props.children}</thead>,
                        th: ({ node, ...props }) => (
                            <th
                                style={{
                                    ...baseTextStyle,
                                    padding: "8px",
                                    border: "1px solid #d1d5db",
                                    fontWeight: "bold",
                                    textAlign: "left",
                                    overflowWrap: "break-word",
                                    wordBreak: "break-word",
                                    maxWidth: "100%"
                                }}
                            >
                                {props.children}
                            </th>
                        ),
                        tbody: ({ node, ...props }) => <tbody style={baseTextStyle}>{props.children}</tbody>,
                        tr: ({ node, ...props }) => <tr style={{ ...baseTextStyle, borderBottom: "1px solid #e5e7eb" }}>{props.children}</tr>,
                        td: ({ node, ...props }) => (
                            <td
                                style={{
                                    ...baseTextStyle,
                                    padding: "8px",
                                    border: "1px solid #d1d5db",
                                    overflowWrap: "break-word",
                                    wordBreak: "break-word",
                                    maxWidth: "100%"
                                }}
                            >
                                {props.children}
                            </td>
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
                            const fullUrl =
                                !url.startsWith("https://") && !url.endsWith(".pdf") && !url.endsWith(".docx") && !url.endsWith(".doc")
                                    ? "https://" + url
                                    : url;
                            return (
                                <React.Fragment key={i}>
                                    <div className={styles.citationContainer}>{`[${i + 1}]`}</div>
                                    <a
                                        onKeyDown={event => {
                                            if (event.key === "Enter") {
                                                onCitationClicked(fullUrl, path);
                                            }
                                        }}
                                        tabIndex={0}
                                        className={styles.citation}
                                        title={path}
                                        onClick={() => onCitationClicked(fullUrl, path)}
                                    >
                                        {truncateString(path, 15)}
                                    </a>
                                </React.Fragment>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}

            {!!parsedAnswer.followupQuestions.length && showFollowupQuestions && onFollowupQuestionClicked && (
                <Stack.Item>
                    <Stack horizontal wrap className={parsedAnswer.citations.length ? styles.followupQuestionsList : ""} tokens={{ childrenGap: 6 }}>
                        <span className={styles.followupQuestionLearnMore}>Follow-up questions:</span>
                        {parsedAnswer.followupQuestions.map((x, i) => (
                            <a key={i} className={styles.followupQuestion} title={x} onClick={() => onFollowupQuestionClicked(x)}>
                                {x}
                            </a>
                        ))}
                    </Stack>
                </Stack.Item>
            )}
        </Stack>
    );
};
