import { useRef } from "react";
import styles from "./AttachButton.module.css";

type Props = {
  isEnabled: boolean;
  isUploading?: boolean;
  onFilesSelected: (files: File[]) => void;
  accept?: string;   
  multiple?: boolean;
  ariaLabel?: string;
  className?: string;
};

const AttachButton = ({
  isEnabled,
  isUploading,
  onFilesSelected,
  accept,
  multiple = true,
  ariaLabel = "Attach file",
  className
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!isEnabled || isUploading) return;
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
        disabled={!isEnabled || !!isUploading}
        className={isEnabled && !isUploading ? styles.attachButton : styles.attachButtonDisabled}
        aria-label="Attach file"
        title={isUploading ? "Uploading..." : "Attach file"}
        data-testid="attach-file-button"
      >
        {isUploading ? (
          <svg width="22" height="22" viewBox="0 0 24 24" className={styles.spinner} aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"
              strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="31.416">
              <animate attributeName="stroke-dashoffset" dur="1.2s" values="31.416;0" repeatCount="indefinite"/>
              <animate attributeName="stroke-dasharray" dur="1.2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
            </circle>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21.44 11.05l-8.49 8.49a6 6 0 11-8.49-8.49l9.19-9.19a4 4 0 115.66 5.66l-9.19 9.19a2 2 0 11-2.83-2.83l7.78-7.78"
              stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
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

      <span className={styles.tooltipText}>
        {isUploading ? "Uploading..." : "Attach file"}
      </span>
    </div>
  );
};

export default AttachButton;
