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
      <div style={{ 
        padding: '20px 0', 
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '20px'
      }}>
        <Text style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          color: '#6b7280',
          marginBottom: '12px',
          display: 'block'
        }}>
          Category
        </Text>
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          flexWrap: 'wrap' 
        }}>
          {categories.map(category => (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px 24px',
                border: selectedCategory === category.key ? '2px solid #10b981' : '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: selectedCategory === category.key ? '#f0fdf4' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: '120px'
              }}
            >
              <div style={{ color: selectedCategory === category.key ? '#10b981' : '#6b7280' }}>
                {category.icon}
              </div>
              <Text style={{ 
                fontSize: '14px', 
                fontWeight: 500,
                color: selectedCategory === category.key ? '#10b981' : '#374151'
              }}>
                {category.label}
              </Text>
            </button>
          ))}
        </div>
      </div>

      {/* All Files Header Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Folder size={24} color="#10b981" />
          <Text style={{ 
            fontSize: '18px', 
            fontWeight: 600,
            color: '#10b981'
          }}>
            {currentFolder === null ? 'All Files' : placeholderFolders.find(f => f.id === currentFolder)?.name || 'Folder'}
          </Text>
          {currentFolder !== null && (
            <button
              onClick={handleBackToAll}
              style={{
                marginLeft: '12px',
                padding: '6px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Back to All Files
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}>
            <span style={{ fontSize: '18px' }}>+</span>
            New Folder
          </button>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#6b7280'
          }}>
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
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {displayItems.map((item: any) => (
            <div
              key={item.id}
              onClick={() => item.type === 'folder' ? handleFolderClick(item.id) : null}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                cursor: item.type === 'folder' ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              {/* Left Section - Icon and Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '8px',
                  backgroundColor: item.type === 'folder' ? '#fef3c7' : '#fed7aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {item.type === 'folder' ? (
                    <Folder size={24} color="#f59e0b" />
                  ) : (
                    <FileText size={24} color="#f97316" />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Text style={{ 
                    fontSize: '15px', 
                    fontWeight: 500,
                    color: '#111827'
                  }}>
                    {item.name}
                  </Text>
                  {item.type === 'folder' ? (
                    <Text style={{ fontSize: '13px', color: '#6b7280' }}>
                      {item.fileCount} files • Owner: {item.owner}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: '13px', color: '#6b7280' }}>
                      Uploaded on {item.uploadedOn} • {item.uploadedBy}
                    </Text>
                  )}
                </div>
              </div>

              {/* Middle Section - File Details (for files only) */}
              {item.type === 'file' && (
                <div style={{ 
                  display: 'flex', 
                  gap: '8px',
                  marginRight: '20px'
                }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {item.extension}
                  </span>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    fontSize: '12px',
                    fontWeight: 500
                  }}>
                    {formatFileSize(item.size)}
                  </span>
                </div>
              )}

              {/* Right Section - Actions */}
              <div style={{ 
                display: 'flex', 
                gap: '8px',
                alignItems: 'center'
              }}>
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
