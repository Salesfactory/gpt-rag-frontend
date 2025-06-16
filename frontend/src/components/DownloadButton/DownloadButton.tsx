import styles from "./DownloadButton.module.css";

const DownloadButton = ({ isEnabled, isLoading, onClick }: { isEnabled: boolean; isLoading?: boolean; onClick: () => void }) => {
    return (
        <div className={styles.tooltipContainer}>
            <button
                className={isEnabled && !isLoading ? styles.downloadButton : styles.downloadButtonDisabled}
                onClick={onClick}
                aria-label={isLoading ? "Downloading conversation..." : "Download conversation"}
                type="button"
                disabled={!isEnabled || isLoading}
                title={isLoading ? "Downloading conversation..." : "Download conversation"}
            >
                {isLoading ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.spinner}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="31.416">
                            <animate attributeName="stroke-dashoffset" dur="2s" values="31.416;0" repeatCount="indefinite"/>
                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15V19A2 2 0 0119 21H5A2 2 0 013 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>
            <span className={styles.tooltipText}>
                {isLoading ? "Downloading conversation..." : "Download conversation"}
            </span>
        </div>
    );
};

export default DownloadButton; 