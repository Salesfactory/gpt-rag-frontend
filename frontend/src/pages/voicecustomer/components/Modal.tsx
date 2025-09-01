import React from "react";
import { X } from "lucide-react";
import styles from "../VoiceCustomer.module.css";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalContainer}>
            <div className={styles.modalOverlay} onClick={onClose} />
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{title}</h3>
                    <button onClick={onClose} className={styles.modalCloseButton}>
                        <X size={24} />
                    </button>
                </div>
                <div className={styles.modalContent}>{children}</div>
            </div>
        </div>
    );
};
