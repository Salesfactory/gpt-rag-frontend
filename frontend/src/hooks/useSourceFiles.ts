// src/features/UploadResources/hooks/useSourceFiles.ts
import { useState, useEffect, useCallback } from 'react';
import { getSourceFileFromBlob, deleteSourceFileFromBlob } from '../api/api';
import { toast } from 'react-toastify';

export const useSourceFiles = (organizationId: string) => {
    const [items, setItems] = useState<BlobItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await getSourceFileFromBlob(organizationId);
            console.log("Fetched blob data:", response.data);
            setItems(response.data);
        } catch (error) {
            console.error("Error fetching blob data:", error);
            toast.error("Failed to load files.");
        } finally {
            setIsLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        if (organizationId) fetchFiles();
    }, [fetchFiles, organizationId]);

    const deleteFile = async (item: BlobItem) => {
        if (window.confirm(`Are you sure you want to delete ${item.name.split('/').pop()}? (The file will be deleted permanently in 1 day)`)) {
            try {
                await deleteSourceFileFromBlob(item.name);
                toast.success(`${item.name.split('/').pop()} marked for deletion.`);
                fetchFiles(); 
            } catch (error) {
                console.error("Error deleting file:", error);
                toast.error("Failed to delete file.");
            }
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
        isLoading,
        filteredItems,
        searchQuery,
        setSearchQuery,
        fetchFiles,
        deleteFile,
    };
};