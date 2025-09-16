import React, { useState } from "react";
import styles from "./UploadResourcescopy.module.css";

import FileListHeader from "../../components/UploadResources/FileHeaderList";
import ResourceList from "../../components/UploadResources/ResourceList";
import { useSourceFiles } from "../../hooks/useSourceFiles";
import { useAppContext } from "../../providers/AppProviders";
import { useFileUpload } from "../../hooks/useFileUpload";
import UploadDialogModal from "../../components/UploadResources/UploadDialogModal";


const UploadResources: React.FC = () => {
    const { user } = useAppContext();
    const { isLoading, filteredItems, deleteFile, setSearchQuery, fetchFiles, handleDownload,items } = useSourceFiles(user?.organizationId || "")
    const { uploadDialogOpen, openUploadDialog, closeUploadDialog, dispatch, state, handleDuplicateRename, handleDuplicateReplace, handleDuplicateSkip, showRenameModal } = useFileUpload(user?.organizationId || "", fetchFiles, items);


    return (
        <div className={styles.page_container}>
            <FileListHeader setSearchQuery={setSearchQuery} openUploadDialog={openUploadDialog} onRefresh={fetchFiles} />
            <ResourceList filteredItems={filteredItems} isLoading={isLoading} deleteFile={deleteFile} handleDownload={handleDownload} />
            {uploadDialogOpen && (
                <UploadDialogModal 
                    closeUploadDialog={closeUploadDialog}  
                    uploadState={state} 
                    dispatchState={dispatch}
                    handleDuplicateRename={handleDuplicateRename}
                    handleDuplicateReplace={handleDuplicateReplace}
                    handleDuplicateSkip={handleDuplicateSkip}
                    showRenameModal={showRenameModal}
                />
            )}
        </div>
    );
};

export default UploadResources;
