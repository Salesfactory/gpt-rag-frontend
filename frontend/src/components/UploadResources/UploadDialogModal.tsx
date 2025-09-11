import { useCallback, useEffect, useRef, useState, Dispatch } from "react";
import styles from "./UploadResources.module.css";
import { DragFilesContent, DuplicateWarningContent, ExcelWarningContent, RenameFileContent, UploadingContent, UploadModalFooter, UploadModalHeader } from "../UploadModal/UploadModal";
import { UploadState, UploadAction } from "../../types";


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
        dispatchState({ type: 'SELECT_FILES', payload: acceptedFiles });
    }, []);

    const renderContent = () => {
        switch (uploadState.status) {
            case 'idle':
                return <DragFilesContent onDrop={onDrop} />
            case 'duplicateWarning':
                return <DuplicateWarningContent
                    files={uploadState.duplicateFiles}
                    currentFileIndex={uploadState.currentFileIndex}
                    onRename={showRenameModal}
                    onReplace={handleDuplicateReplace}
                    onCancel={handleDuplicateSkip}
                />
            case 'renameFile':
                return <RenameFileContent
                    fileName={uploadState.duplicateFiles[uploadState.currentFileIndex]?.name || ''}
                    onConfirm={handleDuplicateRename}
                    onCancel={() => dispatchState({ type: 'DUPLICATE_FILES', payload: uploadState.duplicateFiles })}
                />
            case "excel_warning":
                return <ExcelWarningContent excelFiles={uploadState.excelFiles} onCancel={() => dispatchState({type: 'CANCEL'})} onConfirm={() => dispatchState({type: "UPLOAD"})} />
            case "uploading":
                return <UploadingContent selectedFiles={uploadState.filesToUpload} />
            
            case "error":
                return (
                    <div className={styles.error_container}>
                        <h4>Upload Error</h4>
                        <p>{uploadState.errorMessage || "An error occurred during upload"}</p>
                        <button onClick={() => dispatchState({ type: 'CANCEL' })}>
                            Close
                        </button>
                    </div>
                )

            default:
                return <DragFilesContent onDrop={onDrop} />
        }
    }

    return (
        <div className={styles.custom_modal_overlay}>
            <div className={styles.custom_modal} ref={uploadModalRef}>
                <UploadModalHeader />
                <div className={styles.modal_content}>
                    <div className={styles.upload_dialog_content}>
                        {renderContent()}
                    </div>
                        <UploadModalFooter closeUploadDialog={closeUploadDialog} />
                </div>
            </div>
        </div>
    );
}

export default UploadDialogModal;