
interface BlobItem {
    name: string;
    size: number;
    created_on: string;
    last_modified: string;
    content_type: string;
    url: string;
    metadata?: Record<string, string>;
}

type UploadState = {
  status: 'idle' | 'validating' |  'duplicateWarning' | 'renameFile' | 'readyToUpload' | 'uploading' | 'success' | 'error';
  initialFiles: File[]
  duplicateFiles: File[]
  excelFiles: File[]
  filesToUpload: { file: File; action: 'upload' | 'replace' | 'rename' }[]
  currentFileIndex: number
  errorMessage?: string;
};

type UploadAction =
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
  | { type: 'CANCEL' };