import { IconButton, SearchBox } from "@fluentui/react";
import styles from "./UploadResources.module.css";
import { Plus, RefreshCw, Search } from "lucide-react";
import CloudStorageIndicator from "./CloudStorageIndicator";
import type { StorageData } from "./CloudStorageIndicator";

const FileListHeader: React.FC<{
    setSearchQuery: (query: string) => void;
    openUploadDialog: () => void;
    onRefresh: () => void;
    isLoading: boolean;
    getStorageUsage?: () => Promise<StorageData | undefined>;
}> = ({
    setSearchQuery,
    openUploadDialog,
    onRefresh,
    isLoading,
    getStorageUsage
}) => {
    return (
        <div className={styles.headerContainer}>
            {/* Cloud Storage */}
            <CloudStorageIndicator isLoading={isLoading} getStorageUsage={getStorageUsage} />

            {/* Search + Actions */}
            <div className={styles.file_list_header}>
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
                <div className={styles.file_list_actions}>
                    <IconButton title="Reload" ariaLabel="Reload file list" className={styles.refresh_button} onClick={onRefresh}>
                        <RefreshCw size={20} />
                    </IconButton>
                </div>
            </div>
            <IconButton title="Upload New Files" ariaLabel="Upload New Files" className={styles.upload_button} onClick={openUploadDialog}>
                <span className={styles.addIcon}>
                    <Plus />
                </span>
                <span className={styles.buttonText}>Upload File</span>
            </IconButton>
        </div>
    );
};

export default FileListHeader;
