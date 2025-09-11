import { useCallback, useEffect, useReducer, useState } from "react";
import { uploadSourceFileToBlob } from "../api";
import { toast } from "react-toastify";
import { checkSpreadsheetFileLimit, validateFiles } from "../utils/fileUtils";
import { ALLOWED_FILE_TYPES, SPREADSHEET_FILE_LIMIT } from "../constants";

const initialState: UploadState = {
  status: 'idle',
  initialFiles: [],
  duplicateFiles: [],
  filesToUpload: [],
  currentFileIndex: 0,
  excelFiles: []
};

function validationReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case 'SELECT_FILES':
      return { ...initialState, status: 'validating', initialFiles: action.payload };
    
    case 'DUPLICATE_FILES':
      if (action.payload.length > 0) {
        return { 
          ...state, 
          initialFiles: state.initialFiles.filter(file => !action.payload.includes(file)), 
          status: 'duplicateWarning', 
          duplicateFiles: action.payload,
          currentFileIndex: 0
        };
      }
      return { ...state, status: 'readyToUpload', filesToUpload: state.initialFiles.map(f => ({ file: f, action: 'upload' })) };

    case 'HANDLE_DUPLICATE_RENAME':
      const renamedFile = new File([state.duplicateFiles[state.currentFileIndex]], action.payload, {
        type: state.duplicateFiles[state.currentFileIndex].type,
        lastModified: state.duplicateFiles[state.currentFileIndex].lastModified
      });
      
      const newFilesToUpload = [...state.filesToUpload, { file: renamedFile, action: 'upload' as const }];
      
      if (state.currentFileIndex + 1 >= state.duplicateFiles.length) {
        return { ...state, status: 'readyToUpload', filesToUpload: newFilesToUpload };
      }
      
      return { 
        ...state, 
        filesToUpload: newFilesToUpload,
        currentFileIndex: state.currentFileIndex + 1
      };

    case 'HANDLE_DUPLICATE_REPLACE':
      const replaceFile = state.duplicateFiles[state.currentFileIndex];
      const newFilesToUploadReplace = [...state.filesToUpload, { file: replaceFile, action: 'replace' as const }];
      
      if (state.currentFileIndex + 1 >= state.duplicateFiles.length) {
        return { ...state, status: 'readyToUpload', filesToUpload: newFilesToUploadReplace };
      }
      
      return { 
        ...state, 
        filesToUpload: newFilesToUploadReplace,
        currentFileIndex: state.currentFileIndex + 1
      };

    case 'HANDLE_DUPLICATE_SKIP':
      if (state.currentFileIndex + 1 >= state.duplicateFiles.length) {
        return { ...state, status: 'readyToUpload' };
      }
      
      return { 
        ...state, 
        currentFileIndex: state.currentFileIndex + 1
      };

    case 'SHOW_RENAME_MODAL':
      return { ...state, status: 'renameFile' };

    case "EXCEL_WARNING":
      return { ...state, excelFiles: action.payload, status: "excel_warning"}

    case "UPLOAD":
      return {...state, status: "uploading"}

    case "UPLOAD_SUCCESS": 
      return {...state, status: "success"}

    case 'CANCEL':
      return initialState;

    default:
      return state;
  }
}


export const useFileUpload = (organizationId: string, onUploadComplete: () => void, existingFiles: BlobItem[]) => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const [state, dispach] = useReducer(validationReducer, initialState)

  const openUploadDialog = () => setUploadDialogOpen(true);
  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    dispach({ type: 'CANCEL' });
  };

  const startUpload = useCallback(async (files: FileToUpload[]) => {
    try {
      for (const file of files) {
        await uploadSourceFileToBlob(file.file, organizationId);
      }
      toast.success("Files uploaded successfully!");
      onUploadComplete();
    } catch (error) {
      toast.error("Error uploading files. Please try again.");
    } finally {
      closeUploadDialog()
    }
  }, [organizationId, onUploadComplete]);

  const handleDuplicateRename = (newName: string) => {
    dispach({ type: 'HANDLE_DUPLICATE_RENAME', payload: newName });
  };

  const handleDuplicateReplace = () => {
    dispach({ type: 'HANDLE_DUPLICATE_REPLACE' });
  };

  const handleDuplicateSkip = () => {
    dispach({ type: 'HANDLE_DUPLICATE_SKIP' });
  };

  const showRenameModal = () => {
    dispach({ type: 'SHOW_RENAME_MODAL' });
  };

  const validate = () => {
    const { validFiles, invalidFiles } = validateFiles(state.initialFiles, ALLOWED_FILE_TYPES);

    if (!checkSpreadsheetFileLimit(validFiles, existingFiles)) {
      toast(`Spreadsheet file limit reached: You can only upload up to ${SPREADSHEET_FILE_LIMIT} .csv, .xls, or .xlsx files per organization.`, {
            type: "error"
        });
      closeUploadDialog()
    }

    if (invalidFiles.length > 0) {
      toast.warn(`Invalid file types skipped: ${invalidFiles.map(f => f.name).join(', ')}`);
    }

    dispach({
      type: 'DUPLICATE_FILES',
      payload: validFiles.filter(file => {
        return existingFiles.some(item => item.name.split('/').pop() === file.name);
      })
    });
  };

  const checkExcelFiles = () => {
    const files: FileToUpload[] = state.filesToUpload
    const excelFileNames = files
    .filter(file => {
        const extension = file.file.name.split(".").pop()?.toLowerCase();
        return extension === "xls" || extension === "xlsx";
    })
    .map(file => file.file.name);

    if (excelFileNames.length > 0) {
      dispach({type: "EXCEL_WARNING", payload: excelFileNames})
  }
  }

  useEffect(() => {
    console.log(state);
    if (state.status === 'validating' && state.initialFiles.length > 0) {
      validate();
    }
    if (state.status === "readyToUpload" && state.filesToUpload.length > 0) {
      checkExcelFiles()
    }
    if (state.status === "uploading") {
      startUpload(state.filesToUpload)
    }

  }, [state.status, state.initialFiles]);

  return {
    uploadDialogOpen,
    openUploadDialog,
    closeUploadDialog,
    state,
    dispach,
    handleDuplicateRename,
    handleDuplicateReplace,
    handleDuplicateSkip,
    showRenameModal
  }
}