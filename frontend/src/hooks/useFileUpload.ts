import { useState } from "react";

export const useFileUpload = () => {
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);


    const openUploadDialog = () => setUploadDialogOpen(true);
    const closeUploadDialog = () => {
        setUploadDialogOpen(false);
    };

    return {
        uploadDialogOpen,
        openUploadDialog,
        closeUploadDialog,
        isUploading,
    }
}