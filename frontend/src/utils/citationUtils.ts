const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "xlsx", "xls", "csv", "pptx", "ppt", "txt", "md", "markdown"]);

const FILE_ICON_LABELS: Record<string, string> = {
    pdf: "PDF",
    word: "DOC",
    excel: "XLS",
    powerpoint: "PPT",
    text: "TXT",
    markdown: "MD",
    document: "DOC",
    link: "URL"
};

export type CitationKind = "document" | "web" | "unknown";
export type CitationIconKey = "pdf" | "word" | "excel" | "powerpoint" | "text" | "markdown" | "document" | "link";

export function getCitationKind(citation: string): CitationKind {
    const normalized = (citation || "").trim();
    if (!normalized) return "unknown";

    if (isAzureBlobHost(normalized)) {
        return "document";
    }

    if (isHttpUrl(normalized)) {
        return "web";
    }

    const extension = getCitationExtension(normalized);
    if (extension) {
        if (looksLikeBareDomain(normalized) && normalized.includes("/")) {
            return "web";
        }
        return "document";
    }

    if (toUrl(normalized)) {
        return "web";
    }

    return "unknown";
}

export function getFaviconUrl(citation: string): string | null {
    const normalized = (citation || "").trim();
    if (getCitationKind(normalized) !== "web") return null;

    const parsed = toUrl(normalized);
    if (!parsed) return null;

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=16`;
}

export function getFileTypeIconKey(citation: string): CitationIconKey {
    const extension = getCitationExtension(citation);

    switch (extension) {
        case "pdf":
            return "pdf";
        case "doc":
        case "docx":
            return "word";
        case "xls":
        case "xlsx":
        case "csv":
            return "excel";
        case "ppt":
        case "pptx":
            return "powerpoint";
        case "txt":
            return "text";
        case "md":
        case "markdown":
            return "markdown";
        default:
            return getCitationKind(citation) === "web" ? "link" : "document";
    }
}

export function getFileTypeIconLabel(iconKey: CitationIconKey): string {
    return FILE_ICON_LABELS[iconKey] || FILE_ICON_LABELS.document;
}

export function getCitationDisplayName(citation: string): string {
    const normalized = (citation || "").trim();
    if (!normalized) return "";

    const kind = getCitationKind(normalized);
    if (kind === "web") {
        const parsed = toUrl(normalized);
        if (parsed) {
            return parsed.hostname.replace(/^www\./i, "");
        }
    }

    const fileName = getFileNameFromCitation(normalized);
    if (fileName) return fileName;

    return normalized;
}

export function getCitationAriaLabel(index: number, citation: string): string {
    const display = getCitationDisplayName(citation) || citation;
    return `Source ${index}: ${display}`;
}

export function toCitationLinkTarget(citation: string): string {
    const normalized = (citation || "").trim();
    if (!normalized) return normalized;

    if (getCitationKind(normalized) === "document" && !/^https?:\/\//i.test(normalized)) {
        return normalized;
    }

    if (/^https?:\/\//i.test(normalized)) {
        return normalized;
    }

    const parsed = toUrl(normalized);
    if (!parsed) {
        return normalized;
    }

    return parsed.href;
}

export function getCitationExtension(citation: string): string | null {
    const normalized = (citation || "").trim();
    if (!normalized) return null;

    const path = getPathFromCitation(normalized);
    if (!path) return null;

    const cleanedPath = path.toLowerCase();
    const match = cleanedPath.match(/\.([a-z0-9]+)$/i);
    if (!match) return null;

    const extension = match[1];
    return DOCUMENT_EXTENSIONS.has(extension) ? extension : null;
}

function toUrl(input: string): URL | null {
    const value = (input || "").trim();
    if (!value) return null;

    try {
        if (/^https?:\/\//i.test(value)) {
            return new URL(value);
        }

        if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(value)) {
            return new URL(`https://${value}`);
        }
    } catch {
        return null;
    }

    return null;
}

function isHttpUrl(input: string): boolean {
    return /^https?:\/\//i.test((input || "").trim());
}

function getPathFromCitation(citation: string): string {
    const normalized = (citation || "").trim();
    if (/^https?:\/\//i.test(normalized)) {
        const parsed = toUrl(normalized);
        if (parsed) {
            return parsed.pathname || "";
        }
    }

    return normalized.split("?")[0].split("#")[0];
}

function getFileNameFromCitation(citation: string): string {
    const path = getPathFromCitation(citation);
    if (!path) return "";

    const parts = path.split("/").filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : "";
    if (!last) return "";

    try {
        return decodeURIComponent(last);
    } catch {
        return last;
    }
}

function isAzureBlobHost(citation: string): boolean {
    const parsed = toUrl(citation);
    if (parsed && /\.blob\.core\.windows\.net$/i.test(parsed.hostname)) {
        return true;
    }

    return /^[a-z0-9-]+\.blob\.core\.windows\.net(?:\/|$)/i.test((citation || "").trim());
}

function looksLikeBareDomain(value: string): boolean {
    return /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test((value || "").trim());
}
