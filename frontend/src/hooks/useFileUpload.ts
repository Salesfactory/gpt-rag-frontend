import { useCallback, useEffect, useReducer, useState } from "react";
import { uploadSourceFileToBlob } from "../api";
import { toast } from "react-toastify";
import { checkSpreadsheetFileLimit, validateFiles } from "../utils/fileUtils";
import { ALLOWED_FILE_TYPES, SPREADSHEET_FILE_LIMIT } from "../constants";
import { BlobItem, FileToUpload, UploadState, UploadAction } from "../types";

const initialState: UploadState = {
  status: 'idle',
  initialFiles: [],
  duplicateFiles: [],
  filesToUpload: [],
  currentFileIndex: 0,
  excelFiles: [],
  invalidCharacterFiles: []
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
      
      const newFilesToUpload: FileToUpload[] = [...state.filesToUpload, { file: renamedFile, action: 'upload' as const }];
      
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
      const newFilesToUploadReplace: FileToUpload[] = [...state.filesToUpload, { file: replaceFile, action: 'replace' as const }];
      
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

    case "INVALID_CHARACTERS":
      return { ...state, invalidCharacterFiles: action.payload, status: "invalid_characters"}

    case "UPLOAD":
      return {...state, status: "uploading"}

    case "UPLOAD_SUCCESS": 
      return {...state, status: "success"}

    case "UPLOAD_ERROR":
      return {...state, status: "error", errorMessage: action.payload}

    case 'CANCEL':
      return initialState;

    default:
      return state;
  }
}


export const useFileUpload = (organizationId: string, onUploadComplete: () => void, existingFiles: BlobItem[], currentPath: string = "") => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const [state, dispatch] = useReducer(validationReducer, initialState)

  const openUploadDialog = () => setUploadDialogOpen(true);
  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    if (state.status !== "uploading") {
      dispatch({ type: 'CANCEL' });
    }
  };

  const startUpload = useCallback(async (files: FileToUpload[]) => {
    try {
      dispatch({ type: 'UPLOAD' });
      
      for (const file of files) {
        await uploadSourceFileToBlob(file.file, organizationId, currentPath);
      }
      
      dispatch({ type: 'UPLOAD_SUCCESS' });
      toast.success("Files uploaded successfully!");
      onUploadComplete();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      dispatch({ type: 'UPLOAD_ERROR', payload: errorMessage });
      toast.error(`Error uploading files: ${errorMessage}`);
    } finally {
      closeUploadDialog();
    }
  }, [organizationId, currentPath, onUploadComplete]);

  const handleDuplicateRename = (newName: string) => {
    dispatch({ type: 'HANDLE_DUPLICATE_RENAME', payload: newName });
  };

  const handleDuplicateReplace = () => {
    dispatch({ type: 'HANDLE_DUPLICATE_REPLACE' });
  };

  const handleDuplicateSkip = () => {
    dispatch({ type: 'HANDLE_DUPLICATE_SKIP' });
  };

  const showRenameModal = () => {
    dispatch({ type: 'SHOW_RENAME_MODAL' });
  };

  const validate = useCallback(() => {
    if (state.initialFiles.length === 0) {
      dispatch({ type: 'CANCEL' });
      return;
    }

    const { validFiles, invalidFiles } = validateFiles(state.initialFiles, ALLOWED_FILE_TYPES);

    if (!checkSpreadsheetFileLimit(validFiles, existingFiles)) {
      toast.error(`Spreadsheet file limit reached: You can only upload up to ${SPREADSHEET_FILE_LIMIT} .csv, .xls, or .xlsx files per organization.`);
      closeUploadDialog();
      return;
    }

    if (invalidFiles.length > 0) {
      toast.warn(`Invalid file types skipped: ${invalidFiles.map(f => f.name).join(', ')}`);
    }

    if (validFiles.length === 0) {
      toast.error("No valid files to upload.");
      closeUploadDialog();
      return;
    }

    dispatch({
      type: 'DUPLICATE_FILES',
      payload: validFiles.filter(file => {
        return existingFiles.some(item => item.name.split('/').pop() === file.name);
      })
    });
  }, [state.initialFiles, existingFiles]);

  const checkExcelFiles = useCallback(() => {
    const files: FileToUpload[] = state.filesToUpload;
    const excelFileNames = files
      .filter(file => {
        const extension = file.file.name.split(".").pop()?.toLowerCase();
        return extension === "xls" || extension === "xlsx";
      })
      .map(file => file.file.name);

    if (excelFileNames.length > 0) {
      dispatch({ type: "EXCEL_WARNING", payload: excelFileNames });
    } else {
      dispatch({ type: "UPLOAD" });
    }
  }, [state.filesToUpload]);

  useEffect(() => {
    if (state.status === 'validating' && state.initialFiles.length > 0) {
      validate();
    }
  }, [state.status, validate]);

  useEffect(() => {
    if (state.status === "readyToUpload" && state.filesToUpload.length > 0) {
      checkExcelFiles();
    }
  }, [state.status, checkExcelFiles]);

  useEffect(() => {
    if (state.status === "uploading" && state.filesToUpload.length > 0) {
      startUpload(state.filesToUpload);
    }
  }, [state.status, startUpload]);

  return {
    uploadDialogOpen,
    openUploadDialog,
    closeUploadDialog,
    state,
    dispatch,
    handleDuplicateRename,
    handleDuplicateReplace,
    handleDuplicateSkip,
    showRenameModal
  }
}