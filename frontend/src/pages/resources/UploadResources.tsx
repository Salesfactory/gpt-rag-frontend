import React, { useMemo } from "react";
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
    } = useSourceFiles(orgId);

    const {
        uploadDialogOpen,
        openUploadDialog,
        closeUploadDialog,
        dispatch,
        state,
        handleDuplicateRename,
        handleDuplicateReplace,
        handleDuplicateSkip,
        showRenameModal
    } = useFileUpload(orgId, () => fetchFiles(currentPath), files);

    const TOTAL_BYTES = 1 * 1024 ** 4;

    const usedBytes = useMemo(() => {
        const getSize = (it: any) => it?.size ?? it?.contentLength ?? it?.content_length ?? it?.bytes ?? 0;
        return (files || []).reduce((sum: number, it: any) => sum + (it?.isFolder ? 0 : Number(getSize(it)) || 0), 0);
    }, [files]);

    return (
        <div className={styles.page_container}>
            <FileListHeader
                setSearchQuery={setSearchQuery}
                openUploadDialog={openUploadDialog}
                onRefresh={() => fetchFiles(currentPath)}
                storage={{ totalBytes: TOTAL_BYTES, usedBytes, loading: isLoading }}
            />

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
                organizationId={orgId}
                onRefresh={() => fetchFiles(currentPath)}
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
