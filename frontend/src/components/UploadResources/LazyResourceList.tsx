import React, { useState } from 'react';
import { IconButton } from "@fluentui/react/lib/Button";
import { Text } from "@fluentui/react/lib/Text";
import { Spinner } from "@fluentui/react/lib/Spinner";
import styles from "./UploadResources.module.css";
import { Download, Trash2, FileText, Table, Presentation, Folder, Edit2, Clock, ArrowUpDown } from "lucide-react";
import { formatDate, formatFileSize } from "../../utils/fileUtils";
import { BlobItem, FolderItem } from "../../types";
import NewFolderDialogModal from "./NewFolderDialogModal";

interface ResourceListProps {
  filteredFiles: BlobItem[];
  filteredFolders: FolderItem[];
  currentPath: string;
  isLoading: boolean;
  deleteFile: (item: BlobItem) => void;
  handleDownload: (item: BlobItem) => void;
  navigateToFolder: (folderPath: string) => void;
  navigateBack: () => void;
  navigateToRoot: () => void;
}

const LazyResourceList: React.FC<ResourceListProps> = ({ 
  filteredFiles,
  filteredFolders,
  currentPath,
  isLoading, 
  deleteFile, 
  handleDownload,
  navigateToFolder,
  navigateBack,
  navigateToRoot
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);

  // Helper function to get file extension from blob name
  const getFileExtension = (fileName: string): string => {
    const parts = fileName.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toUpperCase();
    }
    return 'FILE';
  };

  // Helper function to get display name from blob name
  const getDisplayName = (fullName: string): string => {
    const parts = fullName.split('/');
    return parts[parts.length - 1];
  };

  // Helper function to format upload date
  const formatUploadDate = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  const categories = [
    { key: 'all', label: 'All', icon: <FileText size={20} /> },
    { key: 'documents', label: 'Documents', icon: <FileText size={20} /> },
    { key: 'spreadsheets', label: 'Spreadsheets', icon: <Table size={20} /> },
    { key: 'presentations', label: 'Presentations', icon: <Presentation size={20} /> }
  ];

  // Get the current folder name from path
  const getCurrentFolderName = (): string => {
    if (!currentPath) return 'All Files';
    const parts = currentPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'All Files';
  };

  // Handler for creating a new folder (placeholder - to be implemented later)
  const handleCreateFolder = (folderName: string) => {
    console.log('Creating folder:', folderName, 'in path:', currentPath);
    // TODO: Implement actual folder creation logic with API call
    setShowNewFolderModal(false);
  };

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
          <Folder size={24} color="#16a34a" />
          <Text className={styles.folder_title}>
            {getCurrentFolderName()}
          </Text>
          {currentPath && (
            <button
              onClick={navigateBack}
              className={styles.back_button}
            >
              Back
            </button>
          )}
          {currentPath && (
            <button
              onClick={navigateToRoot}
              className={styles.back_button}
              style={{ marginLeft: '8px' }}
            >
              Go to Root
            </button>
          )}
        </div>
        <div className={styles.header_actions_container}>
          <button 
            className={styles.new_folder_button}
            onClick={() => setShowNewFolderModal(true)}
          >
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
          {/* Render Folders First */}
          {filteredFolders.map((folder) => (
            <div
              key={folder.full_path}
              onClick={() => navigateToFolder(folder.full_path)}
              className={`${styles.file_item_row} ${styles.clickable}`}
            >
              {/* Left Section - Icon and Name */}
              <div className={styles.file_item_left}>
                <div className={`${styles.file_icon_container} ${styles.folder}`}>
                  <Folder size={24} color="#f59e0b" />
                </div>
                <div className={styles.file_details}>
                  <Text className={styles.file_name_text}>
                    {folder.name}
                  </Text>
                  <Text className={styles.file_metadata}>
                    Folder
                  </Text>
                </div>
              </div>

              {/* Right Section - Actions */}
              <div className={styles.file_actions_container}>
                <IconButton 
                  title="Edit" 
                  ariaLabel="Edit"
                  onClick={(e) => e.stopPropagation()}
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
              </div>
            </div>
          ))}

          {/* Render Files */}
          {filteredFiles.map((file) => (
            <div
              key={file.name}
              className={styles.file_item_row}
            >
              {/* Left Section - Icon and Name */}
              <div className={styles.file_item_left}>
                <div className={`${styles.file_icon_container} ${styles.file}`}>
                  <FileText size={24} color="#f97316" />
                </div>
                <div className={styles.file_details}>
                  <Text className={styles.file_name_text}>
                    {getDisplayName(file.name)}
                  </Text>
                  <Text className={styles.file_metadata}>
                    Uploaded on {formatUploadDate(file.created_on)}
                  </Text>
                </div>
              </div>

              {/* Middle Section - File Details */}
              <div className={styles.file_badges_container}>
                <span className={styles.file_extension_badge}>
                  {getFileExtension(file.name)}
                </span>
                <span className={styles.file_size_badge}>
                  {formatFileSize(file.size)}
                </span>
              </div>

              {/* Right Section - Actions */}
              <div className={styles.file_actions_container}>
                <IconButton 
                  title="Download" 
                  ariaLabel="Download"
                  onClick={() => handleDownload(file)}
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
                  onClick={() => deleteFile(file)}
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
              </div>
            </div>
          ))}

          {/* Empty state */}
          {filteredFolders.length === 0 && filteredFiles.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <Text>No files or folders found</Text>
            </div>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <NewFolderDialogModal
          closeDialog={() => setShowNewFolderModal(false)}
          onCreateFolder={handleCreateFolder}
        />
      )}
    </div>
  );
};

export default LazyResourceList;

