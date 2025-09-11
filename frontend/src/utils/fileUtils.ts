import { toast } from "react-toastify";
import { ALLOWED_FILE_TYPES, EXCEL_FILES, SPREADSHEET_FILE_LIMIT } from "../constants";

export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
};

export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const validateFiles = (files: File[], allowedTypes: string[]) => {
    const invalidFiles = files.filter(file => {
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        return !allowedTypes.includes(ext);
    });
    const validFiles = files.filter(f => !invalidFiles.includes(f));

    return { validFiles, invalidFiles };
};

export const checkSpreadsheetFileLimit = (newFiles: File[], Files: BlobItem[]): boolean => {
    const existingSpreadsheetCount = Files.filter(item => {
        const ext = item.name.split(".").pop()?.toLowerCase();
        return EXCEL_FILES.includes(ext || "");
    }).length;
    const newSpreadsheetCount = newFiles.filter(file => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        return EXCEL_FILES.includes(ext || "");
    }).length;

    if (existingSpreadsheetCount + newSpreadsheetCount > SPREADSHEET_FILE_LIMIT) {
        return false;
    }
    return true;
};