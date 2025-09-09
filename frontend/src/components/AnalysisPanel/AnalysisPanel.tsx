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
import { rawThoughtsToString, extractPreContent, parseMeta, toPlainText, sourcePlain } from "../../utils/formattingUtils";

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
    let thoughts = parseThoughts(answer.thoughts);

    const preContent = extractPreContent(rawThoughtsToString(answer.thoughts));
    const meta = parseMeta(preContent);
    const hasAnyMeta = Object.values(meta).some(Boolean);

    const filteredThoughts = (thoughts || []).filter((thought: any) => {
        const title = toPlainText(thought?.title).toLowerCase();
        return !title.includes("assistant");
    });

    // Helpers to sanitize and render sources
    const toHref = (val: unknown): string | null => {
        const s = sourcePlain(val);
        if (!s) return null;
        if (/^https?:\/\//i.test(s)) return s;
        if (/^www\./i.test(s)) return `https://${s}`;
        if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(s)) return `https://${s}`;
        return null;
    };
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
                        {hasAnyMeta && (
                            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                                {meta.modelUsed && (
                                    <section className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>Model Used</h4>
                                        <p className={styles.contentCard}>{meta.modelUsed}</p>
                                    </section>
                                )}
                                {meta.mcpToolUsed && (
                                    <section className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>Tool Used</h4>
                                        <p className={styles.contentCard}>{toPlainText(meta.mcpToolUsed)}</p>
                                    </section>
                                )}
                                {meta.originalQuery && (
                                    <section className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>Original Query</h4>
                                        <p className={styles.contentCard}>{toPlainText(meta.originalQuery)}</p>
                                    </section>
                                )}
                                {meta.toolSelected && (
                                    <section className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>Prompt Instruction Type</h4>
                                        <p className={styles.contentCard}>{toPlainText(meta.toolSelected)}</p>
                                    </section>
                                )}
                                {meta.mcpToolsUsed && (
                                    <section className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>MCP Tools Used</h4>
                                        <p className={styles.contentCard}>{toPlainText(meta.mcpToolsUsed)}</p>
                                    </section>
                                )}
                            </div>
                        )}
                        {filteredThoughts &&
                            filteredThoughts.length > 0 &&
                            filteredThoughts.map((p: any, index: number) => (
                                <div
                                    key={index}
                                    style={{
                                        backgroundColor: "#f9fafb",
                                        padding: "12px",
                                        marginBottom: "10px",
                                        borderRadius: "6px"
                                    }}
                                >
                                    {p.title && (
                                        <h3
                                            style={{
                                                margin: "0 0 6px 0",
                                                color: "#333",
                                                fontWeight: 600,
                                                fontSize: "1rem"
                                            }}
                                        >
                                            {toPlainText(p.title)}
                                        </h3>
                                    )}
                                    <p
                                        style={{
                                            margin: 0,
                                            color: "#555",
                                            whiteSpace: "pre-wrap",
                                            fontSize: "14px",
                                            lineHeight: 1.4
                                        }}
                                    >
                                        {toPlainText(p.content)}
                                    </p>
                                    {(p.sources || p.source) && (
                                        <div
                                            style={{
                                                marginTop: 8,
                                                color: "#6b7280",
                                                fontSize: 12
                                            }}
                                        >
                                            Source:{" "}
                                            {Array.isArray(p.sources || p.source) ? (
                                                <ul style={{ margin: "4px 0 0 16px" }}>
                                                    {(p.sources || p.source).map((s: unknown, i: number) => {
                                                        const href = toHref(s);
                                                        const label = sourcePlain(s);
                                                        return (
                                                            <li key={i} style={{ marginBottom: 2 }}>
                                                                {href ? (
                                                                    <a href={href} target="_blank" rel="noreferrer noopener" style={{ color: "#2563eb" }}>
                                                                        {label}
                                                                    </a>
                                                                ) : (
                                                                    <span>{label}</span>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            ) : (
                                                (() => {
                                                    const single = (p.sources || p.source) as unknown;
                                                    const href = toHref(single);
                                                    const label = sourcePlain(single);
                                                    return href ? (
                                                        <a href={href} target="_blank" rel="noreferrer noopener" style={{ color: "#2563eb" }}>
                                                            {label}
                                                        </a>
                                                    ) : (
                                                        <span>{label}</span>
                                                    );
                                                })()
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
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
