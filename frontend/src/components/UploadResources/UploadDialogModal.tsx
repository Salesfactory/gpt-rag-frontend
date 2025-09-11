import { useCallback, useEffect, useRef, useState, Dispatch} from "react";
import styles from "./UploadResources.module.css";
import { useDropzone } from "react-dropzone";
import {  DragFilesContent, DuplicateWarningContent, ExcelWarningContent, RenameFileContent, UploadModalFooter, UploadModalHeader } from "../UploadModal/UploadModal";


const UploadDialogModal: React.FC<{ 
    closeUploadDialog: () => void, 
    isUploading: boolean, 
    uploadState: UploadState, 
    dispachState: Dispatch<UploadAction>,
    handleDuplicateRename: (newName: string) => void,
    handleDuplicateReplace: () => void,
    handleDuplicateSkip: () => void,
    showRenameModal: () => void
}> = ({ closeUploadDialog, isUploading, uploadState, dispachState, handleDuplicateRename, handleDuplicateReplace, handleDuplicateSkip, showRenameModal }) => {
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
        dispachState({ type: 'SELECT_FILES', payload: acceptedFiles });
        console.log(uploadState);
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
                    onCancel={() => dispachState({ type: 'DUPLICATE_FILES', payload: uploadState.duplicateFiles })}
                />
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
                {!isUploading && (
                    <UploadModalFooter closeUploadDialog={closeUploadDialog} />
                )}
                </div>
            </div>
        </div>
    );
}

export default UploadDialogModal;