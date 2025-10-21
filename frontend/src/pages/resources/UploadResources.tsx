import React, { useMemo, useState } from "react";
import styles from "./UploadResourcescopy.module.css";

import FileListHeader from "../../components/UploadResources/FileHeaderList";
import LazyResourceList from "../../components/UploadResources/LazyResourceList";
import { useSourceFiles } from "../../hooks/useSourceFiles";
import { useAppContext } from "../../providers/AppProviders";
import { useFileUpload } from "../../hooks/useFileUpload";
import UploadDialogModal from "../../components/UploadResources/UploadDialogModal";

const UploadResources: React.FC = () => {
    const { user } = useAppContext();
    const orgId = user?.organizationId || "";

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    
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
    } = useSourceFiles(user?.organizationId || "", selectedCategory)
    
    const { uploadDialogOpen, openUploadDialog, closeUploadDialog, dispatch, state, handleDuplicateRename, handleDuplicateReplace, handleDuplicateSkip, showRenameModal } = useFileUpload(user?.organizationId || "", () => fetchFiles(currentPath, selectedCategory), files);

    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category);
    };

    return (
        <div className={styles.page_container}>
            <FileListHeader setSearchQuery={setSearchQuery} openUploadDialog={openUploadDialog} onRefresh={() => fetchFiles(currentPath, selectedCategory)} isLoading={isLoading}/>
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
                organizationId={user?.organizationId}
                onRefresh={() => fetchFiles(currentPath, selectedCategory)}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
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
