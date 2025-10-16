import React, { useState } from 'react';
import { IconButton } from "@fluentui/react/lib/Button";
import { Text } from "@fluentui/react/lib/Text";
import { Spinner } from "@fluentui/react/lib/Spinner";
import styles from "./UploadResources.module.css";
import { Download, Trash2, FileText, Table, Presentation, Folder, Edit2, Clock, ArrowUpDown } from "lucide-react";
import { formatDate, formatFileSize } from "../../utils/fileUtils";
import { BlobItem } from "../../types";

interface ResourceListProps {
  filteredItems: BlobItem[];
  isLoading: boolean;
  deleteFile: (item: BlobItem) => void;
  handleDownload: (item: BlobItem) => void;
}

// Placeholder data
const placeholderFolders = [
  { id: 1, name: "Presentations", fileCount: 5, owner: "Lisa Wang", type: "folder" },
  { id: 2, name: "Reports", fileCount: 8, owner: "Mike Johnson", type: "folder" },
  { id: 3, name: "Research", fileCount: 12, owner: "Sarah Chen", type: "folder" }
];

const placeholderFiles = [
  { 
    id: 4, 
    name: "hd_reviews_formatted.pdf", 
    type: "file", 
    extension: "PDF", 
    size: 205.7 * 1024, 
    uploadedOn: "7/22/2025 05:09 PM", 
    uploadedBy: "John Doe" 
  }
];

const LazyResourceList: React.FC<ResourceListProps> = ({ 
  filteredItems, 
  isLoading, 
  deleteFile, 
  handleDownload 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);

  // Comment out the real API data for now
  // const displayItems = filteredItems;

  const categories = [
    { key: 'all', label: 'All', icon: <FileText size={20} /> },
    { key: 'documents', label: 'Documents', icon: <FileText size={20} /> },
    { key: 'spreadsheets', label: 'Spreadsheets', icon: <Table size={20} /> },
    { key: 'presentations', label: 'Presentations', icon: <Presentation size={20} /> }
  ];

  const handleFolderClick = (folderId: number) => {
    setCurrentFolder(folderId);
  };

  const handleBackToAll = () => {
    setCurrentFolder(null);
  };

  const displayItems = currentFolder === null 
    ? [...placeholderFolders, ...placeholderFiles]
    : placeholderFiles; // In the future, this would show files from the specific folder

  return (
    <div className={styles.content_container} style={{ 
      minHeight: "60vh", 
      width: "100%",
      maxWidth: "100%"
    }}>
      {/* Category Filter Section */}
      <div className={styles.category_filter_section}>
        <Text className={styles.category_label}>
          Category
        </Text>
        <div className={styles.category_buttons_container}>
          {categories.map(category => (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              className={`${styles.category_button} ${selectedCategory === category.key ? styles.selected : ''}`}
            >
              <div className={styles.category_button_icon}>
                {category.icon}
              </div>
              <Text className={styles.category_button_text}>
                {category.label}
              </Text>
            </button>
          ))}
        </div>
      </div>

      {/* All Files Header Section */}
      <div className={styles.all_files_header}>
        <div className={styles.folder_header_left}>
          <Folder size={24} color="#10b981" />
          <Text className={styles.folder_title}>
            {currentFolder === null ? 'All Files' : placeholderFolders.find(f => f.id === currentFolder)?.name || 'Folder'}
          </Text>
          {currentFolder !== null && (
            <button
              onClick={handleBackToAll}
              className={styles.back_button}
            >
              Back to All Files
            </button>
          )}
        </div>
        <div className={styles.header_actions_container}>
          <button className={styles.new_folder_button}>
            <span className={styles.new_folder_icon}>+</span>
            New Folder
          </button>
          <button className={styles.recent_button}>
            <Clock size={16} />
            Recent
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* File List View Section */}
      {isLoading ? (
        <div className={styles.loading_container}>
          <Spinner label="Loading files..." />
        </div>
      ) : (
        <div className={styles.file_list_wrapper}>
          {displayItems.map((item: any) => (
            <div
              key={item.id}
              onClick={() => item.type === 'folder' ? handleFolderClick(item.id) : null}
              className={`${styles.file_item_row} ${item.type === 'folder' ? styles.clickable : ''}`}
            >
              {/* Left Section - Icon and Name */}
              <div className={styles.file_item_left}>
                <div className={`${styles.file_icon_container} ${item.type === 'folder' ? styles.folder : styles.file}`}>
                  {item.type === 'folder' ? (
                    <Folder size={24} color="#f59e0b" />
                  ) : (
                    <FileText size={24} color="#f97316" />
                  )}
                </div>
                <div className={styles.file_details}>
                  <Text className={styles.file_name_text}>
                    {item.name}
                  </Text>
                  {item.type === 'folder' ? (
                    <Text className={styles.file_metadata}>
                      {item.fileCount} files • Owner: {item.owner}
                    </Text>
                  ) : (
                    <Text className={styles.file_metadata}>
                      Uploaded on {item.uploadedOn} • {item.uploadedBy}
                    </Text>
                  )}
                </div>
              </div>

              {/* Middle Section - File Details (for files only) */}
              {item.type === 'file' && (
                <div className={styles.file_badges_container}>
                  <span className={styles.file_extension_badge}>
                    {item.extension}
                  </span>
                  <span className={styles.file_size_badge}>
                    {formatFileSize(item.size)}
                  </span>
                </div>
              )}

              {/* Right Section - Actions */}
              <div className={styles.file_actions_container}>
                {item.type === 'folder' ? (
                  <>
                    <IconButton 
                      title="Edit" 
                      ariaLabel="Edit"
                      styles={{
                        root: {
                          minWidth: '32px',
                          width: '32px',
                          height: '32px'
                        }
                      }}
                    >
                      <Edit2 size={16} color="#6b7280" />
                    </IconButton>
                    <IconButton 
                      title="Delete" 
                      ariaLabel="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      styles={{
                        root: {
                          minWidth: '32px',
                          width: '32px',
                          height: '32px'
                        }
                      }}
                    >
                      <Trash2 size={16} color="#6b7280" />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <IconButton 
                      title="Download" 
                      ariaLabel="Download"
                      styles={{
                        root: {
                          minWidth: '32px',
                          width: '32px',
                          height: '32px'
                        }
                      }}
                    >
                      <Download size={16} color="#6b7280" />
                    </IconButton>
                    <IconButton 
                      title="Delete" 
                      ariaLabel="Delete"
                      styles={{
                        root: {
                          minWidth: '32px',
                          width: '32px',
                          height: '32px'
                        }
                      }}
                    >
                      <Trash2 size={16} color="#6b7280" />
                    </IconButton>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LazyResourceList;
