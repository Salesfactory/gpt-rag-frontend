// src/features/UploadResources/hooks/useSourceFiles.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSourceFileFromBlob, deleteSourceFileFromBlob, getBlobSasUrl, getStorageUsageByOrganization} from '../api/api';
import { toast } from 'react-toastify';
import { BlobItem, FolderItem } from '../types';

export const useSourceFiles = (organizationId: string, category: string = 'all', user?: any) => {
    const [files, setFiles] = useState<BlobItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchFiles = useCallback(async (folderPath: string = currentPath, fileCategory: string = category, order: "newest" | "oldest" = sortOrder) => {
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
                order,
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
    }, [organizationId, currentPath, category, sortOrder]);

    useEffect(() => {
        if (organizationId) fetchFiles(currentPath, category, sortOrder);
        
        // Cleanup: abort any pending requests when component unmounts
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [organizationId, category, sortOrder]);

    const navigateToFolder = useCallback((folderPath: string) => {
        setCurrentPath(folderPath);
        fetchFiles(folderPath, category, sortOrder);
    }, [fetchFiles, category, sortOrder]);

    const navigateBack = useCallback(() => {
        if (!currentPath) return;
        
        const pathParts = currentPath.split('/').filter(Boolean);
        pathParts.pop(); // Remove last segment
        const newPath = pathParts.join('/');
        
        setCurrentPath(newPath);
        fetchFiles(newPath, category, sortOrder);
    }, [currentPath, fetchFiles, category, sortOrder]);

    const navigateToRoot = useCallback(() => {
        setCurrentPath('');
        fetchFiles('', category, sortOrder);
    }, [fetchFiles, category, sortOrder]);

    const deleteFile = async (item: BlobItem) => {
        if (window.confirm(`Are you sure you want to delete ${item.name.split('/').pop()}? (The file will be deleted permanently in 1 day)`)) {
            try {
                await deleteSourceFileFromBlob(item.name);
                toast.success(`${item.name.split('/').pop()} marked for deletion.`);
                fetchFiles(currentPath, category, sortOrder); 
            } catch (error) {
                toast.error("Failed to delete file.");
            }
        }
    };

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prevOrder) => (prevOrder === "newest" ? "oldest" : "newest"));
    }, []);

    // Filter both files and folders based on search query
    const filteredFiles = files.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredFolders = folders.filter(folder =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownload = async (item: BlobItem) => {
        const downloadUrl = await getBlobSasUrl(item.name);
        window.open(downloadUrl, "_blank");
    };

    const getStorageUsage = async () => {
        try {
            const storageUsage = await getStorageUsageByOrganization(organizationId, user);
            return storageUsage.data;
        } catch (error) {
            console.error("Error fetching storage usage:", error);
            toast.error("Failed to load storage usage.");
        }
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
        sortOrder,
        toggleSortOrder,
        getStorageUsage    
    };
};