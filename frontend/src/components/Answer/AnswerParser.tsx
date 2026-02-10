/*
 * AnswerParser (refactored)
 * ------------------------------------------------------------
 * 100 % feature‑compatible with the original implementation but
 * easier to read, unit‑test, and extend.
 *
 * Public API
 *   – removeCitations(text)
 *   – parseAnswerToHtml(answer, showSources, onCitationClicked)
 *
 * Internal helpers are exported *only* for test visibility.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { getCitationFilePath } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import {
    getCitationAriaLabel,
    getCitationKind,
    getFaviconUrl,
    toCitationLinkTarget
} from "../../utils/citationUtils";

/* ------------------------------------------------------------------
 * Regex constants (compiled once)
 * ---------------------------------------------------------------- */
const RX_MARKDOWN_LINK = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g; // skip image markdown
const RX_WRONG_NUMBERS = /\[\^(\d+)\^\]/g; // ↳ [^1^] ➜ [1]
const RX_CITATION_BLOCK = /\[\[([^\]]+)\]\]\(((?:[^\(\)]|\([^\(\)]*\))+)\)/g; // [[1]](url) allows simple balanced parentheses

/* ------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------- */
export type HtmlParsedAnswer = {
    answerHtml: string;
    citations: string[];
    followupQuestions: string[];
};

/* ------------------------------------------------------------------
 * Pure helper: strip markdown citations from arbitrary text
 * ---------------------------------------------------------------- */
export function removeCitations(text: string): string {
    return text.replace(RX_CITATION_BLOCK, "");
}

/**
 * Remove the Citations block and its links.
 */
export function removeCitationsBlock(input: string): string {
    // Delete only the Citations block at the end of the text.
    let out = input;
    // Markdown: block type “**Citations:**” at the end
    out = out.replace(/(\n|\r|\r\n)?\s*(\*\*\s*(Citations|Sources|Fuentes)\s*:\*\*|####?\s*(Citations|Sources|Fuentes))\s*:?[\s\S]*$/gi, "");
    return out;
}
/* ------------------------------------------------------------------
 * Pure helper: convert inline markdown links → [url]
 * ---------------------------------------------------------------- */
function replaceMarkdownLinks(text: string): string {
    return text.replace(RX_MARKDOWN_LINK, (_: string, _desc: string, url: string) => `[${url}]`);
}

/* ------------------------------------------------------------------
 * Pure helper: fix [^1^] → [1]
 * ---------------------------------------------------------------- */
const fixWrongNumbers = (t: string) => t.replace(RX_WRONG_NUMBERS, (_: string, n: string) => `[${n}]`);

const inlineBadgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    marginInline: "2px",
    verticalAlign: "super"
};

const inlineIconStyle: React.CSSProperties = {
    width: "16px",
    height: "16px",
    borderRadius: "999px",
    border: "1px solid #d1d5db",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    objectFit: "cover"
};

const inlineNumberStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "#123bb6"
};

/* ------------------------------------------------------------------
 * Factory to build a <sup> node as string for a citation index
 * ---------------------------------------------------------------- */
function supNode(index: number, citationUrl: string, citationLabel: string, path: string) {
    const kind = getCitationKind(citationLabel);
    const faviconUrl = kind === "web" ? getFaviconUrl(citationLabel) : null;
    const ariaLabel = getCitationAriaLabel(index, citationLabel);

    // A small JSX fragment rendered to string; React is required by TSX
    // eslint-disable-next-line react/react-in-jsx-scope
    return renderToStaticMarkup(
        <a
            key={`citation-${index}`}
            className="supContainer"
            title={citationLabel}
            data-citation-url={citationUrl}
            data-citation-path={path}
            data-citation-index={index}
            aria-label={ariaLabel}
            tabIndex={0}
        >
            <span className="citationInlineBadge" style={inlineBadgeStyle}>
                {!!faviconUrl && (
                    <img
                        src={faviconUrl}
                        alt=""
                        width={16}
                        height={16}
                        loading="lazy"
                        className="citationInlineIcon"
                        style={inlineIconStyle}
                        aria-hidden="true"
                    />
                )}
                <span className="citationInlineNumber" style={inlineNumberStyle}>
                    [{index}]
                </span>
            </span>
        </a>
    );
}

/* ------------------------------------------------------------------
 * Main entry
 * ---------------------------------------------------------------- */
export function parseAnswerToHtml(
    raw: string,
    showSources: boolean,
    onCitationClicked: (citationFilePath: string, filename: string) => void
): HtmlParsedAnswer {
    const { isResizingAnalysisPanel } = useAppContext();

    /* 1. Pre‑clean non‑citation transformations */
    let text = fixWrongNumbers(replaceMarkdownLinks(raw));
    // Collect citations & mapping only if needed
    if (!showSources || isResizingAnalysisPanel) {
        return {
            answerHtml: removeCitationsBlock(removeCitations(text)).trim(),
            citations: [],
            followupQuestions: []
        };
    }

    /* 2. Split by citation regex and build fragments */
    const citations: string[] = [];
    const citationPath: Record<string, string> = {};

    const html = text.replace(RX_CITATION_BLOCK, (_: string, _num: string, citeUrl: string) => {
        // Deduplicate by citation URL / filename
        const idx = citations.includes(citeUrl) ? citations.indexOf(citeUrl) : (citations.push(citeUrl), citations.length - 1);
        const kind = getCitationKind(citeUrl);
        const citationClickUrl = kind === "web" ? toCitationLinkTarget(citeUrl) : citeUrl;

        if (!citationPath[citeUrl]) {
            citationPath[citeUrl] = kind === "web" ? citationClickUrl : getCitationFilePath(citeUrl);
        }

        return supNode(idx + 1, citationClickUrl, citeUrl, citationPath[citeUrl]);
    });

    return {
        answerHtml: removeCitationsBlock(html).trim(),
        citations,
        followupQuestions: []
    };
}
