import React, { useState, useCallback, useRef, useEffect } from "react";
import styles from "./UploadResourcescopy.module.css";

import { Text, PrimaryButton, Spinner, DetailsList, DetailsListLayoutMode, IColumn, SelectionMode, IconButton, SearchBox } from "@fluentui/react";
import { Menu, FileText, File, Archive, X, Plus, Folder, Edit2, Clock, ArrowDownAZ, ChevronDown, ArrowUpZA, ArrowUpDown, User } from 'lucide-react';

import { Download, Trash2, RefreshCw, Upload, Search, CirclePlus, AlertTriangle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";

import { uploadSourceFileToBlob, getSourceFileFromBlob, deleteSourceFileFromBlob } from "../../api/api";
import { useAppContext } from "../../providers/AppProviders";
import { formatDate, formatFileSize } from "../../utils/fileUtils";

const ALLOWED_FILE_TYPES = [".pdf", ".csv", ".xlsx", ".xls"];
const EXCEL_FILES = ["csv", "xls", "xlsx"];

interface BlobItem {
    name: string;
    size: number;
    created_on: string;
    last_modified: string;
    content_type: string;
    url: string;
    metadata?: Record<string, string>;
}

interface FolderStructure {
    [key: string]: {
        files: BlobItem[];
        subfolders: FolderStructure;
    };
}

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

const UploadResources: React.FC = () => {
    const { user } = useAppContext();

    const MAX_FILENAME_LENGTH = 48;
    const SPREADSHEET_FILE_LIMIT = 20;

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [currentMessage, setCurrentMessage] = useState<number>(0);

    const [blobItems, setBlobItems] = useState<BlobItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [filteredItems, setFilteredItems] = useState<BlobItem[]>([]);
    const [folderStructure, setFolderStructure] = useState<FolderStructure>({});

    const [showExcelWarning, setShowExcelWarning] = useState<boolean>(false);
    const [excelFiles, setExcelFiles] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadModalRef = useRef<HTMLDivElement>(null);

    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);

    // Utility function to extract folder path from blob name
    const extractFolderPath = (blobName: string, organizationId: string): string => {
        // Remove organization prefix: organization_files/{organizationId}/
        const prefix = `organization_files/${organizationId}/`;
        if (!blobName.startsWith(prefix)) return "";
        
        const relativePath = blobName.substring(prefix.length);
        const lastSlashIndex = relativePath.lastIndexOf("/");
        
        if (lastSlashIndex === -1) return "Root"; // File is in root folder
        return relativePath.substring(0, lastSlashIndex);
    };

    // Build folder structure from blob items
    const buildFolderStructure = (items: BlobItem[]): FolderStructure => {
        const structure: FolderStructure = {};
        
        items.forEach(item => {
            const folderPath = extractFolderPath(item.name, user?.organizationId || "");
            if (!folderPath) return;
            
            const pathParts = folderPath === "Root" ? ["Root"] : folderPath.split("/");
            let current = structure;
            
            // Navigate/create folder structure
            pathParts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        files: [],
                        subfolders: {}
                    };
                }
                
                // If this is the last part, add the file
                if (index === pathParts.length - 1) {
                    current[part].files.push(item);
                } else {
                    current = current[part].subfolders;
                }
            });
        });
        
        return structure;
    };

    // Get unique folder paths for indicators
    const getFolderPaths = (items: BlobItem[]): string[] => {
        const paths = new Set<string>();
        
        items.forEach(item => {
            const folderPath = extractFolderPath(item.name, user?.organizationId || "");
            if (folderPath) {
                paths.add(folderPath);
            }
        });
        
        return Array.from(paths).sort();
    };

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
            console.log("blobItems", blobItems);
            setBlobItems(blobItems);
            setFilteredItems(blobItems);
            
            // Build folder structure
            const structure = buildFolderStructure(blobItems);
            setFolderStructure(structure);
        } catch (error) {
            console.error("Error fetching blob data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user?.organizationId]);

    useEffect(() => {
        fetchBlobData();
    }, [fetchBlobData]);

    const filterItems = useCallback(() => {
        if (!searchQuery.trim()) {
            setFilteredItems(blobItems);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = blobItems.filter(item => item.name.toLowerCase().includes(query) || item.content_type.toLowerCase().includes(query));
            setFilteredItems(filtered);
        }
    }, [searchQuery, blobItems]);

    useEffect(() => {
        filterItems();
    }, [searchQuery, blobItems, filterItems]);

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

    const handleDownload = (item: BlobItem) => {
        const organizationId = user?.organizationId;
        const downloadUrl = `/api/download?organizationId=${organizationId}&blobName=${encodeURIComponent(item.name)}`;
        window.open(downloadUrl, "_blank");
    };

    const handleDelete = async (item: BlobItem) => {
        if (window.confirm(`Are you sure you want to delete ${item.name.split("/").pop()}? (The file will be deleted permanently in 1 day)`)) {
            try {
                await deleteSourceFileFromBlob(item.name);
                fetchBlobData();
            } catch (error) {
                console.error("Error deleting file:", error);
                toast(`Error deleting file`, { type: "error" });
            }
        }
    };

    const openUploadDialog = () => {
        if (user?.role === "user") {
            toast("Only Admins can Upload Files", { type: "warning" });
        } else {
            setIsUploadDialogOpen(true);
            setSelectedFiles([]);
            setUploadProgress(0);
        }
    };

    const closeUploadDialog = () => {
        setIsUploadDialogOpen(false);
        setShowExcelWarning(false);
    };

    // #1
    const checkSpreadsheetFileLimit = (newFiles: File[]): boolean => {
        const existingSpreadsheetCount = blobItems.filter(item => {
            const ext = item.name.split(".").pop()?.toLowerCase();
            return EXCEL_FILES.includes(ext || "");
        }).length;
        const newSpreadsheetCount = newFiles.filter(file => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            return EXCEL_FILES.includes(ext || "");
        }).length;

        if (existingSpreadsheetCount + newSpreadsheetCount > SPREADSHEET_FILE_LIMIT) {
            toast(`Spreadsheet file limit reached: You can only upload up to ${SPREADSHEET_FILE_LIMIT} .csv, .xls, or .xlsx files per organization.`, {
                type: "error"
            });
            return false;
        }
        return true;
    };

    // #2
    const validateFiles = (files: File[], allowedTypes: string[]) => {
        const invalidFiles = files.filter(file => {
            const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
            return !allowedTypes.includes(ext);
        });
        const validFiles = files.filter(f => !invalidFiles.includes(f));

        return { validFiles, invalidFiles };
    };

    // # 3
    const handleUpload = useCallback(
        async (filesToUpload?: File[]) => {
            const duration = 35000;
            const interval = 100;
            const totalSteps = duration / interval;
            const messageInterval = duration / processingMessages.length;

            let step = 0;
            let messageIndex = 0;

            const files = filesToUpload || selectedFiles;
            if (files.length === 0) return;

            setSelectedFiles(files);
            setIsUploading(true);
            setUploadProgress(0);

            const timer = setInterval(() => {
                step++;
                const elapsedTime = step * interval;
                if (elapsedTime >= (messageIndex + 1) * messageInterval) {
                    messageIndex = (messageIndex + 1) % processingMessages.length;
                    setCurrentMessage(messageIndex);
                }
                if (step >= totalSteps) clearInterval(timer);
            }, interval);

            for (let i = 0; i < files.length; i++) {
                try {
                    const fileProgress = (i / files.length) * 100;
                    setUploadProgress(fileProgress);
                    await uploadSourceFileToBlob(files[i], user?.organizationId || "");
                } catch (error) {
                    console.error("Error uploading file:", error);
                    toast(`Error uploading ${files[i].name}. Try again later`, { type: "error" });
                    setIsUploading(false);
                }
            }

            setUploadProgress(100);
            toast("Your files has been uploaded successfully!", { type: "success" });
            setIsUploading(false);
            setSelectedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setIsUploadDialogOpen(false);
            fetchBlobData();
        },
        [selectedFiles, fetchBlobData]
    );

    const handleFiles = (fileArray: File[]) => {
        const { validFiles, invalidFiles } = validateFiles(fileArray, ALLOWED_FILE_TYPES);

        if (invalidFiles.length > 0) {
            toast(`Invalid file type(s): ${invalidFiles.map(f => f.name).join(", ")}. Allowed types: ${ALLOWED_FILE_TYPES.join(", ")}`, {
                type: "warning"
            });
        }

        if (validFiles.length === 0) {
            toast("No valid files to upload.", { type: "error" });
            return;
        }

        if (!checkSpreadsheetFileLimit(validFiles)) {
            toast(`File limit exceeded. Maximum allowed files: ${SPREADSHEET_FILE_LIMIT}`, { type: "error" });
            return;
        }

        const excelFileNames = validFiles
            .filter(file => {
                const extension = file.name.split(".").pop()?.toLowerCase();
                return extension === "xls" || extension === "xlsx";
            })
            .map(file => file.name);

        if (excelFileNames.length > 0) {
            setExcelFiles(excelFileNames);
            setShowExcelWarning(true);
            setSelectedFiles(validFiles);
            return;
        }

        handleUpload(validFiles);
    };

    const handleExcelWarningConfirm = () => {
        setShowExcelWarning(false);
        handleUpload(selectedFiles);
    };

    const handleExcelWarningCancel = () => {
        setShowExcelWarning(false);
        setExcelFiles([]);
        setSelectedFiles([]);
    };

    const onDrop = useCallback((acceptedFiles: any) => {
        handleFiles(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        noClick: true
    });

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
                const folderPath = extractFolderPath(item.name, user?.organizationId || "");
                
                let displayName = fileName;
                if (fileName.length > MAX_FILENAME_LENGTH) {
                    const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                    displayName = fileName.substring(0, MAX_FILENAME_LENGTH - ext.length - 3) + "..." + ext;
                }
                return (
                    <div className={styles.file_name_cell}>
                        <div className={styles.file_info_row}>
                            <Text className={styles.file_text} title={fileName}>
                                {displayName}
                            </Text>
                            <div className={styles.file_extension_pill}>{fileExtension?.toUpperCase() || "FILE"}</div>
                            <div className={styles.file_size_pill}>{formatFileSize(item.size)}</div>
                            {folderPath && folderPath !== "Root" && (
                                <div className={styles.folder_path_pill} title={`Folder: ${folderPath}`}>
                                    📁 {folderPath.length > 20 ? `...${folderPath.slice(-17)}` : folderPath}
                                </div>
                            )}
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
            onRender: (item: BlobItem) => (
                <div className={styles.actions_cell}>
                    <IconButton title="Download" ariaLabel="Download" onClick={() => handleDownload(item)}>
                        <Download className={styles.trashIcon} />
                    </IconButton>
                    <IconButton title="Delete" ariaLabel="Delete" onClick={() => handleDelete(item)}>
                        <Trash2 className={styles.trashIcon} />
                    </IconButton>
                </div>
            )
        }
    ];

    function BoldMessage({ text }: { text: string }) {
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return <>{parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>))}</>;
    }

    return (
        <div className={styles.page_container}>
            {/* Cloud Storage Indicator - Placeholder */}
            <div className={styles.cloud_storage_section}>
                <div className={styles.cloud_storage_header}>
                    <span className={styles.storage_label}>Cloud Storage</span>
                    <span className={styles.storage_usage}>0%</span>
                </div>
                <div className={styles.storage_bar}>
                    <div className={styles.storage_progress} style={{width: '0.3%'}}></div>
                </div>
                <div className={styles.storage_details}>
                    <span className={styles.storage_used}>0.3 MB used</span>
                    <span className={styles.storage_total}>999.7 MB free</span>
                </div>
                <span className={styles.storage_total_label}>1 TB Total Storage</span>
            </div>

            {/* Search and Upload Section */}
            <div className={styles.search_upload_section}>
                <SearchBox
                    placeholder="Search files..."
                    onChange={(_, newValue) => setSearchQuery(newValue || "")}
                    className={styles.search_box}
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
                                size={20}
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
                <button className={styles.upload_file_button} onClick={openUploadDialog}>
                    <Upload size={16} />
                    Upload File
                </button>
            </div>

            {/* Category Filter - Placeholder */}
            <div className={styles.category_section}>
                <span className={styles.category_label}>Category</span>
                <div className={styles.category_filters}>
                    <button className={`${styles.category_button} ${styles.category_active}`}>
                        <div className={styles.category_icon}>📄</div>
                        All
                    </button>
                    <button className={styles.category_button}>
                        <div className={styles.category_icon}>📄</div>
                        Documents
                    </button>
                    <button className={styles.category_button}>
                        <div className={styles.category_icon}>📊</div>
                        Spreadsheets
                    </button>
                    <button className={styles.category_button}>
                        <div className={styles.category_icon}>📋</div>
                        Presentations
                    </button>
                </div>
            </div>

            {/* All Files Section */}
            <div className={styles.all_files_section}>
                <div className={styles.section_header}>
                    <div className={styles.section_title}>
                        <Folder className={styles.section_icon} size={20} />
                        All Files
                    </div>
                    <div className={styles.section_actions}>
                        <button className={styles.new_folder_button}>
                            <Plus size={16} />
                            New Folder
                        </button>
                        <div className={styles.view_options}>
                            <span className={styles.recent_label}>Recent</span>
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>

            <div className={styles.content_container}>
                {/* Folder Structure */}
                {!isLoading && blobItems.length > 0 && (
                    <div className={styles.folder_structure}>
                        {getFolderPaths(blobItems).map((folderPath, index) => {
                            // Count files in this specific folder path
                            const fileCount = blobItems.filter(item => 
                                extractFolderPath(item.name, user?.organizationId || "") === folderPath
                            ).length;
                            if (folderPath === "Root") return null;
                            const folderName = folderPath.split("/").pop() || folderPath;
                            return (
                                <div key={index} className={styles.folder_item}>
                                    <div className={styles.folder_icon_section}>
                                        <Folder className={styles.folder_icon} size={24} color="#f59e0b" />
                                    </div>
                                    <div className={styles.folder_details}>
                                        <div className={styles.folder_name_row}>
                                            <span className={styles.folder_title}>{folderName}</span>
                                            <div className={styles.folder_actions}>
                                                <Edit2 size={16} className={styles.action_icon} />
                                                <Trash2 size={16} className={styles.action_icon} />
                                            </div>
                                        </div>
                                        <div className={styles.folder_meta}>
                                            <span className={styles.file_count_text}>{fileCount} files</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Individual Files */}
                {!isLoading && (
                    <div className={styles.files_list}>
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item, index) => {
                                const fileName = item.name.split("/").pop() || "";
                                const fileExtension = fileName.split(".").pop()?.toLowerCase();
                                const folderPath = extractFolderPath(item.name, user?.organizationId || "");
                                const uploadDate = new Date(item.created_on);
                                const formattedDate = uploadDate.toLocaleDateString('en-US', { 
                                    month: 'numeric', 
                                    day: 'numeric', 
                                    year: '2-digit' 
                                }) + " " + uploadDate.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                });
                                
                                let displayName = fileName;
                                if (fileName.length > MAX_FILENAME_LENGTH) {
                                    const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                                    displayName = fileName.substring(0, MAX_FILENAME_LENGTH - ext.length - 3) + "..." + ext;
                                }

                                return (
                                    <div key={index} className={styles.file_item_row}>
                                        <div className={styles.file_icon_section}>
                                            <div className={styles.file_type_icon}>
                                                {fileExtension === 'pdf' ? '📄' : 
                                                 fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'csv' ? '📊' :
                                                 '📄'}
                                            </div>
                                        </div>
                                        <div className={styles.file_details}>
                                            <div className={styles.file_name_row}>
                                                <span className={styles.file_title} title={fileName}>{displayName}</span>
                                                <div className={styles.file_badges}>
                                                    <span className={styles.file_extension_badge}>{fileExtension?.toUpperCase() || "FILE"}</span>
                                                    <span className={styles.file_size_text}>{formatFileSize(item.size)}</span>
                                                </div>
                                                <div className={styles.file_actions}>
                                                    <Download size={16} className={styles.action_icon} onClick={() => handleDownload(item)} />
                                                    <Trash2 size={16} className={styles.action_icon} onClick={() => handleDelete(item)} />
                                                </div>
                                            </div>
                                            <div className={styles.file_meta}>
                                                <span className={styles.upload_date}>Uploaded on {formattedDate} • John Doe</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className={styles.no_files_message}>
                                <Text>No files found. Upload files to see them listed here.</Text>
                            </div>
                        )}
                    </div>
                )}
                
                {isLoading && (
                    <div className={styles.loading_container}>
                        <Spinner label="Loading files..." />
                    </div>
                )}
            </div>
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
                                ) : !showExcelWarning ? (
                                    <div className={`${styles.dropzone} ${isDragActive ? styles.dropzone_active : ""}`} {...getRootProps()}>
                                        <input aria-label="Dropzone" {...getInputProps()} />

                                        <div>
                                            <label className={styles.file_label}>
                                                <Upload size={48} className={styles.upload_icon} />
                                                <Text variant="large">{isDragActive ? "Drop files here" : "Drag files here or click to browse"}</Text>
                                                <Text variant="medium" color="#4B5563">
                                                    Allowed file types: {ALLOWED_FILE_TYPES.join(", ")}
                                                </Text>
                                            </label>
                                            <button type="button" onClick={open} className={styles.browse_button}>
                                                Browse Files
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.excelWarningContainer}>
                                        <div className={styles.excelWarningHeader}>
                                            <div className={styles.iconWrapper}>
                                                <AlertTriangle className={styles.icon} />
                                            </div>
                                            <h4 className={styles.title}>Excel Files Detected</h4>
                                        </div>

                                        <div className={styles.warningBox}>
                                            <p className={styles.message}>
                                                <strong>Important:</strong> Only the first sheet of each Excel file will be processed.
                                            </p>
                                            <p className={styles.message}>
                                                If your Excel files have multiple sheets, we recommend uploading one file per sheet for complete data
                                                processing.
                                            </p>
                                            <div className={styles.filesList}>
                                                <strong>Excel files detected:</strong>
                                                <ul>
                                                    {excelFiles.map((fileName, index) => (
                                                        <li key={index}>{fileName}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        <div className={styles.actions}>
                                            <button onClick={handleExcelWarningCancel} className={styles.cancelButton}>
                                                Cancel Upload
                                            </button>
                                            <button onClick={handleExcelWarningConfirm} className={styles.confirmButton}>
                                                Continue Anyway
                                            </button>
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
