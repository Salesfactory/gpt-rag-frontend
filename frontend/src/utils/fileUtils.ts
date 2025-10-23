import {  EXCEL_FILES, SPREADSHEET_FILE_LIMIT } from "../constants";
import { BlobItem } from "../types";

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

/**
 * Characters that are not allowed in file names
 */
export const INVALID_FILENAME_CHARACTERS = ['&', '#', '%', '{', '}', '\\', '<', '>', '*', '?', '/', '$', '!', "'", '"', ':', '@', '+', '`', '|', '='];

/**
 * Checks if a file name contains invalid characters
 * @param fileName - The file name to validate
 * @returns true if the file name contains invalid characters, false otherwise
 */
export const hasInvalidCharacters = (fileName: string): boolean => {
    const invalidCharacters = /[&#%{}\\<>*?/$!'"'":@+`|=]/;
    return invalidCharacters.test(fileName);
};

/**
 * Validates file names and returns files with invalid characters
 * @param files - Array of files to validate
 * @returns Object containing arrays of valid files and files with invalid characters
 */
export const validateFileNames = (files: File[]): { validFiles: File[], filesWithInvalidChars: File[] } => {
    const filesWithInvalidChars = files.filter(file => hasInvalidCharacters(file.name));
    const validFiles = files.filter(file => !hasInvalidCharacters(file.name));
    
    return { validFiles, filesWithInvalidChars };
};