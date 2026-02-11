import { IconButton, SearchBox } from "@fluentui/react";
import styles from "./UploadResources.module.css";
import { Plus, RefreshCw, Search } from "lucide-react";
import CloudStorageIndicator from "./CloudStorageIndicator";

const FileListHeader: React.FC<{
    setSearchQuery: (query: string) => void;
    openUploadDialog: () => void;
    onRefresh: () => void;
    isLoading: boolean;
    isPageLimitExceeded: boolean;
}> = ({ setSearchQuery, openUploadDialog, onRefresh, isLoading, isPageLimitExceeded }) => {
    return (
        <div className={styles.headerContainer}>
            {/* Cloud Storage */}
            <CloudStorageIndicator isLoading={isLoading} />

            {/* Search + Upload (juntos) + Refresh (derecha) */}
            <div className={styles.file_list_header}>
                <div className={styles.searchUploadRowOnly}>
                    <div className={styles.searchUploadGroup}>
                        <SearchBox
                            placeholder="Search files..."
                            className={styles.responsiveSearch}
                            onChange={(_, newValue) => setSearchQuery(newValue || "")}
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
                                    marginRight: "12px",
                                    selectors: {
                                        ":focus-within": {
                                            outline: "none",
                                            border: `1px solid #A0CB06` // highlight border on focus
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
                        <div className={styles.tooltipWrapper} style={{ marginLeft: 0 }}>
                            <IconButton
                                title="Upload New Files"
                                ariaLabel="Upload New Files"
                                disabled={isPageLimitExceeded}
                                className={styles.upload_button}
                                onClick={openUploadDialog}
                            >
                                <span className={styles.addIcon}>
                                    <Plus />
                                </span>
                                <span className={styles.buttonText}>Upload Files</span>
                            </IconButton>
                            {isPageLimitExceeded && <span className={styles.tooltipText}>Page limit exceeded</span>}
                        </div>
                    </div>
                    <IconButton title="Reload" ariaLabel="Reload file list" className={styles.refresh_button} onClick={onRefresh}>
                        <RefreshCw size={20} />
                    </IconButton>
                </div>
            </div>
        </div>
    );
};

export default FileListHeader;
