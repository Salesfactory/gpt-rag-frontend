import React, { useMemo, useState, useCallback, useEffect } from "react";
import styles from "./UploadResourcescopy.module.css";

import FileListHeader from "../../components/UploadResources/FileHeaderList";
import LazyResourceList from "../../components/UploadResources/LazyResourceList";
import { useSourceFiles } from "../../hooks/useSourceFiles";
import { useAppContext } from "../../providers/AppProviders";
import { useFileUpload } from "../../hooks/useFileUpload";
import UploadDialogModal from "../../components/UploadResources/UploadDialogModal";
import { getStorageUsageByOrganization } from "../../api";


const UploadResources: React.FC = () => {
    const { user } = useAppContext();
    const orgId = user?.organizationId || "";

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [storageUsage, setStorageUsage] = useState<any>(null);
    
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
        navigateToRoot,
        sortOrder,
        toggleSortOrder
    } = useSourceFiles(user?.organizationId || "", selectedCategory)
    
    // Memoize onUploadComplete to prevent infinite loop
    const handleUploadComplete = useCallback(() => {
        fetchFiles(currentPath, selectedCategory, sortOrder);
    }, [fetchFiles, currentPath, selectedCategory, sortOrder]);
    
    const { uploadDialogOpen, openUploadDialog, closeUploadDialog, dispatch, state, handleDuplicateRename, handleDuplicateReplace, handleDuplicateSkip, showRenameModal } = useFileUpload(user?.id || "", user?.organizationId || "", handleUploadComplete, files, currentPath);

    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category);
    };

    useEffect(() => {
        const getStorage = async () => {
            const response = await getStorageUsageByOrganization(orgId, user); 
            setStorageUsage(response.data);
        }
        getStorage();
    }, [orgId, user]);
    
    const isPageLimitExceeded = storageUsage?.pagesUsed >= storageUsage?.pagesLimit;
    const isSpreadsheetLimitExceeded = storageUsage?.spreadsheetsUsed >= storageUsage?.spreadsheetLimit;

    console.log(isPageLimitExceeded, isSpreadsheetLimitExceeded);

    return (
        <div className={styles.page_container}>
            <FileListHeader isPageLimitExceeded={isPageLimitExceeded} isSpreadsheetLimitExceeded={isSpreadsheetLimitExceeded} setSearchQuery={setSearchQuery} openUploadDialog={openUploadDialog} onRefresh={() => fetchFiles(currentPath, selectedCategory, sortOrder)} isLoading={isLoading} />
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
                onRefresh={() => fetchFiles(currentPath, selectedCategory, sortOrder)}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                sortOrder={sortOrder}
                onToggleSortOrder={toggleSortOrder}
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
