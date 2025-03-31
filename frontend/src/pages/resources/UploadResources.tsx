import React, { useState, useCallback, useRef, DragEvent, useEffect, useContext } from "react";
import styles from "./UploadResources.module.css";
import { Stack, Text, PrimaryButton, ProgressIndicator, MessageBar, MessageBarType, Spinner, DetailsList, DetailsListLayoutMode, IColumn, SelectionMode, IconButton, SearchBox, Dialog, DialogType, DialogFooter } from "@fluentui/react";
import { DocumentRegular, ArrowUploadRegular, ArrowDownloadRegular, SearchRegular, DeleteRegular, AddRegular, ArrowClockwiseRegular } from "@fluentui/react-icons";
import { uploadSourceFileToBlob, getSourceFileFromBlob, deleteSourceFileFromBlob } from "../../api/api";
import { useAppContext } from "../../providers/AppProviders";
const ALLOWED_FILE_TYPES = [".pdf"];
const CONTAINER_NAME = "documents";

// Interface for blob data
interface BlobItem {
  name: string;
  size: number;
  created_on: string;
  last_modified: string;
  content_type: string;
  url: string;
  metadata?: Record<string, string>;
}

const UploadResources: React.FC = () => {

    const { user } = useAppContext();

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadStatus, setUploadStatus] = useState<{
        message: string;
        type: MessageBarType;
    } | null>(null);
    const [blobUrls, setBlobUrls] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // States for file list view
    const [blobItems, setBlobItems] = useState<BlobItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filteredItems, setFilteredItems] = useState<BlobItem[]>([]);
    
    // Dialog state
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);

    // Define columns for DetailsList
    const columns: IColumn[] = [
        { 
            key: 'name', 
            name: 'Name', 
            fieldName: 'name', 
            minWidth: 200, 
            maxWidth: 350,
            isResizable: true,
            onRender: (item: BlobItem) => {
                return (
                    <div className={styles.file_name_cell}>
                        <DocumentRegular className={styles.file_icon} />
                        <Text>{item.name.split('/').pop()}</Text>
                    </div>
                );
            }
        },
        { 
            key: 'size', 
            name: 'Size', 
            fieldName: 'size', 
            minWidth: 70, 
            maxWidth: 90,
            isResizable: true,
            onRender: (item: BlobItem) => {
                return <Text>{formatFileSize(item.size)}</Text>;
            }
        },
        { 
            key: 'created_on', 
            name: 'Created', 
            fieldName: 'created_on', 
            minWidth: 100, 
            maxWidth: 150,
            isResizable: true,
            onRender: (item: BlobItem) => {
                return <Text>{formatDate(item.created_on)}</Text>;
            }
        },
        { 
            key: 'content_type', 
            name: 'Type', 
            fieldName: 'content_type', 
            minWidth: 100, 
            maxWidth: 150,
            isResizable: true
        },
        { 
            key: 'actions', 
            name: 'Actions', 
            minWidth: 100, 
            maxWidth: 100,
            onRender: (item: BlobItem) => {
                return (
                    <div className={styles.actions_cell}>
                        <IconButton 
                            title="Download"
                            ariaLabel="Download"
                            onClick={() => handleDownload(item)}
                        >
                            <ArrowDownloadRegular />
                        </IconButton>
                    </div>
                );
            }
        },
    ];

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    // Format date
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    // Handle download
    const handleDownload = (item: BlobItem) => {
        window.open(item.url, '_blank');
    };

    // Fetch blob data
    const fetchBlobData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await getSourceFileFromBlob(user?.organizationId || "");
            const blobItems = response.data.map((item: any) => ({
                name: item.name,
                size: item.size,
                created_on: item.created_on,
                content_type: item.content_type,
                url: item.url
            }));
            setBlobItems(blobItems);
            setFilteredItems(blobItems);
        } catch (error) {
            console.error('Error fetching blob data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Filter items based on search query
    const filterItems = useCallback(() => {
        if (!searchQuery.trim()) {
            setFilteredItems(blobItems);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = blobItems.filter(item => 
                item.name.toLowerCase().includes(query) || 
                item.content_type.toLowerCase().includes(query)
            );
            setFilteredItems(filtered);
        }
    }, [searchQuery, blobItems]);

    // Call filterItems when search query or blob items change
    useEffect(() => {
        filterItems();
    }, [searchQuery, blobItems, filterItems]);

    // Fetch blob data on component mount
    useEffect(() => {
        fetchBlobData();
    }, [fetchBlobData]);

    // Refresh blob list after successful upload
    useEffect(() => {
        if (uploadStatus?.type === MessageBarType.success) {
            fetchBlobData();
            // Close dialog on successful upload
            setIsUploadDialogOpen(false);
        }
    }, [uploadStatus, fetchBlobData]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        // Convert FileList to array for easier manipulation
        const fileArray = Array.from(files);
        
        // Validate file types
        const invalidFiles = fileArray.filter(file => {
            const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
            return !ALLOWED_FILE_TYPES.includes(extension);
        });

        if (invalidFiles.length > 0) {
            setUploadStatus({
                message: `Invalid file type(s): ${invalidFiles.map(f => f.name).join(", ")}. Allowed types: ${ALLOWED_FILE_TYPES.join(", ")}`,
                type: MessageBarType.error
            });
            return;
        }

        setSelectedFiles(fileArray);
        setUploadStatus(null);
    };

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        // Convert FileList to array for easier manipulation
        const fileArray = Array.from(files);
        
        // Validate file types
        const invalidFiles = fileArray.filter(file => {
            const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
            return !ALLOWED_FILE_TYPES.includes(extension);
        });

        if (invalidFiles.length > 0) {
            setUploadStatus({
                message: `Invalid file type(s): ${invalidFiles.map(f => f.name).join(", ")}. Allowed types: ${ALLOWED_FILE_TYPES.join(", ")}`,
                type: MessageBarType.error
            });
            return;
        }

        setSelectedFiles(fileArray);
        setUploadStatus(null);
    };

    const handleUpload = useCallback(async () => {
        if (selectedFiles.length === 0) return;
        
        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatus(null);
        
        const urls: string[] = [];
        let successful = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            try {
                // Calculate progress for each file
                const fileProgress = (i / selectedFiles.length) * 100;
                setUploadProgress(fileProgress);
                
                // Upload the file
                const result = await uploadSourceFileToBlob(selectedFiles[i]);
                
                if (result && result.blob_url) {
                    urls.push(result.blob_url);
                    successful++;
                }
            } catch (error) {
                console.error("Error uploading file:", error);
                setUploadStatus({
                    message: `Error uploading ${selectedFiles[i].name}: ${error instanceof Error ? error.message : "Unknown error"}`,
                    type: MessageBarType.error
                });
                setIsUploading(false);
                return;
            }
        }

        // All files uploaded successfully
        setUploadProgress(100);
        setBlobUrls(urls);
        setUploadStatus({
            message: `Successfully uploaded ${successful} file${successful !== 1 ? 's' : ''}`,
            type: MessageBarType.success
        });
        setIsUploading(false);
        setSelectedFiles([]);
        
        // Reset the file input
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        // Refresh the blob list
        fetchBlobData();
    }, [selectedFiles, fetchBlobData]);

    const clearSelection = () => {
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    
    // Open upload dialog
    const openUploadDialog = () => {
        setIsUploadDialogOpen(true);
        setSelectedFiles([]);
        setUploadStatus(null);
        setUploadProgress(0);
    };
    
    // Close upload dialog
    const closeUploadDialog = () => {
        setIsUploadDialogOpen(false);
        clearSelection();
    };
    
    // Dialog content type
    const dialogContentProps = {
        type: DialogType.normal,
        title: 'Upload Files',
        closeButtonAriaLabel: 'Close',
        subText: 'Select files to upload to blob storage',
    };

    return (
        <div className={styles.page_container}>
            <h1>Resource Management</h1>

            <div className={styles.content_container}>
                {/* File List View Section */}
                <div className={styles.file_list_section}>
                    <div className={styles.file_list_header}>
                        <Text variant="xLarge">Uploaded Files</Text>
                        <div className={styles.file_list_actions}>
                            <SearchBox 
                                placeholder="Search files..."
                                onChange={(_, newValue) => setSearchQuery(newValue || '')}
                                className={styles.search_box}
                            />
                            
                            <IconButton
                                title="Upload New Files"
                                ariaLabel="Upload New Files"
                                onClick={openUploadDialog}
                                className={styles.upload_button}
                            >
                                <AddRegular />
                            </IconButton>
                            
                            <IconButton
                                title="Reload"
                                ariaLabel="Reload file list"
                                onClick={fetchBlobData}
                                className={styles.refresh_button}
                            >
                                <ArrowClockwiseRegular />
                            </IconButton>
                            
                            <IconButton
                                title="Search"
                                ariaLabel="Search file list"
                                onClick={fetchBlobData}
                                className={styles.refresh_button}
                            >
                                <SearchRegular />
                            </IconButton>
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <div className={styles.loading_container}>
                            <Spinner label="Loading files..." />
                        </div>
                    ) : filteredItems.length > 0 ? (
                        <div className={styles.file_list_container}>
                            <DetailsList
                                items={filteredItems}
                                columns={columns}
                                setKey="set"
                                layoutMode={DetailsListLayoutMode.justified}
                                selectionMode={SelectionMode.none}
                                isHeaderVisible={true}
                            />
                        </div>
                    ) : (
                        <div className={styles.no_files_container}>
                            <Text>No files found. Upload files to see them listed here.</Text>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Upload Dialog */}
            <Dialog
                hidden={!isUploadDialogOpen}
                onDismiss={closeUploadDialog}
                dialogContentProps={dialogContentProps}
                minWidth={700}
                modalProps={{
                    isBlocking: false,
                    styles: { main: { maxWidth: 800 } },
                }}
            >
                <div className={styles.upload_dialog_content}>
                    <div 
                        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            ref={fileInputRef}
                            multiple
                            onChange={handleFileSelect}
                            className={styles.file_input}
                            accept={ALLOWED_FILE_TYPES.join(',')}
                        />
                        <label htmlFor="file-upload" className={styles.file_label}>
                            <ArrowUploadRegular className={styles.upload_icon} />
                            <Text>{isDragging ? 'Drop files here' : 'Drag files here or click to browse'}</Text>
                            <Text variant="small">Allowed file types: {ALLOWED_FILE_TYPES.join(", ")}</Text>
                        </label>
                    </div>
                    
                    {selectedFiles.length > 0 && (
                        <div className={styles.selected_files}>
                            <Text variant="mediumPlus">Selected Files ({selectedFiles.length})</Text>
                            <Stack tokens={{ childrenGap: 8 }}>
                                {selectedFiles.map((file, index) => (
                                    <div key={index} className={styles.file_item}>
                                        <DocumentRegular />
                                        <Text>{file.name}</Text>
                                        <Text className={styles.file_size}>
                                            ({(file.size / 1024).toFixed(2)} KB)
                                        </Text>
                                    </div>
                                ))}
                            </Stack>
                        </div>
                    )}
                    
                    {isUploading && (
                        <div className={styles.progress_container}>
                            <Text>Uploading files...</Text>
                            <ProgressIndicator 
                                percentComplete={uploadProgress / 100} 
                                description={`${Math.round(uploadProgress)}% complete`}
                            />
                        </div>
                    )}
                    
                    {uploadStatus && (
                        <MessageBar
                            messageBarType={uploadStatus.type}
                            isMultiline={true}
                            dismissButtonAriaLabel="Close"
                            className={styles.message_bar}
                        >
                            {uploadStatus.message}
                        </MessageBar>
                    )}
                </div>
                
                <DialogFooter>
                    <PrimaryButton 
                        onClick={handleUpload} 
                        disabled={isUploading || selectedFiles.length === 0}
                        text="Upload"
                    />
                    <PrimaryButton 
                        onClick={closeUploadDialog} 
                        text="Cancel"
                        styles={{ root: { backgroundColor: '#d83b01' } }}
                    />
                </DialogFooter>
            </Dialog>
        </div>
    );
};

export default UploadResources;
