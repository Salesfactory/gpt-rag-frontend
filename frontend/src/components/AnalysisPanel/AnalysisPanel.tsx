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
import { rawThoughtsToString, extractPreContent, parseMeta, toPlainText, sourcePlain, extractContextDocs } from "../../utils/formattingUtils";

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
    onCitationClicked?: (citation: string, fileName: string) => void;
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

export const AnalysisPanel = ({ answer, activeTab, activeCitation, citationHeight, className, onActiveTabChanged, fileType, onHideTab, spreadsheetDownloadUrl, spreadsheetFileName, onCitationClicked }: Props) => {
    const isDisabledCitationTab: boolean = !activeCitation;
    const page = getPage(answer.data_points.toString());
    let thoughts = parseThoughts(answer.thoughts);

    const preContent = extractPreContent(rawThoughtsToString(answer.thoughts));
    const meta = parseMeta(preContent);
    const agentType = meta.agentType || meta.mcpToolUsed || meta.mcpToolsUsed;
    const contextDocs = extractContextDocs(answer.thoughts);

    const metaCards = [
        { key: "model", label: "Model Used", value: meta.modelUsed },
        { key: "agent", label: "Agent Type", value: agentType },
        { key: "tool", label: "Tool Used", value: meta.toolSelected },
        { key: "category", label: "Query Category", value: meta.queryCategory },
        { key: "original", label: "Original Query", value: meta.originalQuery },
        { key: "rewritten", label: "Rewritten Query", value: meta.rewrittenQuery }
    ];

    const visibleMetaCards = metaCards.filter(card => !!card.value);
    const hasAnyMeta = visibleMetaCards.length > 0;

    const filteredThoughts = (thoughts || []).filter((thought: any) => {
        const title = toPlainText(thought?.title).toLowerCase();
        return !title.includes("assistant");
    });

    const hasThoughtBlocks = filteredThoughts.length > 0;
    const hasContextDocs = contextDocs.length > 0;
    const hasThoughtProcessContent = hasAnyMeta || hasThoughtBlocks || hasContextDocs;
    const isDisabledThoughtProcessTab: boolean = !hasThoughtProcessContent;

    // Helpers to sanitize and render sources
    const toHref = (val: unknown): string | null => {
        const s = sourcePlain(val);
        if (!s) return null;
        if (/^https?:\/\//i.test(s)) return s;
        if (/^www\./i.test(s)) return `https://${s}`;
        if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(s)) return `https://${s}`;
        return null;
    };

    // Check if a URL is a blob storage URL (not a public website)
    const isBlobStorageUrl = (url: string): boolean => {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        // Check if it's a blob storage URL
        const isBlobStorage = lowerUrl.includes('.blob.core.windows.net');
        // Check if it has document extensions
        const hasDocExtension = /\.(pdf|docx?|xlsx?|csv|pptx?|txt)($|\?)/i.test(lowerUrl);
        return isBlobStorage || hasDocExtension;
    };

    // Handle source click - either open in panel or open in new tab
    const handleSourceClick = (e: React.MouseEvent, href: string, label: string) => {
        if (isBlobStorageUrl(href) && onCitationClicked) {
            e.preventDefault();
            onCitationClicked(href, label);
        }
        // Otherwise, let the default <a> behavior happen (open in new tab)
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
                        color: "#0E7C3A",
                        fontSize: "15px",
                        selectors: {
                            ":before": {
                                backgroundColor: "#0E7C3A"
                            },
                            ":hover": {
                                color: "#0E7C3A",
                                backgroundColor: "#E8F5ED"
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
                                {visibleMetaCards.map(card => (
                                    <section key={card.key} className={styles.sectionCard}>
                                        <h4 className={styles.headerCard}>{card.label}</h4>
                                        <p className={styles.contentCard}>{toPlainText(card.value)}</p>
                                    </section>
                                ))}
                            </div>
                        )}
                        {hasContextDocs && (
                            <section className={styles.sectionCard}>
                                <h4 className={styles.headerCard}>Context Documents</h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {contextDocs.map((doc, index) => {
                                        const docContent = toPlainText(doc.content);
                                        const sourceLabel = doc.source ? sourcePlain(doc.source) : "";
                                        const href = doc.source ? toHref(doc.source) : null;
                                        return (
                                            <div
                                                key={`context-doc-${index}-${sourceLabel}`}
                                                style={{
                                                    padding: "8px 10px",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: 6,
                                                    background: "#fff"
                                                }}
                                            >
                                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Doc {index + 1}</div>
                                                {docContent && (
                                                    <p
                                                        style={{
                                                            margin: 0,
                                                            whiteSpace: "pre-wrap",
                                                            fontSize: 13,
                                                            color: "#374151"
                                                        }}
                                                    >
                                                        {docContent}
                                                    </p>
                                                )}
                                                {doc.source && (
                                                    <div style={{ marginTop: 6, fontSize: 12 }}>
                                                        <span style={{ color: "#6b7280" }}>Source: </span>
                                                        {href ? (
                                                            <a
                                                                href={href}
                                                                target="_blank"
                                                                rel="noreferrer noopener"
                                                                style={{ color: "#2563eb", cursor: "pointer" }}
                                                                onClick={e => handleSourceClick(e, href, sourceLabel || href)}
                                                            >
                                                                {sourceLabel || href}
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: "#374151" }}>{sourceLabel || doc.source}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
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
                                                                    <a 
                                                                        href={href} 
                                                                        target="_blank" 
                                                                        rel="noreferrer noopener" 
                                                                        style={{ color: "#2563eb", cursor: "pointer" }}
                                                                        onClick={(e) => handleSourceClick(e, href, label)}
                                                                    >
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
                                                        <a 
                                                            href={href} 
                                                            target="_blank" 
                                                            rel="noreferrer noopener" 
                                                            style={{ color: "#2563eb", cursor: "pointer" }}
                                                            onClick={(e) => handleSourceClick(e, href, label)}
                                                        >
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
