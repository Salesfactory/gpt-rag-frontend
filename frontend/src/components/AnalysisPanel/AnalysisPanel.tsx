import React, { Suspense, lazy } from "react";
import { Pivot, PivotItem } from "@fluentui/react";
import DOMPurify from "dompurify";
import styles from "./AnalysisPanel.module.css";
import { AskResponse } from "../../api";
import { AnalysisPanelTabs } from "./AnalysisPanelTabs";
import { getPage } from "../../utils/functions";
import { DismissCircleFilled } from "@fluentui/react-icons";
import { mergeStyles } from "@fluentui/react/lib/Styling";
import { Brain, BookOpen } from "lucide-react";
import { parseThoughts } from "./parseThoughts";

const LazyViewer = lazy(() => import("../DocView/DocView"));

interface Props {
    className: string;
    activeTab: AnalysisPanelTabs;
    onActiveTabChanged: (tab: AnalysisPanelTabs) => void;
    activeCitation: string | undefined;
    citationHeight: string;
    answer: AskResponse;
    fileType: string;
    onHideTab: () => void;
}

const pivotItemDisabledStyle = { disabled: true, style: { color: "grey" } };

const closeButtonStyle = {
    style: {
        backgroundColor: "transparent",
        color: "black",
        borderColor: "transparent",
        padding: "0px",
        position: "absolute",
        right: "0px",
        top: "0px",
        cursor: "pointer"
    }
};

interface ThoughtItem {
    title: string;
    value: string;
}

function formatContentBlocks(content: string): string {
    try {
        const formattedData: string[] = [];

        const subqueryRegex = /'documents': \[.*?\]/gs;
        const documentRegex = /\{.*?\}/gs;

        const subqueries = content.match(subqueryRegex);
        if (subqueries) {
            subqueries.forEach(subquery => {
                const documents = subquery.match(documentRegex);
                if (documents) {
                    documents.forEach(document => {
                        const contentMatch = document.match(/'content':\s*'(.*?)'/);
                        const titleMatch = document.match(/'title':\s*'(.*?)'/);
                        const sourceMatch = document.match(/'source':\s*'(.*?)'/);

                        let content = contentMatch ? contentMatch[1] : "";
                        const title = titleMatch ? titleMatch[1] : "";
                        const source = sourceMatch ? sourceMatch[1] : "";

                        if (!content.trim()) {
                            return;
                        }

                        content = content
                            .replace(/\\n/g, "\n\n")
                            .replace(/\.\s{2,}/g, ".\n\n")
                            .trim();

                        formattedData.push(`<b>Title</b>\n${title}\n\n<b>Content</b>\n${content}\n\n<b>Source</b>\n${source}`);
                    });
                }
            });
        }

        return formattedData.join("\n\n");
    } catch (error) {
        console.error("Error parsing content:", error);
        return "Invalid input format";
    }
}

function parseFormattedThoughts(html: string): ThoughtItem[] {
    if (!html || html.trim() === "") {
        return [];
    }

    const sections = html
        .split(/<hr \/><br \/><br \/>|<br \/><hr \/><br \/>/)
        .map(section => section.trim())
        .filter(section => section.length > 0);

    const items: ThoughtItem[] = [];

    let afterContent = false;
    sections.forEach(section => {
        let cleanSection = section
            .replace(/<hr \/>/g, "")
            .replace(/<br \/>/g, "\n")
            .replace(/(\d+)\\\./g, "$1.")
            .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
            .trim();

        if (cleanSection) {
            const colonIndex = cleanSection.indexOf(":");

            function cleanPotentialTitle(potentialTitle: string): string {
                if (potentialTitle.includes("title")) {
                    potentialTitle = potentialTitle
                        .replace(/title/gi, "")
                        .replace(/["',.]/g, "")
                        .trim();
                }
                return potentialTitle;
            }

            function extractContentDetails(value: string): string {
                const contentMatch = value.match(/Content:\s*(.*?)$/s);
                if (contentMatch) {
                    return contentMatch[1].replace(/\\n/g, "\n").trim();
                }
                return value;
            }

            function detectSubquery(value: string): boolean {
                return /subquery_1/i.test(value);
            }

            if (colonIndex > -1 && colonIndex < 100) {
                let potentialTitle = cleanSection.slice(0, colonIndex).trim();

                if (
                    potentialTitle === "Rewritten Query" ||
                    potentialTitle === "Required Retrieval" ||
                    potentialTitle === "Context Retrieved using the rewritten query"
                ) {
                    return;
                }
                if (potentialTitle === "Content") {
                    potentialTitle = "Context";
                }

                potentialTitle = cleanPotentialTitle(potentialTitle);

                if (potentialTitle.length < 80 && !potentialTitle.includes("\n") && !/^\d+\.\?\s/.test(potentialTitle)) {
                    const title = potentialTitle;
                    let value = cleanSection.slice(colonIndex + 1).trim();
                    if (detectSubquery(value)) {
                        value = formatContentBlocks(value);
                        afterContent = true;
                    } else {
                        value = extractContentDetails(value);
                    }
                    items.push({ title, value });
                } else {
                    items.push({ title: "", value: cleanSection });
                }
            } else {
                const analysisRegex = /###\s*Sales Factory Performance Analysis/i;
                if (analysisRegex.test(cleanSection)) {
                    const lines = cleanSection.split("\n").filter(line => line.trim() !== "");

                    let currentTitle = "";
                    let currentValue = "";

                    function pushItem() {
                        if (currentValue.trim()) {
                            items.push({ title: currentTitle, value: currentValue.trim() });
                            currentValue = "";
                        }
                    }

                    for (const line of lines) {
                        if (line.startsWith("### ") || line.startsWith("#### ")) {
                            pushItem();
                            currentTitle = line.replace(/#+\s*/, "").trim();
                        } else if (line.trim() === "---") {
                            pushItem();
                            currentTitle = "";
                        } else {
                            currentValue += line.replace(/\\/g, "") + "\n";
                        }
                    }
                    pushItem();
                } else {
                    const finalThoughtsRegex = /^\s*(#+\s*)?Final Thoughts:?/i;
                    if (finalThoughtsRegex.test(cleanSection.trim())) {
                        let match = cleanSection.trim().match(finalThoughtsRegex);
                        let prefix = match ? match[0].replace(/[:\s]+$/, "") : "Final Thoughts";
                        let value = cleanSection.trim().replace(finalThoughtsRegex, "").trim();

                        const formatted = extractContentDetails(value);
                        if (formatted) {
                            items.push({ title: "", value: formatted });
                        }
                    } else {
                        const formatted = extractContentDetails(cleanSection);
                        if (formatted) {
                            items.push({ title: "", value: formatted });
                        }
                    }
                }
            }
        }
    });

    return items;
}

export const AnalysisPanel = ({ answer, activeTab, activeCitation, citationHeight, className, onActiveTabChanged, fileType, onHideTab }: Props) => {
    const isDisabledThoughtProcessTab: boolean = !answer.thoughts;
    const isDisabledSupportingContentTab: boolean = !answer.data_points.length;
    const isDisabledCitationTab: boolean = !activeCitation;
    const page = getPage(answer.data_points.toString());
    let formattedThoughts = "";
    console.log("answer thought: ", answer.thoughts);
    let pensamientos = parseThoughts(answer.thoughts);
    console.log("Pensamientos: ", pensamientos);
    return (
        <>
            <Pivot
                className={className}
                selectedKey={activeTab}
                onLinkClick={pivotItem => pivotItem && onActiveTabChanged(pivotItem.props.itemKey! as AnalysisPanelTabs)}
                aria-label="Analysis Panel"
                styles={{
                    linkIsSelected: {
                        color: "#159244",
                        fontSize: "15px",
                        selectors: {
                            ":before": {
                                backgroundColor: "#008236"
                            },
                            ":hover": {
                                color: "#159244",
                                backgroundColor: "#f0fdf4"
                            }
                        }
                    }
                }}
            >
                <PivotItem
                    itemKey={AnalysisPanelTabs.ThoughtProcessTab}
                    headerButtonProps={{
                        className: styles.pivotItemWithBrainIcon,
                        ...(isDisabledThoughtProcessTab ? pivotItemDisabledStyle : {})
                    }}
                    aria-label="Thought Process Tab"
                    onRenderItemLink={() => (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Brain size={16} style={{ marginRight: 4 }} />
                            Thought Process
                        </span>
                    )}
                >
                    <div className={styles.thoughtProcess}>
                        {/* {thoughtItems.map((item, index) => (
                            <div
                                key={index}
                                style={{
                                    backgroundColor: "#f9fafb",
                                    padding: "12px",
                                    marginBottom: "10px",
                                    borderRadius: "6px"
                                }}
                            >
                                {item.title && (
                                    <h3
                                        style={{
                                            margin: "0 0 6px 0",
                                            color: "#333",
                                            fontWeight: "600",
                                            fontSize: "1rem"
                                        }}
                                    >
                                        {item.title}
                                    </h3>
                                )}
                                <p
                                    style={{
                                        margin: 0,
                                        color: "#555",
                                        whiteSpace: "pre-wrap",
                                        fontSize: "14px",
                                        lineHeight: "1.4"
                                    }}
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(item.value.split("<br />").join("<br />"))
                                    }}
                                />
                            </div>
                        ))} */}
                    </div>
                </PivotItem>

                <PivotItem
                    itemKey={AnalysisPanelTabs.CitationTab}
                    headerButtonProps={isDisabledCitationTab ? pivotItemDisabledStyle : undefined}
                    aria-label="Source Tab"
                    onRenderItemLink={() => (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <BookOpen size={16} style={{ marginRight: 4 }} />
                            Doc Preview
                        </span>
                    )}
                >
                    <Suspense fallback={<p>Loading...</p>}>
                        <LazyViewer base64Doc={activeCitation} page={page} fileType={fileType} />
                    </Suspense>
                </PivotItem>
                <PivotItem
                    // @ts-ignore
                    headerButtonProps={closeButtonStyle}
                    onRenderItemLink={() => (
                        <div
                            tabIndex={0}
                            onClick={onHideTab}
                            style={{
                                borderColor: "transparent",
                                cursor: "pointer",
                                backgroundColor: "transparent"
                            }}
                            aria-label="Close Panel Button"
                        >
                            <DismissCircleFilled
                                className={mergeStyles({
                                    fontSize: 35,
                                    padding: 0,
                                    marginTop: "16px"
                                })}
                            />
                        </div>
                    )}
                    aria-label="Close Panel Pivot Item"
                />
            </Pivot>
        </>
    );
};
