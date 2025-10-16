import React, { useState } from "react";
import styles from "./UploadResourcescopy.module.css";

import FileListHeader from "../../components/UploadResources/FileHeaderList";
import LazyResourceList from "../../components/UploadResources/LazyResourceList";
import { useSourceFiles } from "../../hooks/useSourceFiles";
import { useAppContext } from "../../providers/AppProviders";
import { useFileUpload } from "../../hooks/useFileUpload";
import UploadDialogModal from "../../components/UploadResources/UploadDialogModal";


const UploadResources: React.FC = () => {
    const { user } = useAppContext();
    const { 
        isLoading, 
        files,
        filteredFiles, 
        filteredFolders,
        currentPath,
        deleteFile, 
        setSearchQuery, 
        fetchFiles, 
        handleDownload,
        navigateToFolder,
        navigateBack,
        navigateToRoot
    } = useSourceFiles(user?.organizationId || "")
    
    const { uploadDialogOpen, openUploadDialog, closeUploadDialog, dispatch, state, handleDuplicateRename, handleDuplicateReplace, handleDuplicateSkip, showRenameModal } = useFileUpload(user?.organizationId || "", () => fetchFiles(currentPath), files);


    return (
        <div className={styles.page_container}>
            <FileListHeader setSearchQuery={setSearchQuery} openUploadDialog={openUploadDialog} onRefresh={() => fetchFiles(currentPath)} />
            <LazyResourceList
                filteredFiles={filteredFiles} 
                filteredFolders={filteredFolders}
                currentPath={currentPath}
                isLoading={isLoading} 
                deleteFile={deleteFile} 
                handleDownload={handleDownload}
                navigateToFolder={navigateToFolder}
                navigateBack={navigateBack}
                navigateToRoot={navigateToRoot}
            />
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
