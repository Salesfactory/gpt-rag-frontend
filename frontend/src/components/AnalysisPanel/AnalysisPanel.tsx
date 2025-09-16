import React, { Suspense, lazy } from "react";
import { Pivot, PivotItem } from "@fluentui/react";
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
    spreadsheetDownloadUrl?: string;
    spreadsheetFileName?: string;
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

export const AnalysisPanel = ({ answer, activeTab, activeCitation, citationHeight, className, onActiveTabChanged, fileType, onHideTab, spreadsheetDownloadUrl, spreadsheetFileName }: Props) => {
    const isDisabledThoughtProcessTab: boolean = !answer.thoughts;
    const isDisabledCitationTab: boolean = !activeCitation;
    const page = getPage(answer.data_points.toString());
    let thoughts = parseThoughts(answer.thoughts);

    const preContent = extractPreContent(rawThoughtsToString(answer.thoughts));
    const meta = parseMeta(preContent);
    const agentType = meta.mcpToolUsed || meta.mcpToolsUsed;
    const hasAnyMeta = !!(meta.modelUsed || agentType || meta.toolSelected); // only show meta section if the agent type is available

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
                                {agentType && (
                                    <section className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>Agent Type</h4>
                                        <p className={styles.contentCard}>{toPlainText(agentType)}</p>
                                    </section>
                                )}
                                {meta.toolSelected && (
                                    <section className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>Tool Used</h4>
                                        <p className={styles.contentCard}>{toPlainText(meta.toolSelected)}</p>
                                    </section>
                                )}
                            </div>
                        )}
                        {agentType &&
                            filteredThoughts &&
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
                    {fileType?.toLowerCase() === "spreadsheet-embed" && activeCitation ? (
                        <div style={{ height: citationHeight, display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                                <div style={{ fontSize: 14, color: "#111827" }}>{spreadsheetFileName || "Excel Preview"}</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {spreadsheetDownloadUrl && (
                                        <a
                                            href={spreadsheetDownloadUrl}
                                            download={spreadsheetFileName || true}
                                            style={{
                                                fontSize: 13,
                                                padding: "6px 10px",
                                                background: "#fff",
                                                border: "1px solid #d1d5db",
                                                borderRadius: 6,
                                                color: "#111827",
                                                textDecoration: "none"
                                            }}
                                        >
                                            Download
                                        </a>
                                    )}
                                </div>
                            </div>
                            <iframe
                                title={spreadsheetFileName || "Excel Preview"}
                                src={activeCitation}
                                style={{ border: 0, width: "100%", flex: 1 }}
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <Suspense fallback={<p>Loading...</p>}>
                            <LazyViewer base64Doc={activeCitation} page={page} fileType={fileType} />
                        </Suspense>
                    )}
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
