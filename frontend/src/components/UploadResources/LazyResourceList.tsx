import React from 'react';
import { IconButton } from "@fluentui/react/lib/Button";
import { Text } from "@fluentui/react/lib/Text";
import { Spinner } from "@fluentui/react/lib/Spinner";
import styles from "./UploadResources.module.css";
import { Download, Trash2 } from "lucide-react";
import { formatDate, formatFileSize } from "../../utils/fileUtils";
import { BlobItem } from "../../types";
import { 
  LazyDetailsList, 
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn
} from "../FluentHeavyImpl";

interface ResourceListProps {
  filteredItems: BlobItem[];
  isLoading: boolean;
  deleteFile: (item: BlobItem) => void;
  handleDownload: (item: BlobItem) => void;
}

const LazyResourceList: React.FC<ResourceListProps> = ({ 
  filteredItems, 
  isLoading, 
  deleteFile, 
  handleDownload 
}) => {

  const columns: IColumn[] = [
    {
      key: "files",
      name: "Files",
      fieldName: "files",
      minWidth: 200,
      isResizable: true,
      isMultiline: false,
      flexGrow: 1,
      onRender: (item: BlobItem) => {
        const fileName = item.name.split("/").pop() || "";
        return (
          <div className={styles.file_name_cell}>
            <div>
              <Text className={styles.file_text} title={fileName} style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                maxWidth: '250px',
                flex: '1 1 auto'
              }}>
                {fileName}
              </Text>
            </div>
            <Text variant="small" style={{ color: '#6b7280', marginTop: '4px' }}>
              Uploaded on {formatDate(item.created_on)}
            </Text>
          </div>
        );
      }
    },
    {
      key: "details",
      name: "",
      fieldName: "",
      minWidth: 150,
      maxWidth: 150,
      onRender: (item: BlobItem) => {
        const fileName = item.name.split("/").pop() || "";
        const fileExtension = fileName.split(".").pop()?.toLowerCase(); 
        return (
          <div className={styles.file_name_cell_details}>
              <div className={styles.file_extension_pill}>{fileExtension?.toUpperCase() || "FILE"}</div>
              <div className={styles.file_size_pill}>{formatFileSize(item.size)}</div>
          </div>
        );
      }
    },
    {
      key: "actions",
      name: "Actions",
      minWidth: 120,
      maxWidth: 120,
      isResizable: false,
      isPadded: false,
      onRender: (item: BlobItem) => (
        <div className={styles.actions_cell} style={{ 
          display: 'flex', 
          gap: '8px', 
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%'
        }}>
          <IconButton 
            title="Download" 
            ariaLabel="Download" 
            onClick={() => handleDownload(item)}
            styles={{
              root: {
                minWidth: '32px',
                width: '32px',
                height: '32px'
              }
            }}
          >
            <Download size={16} className={styles.trashIcon} />
          </IconButton>
          <IconButton 
            title="Delete" 
            ariaLabel="Delete" 
            onClick={() => deleteFile(item)}
            styles={{
              root: {
                minWidth: '32px',
                width: '32px',
                height: '32px'
              }
            }}
          >
            <Trash2 size={16} className={styles.trashIcon} />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div className={styles.content_container} style={{ 
      minHeight: "60vh", 
      height: "65vh", 
      maxHeight: "75vh", 
      overflowY: "auto",
      width: "100%",
      maxWidth: "100%"
    }}>
      {/* File List View Section */}
      {isLoading ? (
        <div className={styles.loading_container}>
          <Spinner label="Loading files..." />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className={styles.file_list_container} style={{ 
          minHeight: "50vh", 
          height: "55vh", 
          maxHeight: "70vh", 
          overflowY: "auto",
          overflowX: "hidden",
          width: "100%"
        }}>
          <LazyDetailsList
            items={filteredItems}
            columns={columns}
            setKey="set"
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
            isHeaderVisible={true}
            className={styles.detailsListContainer}
            styles={{
              root: {
                borderRadius: "8px",
                width: "100%",
                maxWidth: "100%",
                overflowX: "hidden"
              }
            }}
            onRenderRow={(props: any, defaultRender: any) => {
              if (!props || !defaultRender) return null;

              const backgroundColor = "#ffffff";

              const customStyles = {
                root: {
                  backgroundColor,
                  width: "100%",
                  maxWidth: "100%"
                },
                fields: {
                  backgroundColor,
                  width: "100%"
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

export default LazyResourceList;
