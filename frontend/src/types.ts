
export interface BlobItem {
    name: string;
    size: number;
    created_on: string;
    last_modified: string;
    content_type: string;
    url: string;
    metadata?: Record<string, string>;
}

export interface FolderItem {
    name: string;
    full_path: string;
    type: "folder";
    size: number;
    created_on: string;
    last_modified: string;
    content_type: string;
    url: string;
}

export interface SourceDocumentsResponse {
    folders: FolderItem[];
    files: BlobItem[];
    current_path: string;
}

export type FileToUpload = { file: File; action: 'upload' | 'replace' | 'rename' }

export type UploadState = {
  status: 'idle' | 'validating' |  'duplicateWarning' | 'renameFile' | 'readyToUpload' | 'excel_warning' | 'invalid_characters' | 'uploading' | 'success' | 'error';
  initialFiles: File[]
  duplicateFiles: File[]
  filesToUpload: FileToUpload[]
  currentFileIndex: number
  errorMessage?: string;
  excelFiles: string[]
  invalidCharacterFiles: string[]
};



export type UploadAction =
  | { type: 'SELECT_FILES'; payload: File[] }
  | { type: 'VALIDATION_COMPLETE'; payload: File[] }
  | { type: 'DUPLICATE_FILES'; payload: File[] }
  | { type: 'SHOW_RENAME_MODAL' }
  | { type: 'HANDLE_DUPLICATE_RENAME'; payload: string }
  | { type: 'HANDLE_DUPLICATE_REPLACE' }
  | { type: 'HANDLE_DUPLICATE_SKIP' }
  | { type: 'NEXT_DUPLICATE' }
  | { type: 'UPLOAD' }
  | { type: 'UPLOAD_SUCCESS' }
  | { type: 'UPLOAD_ERROR'; payload: string }
  | {type: 'EXCEL_WARNING'; payload: string[]}
  | {type: 'INVALID_CHARACTERS'; payload: string[]}
  | { type: 'CANCEL' };