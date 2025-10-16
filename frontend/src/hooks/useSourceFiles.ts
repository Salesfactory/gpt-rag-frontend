// src/features/UploadResources/hooks/useSourceFiles.ts
import { useState, useEffect, useCallback } from 'react';
import { getSourceFileFromBlob, deleteSourceFileFromBlob } from '../api/api';
import { toast } from 'react-toastify';
import { BlobItem, FolderItem } from '../types';

export const useSourceFiles = (organizationId: string) => {
    const [files, setFiles] = useState<BlobItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');

    const fetchFiles = useCallback(async (folderPath: string = currentPath) => {
        setIsLoading(true);
        try {
            const response = await getSourceFileFromBlob(organizationId, folderPath);
            setFiles(response.files || []);
            setFolders(response.folders || []);
            setCurrentPath(response.current_path || '');
        } catch (error) {
            console.error("Error fetching blob data:", error);
            toast.error("Failed to load files.");
        } finally {
            setIsLoading(false);
        }
    }, [organizationId, currentPath]);

    useEffect(() => {
        if (organizationId) fetchFiles('');
    }, [organizationId]);

    const navigateToFolder = useCallback((folderPath: string) => {
        setCurrentPath(folderPath);
        fetchFiles(folderPath);
    }, [fetchFiles]);

    const navigateBack = useCallback(() => {
        if (!currentPath) return;
        
        const pathParts = currentPath.split('/').filter(Boolean);
        pathParts.pop(); // Remove last segment
        const newPath = pathParts.join('/');
        
        setCurrentPath(newPath);
        fetchFiles(newPath);
    }, [currentPath, fetchFiles]);

    const navigateToRoot = useCallback(() => {
        setCurrentPath('');
        fetchFiles('');
    }, [fetchFiles]);

    const deleteFile = async (item: BlobItem) => {
        if (window.confirm(`Are you sure you want to delete ${item.name.split('/').pop()}? (The file will be deleted permanently in 1 day)`)) {
            try {
                await deleteSourceFileFromBlob(item.name);
                toast.success(`${item.name.split('/').pop()} marked for deletion.`);
                fetchFiles(currentPath); 
            } catch (error) {
                toast.error("Failed to delete file.");
            }
        }
    };

    // Filter both files and folders based on search query
    const filteredFiles = files.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredFolders = folders.filter(folder =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownload = (item: BlobItem) => {
        const downloadUrl = `/api/download?organizationId=${organizationId}&blobName=${encodeURIComponent(item.name)}`;
        window.open(downloadUrl, "_blank");
    };

    return {
        isLoading,
        files,
        folders,
        filteredFiles,
        filteredFolders,
        currentPath,
        searchQuery,
        setSearchQuery,
        fetchFiles,
        navigateToFolder,
        navigateBack,
        navigateToRoot,
        handleDownload,
        deleteFile,
    };
};