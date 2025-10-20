import { useEffect, useRef } from "react";
import styles from "./UploadResources.module.css";
import { Trash2 } from "lucide-react";

interface DeleteFolderModalProps {
    folderName: string;
    closeDialog: () => void;
    onDeleteFolder: () => void;
    isDeleting?: boolean;
}

const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({ 
    folderName,
    closeDialog, 
    onDeleteFolder,
    isDeleting = false
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                if (!isDeleting) {
                    closeDialog();
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [closeDialog, isDeleting]);

    const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isDeleting) {
            closeDialog();
        }
    };

    useEffect(() => {
        document.addEventListener('keydown', handleKeyPress);
        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    }, [isDeleting]);

    return (
        <div className={styles.custom_modal_overlay}>
            <div className={styles.delete_folder_modal} ref={modalRef}>
                {/* Header */}
                <div className={styles.delete_folder_modal_header}>
                    <div className={styles.delete_folder_header_content}>
                        <div className={styles.delete_folder_header_icon}>
                            <Trash2 size={20} color="#dc2626" />
                        </div>
                        <h2 className={styles.delete_folder_modal_title}>Delete Folder</h2>
                    </div>
                </div>

                {/* Content */}
                <div className={styles.delete_folder_modal_content}>
                    <p className={styles.delete_folder_message}>
                        Are you sure you want to delete this folder?
                    </p>
                    <div className={styles.delete_folder_name_container}>
                        <span className={styles.delete_folder_name}>{folderName}</span>
                    </div>
                    <p className={styles.delete_folder_warning}>
                        All files and subfolders inside will be permanently deleted.
                    </p>
                </div>

                {/* Footer */}
                <div className={styles.delete_folder_modal_footer}>
                    <button 
                        onClick={closeDialog}
                        className={styles.delete_folder_cancel_button}
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onDeleteFolder}
                        className={styles.delete_folder_delete_button}
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Folder'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteFolderModal;

