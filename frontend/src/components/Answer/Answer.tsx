import React, { useMemo, useState, useEffect } from "react";
import { Stack, IconButton, TooltipHost } from "@fluentui/react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import styles from "./Answer.module.css";

import { AskResponse, getFilePath, getFeedbackUrl } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { URLPreviewComponent } from "../URLPreviewComponent";
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
    generating_answer_text = "Processing Query...";
}

interface ProgressState {
    step: string;
    message: string;
    progress?: number;
    timestamp?: number;
}
interface Props {
    answer: AskResponse;
    isSelected?: boolean;
    isGenerating?: boolean;
    progressState?: ProgressState | null;
    loadingCitationPath?: string | null;
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

const MarkdownHeading: React.FC<{ level: keyof JSX.IntrinsicElements; style: React.CSSProperties; children: React.ReactNode }> = ({
    level: Tag,
    style,
    children
}) => <Tag style={style}>{children}</Tag>;

export const Answer = ({
    answer,
    isGenerating,
    isSelected,
    progressState,
    loadingCitationPath,
    onCitationClicked,
    onThoughtProcessClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    showSources
}: Props) => {
    const animatedStyles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 }
    });

    const { settings } = useAppContext();
    const fontFamily = settings.font_family?.trim() || "Arial";
    const fontSize = settings.font_size || 16;
    const baseTextStyle = useMemo(() => ({ fontFamily, fontSize: `${fontSize}px` }), [fontFamily, fontSize]);
    const headingStyle = {
        ...baseTextStyle,
        fontWeight: "bold",
        marginTop: "20px",
        marginBottom: "16px"
    };
    const components = useMemo(
        () => ({
            h1: (props: any) => <MarkdownHeading level="h1" style={headingStyle} {...props} />,
            h2: (props: any) => <MarkdownHeading level="h2" style={headingStyle} {...props} />,
            h3: (props: any) => <MarkdownHeading level="h3" style={headingStyle} {...props} />,
            h4: (props: any) => <MarkdownHeading level="h4" style={headingStyle} {...props} />,
            h5: (props: any) => <MarkdownHeading level="h5" style={headingStyle} {...props} />,
            h6: (props: any) => <MarkdownHeading level="h6" style={headingStyle} {...props} />,
            img: (props: any) => <URLPreviewComponent url={props.src} alt={props.alt} isGenerating={isGenerating} />,
            p: (props: any) => (
                <p style={{ ...baseTextStyle, marginBottom: "8px", overflowWrap: "break-word", wordBreak: "break-word", maxWidth: "100%" }}>{props.children}</p>
            ),
            li: (props: any) => (
                <li style={{ ...baseTextStyle, marginBottom: "4px", overflowWrap: "break-word", wordBreak: "break-word", maxWidth: "100%" }}>
                    {props.children}
                </li>
            ),
            a: (props: any) => (
                <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        ...baseTextStyle,
                        color: "#0E7C3A",
                        textDecoration: "none",
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                        maxWidth: "100%"
                    }}
                >
                    {props.children}
                </a>
            ),
            table: (props: any) => (
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
            thead: (props: any) => <thead style={{ ...baseTextStyle, backgroundColor: "#f3f4f6" }}>{props.children}</thead>,
            th: (props: any) => (
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
            tbody: (props: any) => <tbody style={baseTextStyle}>{props.children}</tbody>,
            tr: (props: any) => <tr style={{ ...baseTextStyle, borderBottom: "1px solid #e5e7eb" }}>{props.children}</tr>,
            td: (props: any) => (
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
        }),
        [baseTextStyle, headingStyle]
    );
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, !!showSources, onCitationClicked), [answer]);
    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    const handleFeedbackClick = async () => {
        try {
            const feedbackUrl = await getFeedbackUrl();
            if (feedbackUrl) {
                window.open(feedbackUrl, "_blank", "noopener,noreferrer");
            } else {
                console.warn("Feedback URL not configured");
            }
        } catch (error) {
            console.error("Error getting feedback URL:", error);
        }
    };

    // Show fallback loading when no content and no progress state
    if (answer.answer === "" && !progressState && isGenerating) {
        return (
            <Stack className={styles.answerContainer} verticalAlign="space-between">
                <AnswerIcon />
                <Stack.Item grow>
                    <p className={styles.answerText}>
                        {generating_answer_text}
                        <span className={styles.loadingdots} />
                    </p>
                </Stack.Item>
            </Stack>
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

            {progressState && (
                <Stack.Item>
                    <div className={styles.progressContainer}>
                        <p className={styles.progressMessage}>{progressState.message}</p>
                        {progressState.progress !== undefined && (
                            <div className={styles.progressBarContainer}>
                                <div className={styles.progressBar} style={{ width: `${progressState.progress}%` }} />
                            </div>
                        )}
                        <span className={styles.loadingdots} />
                    </div>
                </Stack.Item>
            )}

            <Stack.Item>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
                    {sanitizedAnswerHtml}
                </ReactMarkdown>
            </Stack.Item>

            {!!parsedAnswer.citations.length && showSources && (
                <Stack.Item>
                    <Stack id="Sources" horizontal wrap tokens={{ childrenGap: 5 }} data-cy="sources-section">
                        <span className={styles.citationLearnMore}>{citation_label_text}:</span>
                        {parsedAnswer.citations.map((url, i) => {
                            const path = getFilePath(url);
                            const fullUrl =
                                !url.startsWith("https://") && !url.endsWith(".pdf") && !url.endsWith(".docx") && !url.endsWith(".doc")
                                    ? "https://" + url
                                    : url;
                            const isLoadingThis = loadingCitationPath === path;
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
                                        onClick={() => {
                                            if (!isLoadingThis) onCitationClicked(fullUrl, path);
                                        }}
                                        aria-busy={isLoadingThis ? "true" : undefined}
                                        aria-disabled={isLoadingThis ? "true" : undefined}
                                        data-loading={isLoadingThis ? "true" : undefined}
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

            <Stack.Item>
                <div className={styles.feedbackButtonRow}>
                    <TooltipHost content="Leave Feedback">
                        <button
                            className={styles.feedbackButton}
                            onClick={handleFeedbackClick}
                            aria-label="Leave Feedback"
                            title="Leave Feedback"
                        >
                            <IconButton
                                iconProps={{ iconName: "Feedback" }}
                                styles={{
                                    root: { 
                                        background: 'transparent', 
                                        border: 'none',
                                        minWidth: 'auto',
                                        width: 'auto',
                                        height: 'auto',
                                        padding: 0
                                    },
                                    icon: { 
                                        color: 'inherit',
                                        fontSize: '16px'
                                    }
                                }}
                            />
                        </button>
                    </TooltipHost>
                </div>
            </Stack.Item>
        </Stack>
    );
};
