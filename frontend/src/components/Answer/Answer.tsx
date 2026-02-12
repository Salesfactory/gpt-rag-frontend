import React, { useMemo, useState, useEffect } from "react";
import { Stack, IconButton, TooltipHost } from "@fluentui/react";
import DOMPurify from "dompurify";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import styles from "./Answer.module.css";

import { AskResponse, getFilePath, getFeedbackUrl } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { URLPreviewComponent } from "../URLPreviewComponent";
import { AnswerIcon } from "./AnswerIcon";
import {
    getCitationAriaLabel,
    getCitationDisplayName,
    getCitationKind,
    getFaviconUrl,
    getFileTypeIconKey,
    getFileTypeIconLabel,
    toCitationLinkTarget
} from "../../utils/citationUtils";

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
    generating_answer_text = "Processing Query";
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
    thinkingContent?: string;
    loadingCitationPath?: string | null;
    onCitationClicked: (filePath: string, filename: string) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
    showSources?: boolean;
}

const MarkdownHeading: React.FC<{ level: keyof JSX.IntrinsicElements; style: React.CSSProperties; children: React.ReactNode }> = ({
    level: Tag,
    style,
    children
}) => <Tag style={style}>{children}</Tag>;

interface SourceChipIconProps {
    citation: string;
}

const SourceChipIcon: React.FC<SourceChipIconProps> = ({ citation }) => {
    const [faviconFailed, setFaviconFailed] = useState(false);
    const kind = getCitationKind(citation);
    const faviconUrl = kind === "web" && !faviconFailed ? getFaviconUrl(citation) : null;
    const iconKey = getFileTypeIconKey(citation);
    const iconLabel = getFileTypeIconLabel(iconKey);

    if (faviconUrl) {
        return (
            <img
                src={faviconUrl}
                alt=""
                width={16}
                height={16}
                className={styles.sourceChipIcon}
                loading="lazy"
                aria-hidden="true"
                onError={() => setFaviconFailed(true)}
            />
        );
    }

    return (
        <span className={`${styles.sourceChipIcon} ${styles.fileTypeIcon}`} data-icon={iconKey} aria-hidden="true">
            {iconLabel}
        </span>
    );
};

export const Answer = ({
    answer,
    isGenerating,
    isSelected,
    progressState,
    thinkingContent,
    loadingCitationPath,
    onCitationClicked,
    onThoughtProcessClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    showSources
}: Props) => {
    const markdownContainerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = markdownContainerRef.current;
        if (!container) return;

        const handleCitationClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const citationLink = target.closest(".supContainer");

            if (citationLink) {
                e.preventDefault();
                const url = citationLink.getAttribute("data-citation-url");
                const path = citationLink.getAttribute("data-citation-path");

                if (url && path) {
                    onCitationClicked(url, path);
                }
            }
        };

        const handleCitationKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                const target = e.target as HTMLElement;
                const citationLink = target.closest(".supContainer");

                if (citationLink) {
                    e.preventDefault();
                    const url = citationLink.getAttribute("data-citation-url");
                    const path = citationLink.getAttribute("data-citation-path");

                    if (url && path) {
                        onCitationClicked(url, path);
                    }
                }
            }
        };

        container.addEventListener("click", handleCitationClick);
        container.addEventListener("keydown", handleCitationKeyDown);
        return () => {
            container.removeEventListener("click", handleCitationClick);
            container.removeEventListener("keydown", handleCitationKeyDown);
        };
    }, [onCitationClicked]);

    const { settings } = useAppContext();
    const fontFamily = settings.font_family?.trim() || "Arial";
    const fontSize = settings.font_size || 16;
    const baseTextStyle = useMemo(() => ({ fontFamily, fontSize: `${fontSize}px`, lineHeight: 1.625 }), [fontFamily, fontSize]);
    const headingStyle = {
        ...baseTextStyle,
        fontWeight: "bold",
        lineHeight: 1.625,
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
            img: (props: any) => {
                const src = typeof props.src === "string" ? props.src : "";
                const className = typeof props.className === "string" ? props.className : "";
                const isInlineCitationIcon = className.includes("citationInlineIcon") || /google\.com\/s2\/favicons/i.test(src);

                if (isInlineCitationIcon) {
                    return (
                        <img
                            src={src}
                            alt={props.alt || ""}
                            className={className}
                            width={props.width}
                            height={props.height}
                            loading={props.loading || "lazy"}
                            aria-hidden={props["aria-hidden"]}
                            style={props.style}
                        />
                    );
                }

                return <URLPreviewComponent url={src} alt={props.alt} isGenerating={isGenerating} />;
            },
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
                        maxWidth: "100%",
                        lineHeight: 1.625
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
                        maxWidth: "100%",
                        lineHeight: 1.625
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
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, !!showSources, onCitationClicked), [answer.answer, onCitationClicked, showSources]);
    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    const thoughtNodes = useMemo(() => {
        if (!thinkingContent || thinkingContent.trim().length === 0) {
            return [];
        }

        // Helper function to split text into sentences
        const splitIntoSentences = (text: string): string[] => {
            // Common abbreviations that shouldn't trigger sentence splits
            const abbreviations = /(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp|U\.S|Ph\.D)\./gi;

            // Temporarily replace abbreviations with placeholders
            const placeholders: string[] = [];
            let processed = text.replace(abbreviations, match => {
                placeholders.push(match);
                return `__ABBR_${placeholders.length - 1}__`;
            });

            // Now split on sentence boundaries
            const sentences = processed.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 0);

            // Restore abbreviations
            return sentences.map(sentence => {
                return sentence.replace(/__ABBR_(\d+)__/g, (_, index) => {
                    return placeholders[parseInt(index)];
                });
            });
        };

        const parseThinkingIntoNodes = (content: string): string[] => {
            const MIN_THOUGHT_LENGTH = 80; // Minimum characters for a thought node

            // Split by double line breaks first (paragraphs)
            let thoughts = content.split(/\n\n+/).filter(t => t.trim().length > 0);

            // For very long paragraphs, split by sentence groups (2-3 sentences at a time)
            thoughts = thoughts.flatMap(thought => {
                if (thought.length > 500) {
                    // Split into sentences using improved function
                    const sentences = splitIntoSentences(thought);
                    const groups: string[] = [];
                    let currentGroup = "";

                    for (let i = 0; i < sentences.length; i++) {
                        const sentence = sentences[i].trim();
                        if (currentGroup.length === 0) {
                            currentGroup = sentence;
                        } else if (currentGroup.length + sentence.length < 400) {
                            // Add to current group if not too long
                            // Check if previous sentence already has ending punctuation
                            const separator = /[.!?]$/.test(currentGroup) ? " " : ". ";
                            currentGroup += separator + sentence;
                        } else {
                            // Start new group
                            groups.push(currentGroup);
                            currentGroup = sentence;
                        }
                    }
                    if (currentGroup) groups.push(currentGroup);
                    return groups;
                }
                return [thought];
            });

            // Merge very short thoughts with adjacent ones
            const merged: string[] = [];
            for (let i = 0; i < thoughts.length; i++) {
                const thought = thoughts[i].trim();

                if (thought.length < MIN_THOUGHT_LENGTH && merged.length > 0) {
                    // Merge with previous thought
                    merged[merged.length - 1] += " " + thought;
                } else if (thought.length < MIN_THOUGHT_LENGTH && i < thoughts.length - 1) {
                    // Merge with next thought
                    thoughts[i + 1] = thought + " " + thoughts[i + 1];
                } else {
                    merged.push(thought);
                }
            }

            return merged.map(t => t.trim());
        };

        return parseThinkingIntoNodes(thinkingContent);
    }, [thinkingContent]);

    const thinkingMarkdownComponents: Partial<Components> = {
        p: props => <p style={{ margin: 0, display: "inline" }} {...props} />,
        code: props => <code style={{ background: "#f3f4f6", padding: "2px 4px", borderRadius: "4px", fontSize: "0.9em" }} {...props} />
    };

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
                <div className={styles.loadingState}>
                    <div className={styles.loadingIconWrapper}>
                        <AnswerIcon />
                    </div>
                    <div className={styles.loadingTextWrapper}>
                        <span className={styles.loadingText}>{generating_answer_text}</span>
                        <div className={styles.loadingDots}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
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

            {thoughtNodes.length > 0 && (
                <Stack.Item>
                    <details className={styles.thinkingContainer} open={isGenerating}>
                        <summary className={styles.thinkingSummary}>Pro-Active's Thinking Process</summary>
                        <div className={styles.thoughtStream}>
                            {thoughtNodes.map((thought, index) => (
                                <div key={index} className={styles.thoughtNode} style={{ animationDelay: `${index * 0.1}s` }}>
                                    <div className={styles.thoughtConnector}>
                                        <div className={styles.thoughtDot} />
                                        {index < thoughtNodes.length - 1 && <div className={styles.thoughtLine} />}
                                    </div>
                                    <div className={styles.thoughtCard}>
                                        <div className={styles.thoughtText}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={thinkingMarkdownComponents}>
                                                {thought.endsWith(".") ? thought : thought + "."}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>
                </Stack.Item>
            )}

            <Stack.Item>
                <div ref={markdownContainerRef}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
                        {sanitizedAnswerHtml}
                    </ReactMarkdown>
                </div>
            </Stack.Item>

            {!!parsedAnswer.citations.length && showSources && (
                <Stack.Item>
                    <Stack id="Sources" horizontal wrap tokens={{ childrenGap: 8 }} className={styles.sourcesRow} data-cy="sources-section">
                        <span className={styles.citationLearnMore}>{citation_label_text}:</span>
                        {parsedAnswer.citations.map((url, i) => {
                            const path = getFilePath(url);
                            const fullUrl = toCitationLinkTarget(url);
                            const isLoadingThis = loadingCitationPath === path;
                            const displayName = getCitationDisplayName(url);
                            const sourceText = displayName || path;
                            const ariaLabel = getCitationAriaLabel(i + 1, url);
                            return (
                                <a
                                    key={i}
                                    onKeyDown={event => {
                                        if (event.key === "Enter") {
                                            onCitationClicked(fullUrl, path);
                                        }
                                    }}
                                    tabIndex={0}
                                    className={styles.sourceChip}
                                    title={sourceText || path.split("/").filter(Boolean).pop() || path}
                                    onClick={() => {
                                        if (!isLoadingThis) onCitationClicked(fullUrl, path);
                                    }}
                                    aria-label={ariaLabel}
                                    aria-busy={isLoadingThis ? "true" : undefined}
                                    aria-disabled={isLoadingThis ? "true" : undefined}
                                    data-loading={isLoadingThis ? "true" : undefined}
                                >
                                    <span className={styles.sourceChipIndex}>{`[${i + 1}]`}</span>
                                    <SourceChipIcon citation={url} />
                                    <span className={styles.sourceChipLabel}>{sourceText || path}</span>
                                </a>
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
                <div className={styles.feedbackButtonRow} data-cy="feedback-button-row">
                    <TooltipHost content="Leave Feedback">
                        <button
                            className={styles.feedbackButton}
                            onClick={handleFeedbackClick}
                            aria-label="Leave Feedback"
                            title="Leave Feedback"
                            data-cy="feedback-button"
                        >
                            <IconButton
                                aria-hidden="true"
                                iconProps={{ iconName: "Feedback" }}
                                styles={{
                                    root: {
                                        background: "transparent",
                                        border: "none",
                                        minWidth: "auto",
                                        width: "auto",
                                        height: "auto",
                                        padding: 0
                                    },
                                    icon: {
                                        color: "inherit",
                                        fontSize: "16px"
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
