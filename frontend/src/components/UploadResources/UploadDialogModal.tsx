import { useCallback, useEffect, useRef, useState, Dispatch } from "react";
import styles from "./UploadResources.module.css";
import { 
  LazyDragFilesContent, 
  LazyDuplicateWarningContent, 
  LazyExcelWarningContent, 
  LazyRenameFileContent, 
  LazyUploadingContent, 
  LazyUploadModalFooter, 
  LazyUploadModalHeader,
  LazyInvalidCharactersWarningContent
} from "../UploadModal/LazyUploadModal";
import { UploadState, UploadAction } from "../../types";
import { hasInvalidCharacters } from "../../utils/fileUtils";


const UploadDialogModal: React.FC<{
    closeUploadDialog: () => void,
    uploadState: UploadState,
    dispatchState: Dispatch<UploadAction>,
    handleDuplicateRename: (newName: string) => void,
    handleDuplicateReplace: () => void,
    handleDuplicateSkip: () => void,
    showRenameModal: () => void
}> = ({ closeUploadDialog, uploadState, dispatchState, handleDuplicateRename, handleDuplicateReplace, handleDuplicateSkip, showRenameModal }) => {
    const uploadModalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadModalRef.current && !uploadModalRef.current.contains(event.target as Node)) {
                closeUploadDialog();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const onDrop = useCallback((acceptedFiles: any) => {
        // Check for invalid characters in file names
        const filesWithInvalidChars = acceptedFiles.filter((file: File) => 
            hasInvalidCharacters(file.name)
        );

        if (filesWithInvalidChars.length > 0) {
            const invalidFileNames = filesWithInvalidChars.map((file: File) => file.name);
            dispatchState({ type: 'INVALID_CHARACTERS', payload: invalidFileNames });
        } else {
            dispatchState({ type: 'SELECT_FILES', payload: acceptedFiles });
        }
    }, []);

    const renderContent = () => {
        switch (uploadState.status) {
            case 'idle':
                return <LazyDragFilesContent onDrop={onDrop} />
            case 'invalid_characters':
                return <LazyInvalidCharactersWarningContent
                    invalidFiles={uploadState.invalidCharacterFiles}
                    onCancel={() => dispatchState({ type: 'CANCEL' })}
                />
            case 'duplicateWarning':
                return <LazyDuplicateWarningContent
                    files={uploadState.duplicateFiles}
                    currentFileIndex={uploadState.currentFileIndex}
                    onRename={showRenameModal}
                    onReplace={handleDuplicateReplace}
                    onCancel={handleDuplicateSkip}
                />
            case 'renameFile':
                return <LazyRenameFileContent
                    fileName={uploadState.duplicateFiles[uploadState.currentFileIndex]?.name || ''}
                    onConfirm={handleDuplicateRename}
                    onCancel={() => dispatchState({ type: 'DUPLICATE_FILES', payload: uploadState.duplicateFiles })}
                />
            case "excel_warning":
                return <LazyExcelWarningContent excelFiles={uploadState.excelFiles} onCancel={() => dispatchState({type: 'CANCEL'})} onConfirm={() => dispatchState({type: "UPLOAD"})} />
            case "uploading":
                return <LazyUploadingContent selectedFiles={uploadState.filesToUpload} />
            
            case "error":
                return (
                    <div className={styles.error_container}>
                        <h4>Upload Error</h4>
                        <p>{uploadState.errorMessage || "An error occurred during upload"}</p>
                        <button aria-label="Close" onClick={() => dispatchState({ type: 'CANCEL' })}>
                            Close
                        </button>
                    </div>
                )

            default:
                return <LazyDragFilesContent onDrop={onDrop} />
        }
    }

    return (
        <div className={styles.custom_modal_overlay}>
            <div className={styles.custom_modal} ref={uploadModalRef}>
                <LazyUploadModalHeader />
                <div className={styles.modal_content}>
                    <div className={styles.upload_dialog_content}>
                        {renderContent()}
                    </div>
                        <LazyUploadModalFooter closeUploadDialog={closeUploadDialog} />
                </div>
            </div>
        </div>
    );
}

export default UploadDialogModal;