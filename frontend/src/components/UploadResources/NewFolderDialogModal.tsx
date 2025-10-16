import { useEffect, useRef, useState } from "react";
import styles from "./UploadResources.module.css";

interface NewFolderDialogModalProps {
    closeDialog: () => void;
    onCreateFolder: (folderName: string) => void;
}

const NewFolderDialogModal: React.FC<NewFolderDialogModalProps> = ({ 
    closeDialog, 
    onCreateFolder 
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [folderName, setFolderName] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                closeDialog();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [closeDialog]);

    const validateFolderName = (name: string): string => {
        if (!name.trim()) {
            return "Folder name cannot be empty";
        }
        
        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(name)) {
            return "Folder name contains invalid characters (< > : \" / \\ | ? *)";
        }
        
        // Check if name is too long
        if (name.length > 255) {
            return "Folder name is too long (max 255 characters)";
        }
        
        // Check for reserved names
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                              'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                              'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        if (reservedNames.includes(name.toUpperCase())) {
            return "This is a reserved folder name";
        }
        
        return "";
    };

    const handleCreate = () => {
        const validationError = validateFolderName(folderName);
        if (validationError) {
            setError(validationError);
            return;
        }
        
        onCreateFolder(folderName.trim());
        closeDialog();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFolderName(e.target.value);
        // Clear error when user starts typing
        if (error) {
            setError("");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCreate();
        } else if (e.key === 'Escape') {
            closeDialog();
        }
    };

    return (
        <div className={styles.custom_modal_overlay}>
            <div className={styles.new_folder_modal} ref={modalRef}>
                {/* Header */}
                <div className={styles.new_folder_modal_header}>
                    <div className={styles.new_folder_header_content}>
                        <div className={styles.new_folder_header_icon}>
                            <span className={styles.plus_icon}>+</span>
                        </div>
                        <h2 className={styles.new_folder_modal_title}>Create New Folder</h2>
                    </div>
                </div>

                {/* Content */}
                <div className={styles.new_folder_modal_content}>
                    <div className={styles.new_folder_form_group}>
                        <label htmlFor="folder-name-input" className={styles.new_folder_label}>
                            Folder name
                        </label>
                        <input
                            id="folder-name-input"
                            type="text"
                            value={folderName}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder="Enter folder name"
                            className={`${styles.new_folder_input} ${error ? styles.input_error : ''}`}
                            autoFocus
                        />
                        {error && (
                            <div className={styles.error_message}>
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={styles.new_folder_modal_footer}>
                    <button 
                        onClick={closeDialog}
                        className={styles.new_folder_cancel_button}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleCreate}
                        className={styles.new_folder_create_button}
                    >
                        Create Folder
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewFolderDialogModal;

