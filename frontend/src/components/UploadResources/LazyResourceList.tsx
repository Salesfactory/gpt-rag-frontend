import React, { useState } from 'react';
import { IconButton } from "@fluentui/react/lib/Button";
import { Text } from "@fluentui/react/lib/Text";
import { Spinner } from "@fluentui/react/lib/Spinner";
import styles from "./UploadResources.module.css";
import { Download, Trash2, FileText, Table, Presentation, Folder, Edit2, Clock, ArrowUpDown, FolderUp, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { formatDate, formatFileSize } from "../../utils/fileUtils";
import { BlobItem, FolderItem } from "../../types";
import NewFolderDialogModal from "./NewFolderDialogModal";
import { createFolder, moveFile, deleteFolder, renameFile, renameFolder } from "../../api/api";
import { TextField } from "@fluentui/react/lib/TextField";
import DeleteFolderModal from "./DeleteFolderModal";

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
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  sortOrder?: "newest" | "oldest";
  onToggleSortOrder?: () => void;
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
  onRefresh,
  selectedCategory = 'all',
  onCategoryChange,
  sortOrder = 'newest',
  onToggleSortOrder
}) => {
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [draggedFile, setDraggedFile] = useState<BlobItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isMovingFile, setIsMovingFile] = useState<boolean>(false);

  const [editing, setEditing] = useState<{ type: "file" | "folder"; id: string; value: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const INVALID_NAME = /[\\/#?%*:|"<>^\r\n]/;

  const toOrgFullPath = (p: string) => {
    const clean = (p || "").replace(/^\/+|\/+$/g, "");
    if (!organizationId) return clean;
    const prefix = `organization_files/${organizationId}/`;
    return clean.startsWith(prefix) ? clean : `${prefix}${clean}`;
  };

  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState<boolean>(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState<boolean>(false);


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

    const lastPart = parts[parts.length - 1]

    return lastPart;
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
      alert("Name cannot be empty.");
      return;
    }
    if (INVALID_NAME.test(trimmed)) {
      alert('Name cannot contain \\ / # ? % * : | " < > ^ or line breaks.');
      return;
    }
    setIsRenaming(true);
    try {
      if (editing.type === "folder") {
        await renameFolder(organizationId, toOrgFullPath(editing.id), trimmed);
      } else {
        const visible = getDisplayName(editing.id);
        const { ext } = splitBaseAndExt(visible);
        await renameFile(organizationId, editing.id, `${trimmed}${ext}`);
      }
      setEditing(null);
      onRefresh?.();
    } catch (error: any) {
      alert(error?.message || "Rename failed.");
    } finally {
      setIsRenaming(false);
    }
  };

  // Handler for initiating folder deletion
  const handleDeleteFolderClick = (e: any, folder: FolderItem) => {
    e.stopPropagation();
    setFolderToDelete(folder);
    setShowDeleteFolderModal(true);
  };

  // Handler for confirming folder deletion
  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete || !organizationId) {
      return;
    }

    setIsDeletingFolder(true);

    try {
      await deleteFolder(organizationId, folderToDelete.full_path);

      // Close modal
      setShowDeleteFolderModal(false);
      setFolderToDelete(null);

      // Refresh the file list to reflect deletion
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      alert(error.message || 'Failed to delete folder. Please try again.');
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Handler for canceling folder deletion
  const handleCancelDeleteFolder = () => {
    if (!isDeletingFolder) {
      setShowDeleteFolderModal(false);
      setFolderToDelete(null);
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
              onClick={() => onCategoryChange?.(category.key)}
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
          <div className={styles.navigation_buttons}>
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
        </div>
        <div className={styles.header_actions_container}>
          <button
            className={styles.new_folder_button}
            onClick={() => setShowNewFolderModal(true)}
          >
            <span className={styles.new_folder_icon}>+</span>
            New Folder
          </button>
          <button
            className={styles.recent_button}
            onClick={onToggleSortOrder}
            title={sortOrder === "newest" ? "Showing newest first (click to show oldest first)" : "Showing oldest first (click to show newest first)"}
          >
            <Clock size={16} />
            {sortOrder === "newest" ? "Newest First" : "Oldest First"}
            {sortOrder === "newest" ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
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
          {/* Move to Parent Folder Drop Zone (only show when in a subfolder) */}
          {currentPath && (
            <div
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, currentPath.substring(0, currentPath.lastIndexOf('/')))}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, currentPath.substring(0, currentPath.lastIndexOf('/')))}
              className={`${styles.file_item_row} ${styles.drop_zone} ${dropTarget === currentPath.substring(0, currentPath.lastIndexOf('/')) ? styles.drop_target : ''
                }`}
              style={{
                backgroundColor: dropTarget === currentPath.substring(0, currentPath.lastIndexOf('/')) ? '#e0f2fe' : '#f8fafc',
                border: '2px dashed #94a3b8',
                cursor: 'default'
              }}
            >
              <div className={styles.file_item_left}>
                <div className={`${styles.file_icon_container}`}>
                  <FolderUp size={24} color="#3b82f6" />
                </div>
                <div className={styles.file_details}>
                  <Text className={styles.file_name_text} style={{ color: '#3b82f6', fontWeight: 600 }}>
                    Move to Parent Folder
                  </Text>
                  <Text className={styles.file_metadata}>
                    Drop files here to move them up one level
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* Render Folders First */}
          {filteredFolders.map((folder) => (
            <div
              key={folder.full_path}
              onClick={() => navigateToFolder(folder.full_path)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, folder.full_path)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.stopPropagation();
                handleDrop(e, folder.full_path);
              }}
              className={`${styles.file_item_row} ${styles.clickable} ${dropTarget === folder.full_path ? styles.drop_target : ''
                }`}
              style={{
                backgroundColor: dropTarget === folder.full_path ? '#dcfce7' : undefined,
                transition: 'background-color 0.2s ease'
              }}
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
                        <IconButton title="Save" ariaLabel="Save" onClick={(e) => { e.stopPropagation(); saveRename(); }} disabled={isRenaming}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton title="Cancel" ariaLabel="Cancel" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} disabled={isRenaming}>
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
                  onClick={(e) => handleDeleteFolderClick(e, folder)}
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
              draggable
              onDragStart={(e) => handleDragStart(e, file)}
              onDragEnd={handleDragEnd}
              className={styles.file_item_row}
              style={{
                cursor: 'grab',
                opacity: draggedFile?.name === file.name ? 0.5 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              {/* Left Section - Icon and Name */}
              <div className={styles.file_item_left}>
                <div className={`${styles.file_icon_container} ${styles.file}`}>
                  <FileText size={23} color="#f97316" />
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
                        <IconButton title="Save" ariaLabel="Save" onClick={saveRename} disabled={isRenaming}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton title="Cancel" ariaLabel="Cancel" onClick={cancelEdit} disabled={isRenaming}>
                          <X size={16} />
                        </IconButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Text className={styles.file_name_text}>
                        {getDisplayName(file.name)}
                      </Text>
                      <div>
                        <Text className={styles.file_description}>
                          <span className={styles.file_user_pill}>{file.name.slice(file.name.lastIndexOf('.') + 1).toLocaleUpperCase()}</span>
                          <span className={styles.file_size_pill}>
                            {formatFileSize(file.size)}
                          </span>
                        </Text>
                      </div>
                      <Text className={styles.file_metadata}>
                        {file.created_on.slice(0, file.created_on.lastIndexOf("T")).replaceAll("-", "/")}
                      </Text>
                    </>
                  )}
                </div>
              </div>

              {/* Middle Section - File Details */}
              {/* <div className={styles.file_badges_container}>
                <span className={styles.file_extension_badge}>
                  {getFileExtension(file.name)}
                </span>
                <span className={styles.file_size_badge}>
                  {formatFileSize(file.size)}
                </span>
              </div> */}

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

      {/* Delete Folder Modal */}
      {showDeleteFolderModal && folderToDelete && (
        <DeleteFolderModal
          folderName={folderToDelete.name}
          closeDialog={handleCancelDeleteFolder}
          onDeleteFolder={handleConfirmDeleteFolder}
          isDeleting={isDeletingFolder}
        />
      )}
    </div>
  );
};

export default LazyResourceList;

