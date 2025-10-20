// src/features/UploadResources/hooks/useSourceFiles.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSourceFileFromBlob, deleteSourceFileFromBlob } from '../api/api';
import { toast } from 'react-toastify';
import { BlobItem, FolderItem } from '../types';

export const useSourceFiles = (organizationId: string, category: string = 'all') => {
    const [files, setFiles] = useState<BlobItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchFiles = useCallback(async (folderPath: string = currentPath, fileCategory: string = category) => {
        // Abort any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsLoading(true);
        try {
            const response = await getSourceFileFromBlob(
                organizationId, 
                folderPath, 
                fileCategory, 
                abortController.signal
            );
            
            // Only update state if this request wasn't aborted
            if (!abortController.signal.aborted) {
                setFiles(response.files || []);
                setFolders(response.folders || []);
                setCurrentPath(response.current_path || '');
            }
        } catch (error: any) {
            // Don't show error toast for aborted requests
            if (error.name !== 'AbortError') {
                console.error("Error fetching blob data:", error);
                toast.error("Failed to load files.");
            }
        } finally {
            // Only set loading to false if this request wasn't aborted
            if (!abortController.signal.aborted) {
                setIsLoading(false);
            }
        }
    }, [organizationId, currentPath, category]);

    useEffect(() => {
        if (organizationId) fetchFiles(currentPath, category);
        
        // Cleanup: abort any pending requests when component unmounts
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [organizationId, category]);

    const navigateToFolder = useCallback((folderPath: string) => {
        setCurrentPath(folderPath);
        fetchFiles(folderPath, category);
    }, [fetchFiles, category]);

    const navigateBack = useCallback(() => {
        if (!currentPath) return;
        
        const pathParts = currentPath.split('/').filter(Boolean);
        pathParts.pop(); // Remove last segment
        const newPath = pathParts.join('/');
        
        setCurrentPath(newPath);
        fetchFiles(newPath, category);
    }, [currentPath, fetchFiles, category]);

    const navigateToRoot = useCallback(() => {
        setCurrentPath('');
        fetchFiles('', category);
    }, [fetchFiles, category]);

    const deleteFile = async (item: BlobItem) => {
        if (window.confirm(`Are you sure you want to delete ${item.name.split('/').pop()}? (The file will be deleted permanently in 1 day)`)) {
            try {
                await deleteSourceFileFromBlob(item.name);
                toast.success(`${item.name.split('/').pop()} marked for deletion.`);
                fetchFiles(currentPath, category); 
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