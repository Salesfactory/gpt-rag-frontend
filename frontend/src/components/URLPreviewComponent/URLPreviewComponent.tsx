import React, { useState, useEffect, useRef, memo } from "react";
import { Spinner, Icon } from "@fluentui/react";
import styles from "./URLPreviewComponent.module.css";
import { getFileType, isImageFile } from "../../utils/functions";
import { getFileBlob } from "../../api/api";
import { blobCache } from "../../utils/blobCache";

export interface URLPreviewComponentProps {
    url: string;
    alt?: string;
    className?: string;
    displayMode?: "thumbnail" | "full" | "modal";
    isGenerating?: boolean;
    onLoad?: () => void;
    onError?: (error: Error) => void;
    maxWidth?: string;
    maxHeight?: string;
}

interface FileBlob {
    blob: Blob;
    url: string;
    type: string;
}

const URLPreviewComponentBase: React.FC<URLPreviewComponentProps> = ({
    url,
    alt = "Preview",
    className = "",
    displayMode = "full",
    isGenerating,
    onLoad,
    onError,
    maxWidth = "100%",
    maxHeight = "400px"
}) => {
    const [fileBlob, setFileBlob] = useState<FileBlob | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isGenerating || !url) {
            return;
        }

        const loadFile = async () => {
            // Check if we have this blob cached
            const cached = blobCache.get(url);
            if (cached) {
                setFileBlob({
                    blob: cached.blob,
                    url: cached.url,
                    type: cached.type
                });
                setImageLoaded(false); // Reset for new load
                onLoad?.();
                return;
            }

            setIsLoading(true);
            setError(null);
            setImageLoaded(false);

            try {
                const blob = await getFileBlob(url, "documents");
                const fileType = getFileType(url);
                const objectUrl = blobCache.set(url, blob, fileType);

                setFileBlob({
                    blob,
                    url: objectUrl,
                    type: fileType
                });

                onLoad?.();
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
                setError(errorMessage);
                onError?.(err instanceof Error ? err : new Error(errorMessage));
            } finally {
                setIsLoading(false);
            }
        };

        loadFile();
    }, [url, isGenerating]); // Removed onLoad and onError from dependencies

    // No longer need to manually revoke URLs - the cache manages this

    // Handle modal close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                setIsModalOpen(false);
            }
        };

        if (isModalOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.body.style.overflow = "unset";
        };
    }, [isModalOpen]);

    // Handle escape key for modal
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isModalOpen) {
                setIsModalOpen(false);
            }
        };

        document.addEventListener("keydown", handleEscapeKey);
        return () => document.removeEventListener("keydown", handleEscapeKey);
    }, [isModalOpen]);

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleImageError = () => {
        setError("Failed to load image");
        setImageLoaded(false);
    };

    const handleThumbnailClick = () => {
        if (displayMode === "thumbnail") {
            setIsModalOpen(true);
        }
    };

    const getDisplayStyles = () => {
        const baseStyles: React.CSSProperties = {};

        switch (displayMode) {
            case "thumbnail":
                return {
                    ...baseStyles,
                    maxWidth: "150px",
                    maxHeight: "150px",
                    cursor: "pointer"
                };
            case "full":
                return {
                    ...baseStyles,
                    maxWidth,
                    maxHeight
                };
            case "modal":
                return {
                    ...baseStyles,
                    maxWidth: "90vw",
                    maxHeight: "90vh"
                };
            default:
                return baseStyles;
        }
    };

    if (isLoading || isGenerating) {
        return (
            <div className={styles.loadingContainer}>
                <Spinner size={3} />
                <span className={styles.loadingText}>Loading preview...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${styles.container} ${styles.errorContainer} ${className}`}>
                <div className={styles.errorIcon}>⚠️</div>
                <div className={styles.errorText}>
                    <p>Failed to load preview</p>
                    <small>{error}</small>
                </div>
            </div>
        );
    }

    if (!fileBlob) {
        return null;
    }

    const isImage = isImageFile(url);
    const isPowerPoint = url.toLowerCase().endsWith('.pptx') || url.toLowerCase().endsWith('.ppt');
    const isExcel = url.toLowerCase().endsWith('.xlsx') || url.toLowerCase().endsWith('.xls');
    const isWord = url.toLowerCase().endsWith('.docx') || url.toLowerCase().endsWith('.doc');
    const isPDF = url.toLowerCase().endsWith('.pdf');

    const getFileIcon = () => {
        if (isPowerPoint) {
            return { name: "PowerPointDocument", color: "#D24726", label: "PowerPoint Slide" };
        } else if (isExcel) {
            return { name: "ExcelDocument", color: "#217346", label: "Excel Spreadsheet" };
        } else if (isWord) {
            return { name: "WordDocument", color: "#2B579A", label: "Word Document" };
        } else if (isPDF) {
            return { name: "PDF", color: "#DC3E15", label: "PDF Document" };
        } else {
            return { name: "Page", color: "#605E5C", label: "Document" };
        }
    };

    const renderContent = () => {
        if (isImage) {
            return (
                <>
                    <img
                        src={fileBlob.url}
                        alt={alt}
                        style={getDisplayStyles()}
                        className={`${styles.image} ${displayMode === "thumbnail" ? styles.thumbnail : ""}`}
                        onClick={handleThumbnailClick}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                    />
                    {!imageLoaded && (
                        <div className={styles.imageLoadingOverlay}>
                            <Spinner size={2} />
                        </div>
                    )}
                </>
            );
        } else {
            const fileIcon = getFileIcon();
            const fileName = url.split("/").pop() || "document";

            return (
                <div className={styles.filePreview}>
                    <Icon
                        iconName={fileIcon.name}
                        className={styles.fileIcon}
                        style={{ color: fileIcon.color, fontSize: '48px' }}
                    />
                    <div className={styles.fileTypeLabel} style={{ color: fileIcon.color, fontWeight: 600 }}>
                        {fileIcon.label}
                    </div>
                    <div className={styles.fileName}>{fileName}</div>
                    <a href={fileBlob.url} download={fileName} className={styles.downloadLink}>
                        Download
                    </a>
                </div>
            );
        }
    };

    return (
        <>
            <div className={`${styles.container} ${className}`}>{renderContent()}</div>

            {/* Modal for thumbnail expansion */}
            {isModalOpen && isImage && (
                <div className={styles.modal}>
                    <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)} />
                    <div className={styles.modalContent} ref={modalRef}>
                        <button className={styles.modalCloseButton} onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                            ✕
                        </button>
                        <img src={fileBlob.url} alt={alt} className={styles.modalImage} style={getDisplayStyles()} />
                    </div>
                </div>
            )}
        </>
    );
};

// Memoize component to prevent unnecessary re-renders
export const URLPreviewComponent = memo(URLPreviewComponentBase);

export default URLPreviewComponent;
