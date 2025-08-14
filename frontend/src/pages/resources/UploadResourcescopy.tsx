import React, { useState, useCallback, useRef, DragEvent, useEffect, useContext } from "react";
import styles from "./UploadResourcescopy.module.css";
import {
    Stack,
    Text,
    PrimaryButton,
    ProgressIndicator,
    MessageBar,
    MessageBarType,
    Spinner,
    DetailsList,
    DetailsListLayoutMode,
    IColumn,
    SelectionMode,
    IconButton,
    SearchBox,
    Dialog,
    DialogType,
    DialogFooter,
    mergeStyleSets
} from "@fluentui/react";
import { DocumentRegular } from "@fluentui/react-icons";
import { FileText, Download, Trash2, RefreshCw, Upload, Search, CirclePlus } from "lucide-react";
import { uploadSourceFileToBlob, getSourceFileFromBlob, deleteSourceFileFromBlob } from "../../api/api";
import { useAppContext } from "../../providers/AppProviders";
import { toast, ToastContainer } from "react-toastify";
const ALLOWED_FILE_TYPES = [".pdf", ".csv", ".xlsx", ".xls"];
const EXCEL_FILES = ["csv", "xls", "xlsx"];

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
    const [currentMessage, setCurrentMessage] = useState<number>(0);
    // States for file list view
    const [blobItems, setBlobItems] = useState<BlobItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [filteredItems, setFilteredItems] = useState<BlobItem[]>([]);
    const uploadModalRef = useRef<HTMLDivElement>(null);

    // Dialog state
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);
    const MAX_FILENAME_LENGTH = 48;

    // Fun processing messages
    const processingMessages = [
        "**Train a neural network to read your files.** We won't build a digital brain that learns patterns from millions of examples, then gets confused by your unique formatting.",
        "**Pit two AI systems against each other.** We won't create fake data by having one AI generate content while another tries to spot the fakes—like a never-ending game of digital forgery.",
        "**Slice your images into tiny pieces.** We won't run algorithms that examine every pixel, looking for edges and patterns like a detective with a magnifying glass.",
        "**Apply fuzzy logic to your numbers.** We won't use rules that work with 'maybe' and 'sort of'—turning clear data into digital soup.",
        "**Run machine learning experiments.** We won't split your data into training sets, test different models, and pick winners like hosting a science fair for algorithms.",
        "**Hunt for perfect settings.** We won't spend hours testing thousands of parameter combinations, like tuning a radio to find the perfect station that doesn't exist.",
        "**Memorize your specific files too well.** We won't create a system so tailored to your data that it fails the moment it sees anything new—like a student who only knows yesterday's test answers.",
        "**Set up reward systems for AI agents.** We won't create digital entities that learn by trial and error, wandering through your files like lost tourists collecting stamps.",
        "**Break your text into subword pieces.** We won't tokenize every sentence and run it through layers of attention mechanisms that decide which words matter most—like having a committee debate every phrase."
    ];
    // Define columns for DetailsList
    const columns: IColumn[] = [
        {
            key: "files",
            name: "Files",
            fieldName: "files",
            minWidth: 500,
            maxWidth: 1300,
            isResizable: true,
            onRender: (item: BlobItem) => {
                const fileName = item.name.split("/").pop() || "";
                const fileExtension = fileName.split(".").pop()?.toLowerCase();

                const maxLength = MAX_FILENAME_LENGTH;
                let displayName = fileName;
                if (fileName.length > maxLength) {
                    const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                    displayName = fileName.substring(0, maxLength - ext.length - 3) + "..." + ext;
                }

                return (
                    <div className={styles.file_name_cell}>
                        <div className={styles.file_info_row}>
                            <Text className={styles.file_text} title={fileName}>
                                {displayName}
                            </Text>
                            <div className={styles.file_extension_pill}>{fileExtension?.toUpperCase() || "FILE"}</div>
                            <div className={styles.file_size_pill}>{formatFileSize(item.size)}</div>
                        </div>
                        <span>Uploaded on {formatDate(item.created_on)}</span>
                    </div>
                );
            }
        },
        {
            key: "actions",
            name: "Actions",
            minWidth: 100,
            maxWidth: 70,
            isResizable: false,
            isPadded: false,
            onRender: (item: BlobItem) => {
                return (
                    <div className={styles.actions_cell}>
                        <IconButton title="Download" ariaLabel="Download" onClick={() => handleDownload(item)}>
                            <Download className={styles.trashIcon} />
                        </IconButton>
                        <IconButton title="Delete" ariaLabel="Delete" onClick={() => handleDelete(item)}>
                            <Trash2 className={styles.trashIcon} />
                        </IconButton>
                    </div>
                );
            }
        }
    ];

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };

    // Format date
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    // Handle download
    const handleDownload = (item: BlobItem) => {
        const organizationId = user?.organizationId;

        const downloadUrl = `/api/download?organizationId=${organizationId}&blobName=${encodeURIComponent(item.name)}`;

        window.open(downloadUrl, "_blank");
    };

    // Handle delete
    const handleDelete = async (item: BlobItem) => {
        if (window.confirm(`Are you sure you want to delete ${item.name.split("/").pop()}? (The file will be deleted permanently in 1 day)`)) {
            try {
                await deleteSourceFileFromBlob(item.name);
                setUploadStatus({
                    message: `File ${item.name.split("/").pop()} deleted successfully`,
                    type: MessageBarType.success
                });
                // Refresh the blob list
                fetchBlobData();
            } catch (error) {
                console.error("Error deleting file:", error);
                setUploadStatus({
                    message: `Error deleting file: ${error instanceof Error ? error.message : "Unknown error"}`,
                    type: MessageBarType.error
                });
            }
        }
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
            console.error("Error fetching blob data:", error);
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
            const filtered = blobItems.filter(item => item.name.toLowerCase().includes(query) || item.content_type.toLowerCase().includes(query));
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
        handleUpload(fileArray);
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
        setIsDragging(true);
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
        handleUpload();
    };

    const handleUpload = useCallback(
        async (filesToUpload?: File[]) => {
            const files = filesToUpload || selectedFiles;
            if (files.length === 0) {
                console.log("No files to upload");
                return;
            }

            setIsUploading(true);
            setUploadProgress(0);
            setUploadStatus(null);

            const urls: string[] = [];
            let successful = 0;

            // Start the fun processing animation
            const duration = 35000; // 35 seconds
            const interval = 100; // Update every 100ms
            const totalSteps = duration / interval;
            const progressIncrement = 100 / totalSteps;
            const messageInterval = duration / processingMessages.length;

            let step = 0;
            let messageIndex = 0;

            const timer = setInterval(() => {
                step++;

                // Change message every messageInterval milliseconds
                const elapsedTime = step * interval;
                if (elapsedTime >= (messageIndex + 1) * messageInterval) {
                    messageIndex = (messageIndex + 1) % processingMessages.length; // 🔄 Loop infinito
                    setCurrentMessage(messageIndex);
                }

                if (step >= totalSteps) {
                    clearInterval(timer);
                }
            }, interval);

            for (let i = 0; i < files.length; i++) {
                try {
                    // Calculate progress for each file
                    const fileProgress = (i / files.length) * 100;
                    setUploadProgress(fileProgress);

                    // Upload the file with organization ID
                    const result = await uploadSourceFileToBlob(files[i], user?.organizationId || "");

                    if (result && result.blob_url) {
                        urls.push(result.blob_url);
                        successful++;
                    }
                } catch (error) {
                    console.error("Error uploading file:", error);
                    setUploadStatus({
                        message: `Error uploading ${files[i].name}: ${error instanceof Error ? error.message : "Unknown error"}`,
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
                message: `Successfully uploaded ${successful} file${successful !== 1 ? "s" : ""}`,
                type: MessageBarType.success
            });
            toast("Your file has been uploaded successfully!", {
                type: "success"
            })
            setIsUploading(false);
            setSelectedFiles([]);

            // Reset the file input
            if (fileInputRef.current) fileInputRef.current.value = "";

            // Refresh the blob list
            fetchBlobData();
        },
        [selectedFiles, fetchBlobData]
    );

    const clearSelection = () => {
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Open upload dialog
    const openUploadDialog = () => {
        if (user?.role === "user") {
            toast("Only Admins can Upload Files", {
                type: "warning"
            });
        } else {
            setIsUploadDialogOpen(true);
            setSelectedFiles([]);
            setUploadStatus(null);
            setUploadProgress(0);
        }
    };

    // Close upload dialog
    const closeUploadDialog = () => {
        setIsUploadDialogOpen(false);
    };

    useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (uploadModalRef.current && !uploadModalRef.current.contains(event.target as Node)) {
                    closeUploadDialog();
                }
            };
    
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }, []);

    // Dialog content type
    const dialogContentProps = {
        type: DialogType.normal,
        title: "Upload Files",
        closeButtonAriaLabel: "Close",
        subText: "Select files to upload to blob storage"
    };


    function BoldMessage({ text }: { text: string }) {
        // We split the text using regex, preserving the content within **
        const parts = text.split(/\*\*(.*?)\*\*/g);

        return (
            <>
                {parts.map((part, index) =>
                    index % 2 === 1 ? (
                        <strong key={index}>{part}</strong> // Esto es lo que estaba entre **
                    ) : (
                        <span key={index}>{part}</span>
                    )
                )}
            </>
        );
    }

    return (
        <div className={styles.page_container}>
            <ToastContainer />
            <div className={styles.file_list_header}>
                <SearchBox
                    placeholder="Search files..."
                    onChange={(_, newValue) => setSearchQuery(newValue || "")}
                    className={styles.responsiveSearch}
                    iconProps={{
                        iconName: undefined,
                        styles: {
                            root: {
                                fontSize: "20px",
                                color: "#9ca3af"
                            }
                        },
                        children: (
                            <Search
                                size={26}
                                color="#9ca3af"
                                style={{
                                    paddingBottom: "3px"
                                }}
                            />
                        )
                    }}
                    styles={{
                        root: {
                            height: "40px",
                            borderRadius: "0.5rem",
                            border: "1px solid #e5e7eb",
                            position: "relative",
                            selectors: {
                                ":focus-within": {
                                    outline: "none"
                                },
                                "::after": {
                                    border: "none !important",
                                    display: "none !important"
                                }
                            }
                        },
                        field: {
                            fontSize: "16px",
                            selectors: {
                                ":focus": {
                                    outline: "none"
                                },
                                ":focus-visible": {
                                    outline: "none"
                                },
                                "::placeholder": {
                                    color: "#9ca3af",
                                    fontSize: "16px"
                                }
                            }
                        }
                    }}
                />
                <div className={styles.file_list_actions}>
                    <IconButton title="Upload New Files" ariaLabel="Upload New Files" onClick={openUploadDialog} className={styles.upload_button}>
                        <span className={styles.addIcon}>
                            <CirclePlus />
                        </span>
                        <span className={styles.buttonText}>Upload File</span>
                    </IconButton>

                    <IconButton title="Reload" ariaLabel="Reload file list" onClick={fetchBlobData} className={styles.refresh_button}>
                        <RefreshCw size={20} />
                    </IconButton>
                </div>
            </div>
            <div className={styles.content_container} style={{ minHeight: "60vh", height: "65vh", maxHeight: "75vh", overflowY: "auto" }}>
                {/* File List View Section */}
                {isLoading ? (
                    <div className={styles.loading_container}>
                        <Spinner label="Loading files..." />
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className={styles.file_list_container} style={{ minHeight: "50vh", height: "55vh", maxHeight: "70vh", overflowY: "auto" }}>
                        <DetailsList
                            items={filteredItems}
                            columns={columns}
                            setKey="set"
                            layoutMode={DetailsListLayoutMode.justified}
                            selectionMode={SelectionMode.none}
                            isHeaderVisible={true}
                            className={styles.detailsListContainer}
                            styles={{
                                root: {
                                    borderRadius: "8px"
                                }
                            }}
                            onRenderRow={(props, defaultRender) => {
                                if (!props || !defaultRender) return null;

                                const backgroundColor = "#ffffff";

                                const customStyles = {
                                    root: {
                                        backgroundColor
                                    },
                                    fields: {
                                        backgroundColor
                                    }
                                };

                                return defaultRender({
                                    ...props,
                                    styles: customStyles
                                });
                            }}
                        />
                    </div>
                ) : (
                    <div className={styles.no_files_container}>
                        <Text>No files found. Upload files to see them listed here.</Text>
                    </div>
                )}
            </div>

            {/* Upload Dialog */}

            {isUploadDialogOpen && (
                <div className={styles.custom_modal_overlay}>
                    <div className={styles.custom_modal} ref={uploadModalRef}>
                        {/* Modal Header */}
                        <div className={styles.modal_header}>
                            <h4>Upload Files</h4>
                            <p className={styles.modal_subtext}>Select files to upload to blob storage</p>
                        </div>
                        <div className={styles.modal_content}>
                            {/* Modal Content */}
                            <div className={styles.upload_dialog_content}>
                                {isUploading ? (
                                    <div className={styles.processing_container}>
                                        {/* File names */}
                                        <div className={styles.processing_files}>
                                            <span className={styles.processing_files_loader_msg}>Processing Files</span>
                                            <div className={styles.processing_files_name}>
                                                {selectedFiles.map((file, index) => (
                                                    <div key={index}>{file.name}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Spinner */}
                                        <div className={styles.spinner_container}>
                                            <div className={styles.spinner}>
                                                {[...Array(8)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={styles.spinner_dot}
                                                        style={{
                                                            backgroundColor: i === 7 ? "#065f46" : i === 6 ? "#047857" : i === 0 ? "#059669" : "#d1fae5",
                                                            transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-24px)`,
                                                            animationDelay: `${i * 0.125}s`
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span className={styles.processing_footer}>Processing</span>
                                        </div>
                                        <div className={styles.message_container}>
                                            <h5 className={styles.message_title}>
                                                Here's a little peek behind the curtain at what we{" "}
                                                <em>
                                                    absolutely will <strong>not</strong>
                                                </em>{" "}
                                                do to your files while we process them—because simplicity rules, and complexity drools:
                                            </h5>
                                            <div className={styles.message_body}>
                                                <div className={styles.message_line}>
                                                    <span className={styles.message_bullet}>•</span>
                                                    <div className={styles.message_text}>
                                                        <BoldMessage text={processingMessages[currentMessage] || ""} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`${styles.dropzone} ${isDragging ? styles.dropzone_active : ""}`}
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
                                            accept={ALLOWED_FILE_TYPES.join(",")}
                                        />
                                        <div>
                                            <label htmlFor="file-upload" className={styles.file_label}>
                                                <Upload size={48} className={styles.upload_icon} />
                                                <Text variant="large">{isDragging ? "Drop files here" : "Drag files here or click to browse"}</Text>
                                                <Text variant="medium" color="#4B5563">
                                                    Allowed file types: {ALLOWED_FILE_TYPES.join(", ")}
                                                </Text>
                                            </label>
                                            <label className={styles.browse_button}>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".docx,.xls,.xlsx,.csv,.pdf"
                                                    onChange={handleFileSelect}
                                                    className={styles.hidden_file_input}
                                                />
                                                Browse Files
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            {!isUploading && (
                                <div className={styles.modal_footer}>
                                    <PrimaryButton
                                        onClick={closeUploadDialog}
                                        text="Cancel"
                                        styles={{
                                            root: {
                                                backgroundColor: "#d83b01 !important",
                                                borderColor: "#d83b01 !important",
                                                color: "white !important",
                                                borderRadius: "0.5rem"
                                            },
                                            rootHovered: {
                                                backgroundColor: "#a42600 !important",
                                                borderColor: "#a42600 !important",
                                                color: "white !important",
                                                borderRadius: "0.5rem"
                                            },
                                            rootPressed: {
                                                backgroundColor: "#a42600 !important",
                                                borderColor: "#a42600 !important",
                                                color: "white !important",
                                                borderRadius: "0.5rem"
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadResources;
