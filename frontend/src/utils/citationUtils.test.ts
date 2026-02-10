import {
    getCitationAriaLabel,
    getCitationDisplayName,
    getCitationKind,
    getFaviconUrl,
    getFileTypeIconKey,
    toCitationLinkTarget
} from "./citationUtils";

describe("citationUtils", () => {
    it("classifies public URLs as web citations, even with document extensions", () => {
        expect(getCitationKind("https://example.com/report.pdf")).toBe("web");
    });

    it("classifies valid webpage URLs as web citations", () => {
        expect(getCitationKind("https://www.microsoft.com/windows")).toBe("web");
    });

    it("classifies Azure blob URLs as document citations even without extension", () => {
        const blobUrl = "https://myacct.blob.core.windows.net/documents/inline-citation";
        expect(getCitationKind(blobUrl)).toBe("document");
        expect(getFaviconUrl(blobUrl)).toBeNull();
    });

    it("returns unknown for non-url, non-document citations", () => {
        expect(getCitationKind("not-a-url")).toBe("unknown");
    });

    it("classifies extension-based local paths as document citations", () => {
        expect(getCitationKind("QuarterlyReport.pdf")).toBe("document");
        expect(getCitationKind("documents/finance/data.xlsx")).toBe("document");
    });

    it("extracts web display names from hostname", () => {
        expect(getCitationDisplayName("https://www.example.com/path")).toBe("example.com");
    });

    it("extracts decoded file names for documents", () => {
        expect(getCitationDisplayName("documents/My%20Report.pdf")).toBe("My Report.pdf");
    });

    it("uses hostname display for public document URLs", () => {
        expect(getCitationDisplayName("https://storage.example.com/docs/My%20Report.pdf")).toBe("storage.example.com");
    });

    it("builds a favicon URL for web citations", () => {
        expect(getFaviconUrl("https://example.com/page")).toBe("https://www.google.com/s2/favicons?domain=example.com&sz=16");
    });

    it("does not build favicon URL for document citations", () => {
        expect(getFaviconUrl("QuarterlyReport.pdf")).toBeNull();
    });

    it("normalizes bare web domains to clickable URLs", () => {
        expect(toCitationLinkTarget("example.com/page")).toBe("https://example.com/page");
    });

    it("keeps local document citations unchanged", () => {
        expect(toCitationLinkTarget("Report.pdf")).toBe("Report.pdf");
    });

    it("maps common extensions to icon keys", () => {
        expect(getFileTypeIconKey("report.pdf")).toBe("pdf");
        expect(getFileTypeIconKey("brief.docx")).toBe("word");
        expect(getFileTypeIconKey("data.xlsx")).toBe("excel");
        expect(getFileTypeIconKey("slides.pptx")).toBe("powerpoint");
    });

    it("builds descriptive aria labels", () => {
        expect(getCitationAriaLabel(2, "https://example.com")).toBe("Source 2: example.com");
    });
});
