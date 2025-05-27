import React, { Suspense, lazy } from "react";
import { Pivot, PivotItem } from "@fluentui/react";
import DOMPurify from "dompurify";
import styles from "./AnalysisPanel.module.css";
import { AskResponse } from "../../api";
import { AnalysisPanelTabs } from "./AnalysisPanelTabs";
import { getPage } from "../../utils/functions";
import { DismissCircleFilled } from "@fluentui/react-icons";
import { mergeStyles } from "@fluentui/react/lib/Styling";

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

function parseFormattedThoughts(html: string): ThoughtItem[] {
    if (!html || html.trim() === "") {
        return [];
    }

    const sections = html
        .split(/<hr \/><br \/><br \/>|<br \/><hr \/><br \/>/)
        .map(section => section.trim())
        .filter(section => section.length > 0);

    const items: ThoughtItem[] = [];

    sections.forEach(section => {
        let cleanSection = section
            .replace(/<hr \/>/g, "")
            .replace(/<br \/>/g, "\n")
            .replace(/(\d+)\\\./g, "$1.")
            .trim();

        if (cleanSection) {
            const colonIndex = cleanSection.indexOf(":");

            if (colonIndex > -1 && colonIndex < 100) {
                const potentialTitle = cleanSection.slice(0, colonIndex).trim();

                if (potentialTitle.length < 80 && !potentialTitle.includes("\n") && !/^\d+\.?\s/.test(potentialTitle)) {
                    const title = potentialTitle;
                    const value = cleanSection.slice(colonIndex + 1).trim();
                    items.push({ title, value });
                } else {
                    items.push({ title: "", value: cleanSection });
                }
            } else {
                items.push({ title: "", value: cleanSection });
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
    try {
        if (answer.thoughts) {
            // Attempt to parse the entire string as JSON
            const thoughtData = JSON.parse(answer.thoughts);

            // Check if it has the expected structure with a "thoughts" array
            if (thoughtData && Array.isArray(thoughtData.thoughts) && thoughtData.thoughts.length > 0) {
                // Extract the first element of the thoughts array
                let rawThoughts = thoughtData.thoughts[0] || "";

                // Sanitize the extracted thought string
                const sanitizedThoughts = DOMPurify.sanitize(rawThoughts);

                // Format the string: newlines and separators
                const thoughtsWithBreaks = sanitizedThoughts.replace(/\n/g, "<br />");
                const formattedInternalContent = thoughtsWithBreaks
                    .replace(/\s*==============================================\s*/g, "<hr />")
                    .replace(/\s*#\s*/g, "<hr /><br />");
                formattedThoughts = formattedInternalContent.replace(/ \/ /g, "<br /><hr /><br />");
            } else {
                // Fallback if parsing failed or structure is unexpected: treat as plain text and apply basic formatting
                console.warn("Could not parse thoughts as JSON or structure was unexpected. Falling back to plain text formatting.");
                const sanitizedThoughts = DOMPurify.sanitize(answer.thoughts);
                const thoughtsWithBreaks = sanitizedThoughts.replace(/\n/g, "<br />");
                const formattedInternalContent = thoughtsWithBreaks
                    .replace(/\s*==============================================\s*/g, "<hr />")
                    .replace(/\s*#\s*/g, "<hr /><br />");
                formattedThoughts = formattedInternalContent.replace(/ \/ /g, "<br /><hr /><br />");
            }
        }
    } catch (error) {
        // Fallback if JSON parsing completely fails: treat as plain text and apply basic formatting
        console.error("Error parsing thoughts JSON:", error);
        const sanitizedThoughts = DOMPurify.sanitize(answer.thoughts || "");
        const thoughtsWithBreaks = sanitizedThoughts.replace(/\n/g, "<br />");
        const formattedInternalContent = thoughtsWithBreaks
            .replace(/\s*==============================================\s*/g, "<hr />")
            .replace(/\s*#\s*/g, "<hr /><br />");
        formattedThoughts = formattedInternalContent.replace(/ \/ /g, "<br /><hr /><br />");
    }
    console.log("formattedThoughts", formattedThoughts);
    const thoughtItems = parseFormattedThoughts(formattedThoughts);
    console.log("texto formateado mi funcion para imprimirlo: ", thoughtItems);
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
                    headerText="Thought Process"
                    headerButtonProps={{
                        className: styles.pivotItemWithBrainIcon,
                        ...(isDisabledThoughtProcessTab ? pivotItemDisabledStyle : {})
                    }}
                    aria-label="Thought Process Tab"
                >
                    <div className={styles.thoughtProcess}>
                        {thoughtItems.map((item, index) => (
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
                                >
                                    {item.value.split("<br />").map((line, i) => (
                                        <React.Fragment key={i}>
                                            {line}
                                            <br />
                                        </React.Fragment>
                                    ))}
                                </p>
                            </div>
                        ))}
                    </div>
                </PivotItem>

                <PivotItem
                    itemKey={AnalysisPanelTabs.CitationTab}
                    headerText="Doc Preview"
                    headerButtonProps={isDisabledCitationTab ? pivotItemDisabledStyle : undefined}
                    aria-label="Source Tab"
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
