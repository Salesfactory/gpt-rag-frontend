import { getUploadCategory, hasMixedUploadCategories, isSupportedUploadCategory } from "./attachmentUtils";

describe("getUploadCategory", () => {
    it("classifies Word documents as a first-class category", () => {
        expect(getUploadCategory("brief.docx")).toBe("word");
        expect(getUploadCategory("legacy.doc")).toBe("word");
    });

    it("returns null for unsupported file types", () => {
        expect(getUploadCategory("photo.png")).toBeNull();
    });
});

describe("isSupportedUploadCategory", () => {
    it("only allows pdf, word, and spreadsheet categories", () => {
        expect(isSupportedUploadCategory("report.pdf")).toBe(true);
        expect(isSupportedUploadCategory("brief.docx")).toBe(true);
        expect(isSupportedUploadCategory("metrics.xlsx")).toBe(true);
        expect(isSupportedUploadCategory("photo.png")).toBe(false);
    });
});

describe("hasMixedUploadCategories", () => {
    it("allows Word documents to be grouped with other Word documents", () => {
        expect(hasMixedUploadCategories(["brief.docx", "notes.docx"])).toBe(false);
    });

    it("rejects mixing Word and PDF documents in the same selection", () => {
        expect(hasMixedUploadCategories(["brief.docx", "report.pdf"])).toBe(true);
    });

    it("rejects mixing Word and spreadsheet documents in the same selection", () => {
        expect(hasMixedUploadCategories(["brief.docx", "metrics.xlsx"])).toBe(true);
    });

    it("rejects adding a Word document to an existing PDF attachment", () => {
        expect(hasMixedUploadCategories(["brief.docx"], "report.pdf")).toBe(true);
    });

    it("rejects adding a PDF to an existing Word attachment", () => {
        expect(hasMixedUploadCategories(["report.pdf"], "brief.docx")).toBe(true);
    });
});
