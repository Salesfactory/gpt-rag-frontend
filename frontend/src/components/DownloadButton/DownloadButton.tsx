import styles from "./DownloadButton.module.css";

const DownloadButton = ({ isEnabled, onClick }: { isEnabled: boolean; onClick: () => void }) => {
    return (
        <div className={styles.tooltipContainer}>
            <button
                className={isEnabled ? styles.downloadButton : styles.downloadButtonDisabled}
                onClick={onClick}
                aria-label="Download conversation"
                type="button"
                disabled={!isEnabled}
                title="Download conversation"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19A2 2 0 0119 21H5A2 2 0 013 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>
            <span className={styles.tooltipText}>Download conversation</span>
        </div>
    );
};

export default DownloadButton; 