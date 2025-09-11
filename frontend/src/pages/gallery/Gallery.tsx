import { toast } from "react-toastify";
import styles from "./Gallery.module.css";
import { ArrowUpDown, Download, Search, Trash2, Upload, Users } from "lucide-react";
import { SearchBox, Spinner } from "@fluentui/react";
import { useEffect, useState, useRef } from "react";
import { deleteSourceFileFromBlob, getFileBlob, getGalleryItems, getUsers } from "../../api";
import { useAppContext } from "../../providers/AppProviders";

const statusFilterOptions = [
    { label: "Latest", value: "latest" },
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
    const [selectedStatus, setSelectedStatus] = useState<string>("latest");
    const [userFilter, setUserFilter] = useState<string | null>(null);
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [fetchedImages, setFetchedImages] = useState<GalleryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                let userData: UserData[] = await getUsers({ user });
                const userList = userData.map(item => ({
                    id: item.id,
                    name: item.data.name
                }));
                setUsers(userList);
            } catch {
                console.log("");
            }
        };

        fetchUsers();

        const fetchAndProcessGalleryItems = async () => {
            if (!organization) return;

            setIsLoading(true);
            try {
                const itemsFromApi = await getGalleryItems(organization.id, { user });
                let galleryData: GalleryItem[] = [];
                if (Array.isArray(itemsFromApi)) {
                    galleryData = itemsFromApi;
                } else if (itemsFromApi && typeof itemsFromApi === "object" && "data" in itemsFromApi && Array.isArray((itemsFromApi as any).data)) {
                    galleryData = (itemsFromApi as { data: GalleryItem[] }).data;
                }

                if (galleryData.length === 0) {
                    setImages([]);
                    setFetchedImages([]);
                    setIsLoading(false);
                    return;
                }

                galleryData = [...galleryData].sort((a, b) => {
                    const ta = Date.parse(a.created_on || a.last_modified || "") || 0;
                    const tb = Date.parse(b.created_on || b.last_modified || "") || 0;
                    return tb - ta;
                });

                setImages(galleryData);
                setFetchedImages(galleryData);
                setIsLoading(false);

                galleryData.forEach(async itemToFetch => {
                    try {
                        const blob = await getFileBlob(itemToFetch.name, "documents");
                        const objectUrl = URL.createObjectURL(blob);

                        const updateImagesWithBlob = (currentImages: GalleryItem[]) =>
                            currentImages.map(img => (img.name === itemToFetch.name ? { ...img, blob: objectUrl } : img));

                        setImages(updateImagesWithBlob);
                        setFetchedImages(updateImagesWithBlob);
                    } catch (error) {
                        console.error(`Failed to get blob for ${itemToFetch.name}:`, error);
                    }
                });
            } catch (error) {
                console.error("Error fetching gallery items:", error);
                setIsLoading(false);
            }
        };

        fetchAndProcessGalleryItems();

        return () => {
            setImages(currentImages => {
                currentImages.forEach(item => {
                    if (item.blob) {
                        URL.revokeObjectURL(item.blob);
                    }
                });
                return [];
            });
        };
    }, [user, organization]);

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

    const sortImages = (order: string, source?: GalleryItem[]) => {
        const base = Array.isArray(source) ? [...source] : [...(images ?? [])];
        base.sort((a, b) => {
            const ta = Date.parse(a.created_on || a.last_modified || "") || 0;
            const tb = Date.parse(b.created_on || b.last_modified || "") || 0;
            return order === "latest" ? tb - ta : ta - tb;
        });
        setImages(base);
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

    const handleSearch = (searchQuery: string) => {
        if (searchTimeout.current) {
            window.clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = window.setTimeout(() => {
            const q = (searchQuery || "").trim().toLowerCase();

            if (!q) {
                setImages(fetchedImages ?? []);
                return;
            }

            const filtered = (fetchedImages ?? []).filter(img => {
                if (img.name && img.name.toLowerCase().includes(q)) return true;

                try {
                    const metaString = img.metadata ? JSON.stringify(img.metadata).toLowerCase() : "";
                    if (metaString.includes(q)) return true;
                } catch (e) {}

                if (img.created_on && new Date(img.created_on).toLocaleDateString().toLowerCase().includes(q)) return true;

                if (img.content_type && img.content_type.toLowerCase().includes(q)) return true;

                return false;
            });

            setImages(filtered);
        }, 200);
    };

    useEffect(() => {
        return () => {
            if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
        };
    }, []);

    const getUserName = (id: string) => {
        return users?.find(user => user.id === id)?.name;
    };

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
                <div className={styles.filter}>
                    <div className={styles.filterContainer}>
                        <button type="button" className={styles.filterButton} onClick={() => setShowStatusFilter(!showStatusFilter)}>
                            <ArrowUpDown size={16} className={styles.filterIcon} />
                            {statusFilterOptions.find(opt => opt.value === selectedStatus)?.label || "Sort by order"}
                        </button>

                        {showStatusFilter && (
                            <div className={styles.filterDropdown}>
                                <div className={styles.dropdownContent}>
                                    {statusFilterOptions.map(option => (
                                        <button
                                            key={option.value}
                                            className={`${styles.dropdownItem} ${selectedStatus === option.value ? styles.dropdownItemActive : ""}`}
                                            onClick={() => {
                                                setSelectedStatus(option.value);
                                                // sort using the fetchedImages as canonical source
                                                sortImages(option.value);
                                                setShowStatusFilter(false);
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
                                {images.length} chart
                                {images.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                    </div>

                    {images.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyContent}>
                                <Upload size={48} className={styles.emptyIcon} />
                                <p className={styles.emptyTitle}>No charts found</p>
                                <p className={styles.emptySubtitle}>{userFilter ? `No charts found for ${userFilter}` : "No visualization charts available"}</p>
                            </div>
                        </div>
                    ) : (
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
                                                <p className={styles.fileDate}>Created {new Date(file.created_on).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Gallery;
