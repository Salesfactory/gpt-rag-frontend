import { DetailsList, DetailsListLayoutMode, IColumn, SelectionMode } from "@fluentui/react/lib/DetailsList";
import { IconButton } from "@fluentui/react/lib/Button";
import { Text } from "@fluentui/react/lib/Text";
import { Spinner } from "@fluentui/react/lib/Spinner";
import styles from "./UploadResources.module.css";
import { Download, Trash2, Search } from "lucide-react";
import { formatDate, formatFileSize } from "../../utils/fileUtils";
import { MAX_FILENAME_LENGTH } from "../../constants";
import { BlobItem } from "../../types";

const ResourceList = ({ filteredItems, isLoading, deleteFile, handleDownload }: {
    filteredItems: BlobItem[];
    isLoading: boolean;
    deleteFile: (item: BlobItem) => void;
    handleDownload: (item: BlobItem) => void
}) => {

    const columns: IColumn[] = [
        {
            key: "files",
            name: "Files",
            fieldName: "files",
            minWidth: 500,
            maxWidth: 1300,
            isResizable: true,
            onRender: (item: BlobItem) => {
                const fileName = item.name.split("/").pop() || "";
                const fileExtension = fileName.split(".").pop()?.toLowerCase();
                let displayName = fileName;
                if (fileName.length > MAX_FILENAME_LENGTH) {
                    const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                    displayName = fileName.substring(0, MAX_FILENAME_LENGTH - ext.length - 3) + "..." + ext;
                }
                return (
                    <div className={styles.file_name_cell}>
                        <div className={styles.file_info_row}>
                            <Text className={styles.file_text} title={fileName}>
                                {displayName}
                            </Text>
                            <div className={styles.file_extension_pill}>{fileExtension?.toUpperCase() || "FILE"}</div>
                            <div className={styles.file_size_pill}>{formatFileSize(item.size)}</div>
                        </div>
                        <span>Uploaded on {formatDate(item.created_on)}</span>
                    </div>
                );
            }
        },
        {
            key: "actions",
            name: "Actions",
            minWidth: 100,
            maxWidth: 70,
            isResizable: false,
            isPadded: false,
            onRender: (item: BlobItem) => (
                <div className={styles.actions_cell}>
                    <IconButton title="Download" ariaLabel="Download" onClick={() => handleDownload(item)}>
                        <Download className={styles.trashIcon} />
                    </IconButton>
                    <IconButton title="Delete" ariaLabel="Delete" onClick={() => deleteFile(item)}>
                        <Trash2 className={styles.trashIcon} />
                    </IconButton>
                </div>
            )
        }
    ];

    return (
        <div className={styles.content_container} style={{ minHeight: "60vh", height: "65vh", maxHeight: "75vh", overflowY: "auto" }}>
            {/* File List View Section */}
            {isLoading ? (
                <div className={styles.loading_container}>
                    <Spinner label="Loading files..." />
                </div>
            ) : filteredItems.length > 0 ? (
                <div className={styles.file_list_container} style={{ minHeight: "50vh", height: "55vh", maxHeight: "70vh", overflowY: "auto" }}>
                    <DetailsList
                        items={filteredItems}
                        columns={columns}
                        setKey="set"
                        layoutMode={DetailsListLayoutMode.justified}
                        selectionMode={SelectionMode.none}
                        isHeaderVisible={true}
                        className={styles.detailsListContainer}
                        styles={{
                            root: {
                                borderRadius: "8px"
                            }
                        }}
                        onRenderRow={(props, defaultRender) => {
                            if (!props || !defaultRender) return null;

                            const backgroundColor = "#ffffff";

                            const customStyles = {
                                root: {
                                    backgroundColor
                                },
                                fields: {
                                    backgroundColor
                                }
                            };

                            return defaultRender({
                                ...props,
                                styles: customStyles
                            });
                        }}
                    />
                </div>
            ) : (
                <div className={styles.no_files_container}>
                    <Text>No files found. Upload files to see them listed here.</Text>
                </div>
            )}
        </div>
    );
};

export default ResourceList;