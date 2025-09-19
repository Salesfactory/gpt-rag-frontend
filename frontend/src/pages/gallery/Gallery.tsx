import { toast } from "react-toastify";
import styles from "./Gallery.module.css";
import { ArrowUpDown, Download, Search, Trash2, Upload, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { SearchBox, Spinner } from "@fluentui/react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { deleteSourceFileFromBlob, getFileBlob, getGalleryItems, getUsers } from "../../api";
import { useAppContext } from "../../providers/AppProviders";

const statusFilterOptions = [
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" }
];

type GalleryItem = {
    content_type: string;
    created_on: string;
    last_modified: string;
    metadata: {
        user_id?: string;
    };
    name: string;
    size: number;
    url: string;
    blob?: string;
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

const Gallery: React.FC = () => {
    const { user, organization } = useAppContext();

    const [showStatusFilter, setShowStatusFilter] = useState<boolean>(false);
    const [sortOrder, setSortOrder] = useState<string>("newest");

    const [userFilter, setUserFilter] = useState<string | null>(null);
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [fetchedImages, setFetchedImages] = useState<GalleryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>();
    const [showUserFilter, setShowUserFilter] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [totalItems, setTotalItems] = useState<number>(0);
    const [itemsPerPage] = useState<number>(10);

    const orgId = organization?.id ?? "";
    const userId = user?.id ?? "";
    const usersErrorShownRef = useRef(false);

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
            setIsLoading(true);
            try {
                const result = await getGalleryItems(orgId, {
                    user,
                    uploader_id: userFilter ?? undefined,
                    order: sortOrder as "newest" | "oldest",
                    query: searchQuery.trim() || undefined,
                    page: currentPage,
                    limit: itemsPerPage
                });

                const galleryData = result.items as GalleryItem[];

                // Update pagination state
                setTotalPages(result.total_pages);
                setTotalItems(result.total);

                setImages(galleryData);
                setFetchedImages(galleryData);

                if (galleryData.length > 0) {
                    const pairs = await Promise.all(
                        galleryData.map(async item => {
                            try {
                                const blob = await getFileBlob(item.name, "documents");
                                return [item.name, URL.createObjectURL(blob)] as const;
                            } catch {
                                return [item.name, null] as const;
                            }
                        })
                    );

                    const map = new Map(pairs);
                    setImages(prev => prev.map(img => ({ ...img, blob: map.get(img.name) ?? img.blob })));
                    setFetchedImages(prev => prev.map(img => ({ ...img, blob: map.get(img.name) ?? img.blob })));
                }
            } catch (e) {
                console.error("Error fetching gallery items:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndProcessGalleryItems();
        return () => {
            setImages(curr => {
                curr.forEach(it => it.blob && URL.revokeObjectURL(it.blob));
                return [];
            });
        };
    }, [orgId, userId, userFilter, sortOrder, searchQuery, currentPage, itemsPerPage]);

    const handleDownload = (item: GalleryItem) => {
        const organizationId = user?.organizationId;

        const downloadUrl = `/api/download?organizationId=${organizationId}&blobName=${encodeURIComponent(item.name)}`;

        window.open(downloadUrl, "_blank");
    };

    const handleDelete = async (item: GalleryItem) => {
        if (window.confirm(`Are you sure you want to delete ${item.name.split("/").pop()}? (The file will be deleted permanently in 1 day)`)) {
            try {
                await deleteSourceFileFromBlob(item.name);
                toast.success(`File ${item.name.split("/").pop()} deleted successfully`);
                setImages(currentImages => currentImages.filter(img => img.name !== item.name));
            } catch (error) {
                console.error("Error deleting file:", error);
                toast.error(`Error deleting file: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };

    const createFileName = (name: string) => {
        const parts = name.split("/");
        const extension = parts[parts.length - 1].split(".").pop();
        const last_part = parts[parts.length - 1];
        return last_part.length > 20 ? last_part.slice(0, 16) + "..." + " ." + extension : last_part + "." + extension;
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

    console.log(totalPages);
    console.log(totalItems);
    console.log(images.length);
    console.log(currentPage);
    console.log(totalPages);
    console.log(totalItems);
    console.log(images.length);

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
                <div className={styles.filtersGroup}>
                    <div className={styles.filter}>
                        <div className={styles.filterContainer}>
                            <button type="button" className={styles.filterButton} onClick={() => setShowStatusFilter(!showStatusFilter)}>
                                <ArrowUpDown size={16} className={styles.filterIcon} />
                                {statusFilterOptions.find(opt => opt.value === sortOrder)?.label || "Sort by order"}
                            </button>

                            {showStatusFilter && (
                                <div className={styles.filterDropdown}>
                                    <div className={styles.dropdownContent}>
                                        {statusFilterOptions.map(option => (
                                            <button
                                                key={option.value}
                                                className={`${styles.dropdownItem} ${sortOrder === option.value ? styles.dropdownItemActive : ""}`}
                                                onClick={() => {
                                                    setSortOrder(option.value);
                                                    setCurrentPage(1); // Reset to first page on sort change
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles.filter}>
                        <div className={styles.filterContainer}>
                            <button type="button" className={styles.filterButton} onClick={() => setShowUserFilter(!showUserFilter)}>
                                <Users size={16} className={styles.filterIcon} />
                                {userFilter ? getUserName(userFilter) ?? userFilter : "All Users"}
                            </button>

                            {showUserFilter && (
                                <div className={styles.filterDropdown}>
                                    <div className={styles.dropdownContent}>
                                        <button
                                            className={`${styles.dropdownItem} ${!userFilter ? styles.dropdownItemActive : ""}`}
                                            onClick={() => {
                                                setUserFilter(null);
                                                setShowUserFilter(false);
                                                setCurrentPage(1); // Reset to first page on filter change
                                            }}
                                        >
                                            All Users
                                        </button>

                                        {userOptions.map(u => (
                                            <button
                                                key={u.id}
                                                className={`${styles.dropdownItem} ${userFilter === u.id ? styles.dropdownItemActive : ""}`}
                                                onClick={() => {
                                                    setUserFilter(u.id);
                                                    setShowUserFilter(false);
                                                    setCurrentPage(1); // Reset to first page on filter change
                                                }}
                                            >
                                                {u.name}
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
                <div className={styles.container}>
                    {/* Green Header */}
                    <div className={styles.header}>
                        <div className={styles.headerContent}>
                            <h2 className={styles.headerTitle}>Charts</h2>
                            <span className={styles.headerCount}>
                                {totalItems} chart{totalItems !== 1 ? "s" : ""} (showing {images.length})
                            </span>
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
                                            <div key={file.name} className={styles.card}>
                                                {/* Image Preview */}
                                                <div className={styles.preview}>
                                                    <div className={styles.previewContent}>
                                                        {file.blob ? (
                                                            <img src={file.blob} alt="Chart Preview" width={32} height={32} className={styles.previewImage} />
                                                        ) : (
                                                            <div className={styles.placeholder}>No Preview Available</div>
                                                        )}
                                                    </div>

                                                    {/* Hover Actions Overlay */}
                                                    <div className={styles.overlay}>
                                                        <div className={styles.actions}>
                                                            <button className={styles.actionButton} title="Download" onClick={() => handleDownload(file)}>
                                                                <Download size={16} className={styles.downloadIcon} />
                                                            </button>
                                                            <button className={styles.actionButton} title="Delete" onClick={() => handleDelete(file)}>
                                                                <Trash2 size={16} className={styles.deleteIcon} />
                                                            </button>
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
                                                    <span className={styles.userTag}>
                                                        {file.metadata.user_id ? getUserName(file.metadata.user_id) : "Unknown User"}
                                                    </span>
                                                    <p className={styles.fileDate}>
                                                        Created {file.created_on ? new Date(file.created_on).toLocaleDateString() : "-"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    {/* Pagination Controls */}
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
                </div>
            )}
        </div>
    );
};

export default Gallery;
