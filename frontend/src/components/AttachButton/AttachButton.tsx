import { useRef } from "react";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import styles from "./AttachButton.module.css";

type AttachButtonProps = {
    isEnabled: boolean;
    isUploading?: boolean;
    onFilesSelected: (files: File[]) => void;
    accept?: string;
    multiple?: boolean;
    ariaLabel?: string;
    className?: string;
};

const AttachButton = ({ isEnabled, isUploading = false, onFilesSelected, accept, multiple = false, ariaLabel = "Attach file", className }: AttachButtonProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const disabled = !isEnabled || isUploading;

    const handleClick = () => {
        if (disabled) return;
        inputRef.current?.click();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length) onFilesSelected(files);
        e.target.value = "";
    };

    return (
        <div className={styles.tooltipContainer}>
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className={isEnabled && !isUploading ? styles.attachButton : styles.attachButtonDisabled}
                aria-label={ariaLabel}
                title={isUploading ? "Uploading..." : "Attach file"}
                data-testid="attach-file-button"
            >
                {isUploading ? (
                    <LoadingSpinner size={22} ariaLabel="Uploading…" />
                ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            d="M21.44 11.05l-8.49 8.49a6 6 0 11-8.49-8.49l9.19-9.19a4 4 0 115.66 5.66l-9.19 9.19a2 2 0 11-2.83-2.83l7.78-7.78"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>

            <input
                ref={inputRef}
                type="file"
                onChange={handleChange}
                accept={accept}
                multiple={multiple}
                tabIndex={-1}
                aria-hidden="true"
                className={styles.hiddenInput}
                style={{ display: "none" }}
            />

            <span className={styles.tooltipText}>{isUploading ? "Uploading..." : "Attach file"}</span>
        </div>
    );
};

export default AttachButton;
