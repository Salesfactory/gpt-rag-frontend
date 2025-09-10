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
    const { isLoading, filteredItems, deleteFile, setSearchQuery, searchQuery } = useSourceFiles(user?.organizationId || "")
    const { uploadDialogOpen, openUploadDialog, closeUploadDialog, isUploading } = useFileUpload();


    return (
        <div className={styles.page_container}>
            <FileListHeader setSearchQuery={setSearchQuery} openUploadDialog={openUploadDialog} />
            <ResourceList filteredItems={filteredItems} isLoading={isLoading} deleteFile={deleteFile} />
            {uploadDialogOpen && (
                <UploadDialogModal closeUploadDialog={closeUploadDialog} isUploading={isUploading} /> 
            )}
        </div>
    );
};

export default UploadResources;
