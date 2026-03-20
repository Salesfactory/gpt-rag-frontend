import { toast } from "react-toastify";
import styles from "./Gallery.module.css";
import {
    ArrowUpDown,
    Download,
    Search,
    Trash2,
    Upload,
    Users,
    ChevronLeft,
    ChevronRight,
    Filter,
    PresentationIcon,
    FileText,
    Table,
    ChevronDown,
    ChevronUp,
    Eye,
    X,
    Pencil,
    Check
} from "lucide-react";
import { SearchBox, Spinner } from "@fluentui/react";
import { useEffect, useState, useRef, useMemo, lazy, Suspense } from "react";

const PptxViewer = lazy(() => import("../../components/DocView/PPTXViewer"));
import { deleteSourceFileFromBlob, getBlobSasUrl, getGalleryItems, getGoogleEditableFileRedirectUrl, getUsers } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import DeleteConfirmModal from "../../components/DeleteConfirmModal/DeleteConfirmModal";

const statusFilterOptions = [
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" }
];

const fileTypeFilterOptions = [
    { label: "All Types", value: "all" },
    { label: "Images", value: "images" },
    { label: "PowerPoint", value: "pptx" }
] as const;

type FileTypeFilter = (typeof fileTypeFilterOptions)[number]["value"];

type GalleryItem = {
    content_type: string;
    created_on: string;
    last_modified: string;
    metadata: {
        user_id?: string;
        artifact_desc?: string;
    };
    name: string;
    size: number;
    url: string;
};

type UserData = {
    id: string;
    data: {
        name: string;
    };
    [key: string]: any;
};

type User = {
    id: string;
    name: string;
};

type OfficeExtension = ".pptx" | ".docx" | ".xlsx";

const getOfficeExtension = (fileName: string): OfficeExtension | null => {
    const normalizedName = fileName.toLowerCase();
    if (normalizedName.endsWith(".pptx")) return ".pptx";
    if (normalizedName.endsWith(".docx")) return ".docx";
    if (normalizedName.endsWith(".xlsx")) return ".xlsx";
    return null;
};

const getGoogleEditorLabel = (fileName: string): "Google Docs" | "Google Slides" | "Google Sheets" => {
    const extension = getOfficeExtension(fileName);
    if (extension === ".pptx") return "Google Slides";
    if (extension === ".xlsx") return "Google Sheets";
    return "Google Docs";
};

const shouldUseDocumentViewer = (fileName: string) => {
    return getOfficeExtension(fileName) !== null;
};

const GalleryCard: React.FC<{
    file: GalleryItem;
    onDownload: (item: GalleryItem) => void;
    onDelete: (item: GalleryItem) => void;
    onPreview: (item: GalleryItem) => void;
    onEdit: (item: GalleryItem) => void;
    getUserName: (id: string) => string | undefined;
    createFileName: (name: string) => string;
    formatFileSize: (bytes: number) => string;
}> = ({ file, onDownload, onDelete, onPreview, onEdit, getUserName, createFileName, formatFileSize }) => {
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const officeExtension = getOfficeExtension(file.name);
    const isGoogleEditableFile = officeExtension !== null;
    const googleEditorLabel = getGoogleEditorLabel(file.name);

    const renderPlaceholderIcon = () => {
        if (officeExtension === ".pptx") return <PresentationIcon size={32} color="Gray" />;
        if (officeExtension === ".xlsx") return <Table size={32} color="Gray" />;
        if (officeExtension === ".docx") return <FileText size={32} color="Gray" />;
        return <PresentationIcon size={32} color="Gray" />;
    };

    return (
        <div className={styles.card}>
            {/* Image Preview */}
            <div className={styles.preview}>
                <div className={styles.previewContent}>
                    {file.url ? (
                        <img
                            src={file.url}
                            alt="Chart Preview"
                            width={32}
                            height={32}
                            className={styles.previewImage}
                            onError={e => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.nextElementSibling?.classList.remove("hidden");
                            }}
                        />
                    ) : null}
                    <div className={`${styles.placeholder} ${file.url ? "hidden" : ""}`}>{renderPlaceholderIcon()}</div>
                </div>

                {/* Hover Actions Overlay */}
                <div className={styles.overlay}>
                    <div className={styles.actions}>
                        {/* Preview Button */}
                        <button className={styles.actionButton} title="Preview" aria-label="Preview" onClick={() => onPreview(file)}>
                            <Eye size={20} className={styles.previewIcon} />
                        </button>
                        <button className={styles.actionButton} title="Download" onClick={() => onDownload(file)}>
                            <Download size={20} className={styles.downloadIcon} />
                        </button>
                        <button className={styles.actionButton} title="Delete" onClick={() => onDelete(file)}>
                            <Trash2 size={20} className={styles.deleteIcon} />
                        </button>
                        {isGoogleEditableFile && (
                            <button className={styles.actionButton} title={`Edit in ${googleEditorLabel}`} onClick={() => onEdit(file)}>
                                <Pencil size={20} className={styles.editIcon} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart Info */}
            <div className={styles.cardInfo}>
                <div className={styles.cardHeader}>
                    <h3 className={styles.fileName} title={file.name}>
                        {createFileName(file.name)}
                    </h3>
                    <div className={styles.fileMeta}>
                        <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                    </div>
                </div>
                <span className={styles.userTag}>{file.metadata.user_id ? getUserName(file.metadata.user_id) : "Unknown User"}</span>
                <p className={styles.fileDate}>Created {file.created_on ? new Date(file.created_on).toLocaleDateString() : "-"}</p>

                {/* Collapsible Description */}
                {file.metadata.artifact_desc && (
                    <div className={styles.descriptionContainer}>
                        <button className={styles.descriptionToggle} onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}>
                            Description
                            {isDescriptionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {isDescriptionOpen && <div className={styles.descriptionContent}>{file.metadata.artifact_desc}</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

const Gallery: React.FC = () => {
    const { user, organization } = useAppContext();

    const [showStatusFilter, setShowStatusFilter] = useState<boolean>(false);
    const [sortOrder, setSortOrder] = useState<string>("newest");

    const [userFilter, setUserFilter] = useState<string | null>(null);
    const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [fetchedImages, setFetchedImages] = useState<GalleryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>();
    const [showUserFilter, setShowUserFilter] = useState<boolean>(false);
    const [showTypeFilter, setShowTypeFilter] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [previewFile, setPreviewFile] = useState<GalleryItem | null>(null);
    const [editFile, setEditFile] = useState<GalleryItem | null>(null);
    const [fileToDelete, setFileToDelete] = useState<GalleryItem | null>(null);
    const [isDeletingFile, setIsDeletingFile] = useState<boolean>(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [itemsPerPage] = useState<number>(12);

    const orgId = organization?.id ?? "";
    const userId = user?.id ?? "";
    const usersErrorShownRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchUsers = async () => {
            try {
                const userData: UserData[] = await getUsers({ user });
                if (cancelled) return;
                setUsers(userData.map(u => ({ id: u.id, name: u.data?.name ?? "Unknown" })));
            } catch (err) {
                if (cancelled) return;
                console.error("[Gallery] getUsers failed:", err);

                if (!usersErrorShownRef.current) {
                    usersErrorShownRef.current = true;
                    toast.error("Error loading users");
                }
                setUsers([]);
            }
        };

        fetchUsers();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    useEffect(() => {
        const fetchAndProcessGalleryItems = async () => {
            if (!orgId) return;

            // Abort any previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new AbortController for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setIsLoading(true);
            try {
                const result = await getGalleryItems(orgId, {
                    user,
                    uploader_id: userFilter ?? undefined,
                    order: sortOrder as "newest" | "oldest",
                    query: searchQuery.trim() || undefined,
                    file_type: fileTypeFilter !== "all" ? fileTypeFilter : undefined,
                    page: currentPage,
                    limit: itemsPerPage,
                    signal: abortController.signal
                });

                // Only update state if this request wasn't aborted
                if (!abortController.signal.aborted) {
                    const galleryData = result.items as GalleryItem[];

                    // Update pagination state
                    setTotalPages(result.total_pages);

                    setImages(galleryData);
                    setFetchedImages(galleryData);
                }
            } catch (e) {
                // Don't log errors for aborted requests
                if (e instanceof Error && e.name !== "AbortError") {
                    console.error("Error fetching gallery items:", e);
                }
            } finally {
                // Only set loading to false if this request wasn't aborted
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        fetchAndProcessGalleryItems();

        // Cleanup function to abort request on unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [orgId, userId, userFilter, fileTypeFilter, sortOrder, searchQuery, currentPage, itemsPerPage]);

    const handleDownload = async (item: GalleryItem) => {
        if (!user?.id) {
            toast.error("Your session is not ready. Please refresh and try again.");
            return;
        }

        try {
            const sasUrl = await getBlobSasUrl(item.name, "documents", user);
            window.open(sasUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            console.error("Error generating download URL:", error);
            toast.error(`Could not download file: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    const handleDelete = (item: GalleryItem) => {
        setFileToDelete(item);
    };

    const handleConfirmDelete = async () => {
        if (!fileToDelete) return;

        setIsDeletingFile(true);
        try {
            await deleteSourceFileFromBlob(fileToDelete.name);
            toast.success(`File ${fileToDelete.name.split("/").pop()} deleted successfully`);
            setImages(currentImages => currentImages.filter(img => img.name !== fileToDelete.name));
            setFileToDelete(null);
        } catch (error) {
            console.error("Error deleting file:", error);
            toast.error(`Error deleting file: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsDeletingFile(false);
        }
    };

    const handleConfirmGoogleEdit = async () => {
        if (!editFile) return;

        try {
            const redirectUrl = await getGoogleEditableFileRedirectUrl({
                user,
                blobName: editFile.name
            });

            setEditFile(null);
            window.location.href = redirectUrl;
        } catch (error) {
            console.error("Error preparing Google edit redirect:", error);
            toast.error(`Could not open in Google Workspace: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };

    const createFileName = (name: string) => {
        const parts = name.split("/");
        const fileName = parts[parts.length - 1] || "";
        const dotIndex = fileName.lastIndexOf(".");
        const hasExtension = dotIndex > 0;
        const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
        const extension = hasExtension ? fileName.slice(dotIndex) : "";
        const maxLength = 20;
        const ellipsis = "...";

        if (fileName.length > maxLength) {
            // Keep the extension visible and truncate only the base file name.
            const visibleBaseLength = Math.max(1, maxLength - extension.length - ellipsis.length);
            return `${baseName.slice(0, visibleBaseLength)}${ellipsis}${extension}`;
        }

        return fileName;
    };

    const searchTimeout = useRef<number | null>(null);

    const handleSearch = (value: string) => {
        if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
        searchTimeout.current = window.setTimeout(() => {
            setSearchQuery((value || "").trim());
            setCurrentPage(1); // Reset to first page on search
        }, 250);
    };

    useEffect(() => {
        return () => {
            if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
        };
    }, []);

    const getUserName = (id: string) => {
        return users?.find(user => user.id === id)?.name;
    };

    const userOptions = useMemo((): User[] => {
        const map = new Map<string, string>();
        (users ?? []).forEach(u => map.set(u.id, u.name));

        (fetchedImages ?? []).forEach(f => {
            const id = f?.metadata?.user_id;
            if (id && !map.has(id)) {
                map.set(id, getUserName(id) ?? id);
            }
        });

        return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [users, fetchedImages]);

    return (
        <div className={styles.page_container}>
            <div className={styles.file_list_header}>
                <SearchBox
                    placeholder="Search files..."
                    onChange={(_, newValue) => handleSearch(newValue || "")}
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
                                    outline: "none",
                                    border: "2px solid #A0CB06"
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
                <div className={styles.filtersGroup}>
                    <div className={styles.filter}>
                        <div className={styles.filterContainer}>
                            <button
                                type="button"
                                className={styles.filterButton}
                                onClick={() => {
                                    setShowStatusFilter(!showStatusFilter);
                                    setShowUserFilter(false);
                                    setShowTypeFilter(false);
                                }}
                            >
                                <ArrowUpDown size={16} className={styles.filterIcon} />
                                {statusFilterOptions.find(opt => opt.value === sortOrder)?.label || "Sort by order"}
                            </button>

                            {showStatusFilter && (
                                <div className={`${styles.filterDropdown} ${styles.fileTypeDropdown}`}>
                                    <div className={styles.fileTypeDropdownList} aria-label="Sort order options">
                                        {statusFilterOptions.map(option => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={sortOrder === option.value}
                                                className={`${styles.fileTypeOption} ${sortOrder === option.value ? styles.fileTypeOptionActive : ""}`}
                                                onClick={() => {
                                                    setSortOrder(option.value);
                                                    setShowStatusFilter(false);
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                {sortOrder === option.value && <Check size={14} className={styles.fileTypeCheckIcon} />}
                                                <span className={styles.fileTypeOptionLabel}>{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles.filter}>
                        <div className={styles.filterContainer}>
                            <button
                                type="button"
                                className={styles.filterButton}
                                onClick={() => {
                                    setShowUserFilter(!showUserFilter);
                                    setShowStatusFilter(false);
                                    setShowTypeFilter(false);
                                }}
                            >
                                <Users size={16} className={styles.filterIcon} />
                                {userFilter ? (getUserName(userFilter) ?? userFilter) : "All Users"}
                            </button>

                            {showUserFilter && (
                                <div className={`${styles.filterDropdown} ${styles.fileTypeDropdown} ${styles.userDropdown}`}>
                                    <div className={styles.fileTypeDropdownList} aria-label="User options">
                                        <button
                                            type="button"
                                            aria-pressed={!userFilter}
                                            className={`${styles.fileTypeOption} ${!userFilter ? styles.fileTypeOptionActive : ""}`}
                                            onClick={() => {
                                                setUserFilter(null);
                                                setShowUserFilter(false);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            {!userFilter && <Check size={14} className={styles.fileTypeCheckIcon} />}
                                            <span className={styles.fileTypeOptionLabel}>All Users</span>
                                        </button>

                                        {userOptions.map(u => (
                                            <button
                                                key={u.id}
                                                type="button"
                                                aria-pressed={userFilter === u.id}
                                                className={`${styles.fileTypeOption} ${userFilter === u.id ? styles.fileTypeOptionActive : ""}`}
                                                onClick={() => {
                                                    setUserFilter(u.id);
                                                    setShowUserFilter(false);
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                {userFilter === u.id && <Check size={14} className={styles.fileTypeCheckIcon} />}
                                                <span className={styles.fileTypeOptionLabel}>{u.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles.filter}>
                        <div className={styles.filterContainer}>
                            <button
                                type="button"
                                className={styles.filterButton}
                                onClick={() => {
                                    setShowTypeFilter(!showTypeFilter);
                                    setShowStatusFilter(false);
                                    setShowUserFilter(false);
                                }}
                            >
                                <Filter size={16} className={styles.filterIcon} />
                                {fileTypeFilterOptions.find(opt => opt.value === fileTypeFilter)?.label ?? "File Type"}
                            </button>

                            {showTypeFilter && (
                                <div className={`${styles.filterDropdown} ${styles.fileTypeDropdown}`}>
                                    <div className={styles.fileTypeDropdownList} aria-label="File type options">
                                        {fileTypeFilterOptions.map(option => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={fileTypeFilter === option.value}
                                                className={`${styles.fileTypeOption} ${fileTypeFilter === option.value ? styles.fileTypeOptionActive : ""}`}
                                                onClick={() => {
                                                    setFileTypeFilter(option.value);
                                                    setShowTypeFilter(false);
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                {fileTypeFilter === option.value && <Check size={14} className={styles.fileTypeCheckIcon} />}
                                                <span className={styles.fileTypeOptionLabel}>{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {isLoading ? (
                <Spinner
                    styles={{
                        root: {
                            marginTop: "50px"
                        }
                    }}
                />
            ) : (
                <>
                    <div className={styles.container}>
                        {/* Green Header */}
                        <div className={styles.header}>
                            <div className={styles.headerContent}>
                                <h2 className={styles.headerTitle}>Charts</h2>
                                <span className={styles.headerCount}>Page count: {images.length}</span>
                            </div>
                        </div>

                        {images.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyContent}>
                                    <Upload size={48} className={styles.emptyIcon} />
                                    <p className={styles.emptyTitle}>No charts found</p>
                                    <p className={styles.emptySubtitle}>
                                        {userFilter ? `No charts found for ${getUserName(userFilter) ?? userFilter}` : "No visualization charts available"}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={styles.content}>
                                    {/* Scrollable grid wrapper: limits height and enables vertical scrolling when needed */}
                                    <div className={styles.gridScrollable}>
                                        <div className={styles.grid}>
                                            {images.map(file => (
                                                <GalleryCard
                                                    key={file.name}
                                                    file={file}
                                                    onDownload={handleDownload}
                                                    onDelete={handleDelete}
                                                    onPreview={setPreviewFile}
                                                    onEdit={setEditFile}
                                                    getUserName={getUserName}
                                                    createFileName={createFileName}
                                                    formatFileSize={formatFileSize}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className={styles.paginationContainer}>
                        <div className={styles.pagination}>
                            <button
                                className={`${styles.paginationButton} ${currentPage === 1 ? styles.paginationButtonDisabled : ""}`}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                title="Previous page"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            {/* Page Numbers */}
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        className={`${styles.paginationButton} ${currentPage === pageNum ? styles.paginationButtonActive : ""}`}
                                        onClick={() => setCurrentPage(pageNum)}
                                        title={`Go to page ${pageNum}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button
                                className={`${styles.paginationButton} ${currentPage === totalPages ? styles.paginationButtonDisabled : ""}`}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                title="Next page"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* PPTX Preview Modal */}
            {previewFile && (
                <div className={styles.modalOverlay} onClick={() => setPreviewFile(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>{previewFile.name.split("/").pop()}</h3>
                            <button className={styles.modalCloseButton} onClick={() => setPreviewFile(null)} title="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <Suspense fallback={<div style={{ textAlign: "center", padding: "2rem", color: "#A0CB06" }}>Loading viewer...</div>}>
                                {shouldUseDocumentViewer(previewFile.name) ? (
                                    <PptxViewer file="" blobName={previewFile.name} />
                                ) : (
                                    <div>
                                        <img
                                            src={previewFile.url}
                                            alt="Chart Preview"
                                            className={styles.previewImage}
                                            onError={e => {
                                                e.currentTarget.style.display = "none";
                                                e.currentTarget.nextElementSibling?.classList.remove("hidden");
                                            }}
                                        />
                                    </div>
                                )}
                            </Suspense>
                        </div>
                    </div>
                </div>
            )}

            {editFile && (
                <div className={styles.modalOverlay} onClick={() => setEditFile(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>Edit in {getGoogleEditorLabel(editFile.name)}</h3>
                            <button className={styles.modalCloseButton} onClick={() => setEditFile(null)} title="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.confirmModalBody}>
                            A copy of this document will be created in your Google Drive and opened in {getGoogleEditorLabel(editFile.name)}. Changes made there
                            will not affect the original file in this Vault.
                        </div>
                        <div className={styles.confirmModalActions}>
                            <button className={styles.confirmButtonSecondary} onClick={() => setEditFile(null)}>
                                Cancel
                            </button>
                            <button className={styles.confirmButtonPrimary} onClick={handleConfirmGoogleEdit}>
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <DeleteConfirmModal
                isOpen={Boolean(fileToDelete)}
                itemType="File"
                itemName={fileToDelete?.name.split("/").pop() || ""}
                onCancel={() => {
                    if (!isDeletingFile) {
                        setFileToDelete(null);
                    }
                }}
                onConfirm={handleConfirmDelete}
                warningMessage="The file will be permanently deleted in 1 day."
                isDeleting={isDeletingFile}
            />
        </div>
    );
};

export default Gallery;
