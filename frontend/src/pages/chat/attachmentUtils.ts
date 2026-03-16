export type UploadCategory = "pdf" | "spreadsheet" | "word";

export const MIXED_TYPE_UPLOAD_ERROR =
    "Mixed type documents are not allowed. Upload all PDFs, all Word documents, or all spreadsheet types (CSV, XLS, XLSX).";

export function getUploadCategory(filename: string): UploadCategory | null {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".csv") || lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "spreadsheet";
    if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
    return null;
}

export function isSupportedUploadCategory(filename: string): boolean {
    return getUploadCategory(filename) !== null;
}

export function hasMixedUploadCategories(
    selectedFilenames: string[],
    existingFilename?: string
): boolean {
    const selectionCategories = new Set(
        selectedFilenames
            .map(getUploadCategory)
            .filter((category): category is UploadCategory => category !== null)
    );

    if (selectionCategories.size > 1) {
        return true;
    }

    if (existingFilename && selectionCategories.size === 1) {
        const existingCategory = getUploadCategory(existingFilename);
        const [selectionCategory] = Array.from(selectionCategories);
        if (existingCategory !== null && selectionCategory !== existingCategory) {
            return true;
        }
    }

    return false;
}
