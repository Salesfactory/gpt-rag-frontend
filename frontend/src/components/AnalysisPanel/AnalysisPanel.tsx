import React, { Suspense, lazy, useState, useEffect } from "react";
import { Pivot, PivotItem } from "@fluentui/react";
import DOMPurify from "dompurify";
import styles from "./AnalysisPanel.module.css";
import { SupportingContent } from "../SupportingContent";
import { AskResponse } from "../../api";
import { AnalysisPanelTabs } from "./AnalysisPanelTabs";
import { getPage, getFileType } from "../../utils/functions";
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
                const formattedInternalContent = thoughtsWithBreaks.replace(/\s*==============================================\s*/g, "<br /><br />");
                formattedThoughts = formattedInternalContent.replace(/ \/ /g, "<br /><hr /><br />");

            } else {
                // Fallback if parsing failed or structure is unexpected: treat as plain text and apply basic formatting
                console.warn("Could not parse thoughts as JSON or structure was unexpected. Falling back to plain text formatting.");
                const sanitizedThoughts = DOMPurify.sanitize(answer.thoughts);
                const thoughtsWithBreaks = sanitizedThoughts.replace(/\n/g, "<br />");
                const formattedInternalContent = thoughtsWithBreaks.replace(/\s*==============================================\s*/g, "<br /><br />");
                formattedThoughts = formattedInternalContent.replace(/ \/ /g, "<br /><hr /><br />");
            }
        }
    } catch (error) {
        // Fallback if JSON parsing completely fails: treat as plain text and apply basic formatting
        console.error("Error parsing thoughts JSON:", error);
        const sanitizedThoughts = DOMPurify.sanitize(answer.thoughts || "");
        const thoughtsWithBreaks = sanitizedThoughts.replace(/\n/g, "<br />");
        const formattedInternalContent = thoughtsWithBreaks.replace(/\s*==============================================\s*/g, "<br /><br />");
        formattedThoughts = formattedInternalContent.replace(/ \/ /g, "<br /><hr /><br />");
    }


    return (
        <>
            <Pivot
                className={className}
                selectedKey={activeTab}
                onLinkClick={pivotItem => pivotItem && onActiveTabChanged(pivotItem.props.itemKey! as AnalysisPanelTabs)}
                aria-label="Analysis Panel"
            >
                <PivotItem
                    itemKey={AnalysisPanelTabs.ThoughtProcessTab}
                    headerText="Thought process"
                    headerButtonProps={isDisabledThoughtProcessTab ? pivotItemDisabledStyle : undefined}
                    aria-label="Thought Process Tab"
                >
                    <div className={styles.thoughtProcess} dangerouslySetInnerHTML={{ __html: formattedThoughts }}></div>
                </PivotItem>

                <PivotItem
                    itemKey={AnalysisPanelTabs.CitationTab}
                    headerText="Source"
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
