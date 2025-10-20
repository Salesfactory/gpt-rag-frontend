import React, { useState } from 'react';
import { IconButton } from "@fluentui/react/lib/Button";
import { Text } from "@fluentui/react/lib/Text";
import { Spinner } from "@fluentui/react/lib/Spinner";
import styles from "./UploadResources.module.css";
import { Download, Trash2, FileText, Table, Presentation, Folder, Edit2, Clock, ArrowUpDown, FolderUp, Check, X } from "lucide-react";
import { formatFileSize } from "../../utils/fileUtils";
import { BlobItem, FolderItem } from "../../types";
import NewFolderDialogModal from "./NewFolderDialogModal";
import { createFolder, moveFile, renameFile, renameFolder } from "../../api/api";
import { TextField } from "@fluentui/react/lib/TextField";

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
  organizationId?: string;
  onRefresh?: () => void;
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
  navigateToRoot,
  organizationId,
  onRefresh
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [draggedFile, setDraggedFile] = useState<BlobItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isMovingFile, setIsMovingFile] = useState<boolean>(false);
  const [editing, setEditing] = useState<{ type: "file" | "folder"; id: string; value: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const INVALID_NAME = /[\\/#?%*:|"<>^\r\n]/;


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

  const splitBaseAndExt = (name: string) => {
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return { base: name, ext: "" };
    return { base: name.slice(0, dot), ext: name.slice(dot) };
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

  // Handler for creating a new folder
  const handleCreateFolder = async (folderName: string) => {
    if (!organizationId) {
      console.error('Organization ID is required to create a folder');
      alert('Unable to create folder: Organization ID is missing');
      return;
    }

    setIsCreatingFolder(true);
    try {
      await createFolder(organizationId, folderName, currentPath);
      setShowNewFolderModal(false);
      
      // Refresh the file list to show the new folder
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error creating folder:', error);
      alert(error.message || 'Failed to create folder. Please try again.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, file: BlobItem) => {
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.name);
    
    // Add a slight opacity to the dragged element
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedFile(null);
    setDropTarget(null);
    
    // Reset opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    setDropTarget(targetPath);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drop target if we're leaving the element entirely
    if (e.currentTarget === e.target) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, destinationFolderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDropTarget(null);
    
    if (!draggedFile || !organizationId) {
      return;
    }

    // Don't move if dropping on the same location
    const currentFileFolder = draggedFile.name.substring(0, draggedFile.name.lastIndexOf('/'));
    const expectedPrefix = `organization_files/${organizationId}/`;
    const currentRelativePath = currentFileFolder.replace(expectedPrefix, '');
    
    if (currentRelativePath === destinationFolderPath) {
      console.log('File is already in this folder');
      return;
    }

    setIsMovingFile(true);
    
    try {
      await moveFile(organizationId, draggedFile.name, destinationFolderPath);
      
      // Refresh the file list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error moving file:', error);
      alert(error.message || 'Failed to move file. Please try again.');
    } finally {
      setIsMovingFile(false);
      setDraggedFile(null);
    }
  };

  const startEditFolder = (folder: FolderItem) => {
     setEditing({ type: "folder", id: folder.full_path, value: folder.name });
   };

  const startEditFile = (file: BlobItem) => {
     const visible = getDisplayName(file.name);
     const { base } = splitBaseAndExt(visible);
     setEditing({ type: "file", id: file.name, value: base });
   };

  const cancelEdit = () => {
     setEditing(null);
   };

  const saveRename = async () => {
    if (!editing) return;
    if (!organizationId) {
      alert("Unable to rename: Organization ID is missing");
      return;
    }
    const trimmed = (editing.value || "").trim();
    if (!trimmed) {
      alert("El nombre no puede estar vacío.");
      return;
    }
    if (INVALID_NAME.test(trimmed)) {
      alert('El nombre no puede contener \\ / # ? % * : | " < > ^ ni saltos de línea.');
      return;
    }
    setIsRenaming(true);
    try {
      if (editing.type === "folder") {
        await renameFolder(organizationId, editing.id, trimmed);
      } else {
        const visible = getDisplayName(editing.id);
        const { ext } = splitBaseAndExt(visible);
        await renameFile(organizationId, editing.id, `${trimmed}${ext}`);
      }
      setEditing(null);
      onRefresh?.();
    } catch (error: any) {
      alert(error?.message || "No se pudo renombrar.");
    } finally {
      setIsRenaming(false);
    }
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
      {isLoading || isMovingFile || isRenaming ? (
        <div className={styles.loading_container}>
          <Spinner label={isRenaming ? "Renaming..." : isMovingFile ? "Moving file..." : "Loading files..."} />

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
                <div
                  className={styles.file_details}
                  onClick={(e) => {
                    if (editing?.type === "folder" && editing?.id === folder.full_path) e.stopPropagation();
                  }}
                >
                  {editing?.type === "folder" && editing?.id === folder.full_path ? (
                    <div className={styles.inline_edit_container}>
                      <TextField
                        value={editing.value}
                        onChange={(_, v) => setEditing(prev => (prev ? { ...prev, value: v ?? "" } : prev))}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") { ev.stopPropagation(); saveRename(); }
                          if (ev.key === "Escape") { ev.stopPropagation(); cancelEdit(); }
                        }}
                        autoFocus
                        disabled={isRenaming}
                        styles={{ fieldGroup: { height: 32, minWidth: 220 } }}
                      />
                      <div className={styles.inline_edit_actions}>
                        <IconButton title="Guardar" ariaLabel="Guardar" onClick={(e)=>{e.stopPropagation(); saveRename();}} disabled={isRenaming}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton title="Cancelar" ariaLabel="Cancelar" onClick={(e)=>{e.stopPropagation(); cancelEdit();}} disabled={isRenaming}>
                          <X size={16} />
                        </IconButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Text className={styles.file_name_text}>{folder.name}</Text>
                      <Text className={styles.file_metadata}>
                        Folder {dropTarget === folder.full_path ? '(Drop here)' : ''}
                      </Text>
                    </>
                  )}
                </div>
              </div>

              {/* Right Section - Actions */}
              <div className={styles.file_actions_container}>
                <IconButton 
                  title="Edit" 
                  ariaLabel="Edit"
                  onClick={(e) => { e.stopPropagation(); startEditFolder(folder); }}
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

          {/* Render Files (filter out init.txt marker files) */}
          {filteredFiles.filter(file => !file.name.endsWith('/init.txt')).map((file) => (
            <div
              key={file.name}
              className={styles.file_item_row}
            >
              {/* Left Section - Icon and Name */}
              <div className={styles.file_item_left}>
                <div className={`${styles.file_icon_container} ${styles.file}`}>
                  <FileText size={24} color="#f97316" />
                </div>
                <div
                  className={styles.file_details}
                  onClick={(e) => {
                    if (editing?.type === "file" && editing?.id === file.name) e.stopPropagation();
                  }}
                >
                  {editing?.type === "file" && editing?.id === file.name ? (
                    <div className={styles.inline_edit_container}>
                      <TextField
                        value={editing.value}
                        onChange={(_, v) => setEditing(prev => (prev ? { ...prev, value: v ?? "" } : prev))}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") saveRename();
                          if (ev.key === "Escape") cancelEdit();
                          ev.stopPropagation();
                        }}
                        autoFocus
                        disabled={isRenaming}
                        styles={{ fieldGroup: { height: 32, minWidth: 220 } }}
                      />
                      <span className={styles.inline_ext_badge}>
                        {splitBaseAndExt(getDisplayName(file.name)).ext || ""}
                      </span>
                      <div className={styles.inline_edit_actions}>
                        <IconButton title="Guardar" ariaLabel="Guardar" onClick={saveRename} disabled={isRenaming}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton title="Cancelar" ariaLabel="Cancelar" onClick={cancelEdit} disabled={isRenaming}>
                          <X size={16} />
                        </IconButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Text className={styles.file_name_text}>
                        {getDisplayName(file.name)}
                      </Text>
                      <Text className={styles.file_metadata}>
                        Uploaded on {formatUploadDate(file.created_on)}
                      </Text>
                    </>
                  )}
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
                  title="Edit"
                  ariaLabel="Edit"
                  onClick={(e) => { e.stopPropagation(); startEditFile(file); }}
                  styles={{ root: { minWidth: '32px', width: '32px', height: '32px' } }}
                >
                  <Edit2 size={16} color="#6b7280" />
                </IconButton>
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

          {/* Empty state (excluding init.txt marker files) */}
          {(() => {
            const visibleFiles = filteredFiles.filter(file => !file.name.endsWith('/init.txt'));
            const isEmpty = filteredFolders.length === 0 && visibleFiles.length === 0;
            
            return isEmpty ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <Text>No files or folders yet</Text>
              </div>
            ) : null;
          })()}
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

