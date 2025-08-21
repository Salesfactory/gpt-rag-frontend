import React, { useState, useEffect, useRef } from "react";
import { Spinner } from "@fluentui/react";
import styles from "./URLPreviewComponent.module.css";
import { getFileType, isImageFile } from "../../utils/functions";
import { getFileBlob } from "../../api/api";

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

export const URLPreviewComponent: React.FC<URLPreviewComponentProps> = ({
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
        if (isGenerating) {
            return;
        }
        const loadFile = async () => {
            if (!url) return;

            setIsLoading(true);
            setError(null);
            setImageLoaded(false);

            try {
                const blob = await getFileBlob(url, "documents");
                const fileType = getFileType(url);
                const objectUrl = URL.createObjectURL(blob);

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
    }, [url, onLoad, onError]);

    useEffect(() => {
        return () => {
            if (fileBlob?.url) {
                URL.revokeObjectURL(fileBlob.url);
            }
        };
    }, [fileBlob]);

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
            // For non-image files, show a file icon with download option
            return (
                <div className={styles.filePreview}>
                    <div className={styles.fileIcon}>📄</div>
                    <div className={styles.fileName}>{url.split("/").pop()}</div>
                    <a href={fileBlob.url} download={url.split("/").pop()} className={styles.downloadLink}>
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

export default URLPreviewComponent;
